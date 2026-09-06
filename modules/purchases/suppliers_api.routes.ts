import { Router, Request, Response } from "express";
import { pool } from "../../server-db.js";
import { ERPEventBus } from "../../server-erp-core.js";
import multer from "multer";
import crypto from "crypto";
import { PurchaseService } from "./services/purchase.service.js";
import { createPostedGoodsReceiptForPurchase } from "./services/purchase-integration.service.js";

const router = Router();

// Supplier documents are stored directly in PostgreSQL (BYTEA).
// Keep uploads bounded to protect the ERP server/database.
const supplierDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf", "image/jpeg", "image/png", "image/webp",
      "image/tiff", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ]);
    cb(null, allowed.has(file.mimetype));
  }
});

// ─── Suppliers Enterprise API ───

const supplierSelect = `
  SELECT s.*,
    COALESCE((SELECT SUM(p.total_amount) FROM purchases p WHERE p.supplier_id = s.id), 0) AS total_purchases,
    COALESCE((SELECT SUM(p.paid_amount) FROM purchases p WHERE p.supplier_id = s.id), 0) AS total_paid,
    COALESCE((SELECT SUM(st.amount) FROM supplier_transactions st WHERE st.supplier_id = s.id AND st.type = 'payment'), 0) AS total_payments,
    COALESCE((SELECT SUM(st.amount) FROM supplier_transactions st WHERE st.supplier_id = s.id AND st.type = 'return'), 0) AS total_returns,
    (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) AS purchase_count,
    CASE WHEN COALESCE(s.credit_limit,0) > 0 THEN ROUND((GREATEST(COALESCE(s.balance,0),0) / s.credit_limit) * 100, 2) ELSE 0 END AS credit_utilization
  FROM suppliers s
`;

