import { Router } from "express";
import { pool } from "../../../server-db.js";
import { ERPEventBus } from "../../../server-erp-core.js";

const router = Router();

// ----------------- DATABASE DYNAMIC MIGRATIONS -----------------
(async () => {
  try {
    // cost_items extensions
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS parent_id INTEGER");
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS accounting_account_id INTEGER");
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS description TEXT");
    
    // New Cost Items Config Settings (For individual items)
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS default_center_id INTEGER");
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS default_allocation_method TEXT DEFAULT 'percentage'");
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS budget_cap DECIMAL(10,2) DEFAULT 0");
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS alert_threshold INTEGER DEFAULT 90");
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS is_hr_linked BOOLEAN DEFAULT false");
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS is_warehouse_linked BOOLEAN DEFAULT false");
    await pool.query("ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS is_procurement_linked BOOLEAN DEFAULT false");

    // operating_costs extensions
    // Ensure category is compatible with databases where it is NOT NULL.
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS category TEXT");
    await pool.query("UPDATE operating_costs SET category = COALESCE(NULLIF(category, ''), NULLIF(department, ''), 'other') WHERE category IS NULL OR category = ''");
    await pool.query("ALTER TABLE operating_costs ALTER COLUMN category SET DEFAULT 'other'");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS project TEXT");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS product TEXT");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS supplier TEXT");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS employee TEXT");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS customer TEXT");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS accounting_account TEXT");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2) DEFAULT 0");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) DEFAULT 0");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP'");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'Draft'");
    
    // New operating_costs ID links for deep modular integration
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS customer_id INTEGER");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS employee_id INTEGER");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS supplier_id INTEGER");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS product_id INTEGER");
    await pool.query("ALTER TABLE operating_costs ADD COLUMN IF NOT EXISTS warehouse_id INTEGER");

    // activity log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS costs_activity_log (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        details TEXT,
        username TEXT DEFAULT 'محمد أحمد',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure standard_costs table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS standard_costs (
        id SERIAL PRIMARY KEY,
        rate_type TEXT,
        base_rate DECIMAL(10,2) DEFAULT 0,
        overhead DECIMAL(10,2) DEFAULT 0,
        hours DECIMAL(10,2) DEFAULT 0,
        std_materials DECIMAL(10,2) DEFAULT 0,
        std_labor DECIMAL(10,2) DEFAULT 0,
        std_overhead DECIMAL(10,2) DEFAULT 0,
        std_utilities DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure product_costs table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_costs (
        id SERIAL PRIMARY KEY,
        product_id TEXT,
        raw_material DECIMAL(10,2) DEFAULT 0,
        direct_labor DECIMAL(10,2) DEFAULT 0,
        electricity DECIMAL(10,2) DEFAULT 0,
        maintenance DECIMAL(10,2) DEFAULT 0,
        depreciation DECIMAL(10,2) DEFAULT 0,
        transport DECIMAL(10,2) DEFAULT 0,
        packaging DECIMAL(10,2) DEFAULT 0,
        indirect_overhead DECIMAL(10,2) DEFAULT 0,
        selling_price DECIMAL(10,2) DEFAULT 0,
        total_cost DECIMAL(10,2) DEFAULT 0,
        profit_margin DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

  } catch (err) {
    console.error("Failed to run on-the-fly costs migration:", err);
  }
})();

// Activity Log Helper
async function logCostsAction(action: string, details: string, username: string = "محمد أحمد") {
  try {
    await pool.query(
      "INSERT INTO costs_activity_log (action, details, username) VALUES ($1, $2, $3)",
      [action, details, username]
    );
  } catch (err) {
    console.error("Error inserting costs activity log:", err);
  }
}

// ----------------- INTEGRATION ENDPOINTS -----------------
router.get("/integrations/employees", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, job_title, basic_salary FROM employees ORDER BY name ASC");
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/integrations/suppliers", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, phone, balance FROM suppliers ORDER BY name ASC");
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/integrations/customers", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, phone FROM customers ORDER BY name ASC");
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/integrations/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, price FROM products ORDER BY name ASC");
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/integrations/ingredients", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, unit, cost FROM ingredients ORDER BY name ASC");
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/integrations/warehouses", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name FROM warehouses ORDER BY name ASC");
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/integrations/accounts", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, code, name_ar as name, name_en FROM accounts ORDER BY code ASC");
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- OPERATING COSTS ENDPOINTS -----------------

