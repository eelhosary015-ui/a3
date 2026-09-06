import { erpPool } from "../../../server-erp-core.js";
import { CreatePurchaseDTO } from "../dto/purchase.dto.js";

export class PurchaseRepository {
  async getAll(): Promise<any[]> {
    const query = `
      SELECT p.*, s.name as supplier_name, w.name as warehouse_name 
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      ORDER BY p.date DESC
    `;
    const result = await erpPool.query(query);
    return result.rows;
  }

  async findById(id: number): Promise<any> {
    const query = `
      SELECT p.*, s.name as supplier_name, w.name as warehouse_name 
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      WHERE p.id = $1
    `;
    const result = await erpPool.query(query, [id]);
    if (result.rows.length === 0) return null;

    const itemsQuery = `
      SELECT pi.*, i.name as ingredient_name, i.unit
      FROM purchase_items pi
      JOIN ingredients i ON pi.ingredient_id = i.id
      WHERE pi.purchase_id = $1
    `;
    const itemsResult = await erpPool.query(itemsQuery, [id]);
    
    return {
      ...result.rows[0],
      items: itemsResult.rows
    };
  }

  async create(purchase: CreatePurchaseDTO): Promise<any> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // Idempotency: the same supplier invoice must never be recorded twice.
      if (purchase.invoice_number) {
        const duplicate = await client.query(
          `SELECT * FROM purchases WHERE supplier_id=$1 AND (invoice_number=$2 OR supplier_invoice_number=$2) ORDER BY id DESC LIMIT 1`,
          [purchase.supplier_id, purchase.invoice_number]
        );
        if (duplicate.rows[0]) {
          await client.query("ROLLBACK");
          return duplicate.rows[0];
        }
      }

      const poId = purchase.purchase_order_id || purchase.order_id || null;
      const total = Number(purchase.total_amount || 0);
      const paid = Math.max(0, Math.min(Number(purchase.paid_amount || 0), total));
      const dueDate = purchase.due_date || null;

      const purchaseResult = await client.query(`
        INSERT INTO purchases (
          supplier_id, warehouse_id, invoice_number, supplier_invoice_number, internal_invoice_number, total_amount, paid_amount, status, notes,
          due_date, currency, payment_status, purchase_order_id, receipt_id, subtotal,
          tax_amount, discount_amount, shipping_amount, matching_status, invoice_status,
          created_by, branch_id, cost_center_id, payment_method, treasury_account_id, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'posted',$20,$21,$22,$23,$24,$25,CURRENT_TIMESTAMP)
        RETURNING *
      `, [
        purchase.supplier_id, purchase.warehouse_id, null, purchase.invoice_number || null, null, total, paid,
        paid >= total ? 'paid' : paid > 0 ? 'partially_paid' : 'received', purchase.notes || null,
        dueDate, purchase.currency || 'EGP', paid >= total ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid',
        poId, purchase.receipt_id || null, Number((purchase as any).subtotal ?? total),
        Number((purchase as any).tax_amount || 0), Number((purchase as any).discount_amount || 0), Number((purchase as any).shipping_amount || 0),
        purchase.receipt_id ? 'matched' : 'pending', purchase.created_by || null,
        purchase.branch_id || null, purchase.cost_center_id || null, purchase.payment_method || null, purchase.treasury_account_id || null
      ]);
      const newPurchase = purchaseResult.rows[0];
      const generatedInvoiceNumber = `PINV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(newPurchase.id).padStart(6,'0')}`;
      const internalInvoiceNumber = generatedInvoiceNumber;
      await client.query(`UPDATE purchases SET invoice_number=$1, internal_invoice_number=$1 WHERE id=$2`, [internalInvoiceNumber, newPurchase.id]);
      newPurchase.invoice_number = internalInvoiceNumber;
      newPurchase.internal_invoice_number = internalInvoiceNumber;
      newPurchase.supplier_invoice_number = purchase.invoice_number || null;

      for (const item of purchase.items) {
        await client.query(
          `INSERT INTO purchase_items (purchase_id, ingredient_id, quantity, unit_price, total_price)
           VALUES ($1,$2,$3,$4,$5)`,
          [newPurchase.id, item.ingredient_id, item.quantity, item.unit_price, Number(item.quantity) * Number(item.unit_price)]
        );
      }