router.get("/api/suppliers", async (req, res) => {
  try {
    const { search, status, group, approval_status } = req.query;
    let query = supplierSelect + " WHERE 1=1";
    const params: any[] = [];
    let idx = 1;
    if (search) { query += ` AND (s.name ILIKE $${idx} OR s.name_en ILIKE $${idx} OR s.supplier_code ILIKE $${idx} OR s.phone ILIKE $${idx} OR s.tax_number ILIKE $${idx} OR s.email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (status) { query += ` AND s.status = $${idx}`; params.push(status); idx++; }
    if (group) { query += ` AND s.group_name = $${idx}`; params.push(group); idx++; }
    if (approval_status) { query += ` AND s.approval_status = $${idx}`; params.push(approval_status); idx++; }
    query += " ORDER BY s.created_at DESC, s.id DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/api/suppliers/:id", async (req, res) => {
  try {
    const result = await pool.query(supplierSelect + " WHERE s.id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Supplier not found" });
    const supplier = result.rows[0];
    const [contacts, banks, documents, evals] = await Promise.all([
      pool.query("SELECT * FROM supplier_contacts WHERE supplier_id = $1 ORDER BY is_primary DESC, id DESC", [req.params.id]),
      pool.query("SELECT id, supplier_id, bank_name, account_name, account_number, iban, swift, branch, currency, is_default, notes, created_at FROM supplier_bank_accounts WHERE supplier_id = $1 ORDER BY is_default DESC, id DESC", [req.params.id]),
      pool.query("SELECT * FROM supplier_documents WHERE supplier_id = $1 ORDER BY expiry_date NULLS LAST, id DESC", [req.params.id]),
      pool.query("SELECT * FROM supplier_evaluations WHERE supplier_id = $1 ORDER BY evaluation_date DESC, id DESC LIMIT 20", [req.params.id])
    ]);
    res.json({ ...supplier, contacts: contacts.rows, bank_accounts: banks.rows, documents: documents.rows, evaluations: evals.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api/suppliers", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, name_en, phone, phone_2, email, address, commercial_register, tax_number, group_name, payment_terms, credit_limit, opening_balance, notes, status, currency, contact_person, website, country, city } = req.body;
    if (!String(name || '').trim()) return res.status(400).json({ error: "Supplier name is required" });
    await client.query("BEGIN");
    const duplicate = await client.query(`SELECT id FROM suppliers WHERE lower(trim(name)) = lower(trim($1)) OR ($2 <> '' AND tax_number = $2) LIMIT 1`, [name, tax_number || '']);
    if (duplicate.rows.length) { await client.query("ROLLBACK"); return res.status(409).json({ error: "يوجد مورد مسجل بنفس الاسم أو الرقم الضريبي" }); }
    const opening = Number(opening_balance) || 0;
    const result = await client.query(
      `INSERT INTO suppliers (name, name_en, phone, phone_2, email, address, commercial_register, tax_number, group_name, payment_terms, credit_limit, balance, opening_balance, notes, status, currency, contact_person, website, country, city, approval_status, approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17,$18,$19,'approved',NOW()) RETURNING *`,
      [name.trim(), name_en || null, phone || null, phone_2 || null, email || null, address || null, commercial_register || null, tax_number || null, group_name || null, payment_terms || 'cash', Number(credit_limit) || 0, opening, notes || null, status || 'active', currency || 'EGP', contact_person || null, website || null, country || null, city || null]
    );
    const supplier = result.rows[0];
    await client.query(`UPDATE suppliers SET supplier_code = 'SUP-' || LPAD(id::text, 6, '0') WHERE id = $1`, [supplier.id]);
    if (opening > 0) {
      await client.query(`INSERT INTO supplier_transactions (supplier_id,type,amount,notes,reference_id,reference_type,currency,status) VALUES ($1,'purchase',$2,'رصيد افتتاحي',$1,'opening_balance',$3,'posted')`, [supplier.id, opening, currency || 'EGP']);
    }
    await client.query("COMMIT");
    res.status(201).json((await pool.query(supplierSelect + " WHERE s.id = $1", [supplier.id])).rows[0]);
  } catch (err: any) { await client.query("ROLLBACK"); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

router.put("/api/suppliers/:id", async (req, res) => {
  try {
    const allowed = ['name','name_en','phone','phone_2','email','address','commercial_register','tax_number','group_name','payment_terms','credit_limit','notes','status','currency','contact_person','website','country','city','assigned_user_id','approval_status'];
    const fields: string[] = [], params: any[] = [];
    for (const field of allowed) {
      if (req.body[field] !== undefined) { params.push(req.body[field]); fields.push(`${field} = $${params.length}`); }
    }
    if (!fields.length) return res.json((await pool.query(supplierSelect + " WHERE s.id = $1", [req.params.id])).rows[0] || null);
    params.push(req.params.id);
    const result = await pool.query(`UPDATE suppliers SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id`, params);
    if (!result.rows.length) return res.status(404).json({ error: "Supplier not found" });
    res.json((await pool.query(supplierSelect + " WHERE s.id = $1", [req.params.id])).rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/api/suppliers/:id", async (req, res) => {
  try {
    const history = await pool.query(`SELECT
      (SELECT COUNT(*) FROM purchases WHERE supplier_id=$1) +
      (SELECT COUNT(*) FROM supplier_transactions WHERE supplier_id=$1) +
      (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id=$1) AS count`, [req.params.id]);
    if (Number(history.rows[0].count) > 0) {
      await pool.query("UPDATE suppliers SET status='inactive', updated_at=NOW() WHERE id=$1", [req.params.id]);
      return res.json({ success: true, deactivated: true, message: "تم إيقاف المورد للحفاظ على السجل المالي" });
    }
    const result = await pool.query("DELETE FROM suppliers WHERE id=$1 RETURNING id", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Supplier not found" });
    res.json({ success: true, deleted: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api/suppliers/:id/payments", async (req, res) => {
  const client = await pool.connect();
  try {
    const supplierId = Number(req.params.id);
    const amount = Number(req.body.amount);
    const paymentMethod = req.body.payment_method || 'cash';
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Payment amount must be positive" });
    const supplier = await client.query("SELECT * FROM suppliers WHERE id=$1 FOR UPDATE", [supplierId]);
    if (!supplier.rows.length) return res.status(404).json({ error: "Supplier not found" });
    await client.query("BEGIN");
    const tx = await client.query(`INSERT INTO supplier_transactions (supplier_id,type,amount,notes,payment_method,reference_type,currency,status) VALUES ($1,'payment',$2,$3,$4,'supplier_payment',$5,'posted') RETURNING *`, [supplierId, amount, req.body.notes || null, paymentMethod, supplier.rows[0].currency || 'EGP']);
    await client.query("UPDATE suppliers SET balance = balance - $1, updated_at=NOW() WHERE id=$2", [amount, supplierId]);
    const allocations = Array.isArray(req.body.allocations) ? req.body.allocations : [];
    let allocated = 0;
    for (const a of allocations) {
      const purchaseId = Number(a.purchase_id), part = Number(a.amount);
      if (!purchaseId || !Number.isFinite(part) || part <= 0) continue;
      const purchase = await client.query(`SELECT id,total_amount,paid_amount FROM purchases WHERE id=$1 AND supplier_id=$2 FOR UPDATE`, [purchaseId, supplierId]);
      if (!purchase.rows.length) throw new Error(`فاتورة شراء غير صالحة: ${purchaseId}`);
      const remaining = Math.max(0, Number(purchase.rows[0].total_amount) - Number(purchase.rows[0].paid_amount || 0));
      const applied = Math.min(part, remaining, amount - allocated);
      if (applied <= 0) continue;
      await client.query(`INSERT INTO supplier_payment_allocations (payment_transaction_id,purchase_id,allocated_amount) VALUES ($1,$2,$3)`, [tx.rows[0].id, purchaseId, applied]);
      const newPaid = Number(purchase.rows[0].paid_amount || 0) + applied;
      await client.query(`UPDATE purchases SET paid_amount=$1, payment_status=CASE WHEN $1 >= total_amount THEN 'paid' WHEN $1 > 0 THEN 'partially_paid' ELSE 'unpaid' END WHERE id=$2`, [newPaid, purchaseId]);
      allocated += applied;
    }
    await client.query("COMMIT");
    try { ERPEventBus.getInstance().emitEvent("SupplierPaymentRecorded", { supplierId, supplierName: supplier.rows[0].name, amount, paymentMethod, transactionId: tx.rows[0].id, allocatedAmount: allocated, timestamp: new Date() }); } catch {}
    res.status(201).json({ ...tx.rows[0], allocated_amount: allocated, unallocated_amount: amount - allocated });
  } catch (err: any) { await client.query("ROLLBACK"); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

router.get("/api/suppliers/:id/payments", async (req, res) => {
  try {
    const result = await pool.query(`SELECT st.*, COALESCE(SUM(spa.allocated_amount),0) allocated_amount FROM supplier_transactions st LEFT JOIN supplier_payment_allocations spa ON spa.payment_transaction_id=st.id WHERE st.supplier_id=$1 AND st.type='payment' GROUP BY st.id ORDER BY st.timestamp DESC`, [req.params.id]);
    res.json(result.rows);
  } catch (err:any) { res.status(500).json({error: err.message}); }
});

router.get("/api/suppliers/:id/transactions", async (req, res) => {
  try {
    const { from, to, type, limit = 100, offset = 0 } = req.query;
    let query = "SELECT * FROM supplier_transactions WHERE supplier_id=$1"; const params:any[]=[req.params.id]; let idx=2;
    if (from) { query += ` AND timestamp >= $${idx}`; params.push(from); idx++; }
    if (to) { query += ` AND timestamp <= $${idx}`; params.push(to); idx++; }
    if (type) { query += ` AND type = $${idx}`; params.push(type); idx++; }
    query += ` ORDER BY timestamp DESC, id DESC LIMIT $${idx} OFFSET $${idx+1}`; params.push(Math.min(Number(limit)||100,500), Math.max(Number(offset)||0,0));
    res.json((await pool.query(query,params)).rows);
  } catch (err:any) { res.status(500).json({error:err.message}); }
});

router.get("/api/suppliers/:id/statement", async (req, res) => {
  try {
    const { from, to } = req.query; const params:any[]=[req.params.id]; let idx=2;
    let query=`SELECT st.*, CASE WHEN st.type IN ('purchase','adjustment') THEN st.amount WHEN st.type IN ('payment','return') THEN -st.amount ELSE 0 END effect FROM supplier_transactions st WHERE st.supplier_id=$1`;
    if(from){query+=` AND st.timestamp >= $${idx}`;params.push(from);idx++;} if(to){query+=` AND st.timestamp <= $${idx}`;params.push(to);idx++;} query+=' ORDER BY st.timestamp ASC, st.id ASC';
    const rows=(await pool.query(query,params)).rows; let running=0;
    if(from){const before=await pool.query(`SELECT COALESCE(SUM(CASE WHEN type IN ('purchase','adjustment') THEN amount WHEN type IN ('payment','return') THEN -amount ELSE 0 END),0) balance FROM supplier_transactions WHERE supplier_id=$1 AND timestamp<$2`,[req.params.id,from]); running=Number(before.rows[0].balance||0);}
    res.json(rows.map(r=>({...r,running_balance:(running += Number(r.effect||0))})));
  } catch(err:any){res.status(500).json({error:err.message});}
});

router.get("/api/suppliers-reports", async (req,res)=>{
  try {
    const from = String(req.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
    const to = String(req.query.to || new Date().toISOString().slice(0,10));
    const params = [from, to];
    const [monthly, payments, returns, top, overdue, performance, prices] = await Promise.all([
      pool.query(`SELECT TO_CHAR(d::date,'YYYY-MM') month,
        COALESCE((SELECT SUM(p.total_amount) FROM purchases p WHERE p.date::date >= d::date AND p.date::date < (d::date + INTERVAL '1 month') AND p.date::date BETWEEN $1::date AND $2::date),0) purchases,
        COALESCE((SELECT SUM(st.amount) FROM supplier_transactions st WHERE st.type='payment' AND st.timestamp::date >= d::date AND st.timestamp::date < (d::date + INTERVAL '1 month') AND st.timestamp::date BETWEEN $1::date AND $2::date),0) payments,
        COALESCE((SELECT SUM(pr.total_amount) FROM purchase_returns pr WHERE pr.return_date >= d::date AND pr.return_date < (d::date + INTERVAL '1 month') AND pr.return_date BETWEEN $1::date AND $2::date),0) returns
        FROM generate_series(date_trunc('month',$1::date),date_trunc('month',$2::date),'1 month') d ORDER BY d` , params),
      pool.query(`SELECT COALESCE(st.payment_method,'cash') payment_method, COUNT(*) count, COALESCE(SUM(st.amount),0) amount
        FROM supplier_transactions st WHERE st.type='payment' AND st.timestamp::date BETWEEN $1::date AND $2::date GROUP BY COALESCE(st.payment_method,'cash') ORDER BY amount DESC`, params),
      pool.query(`SELECT pr.id,pr.return_number,pr.return_date,pr.total_amount,pr.status,s.name supplier_name,p.invoice_number
        FROM purchase_returns pr LEFT JOIN suppliers s ON s.id=pr.supplier_id LEFT JOIN purchases p ON p.id=pr.purchase_id
        WHERE pr.return_date BETWEEN $1::date AND $2::date ORDER BY pr.return_date DESC,pr.id DESC`, params),
      pool.query(`SELECT s.id,s.supplier_code,s.name,s.name_en,s.status,s.rating,s.balance,
        COALESCE(SUM(p.total_amount),0) total_purchases,COUNT(p.id) purchase_count,
        COALESCE(SUM(p.paid_amount),0) paid_amount,
        COALESCE((SELECT SUM(pr.total_amount) FROM purchase_returns pr WHERE pr.supplier_id=s.id AND pr.return_date BETWEEN $1::date AND $2::date),0) return_amount
        FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.date::date BETWEEN $1::date AND $2::date
        GROUP BY s.id ORDER BY total_purchases DESC LIMIT 100`, params),
      pool.query(`SELECT s.id,s.supplier_code,s.name,s.name_en,s.balance,s.credit_limit,
        COALESCE(SUM(GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0)),0) outstanding,
        COALESCE(SUM(CASE WHEN COALESCE(p.due_date,p.date::date)<CURRENT_DATE AND p.total_amount>COALESCE(p.paid_amount,0) THEN GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0) ELSE 0 END),0) overdue
        FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.date::date <= $2::date
        GROUP BY s.id HAVING COALESCE(SUM(CASE WHEN COALESCE(p.due_date,p.date::date)<CURRENT_DATE AND p.total_amount>COALESCE(p.paid_amount,0) THEN GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0) ELSE 0 END),0)>0
        ORDER BY overdue DESC LIMIT 100`, [from,to]),
      pool.query(`SELECT s.id,s.supplier_code,s.name,s.name_en,ROUND(AVG(se.overall_score),2) overall_score,
        ROUND(AVG(se.quality_score),2) quality_score,ROUND(AVG(se.delivery_score),2) delivery_score,
        ROUND(AVG(se.price_score),2) price_score,ROUND(AVG(se.service_score),2) service_score,COUNT(se.id) evaluations
        FROM suppliers s JOIN supplier_evaluations se ON se.supplier_id=s.id
        WHERE se.evaluation_date BETWEEN $1::date AND $2::date GROUP BY s.id ORDER BY overall_score DESC LIMIT 100`, params),
      pool.query(`SELECT i.id,i.name ingredient_name,p.supplier_id,s.name supplier_name,
        ROUND(AVG(pi.unit_price),2) avg_price,MIN(pi.unit_price) min_price,MAX(pi.unit_price) max_price,
        SUM(pi.quantity) quantity,MAX(p.date) last_purchase_date
        FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id JOIN suppliers s ON s.id=p.supplier_id
        LEFT JOIN ingredients i ON i.id=pi.ingredient_id
        WHERE p.date::date BETWEEN $1::date AND $2::date GROUP BY i.id,i.name,p.supplier_id,s.name ORDER BY last_purchase_date DESC LIMIT 200`, params)
    ]);
    res.json({from,to,monthly:monthly.rows,payment_methods:payments.rows,returns:returns.rows,top_suppliers:top.rows,overdue_suppliers:overdue.rows,performance:performance.rows,price_history:prices.rows});
  } catch(err:any) { res.status(500).json({error:err.message}); }
});

router.get("/api/suppliers-aging", async (req,res)=>{
  try {
    const asOf = String(req.query.as_of || new Date().toISOString().slice(0,10));
    const result=await pool.query(`WITH inv AS (
      SELECT p.id,p.supplier_id,p.invoice_number,p.date,p.due_date,p.total_amount,p.paid_amount,
        GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0) outstanding,
        GREATEST(($2::date-COALESCE(p.due_date,p.date::date)),0) overdue_days
      FROM purchases p WHERE p.date::date <= $2::date AND p.total_amount>COALESCE(p.paid_amount,0)
    ) SELECT s.id,s.supplier_code,s.name,s.name_en,s.credit_limit,s.balance,
      COALESCE(SUM(inv.outstanding),0) outstanding,
      COALESCE(SUM(CASE WHEN inv.overdue_days=0 THEN inv.outstanding ELSE 0 END),0) current_amount,
      COALESCE(SUM(CASE WHEN inv.overdue_days BETWEEN 1 AND 30 THEN inv.outstanding ELSE 0 END),0) bucket_1_30,
      COALESCE(SUM(CASE WHEN inv.overdue_days BETWEEN 31 AND 60 THEN inv.outstanding ELSE 0 END),0) bucket_31_60,
      COALESCE(SUM(CASE WHEN inv.overdue_days BETWEEN 61 AND 90 THEN inv.outstanding ELSE 0 END),0) bucket_61_90,
      COALESCE(SUM(CASE WHEN inv.overdue_days>90 THEN inv.outstanding ELSE 0 END),0) bucket_over_90
      FROM suppliers s LEFT JOIN inv ON inv.supplier_id=s.id GROUP BY s.id ORDER BY outstanding DESC`,[null,asOf]);
    res.json({as_of:asOf,rows:result.rows});
  }catch(err:any){res.status(500).json({error:err.message});}
});

router.get("/api/suppliers/:id/aging", async (req,res)=>{
  try {
    const asOf=String(req.query.as_of || new Date().toISOString().slice(0,10));
    const result=await pool.query(`SELECT p.id,p.invoice_number,p.date,p.due_date,p.total_amount,p.paid_amount,
      GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0) outstanding,
      CASE WHEN COALESCE(p.due_date,p.date::date)>$2::date THEN 0 ELSE ($2::date-COALESCE(p.due_date,p.date::date)) END overdue_days
      FROM purchases p WHERE p.supplier_id=$1 AND p.total_amount>COALESCE(p.paid_amount,0) ORDER BY overdue_days DESC,p.date ASC`,[req.params.id,asOf]);
    res.json({as_of:asOf,rows:result.rows});
  }catch(err:any){res.status(500).json({error:err.message});}
});

router.post("/api/suppliers/:id/recalculate-balance", async(req,res)=>{
  try{
    const result=await pool.query(`SELECT COALESCE(s.opening_balance,0)+COALESCE(SUM(CASE WHEN COALESCE(st.reference_type,'')='opening_balance' THEN 0 WHEN st.type IN ('purchase','adjustment') THEN st.amount WHEN st.type IN ('payment','return') THEN -st.amount ELSE 0 END),0) balance FROM suppliers s LEFT JOIN supplier_transactions st ON st.supplier_id=s.id WHERE s.id=$1 GROUP BY s.id`,[req.params.id]);
    if(!result.rows.length)return res.status(404).json({error:'Supplier not found'});
    await pool.query("UPDATE suppliers SET balance=$1,updated_at=NOW() WHERE id=$2",[result.rows[0].balance,req.params.id]);
    res.json({supplier_id:Number(req.params.id),balance:Number(result.rows[0].balance)});
  }catch(err:any){res.status(500).json({error:err.message});}
});

// Contacts
router.get("/api/suppliers/:id/contacts", async(req,res)=>{try{res.json((await pool.query("SELECT * FROM supplier_contacts WHERE supplier_id=$1 ORDER BY is_primary DESC,id DESC",[req.params.id])).rows);}catch(e:any){res.status(500).json({error:e.message});}});
router.post("/api/suppliers/:id/contacts", async(req,res)=>{try{const {name,job_title,phone,mobile,email,is_primary,notes}=req.body;if(!name)return res.status(400).json({error:'name is required'});if(is_primary)await pool.query("UPDATE supplier_contacts SET is_primary=false WHERE supplier_id=$1",[req.params.id]);const r=await pool.query("INSERT INTO supplier_contacts(supplier_id,name,job_title,phone,mobile,email,is_primary,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[req.params.id,name,job_title||null,phone||null,mobile||null,email||null,!!is_primary,notes||null]);res.status(201).json(r.rows[0]);}catch(e:any){res.status(500).json({error:e.message});}});
router.delete("/api/suppliers/:id/contacts/:contactId", async(req,res)=>{try{await pool.query("DELETE FROM supplier_contacts WHERE id=$1 AND supplier_id=$2",[req.params.contactId,req.params.id]);res.json({success:true});}catch(e:any){res.status(500).json({error:e.message});}});

// Bank accounts
router.get("/api/suppliers/:id/bank-accounts", async(req,res)=>{try{res.json((await pool.query("SELECT id,supplier_id,bank_name,account_name,account_number,iban,swift,branch,currency,is_default,notes FROM supplier_bank_accounts WHERE supplier_id=$1 ORDER BY is_default DESC,id DESC",[req.params.id])).rows);}catch(e:any){res.status(500).json({error:e.message});}});
router.post("/api/suppliers/:id/bank-accounts", async(req,res)=>{try{const {bank_name,account_name,account_number,iban,swift,branch,currency,is_default,notes}=req.body;if(!bank_name)return res.status(400).json({error:'bank_name is required'});if(is_default)await pool.query("UPDATE supplier_bank_accounts SET is_default=false WHERE supplier_id=$1",[req.params.id]);const r=await pool.query("INSERT INTO supplier_bank_accounts(supplier_id,bank_name,account_name,account_number,iban,swift,branch,currency,is_default,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,supplier_id,bank_name,account_name,account_number,iban,swift,branch,currency,is_default,notes",[req.params.id,bank_name,account_name||null,account_number||null,iban||null,swift||null,branch||null,currency||'EGP',!!is_default,notes||null]);res.status(201).json(r.rows[0]);}catch(e:any){res.status(500).json({error:e.message});}});
router.delete("/api/suppliers/:id/bank-accounts/:accountId", async(req,res)=>{try{await pool.query("DELETE FROM supplier_bank_accounts WHERE id=$1 AND supplier_id=$2",[req.params.accountId,req.params.id]);res.json({success:true});}catch(e:any){res.status(500).json({error:e.message});}});

// Documents and evaluations
router.get("/api/suppliers/:id/documents", async(req,res)=>{try{res.json((await pool.query("SELECT id,supplier_id,document_type,document_number,file_name,issue_date,expiry_date,status,notes,mime_type,file_size,checksum_sha256,uploaded_by,created_at FROM supplier_documents WHERE supplier_id=$1 ORDER BY expiry_date NULLS LAST,id DESC",[req.params.id])).rows);}catch(e:any){res.status(500).json({error:e.message});}});
router.post("/api/suppliers/:id/documents", supplierDocumentUpload.single("file"), async(req,res)=>{
  try {
    const {document_type,document_number,issue_date,expiry_date,status,notes}=req.body;
    if(!document_type) return res.status(400).json({error:"document_type is required"});
    const supplier = await pool.query("SELECT id FROM suppliers WHERE id=$1",[req.params.id]);
    if(!supplier.rowCount) return res.status(404).json({error:"Supplier not found"});
    const file = req.file;
    if(!file) return res.status(400).json({error:"file is required"});
    const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const r=await pool.query(
      `INSERT INTO supplier_documents(supplier_id,document_type,document_number,file_name,file_url,issue_date,expiry_date,status,notes,file_data,mime_type,file_size,checksum_sha256)
       VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,supplier_id,document_type,document_number,file_name,issue_date,expiry_date,status,notes,mime_type,file_size,checksum_sha256,created_at`,
      [req.params.id,document_type,document_number||null,file.originalname,issue_date||null,expiry_date||null,status||"active",notes||null,file.buffer,file.mimetype,file.size,checksum]
    );
    res.status(201).json(r.rows[0]);
  } catch(e:any) {
    if(e?.code === "LIMIT_FILE_SIZE") return res.status(413).json({error:"حجم المستند يتجاوز 15MB"});
    res.status(500).json({error:e.message});
  }
});
router.get("/api/suppliers/:id/documents/:documentId/download", async(req,res)=>{
  try {
    const r=await pool.query("SELECT file_name,mime_type,file_size,file_data FROM supplier_documents WHERE id=$1 AND supplier_id=$2",[req.params.documentId,req.params.id]);
    if(!r.rowCount || !r.rows[0].file_data) return res.status(404).json({error:"Document file not found"});
    const d=r.rows[0];
    res.setHeader("Content-Type", d.mime_type || "application/octet-stream");
    res.setHeader("Content-Length", String(d.file_size || d.file_data.length));
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(d.file_name || "supplier-document")}`);
    res.send(d.file_data);
  } catch(e:any) { res.status(500).json({error:e.message}); }
});
router.delete("/api/suppliers/:id/documents/:documentId", async(req,res)=>{try{await pool.query("DELETE FROM supplier_documents WHERE id=$1 AND supplier_id=$2",[req.params.documentId,req.params.id]);res.json({success:true});}catch(e:any){res.status(500).json({error:e.message});}});
router.get("/api/suppliers/:id/evaluations", async(req,res)=>{try{res.json((await pool.query("SELECT * FROM supplier_evaluations WHERE supplier_id=$1 ORDER BY evaluation_date DESC,id DESC",[req.params.id])).rows);}catch(e:any){res.status(500).json({error:e.message});}});
router.post("/api/suppliers/:id/evaluations", async(req,res)=>{try{const q=(v:any)=>Math.max(0,Math.min(100,Number(v)||0));const scores=[q(req.body.quality_score),q(req.body.delivery_score),q(req.body.price_score),q(req.body.service_score)];const overall=(scores.reduce((a,b)=>a+b,0)/4).toFixed(2);const r=await pool.query("INSERT INTO supplier_evaluations(supplier_id,evaluation_date,quality_score,delivery_score,price_score,service_score,overall_score,notes) VALUES($1,COALESCE($2,CURRENT_DATE),$3,$4,$5,$6,$7,$8) RETURNING *",[req.params.id,req.body.evaluation_date||null,...scores,overall,req.body.notes||null]);await pool.query("UPDATE suppliers SET rating=ROUND($1)::integer,updated_at=NOW() WHERE id=$2",[overall,req.params.id]);res.status(201).json(r.rows[0]);}catch(e:any){res.status(500).json({error:e.message});}});