// Fetch activity logs
router.get("/activity-logs", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM costs_activity_log ORDER BY created_at DESC LIMIT 200");
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ error: error.message || "Failed to fetch activity logs" });
  }
});

// Create activity log
router.post("/activity-logs", async (req, res) => {
  try {
    const { action, details, username } = req.body;
    await logCostsAction(action, details, username || "محمد أحمد");
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error creating activity log:", error);
    res.status(500).json({ error: error.message || "Failed to create activity log" });
  }
});

// Fetch all operating costs (with center and item names)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT oc.*, 
             cc.name as cost_center_name, 
             ci.name as cost_item_name,
             ci.cost_type as cost_type
      FROM operating_costs oc
      LEFT JOIN cost_centers cc ON oc.cost_center_id = cc.id
      LEFT JOIN cost_items ci ON oc.cost_item_id = ci.id
      ORDER BY oc.date DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("Error fetching operating costs:", error);
    res.status(500).json({ error: error.message || "Failed to fetch operating costs" });
  }
});

// Create a new operating cost
router.post("/", async (req, res) => {
  try {
    const {
      voucher_no,
      date,
      branch,
      department,
      cost_center_id,
      cost_item_id,
      category,
      payment_method,
      safe,
      notes,
      amount,
      status,
      created_by,
      link_ledger,
      project,
      product,
      supplier,
      employee,
      customer,
      accounting_account,
      tax,
      total,
      currency,
      approval_status,
      customer_id,
      employee_id,
      supplier_id,
      product_id,
      warehouse_id,
      purchase_id,
      source_type
    } = req.body;

    const query = `
      INSERT INTO operating_costs (
        voucher_no, date, branch, department, cost_center_id, cost_item_id, category,
        payment_method, safe, notes, amount, status, created_by, link_ledger,
        project, product, supplier, employee, customer, accounting_account, tax, total,
        currency, approval_status, customer_id, employee_id, supplier_id, product_id, warehouse_id, purchase_id, source_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
      RETURNING *
    `;

    const values = [
      voucher_no || `VCH-${Math.floor(1000 + Math.random() * 9000)}`,
      date ? new Date(date) : new Date(),
      branch || "القاهرة",
      department || "العامة",
      cost_center_id ? Number(cost_center_id) : null,
      cost_item_id ? Number(cost_item_id) : null,
      category || department || "other",
      payment_method || "نقدي",
      safe || null,
      notes || null,
      amount ? Number(amount) : 0,
      status || "نشط",
      created_by || "محمد أحمد",
      link_ledger === undefined ? false : !!link_ledger,
      project || null,
      product || null,
      supplier || null,
      employee || null,
      customer || null,
      accounting_account || null,
      tax ? Number(tax) : 0,
      total ? Number(total) : (amount ? Number(amount) : 0),
      currency || "EGP",
      approval_status || "Draft",
      customer_id ? Number(customer_id) : null,
      employee_id ? Number(employee_id) : null,
      supplier_id ? Number(supplier_id) : null,
      product_id ? Number(product_id) : null,
      warehouse_id ? Number(warehouse_id) : null,
      purchase_id ? Number(purchase_id) : null,
      source_type || (purchase_id ? "purchase" : null)
    ];

    const result = await pool.query(query, values);
    await logCostsAction("إنشاء تكلفة", `تم تسجيل تكلفة تشغيلية جديدة برقم سند ${values[0]} بقيمة ${values[10]} ج.م.`, created_by || "محمد أحمد");
    
    // Link to safe
    if (safe && payment_method === 'نقدي' && amount) {
        try {
            const safeResult = await pool.query("SELECT id FROM safes WHERE name = $1 LIMIT 1", [safe]);
            if (safeResult.rows.length > 0) {
                const safeId = safeResult.rows[0].id;
                await pool.query(`
                  INSERT INTO safe_transactions (safe_id, type, amount, notes, reference_id)
                  VALUES ($1, 'out', $2, $3, $4)
                `, [safeId, Number(amount), `مصروف تكاليف: ${notes || voucher_no}`, result.rows[0].id]);
            }
        } catch (err) {
            console.error("Error creating safe transaction for cost", err);
        }
    }

    // Link to General Ledger
    if (link_ledger && amount && accounting_account) {
       try {
           const journalResult = await pool.query(`
             INSERT INTO journal_entries (date, description, reference, total_debit, total_credit, status)
             VALUES ($1, $2, $3, $4, $5, 'Posted')
             RETURNING id
           `, [date ? new Date(date) : new Date(), `قيد مصروف تكاليف: ${notes || voucher_no}`, voucher_no, Number(amount), Number(amount)]);
           
           if (journalResult.rows.length > 0) {
               const jeId = journalResult.rows[0].id;
               
               // Debit the cost item's account
               await pool.query(`
                 INSERT INTO journal_items (journal_entry_id, account_id, notes, debit, credit)
                 VALUES ($1, NULL, $2, $3, 0)
               `, [jeId, `مصروف تكاليف: ${notes || voucher_no}`, Number(amount)]);
               
               await pool.query(`
                 INSERT INTO journal_items (journal_entry_id, account_id, notes, debit, credit)
                 VALUES ($1, NULL, $2, $3, 0)
               `, [jeId, `سداد مصروف تكاليف: ${notes || voucher_no}`, Number(amount)]);
           }
       } catch (err) {
           console.error("Error creating journal entry for cost", err);
       }
    }

    // ═══ Emit CostRecorded event for GL auto-posting ═══
    try {
      ERPEventBus.getInstance().emitEvent("CostRecorded", {
        costId: result.rows[0].id,
        category: department || 'other',
        amount: Number(amount) || 0,
        branchId: result.rows[0].branch,
        notes: notes || voucher_no,
        date: date || new Date().toISOString(),
        costCenterId: cost_center_id ? Number(cost_center_id) : null,
        paymentMethod: payment_method,
        costItemId: cost_item_id ? Number(cost_item_id) : null,
      });
      console.log(`[Costs] ✅ CostRecorded event emitted for cost #${result.rows[0].id}`);
    } catch (evtErr) {
      console.error("[Costs] Error emitting CostRecorded event:", evtErr);
    }

    // ═══ Auto-create approval request if status is not Draft ═══
    const finalApprovalStatus = approval_status || "Draft";
    if (finalApprovalStatus !== "Draft" && finalApprovalStatus !== "Approved") {
      try {
        const costId = result.rows[0].id;
        const costAmount = Number(amount) || 0;
        await pool.query(
          `INSERT INTO approval_requests (module_type, reference_id, title, description, requested_by, metadata)
           VALUES ('operating_cost', $1, $2, $3, $4, $5)`,
          [
            costId,
            `تكلفة تشغيلية ${voucher_no || '#' + costId} - ${department || 'العامة'}`,
            `المبلغ: ${costAmount} ج.م | الفرع: ${branch || 'القاهرة'}`,
            created_by || "محمد أحمد",
            JSON.stringify({ amount: costAmount, branch, department, cost_center_id }),
          ]
        );
      } catch (approvalErr) {
        console.error("[Costs] Error creating approval request:", approvalErr);
      }
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("Error creating operating cost:", error);
    res.status(500).json({ error: error.message || "Failed to create operating cost" });
  }
});

// Update an operating cost
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      voucher_no,
      date,
      branch,
      department,
      cost_center_id,
      cost_item_id,
      payment_method,
      safe,
      notes,
      amount,
      status,
      created_by,
      link_ledger,
      project,
      product,
      supplier,
      employee,
      customer,
      accounting_account,
      tax,
      total,
      currency,
      approval_status,
      customer_id,
      employee_id,
      supplier_id,
      product_id,
      warehouse_id
    } = req.body;

    const query = `
      UPDATE operating_costs SET
        voucher_no = $1,
        date = $2,
        branch = $3,
        department = $4,
        cost_center_id = $5,
        cost_item_id = $6,
        payment_method = $7,
        safe = $8,
        notes = $9,
        amount = $10,
        status = $11,
        created_by = $12,
        link_ledger = $13,
        project = $14,
        product = $15,
        supplier = $16,
        employee = $17,
        customer = $18,
        accounting_account = $19,
        tax = $20,
        total = $21,
        currency = $22,
        approval_status = $23,
        customer_id = $24,
        employee_id = $25,
        supplier_id = $26,
        product_id = $27,
        warehouse_id = $28
      WHERE id = $29
      RETURNING *
    `;

    const values = [
      voucher_no,
      date ? new Date(date) : new Date(),
      branch || "القاهرة",
      department || "العامة",
      cost_center_id ? Number(cost_center_id) : null,
      cost_item_id ? Number(cost_item_id) : null,
      payment_method || "نقدي",
      safe || null,
      notes || null,
      amount ? Number(amount) : 0,
      status || "نشط",
      created_by || "محمد أحمد",
      link_ledger === undefined ? false : !!link_ledger,
      project || null,
      product || null,
      supplier || null,
      employee || null,
      customer || null,
      accounting_account || null,
      tax ? Number(tax) : 0,
      total ? Number(total) : (amount ? Number(amount) : 0),
      currency || "EGP",
      approval_status || "Draft",
      customer_id ? Number(customer_id) : null,
      employee_id ? Number(employee_id) : null,
      supplier_id ? Number(supplier_id) : null,
      product_id ? Number(product_id) : null,
      warehouse_id ? Number(warehouse_id) : null,
      Number(id)
    ];

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cost record not found" });
    }
    await logCostsAction("تعديل تكلفة", `تم تعديل السند ${voucher_no} - الحالة الحالية: ${approval_status}`, created_by || "محمد أحمد");
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("Error updating operating cost:", error);
    res.status(500).json({ error: error.message || "Failed to update operating cost" });
  }
});