      // If no GRN was supplied, create the canonical warehouse GRN now.
      let receiptId = purchase.receipt_id ? Number(purchase.receipt_id) : null;
      if (receiptId) {
        const gr = await client.query(`SELECT id, purchase_order_id, warehouse_id, supplier_id, total_landed_cost FROM goods_receipts WHERE id=$1`, [receiptId]);
        if (!gr.rows[0]) throw new Error(`Goods receipt #${receiptId} not found`);
        if (Number(gr.rows[0].warehouse_id) !== Number(purchase.warehouse_id)) throw new Error('Warehouse mismatch between purchase invoice and goods receipt');
        if (Number(gr.rows[0].supplier_id || 0) !== Number(purchase.supplier_id)) throw new Error('Supplier mismatch between purchase invoice and goods receipt');
        const used = await client.query(`SELECT id FROM purchases WHERE receipt_id=$1 AND id<>$2 LIMIT 1`, [receiptId, newPurchase.id]);
        if (used.rows[0]) throw new Error(`Goods receipt #${receiptId} is already linked to purchase invoice #${used.rows[0].id}`);
        if (poId && Number(gr.rows[0].purchase_order_id || 0) !== Number(poId)) throw new Error('Purchase order mismatch between invoice and goods receipt');
        await client.query(`UPDATE purchase_order_items poi SET invoiced_quantity=COALESCE(invoiced_quantity,0)+pi.quantity FROM purchase_items pi WHERE pi.purchase_id=$1 AND pi.ingredient_id=poi.ingredient_id AND poi.purchase_order_id=$2`, [newPurchase.id, poId]);
        const matchDiff = Math.abs(Number(gr.rows[0].total_landed_cost || 0) - total);
        await client.query(`UPDATE purchases SET matching_status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [matchDiff <= 0.01 ? 'matched' : 'exception', newPurchase.id]);
        newPurchase.matching_status = matchDiff <= 0.01 ? 'matched' : 'exception';
      } else {
        const { createPostedGoodsReceiptForPurchase } = await import('../services/purchase-integration.service.js');
        const receipt = await createPostedGoodsReceiptForPurchase(client, { ...purchase, purchase_order_id: poId, invoice_number: purchase.invoice_number || `INV-${newPurchase.id}` }, newPurchase.id, purchase.items);
        receiptId = receipt.id;
        await client.query(`UPDATE purchases SET receipt_id=$1, matching_status='matched', status='received', updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [receiptId, newPurchase.id]);
        newPurchase.receipt_id = receiptId;
        newPurchase.matching_status = 'matched';
      }

      // Supplier sub-ledger: one invoice transaction only.
      await client.query(`
        INSERT INTO supplier_transactions (
          supplier_id,type,amount,notes,reference_id,reference_type,currency,due_date,document_number,status,created_by
        ) VALUES ($1,'purchase',$2,$3,$4,'purchase_invoice',$5,$6,$7,'posted',$8)
        ON CONFLICT DO NOTHING
      `, [purchase.supplier_id,total,`فاتورة شراء #${newPurchase.invoice_number || newPurchase.id}`,newPurchase.id,purchase.currency || 'EGP',dueDate,newPurchase.invoice_number || null,typeof purchase.created_by === 'number' ? purchase.created_by : null]);
      await client.query(`UPDATE suppliers SET balance=COALESCE(balance,0)+$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [total,purchase.supplier_id]);

      // Any payment embedded in the invoice is a real supplier payment, and is
      // optionally mirrored to the selected/main treasury account.
      if (paid > 0) {
        const pay = await client.query(`
          INSERT INTO supplier_transactions (supplier_id,type,amount,notes,reference_id,reference_type,currency,status,created_by,payment_method)
          VALUES ($1,'payment',$2,$3,$4,'purchase_payment',$5,'posted',$6,$7) RETURNING id
        `, [purchase.supplier_id,paid,`دفعة مع فاتورة #${newPurchase.invoice_number || newPurchase.id}`,newPurchase.id,purchase.currency || 'EGP',typeof purchase.created_by === 'number' ? purchase.created_by : null,purchase.payment_method || 'cash']);
        await client.query(`UPDATE suppliers SET balance=GREATEST(0,COALESCE(balance,0)-$1), updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [paid,purchase.supplier_id]);
        await client.query(`INSERT INTO supplier_payment_allocations (payment_transaction_id,purchase_id,allocated_amount) VALUES ($1,$2,$3)`, [pay.rows[0].id,newPurchase.id,paid]);

        const method = String(purchase.payment_method || 'cash').toLowerCase();
        const desiredType = method === 'bank' || method === 'transfer' ? 'bank' : 'cash';
        const accountSql = purchase.treasury_account_id
          ? `SELECT id,current_balance FROM treasury_accounts WHERE id=$1 AND status='active' FOR UPDATE`
          : `SELECT id,current_balance FROM treasury_accounts WHERE status='active' AND type=$1 AND currency=$2 ORDER BY is_main DESC,id LIMIT 1 FOR UPDATE`;
        const account = purchase.treasury_account_id
          ? await client.query(accountSql,[purchase.treasury_account_id])
          : await client.query(accountSql,[desiredType,purchase.currency || 'EGP']);
        if (account.rows[0]) {
          const before = Number(account.rows[0].current_balance || 0);
          const after = before - paid;
          const voucher = `PAY-PUR-${newPurchase.id}-${Date.now().toString().slice(-6)}`;
          await client.query(`INSERT INTO treasury_transactions (account_id,amount,transaction_type,reference_type,reference_id,notes,status,voucher_number,voucher_type,payment_method,client_type,client_name,balance_before,balance_after,created_by) VALUES ($1,$2,'cash_out','purchase',$3,$4,'approved',$5,'payment',$6,'supplier',$7,$8,$9,$10)`, [account.rows[0].id,-paid,newPurchase.id,`سداد فاتورة شراء #${newPurchase.invoice_number || newPurchase.id}`,voucher,method,`supplier #${purchase.supplier_id}`,before,after,typeof purchase.created_by === 'number' ? purchase.created_by : null]);
          await client.query(`UPDATE treasury_accounts SET current_balance=current_balance-$1, available_balance=COALESCE(available_balance,current_balance)-$1 WHERE id=$2`, [paid,account.rows[0].id]);
        }
      }

      await client.query("COMMIT");
      return newPurchase;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
