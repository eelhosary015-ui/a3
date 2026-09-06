import { erpPool } from "../../../server-erp-core.js";

export class SalesOrderRepository {
  constructor() {
    this.ensureTablesExist();
  }

  private async ensureTablesExist(): Promise<void> {
    const orderTableDdl = `
      CREATE TABLE IF NOT EXISTS erp_sales_orders (
        id SERIAL PRIMARY KEY,
        order_no VARCHAR(100) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        delivery_date DATE,
        sales_rep VARCHAR(100),
        payment_method VARCHAR(50),
        branch VARCHAR(100),
        warehouse VARCHAR(100),
        currency VARCHAR(50),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'مفتوح',
        total_qty DECIMAL(12,2) DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0,
        delivered_qty DECIMAL(12,2) DEFAULT 0,
        remaining_qty DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const itemsTableDdl = `
      CREATE TABLE IF NOT EXISTS erp_sales_order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES erp_sales_orders(id) ON DELETE CASCADE,
        item_code VARCHAR(50),
        item_name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) DEFAULT 'قطعة',
        qty_required DECIMAL(12,2) NOT NULL,
        qty_available DECIMAL(12,2) DEFAULT 0,
        qty_reserved DECIMAL(12,2) DEFAULT 0,
        qty_delivered DECIMAL(12,2) DEFAULT 0,
        price DECIMAL(12,2) NOT NULL,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        total DECIMAL(12,2) NOT NULL
      )
    `;

    try {
      await erpPool.query(orderTableDdl);
      await erpPool.query(itemsTableDdl);
    } catch (err: any) {
      console.error("Failed to ensure erp_sales_orders tables exist:", err.message);
    }
  }

  async getAll(): Promise<any[]> {
    await this.ensureTablesExist();
    
    // Check if table is empty, if so, seed a demo order matching the screenshot
    const countRes = await erpPool.query("SELECT COUNT(*) as count FROM erp_sales_orders");
    if (parseInt(countRes.rows[0].count) === 0) {
      console.log("Seeding default sales orders from screenshot...");
      try {
        await this.create({
          orderNo: "SO-2024-000125",
          customerName: "C001 - شركة الأمل للتجارة",
          date: "2024-06-17",
          deliveryDate: "2024-06-24",
          salesRep: "محمود سامي",
          paymentMethod: "أجل",
          branch: "القاهرة",
          warehouse: "المخزن الرئيسي",
          currency: "جنيه مصري",
          notes: "برجاء الالتزام بتاريخ التسليم",
          status: "مفتوح",
          totalQty: 68.0,
          totalAmount: 94656.0,
          deliveredQty: 0.0,
          remainingQty: 68.0,
          items: [
            { itemCode: "PRD001", itemName: "شاشة 24 بوصة", unit: "قطعة", qtyRequired: 10, qtyAvailable: 25, qtyReserved: 10, qtyDelivered: 0, price: 2500, discountPercent: 5, total: 23750 },
            { itemCode: "PRD002", itemName: "كيبورد لاسلكي", unit: "قطعة", qtyRequired: 15, qtyAvailable: 32, qtyReserved: 15, qtyDelivered: 0, price: 350, discountPercent: 0, total: 5250 },
            { itemCode: "PRD003", itemName: "ماوس لاسلكي", unit: "قطعة", qtyRequired: 15, qtyAvailable: 40, qtyReserved: 15, qtyDelivered: 0, price: 250, discountPercent: 0, total: 3750 },
            { itemCode: "PRD004", itemName: "طابعة ليزر", unit: "قطعة", qtyRequired: 5, qtyAvailable: 7, qtyReserved: 5, qtyDelivered: 5, price: 3800, discountPercent: 3, total: 18430 },
            { itemCode: "PRD005", itemName: "سماعات رأس", unit: "قطعة", qtyRequired: 23, qtyAvailable: 50, qtyReserved: 23, qtyDelivered: 0, price: 150, discountPercent: 0, total: 3450 }
          ]
        });
      } catch (seedErr) {
        console.error("Failed to seed default sales order:", seedErr);
      }
    }

    const query = `
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', i.id,
                   'itemCode', i.item_code,
                   'itemName', i.item_name,
                   'unit', i.unit,
                   'qtyRequired', i.qty_required,
                   'qtyAvailable', i.qty_available,
                   'qtyReserved', i.qty_reserved,
                   'qtyDelivered', i.qty_delivered,
                   'price', i.price,
                   'discountPercent', i.discount_percent,
                   'total', i.total
                 )
               ) FILTER (WHERE i.id IS NOT NULL), 
               '[]'::json
             ) as items
      FROM erp_sales_orders o
      LEFT JOIN erp_sales_order_items i ON o.id = i.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    const result = await erpPool.query(query);
    return result.rows.map((row: any) => ({
      id: row.id,
      orderNo: row.order_no,
      customerName: row.customer_name,
      date: new Date(row.date).toISOString().split('T')[0],
      deliveryDate: row.delivery_date ? new Date(row.delivery_date).toISOString().split('T')[0] : null,
      salesRep: row.sales_rep,
      paymentMethod: row.payment_method,
      branch: row.branch,
      warehouse: row.warehouse,
      currency: row.currency,
      notes: row.notes,
      status: row.status,
      totalQty: parseFloat(row.total_qty),
      totalAmount: parseFloat(row.total_amount),
      deliveredQty: parseFloat(row.delivered_qty),
      remainingQty: parseFloat(row.remaining_qty),
      items: row.items
    }));
  }

  async getById(id: number): Promise<any | null> {
    await this.ensureTablesExist();
    const query = `
      SELECT o.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', i.id,
                   'itemCode', i.item_code,
                   'itemName', i.item_name,
                   'unit', i.unit,
                   'qtyRequired', i.qty_required,
                   'qtyAvailable', i.qty_available,
                   'qtyReserved', i.qty_reserved,
                   'qtyDelivered', i.qty_delivered,
                   'price', i.price,
                   'discountPercent', i.discount_percent,
                   'total', i.total
                 )
               ) FILTER (WHERE i.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM erp_sales_orders o
      LEFT JOIN erp_sales_order_items i ON o.id = i.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `;
    const result = await erpPool.query(query, [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      orderNo: row.order_no,
      customerName: row.customer_name,
      date: new Date(row.date).toISOString().split('T')[0],
      deliveryDate: row.delivery_date ? new Date(row.delivery_date).toISOString().split('T')[0] : null,
      salesRep: row.sales_rep,
      paymentMethod: row.payment_method,
      branch: row.branch,
      warehouse: row.warehouse,
      currency: row.currency,
      notes: row.notes,
      status: row.status,
      totalQty: parseFloat(row.total_qty),
      totalAmount: parseFloat(row.total_amount),
      deliveredQty: parseFloat(row.delivered_qty),
      remainingQty: parseFloat(row.remaining_qty),
      items: row.items
    };
  }

  async create(order: any): Promise<any> {
    await this.ensureTablesExist();
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      let orderNo = order.orderNo;
      if (!orderNo) {
        const countRes = await client.query("SELECT COUNT(*) as count FROM erp_sales_orders");
        const nextNum = parseInt(countRes.rows[0].count) + 125;
        orderNo = `SO-2024-${String(nextNum).padStart(6, '0')}`;
      }

      const insertOrderQuery = `
        INSERT INTO erp_sales_orders (
          order_no, customer_name, date, delivery_date, sales_rep, 
          payment_method, branch, warehouse, currency, notes, status, 
          total_qty, total_amount, delivered_qty, remaining_qty
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;

      const orderResult = await client.query(insertOrderQuery, [
        orderNo,
        order.customerName,
        order.date || new Date(),
        order.deliveryDate || null,
        order.salesRep || null,
        order.paymentMethod || null,
        order.branch || null,
        order.warehouse || null,
        order.currency || null,
        order.notes || null,
        order.status || 'مفتوح',
        order.totalQty || 0,
        order.totalAmount || 0,
        order.deliveredQty || 0,
        order.remainingQty || 0
      ]);

      const insertedOrder = orderResult.rows[0];

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const insertItemQuery = `
            INSERT INTO erp_sales_order_items (
              order_id, item_code, item_name, unit, qty_required, 
              qty_available, qty_reserved, qty_delivered, price, discount_percent, total
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `;
          await client.query(insertItemQuery, [
            insertedOrder.id,
            item.itemCode || null,
            item.itemName,
            item.unit || 'قطعة',
            item.qtyRequired,
            item.qtyAvailable || 0,
            item.qtyReserved || 0,
            item.qtyDelivered || 0,
            item.price,
            item.discountPercent || 0,
            item.total
          ]);
        }
      }

      await client.query("COMMIT");
      return insertedOrder;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: number, order: any): Promise<any> {
    await this.ensureTablesExist();
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      const updateOrderQuery = `
        UPDATE erp_sales_orders
        SET customer_name = $1, date = $2, delivery_date = $3, sales_rep = $4, 
            payment_method = $5, branch = $6, warehouse = $7, currency = $8, 
            notes = $9, status = $10, total_qty = $11, total_amount = $12, 
            delivered_qty = $13, remaining_qty = $14
        WHERE id = $15
        RETURNING *
      `;

      const orderResult = await client.query(updateOrderQuery, [
        order.customerName,
        order.date || new Date(),
        order.deliveryDate || null,
        order.salesRep || null,
        order.paymentMethod || null,
        order.branch || null,
        order.warehouse || null,
        order.currency || null,
        order.notes || null,
        order.status || 'مفتوح',
        order.totalQty || 0,
        order.totalAmount || 0,
        order.deliveredQty || 0,
        order.remainingQty || 0,
        id
      ]);

      // Delete old items and insert updated ones
      await client.query("DELETE FROM erp_sales_order_items WHERE order_id = $1", [id]);

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const insertItemQuery = `
            INSERT INTO erp_sales_order_items (
              order_id, item_code, item_name, unit, qty_required, 
              qty_available, qty_reserved, qty_delivered, price, discount_percent, total
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `;
          await client.query(insertItemQuery, [
            id,
            item.itemCode || null,
            item.itemName,
            item.unit || 'قطعة',
            item.qtyRequired,
            item.qtyAvailable || 0,
            item.qtyReserved || 0,
            item.qtyDelivered || 0,
            item.price,
            item.discountPercent || 0,
            item.total
          ]);
        }
      }

      await client.query("COMMIT");
      return orderResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: number): Promise<void> {
    await this.ensureTablesExist();
    await erpPool.query("DELETE FROM erp_sales_orders WHERE id = $1", [id]);
  }
}