// Delete an operating cost
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM operating_costs WHERE id = $1 RETURNING *", [Number(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cost record not found" });
    }
    res.json({ success: true, message: "Cost record deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting operating cost:", error);
    res.status(500).json({ error: error.message || "Failed to delete operating cost" });
  }
});

// ----------------- COST CENTERS ENDPOINTS -----------------

// Fetch all cost centers with aggregated expenses
router.get("/centers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cc.*,
             parent.name as parent_name,
             COALESCE((SELECT SUM(amount) FROM operating_costs WHERE cost_center_id = cc.id), 0) as total_cost
      FROM cost_centers cc
      LEFT JOIN cost_centers parent ON cc.parent_id = parent.id
      ORDER BY cc.id ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("Error fetching cost centers:", error);
    res.status(500).json({ error: error.message || "Failed to fetch cost centers" });
  }
});

// Create a new cost center
router.post("/centers", async (req, res) => {
  try {
    const { code, name, type, branch, manager, status, notes, monthly_budget, parent_id } = req.body;
    const result = await pool.query(`
      INSERT INTO cost_centers (code, name, type, branch, manager, status, notes, monthly_budget, parent_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      code || `CC-${Math.floor(100 + Math.random() * 900)}`,
      name,
      type || "فروع",
      branch || "القاهرة",
      manager || "غير محدد",
      status || "نشط",
      notes || null,
      monthly_budget ? Number(monthly_budget) : 0,
      parent_id ? Number(parent_id) : null
    ]);
    res.status(201).json({ success: true, data: { ...result.rows[0], total_cost: 0 } });
  } catch (error: any) {
    console.error("Error creating cost center:", error);
    res.status(500).json({ error: error.message || "Failed to create cost center" });
  }
});

// Update an existing cost center
router.put("/centers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, type, branch, manager, status, notes, monthly_budget, parent_id } = req.body;
    const result = await pool.query(`
      UPDATE cost_centers SET
        code = $1,
        name = $2,
        type = $3,
        branch = $4,
        manager = $5,
        status = $6,
        notes = $7,
        monthly_budget = $8,
        parent_id = $9
      WHERE id = $10
      RETURNING *
    `, [
      code,
      name,
      type,
      branch || "القاهرة",
      manager || "غير محدد",
      status || "نشط",
      notes || null,
      monthly_budget ? Number(monthly_budget) : 0,
      parent_id ? Number(parent_id) : null,
      Number(id)
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cost center not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("Error updating cost center:", error);
    res.status(500).json({ error: error.message || "Failed to update cost center" });
  }
});

// Delete a cost center
router.delete("/centers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM cost_centers WHERE id = $1 RETURNING *", [Number(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cost center not found" });
    }
    res.json({ success: true, message: "Cost center deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting cost center:", error);
    res.status(500).json({ error: error.message || "Failed to delete cost center" });
  }
});

// ----------------- COST ITEMS ENDPOINTS -----------------

// Fetch all cost items with parent elements and extended details
router.get("/items", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.*, parent.name as parent_name
      FROM cost_items ci
      LEFT JOIN cost_items parent ON ci.parent_id = parent.id
      ORDER BY ci.id ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("Error fetching cost items:", error);
    res.status(500).json({ error: error.message || "Failed to fetch cost items" });
  }
});

// Create a new cost item
router.post("/items", async (req, res) => {
  try {
    const { 
      code, name, cost_type, department, status, parent_id, accounting_account_id, description,
      default_center_id, default_allocation_method, budget_cap, alert_threshold,
      is_hr_linked, is_warehouse_linked, is_procurement_linked
    } = req.body;
    const result = await pool.query(`
      INSERT INTO cost_items (
        code, name, cost_type, department, status, parent_id, accounting_account_id, description,
        default_center_id, default_allocation_method, budget_cap, alert_threshold,
        is_hr_linked, is_warehouse_linked, is_procurement_linked
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      code || `CST-${Math.floor(100 + Math.random() * 900)}`,
      name,
      cost_type || "تشغيل",
      department || "المصروفات العامة",
      status || "نشط",
      parent_id ? Number(parent_id) : null,
      accounting_account_id ? Number(accounting_account_id) : null,
      description || null,
      default_center_id ? Number(default_center_id) : null,
      default_allocation_method || "percentage",
      budget_cap ? Number(budget_cap) : 0,
      alert_threshold ? Number(alert_threshold) : 90,
      is_hr_linked === undefined ? false : !!is_hr_linked,
      is_warehouse_linked === undefined ? false : !!is_warehouse_linked,
      is_procurement_linked === undefined ? false : !!is_procurement_linked
    ]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("Error creating cost item:", error);
    res.status(500).json({ error: error.message || "Failed to create cost item" });
  }
});

// Update a cost item
router.put("/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      code, name, cost_type, department, status, parent_id, accounting_account_id, description,
      default_center_id, default_allocation_method, budget_cap, alert_threshold,
      is_hr_linked, is_warehouse_linked, is_procurement_linked
    } = req.body;
    const result = await pool.query(`
      UPDATE cost_items SET
        code = $1,
        name = $2,
        cost_type = $3,
        department = $4,
        status = $5,
        parent_id = $6,
        accounting_account_id = $7,
        description = $8,
        default_center_id = $9,
        default_allocation_method = $10,
        budget_cap = $11,
        alert_threshold = $12,
        is_hr_linked = $13,
        is_warehouse_linked = $14,
        is_procurement_linked = $15
      WHERE id = $16
      RETURNING *
    `, [
      code,
      name,
      cost_type,
      department,
      status,
      parent_id ? Number(parent_id) : null,
      accounting_account_id ? Number(accounting_account_id) : null,
      description || null,
      default_center_id ? Number(default_center_id) : null,
      default_allocation_method || "percentage",
      budget_cap ? Number(budget_cap) : 0,
      alert_threshold ? Number(alert_threshold) : 90,
      is_hr_linked === undefined ? false : !!is_hr_linked,
      is_warehouse_linked === undefined ? false : !!is_warehouse_linked,
      is_procurement_linked === undefined ? false : !!is_procurement_linked,
      Number(id)
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cost item not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("Error updating cost item:", error);
    res.status(500).json({ error: error.message || "Failed to update cost item" });
  }
});