router.get("/api/suppliers-price-history", async(req,res)=>{try{const {supplier_id,ingredient_id}=req.query;const params:any[]=[];let where=' WHERE 1=1';if(supplier_id){params.push(supplier_id);where+=` AND p.supplier_id=$${params.length}`;}if(ingredient_id){params.push(ingredient_id);where+=` AND pi.ingredient_id=$${params.length}`;}const r=await pool.query(`SELECT p.supplier_id,s.name supplier_name,pi.ingredient_id,i.name ingredient_name,pi.unit_price,p.date,p.invoice_number FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN ingredients i ON i.id=pi.ingredient_id ${where} ORDER BY p.date DESC LIMIT 500`,params);res.json(r.rows);}catch(e:any){res.status(500).json({error:e.message});}});

router.get("/api/suppliers-dashboard", async(req,res)=>{try{const [stats,aging]=await Promise.all([pool.query(`SELECT COUNT(*) total_suppliers,COUNT(*) FILTER(WHERE status='active') active_suppliers,COALESCE(SUM(GREATEST(balance,0)),0) total_payable,COALESCE((SELECT SUM(total_amount) FROM purchases WHERE date>=CURRENT_DATE-INTERVAL '30 days'),0) purchases_30d,COALESCE((SELECT SUM(amount) FROM supplier_transactions WHERE type='payment' AND timestamp>=CURRENT_DATE-INTERVAL '30 days'),0) payments_30d,COALESCE((SELECT COUNT(*) FROM purchase_orders WHERE status IN ('draft','pending','approved','partially_received')),0) pending_orders FROM suppliers`),pool.query(`SELECT COALESCE(SUM(GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0)),0) overdue_payable FROM purchases p WHERE COALESCE(p.due_date,p.date::date)<CURRENT_DATE AND p.total_amount>COALESCE(p.paid_amount,0)`) ]);res.json({stats:{...stats.rows[0],...aging.rows[0]}});}catch(e:any){res.status(500).json({error:e.message});}});