// Delete a cost item
router.delete("/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM cost_items WHERE id = $1 RETURNING *", [Number(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cost item not found" });
    }
    res.json({ success: true, message: "Cost item deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting cost item:", error);
    res.status(500).json({ error: error.message || "Failed to delete cost item" });
  }
});

// Clear all costs module data
router.delete("/clear-all-data", async (req, res) => {
  try {
    await pool.query("DELETE FROM operating_costs");
    await pool.query("DELETE FROM cost_items");
    await pool.query("DELETE FROM cost_centers");
    await pool.query("DELETE FROM estimated_budgets");
    res.json({ success: true, message: "تم مسح جميع بيانات مديول التكاليف بنجاح!" });
  } catch (error: any) {
    console.error("Error clearing all costs data:", error);
    res.status(500).json({ error: error.message || "Failed to clear costs data" });
  }
});

// ----------------- ESTIMATED BUDGETS ENDPOINTS -----------------

// Fetch all budgets
router.get("/budgets", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT eb.*, 
             cc.name as cost_center_name, 
             ci.name as cost_item_name
      FROM estimated_budgets eb
      LEFT JOIN cost_centers cc ON eb.cost_center_id = cc.id
      LEFT JOIN cost_items ci ON eb.cost_item_id = ci.id
      ORDER BY eb.year DESC, eb.month DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("Error fetching budgets:", error);
    res.status(500).json({ error: error.message || "Failed to fetch budgets" });
  }
});