// ═══════════════════════════════════════
// PURCHASE ORDERS V1 API
// ═══════════════════════════════════════
router.get("/api/purchase-orders", async (req: Request, res: Response) => {
  try {
    const { status, supplier_id, remaining_qty } = req.query;
    let query = `
      SELECT 
        po.*, 
        s.name as supplier_name,
        COALESCE((SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id AND (poi.quantity - COALESCE(poi.received_quantity, 0)) > 0), 0) as remaining_items_count,
        COALESCE((SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id), 0) as total_items_count,
        COALESCE((SELECT SUM(quantity) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id), 0) as total_ordered_qty,
        COALESCE((SELECT SUM(received_quantity) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id), 0) as total_received_qty
      FROM purchase_orders po 
      LEFT JOIN suppliers s ON po.supplier_id = s.id 
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (status) {
      if (status === "approved") {
        query += ` AND po.status IN ('approved', 'partially_received')`;
      } else {
        query += ` AND po.status = $${idx}`;
        params.push(status);
        idx++;
      }
    }
    if (supplier_id) { query += ` AND po.supplier_id = $${idx}`; params.push(supplier_id); idx++; }
    if (remaining_qty) {
      query += ` AND EXISTS (SELECT 1 FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id AND (poi.quantity - COALESCE(poi.received_quantity, 0)) > 0)`;
    }
    query += " ORDER BY po.date DESC, po.id DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/api/purchase-orders/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase order not found" });
    const items = await pool.query(
      `SELECT poi.*, i.name as ingredient_name, i.unit FROM purchase_order_items poi LEFT JOIN ingredients i ON poi.ingredient_id = i.id WHERE poi.purchase_order_id = $1`,
      [req.params.id]
    );
    res.json({ ...result.rows[0], items: items.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api/purchase-orders", async (req: Request, res: Response) => {
  try {
    const { supplier_id, delivery_date, notes, items, requested_by } = req.body;
    if (!supplier_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "supplier_id and items are required" });
    }
    const total_amount = items.reduce((sum: number, i: any) => sum + (i.quantity * i.unit_price), 0);

    // Check if approval is required for this purchase order
    let requiresApproval = true;
    try {
      const setting = await pool.query("SELECT * FROM approval_settings WHERE module_type = 'purchase_order'");
      if (setting.rows.length > 0) {
        requiresApproval = setting.rows[0].requires_approval;
        // Auto-approve if below threshold
        if (requiresApproval && setting.rows[0].auto_approve_below > 0 && total_amount < parseFloat(setting.rows[0].auto_approve_below)) {
          requiresApproval = false;
        }
      }
    } catch (_e) { /* default: requires approval */ }

    const poStatus = requiresApproval ? 'pending_approval' : 'approved';
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const poResult = await client.query(
        `INSERT INTO purchase_orders (supplier_id, delivery_date, status, total_amount, notes, requested_by, currency) VALUES ($1, $2, $3, $4, $5, $6, 'EGP') RETURNING *`,
        [supplier_id, delivery_date || null, poStatus, total_amount, notes || null, requested_by || null]
      );
      const poId = poResult.rows[0].id;
      await client.query(`UPDATE purchase_orders SET order_number='PO-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || LPAD(id::text,6,'0') WHERE id=$1`, [poId]);
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)`,
          [poId, item.ingredient_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );
      }

      // Auto-create approval request if needed
      if (requiresApproval) {
        // Get supplier name for title
        const supplierName = await client.query("SELECT name FROM suppliers WHERE id = $1", [supplier_id]);
        const sName = supplierName.rows[0]?.name || 'مورد';
        await client.query(
          `INSERT INTO approval_requests (module_type, reference_id, title, description, requested_by, metadata)
           VALUES ('purchase_order', $1, $2, $3, $4, $5)`,
          [poId, `أمر شراء #${poId} - ${sName}`, `إجمالي المبلغ: ${total_amount} جنيه`, requested_by || 'system', JSON.stringify({ total_amount, supplier_id, item_count: items.length })]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ ...poResult.rows[0], items, requires_approval: requiresApproval });
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/api/purchase-orders/:id", async (req: Request, res: Response) => {
  try {
    const { status, delivery_date, notes } = req.body;
    const result = await pool.query(
      `UPDATE purchase_orders SET status = COALESCE($1, status), delivery_date = COALESCE($2, delivery_date), notes = COALESCE($3, notes) WHERE id = $4 RETURNING *`,
      [status, delivery_date, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase order not found" });
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/api/purchase-orders/:id", async (req: Request, res: Response) => {
  try {
    await pool.query("DELETE FROM purchase_order_items WHERE purchase_order_id = $1", [req.params.id]);
    const result = await pool.query("DELETE FROM purchase_orders WHERE id = $1 AND status = 'pending' RETURNING *", [req.params.id]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Can only delete pending orders" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════
// PURCHASE REQUESTS V1 API
// ═══════════════════════════════════════
router.get("/api/purchase-requests", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    let query = "SELECT * FROM purchase_requests WHERE 1=1";
    const params: any[] = [];
    let idx = 1;
    if (status) { query += ` AND status = $${idx}`; params.push(status); idx++; }
    query += " ORDER BY date DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/api/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM purchase_requests WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase request not found" });
    const items = await pool.query("SELECT * FROM purchase_request_items WHERE purchase_request_id = $1", [req.params.id]);
    res.json({ ...result.rows[0], items: items.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api/purchase-requests", async (req: Request, res: Response) => {
  try {
    const { requested_by, notes, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items are required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const prResult = await client.query(
        `INSERT INTO purchase_requests (requested_by, notes) VALUES ($1, $2) RETURNING *`,
        [requested_by || null, notes || null]
      );
      const prId = prResult.rows[0].id;
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_request_items (purchase_request_id, ingredient_id, name, unit, quantity, unit_price) VALUES ($1, $2, $3, $4, $5, $6)`,
          [prId, item.ingredient_id || null, item.name || null, item.unit || null, item.quantity, item.unit_price || 0]
        );
      }
      await client.query("COMMIT");
      res.status(201).json({ ...prResult.rows[0], items });
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/api/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const result = await pool.query(
      `UPDATE purchase_requests SET status = COALESCE($1, status), notes = COALESCE($2, notes) WHERE id = $3 RETURNING *`,
      [status, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase request not found" });
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Approve a purchase request and convert it atomically into a Purchase Order.
router.post("/api/purchase-requests/:id/approve", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const requestId = Number(req.params.id);
    const { supplier_id, delivery_date, notes, approved_by } = req.body;
    if (!supplier_id) return res.status(400).json({ error: "supplier_id is required to create the purchase order" });
    await client.query("BEGIN");
    const pr = await client.query(`SELECT * FROM purchase_requests WHERE id=$1 FOR UPDATE`, [requestId]);
    if (!pr.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Purchase request not found" }); }
    if (pr.rows[0].purchase_order_id) {
      const existing = await client.query(`SELECT * FROM purchase_orders WHERE id=$1`, [pr.rows[0].purchase_order_id]);
      await client.query("ROLLBACK");
      return res.json({ ...pr.rows[0], purchase_order: existing.rows[0] || null, already_converted: true });
    }
    if (String(pr.rows[0].status).toLowerCase() === 'rejected') { await client.query("ROLLBACK"); return res.status(400).json({ error: "Rejected purchase request cannot be approved" }); }
    const items = await client.query(`SELECT * FROM purchase_request_items WHERE purchase_request_id=$1 ORDER BY id`, [requestId]);
    if (!items.rows.length) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Purchase request has no items" }); }
    const total = items.rows.reduce((sum:any, i:any) => sum + Number(i.quantity||0) * Number(i.unit_price||0), 0);
    const po = await client.query(`INSERT INTO purchase_orders (supplier_id,delivery_date,status,total_amount,notes,requested_by,currency) VALUES ($1,$2,'approved',$3,$4,$5,'EGP') RETURNING *`, [Number(supplier_id), delivery_date || null, total, notes || pr.rows[0].notes || `من طلب الشراء #${requestId}`, pr.rows[0].requested_by || null]);
    const poId = po.rows[0].id;
    await client.query(`UPDATE purchase_orders SET order_number='PO-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || LPAD(id::text,6,'0') WHERE id=$1`, [poId]);
    for (const item of items.rows) {
      await client.query(`INSERT INTO purchase_order_items (purchase_order_id,ingredient_id,quantity,unit_price,total_price) VALUES ($1,$2,$3,$4,$5)`, [poId, item.ingredient_id ? Number(item.ingredient_id) : null, Number(item.quantity||0), Number(item.unit_price||0), Number(item.quantity||0)*Number(item.unit_price||0)]);
    }
    const updated = await client.query(`UPDATE purchase_requests SET status='Approved', purchase_order_id=$1, approved_by=$2, approved_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *`, [poId, approved_by || 'admin', requestId]);
    await client.query("COMMIT");
    const poDetails = await pool.query(`SELECT po.*,s.name supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=$1`, [poId]);
    res.json({ ...updated.rows[0], purchase_order: { ...poDetails.rows[0], items: items.rows } });
  } catch (err:any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message || "Failed to approve purchase request" });
  } finally { client.release(); }
});

// ═══════════════════════════════════════
// PURCHASES V1 API
// ═══════════════════════════════════════
router.get("/api/purchases", async (req: Request, res: Response) => {
  try {
    const { supplier_id, warehouse_id, status } = req.query;
    let query = `
      SELECT p.*, s.name as supplier_name, w.name as warehouse_name, po.order_number as purchase_order_number
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      LEFT JOIN purchase_orders po ON po.id = p.purchase_order_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (supplier_id) { query += ` AND p.supplier_id = $${idx}`; params.push(supplier_id); idx++; }
    if (warehouse_id) { query += ` AND p.warehouse_id = $${idx}`; params.push(warehouse_id); idx++; }
    if (status) { query += ` AND p.status = $${idx}`; params.push(status); idx++; }
    query += " ORDER BY p.date DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/api/purchases/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.*, s.name as supplier_name, w.name as warehouse_name 
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN warehouses w ON p.warehouse_id = w.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase not found" });
    const items = await pool.query(
      `SELECT pi.*, i.name as ingredient_name, i.unit 
       FROM purchase_items pi
       LEFT JOIN ingredients i ON pi.ingredient_id = i.id
       WHERE pi.purchase_id = $1`,
      [req.params.id]
    );
    res.json({ ...result.rows[0], items: items.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api/purchases", async (req: Request, res: Response) => {
  try {
    const payload = { ...req.body, purchase_order_id: req.body.purchase_order_id || req.body.order_id || null };
    if (!payload.supplier_id || !payload.warehouse_id || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({ error: "supplier_id, warehouse_id, and items are required" });
    }
    const service = new PurchaseService();
    const purchase = await service.createPurchase(payload);
    res.status(201).json(purchase);
  } catch (err: any) {
    console.error("Unified purchase create error:", err);
    res.status(500).json({ error: err.message || "Failed to record purchase" });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PURCHASES ENTERPRISE API
// ═══════════════════════════════════════════════════════════════════════
router.get("/api/purchases/dashboard", async (_req: Request, res: Response) => {
  try {
    const [kpi, orders, overdue, receiving, matching] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(p.total_amount) FILTER (WHERE p.date::date >= date_trunc('month',CURRENT_DATE)::date),0) month_purchases,
        COALESCE(SUM(GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0)),0) outstanding,
        COALESCE(SUM(p.total_amount) FILTER (WHERE p.date::date >= CURRENT_DATE-30),0) purchases_30d,
        COUNT(*) FILTER (WHERE p.payment_status <> 'paid') unpaid_invoices,
        COUNT(*) FILTER (WHERE COALESCE(p.matching_status,'pending') IN ('pending','exception')) matching_exceptions FROM purchases p`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE status IN ('pending_approval','pending','approved','partially_received')) open_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status IN ('pending_approval','pending','approved','partially_received')),0) open_order_value FROM purchase_orders`),
      pool.query(`SELECT COUNT(*) overdue_invoices,COALESCE(SUM(GREATEST(total_amount-COALESCE(paid_amount,0),0)),0) overdue_amount FROM purchases WHERE COALESCE(due_date,date::date)<CURRENT_DATE AND total_amount>COALESCE(paid_amount,0)`),
      pool.query(`SELECT COUNT(*) pending_receipts,COALESCE(SUM((SELECT COALESCE(SUM(rejected_qty),0) FROM goods_receipt_items WHERE goods_receipt_id=gr.id)),0) rejected_quantity FROM goods_receipts gr WHERE gr.status IN ('draft','submitted','qc_pending','qc_approved','warehouse_approved')`),
      pool.query(`SELECT COALESCE(matching_status,'pending') matching_status,COUNT(*) count,COALESCE(SUM(total_amount),0) amount FROM purchases GROUP BY COALESCE(matching_status,'pending') ORDER BY count DESC`)
    ]);
    res.json({success:true,kpis:{...kpi.rows[0],...orders.rows[0],...overdue.rows[0],...receiving.rows[0]},matching:matching.rows});
  } catch(e:any) { res.status(500).json({error:e.message}); }
});

router.get("/api/purchase-receipts", async (req: Request, res: Response) => {
  try {
    const { purchase_order_id, supplier_id, status } = req.query; const params:any[]=[]; let where='WHERE 1=1'; let i=1;
    if(purchase_order_id){where+=` AND gr.purchase_order_id=$${i++}`;params.push(purchase_order_id)}
    if(supplier_id){where+=` AND gr.supplier_id=$${i++}`;params.push(supplier_id)}
    if(status){where+=` AND gr.status=$${i++}`;params.push(status)}
    const r=await pool.query(`SELECT gr.*, gr.receipt_no AS receipt_number, po.order_number, s.name supplier_name, w.name warehouse_name,
      (SELECT COALESCE(SUM(gri.received_qty),0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id=gr.id) total_quantity,
      (SELECT COALESCE(SUM(gri.accepted_qty),0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id=gr.id) accepted_quantity,
      (SELECT COALESCE(SUM(gri.rejected_qty),0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id=gr.id) rejected_quantity
      FROM goods_receipts gr LEFT JOIN purchase_orders po ON po.id=gr.purchase_order_id LEFT JOIN suppliers s ON s.id=gr.supplier_id LEFT JOIN warehouses w ON w.id=gr.warehouse_id ${where} ORDER BY gr.date DESC,gr.id DESC`,params);
    res.json(r.rows);
  } catch(e:any){res.status(500).json({error:e.message});}
});

router.get("/api/purchase-orders/:id/receivable", async (req: Request,res: Response)=>{
  try{ const r=await pool.query(`SELECT poi.id,poi.purchase_order_id,poi.ingredient_id,i.name ingredient_name,i.unit,poi.quantity ordered_quantity,COALESCE(poi.received_quantity,0) received_quantity,GREATEST(poi.quantity-COALESCE(poi.received_quantity,0),0) remaining_quantity,poi.unit_price FROM purchase_order_items poi LEFT JOIN ingredients i ON i.id=poi.ingredient_id WHERE poi.purchase_order_id=$1 ORDER BY poi.id`,[req.params.id]); res.json(r.rows); }
  catch(e:any){res.status(500).json({error:e.message});}
});

router.post("/api/purchase-receipts", async (req: Request,res: Response)=>{
  const client=await pool.connect();
  try{
    const {purchase_order_id,supplier_id,warehouse_id,receipt_date,notes,created_by,items}=req.body;
    if(!warehouse_id || !Array.isArray(items) || !items.length) return res.status(400).json({error:'warehouse_id and items are required'});
    await client.query('BEGIN');
    let order:any=null;
    if(purchase_order_id){
      const q=await client.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE',[purchase_order_id]);
      if(!q.rows.length) throw new Error('Purchase order not found');
      order=q.rows[0];
    }
    const supplierId=Number(supplier_id||order?.supplier_id||0)||null;
    const receipt = await createPostedGoodsReceiptForPurchase(client, {
      supplier_id: supplierId, warehouse_id: Number(warehouse_id), purchase_order_id: purchase_order_id || null,
      supplier_invoice_no: null, invoice_number: null, currency: 'EGP', created_by, notes: notes || null,
      date: receipt_date || new Date().toISOString().split('T')[0]
    }, 0, items.map((raw:any)=>({
      purchase_order_item_id: raw.purchase_order_item_id,
      ingredient_id: raw.ingredient_id,
      received_quantity: Number(raw.received_quantity ?? raw.quantity ?? 0),
      accepted_quantity: Number(raw.accepted_quantity ?? raw.received_quantity ?? raw.quantity ?? 0),
      rejected_quantity: Number(raw.rejected_quantity ?? 0),
      unit_price: Number(raw.unit_price ?? 0),
      ordered_quantity: Number(raw.ordered_quantity ?? 0),
      rejection_reason: raw.rejection_reason || null,
      unit: raw.unit || null
    })), { markInvoiced: false });

    await client.query('COMMIT');
    const gr = await pool.query(`SELECT * FROM goods_receipts WHERE id=$1`, [receipt.id]);
    res.status(201).json({ ...gr.rows[0], id: receipt.id, receipt_number: receipt.receipt_no, canonical_goods_receipt_id: receipt.id, total_quantity: items.reduce((n:any,i:any)=>n+Number(i.received_quantity??i.quantity??0),0), accepted_quantity: items.reduce((n:any,i:any)=>n+Number(i.accepted_quantity??i.received_quantity??i.quantity??0),0), rejected_quantity: items.reduce((n:any,i:any)=>n+Number(i.rejected_quantity??0),0) });
  }catch(e:any){await client.query('ROLLBACK').catch(()=>{});console.error('[Purchases Receiving] transaction failed:',e);res.status(500).json({error:e?.message||'فشل حفظ الاستلام',detail:e?.detail||null,code:e?.code||null});}finally{client.release();}
});

router.get("/api/purchases/:id/three-way-match", async (req: Request,res: Response)=>{
  try{
    const p=await pool.query(`SELECT p.*,po.order_number FROM purchases p LEFT JOIN purchase_orders po ON po.id=p.purchase_order_id WHERE p.id=$1`,[req.params.id]); if(!p.rows.length)return res.status(404).json({error:'Purchase invoice not found'});
    const inv=p.rows[0]; const order=inv.purchase_order_id?await pool.query(`SELECT poi.id,poi.ingredient_id,poi.quantity ordered_quantity,COALESCE(poi.received_quantity,0) received_quantity,poi.unit_price FROM purchase_order_items poi WHERE poi.purchase_order_id=$1`,[inv.purchase_order_id]):{rows:[]};
    const invoiceItems=await pool.query('SELECT * FROM purchase_items WHERE purchase_id=$1',[inv.id]);
    const ordered=order.rows.reduce((s:any,r:any)=>s+Number(r.ordered_quantity||0),0), received=order.rows.reduce((s:any,r:any)=>s+Number(r.received_quantity||0),0), invoiced=invoiceItems.rows.reduce((s:any,r:any)=>s+Number(r.quantity||0),0);
    const orderTotal=order.rows.reduce((s:any,r:any)=>s+Number(r.ordered_quantity||0)*Number(r.unit_price||0),0); const amountOk=!order.rows.length||Math.abs(Number(inv.total_amount)-orderTotal)<0.01; const qtyOk=!order.rows.length||invoiced<=received+0.000001; const status=amountOk&&qtyOk?'matched':'exception';
    await pool.query('UPDATE purchases SET matching_status=$1,updated_at=NOW() WHERE id=$2',[status,inv.id]); res.json({purchase:inv,status,checks:{quantity:{ordered,received,invoiced,ok:qtyOk},amount:{invoice_total:Number(inv.total_amount),order_total:orderTotal,ok:amountOk}},order_items:order.rows,invoice_items:invoiceItems.rows});
  }catch(e:any){res.status(500).json({error:e.message});}
});

// ═══════════════════════════════════════
// PURCHASE RETURNS V1 API
// ═══════════════════════════════════════
router.get("/api/returns/next-number", (_req: Request, res: Response) => {
  res.json({ next_number: `RET-${Date.now()}` });
});

router.get(["/api/returns", "/api/purchase-returns"], async (req: Request, res: Response) => {
  try {
    const { supplier_id, status } = req.query;
    let query = `SELECT pr.*, s.name as supplier_name, p.invoice_number FROM purchase_returns pr LEFT JOIN suppliers s ON pr.supplier_id = s.id LEFT JOIN purchases p ON pr.purchase_id = p.id WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (supplier_id) { query += ` AND pr.supplier_id = $${idx}`; params.push(supplier_id); idx++; }
    if (status) { query += ` AND pr.status = $${idx}`; params.push(status); idx++; }
    query += " ORDER BY pr.date DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post(["/api/returns", "/api/purchase-returns"], async (req: Request, res: Response) => {
  try {
    const { supplier_id, purchase_id, total_amount, notes, items } = req.body;
    if (!supplier_id || !total_amount) return res.status(400).json({ error: "supplier_id and total_amount are required" });
    const return_number = `RET-${Date.now()}`;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const retResult = await client.query(
        `INSERT INTO purchase_returns (return_number, supplier_id, purchase_id, total_amount, notes, status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
        [return_number, supplier_id, purchase_id || null, total_amount, notes || null]
      );
      // Update supplier balance (reduce debt)
      await client.query(
        `UPDATE suppliers SET balance = GREATEST(0, balance - $1) WHERE id = $2`,
        [total_amount, supplier_id]
      );
      // Supplier sub-ledger: returns reduce the supplier balance.
      await client.query(
        `INSERT INTO supplier_transactions (supplier_id, type, amount, notes, reference_id, reference_type, status) VALUES ($1, 'return', $2, $3, $4, 'purchase_return', 'posted')`,
        [supplier_id, total_amount, notes || `مرتجع شراء ${return_number}`, retResult.rows[0].id]
      );
      // Warehouse return movement: this is a legitimate stock OUT and must be
      // represented in the same stock ledger used by receipts.
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const qty = Number(item.quantity || 0);
          const whId = Number(item.warehouse_id || 0);
          const ingredientId = Number(item.ingredient_id || 0);
          if (qty <= 0 || !whId || !ingredientId) continue;
          const stock = await client.query(`SELECT id, quantity, avg_cost FROM inventory_items WHERE warehouse_id=$1 AND ingredient_id=$2 FOR UPDATE`, [whId, ingredientId]);
          const before = Number(stock.rows[0]?.quantity || 0);
          const after = Math.max(0, before - qty);
          const unitCost = Number(item.unit_price || stock.rows[0]?.avg_cost || 0);
          if (stock.rows[0]) await client.query(`UPDATE inventory_items SET quantity=$1, available=GREATEST($1-COALESCE(reserved,0),0), updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [after, stock.rows[0].id]);
          await client.query(`INSERT INTO inventory_transactions (transaction_number,warehouse_id,ingredient_id,quantity,type,unit_cost,total_cost,balance_before,balance_after,reference_type,reference_id,reference_no,status,notes,date) VALUES ($1,$2,$3,$4,'return',$5,$6,$7,$8,'purchase_return',$9,$10,'posted',$11,CURRENT_DATE)`, [`TXN-RET-${retResult.rows[0].id}-${ingredientId}`,whId,ingredientId,-qty,unitCost,-qty*unitCost,before,after,retResult.rows[0].id,return_number,`مرتجع شراء ${return_number}`]);
          await client.query(`INSERT INTO inventory_movements (warehouse_id,ingredient_id,field,before_qty,delta,after_qty,ref_type,ref_id,"user",notes,created_at) VALUES ($1,$2,'quantity',$3,$4,$5,'purchase_return',$6,'system',$7,CURRENT_TIMESTAMP)`, [whId,ingredientId,before,-qty,after,retResult.rows[0].id,`مرتجع شراء ${return_number}`]);
        }
      }
      await client.query("COMMIT");
      res.status(201).json(retResult.rows[0]);
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put(["/api/returns/:id", "/api/purchase-returns/:id"], async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const result = await pool.query(
      `UPDATE purchase_returns SET status = COALESCE($1, status), notes = COALESCE($2, notes) WHERE id = $3 RETURNING *`,
      [status, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase return not found" });
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Initialize purchase_quotations table
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_quotations (
        id SERIAL PRIMARY KEY,
        quotation_number TEXT,
        request_id INTEGER,
        supplier_id INTEGER,
        supplier TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivery_date DATE,
        estimated_value DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'Draft',
        notes TEXT,
        items JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Enterprise quotation detail fields / backward-compatible migrations
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS quotation_date DATE`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS valid_until DATE`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS delivery_terms TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP'`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS contact_person TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS reference_number TEXT DEFAULT ''`);
    await pool.query(`UPDATE purchase_quotations SET quotation_date = COALESCE(quotation_date, date::date), subtotal = COALESCE(subtotal, estimated_value, 0), total_amount = COALESCE(total_amount, estimated_value, 0) WHERE quotation_date IS NULL OR subtotal IS NULL OR total_amount IS NULL`);
  } catch (err) {
    console.error("Error setting up purchase_quotations table:", err);
  }
})();

// ═══════════════════════════════════════
// PURCHASE QUOTATIONS V1 API
// ═══════════════════════════════════════
router.get(["/api/purchase-quotations", "/api/quotations"], async (req: Request, res: Response) => {
  try {
    const { status, supplier_id, request_id } = req.query;
    let query = "SELECT * FROM purchase_quotations WHERE 1=1";
    const params: any[] = [];
    let idx = 1;
    if (status) { query += ` AND status = $${idx}`; params.push(status); idx++; }
    if (supplier_id) { query += ` AND supplier_id = $${idx}`; params.push(supplier_id); idx++; }
    if (request_id) { query += ` AND request_id = $${idx}`; params.push(request_id); idx++; }
    query += " ORDER BY date DESC, id DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get(["/api/purchase-quotations/:id", "/api/quotations/:id"], async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM purchase_quotations WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Quotation not found" });
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post(["/api/purchase-quotations", "/api/quotations"], async (req: Request, res: Response) => {
  try {
    const { quotation_number, request_id, supplier_id, supplier, quotation_date, delivery_date, valid_until, estimated_value, subtotal, discount_amount, tax_amount, total_amount, status, notes, items, payment_terms, delivery_terms, currency, contact_person, contact_phone, reference_number } = req.body;
    const qNumber = quotation_number || `RFQ-${Date.now().toString().slice(-6)}`;
    const itemsJson = JSON.stringify(items || []);
    const sub = Number(subtotal ?? estimated_value ?? 0);
    const discount = Number(discount_amount || 0);
    const tax = Number(tax_amount || 0);
    const total = Number(total_amount ?? (sub - discount + tax));
    const result = await pool.query(
      `INSERT INTO purchase_quotations 
       (quotation_number, request_id, supplier_id, supplier, quotation_date, delivery_date, valid_until, estimated_value, subtotal, discount_amount, tax_amount, total_amount, status, notes, items, payment_terms, delivery_terms, currency, contact_person, contact_phone, reference_number)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
      [
        qNumber, request_id ? Number(request_id) : null, supplier_id ? Number(supplier_id) : null, supplier || "مورد عام",
        quotation_date || null, delivery_date || null, valid_until || null, total, sub, discount, tax, total, status || "Draft", notes || "", itemsJson, payment_terms || "", delivery_terms || "", currency || "EGP", contact_person || "", contact_phone || "", reference_number || ""
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put(["/api/purchase-quotations/:id", "/api/quotations/:id"], async (req: Request, res: Response) => {
  try {
    const { quotation_number, request_id, supplier_id, supplier, quotation_date, delivery_date, valid_until, estimated_value, subtotal, discount_amount, tax_amount, total_amount, status, notes, items, payment_terms, delivery_terms, currency, contact_person, contact_phone, reference_number } = req.body;
    const itemsJson = items !== undefined ? JSON.stringify(items) : null;
    const result = await pool.query(
      `UPDATE purchase_quotations SET 
        quotation_number = COALESCE($1, quotation_number), request_id = COALESCE($2, request_id), supplier_id = COALESCE($3, supplier_id), supplier = COALESCE($4, supplier),
        quotation_date = COALESCE($5, quotation_date), delivery_date = COALESCE($6, delivery_date), valid_until = COALESCE($7, valid_until),
        estimated_value = COALESCE($8, estimated_value), subtotal = COALESCE($9, subtotal), discount_amount = COALESCE($10, discount_amount), tax_amount = COALESCE($11, tax_amount), total_amount = COALESCE($12, total_amount),
        status = COALESCE($13, status), notes = COALESCE($14, notes), items = COALESCE($15, items), payment_terms = COALESCE($16, payment_terms), delivery_terms = COALESCE($17, delivery_terms),
        currency = COALESCE($18, currency), contact_person = COALESCE($19, contact_person), contact_phone = COALESCE($20, contact_phone), reference_number = COALESCE($21, reference_number), updated_at = CURRENT_TIMESTAMP
       WHERE id = $22 RETURNING *`,
      [quotation_number, request_id ? Number(request_id) : null, supplier_id ? Number(supplier_id) : null, supplier, quotation_date, delivery_date, valid_until, estimated_value !== undefined ? Number(estimated_value) : null, subtotal !== undefined ? Number(subtotal) : null, discount_amount !== undefined ? Number(discount_amount) : null, tax_amount !== undefined ? Number(tax_amount) : null, total_amount !== undefined ? Number(total_amount) : null, status, notes, itemsJson, payment_terms, delivery_terms, currency, contact_person, contact_phone, reference_number, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Quotation not found" });
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete(["/api/purchase-quotations/:id", "/api/quotations/:id"], async (req: Request, res: Response) => {
  try {
    const result = await pool.query("DELETE FROM purchase_quotations WHERE id = $1 RETURNING *", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Quotation not found" });
    res.json({ success: true, message: "Quotation deleted" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});


export default router;