// Create a new budget
router.post("/budgets", async (req, res) => {
  try {
    const { year, month, cost_center_id, cost_item_id, amount, notes } = req.body;
    const result = await pool.query(`
      INSERT INTO estimated_budgets (year, month, cost_center_id, cost_item_id, amount, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      year ? Number(year) : 2026,
      month || "يوليو",
      cost_center_id ? Number(cost_center_id) : null,
      cost_item_id ? Number(cost_item_id) : null,
      amount ? Number(amount) : 0,
      notes || null
    ]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("Error creating budget:", error);
    res.status(500).json({ error: error.message || "Failed to create budget" });
  }
});

// Delete a budget
router.delete("/budgets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM estimated_budgets WHERE id = $1 RETURNING *", [Number(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Budget record not found" });
    }
    res.json({ success: true, message: "Budget record deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting budget:", error);
    res.status(500).json({ error: error.message || "Failed to delete budget" });
  }
});


// Get standard costs
router.get("/standard", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM standard_costs ORDER BY id DESC`);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("Error fetching standard costs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create standard cost
router.post("/standard", async (req, res) => {
  try {
    const { rate_type, base_rate, overhead, hours, std_materials, std_labor, std_overhead, std_utilities } = req.body;
    const result = await pool.query(`
      INSERT INTO standard_costs (rate_type, base_rate, overhead, hours, std_materials, std_labor, std_overhead, std_utilities)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      rate_type, 
      Number(base_rate), 
      Number(overhead), 
      Number(hours), 
      Number(std_materials), 
      Number(std_labor), 
      Number(std_overhead), 
      Number(std_utilities)
    ]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("Error creating standard cost:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get product costs
router.get("/product", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM product_costs ORDER BY id DESC`);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("Error fetching product costs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create product cost
router.post("/product", async (req, res) => {
  try {
    const { product_id, raw_material, direct_labor, electricity, maintenance, depreciation, transport, packaging, indirect_overhead, selling_price, total_cost, profit_margin } = req.body;
    const result = await pool.query(`
      INSERT INTO product_costs (product_id, raw_material, direct_labor, electricity, maintenance, depreciation, transport, packaging, indirect_overhead, selling_price, total_cost, profit_margin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      product_id,
      Number(raw_material),
      Number(direct_labor),
      Number(electricity),
      Number(maintenance),
      Number(depreciation),
      Number(transport),
      Number(packaging),
      Number(indirect_overhead),
      Number(selling_price),
      Number(total_cost),
      Number(profit_margin)
    ]);
    
    // Also link it to the products table (Inventory/Products Module)
    try {
        await pool.query(`
            UPDATE products 
            SET cost_price = $1, 
                price = $2 
            WHERE id = $3 OR name = $3
        `, [Number(total_cost), Number(selling_price), product_id]);
    } catch (err) {
        console.error("Error updating product price based on cost:", err);
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("Error creating product cost:", error);
    res.status(500).json({ error: error.message });
  }
});



// Update settings
router.post("/settings", async (req, res) => {
  try {
    const { settings } = req.body;
    for (const key in settings) {
      if (settings.hasOwnProperty(key)) {
        await pool.query(`
          INSERT INTO system_settings (key, value) 
          VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
        `, [key, String(settings[key])]);
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error saving settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get settings
router.get("/settings", async (req, res) => {
  try {
    const result = await pool.query(`SELECT key, value FROM system_settings WHERE key LIKE 'cost_%'`);
    const settings: any = {};
    result.rows.forEach((row: any) => {
      settings[row.key] = row.value;
    });
    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
