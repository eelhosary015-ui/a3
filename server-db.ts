import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const { Pool } = pg;

const dbFilePath = path.join(process.cwd(), "backups", "offline-db.json");

// Ensure backups dir exists
if (!fs.existsSync(path.dirname(dbFilePath))) {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
}

// In-memory DB state
let dbState: Record<string, any[]> = {};

function loadDb() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const raw = fs.readFileSync(dbFilePath, "utf8").trim();
      if (raw) {
        try {
          dbState = JSON.parse(raw);
        } catch (parseError) {
          console.error("SyntaxError parsing offline-db.json, attempting to recover or reset:", parseError);
          try {
            // Replace raw unescaped control characters except tabs and newlines
            const sanitized = raw.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f]/g, "");
            dbState = JSON.parse(sanitized);
            console.log("Successfully recovered offline-db.json after sanitizing control characters.");
          } catch (e) {
            console.error("Failed to parse even after sanitizing. Initializing empty database state:", e);
            dbState = {};
            // Auto-overwrite the corrupt file with a valid empty JSON so this error never repeats
            try {
              fs.writeFileSync(dbFilePath, "{}", "utf8");
              console.log("Auto-repaired backups/offline-db.json with fresh state {}");
            } catch (errWrite) {
              console.error("Could not write clean db file:", errWrite);
            }
          }
        }
      }
    }
    
    // Seed cost_centers if empty
    if (!dbState["cost_centers"] || dbState["cost_centers"].length === 0) {
      dbState["cost_centers"] = [
        { id: 1, code: 'CC-001', name: 'الإدارة العامة', type: 'إدارة', branch: 'القاهرة', manager: 'أحمد محمد', status: 'نشط' },
        { id: 2, code: 'CC-002', name: 'فرع القاهرة', type: 'فروع', branch: 'القاهرة', manager: 'محمود علي', status: 'نشط' },
        { id: 3, code: 'CC-003', name: 'فرع الجيزة', type: 'فروع', branch: 'الجيزة', manager: 'محمد حسن', status: 'نشط' },
        { id: 4, code: 'CC-004', name: 'المخازن الرئيسي', type: 'مخازن', branch: 'القاهرة', manager: 'سعيد خالد', status: 'نشط' },
        { id: 5, code: 'CC-005', name: 'الكاشير', type: 'مبيعات', branch: 'القاهرة', manager: 'أحمد جمال', status: 'نشط' },
        { id: 6, code: 'CC-006', name: 'المطبخ الرئيسي', type: 'إنتاج', branch: 'القاهرة', manager: 'علي محمود', status: 'نشط' },
        { id: 7, code: 'CC-007', name: 'الدليفري', type: 'مبيعات', branch: 'القاهرة', manager: 'أيمن صلاح', status: 'نشط' },
        { id: 8, code: 'CC-008', name: 'الموارد البشرية', type: 'إدارة', branch: 'القاهرة', manager: 'نادية أحمد', status: 'نشط' }
      ];
    }

    // Seed cost_items if empty
    if (!dbState["cost_items"] || dbState["cost_items"].length === 0) {
      dbState["cost_items"] = [
        { id: 1, code: 'CST-001', name: 'كهرباء', cost_type: 'تشغيل', department: 'المصروفات العامة', status: 'نشط' },
        { id: 2, code: 'CST-002', name: 'مياه', cost_type: 'تشغيل', department: 'المصروفات العامة', status: 'نشط' },
        { id: 3, code: 'CST-003', name: 'إنترنت وهاتف', cost_type: 'تشغيل', department: 'المصروفات العامة', status: 'نشط' },
        { id: 4, code: 'CST-004', name: 'رواتب وأجور', cost_type: 'مرتبات', department: 'الموارد البشرية', status: 'نشط' },
        { id: 5, code: 'CST-005', name: 'بدلات', cost_type: 'مرتبات', department: 'الموارد البشرية', status: 'نشط' },
        { id: 6, code: 'CST-006', name: 'تأمينات اجتماعية', cost_type: 'مرتبات', department: 'الموارد البشرية', status: 'نشط' },
        { id: 7, code: 'CST-007', name: 'إيجارات', cost_type: 'تشغيل', department: 'المصروفات العامة', status: 'نشط' },
        { id: 8, code: 'CST-008', name: 'صيانة وإصلاحات', cost_type: 'تشغيل', department: 'المصروفات العامة', status: 'نشط' },
        { id: 9, code: 'CST-009', name: 'وقود ومواصلات', cost_type: 'تشغيل', department: 'المصروفات العامة', status: 'نشط' },
        { id: 10, code: 'CST-010', name: 'تغليف', cost_type: 'تشغيل', department: 'الإنتاج', status: 'نشط' }
      ];
    }

    // Seed operating_costs if empty to show the exact table in the screenshots
    if (!dbState["operating_costs"] || dbState["operating_costs"].length === 0) {
      dbState["operating_costs"] = [
        { id: 1, voucher_no: 'INV-2025-001', date: '2025-06-23T10:30:00.000Z', branch: 'القاهرة', department: 'المخازن', cost_center_id: 4, cost_item_id: 1, category: 'تشغيل', amount: 1500.00, payment_method: 'نقدي', safe: 'خزينة فرع القاهرة', status: 'معتمد', created_by: 'محمد أحمد', notes: 'فاتورة كهرباء شهر يونيو 2025', link_ledger: true },
        { id: 2, voucher_no: 'INV-2025-002', date: '2025-06-23T11:00:00.000Z', branch: 'القاهرة', department: 'الموارد البشرية', cost_center_id: 8, cost_item_id: 4, category: 'مرتبات', amount: 25000.00, payment_method: 'نقدي', safe: 'خزينة فرع القاهرة', status: 'معتمد', created_by: 'محمد أحمد', notes: 'راتب شهر يونيو 2025', link_ledger: true },
        { id: 3, voucher_no: 'INV-2025-003', date: '2025-06-22T09:15:00.000Z', branch: 'الجيزة', department: 'المبيعات', cost_center_id: 5, cost_item_id: 3, category: 'تشغيل', amount: 800.00, payment_method: 'نقدي', safe: 'خزينة فرع الجيزة', status: 'جديد', created_by: 'محمد أحمد', notes: 'فاتورة إنترنت الكاشير', link_ledger: false },
        { id: 4, voucher_no: 'INV-2025-004', date: '2025-06-22T14:45:00.000Z', branch: 'القاهرة', department: 'المطبخ', cost_center_id: 6, cost_item_id: 1, category: 'تشغيل', amount: 2300.00, payment_method: 'نقدي', safe: 'خزينة فرع القاهرة', status: 'معتمد', created_by: 'محمد أحمد', notes: 'فاتورة غاز المطبخ الرئيسي', link_ledger: true },
        { id: 5, voucher_no: 'INV-2025-005', date: '2025-06-21T16:20:00.000Z', branch: 'القاهرة', department: 'الدليفري', cost_center_id: 7, cost_item_id: 9, category: 'تشغيل', amount: 1200.00, payment_method: 'نقدي', safe: 'خزينة فرع القاهرة', status: 'معتمد', created_by: 'محمد أحمد', notes: 'وقود دراجات الدليفري', link_ledger: true }
      ];
    }

    // Seed suppliers (warehouse module) if empty
    if (!dbState["suppliers"] || dbState["suppliers"].length === 0) {
      dbState["suppliers"] = [
        { id: 1, name: "شركة الأمل للتوريدات الغذائية", code: "SUP-001", phone: "01012345678", email: "alamal@example.com", address: "القاهرة - مدينة نصر", tax_number: "123-456-789", contact_person: "محمد السيد", balance: 0, notes: "مورد رئيسي للمواد الغذائية" },
        { id: 2, name: "مطاحن مصر العليا", code: "SUP-002", phone: "01098765432", email: "millseg@example.com", address: "الجيزة - 6 أكتوبر", tax_number: "987-654-321", contact_person: "أحمد فؤاد", balance: 1500, notes: "مورد الدقيق" },
        { id: 3, name: "شركة النيل للزيوت", code: "SUP-003", phone: "01122334455", email: "nileoil@example.com", address: "القاهرة - حلوان", tax_number: "456-789-123", contact_person: "خالد عبد الله", balance: 0, notes: "مورد الزيوت" },
        { id: 4, name: "مزارع الدلتا للدواجن", code: "SUP-004", phone: "01233445566", email: "deltafarm@example.com", address: "الدقهلية - المنصورة", tax_number: "789-123-456", contact_person: "سعيد إبراهيم", balance: -800, notes: "مورد الدواجن والبيض" },
        { id: 5, name: "شركة السلام للحوم", code: "SUP-005", phone: "01055667788", email: "salammeat@example.com", address: "القاهرة - المعادي", tax_number: "321-654-987", contact_person: "محمود رضا", balance: 0, notes: "مورد اللحوم الحمراء" },
      ];
    }

    // Seed inventory_movements if empty (audit log)
    if (!dbState["inventory_movements"] || dbState["inventory_movements"].length === 0) {
      dbState["inventory_movements"] = [
        { id: 1, warehouse_id: 1, ingredient_id: 1, field: "quantity", before_qty: 0, delta: 200, after_qty: 200, ref_type: "transaction", ref_id: 1, user: "admin", notes: "افتتاحي", created_at: "2026-07-01T08:00:00.000Z" },
        { id: 2, warehouse_id: 1, ingredient_id: 2, field: "quantity", before_qty: 0, delta: 150, after_qty: 150, ref_type: "transaction", ref_id: 1, user: "admin", notes: "افتتاحي", created_at: "2026-07-01T08:00:00.000Z" },
        { id: 3, warehouse_id: 1, ingredient_id: 3, field: "quantity", before_qty: 0, delta: 80, after_qty: 80, ref_type: "transaction", ref_id: 1, user: "admin", notes: "افتتاحي", created_at: "2026-07-01T08:00:00.000Z" },
        { id: 4, warehouse_id: 1, ingredient_id: 1, field: "quantity", before_qty: 200, delta: -50, after_qty: 150, ref_type: "transaction", ref_id: 2, user: "admin", notes: "صرف للمطبخ", created_at: "2026-07-05T10:30:00.000Z" },
        { id: 5, warehouse_id: 2, ingredient_id: 1, field: "quantity", before_qty: 0, delta: 30, after_qty: 30, ref_type: "transfer", ref_id: 1, user: "admin", notes: "تحويل وارد من مخزن 1", created_at: "2026-07-10T09:00:00.000Z" },
        { id: 6, warehouse_id: 1, ingredient_id: 1, field: "quantity", before_qty: 150, delta: -30, after_qty: 120, ref_type: "transfer", ref_id: 1, user: "admin", notes: "تحويل صادر إلى مخزن 2", created_at: "2026-07-10T09:00:00.000Z" },
        { id: 7, warehouse_id: 1, ingredient_id: 4, field: "quantity", before_qty: 0, delta: 100, after_qty: 100, ref_type: "transaction", ref_id: 3, user: "admin", notes: "شراء", created_at: "2026-07-12T11:00:00.000Z" },
        { id: 8, warehouse_id: 1, ingredient_id: 5, field: "quantity", before_qty: 0, delta: 50, after_qty: 50, ref_type: "transaction", ref_id: 4, user: "admin", notes: "شراء", created_at: "2026-07-12T11:30:00.000Z" },
      ];
    }

    // Seed stock_batches (expiry tracking) if not exists
    if (!dbState["stock_batches"]) {
      dbState["stock_batches"] = [
        { id: 1, ingredient_id: 1, warehouse_id: 1, batch_number: "B-2026-001", received_date: "2026-07-01", expiry_date: "2026-12-31", quantity: 200, original_quantity: 200, cost: 15.5, supplier_id: 2, status: "active" },
        { id: 2, ingredient_id: 2, warehouse_id: 1, batch_number: "B-2026-002", received_date: "2026-07-01", expiry_date: "2027-06-30", quantity: 150, original_quantity: 150, cost: 18, supplier_id: 1, status: "active" },
        { id: 3, ingredient_id: 3, warehouse_id: 1, batch_number: "B-2026-003", received_date: "2026-07-01", expiry_date: "2026-10-31", quantity: 80, original_quantity: 80, cost: 35, supplier_id: 3, status: "active" },
        { id: 4, ingredient_id: 5, warehouse_id: 1, batch_number: "B-2026-004", received_date: "2026-07-12", expiry_date: "2026-07-25", quantity: 50, original_quantity: 50, cost: 180, supplier_id: 5, status: "expiring_soon" },
        { id: 5, ingredient_id: 7, warehouse_id: 1, batch_number: "B-2026-005", received_date: "2026-06-15", expiry_date: "2026-07-20", quantity: 30, original_quantity: 60, cost: 8, supplier_id: 4, status: "expiring_soon" },
      ];
    }

    // Seed inventory_notifications (low stock alerts) if not exists
    if (!dbState["inventory_notifications"]) {
      dbState["inventory_notifications"] = [
        { id: 1, type: "low_stock", ingredient_id: 5, warehouse_id: 1, message: "اللحم البقري وصل للحد الأدنى (10/15 كجم)", severity: "warning", read: false, created_at: "2026-07-19T08:00:00.000Z" },
        { id: 2, type: "expiry_warning", ingredient_id: 5, warehouse_id: 1, batch_id: 4, message: "اللحم البقري (تشغيلة B-2026-004) ينتهي خلال 6 أيام", severity: "warning", read: false, created_at: "2026-07-19T08:00:00.000Z" },
        { id: 3, type: "expiry_warning", ingredient_id: 7, warehouse_id: 1, batch_id: 5, message: "اللبن (تشغيلة B-2026-005) ينتهي خلال 1 يوم", severity: "critical", read: false, created_at: "2026-07-19T08:00:00.000Z" },
      ];
    }

    if (!dbState["fingerprint_devices"]) {
      dbState["fingerprint_devices"] = [];
    }

    // Seed supplier_ratings if not exists
    if (!dbState["supplier_ratings"]) {
      dbState["supplier_ratings"] = [
        { id: 1, supplier_id: 1, rating: 5, criteria: "جودة المنتجات", comment: "جودة ممتازة", created_at: "2026-07-15" },
        { id: 2, supplier_id: 1, rating: 4, criteria: "الالتزام بموعد التسليم", comment: "التزام جيد", created_at: "2026-07-15" },
        { id: 3, supplier_id: 2, rating: 5, criteria: "جودة المنتجات", comment: "دقيق عالي الجودة", created_at: "2026-07-10" },
        { id: 4, supplier_id: 3, rating: 3, criteria: "الالتزام بموعد التسليم", comment: "تأخر مرة واحدة", created_at: "2026-07-12" },
        { id: 5, supplier_id: 5, rating: 5, criteria: "أسعار تنافسية", comment: "أفضل الأسعار", created_at: "2026-07-14" },
      ];
    }

    // Seed material_requests & items if empty
    if (!dbState["material_requests"] || dbState["material_requests"].length === 0) {
      dbState["material_requests"] = [
        {
          id: 1,
          request_no: "MR-2026-0001",
          warehouse_id: 1,
          request_type: "production",
          department: "قسم التجهيز والإنتاج",
          cost_center: "CC-PROD-01",
          work_order_no: "WO-2026-084",
          priority: "urgent",
          needed_date: "2026-08-21",
          status: "approved",
          notes: "صرف خامات لإنتاج وجبات الحفلات والأعراس",
          total_value: 245.50,
          request_date: "2026-08-20T08:30:00.000Z",
          created_at: "2026-08-20T08:30:00.000Z",
          approved_by_dept: "أحمد السعيد (مدير الإنتاج)",
          approved_dept_at: "2026-08-20T09:00:00.000Z",
          approved_by_wh: "سامي محمود (مدير المخازن)",
          approved_wh_at: "2026-08-20T09:30:00.000Z"
        },
        {
          id: 2,
          request_no: "MR-2026-0002",
          warehouse_id: 1,
          request_type: "operational",
          department: "المطبخ المركزي الرئيسي",
          cost_center: "CC-KITCHEN-MAIN",
          work_order_no: null,
          priority: "high",
          needed_date: "2026-08-22",
          status: "pending_dept",
          notes: "مكونات استهلاكية يومية لتشغيل المطبخ وخدمة المطعم",
          total_value: 88.00,
          request_date: "2026-08-21T10:15:00.000Z",
          created_at: "2026-08-21T10:15:00.000Z"
        },
        {
          id: 3,
          request_no: "MR-2026-0003",
          warehouse_id: 2,
          request_type: "maintenance",
          department: "إدارة الصيانة والخدمات العامة",
          cost_center: "CC-MAINT-04",
          work_order_no: "MO-2026-019",
          priority: "medium",
          needed_date: "2026-08-23",
          status: "pending_wh",
          notes: "زيوت وقطع غيار لصيانة أفران المطبخ وثلاجات التبريد",
          total_value: 135.00,
          request_date: "2026-08-21T11:45:00.000Z",
          created_at: "2026-08-21T11:45:00.000Z",
          approved_by_dept: "م. طارق عبد الرحمن",
          approved_dept_at: "2026-08-21T12:00:00.000Z"
        },
        {
          id: 4,
          request_no: "MR-2026-0004",
          warehouse_id: 1,
          request_type: "custody",
          department: "التدبير الفندقي والضيافة",
          cost_center: "CC-HOUSEKEEPING",
          work_order_no: null,
          priority: "low",
          needed_date: "2026-08-20",
          status: "issued",
          notes: "مواد نظافة وتطهير وصرف عهدة للمشرفين",
          total_value: 62.50,
          request_date: "2026-08-20T07:00:00.000Z",
          created_at: "2026-08-20T07:00:00.000Z",
          approved_by_dept: "فاطمة النجار",
          approved_dept_at: "2026-08-20T07:30:00.000Z",
          approved_by_wh: "سامي محمود",
          approved_wh_at: "2026-08-20T08:00:00.000Z",
          issued_by: "سامي محمود",
          issued_at: "2026-08-20T08:15:00.000Z",
          recipient_name: "خالد منصور (مشرف القسم)"
        },
        {
          id: 5,
          request_no: "MR-2026-0005",
          warehouse_id: 1,
          request_type: "project",
          department: "تطوير فرع الشاطئ الجديد",
          cost_center: "CC-PROJ-BEACH",
          work_order_no: "PRJ-2026-B02",
          priority: "medium",
          needed_date: "2026-08-25",
          status: "partially_issued",
          notes: "تجهيزات ومواد أولية لتجهيز المنيو التجريبي للفرع الجديد",
          total_value: 320.00,
          request_date: "2026-08-19T14:20:00.000Z",
          created_at: "2026-08-19T14:20:00.000Z",
          approved_by_dept: "كريم يوسف",
          approved_dept_at: "2026-08-19T15:00:00.000Z",
          approved_by_wh: "سامي محمود",
          approved_wh_at: "2026-08-19T15:30:00.000Z",
          issued_by: "سامي محمود",
          issued_at: "2026-08-19T16:00:00.000Z",
          recipient_name: "عادل حسني"
        }
      ];
    }

    if (!dbState["material_request_items"] || dbState["material_request_items"].length === 0) {
      dbState["material_request_items"] = [
        { id: 1, request_id: 1, ingredient_id: 1, requested_qty: 50, approved_qty: 50, issued_qty: 0, unit_cost: 15.5, uom: "كجم", purpose: "عجين وفطائر", notes: "درجة أولى" },
        { id: 2, request_id: 1, ingredient_id: 2, requested_qty: 30, approved_qty: 30, issued_qty: 0, unit_cost: 18.0, uom: "كجم", purpose: "صلصات وتتبيل", notes: "" },
        { id: 3, request_id: 1, ingredient_id: 3, requested_qty: 15, approved_qty: 15, issued_qty: 0, unit_cost: 35.0, uom: "لتر", purpose: "قلي وطهي", notes: "نقي" },
        
        { id: 4, request_id: 2, ingredient_id: 4, requested_qty: 25, approved_qty: 25, issued_qty: 0, unit_cost: 8.5, uom: "كجم", purpose: "تجهيز أطباق جانبية", notes: "" },
        { id: 5, request_id: 2, ingredient_id: 5, requested_qty: 10, approved_qty: 10, issued_qty: 0, unit_cost: 65.0, uom: "كجم", purpose: "مشويات ستيك", notes: "طازج" },
        
        { id: 6, request_id: 3, ingredient_id: 1, requested_qty: 10, approved_qty: 10, issued_qty: 0, unit_cost: 15.5, uom: "كجم", purpose: "صيانة", notes: "" },
        { id: 7, request_id: 3, ingredient_id: 3, requested_qty: 5, approved_qty: 5, issued_qty: 0, unit_cost: 35.0, uom: "لتر", purpose: "تزييت التروس", notes: "" },
        
        { id: 8, request_id: 4, ingredient_id: 4, requested_qty: 20, approved_qty: 20, issued_qty: 20, unit_cost: 8.5, uom: "كجم", purpose: "نظافة", notes: "" },
        
        { id: 9, request_id: 5, ingredient_id: 1, requested_qty: 40, approved_qty: 40, issued_qty: 20, unit_cost: 15.5, uom: "كجم", purpose: "تجارب الخبز", notes: "" },
        { id: 10, request_id: 5, ingredient_id: 2, requested_qty: 30, approved_qty: 30, issued_qty: 15, unit_cost: 18.0, uom: "كجم", purpose: "تجارب الحلويات", notes: "" },
      ];
    }

    // Seed Treasury Custody Types if empty
    if (!dbState["treasury_custody_types"] || dbState["treasury_custody_types"].length === 0) {
      dbState["treasury_custody_types"] = [
        { id: 1, code: 'CUST-CASH', name_ar: 'عهدة نقدية / مشتريات ونثريات', name_en: 'Cash Custody / Petty Cash', category: 'cash', requires_asset: false, requires_inventory: false, requires_treasury: true, max_limit: 50000, default_duration_days: 30, is_active: true, description: 'عهدة مالية نقدية للمشتريات العاجلة والمصروفات اليومية والنثريات' },
        { id: 2, code: 'CUST-ASSET', name_ar: 'عهدة أصول ثابتة', name_en: 'Fixed Asset Custody', category: 'asset', requires_asset: true, requires_inventory: false, requires_treasury: false, max_limit: 0, default_duration_days: 365, is_active: true, description: 'تسليم أصول ثابتة مسجلة بسجل الأصول (مكاتب، أجهزة، معدات ثقيلة) للموظف' },
        { id: 3, code: 'CUST-EQUIP', name_ar: 'عهدة أجهزة ومعدات إلكترونية', name_en: 'Equipment & Hardware Custody', category: 'equipment', requires_asset: true, requires_inventory: false, requires_treasury: false, max_limit: 0, default_duration_days: 180, is_active: true, description: 'تسليم لابتوبات، هواتف، أجهزة كاشير، طابعات وشاشات للموظف للعمل' },
        { id: 4, code: 'CUST-TOOLS', name_ar: 'عهدة أدوات ومعدات تشغيل', name_en: 'Tools & Operations Custody', category: 'tools', requires_asset: false, requires_inventory: false, requires_treasury: false, max_limit: 0, default_duration_days: 90, is_active: true, description: 'أدوات الصيانة والمطبخ والتشغيل الفندقي والعدد اليدوية' },
        { id: 5, code: 'CUST-INV', name_ar: 'عهدة أصناف ومواد من المخزن', name_en: 'Warehouse Inventory Custody', category: 'inventory', requires_asset: false, requires_inventory: true, requires_treasury: false, max_limit: 0, default_duration_days: 30, is_active: true, description: 'صرف مواد وخامات من المخزن تحت عهدة المشرف للاستهلاك والتشغيل' },
        { id: 6, code: 'CUST-VEHICLE', name_ar: 'عهدة سيارة أو مركبة أو دراجة', name_en: 'Vehicle / Fleet Custody', category: 'vehicle', requires_asset: true, requires_inventory: false, requires_treasury: false, max_limit: 0, default_duration_days: 365, is_active: true, description: 'تسليم مركبات التوصيل أو سيارات الشركة لسائق أو مندوب محدد' },
        { id: 7, code: 'CUST-KEYS', name_ar: 'عهدة مفاتيح وكروت وتصاريح أمنية', name_en: 'Keys, Badges & Permits Custody', category: 'keys_permits', requires_asset: false, requires_inventory: false, requires_treasury: false, max_limit: 0, default_duration_days: 365, is_active: true, description: 'مفاتيح الخزائن، كروت الدخول الذكية، تصاريح البوابات والأختام' },
        { id: 8, code: 'CUST-TEMP', name_ar: 'عهدة نقدية مؤقتة لمهمة محددة', name_en: 'Temporary Project Custody', category: 'temporary', requires_asset: false, requires_inventory: false, requires_treasury: true, max_limit: 20000, default_duration_days: 15, is_active: true, description: 'عهدة تصرف لمهمة مؤقتة أو مشروع خارجي محدد المدة بحد أقصى 15 يوماً' },
        { id: 9, code: 'CUST-PERM', name_ar: 'عهدة تشغيلية مستديمة (Imprest)', name_en: 'Permanent Operational Custody', category: 'permanent', requires_asset: false, requires_inventory: false, requires_treasury: true, max_limit: 100000, default_duration_days: 365, is_active: true, description: 'عهدة دائمة متجددة للمشرفين يتم استعاضتها دورياً بناءً على فواتير التسوية' }
      ];
    }

    // Seed Treasury Settings if empty
    if (!dbState["treasury_settings"] || dbState["treasury_settings"].length === 0) {
      dbState["treasury_settings"] = [
        { key: 'custody_approval_tier1_limit', value: '5000', description: 'حد موافقة مدير القسم / الفرع للعهدة (ج.م)' },
        { key: 'custody_approval_tier2_limit', value: '20000', description: 'حد موافقة المدير المالي للعهدة (ج.م)' },
        { key: 'custody_approval_tier3_limit', value: '50000', description: 'حد موافقة الإدارة العليا / المدير العام (ج.م)' },
        { key: 'custody_default_due_days', value: '30', description: 'المدة الافتراضية للعهدة المؤقتة بالأيام' },
        { key: 'custody_auto_journal_posting', value: 'true', description: 'إنشاء القيود اليومية التلقائية عند الصرف والتسوية' },
        { key: 'custody_allow_partial_settlement', value: 'true', description: 'السماح بالتسوية الجزئية للعهدة' },
        { key: 'custody_overdue_warning_days', value: '3', description: 'عدد أيام التنبيه قبل موعد استحقاق العهدة' },
        { key: 'transfer_approval_tier1_limit', value: '5000', description: 'حد اعتماد مدير الفرع للتحويل المالي (ج.م)' },
        { key: 'transfer_approval_tier2_limit', value: '20000', description: 'حد اعتماد المدير المالي للتحويل المالي (ج.م)' },
        { key: 'transfer_approval_tier3_limit', value: '100000', description: 'حد اعتماد الإدارة العليا للتحويل المالي (ج.م)' },
        { key: 'transfer_auto_journal_posting', value: 'true', description: 'إنشاء وترحيل القيود المحاسبية للتحويل آلياً' },
        { key: 'transfer_require_receipt_for_all', value: 'true', description: 'اشتراط تأكيد الاستلام الفعلي من الخزينة المستهدفة' },
        { key: 'transfer_allow_negative_source', value: 'false', description: 'السماح بالتحويل بالسالب (غير موصى به)' }
      ];
    } else {
      // Ensure transfer settings exist
      const existingKeys = dbState["treasury_settings"].map((s: any) => s.key);
      const defaults = [
        { key: 'transfer_approval_tier1_limit', value: '5000', description: 'حد اعتماد مدير الفرع للتحويل المالي (ج.م)' },
        { key: 'transfer_approval_tier2_limit', value: '20000', description: 'حد اعتماد المدير المالي للتحويل المالي (ج.م)' },
        { key: 'transfer_approval_tier3_limit', value: '100000', description: 'حد اعتماد الإدارة العليا للتحويل المالي (ج.م)' },
        { key: 'transfer_auto_journal_posting', value: 'true', description: 'إنشاء وترحيل القيود المحاسبية للتحويل آلياً' },
        { key: 'transfer_require_receipt_for_all', value: 'true', description: 'اشتراط تأكيد الاستلام الفعلي من الخزينة المستهدفة' },
        { key: 'transfer_allow_negative_source', value: 'false', description: 'السماح بالتحويل بالسالب (غير موصى به)' }
      ];
      defaults.forEach(d => {
        if (!existingKeys.includes(d.key)) {
          dbState["treasury_settings"].push(d);
        }
      });
    }

    // Seed Treasury Transfer Types if empty
    if (!dbState["treasury_transfer_types"] || dbState["treasury_transfer_types"].length === 0) {
      dbState["treasury_transfer_types"] = [
        { id: 1, code: 'TRF-SAFE-SAFE', name_ar: 'تحويل بين الخزائن النقدية', name_en: 'Safe to Safe Transfer', source_type: 'safe', destination_type: 'safe', requires_receipt_confirmation: true, requires_approval: true, max_limit: 100000, is_active: true, description: 'نقل ونقل عهدة نقدية بين خزينة وأخرى في نفس الفرع أو فرع آخر' },
        { id: 2, code: 'TRF-SAFE-BANK', name_ar: 'إيداع نقدي من خزينة إلى بنك', name_en: 'Safe to Bank Deposit', source_type: 'safe', destination_type: 'bank', requires_receipt_confirmation: true, requires_approval: true, max_limit: 500000, is_active: true, description: 'إيداع إيرادات أو سيولة نقدية من الخزينة إلى الحساب البنكي' },
        { id: 3, code: 'TRF-BANK-SAFE', name_ar: 'سحب بنكي لتغذية الخزينة', name_en: 'Bank Withdrawal to Safe', source_type: 'bank', destination_type: 'safe', requires_receipt_confirmation: true, requires_approval: true, max_limit: 300000, is_active: true, description: 'صرف شيك أو سحب إلكتروني من البنك لتغذية سيولة الخزينة' },
        { id: 4, code: 'TRF-BANK-BANK', name_ar: 'تحويل بنكي بين الحسابات المصرفية', name_en: 'Bank to Bank Transfer', source_type: 'bank', destination_type: 'bank', requires_receipt_confirmation: false, requires_approval: true, max_limit: 1000000, is_active: true, description: 'تحويل مصرفي مباشر بين حسابات الشركة البنكية المختلفة' },
        { id: 5, code: 'TRF-BRANCH', name_ar: 'تحويل مالي بين الفروع', name_en: 'Inter-Branch Transfer', source_type: 'any', destination_type: 'any', requires_receipt_confirmation: true, requires_approval: true, max_limit: 250000, is_active: true, description: 'تحويل عهدة وسيولة مالية بين فروع الشركة' },
        { id: 6, code: 'TRF-COSTCENTER', name_ar: 'تحويل بين مراكز التكلفة', name_en: 'Cost Center Transfer', source_type: 'any', destination_type: 'any', requires_receipt_confirmation: false, requires_approval: true, max_limit: 150000, is_active: true, description: 'مناقلة مالية بين مراكز التكلفة والمشاريع' }
      ];
    }

    // Seed Treasury Transfers if empty
    if (!dbState["treasury_transfers"] || dbState["treasury_transfers"].length === 0) {
      dbState["treasury_transfers"] = [
        {
          id: 1,
          transfer_number: "TRF-2026-000001",
          transfer_type_id: 1,
          transfer_type: "safe_to_safe",
          source_account_id: 1,
          destination_account_id: 2,
          source_branch_id: 1,
          destination_branch_id: 2,
          source_cost_center_id: 1,
          destination_cost_center_id: 2,
          transfer_date: "2026-08-18T10:00:00.000Z",
          value_date: "2026-08-18T10:00:00.000Z",
          source_currency: "EGP",
          destination_currency: "EGP",
          amount: 15000.00,
          exchange_rate: 1.0000,
          destination_amount: 15000.00,
          exchange_difference: 0.00,
          transfer_fee: 0.00,
          fee_currency: "EGP",
          fee_borne_by: "company",
          purpose: "تغذية سيولة الخزينة النقدية لفرع الجيزة",
          category: "operational",
          statement: "تحويل نقدية لتغطية مدفوعات الموردين اليومية",
          notes: "تم النقل بواسطة المشرف المالي مع مندوب الفرع",
          status: "completed",
          source_balance_before: 125000.00,
          source_balance_after: 110000.00,
          destination_balance_before: 18000.00,
          destination_balance_after: 33000.00,
          sender_user_id: 1,
          receiver_user_id: 2,
          approved_by: 1,
          approved_at: "2026-08-18T10:15:00.000Z",
          executed_by: 1,
          executed_at: "2026-08-18T10:30:00.000Z",
          received_by: 1,
          received_at: "2026-08-18T12:00:00.000Z",
          receipt_notes: "تم استلام المبلغ نقداً ومطابقته بالكامل",
          journal_entry_id: 1,
          journal_entry_number: "JE-2026-0012",
          source_transaction_id: 101,
          destination_transaction_id: 102,
          created_by: 1,
          created_at: "2026-08-18T10:00:00.000Z",
          updated_at: "2026-08-18T12:00:00.000Z"
        },
        {
          id: 2,
          transfer_number: "TRF-2026-000002",
          transfer_type_id: 2,
          transfer_type: "safe_to_bank",
          source_account_id: 1,
          destination_account_id: 3,
          source_branch_id: 1,
          destination_branch_id: 1,
          source_cost_center_id: 1,
          destination_cost_center_id: 1,
          transfer_date: "2026-08-23T09:30:00.000Z",
          value_date: "2026-08-23T09:30:00.000Z",
          source_currency: "EGP",
          destination_currency: "EGP",
          amount: 45000.00,
          exchange_rate: 1.0000,
          destination_amount: 45000.00,
          exchange_difference: 0.00,
          transfer_fee: 50.00,
          fee_currency: "EGP",
          fee_borne_by: "source",
          purpose: "إيداع مبيعات نهاية الأسبوع بالبنك التجاري الدولي",
          category: "liquidity",
          statement: "إيداع إيرادات نقدية فائضة بالبنك",
          notes: "تم إرسال المندوب البنكي مع إيصال الإيداع",
          status: "pending_receipt",
          source_balance_before: 110000.00,
          source_balance_after: 64950.00,
          destination_balance_before: 450000.00,
          destination_balance_after: 495000.00,
          sender_user_id: 1,
          receiver_user_id: 1,
          approved_by: 1,
          approved_at: "2026-08-23T10:00:00.000Z",
          executed_by: 1,
          executed_at: "2026-08-23T10:30:00.000Z",
          created_by: 1,
          created_at: "2026-08-23T09:30:00.000Z",
          updated_at: "2026-08-23T10:30:00.000Z"
        },
        {
          id: 3,
          transfer_number: "TRF-2026-000003",
          transfer_type_id: 4,
          transfer_type: "bank_to_bank",
          source_account_id: 3,
          destination_account_id: 4,
          source_branch_id: 1,
          destination_branch_id: 1,
          source_cost_center_id: 1,
          destination_cost_center_id: 1,
          transfer_date: "2026-08-24T11:00:00.000Z",
          value_date: "2026-08-24T11:00:00.000Z",
          source_currency: "USD",
          destination_currency: "EGP",
          amount: 5000.00,
          exchange_rate: 48.5000,
          destination_amount: 242500.00,
          exchange_difference: 0.00,
          transfer_fee: 25.00,
          fee_currency: "USD",
          fee_borne_by: "company",
          purpose: "تحويل عملة أجنبية لصرف رواتب وتغذية حساب الجنيه",
          category: "payroll_funding",
          statement: "تحويل 5,000 دولار إلى الحساب الجاري بالجنيه المصري",
          notes: "تم الاتفاق على سعر صرف تفضيلي من مدير علاقات البنك",
          status: "pending_approval",
          source_balance_before: 50000.00,
          source_balance_after: 45000.00,
          destination_balance_before: 450000.00,
          destination_balance_after: 692500.00,
          sender_user_id: 1,
          created_by: 1,
          created_at: "2026-08-24T11:00:00.000Z",
          updated_at: "2026-08-24T11:00:00.000Z"
        },
        {
          id: 4,
          transfer_number: "TRF-2026-000004",
          transfer_type_id: 5,
          transfer_type: "branch_transfer",
          source_account_id: 2,
          destination_account_id: 1,
          source_branch_id: 2,
          destination_branch_id: 1,
          source_cost_center_id: 2,
          destination_cost_center_id: 1,
          transfer_date: "2026-08-24T14:00:00.000Z",
          value_date: "2026-08-24T14:00:00.000Z",
          source_currency: "EGP",
          destination_currency: "EGP",
          amount: 8000.00,
          exchange_rate: 1.0000,
          destination_amount: 8000.00,
          exchange_difference: 0.00,
          transfer_fee: 0.00,
          fee_currency: "EGP",
          fee_borne_by: "company",
          purpose: "إعادة فائض سيولة فرع الجيزة إلى الإدارة العامة",
          category: "branch_replenishment",
          statement: "رد فائض نقدية بعد إتمام عمليات الصيانة",
          notes: "في انتظار إشعار التنفيذ من أمين الخزينة",
          status: "approved",
          approved_by: 1,
          approved_at: "2026-08-24T14:30:00.000Z",
          sender_user_id: 1,
          created_by: 1,
          created_at: "2026-08-24T14:00:00.000Z",
          updated_at: "2026-08-24T14:30:00.000Z"
        },
        {
          id: 5,
          transfer_number: "TRF-2026-000005",
          transfer_type_id: 1,
          transfer_type: "safe_to_safe",
          source_account_id: 1,
          destination_account_id: 2,
          source_branch_id: 1,
          destination_branch_id: 2,
          source_cost_center_id: 1,
          destination_cost_center_id: 2,
          transfer_date: "2026-08-24T15:00:00.000Z",
          value_date: "2026-08-24T15:00:00.000Z",
          source_currency: "EGP",
          destination_currency: "EGP",
          amount: 3500.00,
          exchange_rate: 1.0000,
          destination_amount: 3500.00,
          exchange_difference: 0.00,
          transfer_fee: 0.00,
          fee_currency: "EGP",
          fee_borne_by: "company",
          purpose: "مسودة طلب تحويل لشراء مستلزمات مكتبية",
          category: "operational",
          statement: "طلب تحويل قيد التعديل",
          notes: "لم يتم الإرسال بعد",
          status: "draft",
          sender_user_id: 1,
          created_by: 1,
          created_at: "2026-08-24T15:00:00.000Z",
          updated_at: "2026-08-24T15:00:00.000Z"
        }
      ];
    }

    // Seed Transfer Audit Logs if empty
    if (!dbState["treasury_transfer_audit_logs"] || dbState["treasury_transfer_audit_logs"].length === 0) {
      dbState["treasury_transfer_audit_logs"] = [
        { id: 1, transfer_id: 1, action_type: "create", old_values: null, new_values: { status: "draft" }, user_id: 1, user_name: "admin", notes: "إنشاء طلب التحويل المالي TRF-2026-000001", created_at: "2026-08-18T10:00:00.000Z" },
        { id: 2, transfer_id: 1, action_type: "approve", old_values: { status: "pending_approval" }, new_values: { status: "approved" }, user_id: 1, user_name: "admin", notes: "اعتماد التحويل المالي من الإدارة المالية", created_at: "2026-08-18T10:15:00.000Z" },
        { id: 3, transfer_id: 1, action_type: "execute", old_values: { status: "approved" }, new_values: { status: "pending_receipt" }, user_id: 1, user_name: "admin", notes: "تنفيذ وخصم المبلغ من الخزينة المصدر", created_at: "2026-08-18T10:30:00.000Z" },
        { id: 4, transfer_id: 1, action_type: "receive", old_values: { status: "pending_receipt" }, new_values: { status: "completed" }, user_id: 1, user_name: "admin", notes: "استلام وإضافة المبلغ للخزينة المستهدفة وترحيل القيد المحاسبي JE-2026-0012", created_at: "2026-08-18T12:00:00.000Z" },
        { id: 5, transfer_id: 2, action_type: "execute", old_values: { status: "approved" }, new_values: { status: "pending_receipt" }, user_id: 1, user_name: "admin", notes: "تنفيذ إيداع بنكي ونقل الأموال", created_at: "2026-08-23T10:30:00.000Z" }
      ];
    }

    // Seed Transfer Attachments if empty
    if (!dbState["treasury_transfer_attachments"] || dbState["treasury_transfer_attachments"].length === 0) {
      dbState["treasury_transfer_attachments"] = [
        { id: 1, transfer_id: 1, file_name: "bank_deposit_slip_001.pdf", file_url: "/uploads/transfer_receipt_001.pdf", file_type: "application/pdf", file_size: 142800, document_type: "transfer_voucher", notes: "إيصال تسليم النقدية موقع من أمين الخزينة", created_by: 1, created_at: "2026-08-18T12:05:00.000Z" },
        { id: 2, transfer_id: 2, file_name: "cib_deposit_receipt_45k.jpg", file_url: "/uploads/cib_deposit_45k.jpg", file_type: "image/jpeg", file_size: 254000, document_type: "bank_receipt", notes: "إشعار إيداع بنك CIB المعتمد", created_by: 1, created_at: "2026-08-23T10:35:00.000Z" }
      ];
    }

    // Seed Initial Enterprise Custodies if empty
    if (!dbState["treasury_custodies"] || dbState["treasury_custodies"].length === 0) {
      dbState["treasury_custodies"] = [
        {
          id: 1,
          custody_number: "CUS-2026-0001",
          custody_type_id: 1,
          custody_type: "cash",
          employee_id: 1,
          employee_name: "أحمد محمود علي",
          employee_code: "EMP-101",
          department: "المشتريات والتموين",
          section: "المشتريات العاجلة",
          branch_id: 1,
          cost_center_id: 1,
          project_name: "مشتريات خضار ومواد طازجة للمطبخ",
          account_id: 1,
          amount: 5000.00,
          issued_amount: 5000.00,
          spent_amount: 3200.00,
          remaining_amount: 1800.00,
          returned_amount: 0.00,
          additional_due_amount: 0.00,
          currency: "EGP",
          status: "active",
          request_date: "2026-08-10T09:00:00.000Z",
          issue_date: "2026-08-11T10:30:00.000Z",
          due_date: "2026-09-10T10:30:00.000Z",
          duration_days: 30,
          purpose: "مشتريات طارئة ومستلزمات تغليف للمطبخ الرئيسي",
          notes: "عهدة شهرية دورية معتمدة من الإدارة المالية",
          approved_by: 1,
          approved_at: "2026-08-10T14:00:00.000Z",
          issued_by: 1,
          issued_at: "2026-08-11T10:30:00.000Z",
          received_at: "2026-08-11T11:00:00.000Z",
          created_by: 1,
          created_at: "2026-08-10T09:00:00.000Z",
          updated_at: "2026-08-15T12:00:00.000Z"
        },
        {
          id: 2,
          custody_number: "CUS-2026-0002",
          custody_type_id: 3,
          custody_type: "equipment",
          employee_id: 2,
          employee_name: "محمود حسن إبراهيم",
          employee_code: "EMP-102",
          department: "تقنية المعلومات",
          section: "الدعم الفني والشبكات",
          branch_id: 1,
          cost_center_id: 3,
          project_name: "تجهيز نقطة بيع إضافية",
          account_id: null,
          amount: 0.00,
          issued_amount: 0.00,
          spent_amount: 0.00,
          remaining_amount: 0.00,
          returned_amount: 0.00,
          additional_due_amount: 0.00,
          currency: "EGP",
          status: "active",
          request_date: "2026-08-01T08:00:00.000Z",
          issue_date: "2026-08-02T11:00:00.000Z",
          due_date: "2027-02-02T11:00:00.000Z",
          duration_days: 180,
          purpose: "جهاز لابتوب Dell Latitude + جهاز كاشير باركود محمول",
          notes: "في حالة ممتازة مع الملحقات والشاحن الأصلي",
          approved_by: 1,
          approved_at: "2026-08-01T12:00:00.000Z",
          issued_by: 1,
          issued_at: "2026-08-02T11:00:00.000Z",
          received_at: "2026-08-02T11:30:00.000Z",
          created_by: 1,
          created_at: "2026-08-01T08:00:00.000Z",
          updated_at: "2026-08-02T11:30:00.000Z"
        },
        {
          id: 3,
          custody_number: "CUS-2026-0003",
          custody_type_id: 1,
          custody_type: "cash",
          employee_id: 3,
          employee_name: "خالد سعيد فوزي",
          employee_code: "EMP-103",
          department: "الصيانة والمرافق",
          section: "صيانة أجهزة التبريد",
          branch_id: 1,
          cost_center_id: 5,
          project_name: "صيانة طارئة لوحدات التبريد",
          account_id: 1,
          amount: 8000.00,
          issued_amount: 8000.00,
          spent_amount: 8450.00,
          remaining_amount: 0.00,
          returned_amount: 0.00,
          additional_due_amount: 450.00,
          currency: "EGP",
          status: "pending_settlement",
          request_date: "2026-07-15T10:00:00.000Z",
          issue_date: "2026-07-16T12:00:00.000Z",
          due_date: "2026-08-15T12:00:00.000Z",
          duration_days: 30,
          purpose: "قطع غيار فريون وصمامات لثلاجات التخزين الرئيسية",
          notes: "تم استهلاك العهدة بالكامل مع وجود زيادة 450 ج.م مستحقة للموظف",
          approved_by: 1,
          approved_at: "2026-07-15T15:00:00.000Z",
          issued_by: 1,
          issued_at: "2026-07-16T12:00:00.000Z",
          received_at: "2026-07-16T12:30:00.000Z",
          created_by: 1,
          created_at: "2026-07-15T10:00:00.000Z",
          updated_at: "2026-08-18T16:00:00.000Z"
        },
        {
          id: 4,
          custody_number: "CUS-2026-0004",
          custody_type_id: 6,
          custody_type: "vehicle",
          employee_id: 4,
          employee_name: "أيمن صلاح فتحي",
          employee_code: "EMP-104",
          department: "خدمة التوصيل",
          section: "دليفري فرع القاهرة",
          branch_id: 1,
          cost_center_id: 7,
          project_name: "دراجة نارية توصيل طلبات",
          account_id: null,
          amount: 0.00,
          issued_amount: 0.00,
          spent_amount: 0.00,
          remaining_amount: 0.00,
          returned_amount: 0.00,
          additional_due_amount: 0.00,
          currency: "EGP",
          status: "active",
          request_date: "2026-06-01T09:00:00.000Z",
          issue_date: "2026-06-01T14:00:00.000Z",
          due_date: "2027-06-01T14:00:00.000Z",
          duration_days: 365,
          purpose: "دراجة نارية هوجان موديل 2024 - رقم اللوحة (ق هـ د 4821)",
          notes: "تشمل خوذة أمان وحقيبة حرارية لحفظ الوجبات الساخنة",
          approved_by: 1,
          approved_at: "2026-06-01T10:00:00.000Z",
          issued_by: 1,
          issued_at: "2026-06-01T14:00:00.000Z",
          received_at: "2026-06-01T14:30:00.000Z",
          created_by: 1,
          created_at: "2026-06-01T09:00:00.000Z",
          updated_at: "2026-06-01T14:30:00.000Z"
        },
        {
          id: 5,
          custody_number: "CUS-2026-0005",
          custody_type_id: 1,
          custody_type: "cash",
          employee_id: 5,
          employee_name: "سارة نبيل عبد العزيز",
          employee_code: "EMP-105",
          department: "الضيافة والاستقبال",
          section: "خدمة العملاء والـ VIP",
          branch_id: 1,
          cost_center_id: 2,
          project_name: "تجهيزات وضيافة حفل افتتاح القاعة",
          account_id: 1,
          amount: 3500.00,
          issued_amount: 3500.00,
          spent_amount: 3100.00,
          remaining_amount: 0.00,
          returned_amount: 400.00,
          additional_due_amount: 0.00,
          currency: "EGP",
          status: "closed",
          request_date: "2026-07-01T10:00:00.000Z",
          issue_date: "2026-07-02T11:00:00.000Z",
          due_date: "2026-07-15T11:00:00.000Z",
          duration_days: 14,
          purpose: "شراء ورود وتنسيق طاولات وضيافة مميزة لحفل الافتتاح",
          notes: "تمت التصفية بالكامل ورد المتبقي 400 ج.م للخزينة الرئيسية بقسيمة REC-2026-0012",
          cleared_amount: 3100.00,
          clearance_notes: "تمت مراجعة الفواتير واعتماد التصفية",
          approved_by: 1,
          approved_at: "2026-07-01T12:00:00.000Z",
          issued_by: 1,
          issued_at: "2026-07-02T11:00:00.000Z",
          received_at: "2026-07-02T11:30:00.000Z",
          cleared_at: "2026-07-14T15:00:00.000Z",
          closed_by: 1,
          closed_at: "2026-07-14T15:00:00.000Z",
          created_by: 1,
          created_at: "2026-07-01T10:00:00.000Z",
          updated_at: "2026-07-14T15:00:00.000Z"
        },
        {
          id: 6,
          custody_number: "CUS-2026-0006",
          custody_type_id: 8,
          custody_type: "temporary",
          employee_id: 6,
          employee_name: "سامي عبد الله عثمان",
          employee_code: "EMP-106",
          department: "التسويق والمبيعات",
          section: "المعارض والفعاليات",
          branch_id: 1,
          cost_center_id: 4,
          project_name: "مشاركة بمعرض الأغذية والضيافة الدولي",
          account_id: 1,
          amount: 15000.00,
          issued_amount: 15000.00,
          spent_amount: 11200.00,
          remaining_amount: 3800.00,
          returned_amount: 0.00,
          additional_due_amount: 0.00,
          currency: "EGP",
          status: "overdue",
          request_date: "2026-07-05T09:00:00.000Z",
          issue_date: "2026-07-06T10:00:00.000Z",
          due_date: "2026-08-06T10:00:00.000Z",
          duration_days: 30,
          purpose: "مصروفات إقامة الجناح والمطبوعات الإعلانية ونقل العينات",
          notes: "تجاوزت تاريخ الاستحقاق - تم إرسال تنبيه للموظف لتقديم المستندات والتسوية",
          approved_by: 1,
          approved_at: "2026-07-05T11:00:00.000Z",
          issued_by: 1,
          issued_at: "2026-07-06T10:00:00.000Z",
          received_at: "2026-07-06T10:30:00.000Z",
          created_by: 1,
          created_at: "2026-07-05T09:00:00.000Z",
          updated_at: "2026-08-20T10:00:00.000Z"
        }
      ];
    }

    // Seed Custody Expenses if empty
    if (!dbState["treasury_custody_expenses"] || dbState["treasury_custody_expenses"].length === 0) {
      dbState["treasury_custody_expenses"] = [
        { id: 1, custody_id: 1, expense_number: "EXP-001", expense_date: "2026-08-12", description: "شراء خضروات طازجة وأعشاب عطرية", category: "مشتريات أغذية", amount: 1450.00, tax_amount: 0, cost_center_id: 1, supplier_name: "سوق العبور المركزي", invoice_number: "INV-8891", payment_method: "نقدي", notes: "فاتورة ضريبية مرفقة", created_by: 1, created_at: "2026-08-12T14:00:00.000Z" },
        { id: 2, custody_id: 1, expense_number: "EXP-002", expense_date: "2026-08-14", description: "أكياس وعلب تغليف ورقية صديقة للبيئة", category: "تغليف ومستهلكات", amount: 1750.00, tax_amount: 0, cost_center_id: 1, supplier_name: "مؤسسة الأهرام للتغليف", invoice_number: "INV-4320", payment_method: "نقدي", notes: "استلام من المورد مباشرة", created_by: 1, created_at: "2026-08-14T16:30:00.000Z" },
        { id: 3, custody_id: 3, expense_number: "EXP-003", expense_date: "2026-07-20", description: "شحن غاز فريون R404A لثلاجة اللحوم", category: "صيانة", amount: 3600.00, tax_amount: 0, cost_center_id: 5, supplier_name: "المركز الهندسي للتبريد", invoice_number: "INV-902", payment_method: "نقدي", notes: "صيانة عاجلة", created_by: 1, created_at: "2026-07-20T11:00:00.000Z" },
        { id: 4, custody_id: 3, expense_number: "EXP-004", expense_date: "2026-07-25", description: "استبدال ثرموستات ديجيتال ومروحة مكثف", category: "قطع غيار", amount: 4850.00, tax_amount: 0, cost_center_id: 5, supplier_name: "الشركة الفنية للتبريد والتكييف", invoice_number: "INV-1104", payment_method: "نقدي", notes: "قطع أصلية بضمان 6 شهور", created_by: 1, created_at: "2026-07-25T15:20:00.000Z" },
        { id: 5, custody_id: 6, expense_number: "EXP-005", expense_date: "2026-07-10", description: "طباعة بنرات وبروشورات ترويجية للمنيو", category: "دعاية وإعلان", amount: 6200.00, tax_amount: 0, cost_center_id: 4, supplier_name: "مطابع النيل الحديثة", invoice_number: "INV-7731", payment_method: "نقدي", notes: "1000 نسخة + 4 رول أب", created_by: 1, created_at: "2026-07-10T13:00:00.000Z" },
        { id: 6, custody_id: 6, expense_number: "EXP-006", expense_date: "2026-07-15", description: "نقل ومبيت وتجهيز ديكور جناح المعرض", category: "مصاريف فعاليات", amount: 5000.00, tax_amount: 0, cost_center_id: 4, supplier_name: "شركة لوجستك إيجيبت", invoice_number: "INV-5510", payment_method: "نقدي", notes: "إيصالات معتمدة", created_by: 1, created_at: "2026-07-15T18:00:00.000Z" }
      ];
    }

    // Seed Custody Items (Assets, Equipment, Keys, Vehicles) if empty
    if (!dbState["treasury_custody_items"] || dbState["treasury_custody_items"].length === 0) {
      dbState["treasury_custody_items"] = [
        { id: 1, custody_id: 2, item_type: "fixed_asset", asset_id: 1, item_name: "لابتوب Dell Latitude 5420 i7 16GB", item_code: "AST-IT-001", serial_number: "SN-DELL-884920", barcode: "BC-6221004", quantity: 1, unit_cost: 32000.00, total_value: 32000.00, condition_on_issue: "ممتازة / جديدة", condition_on_return: null, status: "assigned", issued_at: "2026-08-02T11:00:00.000Z", notes: "مع الحقيبة والشاحن الأصلي", created_at: "2026-08-02T11:00:00.000Z" },
        { id: 2, custody_id: 2, item_type: "fixed_asset", asset_id: 2, item_name: "قارئ باركود لاسلكي Zebra DS2278", item_code: "AST-POS-014", serial_number: "SN-ZEB-3391", barcode: "BC-6221099", quantity: 1, unit_cost: 4500.00, total_value: 4500.00, condition_on_issue: "ممتازة", condition_on_return: null, status: "assigned", issued_at: "2026-08-02T11:00:00.000Z", notes: "مع قاعدة الشحن", created_at: "2026-08-02T11:00:00.000Z" },
        { id: 3, custody_id: 4, item_type: "vehicle", asset_id: 3, item_name: "دراجة نارية هوجان 150cc موديل 2024", item_code: "AST-VEH-003", serial_number: "CHASSIS-EG-99812", barcode: "BC-VEH-4821", quantity: 1, unit_cost: 55000.00, total_value: 55000.00, condition_on_issue: "جديدة كلياً 0 كم", condition_on_return: null, status: "assigned", issued_at: "2026-06-01T14:00:00.000Z", notes: "رقم اللوحة ق هـ د 4821 - رخصة سارية حتى 2027", created_at: "2026-06-01T14:00:00.000Z" }
      ];
    }

    // Seed Custody Settlements if empty
    if (!dbState["treasury_custody_settlements"] || dbState["treasury_custody_settlements"].length === 0) {
      dbState["treasury_custody_settlements"] = [
        {
          id: 1,
          settlement_number: "SET-2026-0001",
          custody_id: 5,
          settlement_date: "2026-07-14T15:00:00.000Z",
          total_expenses: 3100.00,
          returned_to_treasury: 400.00,
          additional_paid_to_employee: 0.00,
          settlement_type: "full",
          treasury_account_id: 1,
          status: "approved",
          notes: "تصفية كاملة مستوفية للفواتير الضريبية وإيصال استرداد النقدية",
          reviewed_by: 1,
          reviewed_at: "2026-07-14T14:30:00.000Z",
          approved_by: 1,
          approved_at: "2026-07-14T15:00:00.000Z",
          journal_entry_id: 1,
          created_by: 1,
          created_at: "2026-07-14T14:00:00.000Z"
        }
      ];
    }

    // Seed Custody Audit Logs if empty
    if (!dbState["treasury_custody_audit_logs"] || dbState["treasury_custody_audit_logs"].length === 0) {
      dbState["treasury_custody_audit_logs"] = [
        { id: 1, custody_id: 1, action_type: "create", old_status: null, new_status: "draft", details: { message: "إنشاء طلب عهدة نقدية للمشتريات" }, user_id: 1, user_name: "admin", created_at: "2026-08-10T09:00:00.000Z" },
        { id: 2, custody_id: 1, action_type: "approve", old_status: "pending_approval", new_status: "approved", details: { message: "اعتماد طلب العهدة من المدير المالي" }, user_id: 1, user_name: "admin", created_at: "2026-08-10T14:00:00.000Z" },
        { id: 3, custody_id: 1, action_type: "issue", old_status: "approved", new_status: "issued", details: { message: "صرف وتسليم مبلغ العهدة (5,000 ج.م) من الخزينة الرئيسية بقسيمة PAY-2026-0041" }, user_id: 1, user_name: "admin", created_at: "2026-08-11T10:30:00.000Z" },
        { id: 4, custody_id: 1, action_type: "receive", old_status: "issued", new_status: "active", details: { message: "تأكيد واستلام الموظف للعهدة النقدية" }, user_id: 1, user_name: "admin", created_at: "2026-08-11T11:00:00.000Z" },
        { id: 5, custody_id: 5, action_type: "settle_and_close", old_status: "active", new_status: "closed", details: { message: "تصفية وإغلاق العهدة ورد 400 ج.م للخزينة" }, user_id: 1, user_name: "admin", created_at: "2026-07-14T15:00:00.000Z" }
      ];
    }

    // Seed Treasury Closings if empty
    if (!dbState["treasury_closings"] || dbState["treasury_closings"].length === 0) {
      dbState["treasury_closings"] = [
        {
          id: 1,
          treasury_id: 1,
          closing_date: "2026-08-24T20:30:00.000Z",
          opening_balance: 110000.00,
          total_deposits: 35000.00,
          total_withdrawals: 20000.00,
          book_balance: 125000.00,
          actual_balance: 125000.00,
          variance: 0.00,
          responsible_user: "أحمد عبد الله (أمين الخزينة)",
          responsible_user_id: 1,
          status: "Matched",
          notes: "تم إقفال اليومية ومطابقة الجرد الفعلي تماماً مع الرصيد الدفتري بدون أي فروقات.",
          denominations: {
            "200": 500, // 100,000
            "100": 200, // 20,000
            "50": 80,   // 4,000
            "20": 40,   // 800
            "10": 15,   // 150
            "5": 10,    // 50
            "1": 0,
            "0.5": 0
          },
          journal_entry_id: 101,
          reviewed_by: 1,
          reviewed_at: "2026-08-24T21:00:00.000Z",
          review_notes: "تم الاعتماد والمطابقة من المشرف المالي",
          created_at: "2026-08-24T20:30:00.000Z",
          updated_at: "2026-08-24T21:00:00.000Z"
        },
        {
          id: 2,
          treasury_id: 2,
          closing_date: "2026-08-23T21:00:00.000Z",
          opening_balance: 18000.00,
          total_deposits: 14250.00,
          total_withdrawals: 13500.00,
          book_balance: 18750.00,
          actual_balance: 18500.00,
          variance: -250.00,
          responsible_user: "حسام حسن (كاشير صالة فرع الجيزة)",
          responsible_user_id: 2,
          status: "Deficit - Pending Review",
          notes: "عجز 250 ج.م في النقدية الفعلية، جارٍ مراجعة فواتير التوصيل واسترجاع الطلبات المعلقة.",
          denominations: {
            "200": 70,  // 14,000
            "100": 35,  // 3,500
            "50": 16,   // 800
            "20": 8,    // 160
            "10": 4,    // 40
            "5": 0,
            "1": 0,
            "0.5": 0
          },
          journal_entry_id: null,
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
          created_at: "2026-08-23T21:00:00.000Z",
          updated_at: "2026-08-23T21:00:00.000Z"
        },
        {
          id: 3,
          treasury_id: 1,
          closing_date: "2026-08-22T20:00:00.000Z",
          opening_balance: 95000.00,
          total_deposits: 48000.00,
          total_withdrawals: 33120.00,
          book_balance: 109880.00,
          actual_balance: 110000.00,
          variance: 120.00,
          responsible_user: "أحمد عبد الله (أمين الخزينة)",
          responsible_user_id: 1,
          status: "Surplus - Pending Review",
          notes: "زيادة نقدية بقيمة 120 ج.م نتيجة بواقي تقريب فواتير الكاشير وطلبات الدليفري.",
          denominations: {
            "200": 450, // 90,000
            "100": 170, // 17,000
            "50": 40,   // 2,000
            "20": 40,   // 800
            "10": 15,   // 150
            "5": 10,    // 50
            "1": 0,
            "0.5": 0
          },
          journal_entry_id: null,
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
          created_at: "2026-08-22T20:00:00.000Z",
          updated_at: "2026-08-22T20:00:00.000Z"
        },
        {
          id: 4,
          treasury_id: 2,
          closing_date: "2026-08-21T21:30:00.000Z",
          opening_balance: 15000.00,
          total_deposits: 22000.00,
          total_withdrawals: 19000.00,
          book_balance: 18000.00,
          actual_balance: 18000.00,
          variance: 0.00,
          responsible_user: "سعيد مرسي (أمين الخزينة)",
          responsible_user_id: 2,
          status: "Matched",
          notes: "مطابقة كاملة لوردية نهاية الأسبوع بدون ملاحظات.",
          denominations: {
            "200": 60,  // 12,000
            "100": 45,  // 4,500
            "50": 20,   // 1,000
            "20": 20,   // 400
            "10": 10,   // 100
            "5": 0,
            "1": 0,
            "0.5": 0
          },
          journal_entry_id: 104,
          reviewed_by: 1,
          reviewed_at: "2026-08-21T22:00:00.000Z",
          review_notes: "معتمد ومطابق",
          created_at: "2026-08-21T21:30:00.000Z",
          updated_at: "2026-08-21T22:00:00.000Z"
        }
      ];
    }

    saveDb();
  } catch (error) {
    console.error("Failed to load local fallback DB:", error);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(dbState, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save local fallback DB:", error);
  }
}

loadDb();

function handleFallbackQuery(sql: string, params: any[] = []): { rows: any[]; rowCount: number } {
  const normalizedSql = sql.replace(/\s+/g, " ").trim();
  const lowerSql = normalizedSql.toLowerCase();

  // 1. CREATE TABLE
  if (lowerSql.startsWith("create table")) {
    const match = normalizedSql.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_]+)/i);
    if (match) {
      const tableName = match[1];
      if (!dbState[tableName]) {
        dbState[tableName] = [];
        saveDb();
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // 2. ALTER TABLE / CREATE INDEX / COMMIT / BEGIN / ROLLBACK
  if (
    lowerSql.startsWith("alter table") ||
    lowerSql.startsWith("create index") ||
    lowerSql.startsWith("create unique index") ||
    lowerSql === "begin" ||
    lowerSql === "commit" ||
    lowerSql === "rollback" ||
    lowerSql === "select now()"
  ) {
    if (lowerSql === "select now()") {
      return { rows: [{ now: new Date() }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 3. SELECT
  if (lowerSql.startsWith("select")) {
    if (lowerSql.includes("to_regclass")) {
      const rawParam = params[0] ? String(params[0]).replace("public.", "").replace(/["']/g, "") : "";
      const exists = Boolean(dbState[rawParam] !== undefined || dbState[rawParam.toLowerCase()] !== undefined);
      return { rows: [{ table_name: exists ? rawParam : null }], rowCount: 1 };
    }

    if (lowerSql.includes("information_schema.tables")) {
      if (lowerSql.includes("exists")) {
        const rawParam = params[0] ? String(params[0]).replace("public.", "").replace(/["']/g, "") : "";
        const exists = Boolean(dbState[rawParam] !== undefined || dbState[rawParam.toLowerCase()] !== undefined);
        return { rows: [{ exists }], rowCount: 1 };
      }
      const tableRows = Object.keys(dbState).map(t => ({ table_name: t }));
      return { rows: tableRows, rowCount: tableRows.length };
    }
    // Intercept specific join query for ingredients and inventory_items
    if (lowerSql.includes("from ingredients ing") && lowerSql.includes("left join inventory_items i")) {
      const warehouseIdMatch = lowerSql.match(/i\.warehouse_id\s*=\s*\$(\d+)/i) || normalizedSql.match(/warehouse_id\s*=\s*\$(\d+)/i);
      let targetWarehouseId: number | null = null;
      if (warehouseIdMatch) {
        const paramIndex = parseInt(warehouseIdMatch[1]) - 1;
        targetWarehouseId = Number(params[paramIndex]);
      } else {
        const directMatch = normalizedSql.match(/warehouse_id\s*=\s*(\d+)/i);
        if (directMatch) {
          targetWarehouseId = Number(directMatch[1]);
        }
      }

      if (targetWarehouseId) {
        const ingredientsList = dbState["ingredients"] || [];
        const inventoryItemsList = dbState["inventory_items"] || [];
        const warehouseSectionsList = dbState["warehouse_sections"] || [];

        const joinedRows = ingredientsList.map((ing) => {
          const invItem = inventoryItemsList.find(
            (ii) => Number(ii.ingredient_id) === Number(ing.id) && Number(ii.warehouse_id) === Number(targetWarehouseId)
          );

          const secId = invItem ? invItem.section_id : null;
          const section = secId ? warehouseSectionsList.find((s) => Number(s.id) === Number(secId)) : null;

          return {
            inventory_id: invItem ? invItem.id : null,
            quantity: invItem ? Number(invItem.quantity) || 0 : 0,
            min_quantity: invItem ? Number(invItem.min_quantity) || 0 : 0,
            ingredient_id: ing.id,
            ingredient_name: ing.name,
            unit: ing.unit,
            cost: Number(ing.cost) || 0,
            item_code: ing.item_code || `ITEM-${1000 + ing.id}`,
            item_group: ing.item_group || ing.category || "عام",
            section_id: secId ? Number(secId) : null,
            section_name: section ? section.name : null,
          };
        });

        return { rows: joinedRows, rowCount: joinedRows.length };
      }
    }

    // Intercept report join query for inventory_items, ingredients, warehouses, sections
    if (lowerSql.includes("from inventory_items i") && lowerSql.includes("join ingredients ing") && !lowerSql.includes("from warehouses") && !lowerSql.includes("from warehouses w") && !lowerSql.includes("left join warehouses w on w.id = i.warehouse_id") && !lowerSql.includes("join warehouses w on w.id = i.warehouse_id") && !lowerSql.includes("group by ing.name, ing.code, ing.unit") && !lowerSql.startsWith("select coalesce(sum(") && !lowerSql.startsWith("select count")) {
      const ingredientsList = dbState["ingredients"] || [];
      const inventoryItemsList = dbState["inventory_items"] || [];
      const warehousesList = dbState["warehouses"] || [];
      const warehouseSectionsList = dbState["warehouse_sections"] || [];

      const joinedRows = inventoryItemsList.map((i) => {
        const ing = ingredientsList.find((g) => Number(g.id) === Number(i.ingredient_id));
        const w = warehousesList.find((wh) => Number(wh.id) === Number(i.warehouse_id));
        const s = i.section_id ? warehouseSectionsList.find((sec) => Number(sec.id) === Number(i.section_id)) : null;

        if (!ing || !w) return null;

        return {
          inventory_id: i.id,
          quantity: Number(i.quantity) || 0,
          min_quantity: Number(i.min_quantity) || 0,
          ingredient_id: ing.id,
          ingredient_name: ing.name,
          category: ing.category || ing.supplier || "عام",
          unit: ing.unit,
          cost: Number(ing.cost) || 0,
          item_code: ing.item_code || `ITEM-${1000 + ing.id}`,
          item_group: ing.item_group || ing.category || "عام",
          section_id: i.section_id ? Number(i.section_id) : null,
          section_name: s ? s.name : null,
          warehouse_id: w.id,
          warehouse_name: w.name,
        };
      }).filter(Boolean);

      joinedRows.sort((a: any, b: any) => {
        const wComp = a.warehouse_name.localeCompare(b.warehouse_name, "ar");
        if (wComp !== 0) return wComp;
        return a.ingredient_name.localeCompare(b.ingredient_name, "ar");
      });

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Warehouse module: warehouses with stock summary (subquery) ───
    if (lowerSql.includes("from warehouses w") && lowerSql.includes("item_count") && lowerSql.includes("stock_value")) {
      const warehousesList = dbState["warehouses"] || [];
      const invItemsList = dbState["inventory_items"] || [];
      const ingredientsList = dbState["ingredients"] || [];
      const joinedRows = warehousesList.map((w: any) => {
        const items = invItemsList.filter((i: any) => Number(i.warehouse_id) === Number(w.id));
        const stockValue = items.reduce((sum: number, i: any) => {
          const ing = ingredientsList.find((g: any) => Number(g.id) === Number(i.ingredient_id));
          return sum + (Number(i.quantity || 0) * Number(ing?.avg_cost || 0));
        }, 0);
        return { ...w, item_count: items.length, stock_value: stockValue };
      });
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Warehouse module: ingredients with stock summary ───
    if (lowerSql.includes("from ingredients ing") && lowerSql.includes("total_stock") && lowerSql.includes("total_reserved")) {
      const ingredientsList = dbState["ingredients"] || [];
      const invItemsList = dbState["inventory_items"] || [];
      const withStock = lowerSql.includes("exists (select 1 from inventory_items i where i.ingredient_id = ing.id and i.quantity > 0)");
      let joinedRows = ingredientsList.map((ing: any) => {
        const items = invItemsList.filter((i: any) => Number(i.ingredient_id) === Number(ing.id));
        const totalStock = items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
        const totalReserved = items.reduce((s: number, i: any) => s + Number(i.reserved || 0), 0);
        const whCount = items.filter((i: any) => Number(i.quantity || 0) > 0).length;
        return { ...ing, total_stock: totalStock, total_reserved: totalReserved, warehouses_count: whCount };
      });
      if (withStock) {
        joinedRows = joinedRows.filter((r: any) => r.total_stock > 0);
      }
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Warehouse module: inventory_items with ingredients + warehouses JOIN ───
    if (lowerSql.includes("from inventory_items i") && lowerSql.includes("left join ingredients ing on ing.id = i.ingredient_id") && lowerSql.includes("left join warehouses w on w.id = i.warehouse_id")) {
      const invItemsList = dbState["inventory_items"] || [];
      const ingredientsList = dbState["ingredients"] || [];
      const warehousesList = dbState["warehouses"] || [];
      let joinedRows = invItemsList.map((i: any) => {
        const ing = ingredientsList.find((g: any) => Number(g.id) === Number(i.ingredient_id));
        const w = warehousesList.find((wh: any) => Number(wh.id) === Number(i.warehouse_id));
        if (!ing || !w) return null;
        return {
          ...i,
          ingredient_name: ing.name, ingredient_code: ing.code, ingredient_unit: ing.unit,
          barcode: ing.barcode, category: ing.category, min_stock: ing.min_stock, max_stock: ing.max_stock,
          reorder_point: ing.reorder_point, last_purchase_price: ing.last_purchase_price, avg_cost: ing.avg_cost,
          warehouse_name: w.name, warehouse_code: w.code,
        };
      }).filter(Boolean);
      // WHERE filters
      const whMatch = lowerSql.match(/i\.warehouse_id\s*=\s*\$(\d+)/i);
      if (whMatch) {
        const idx = parseInt(whMatch[1]) - 1;
        const wId = Number(params[idx]);
        joinedRows = joinedRows.filter((r: any) => Number(r.warehouse_id) === wId);
      }
      if (lowerSql.includes("ing.min_stock > 0 and i.quantity <= ing.min_stock")) {
        joinedRows = joinedRows.filter((r: any) => Number(r.min_stock) > 0 && Number(r.quantity) <= Number(r.min_stock));
      }
      // ORDER BY ing.name
      joinedRows.sort((a: any, b: any) => (a.ingredient_name || "").localeCompare(b.ingredient_name || "", "ar"));
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Warehouse module: inventory_transactions JOIN warehouse + item count ───
    if (lowerSql.includes("from inventory_transactions t") && lowerSql.includes("left join warehouses w on w.id = t.warehouse_id") && lowerSql.includes("items_count")) {
      const txList = dbState["inventory_transactions"] || [];
      const warehousesList = dbState["warehouses"] || [];
      let joinedRows = txList.map((t: any) => {
        const w = warehousesList.find((wh: any) => Number(wh.id) === Number(t.warehouse_id));
        let items: any[] = [];
        try { items = typeof t.items === "string" ? JSON.parse(t.items) : (t.items || []); } catch { items = []; }
        const itemsCount = items.length;
        const totalValue = items.reduce((s: number, it: any) => s + (Number(it.quantity || 0) * Number(it.price || 0)), 0);
        return {
          ...t, warehouse_name: w?.name || null, warehouse_code: w?.code || null,
          items_count: itemsCount, total_value: totalValue,
        };
      });
      // Filters
      const whMatch = lowerSql.match(/t\.warehouse_id\s*=\s*\$(\d+)/i);
      if (whMatch) {
        const idx = parseInt(whMatch[1]) - 1;
        const wId = Number(params[idx]);
        joinedRows = joinedRows.filter((r: any) => Number(r.warehouse_id) === wId);
      }
      const typeMatch = lowerSql.match(/t\.type\s*=\s*\$(\d+)/i);
      if (typeMatch) {
        const idx = parseInt(typeMatch[1]) - 1;
        const tType = params[idx];
        joinedRows = joinedRows.filter((r: any) => r.type === tType);
      }
      const statusMatch = lowerSql.match(/t\.status\s*=\s*\$(\d+)/i);
      if (statusMatch) {
        const idx = parseInt(statusMatch[1]) - 1;
        const sVal = params[idx];
        joinedRows = joinedRows.filter((r: any) => r.status === sVal);
      }
      const fromDateMatch = lowerSql.match(/t\.date\s*>=\s*\$(\d+)/i);
      if (fromDateMatch) {
        const idx = parseInt(fromDateMatch[1]) - 1;
        const d = params[idx];
        joinedRows = joinedRows.filter((r: any) => (r.date || "") >= d);
      }
      const toDateMatch = lowerSql.match(/t\.date\s*<=\s*\$(\d+)/i);
      if (toDateMatch) {
        const idx = parseInt(toDateMatch[1]) - 1;
        const d = params[idx];
        joinedRows = joinedRows.filter((r: any) => (r.date || "") <= d);
      }
      joinedRows.sort((a: any, b: any) => {
        const dComp = (b.date || "").localeCompare(a.date || "");
        if (dComp !== 0) return dComp;
        return Number(b.id) - Number(a.id);
      });
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Treasury & Custody Module: treasury_custodies JOIN employees + accounts + types ───
    if (lowerSql.includes("from treasury_custodies")) {
      const custodiesList = dbState["treasury_custodies"] || [];
      const employeesList = dbState["employees"] || [];
      const accountsList = dbState["treasury_accounts"] || [];
      const typesList = dbState["treasury_custody_types"] || [];
      const branchesList = dbState["branches"] || [];
      const costCentersList = dbState["cost_centers"] || [];
      const expensesList = dbState["treasury_custody_expenses"] || [];
      const itemsList = dbState["treasury_custody_items"] || [];
      const settlementsList = dbState["treasury_custody_settlements"] || [];

      let joinedRows = custodiesList.map((c: any) => {
        const emp = employeesList.find((e: any) => Number(e.id) === Number(c.employee_id));
        const acc = accountsList.find((a: any) => Number(a.id) === Number(c.account_id));
        const ctype = typesList.find((t: any) => Number(t.id) === Number(c.custody_type_id) || t.category === c.custody_type);
        const branch = branchesList.find((b: any) => Number(b.id) === Number(c.branch_id));
        const cc = costCentersList.find((cntr: any) => Number(cntr.id) === Number(c.cost_center_id));
        
        const cExpenses = expensesList.filter((e: any) => Number(e.custody_id) === Number(c.id));
        const cItems = itemsList.filter((it: any) => Number(it.custody_id) === Number(c.id));
        const cSettlements = settlementsList.filter((s: any) => Number(s.custody_id) === Number(c.id));
        
        const totalExpenses = cExpenses.reduce((sum: number, exp: any) => sum + (parseFloat(exp.amount) || 0), 0);
        const spentAmt = Number(c.spent_amount) > 0 ? Number(c.spent_amount) : totalExpenses;
        const origAmt = parseFloat(c.amount) || 0;
        const remAmt = Math.max(0, origAmt - spentAmt - (parseFloat(c.returned_amount) || 0));
        
        const now = new Date();
        const dueDate = c.due_date ? new Date(c.due_date) : null;
        const isOverdue = Boolean(dueDate && dueDate < now && (c.status === 'active' || c.status === 'issued' || c.status === 'pending_settlement'));
        const overdueDays = isOverdue && dueDate ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;

        return {
          ...c,
          employee_name: emp ? emp.name : (c.employee_name || "موظف"),
          employee_code: emp ? (emp.code || emp.employee_code || `EMP-${emp.id}`) : (c.employee_code || "EMP-000"),
          employee_phone: emp ? (emp.phone || emp.mobile || "") : "",
          employee_department: emp ? (emp.department || emp.department_name || "") : (c.department || ""),
          account_name: acc ? acc.name : (c.account_name || "-"),
          custody_type_name: ctype ? ctype.name_ar : (c.custody_type || "عهدة نقدية"),
          custody_type_code: ctype ? ctype.code : "CUST",
          custody_category: ctype ? ctype.category : (c.custody_type || "cash"),
          branch_name: branch ? branch.name : (c.branch_name || "الفرع الرئيسي"),
          cost_center_name: cc ? cc.name : (c.cost_center_name || "-"),
          expenses_count: cExpenses.length,
          items_count: cItems.length,
          settlements_count: cSettlements.length,
          total_expenses: totalExpenses,
          is_overdue: isOverdue,
          overdue_days: overdueDays,
          calculated_remaining: remAmt
        };
      });

      // Filter by ID if present
      const idMatch = lowerSql.match(/where\s+(?:c\.)?id\s*=\s*\$(\d+)/i) || lowerSql.match(/where\s+(?:c\.)?id\s*=\s*(\d+)/i);
      if (idMatch) {
        const idVal = idMatch[1].startsWith("$") ? Number(params[parseInt(idMatch[1].slice(1)) - 1]) : Number(idMatch[1]);
        joinedRows = joinedRows.filter((r: any) => Number(r.id) === idVal);
      }

      // Filter by status if query specifies
      if (lowerSql.includes("status = 'overdue'") || lowerSql.includes("is_overdue = true")) {
        joinedRows = joinedRows.filter((r: any) => r.is_overdue || r.status === 'overdue');
      }

      joinedRows.sort((a: any, b: any) => (Number(b.id) || 0) - (Number(a.id) || 0));
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Treasury & Financial Transfers Module: treasury_transfers JOIN accounts, branches, types & stats ───
    if (lowerSql.includes("from treasury_transfers") && (lowerSql.includes("count(case when status") || lowerSql.includes("sum(case when") || lowerSql.includes("count(*) as total"))) {
      const trfList = dbState["treasury_transfers"] || [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayList = trfList.filter((r: any) => (r.transfer_date || r.created_at || "").startsWith(todayStr));
      const stats = {
        total_transfers_count: trfList.length,
        today_count: todayList.length,
        today_amount: todayList.reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0),
        draft_count: trfList.filter((r: any) => r.status === "draft").length,
        pending_approval_count: trfList.filter((r: any) => r.status === "pending_approval").length,
        approved_count: trfList.filter((r: any) => r.status === "approved").length,
        executed_in_transit_count: trfList.filter((r: any) => ["executed", "in_transit", "pending_receipt"].includes(r.status)).length,
        pending_receipt_count: trfList.filter((r: any) => r.status === "pending_receipt").length,
        completed_posted_count: trfList.filter((r: any) => ["completed", "posted", "received"].includes(r.status)).length,
        cancelled_count: trfList.filter((r: any) => r.status === "cancelled").length,
        reversed_count: trfList.filter((r: any) => r.status === "reversed").length,
        total_transferred_amount: trfList.filter((r: any) => ["completed", "posted", "received", "executed", "pending_receipt"].includes(r.status)).reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0),
        total_fees_amount: trfList.reduce((s: number, r: any) => s + (parseFloat(r.transfer_fee) || 0), 0)
      };
      return { rows: [stats], rowCount: 1 };
    }

    if (lowerSql.includes("from treasury_transfers")) {
      const trfList = dbState["treasury_transfers"] || [];
      const accountsList = dbState["treasury_accounts"] || [];
      const typesList = dbState["treasury_transfer_types"] || [];
      const branchesList = dbState["branches"] || [];
      const costCentersList = dbState["cost_centers"] || [];
      const usersList = dbState["users"] || [];
      const attList = dbState["treasury_transfer_attachments"] || [];
      const logsList = dbState["treasury_transfer_audit_logs"] || [];

      let joinedRows = trfList.map((t: any) => {
        const srcAcc = accountsList.find((a: any) => Number(a.id) === Number(t.source_account_id));
        const dstAcc = accountsList.find((a: any) => Number(a.id) === Number(t.destination_account_id));
        const tType = typesList.find((tp: any) => Number(tp.id) === Number(t.transfer_type_id) || tp.code === t.transfer_type);
        const srcBranch = branchesList.find((b: any) => Number(b.id) === Number(t.source_branch_id));
        const dstBranch = branchesList.find((b: any) => Number(b.id) === Number(t.destination_branch_id));
        const srcCC = costCentersList.find((c: any) => Number(c.id) === Number(t.source_cost_center_id));
        const dstCC = costCentersList.find((c: any) => Number(c.id) === Number(t.destination_cost_center_id));
        
        const creator = usersList.find((u: any) => Number(u.id) === Number(t.created_by));
        const approver = usersList.find((u: any) => Number(u.id) === Number(t.approved_by));
        const executor = usersList.find((u: any) => Number(u.id) === Number(t.executed_by));
        const receiver = usersList.find((u: any) => Number(u.id) === Number(t.received_by));
        const reverser = usersList.find((u: any) => Number(u.id) === Number(t.reversed_by));

        const attachments = attList.filter((a: any) => Number(a.transfer_id) === Number(t.id));
        const auditLogs = logsList.filter((l: any) => Number(l.transfer_id) === Number(t.id));

        return {
          ...t,
          source_account_name: srcAcc ? srcAcc.name : (t.source_account_name || "خزينة المصدر"),
          source_account_type: srcAcc ? srcAcc.type : "cash",
          source_account_code: srcAcc ? (srcAcc.code || `ACC-${srcAcc.id}`) : "-",
          destination_account_name: dstAcc ? dstAcc.name : (t.destination_account_name || "الخزينة المستهدفة"),
          destination_account_type: dstAcc ? dstAcc.type : "cash",
          destination_account_code: dstAcc ? (dstAcc.code || `ACC-${dstAcc.id}`) : "-",
          transfer_type_name: tType ? tType.name_ar : (t.transfer_type || "تحويل مالي"),
          source_branch_name: srcBranch ? srcBranch.name : (t.source_branch_name || "الفرع الرئيسي"),
          destination_branch_name: dstBranch ? dstBranch.name : (t.destination_branch_name || "الفرع الرئيسي"),
          source_cost_center_name: srcCC ? srcCC.name : (t.source_cost_center_name || "-"),
          destination_cost_center_name: dstCC ? dstCC.name : (t.destination_cost_center_name || "-"),
          created_by_name: creator ? (creator.name || creator.username) : "مدير النظام",
          approved_by_name: approver ? (approver.name || approver.username) : null,
          executed_by_name: executor ? (executor.name || executor.username) : null,
          received_by_name: receiver ? (receiver.name || receiver.username) : null,
          reversed_by_name: reverser ? (reverser.name || reverser.username) : null,
          attachments: attachments,
          audit_logs: auditLogs
        };
      });

      // Filter by ID if query has where t.id = $1
      const idMatch = lowerSql.match(/where\s+(?:t\.)?id\s*=\s*\$(\d+)/i) || lowerSql.match(/where\s+(?:t\.)?id\s*=\s*(\d+)/i);
      if (idMatch) {
        const idVal = idMatch[1].startsWith("$") ? Number(params[parseInt(idMatch[1].slice(1)) - 1]) : Number(idMatch[1]);
        joinedRows = joinedRows.filter((r: any) => Number(r.id) === idVal);
      }

      // Filter by status if specified in query
      const statusParamMatch = lowerSql.match(/status\s*=\s*\$(\d+)/i);
      if (statusParamMatch) {
        const idx = parseInt(statusParamMatch[1]) - 1;
        const sVal = params[idx];
        if (sVal && sVal !== "all") joinedRows = joinedRows.filter((r: any) => r.status === sVal);
      }

      joinedRows.sort((a: any, b: any) => (Number(b.id) || 0) - (Number(a.id) || 0));
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Warehouse module: warehouse_transfers JOIN from/to warehouses & stats ───
    if (lowerSql.includes("from warehouse_transfers") && lowerSql.includes("count(case when status")) {
      const trfList = dbState["warehouse_transfers"] || [];
      const stats = {
        total: trfList.length,
        pending_count: trfList.filter((r: any) => ["draft", "requested", "pending"].includes(r.status)).length,
        approved_count: trfList.filter((r: any) => ["approved", "picking"].includes(r.status)).length,
        in_transit_count: trfList.filter((r: any) => ["in_transit", "dispatched"].includes(r.status)).length,
        receiving_count: trfList.filter((r: any) => ["receiving", "qc_inspection", "received_partially"].includes(r.status)).length,
        completed_count: trfList.filter((r: any) => ["received", "completed"].includes(r.status)).length,
        cancelled_count: trfList.filter((r: any) => ["cancelled", "rejected"].includes(r.status)).length
      };
      return { rows: [stats], rowCount: 1 };
    }

    if (lowerSql.includes("from warehouse_transfers t") && lowerSql.includes("left join warehouses fw") && lowerSql.includes("left join warehouses tw")) {
      const trfList = dbState["warehouse_transfers"] || [];
      const warehousesList = dbState["warehouses"] || [];
      let joinedRows = trfList.map((t: any) => {
        const fw = warehousesList.find((w: any) => Number(w.id) === Number(t.from_warehouse_id));
        const tw = warehousesList.find((w: any) => Number(w.id) === Number(t.to_warehouse_id));
        let items: any[] = [];
        try { items = typeof t.items === "string" ? JSON.parse(t.items) : (t.items || []); } catch { items = []; }
        const itemsCount = items.length;
        const totalQty = items.reduce((s: number, it: any) => s + Number(it.requested_qty || it.quantity || 0), 0);
        const totalValue = items.reduce((s: number, it: any) => s + (Number(it.dispatched_qty || it.quantity || 0) * Number(it.unit_cost || it.price || 0)), 0);
        return {
          ...t,
          from_warehouse_name: fw?.name || null, from_warehouse_code: fw?.code || null,
          to_warehouse_name: tw?.name || null, to_warehouse_code: tw?.code || null,
          items_count: itemsCount, total_qty: totalQty, total_value: totalValue
        };
      });

      // Filter handling
      if (lowerSql.includes("t.status in ('draft', 'requested', 'pending')")) {
        joinedRows = joinedRows.filter((r: any) => ["draft", "requested", "pending"].includes(r.status));
      } else if (lowerSql.includes("t.status in ('approved', 'picking', 'dispatched', 'in_transit')")) {
        joinedRows = joinedRows.filter((r: any) => ["approved", "picking", "dispatched", "in_transit"].includes(r.status));
      } else if (lowerSql.includes("t.status in ('receiving', 'qc_inspection', 'received_partially')")) {
        joinedRows = joinedRows.filter((r: any) => ["receiving", "qc_inspection", "received_partially"].includes(r.status));
      } else if (lowerSql.includes("t.status in ('received', 'completed')")) {
        joinedRows = joinedRows.filter((r: any) => ["received", "completed"].includes(r.status));
      } else if (lowerSql.includes("t.status in ('cancelled', 'rejected')")) {
        joinedRows = joinedRows.filter((r: any) => ["cancelled", "rejected"].includes(r.status));
      }

      const statusMatch = lowerSql.match(/t\.status\s*=\s*\$(\d+)/i);
      if (statusMatch) {
        const idx = parseInt(statusMatch[1]) - 1;
        const sVal = params[idx];
        if (sVal && sVal !== "all") joinedRows = joinedRows.filter((r: any) => r.status === sVal);
      }

      const fromWhMatch = lowerSql.match(/t\.from_warehouse_id\s*=\s*\$(\d+)/i);
      if (fromWhMatch) {
        const idx = parseInt(fromWhMatch[1]) - 1;
        const fwId = Number(params[idx]);
        joinedRows = joinedRows.filter((r: any) => Number(r.from_warehouse_id) === fwId);
      }

      const toWhMatch = lowerSql.match(/t\.to_warehouse_id\s*=\s*\$(\d+)/i);
      if (toWhMatch) {
        const idx = parseInt(toWhMatch[1]) - 1;
        const twId = Number(params[idx]);
        joinedRows = joinedRows.filter((r: any) => Number(r.to_warehouse_id) === twId);
      }

      const searchMatch = lowerSql.match(/ilike\s+\$(\d+)/i);
      if (searchMatch) {
        const idx = parseInt(searchMatch[1]) - 1;
        const searchVal = String(params[idx] || "").replace(/%/g, "").toLowerCase();
        if (searchVal) {
          joinedRows = joinedRows.filter((r: any) =>
            (r.transfer_number || "").toLowerCase().includes(searchVal) ||
            (r.notes || "").toLowerCase().includes(searchVal) ||
            (r.driver_name || "").toLowerCase().includes(searchVal) ||
            (r.from_warehouse_name || "").toLowerCase().includes(searchVal) ||
            (r.to_warehouse_name || "").toLowerCase().includes(searchVal)
          );
        }
      }

      // Check if this is a count query
      if (lowerSql.includes("select count(*)::int as total from (select t.*")) {
        return { rows: [{ total: joinedRows.length }], rowCount: 1 };
      }

      joinedRows.sort((a: any, b: any) => {
        const dComp = (b.date || "").localeCompare(a.date || "");
        if (dComp !== 0) return dComp;
        return Number(b.id) - Number(a.id);
      });

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Source stock for transfers ───
    if (lowerSql.includes("from inventory_items inv") && lowerSql.includes("join ingredients ing on ing.id = inv.ingredient_id") && lowerSql.includes("inv.warehouse_id = $1")) {
      const invList = dbState["inventory_items"] || [];
      const ingList = dbState["ingredients"] || [];
      const whId = Number(params[0]);
      const matched = invList
        .filter((inv: any) => Number(inv.warehouse_id) === whId && Number(inv.quantity || 0) > 0)
        .map((inv: any) => {
          const ing = ingList.find((g: any) => Number(g.id) === Number(inv.ingredient_id)) || {};
          return {
            inventory_item_id: inv.id,
            ingredient_id: inv.ingredient_id,
            ingredient_name: ing.name || "صنف",
            ingredient_code: ing.code || "",
            ingredient_unit: ing.unit || "قطعة",
            ingredient_barcode: ing.barcode || "",
            ingredient_category: ing.category || "",
            avg_cost: ing.avg_cost || 0,
            last_purchase_price: ing.last_purchase_price || 0,
            quantity: inv.quantity || 0,
            reserved: inv.reserved || 0,
            available: inv.available !== undefined ? inv.available : Math.max(0, Number(inv.quantity || 0) - Number(inv.reserved || 0)),
            in_transit: inv.in_transit || 0
          };
        });
      return { rows: matched, rowCount: matched.length };
    }

    // ─── Warehouse module: inventory_movements JOIN ingredient + warehouse ───
    if (lowerSql.includes("from inventory_movements m") && lowerSql.includes("left join ingredients ing on ing.id = m.ingredient_id") && lowerSql.includes("left join warehouses w on w.id = m.warehouse_id")) {
      const movList = dbState["inventory_movements"] || [];
      const ingredientsList = dbState["ingredients"] || [];
      const warehousesList = dbState["warehouses"] || [];
      let joinedRows = movList.map((m: any) => {
        const ing = ingredientsList.find((g: any) => Number(g.id) === Number(m.ingredient_id));
        const w = warehousesList.find((wh: any) => Number(wh.id) === Number(m.warehouse_id));
        return {
          ...m,
          ingredient_name: ing?.name || null, ingredient_code: ing?.code || null, unit: ing?.unit || null,
          warehouse_name: w?.name || null, warehouse_code: w?.code || null,
        };
      });
      const whMatch = lowerSql.match(/m\.warehouse_id\s*=\s*\$(\d+)/i);
      if (whMatch) {
        const idx = parseInt(whMatch[1]) - 1;
        const wId = Number(params[idx]);
        joinedRows = joinedRows.filter((r: any) => Number(r.warehouse_id) === wId);
      }
      const ingMatch = lowerSql.match(/m\.ingredient_id\s*=\s*\$(\d+)/i);
      if (ingMatch) {
        const idx = parseInt(ingMatch[1]) - 1;
        const iId = Number(params[idx]);
        joinedRows = joinedRows.filter((r: any) => Number(r.ingredient_id) === iId);
      }
      const refTypeMatch = lowerSql.match(/m\.ref_type\s*=\s*\$(\d+)/i);
      if (refTypeMatch) {
        const idx = parseInt(refTypeMatch[1]) - 1;
        const v = params[idx];
        joinedRows = joinedRows.filter((r: any) => r.ref_type === v);
      }
      joinedRows.sort((a: any, b: any) => {
        const dComp = (b.created_at || "").localeCompare(a.created_at || "");
        if (dComp !== 0) return dComp;
        return Number(b.id) - Number(a.id);
      });
      const limitMatch = lowerSql.match(/limit\s+\$(\d+)/i);
      if (limitMatch) {
        const idx = parseInt(limitMatch[1]) - 1;
        const lim = Number(params[idx]);
        joinedRows = joinedRows.slice(0, lim);
      }
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Warehouse module: low stock JOIN ───
    if (lowerSql.includes("from inventory_items i") && lowerSql.includes("join ingredients ing on ing.id = i.ingredient_id") && lowerSql.includes("join warehouses w on w.id = i.warehouse_id") && lowerSql.includes("i.quantity <= ing.min_stock")) {
      const invItemsList = dbState["inventory_items"] || [];
      const ingredientsList = dbState["ingredients"] || [];
      const warehousesList = dbState["warehouses"] || [];
      let joinedRows = invItemsList.map((i: any) => {
        const ing = ingredientsList.find((g: any) => Number(g.id) === Number(i.ingredient_id));
        const w = warehousesList.find((wh: any) => Number(wh.id) === Number(i.warehouse_id));
        if (!ing || !w) return null;
        return {
          ...i,
          ingredient_name: ing.name, ingredient_code: ing.code, unit: ing.unit,
          min_stock: ing.min_stock, reorder_point: ing.reorder_point,
          avg_cost: ing.avg_cost, last_purchase_price: ing.last_purchase_price,
          warehouse_name: w.name,
        };
      }).filter(Boolean);
      joinedRows = joinedRows.filter((r: any) => Number(r.min_stock) > 0 && Number(r.quantity) <= Number(r.min_stock));
      joinedRows.sort((a: any, b: any) => {
        const aRatio = Number(a.quantity) / Math.max(1, Number(a.min_stock));
        const bRatio = Number(b.quantity) / Math.max(1, Number(b.min_stock));
        return aRatio - bRatio;
      });
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Warehouse module: valuation JOIN ───
    if (lowerSql.includes("from inventory_items i") && lowerSql.includes("join ingredients ing on ing.id = i.ingredient_id") && lowerSql.includes("join warehouses w on w.id = i.warehouse_id") && lowerSql.includes("total_value")) {
      const invItemsList = dbState["inventory_items"] || [];
      const ingredientsList = dbState["ingredients"] || [];
      const warehousesList = dbState["warehouses"] || [];
      let joinedRows = invItemsList.map((i: any) => {
        const ing = ingredientsList.find((g: any) => Number(g.id) === Number(i.ingredient_id));
        const w = warehousesList.find((wh: any) => Number(wh.id) === Number(i.warehouse_id));
        if (!ing || !w) return null;
        const qty = Number(i.quantity) || 0;
        const avgCost = Number(ing.avg_cost) || 0;
        return {
          warehouse_id: w.id, warehouse_name: w.name, warehouse_code: w.code,
          ingredient_id: ing.id, name: ing.name, code: ing.code, unit: ing.unit,
          quantity: qty, avg_cost: avgCost, last_purchase_price: ing.last_purchase_price || 0,
          total_value: qty * avgCost,
        };
      }).filter(Boolean);
      joinedRows = joinedRows.filter((r: any) => Number(r.quantity) > 0);
      joinedRows.sort((a: any, b: any) => {
        const wComp = (a.warehouse_name || "").localeCompare(b.warehouse_name || "", "ar");
        if (wComp !== 0) return wComp;
        return (a.name || "").localeCompare(b.name || "", "ar");
      });
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Warehouse module: ABC analysis (LEFT JOIN + GROUP BY ingredients) ───
    if (lowerSql.includes("from ingredients ing") && lowerSql.includes("left join inventory_items i on i.ingredient_id = ing.id") && lowerSql.includes("group by ing.id")) {
      const ingredientsList = dbState["ingredients"] || [];
      const invItemsList = dbState["inventory_items"] || [];
      let joinedRows = ingredientsList.map((ing: any) => {
        const items = invItemsList.filter((i: any) => Number(i.ingredient_id) === Number(ing.id));
        const qty = items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
        const value = qty * (Number(ing.avg_cost) || 0);
        return {
          id: ing.id, name: ing.name, code: ing.code, unit: ing.unit, avg_cost: ing.avg_cost,
          qty, value,
        };
      });
      joinedRows.sort((a: any, b: any) => Number(b.value) - Number(a.value));
      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // ─── Warehouse module: top items by value (GROUP BY + SUM) ───
    if (lowerSql.includes("from inventory_items i") && lowerSql.includes("join ingredients ing on ing.id = i.ingredient_id") && lowerSql.includes("group by ing.name, ing.code, ing.unit") && lowerSql.includes("limit 5")) {
      const invItemsList = dbState["inventory_items"] || [];
      const ingredientsList = dbState["ingredients"] || [];
      const grouped = new Map<string, any>();
      for (const i of invItemsList) {
        const ing = ingredientsList.find((g: any) => Number(g.id) === Number(i.ingredient_id));
        if (!ing) continue;
        const key = `${ing.name}|||${ing.code}|||${ing.unit}`;
        if (!grouped.has(key)) {
          grouped.set(key, { name: ing.name, code: ing.code, unit: ing.unit, qty: 0, value: 0 });
        }
        const entry = grouped.get(key);
        entry.qty += Number(i.quantity || 0);
        entry.value += Number(i.quantity || 0) * Number(ing.avg_cost || 0);
      }
      let rows = Array.from(grouped.values());
      rows.sort((a: any, b: any) => Number(b.value) - Number(a.value));
      rows = rows.slice(0, 5);
      return { rows, rowCount: rows.length };
    }

    // ─── Warehouse module: stock value by warehouse ───
    if (lowerSql.includes("from warehouses w") && lowerSql.includes("left join inventory_items i on i.warehouse_id = w.id") && lowerSql.includes("left join ingredients ing on ing.id = i.ingredient_id") && lowerSql.includes("group by w.name")) {
      const warehousesList = dbState["warehouses"] || [];
      const invItemsList = dbState["inventory_items"] || [];
      const ingredientsList = dbState["ingredients"] || [];
      let rows = warehousesList.map((w: any) => {
        const items = invItemsList.filter((i: any) => Number(i.warehouse_id) === Number(w.id));
        const value = items.reduce((s: number, i: any) => {
          const ing = ingredientsList.find((g: any) => Number(g.id) === Number(i.ingredient_id));
          return s + (Number(i.quantity || 0) * Number(ing?.avg_cost || 0));
        }, 0);
        return { name: w.name, value, items_count: items.length };
      });
      rows.sort((a: any, b: any) => Number(b.value) - Number(a.value));
      return { rows, rowCount: rows.length };
    }

    // ─── Warehouse module: movements trend (generate_series) ───
    if (lowerSql.includes("generate_series") && lowerSql.includes("current_date - interval '6 days'")) {
      const movList = dbState["inventory_movements"] || [];
      const txList = dbState["inventory_transactions"] || [];
      const today = new Date();
      const rows = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dStr = d.toISOString().split("T")[0];
        const movCount = movList.filter((m: any) => (m.created_at || "").startsWith(dStr)).length;
        const txCount = txList.filter((t: any) => (t.date || "").startsWith(dStr)).length;
        rows.push({ date: dStr, movements: movCount, transactions: txCount });
      }
      return { rows, rowCount: rows.length };
    }

    // ─── Warehouse module: suppliers with stats ───
    if (lowerSql.includes("from suppliers s") && lowerSql.includes("tx_count") && lowerSql.includes("total_purchases")) {
      const suppliersList = dbState["suppliers"] || [];
      const txList = dbState["inventory_transactions"] || [];
      const rows = suppliersList.map((s: any) => {
        const txs = txList.filter((t: any) => Number(t.supplier_id) === Number(s.id));
        let totalPurchases = 0;
        for (const t of txs) {
          if (t.type !== "receive") continue;
          let items: any[] = [];
          try { items = typeof t.items === "string" ? JSON.parse(t.items) : (t.items || []); } catch { items = []; }
          totalPurchases += items.reduce((sum: number, it: any) => sum + (Number(it.quantity || 0) * Number(it.price || 0)), 0);
        }
        return { ...s, tx_count: txs.length, total_purchases: totalPurchases };
      });
      return { rows, rowCount: rows.length };
    }

    // Intercept purchases join query
    if (lowerSql.includes("from purchases p") && lowerSql.includes("join suppliers s")) {
      const purchasesList = dbState["purchases"] || [];
      const suppliersList = dbState["suppliers"] || [];
      const warehousesList = dbState["warehouses"] || [];
      const purchaseItemsList = dbState["purchase_items"] || [];
      const ingredientsList = dbState["ingredients"] || [];

      let joinedRows = purchasesList.map((p) => {
        const s = suppliersList.find((sup) => Number(sup.id) === Number(p.supplier_id));
        const w = warehousesList.find((wh) => Number(wh.id) === Number(p.warehouse_id));
        
        const pItems = purchaseItemsList.filter((pi) => Number(pi.purchase_id) === Number(p.id));
        const itemNames = pItems.map((pi) => {
           const ing = ingredientsList.find((i) => Number(i.id) === Number(pi.ingredient_id));
           return ing ? ing.name : '';
        }).filter(Boolean).join(" - ");

        return {
          ...p,
          supplier_name: s ? s.name : "غير محدد",
          warehouse_name: w ? w.name : "غير محدد",
          item_names: itemNames,
          date: p.date || new Date().toISOString(),
        };
      });
      
      joinedRows.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      // Optional id filter
      const idMatch = lowerSql.match(/p\.id\s*=\s*\$(\d+)/i);
      if (idMatch) {
        const pIdx = parseInt(idMatch[1]) - 1;
        joinedRows = joinedRows.filter(r => Number(r.id) === Number(params[pIdx]));
      }

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept purchase_orders queries
    if (lowerSql.includes("from purchase_orders")) {
      const ordersList = dbState["purchase_orders"] || [];
      const suppliersList = dbState["suppliers"] || [];

      let joinedRows = ordersList.map((o) => {
        const s = suppliersList.find((sup) => Number(sup.id) === Number(o.supplier_id));
        return {
          ...o,
          supplier_name: s ? s.name : "غير محدد",
          date: o.date || new Date().toISOString(),
        };
      });

      joinedRows.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      // Optional id filter (details query)
      const poIdMatch = lowerSql.match(/po\.id\s*=\s*\$(\d+)/i) || lowerSql.match(/po\.id\s*=\s*(\d+)/i);
      if (poIdMatch) {
        const idMatchVal = poIdMatch[1];
        const isParamRef = idMatchVal.startsWith("$") || !isNaN(Number(idMatchVal));
        const targetId = idMatchVal.startsWith("$") 
          ? Number(params[parseInt(idMatchVal.substring(1)) - 1])
          : Number(idMatchVal);
        joinedRows = joinedRows.filter(r => Number(r.id) === targetId);
      }

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept payroll attendance aggregate query (no JOIN, uses GROUP BY)
    // Query: SELECT employee_id, COUNT(*) as days_attended, SUM(work_hours) as total_hours, json_agg(...) as records FROM attendance WHERE date::text LIKE $1 AND status = 'present' GROUP BY employee_id
    if (lowerSql.includes("from attendance") && lowerSql.includes("group by employee_id") && !lowerSql.includes("join employees")) {
      const attList = dbState["attendance"] || [];
      const pattern = params[0] as string;
      const regexStr = pattern.replace(/%/g, ".*");
      const regex = new RegExp(`^${regexStr}$`, "i");

      // Filter by date pattern
      const filtered = attList.filter((r: any) => {
        const dateMatch = regex.test(String(r.date || ""));
        return dateMatch;
      });

      // Group by employee_id and date
      const empMap = new Map<number, Map<string, any>>();
      for (const rec of filtered) {
        const empId = Number(rec.employee_id);
        const dStr = String(rec.date || "").split("T")[0].split(" ")[0];
        if (!empMap.has(empId)) empMap.set(empId, new Map<string, any>());
        const dateMap = empMap.get(empId)!;

        const times = [rec.check_in, rec.check_out, rec.punch_time].filter(Boolean).map(t => String(t).trim());

        if (!dateMap.has(dStr)) {
          dateMap.set(dStr, {
            date: dStr,
            check_in: rec.check_in || undefined,
            check_out: rec.check_out || undefined,
            work_hours: Number(rec.work_hours) || 0,
            times: times
          });
        } else {
          const existing = dateMap.get(dStr);
          existing.times.push(...times);
          if (Number(rec.work_hours) > existing.work_hours) {
            existing.work_hours = Number(rec.work_hours);
          }
        }
      }

      const rows = [];
      for (const [empId, dateMap] of empMap.entries()) {
        const records = [];
        let totalHours = 0;

        for (const [dStr, dayObj] of dateMap.entries()) {
          const uniqueTimes = Array.from(new Set(dayObj.times)).filter(Boolean);
          if (uniqueTimes.length > 0) {
            uniqueTimes.sort((a, b) => new Date(a as any).getTime() - new Date(b as any).getTime());
            const earliest = uniqueTimes[0];
            const latest = uniqueTimes[uniqueTimes.length - 1];
            dayObj.check_in = earliest;
            if (new Date(latest as any).getTime() > new Date(earliest as any).getTime()) {
              dayObj.check_out = latest;
              const diffHours = (new Date(latest as any).getTime() - new Date(earliest as any).getTime()) / 3600000;
              dayObj.work_hours = Math.round(diffHours * 100) / 100;
            }
          }
          delete dayObj.times;
          records.push(dayObj);
          totalHours += dayObj.work_hours || 0;
        }

        rows.push({
          employee_id: empId,
          days_attended: records.length,
          days: records.length,
          total_hours: totalHours,
          records: records
        });
      }

      return { rows, rowCount: rows.length };
    }

    // Intercept attendance JOIN employees query (used by /api/attendance endpoint)
    // MUST come before the shift subquery interceptor because the attendance SQL
    // contains an inline COALESCE((SELECT ... FROM employee_shifts es JOIN hr_shifts s ...)) subquery.
    if (lowerSql.includes("from attendance a") && lowerSql.includes("join employees e")) {
      const attendanceList = dbState["attendance"] || [];
      const employeesList = dbState["employees"] || [];
      const deptsList = dbState["hr_departments"] || [];
      const branchesList = dbState["branches"] || [];
      const shiftsList = dbState["hr_shifts"] || dbState["employee_shifts"] || [];
      const empShiftsList = dbState["employee_shifts"] || [];

      let joinedRows = attendanceList.map((a: any) => {
        const emp = employeesList.find((e: any) => Number(e.id) === Number(a.employee_id) || (e.fingerprint_code && String(e.fingerprint_code) === String(a.employee_id)));
        const dept = deptsList.find((d: any) => Number(d.id) === Number(emp?.department_id || a.department_id));
        const branch = branchesList.find((b: any) => Number(b.id) === Number(emp?.branch_id || a.branch_id));
        // Find the employee's shift
        const empShift = empShiftsList.find((es: any) => Number(es.employee_id) === Number(a.employee_id) || Number(es.employee_id) === Number(emp?.id));
        const shift = shiftsList.find((s: any) => Number(s.id) === Number(empShift?.shift_id || a.shift_id));
        // Calculate total_hours from start_time/end_time if missing
        let shift_total_hours = shift?.total_hours;
        if (shift_total_hours === undefined && shift?.start_time && shift?.end_time) {
          const [sh, sm] = String(shift.start_time).split(":").map(Number);
          const [eh, em] = String(shift.end_time).split(":").map(Number);
          let diff = (eh * 60 + em) - (sh * 60 + sm);
          if (diff < 0) diff += 24 * 60; // overnight
          shift_total_hours = diff / 60;
        }
        return {
          ...a,
          employee_name: emp?.name || a.employee_name || "موظف مجهول",
          fingerprint_code: emp?.fingerprint_code || a.fingerprint_code || "",
          department_id: emp?.department_id ?? a.department_id ?? null,
          branch_id: emp?.branch_id ?? a.branch_id ?? null,
          department_name: dept?.name || a.department_name || "—",
          branch_name: branch?.name || a.branch_name || "—",
          basic_salary: emp?.basic_salary || emp?.salary || 0,
          work_days: emp?.work_days || 0,
          exempt_from_penalties: emp?.exempt_from_penalties || false,
          shift_name: shift?.name || a.shift_name || "بصمة مجهولة",
          shift_total_hours,
        };
      });

      // Apply WHERE filters (year/month/branch)
      const yearMonthMatch = lowerSql.match(/a\.date::text\s+like\s+\$(\d+)/i) || lowerSql.match(/a\.date\s+like\s+\$(\d+)/i);
      if (yearMonthMatch) {
        const pIdx = parseInt(yearMonthMatch[1]) - 1;
        const pattern = params[pIdx] as string;
        const regexStr = pattern.replace(/%/g, ".*");
        const regex = new RegExp(`^${regexStr}$`, "i");
        joinedRows = joinedRows.filter(r => regex.test(String(r.date || "")));
      }
      const sdMatch = lowerSql.match(/a\.date\s*>=\s*\$(\d+)/i);
      const edMatch = lowerSql.match(/a\.date\s*<=\s*\$(\d+)/i);
      if (sdMatch) {
        const v = params[parseInt(sdMatch[1]) - 1];
        joinedRows = joinedRows.filter(r => String(r.date || "") >= String(v));
      }
      if (edMatch) {
        const v = params[parseInt(edMatch[1]) - 1];
        joinedRows = joinedRows.filter(r => String(r.date || "") <= String(v));
      }
      const branchMatch = lowerSql.match(/e\.branch_id\s*=\s*\$(\d+)/i);
      if (branchMatch) {
        const v = params[parseInt(branchMatch[1]) - 1];
        joinedRows = joinedRows.filter(r => Number(r.branch_id) === Number(v));
      }

      // ORDER BY a.date DESC, a.check_in DESC
      joinedRows.sort((a: any, b: any) => {
        const d1 = String(a.date || "");
        const d2 = String(b.date || "");
        if (d1 !== d2) return d1 < d2 ? 1 : -1;
        const t1 = String(a.check_in || "");
        const t2 = String(b.check_in || "");
        return t1 < t2 ? 1 : t1 > t2 ? -1 : 0;
      });

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept payroll_deductions JOIN employees query (used by /api/payroll/deductions endpoint)
    if (lowerSql.includes("from payroll_deductions d") && lowerSql.includes("join employees e")) {
      const deductionsList = dbState["payroll_deductions"] || [];
      const employeesList = dbState["employees"] || [];

      let joinedRows = deductionsList.map((d: any) => {
        const emp = employeesList.find((e: any) => Number(e.id) === Number(d.employee_id));
        return {
          ...d,
          employee_name: emp?.name || "موظف مجهول",
          fingerprint_code: emp?.fingerprint_code || "",
          basic_salary: emp?.basic_salary || emp?.salary || 0,
          department_id: emp?.department_id || null,
        };
      });

      // Apply WHERE filters (year/month, employee_id, type IN (...))
      const yearMonthMatch = lowerSql.match(/d\.date::text\s+like\s+\$(\d+)/i) || lowerSql.match(/d\.date\s+like\s+\$(\d+)/i);
      if (yearMonthMatch) {
        const pIdx = parseInt(yearMonthMatch[1]) - 1;
        const pattern = params[pIdx] as string;
        const regexStr = pattern.replace(/%/g, ".*");
        const regex = new RegExp(`^${regexStr}$`, "i");
        joinedRows = joinedRows.filter(r => regex.test(String(r.date || "")));
      }
      const empIdMatch = lowerSql.match(/d\.employee_id\s*=\s*\$(\d+)/i);
      if (empIdMatch) {
        const v = params[parseInt(empIdMatch[1]) - 1];
        joinedRows = joinedRows.filter(r => Number(r.employee_id) === Number(v));
      }
      // type = 'penalty' OR type = 'delay' OR ... → filter by type if present
      const typeOrMatch = lowerSql.match(/d\.type\s*=\s*'([^']+)'/g);
      if (typeOrMatch) {
        const allowedTypes = typeOrMatch.map((m: string) => m.match(/'([^']+)'/)?.[1]).filter(Boolean);
        joinedRows = joinedRows.filter(r => allowedTypes.includes(r.type));
      }

      // If the query has GROUP BY, aggregate (used by /api/payroll/deductions totals query)
      if (lowerSql.includes("group by")) {
        const groupCols = ["employee_id", "employee_name"];
        const groupedMap = new Map<string, any>();
        for (const row of joinedRows) {
          const key = groupCols.map(c => String(row[c])).join("|||");
          if (!groupedMap.has(key)) {
            groupedMap.set(key, { employee_id: row.employee_id, employee_name: row.employee_name, penalty_count: 0, total_amount: 0 });
          }
          const g = groupedMap.get(key);
          g.penalty_count += 1;
          g.total_amount += Number(row.amount) || 0;
        }
        return { rows: Array.from(groupedMap.values()), rowCount: groupedMap.size };
      }

      // ORDER BY d.date DESC
      joinedRows.sort((a: any, b: any) => {
        const d1 = String(a.date || "");
        const d2 = String(b.date || "");
        return d1 < d2 ? 1 : d1 > d2 ? -1 : 0;
      });

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept employee_custody JOIN employees query (used by /api/hr/custody endpoint)
    if (lowerSql.includes("from employee_custody c") && lowerSql.includes("join employees e")) {
      const custodyList = dbState["employee_custody"] || [];
      const employeesList = dbState["employees"] || [];
      const departmentsList = dbState["hr_departments"] || [];

      let joinedRows = custodyList.map((c: any) => {
        const emp = employeesList.find((e: any) => Number(e.id) === Number(c.employee_id));
        const dept = emp ? departmentsList.find((d: any) => Number(d.id) === Number(emp.department_id)) : null;
        return {
          ...c,
          employee_name: emp?.name || "موظف مجهول",
          department_name: dept?.name || null,
        };
      });

      // Optional employee_id filter
      const empIdMatch = lowerSql.match(/c\.employee_id\s*=\s*\$(\d+)/i) || lowerSql.match(/employee_id\s*=\s*\$(\d+)/i);
      if (empIdMatch) {
        const v = params[parseInt(empIdMatch[1]) - 1];
        joinedRows = joinedRows.filter(r => Number(r.employee_id) === Number(v));
      }

      // ORDER BY c.id DESC
      joinedRows.sort((a: any, b: any) => Number(b.id) - Number(a.id));

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept hr_departments query with employee_count subquery
    // Query: SELECT d.*, (SELECT COUNT(*) FROM employees WHERE department_id = d.id) as employee_count FROM hr_departments d
    if (lowerSql.includes("from hr_departments d") && lowerSql.includes("select count(*)")) {
      const deptsList = dbState["hr_departments"] || [];
      const employeesList = dbState["employees"] || [];

      const rows = deptsList.map((d: any) => {
        const employee_count = employeesList.filter((e: any) => Number(e.department_id) === Number(d.id)).length;
        return { ...d, employee_count };
      });

      return { rows, rowCount: rows.length };
    }

    // Intercept hr_employee_documents JOIN employees query
    // The original query uses CASE WHEN and INTERVAL which the offline DB can't parse,
    // so we replicate the logic in JS.
    if (lowerSql.includes("from hr_employee_documents doc") && lowerSql.includes("join employees e")) {
      const docsList = dbState["hr_employee_documents"] || [];
      const employeesList = dbState["employees"] || [];
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      let rows = docsList.map((doc: any) => {
        const emp = employeesList.find((e: any) => Number(e.id) === Number(doc.employee_id));
        // Compute status based on expiry_date
        let status = doc.status || "valid";
        if (doc.expiry_date) {
          const exp = new Date(doc.expiry_date);
          if (exp < now) status = "expired";
          else if (exp <= thirtyDaysLater) status = "pending";
        }
        return {
          ...doc,
          employee_name: emp?.name || "موظف مجهول",
          job_title: emp?.job_title || null,
          status,
        };
      });

      // Apply employee_id filter if present
      const empIdMatch = lowerSql.match(/doc\.employee_id\s*=\s*\$(\d+)/i);
      if (empIdMatch) {
        const v = params[parseInt(empIdMatch[1]) - 1];
        rows = rows.filter(r => Number(r.employee_id) === Number(v));
      }

      return { rows, rowCount: rows.length };
    }

    // Intercept standalone shift subquery
    if (
      !lowerSql.includes("from attendance") &&
      lowerSql.includes("from employee_shifts es") &&
      lowerSql.includes("join hr_shifts s")
    ) {
      const empShiftsList = dbState["employee_shifts"] || [];
      const shiftsList = dbState["hr_shifts"] || [];
      const empIdMatch = lowerSql.match(/es\.employee_id\s*=\s*\$(\d+)/i);
      let rows: any[] = [];
      if (empIdMatch) {
        const empId = Number(params[parseInt(empIdMatch[1]) - 1]);
        const es = empShiftsList.find((x: any) => Number(x.employee_id) === empId);
        if (es) {
          const s = shiftsList.find((sh: any) => Number(sh.id) === Number(es.shift_id));
          if (s) {
            let total_hours = s.total_hours;
            if (total_hours === undefined && s.start_time && s.end_time) {
              const [sh, sm] = String(s.start_time).split(":").map(Number);
              const [eh, em] = String(s.end_time).split(":").map(Number);
              let diff = (eh * 60 + em) - (sh * 60 + sm);
              if (diff < 0) diff += 24 * 60;
              total_hours = diff / 60;
            }
            rows = [{ total_hours, ...s }];
          }
        }
      }
      return { rows, rowCount: rows.length };
    }

    // Intercept purchase_order_items queries
    if (lowerSql.includes("from purchase_order_items")) {
      const orderItemsList = dbState["purchase_order_items"] || [];
      const ingredientsList = dbState["ingredients"] || [];
      const productsList = dbState["products"] || [];

      let joinedRows = orderItemsList.map((poi) => {
        let name = "صنف غير معروف";
        let unit = "قطعة";
        let item_code = "-";
        
        const ingIdStr = String(poi.ingredient_id);
        if (ingIdStr.startsWith("p_")) {
          const prodId = Number(ingIdStr.replace("p_", ""));
          const prod = productsList.find((p) => Number(p.id) === prodId);
          if (prod) {
            name = prod.name;
            item_code = prod.barcode || "-";
          }
        } else {
          const ing = ingredientsList.find((i) => Number(i.id) === Number(poi.ingredient_id));
          if (ing) {
            name = ing.name;
            unit = ing.unit;
            item_code = ing.item_code || "-";
          }
        }

        return {
          ...poi,
          ingredient_name: name,
          unit,
          item_code
        };
      });

      // Optional purchase_order_id filter
      const poIdMatch = lowerSql.match(/purchase_order_id\s*=\s*\$(\d+)/i) || lowerSql.match(/purchase_order_id\s*=\s*(\d+)/i);
      if (poIdMatch) {
        const idMatchVal = poIdMatch[1];
        const targetId = idMatchVal.startsWith("$")
          ? Number(params[parseInt(idMatchVal.substring(1)) - 1])
          : Number(idMatchVal);
        joinedRows = joinedRows.filter(r => Number(r.purchase_order_id) === targetId);
      }

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept purchase_requests queries
    if (lowerSql.includes("from purchase_requests")) {
      const requestsList = dbState["purchase_requests"] || [];
      const requestItemsList = dbState["purchase_request_items"] || [];

      let joinedRows = requestsList.map((pr) => {
        const items = requestItemsList.filter((ri) => Number(ri.purchase_request_id) === Number(pr.id));
        return {
          ...pr,
          items_count: items.length,
          date: pr.date || new Date().toISOString(),
        };
      });

      joinedRows.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      // Optional id filter
      const prIdMatch = lowerSql.match(/id\s*=\s*\$(\d+)/i) || lowerSql.match(/id\s*=\s*(\d+)/i);
      if (prIdMatch) {
        const idMatchVal = prIdMatch[1];
        const targetId = idMatchVal.startsWith("$")
          ? Number(params[parseInt(idMatchVal.substring(1)) - 1])
          : Number(idMatchVal);
        joinedRows = joinedRows.filter(r => Number(r.id) === targetId);
      }

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept purchase_request_items queries
    if (lowerSql.includes("from purchase_request_items")) {
      const requestItemsList = dbState["purchase_request_items"] || [];
      const ingredientsList = dbState["ingredients"] || [];
      const productsList = dbState["products"] || [];

      let joinedRows = requestItemsList.map((pri) => {
        let name = pri.name || "صنف غير معروف";
        let unit = pri.unit || "قطعة";
        let item_code = "-";
        
        const ingIdStr = String(pri.ingredient_id);
        if (ingIdStr.startsWith("p_")) {
          const prodId = Number(ingIdStr.replace("p_", ""));
          const prod = productsList.find((p) => Number(p.id) === prodId);
          if (prod) {
            name = prod.name;
            item_code = prod.barcode || "-";
          }
        } else {
          const ing = ingredientsList.find((i) => Number(i.id) === Number(pri.ingredient_id));
          if (ing) {
            name = ing.name;
            unit = ing.unit;
            item_code = ing.item_code || "-";
          }
        }

        return {
          ...pri,
          ingredient_name: name,
          unit,
          item_code
        };
      });

      // Optional purchase_request_id filter
      const prIdMatch = lowerSql.match(/purchase_request_id\s*=\s*\$(\d+)/i) || lowerSql.match(/purchase_request_id\s*=\s*(\d+)/i);
      if (prIdMatch) {
        const idMatchVal = prIdMatch[1];
        const targetId = idMatchVal.startsWith("$")
          ? Number(params[parseInt(idMatchVal.substring(1)) - 1])
          : Number(idMatchVal);
        joinedRows = joinedRows.filter(r => Number(r.purchase_request_id) === targetId);
      }

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept operating_costs queries to resolve cost center and cost item names
    if (lowerSql.includes("from operating_costs")) {
      const costsList = dbState["operating_costs"] || [];
      const centersList = dbState["cost_centers"] || [];
      const itemsList = dbState["cost_items"] || [];

      let joinedRows = costsList.map((oc) => {
        const cc = centersList.find((c) => Number(c.id) === Number(oc.cost_center_id));
        const ci = itemsList.find((i) => Number(i.id) === Number(oc.cost_item_id));
        return {
          ...oc,
          cost_center_name: cc ? cc.name : "غير محدد",
          cost_item_name: ci ? ci.name : "غير محدد",
          cost_type: ci ? ci.cost_type : "غير محدد",
          date: oc.date || new Date().toISOString()
        };
      });

      // Filter by ID if requested
      const idMatch = lowerSql.match(/id\s*=\s*\$(\d+)/i) || lowerSql.match(/id\s*=\s*(\d+)/i);
      if (idMatch) {
        const idMatchVal = idMatch[1];
        const targetId = idMatchVal.startsWith("$")
          ? Number(params[parseInt(idMatchVal.substring(1)) - 1])
          : Number(idMatchVal);
        joinedRows = joinedRows.filter(r => Number(r.id) === targetId);
      }

      // Sort by date DESC
      joinedRows.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept cost_centers queries to aggregate total costs
    if (lowerSql.includes("from cost_centers")) {
      const centersList = dbState["cost_centers"] || [];
      const costsList = dbState["operating_costs"] || [];

      let joinedRows = centersList.map((cc) => {
        const total = costsList
          .filter((oc) => Number(oc.cost_center_id) === Number(cc.id))
          .reduce((sum, oc) => sum + Number(oc.amount || 0), 0);
        return {
          ...cc,
          total_cost: total
        };
      });

      // Filter by ID if requested
      const idMatch = lowerSql.match(/id\s*=\s*\$(\d+)/i) || lowerSql.match(/id\s*=\s*(\d+)/i);
      if (idMatch) {
        const idMatchVal = idMatch[1];
        const targetId = idMatchVal.startsWith("$")
          ? Number(params[parseInt(idMatchVal.substring(1)) - 1])
          : Number(idMatchVal);
        joinedRows = joinedRows.filter(r => Number(r.id) === targetId);
      }

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept cost_items queries
    if (lowerSql.includes("from cost_items")) {
      let joinedRows = dbState["cost_items"] || [];

      // Filter by ID if requested
      const idMatch = lowerSql.match(/id\s*=\s*\$(\d+)/i) || lowerSql.match(/id\s*=\s*(\d+)/i);
      if (idMatch) {
        const idMatchVal = idMatch[1];
        const targetId = idMatchVal.startsWith("$")
          ? Number(params[parseInt(idMatchVal.substring(1)) - 1])
          : Number(idMatchVal);
        joinedRows = joinedRows.filter(r => Number(r.id) === targetId);
      }

      return { rows: joinedRows, rowCount: joinedRows.length };
    }

    // Intercept hr_job_postings with application counts
    if (lowerSql.includes("from hr_job_postings") && lowerSql.includes("applications_count")) {
      const jpList = dbState["hr_job_postings"] || [];
      const appsList = dbState["hr_job_applications"] || [];
      
      let rows = jpList.map((jp: any) => {
        const apps = appsList.filter((a: any) => Number(a.job_posting_id) === Number(jp.id));
        return {
          ...jp,
          applications_count: apps.length,
          rejected_count: apps.filter((a: any) => a.status === 'rejected').length,
          hired_count: apps.filter((a: any) => a.status === 'hired').length
        };
      });
      
      rows.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      return { rows, rowCount: rows.length };
    }

    // Determine the table name
    // Match "from table_name"
    const fromMatch = normalizedSql.match(/from\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch) {
      // Could be SELECT 1 or SELECT expression
      if (lowerSql.includes("select count(*)")) {
        return { rows: [{ count: 0 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    let tableName = fromMatch[1];
    if (tableName === "attendances") {
      tableName = "attendance";
    }
    let data = dbState[tableName] || [];

    // Ensure ingredient names and auto-generated codes exist when directly querying ingredients
    if (tableName === "ingredients") {
      data = data.map((ing) => ({
        ...ing,
        ingredient_name: ing.name, // alias support
        item_code: ing.item_code || `ITEM-${1000 + ing.id}`,
      }));
    }

    // Check if SELECT COUNT
    const isCount = lowerSql.startsWith("select count");

    // WHERE clause
    const whereMatch = normalizedSql.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|\s+offset|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      data = filterData(data, whereClause, params);
    }

    // GROUP BY - aggregate rows by the specified columns, applying SUM() to other selected columns
    // Supports: SELECT col1, col2, SUM(col3) as alias FROM ... GROUP BY col1, col2
    const groupByMatch = normalizedSql.match(/group\s+by\s+([a-zA-Z0-9_,\s]+?)(?:\s+order\s+by|\s+limit|\s+offset|$)/i);
    if (groupByMatch) {
      const groupCols = groupByMatch[1].split(",").map((c: string) => c.trim());
      // Parse the SELECT clause to find SUM(col) aggregates
      const selectPart = normalizedSql.match(/select\s+(.+?)\s+from/i)?.[1] || "";
      const aggregates: { col: string; alias: string; fn: string }[] = [];
      const aggRegex = /(\w+)\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*(?:as\s+([a-zA-Z0-9_]+))?/gi;
      let aggMatch;
      while ((aggMatch = aggRegex.exec(selectPart)) !== null) {
        const fn = aggMatch[1].toLowerCase();
        if (fn === "sum" || fn === "count" || fn === "avg" || fn === "max" || fn === "min") {
          aggregates.push({ fn, col: aggMatch[2], alias: aggMatch[3] || aggMatch[2] });
        }
      }

      // Group the data
      const groupedMap = new Map<string, any>();
      for (const row of data) {
        const key = groupCols.map((c: string) => String(row[c])).join("|||");
        if (!groupedMap.has(key)) {
          const grouped: any = {};
          groupCols.forEach((c: string) => { grouped[c] = row[c]; });
          aggregates.forEach(a => {
            grouped[a.alias] = 0;
            (grouped as any).__count = 0;
          });
          groupedMap.set(key, grouped);
        }
        const g = groupedMap.get(key);
        aggregates.forEach(a => {
          const val = Number(row[a.col]) || 0;
          if (a.fn === "sum") g[a.alias] = (g[a.alias] || 0) + val;
          else if (a.fn === "count") g[a.alias] = (g[a.alias] || 0) + 1;
          else if (a.fn === "avg") g[a.alias] = (g[a.alias] || 0) + val;
          else if (a.fn === "max") g[a.alias] = Math.max(g[a.alias] || -Infinity, val);
          else if (a.fn === "min") g[a.alias] = Math.min(g[a.alias] || Infinity, val);
        });
        g.__count = (g.__count || 0) + 1;
      }
      // Finalize averages
      if (aggregates.some(a => a.fn === "avg")) {
        for (const g of groupedMap.values()) {
          aggregates.filter(a => a.fn === "avg").forEach(a => {
            g[a.alias] = g.__count > 0 ? g[a.alias] / g.__count : 0;
          });
        }
      }
      data = Array.from(groupedMap.values()).map((g: any) => {
        const { __count, ...rest } = g;
        return rest;
      });
    }

    // ORDER BY
    const orderByMatch = normalizedSql.match(/order\s+by\s+([a-zA-Z0-9_]+)(?:\s+(asc|desc))?/i);
    if (orderByMatch) {
      const col = orderByMatch[1];
      const dir = (orderByMatch[2] || "asc").toLowerCase();
      data = [...data].sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        if (valA === valB) return 0;
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        if (dir === "desc") {
          return valA < valB ? 1 : -1;
        } else {
          return valA > valB ? 1 : -1;
        }
      });
    }

    // LIMIT
    const limitMatch = normalizedSql.match(/limit\s+(\d+|\$\d+)/i);
    if (limitMatch) {
      let limitVal = limitMatch[1];
      if (limitVal.startsWith("$")) {
        const idx = parseInt(limitVal.substring(1)) - 1;
        limitVal = params[idx];
      }
      const limitNum = parseInt(limitVal);
      if (!isNaN(limitNum)) {
        data = data.slice(0, limitNum);
      }
    }

    if (isCount) {
      const countKey = normalizedSql.match(/select\s+count\(\*\)\s+as\s+([a-zA-Z0-9_]+)/i)?.[1] || "count";
      return { rows: [{ [countKey]: data.length }], rowCount: 1 };
    }

    return { rows: JSON.parse(JSON.stringify(data)), rowCount: data.length };
  }

  // 4. INSERT
  if (lowerSql.startsWith("insert into")) {
    const match = normalizedSql.match(/insert\s+into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
    if (match) {
      const tableName = match[1];
      const cols = match[2].split(",").map(c => c.trim().replace(/['"`]/g, ""));
      const valsRaw = match[3].split(",");

      let actualTableName = tableName;
      if (actualTableName === "attendances") {
        actualTableName = "attendance";
      }

      if (!dbState[actualTableName]) {
        dbState[actualTableName] = [];
      }

      const newRow: Record<string, any> = {};
      
      // Auto-increment primary key 'id'
      let maxId = 0;
      for (const r of dbState[actualTableName]) {
        if (r.id && typeof r.id === "number" && r.id > maxId) {
          maxId = r.id;
        }
      }
      newRow.id = maxId + 1;

      cols.forEach((col, idx) => {
        const rawV = valsRaw[idx];
        const valRaw = rawV ? rawV.trim() : "";
        if (valRaw.startsWith("$")) {
          const pIdx = parseInt(valRaw.substring(1)) - 1;
          newRow[col] = params[pIdx];
        } else {
          // literal
          let literal = valRaw;
          if (literal.startsWith("'") && literal.endsWith("'")) {
            literal = literal.substring(1, literal.length - 1);
          }
          newRow[col] = literal;
        }
      });

      // Implement ON CONFLICT handling for unique keys (inventory_items, settings, attendance)
      if (actualTableName === "attendance") {
        const empId = Number(newRow.employee_id);
        const punchTime = newRow.punch_time ? String(newRow.punch_time).trim() : null;
        if (empId && punchTime) {
          const existing = dbState["attendance"].find(r => 
            Number(r.employee_id) === empId && 
            (String(r.punch_time || "").trim() === punchTime || String(r.check_in || "").trim() === punchTime)
          );
          if (existing) {
            if (lowerSql.includes("do nothing")) {
              return { rows: [], rowCount: 0 };
            }
            return { rows: [existing], rowCount: 1 };
          }
        }
      } else if (actualTableName === "inventory_items") {
        const whId = Number(newRow.warehouse_id);
        const ingId = Number(newRow.ingredient_id);
        const existing = dbState[actualTableName].find(r => Number(r.warehouse_id) === whId && Number(r.ingredient_id) === ingId);
        if (existing) {
          if (lowerSql.includes("do update")) {
            const updateMatch = normalizedSql.match(/do\s+update\s+set\s+(.+)$/i);
            if (updateMatch) {
              const setExpr = updateMatch[1];
              const setParts = setExpr.split("=");
              if (setParts.length === 2) {
                const colName = setParts[0].trim().replace(/['"`]/g, "");
                if (colName === "quantity") {
                  const currentQty = Number(existing.quantity) || 0;
                  const excludedQty = Number(newRow.quantity) || 0;
                  existing.quantity = currentQty + excludedQty;
                }
              }
            }
          }
          saveDb();
          return { rows: [existing], rowCount: 1 };
        }
      } else if (actualTableName === "settings" || actualTableName === "hr_settings") {
        // BUGFIX 2026-08-25 — hr_settings upsert: the fallback's ON CONFLICT
        // handling only covered the `settings` table, so every save to
        // hr_settings PUSHED A NEW ROW instead of updating the existing one.
        // Duplicates accumulated and the GET reducer could return a stale
        // value. Treat hr_settings exactly like settings: match by key and
        // update in place.
        const keyVal = String(newRow.key).trim();
        const existing = dbState[actualTableName].find(r => String(r.key).trim() === keyVal);
        if (existing) {
          existing.value = newRow.value;
          saveDb();
          return { rows: [existing], rowCount: 1 };
        }
      }

      // Default attributes
      if (actualTableName === "users" && !newRow.permissions) {
        newRow.permissions = JSON.stringify({ all: true });
      }

      if (actualTableName === "ingredients") {
        if (!newRow.item_code || String(newRow.item_code).trim() === "" || newRow.item_code === "null") {
          newRow.item_code = `ITEM-${1000 + newRow.id}`;
        }
      }

      if (actualTableName === "purchases" && !newRow.date) {
        newRow.date = new Date().toISOString();
      }

      // IMPORTANT: use actualTableName (the normalized one), not the raw
      // user-supplied tableName. The old code did `dbState[tableName].push(...)`
      // which for INSERT INTO "attendances" wrote to a throwaway key
      // `dbState["attendances"]` instead of `dbState["attendance"]` —
      // silently dropping EVERY attendance row inserted during fingerprint
      // sync (rows appeared nowhere, days never showed up in reports).
      dbState[actualTableName].push(newRow);
      saveDb();

      return { rows: [newRow], rowCount: 1 };
    }
  }

  // 5. UPDATE
  if (lowerSql.startsWith("update")) {
    // Special-case the attendance UPDATE that uses CASE WHEN / CAST (Postgres-specific syntax)
    // The frontend's "Edit fingerprint record" feature sends:
    //   UPDATE attendance SET check_in = CASE WHEN $1::text IS NOT NULL THEN ... END,
    //     check_out = CASE WHEN $2::text IS NOT NULL THEN ... END,
    //     date = CAST($3::text AS DATE), work_hours = $4, delay_minutes = $5, penalty = $6
    //   WHERE id = $7
    // params: [check_in, check_out, date, work_hours, delay_minutes, penalty, id]
    if (
      lowerSql.startsWith("update attendance") &&
      lowerSql.includes("case when") &&
      lowerSql.includes("where id = $")
    ) {
      const idMatch = lowerSql.match(/where\s+id\s*=\s*\$(\d+)/i);
      if (idMatch) {
        const idIdx = parseInt(idMatch[1]) - 1;
        const targetId = Number(params[idIdx]);
        let checkIn = params[0];   // $1
        let checkOut = params[1];  // $2
        const dateVal = params[2];   // $3
        const workHours = Number(params[3]) || 0;     // $4
        const delayMinutes = Number(params[4]) || 0;  // $5
        const penalty = Number(params[5]) || 0;       // $6

        // Normalize time strings: "10:05" → "10:05:00", "10:05:00" → "10:05:00"
        const normalizeTime = (t: string): string => {
          if (!t || typeof t !== "string") return "";
          const parts = t.split(":");
          if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
          if (parts.length === 3) return `${parts[0]}:${parts[1]}:${parts[2]}`;
          return t;
        };
        checkIn = checkIn ? normalizeTime(String(checkIn)) : "";
        checkOut = checkOut ? normalizeTime(String(checkOut)) : "";

        const list = dbState["attendance"] || [];
        const rec = list.find((r: any) => Number(r.id) === targetId);
        if (rec) {
          // Build full ISO timestamps like the original TIMESTAMP cast would
          if (checkIn && dateVal) {
            rec.check_in = `${dateVal}T${checkIn}.000Z`;
          } else {
            rec.check_in = null;
          }
          if (checkOut && dateVal) {
            rec.check_out = `${dateVal}T${checkOut}.000Z`;
          } else {
            rec.check_out = null;
          }
          rec.date = dateVal;
          rec.work_hours = workHours;
          rec.delay_minutes = delayMinutes;
          rec.penalty = penalty;
          saveDb();
          return { rows: [rec], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
    }

    const match = normalizedSql.match(/update\s+([a-zA-Z0-9_]+)\s+set\s+(.+?)(?:\s+where\s+(.+?))?$/i);
    if (match) {
      const tableName = match[1];
      const setsRaw = match[2];
      const whereClause = match[3] ? match[3].trim() : null;

      const data = dbState[tableName] || [];
      const updatedRows: any[] = [];

      const setOps: { col: string; val: any }[] = [];
      // Split SET clauses on commas that are NOT inside parentheses (depth 0),
      // so SQL functions like COALESCE(department_id, $2) stay intact as ONE clause
      // instead of being broken into garbage tokens (previous bug that corrupted
      // employees.department_id to the literal string "COALESCE(department_id").
      const splitSetClauses = (raw: string): string[] => {
        const parts: string[] = [];
        let depth = 0;
        let current = "";
        let inQuote: string | null = null;
        for (const ch of raw) {
          if (inQuote) {
            current += ch;
            if (ch === inQuote) inQuote = null;
            continue;
          }
          if (ch === "'" || ch === '"') { inQuote = ch; current += ch; continue; }
          if (ch === "(") { depth++; current += ch; continue; }
          if (ch === ")") { depth = Math.max(0, depth - 1); current += ch; continue; }
          if (ch === "," && depth === 0) { parts.push(current); current = ""; continue; }
          current += ch;
        }
        if (current.trim()) parts.push(current);
        return parts;
      };
      const parts = splitSetClauses(setsRaw);
      parts.forEach(p => {
        const eqIdx = p.indexOf("=");
        if (eqIdx !== -1) {
          const col = p.substring(0, eqIdx).trim().replace(/['"`]/g, "");
          const valRaw = p.substring(eqIdx + 1).trim();
          let val: any;
          // General COALESCE(...) support:
          //   COALESCE(col, $N)  |  COALESCE(col, col2, 'literal')  |  COALESCE(col, 'literal')
          // Evaluated per-row: first non-null/non-empty argument wins.
          // Column refs resolve against the current row, $N against params,
          // quoted strings are literals.
          const coalesceMatch = valRaw.match(/^COALESCE\((.+)\)$/i);
          if (coalesceMatch) {
            const args = splitSetClauses(coalesceMatch[1]).map(s => s.trim()).filter(Boolean);
            setOps.push({ col, val: { __coalesceArgs: args } });
            return;
          }
          if (valRaw.startsWith("$")) {
            const pIdx = parseInt(valRaw.substring(1)) - 1;
            val = params[pIdx];
          } else {
            let literal = valRaw;
            if (literal.startsWith("'") && literal.endsWith("'")) {
              literal = literal.substring(1, literal.length - 1);
            }
            val = literal;
          }
          setOps.push({ col, val });
        }
      });

      data.forEach(row => {
        let match = true;
        if (whereClause) {
          match = evaluateConditions(row, whereClause, params);
        }
        if (match) {
          setOps.forEach(op => {
            // Deferred COALESCE(...): evaluate per-row — take the first
            // non-null / non-empty argument (columns from the row, $N from
            // params, '...' as string literal). Previously-corrupted values
            // that literally start with "COALESCE(" are treated as empty so
            // the data self-heals on the next write.
            if (op.val && typeof op.val === "object" && Array.isArray(op.val.__coalesceArgs)) {
              row[op.col] = resolveCoalesceArgs(row, op.val.__coalesceArgs, params);
              return;
            }
            const valStr = String(op.val).trim();
            const hasPlus = valStr.includes("+");
            const hasMinus = valStr.includes("-");
            if (hasPlus || hasMinus) {
              const parts = valStr.split(hasPlus ? "+" : "-");
              if (parts.length === 2) {
                const rightHand = parts[1].trim();
                let operandValue = 0;
                if (rightHand.startsWith("$")) {
                  const pIdx = parseInt(rightHand.substring(1)) - 1;
                  operandValue = Number(params[pIdx]);
                } else {
                  operandValue = Number(rightHand);
                }
                if (isNaN(operandValue)) operandValue = 0;
                
                const currentVal = Number(row[op.col]) || 0;
                if (hasPlus) {
                  row[op.col] = currentVal + operandValue;
                } else {
                  row[op.col] = currentVal - operandValue;
                }
              } else {
                row[op.col] = op.val;
              }
            } else {
              row[op.col] = op.val;
            }
          });
          updatedRows.push(row);
        }
      });

      saveDb();
      return { rows: updatedRows, rowCount: updatedRows.length };
    }
  }

  // 6. DELETE
  if (lowerSql.startsWith("delete")) {
    const match = normalizedSql.match(/delete\s+from\s+([a-zA-Z0-9_]+)(?:\s+where\s+(.+?))?$/i);
    if (match) {
      const tableName = match[1];
      const whereClause = match[2] ? match[2].trim() : null;

      const data = dbState[tableName] || [];
      const remaining: any[] = [];
      const deleted: any[] = [];

      data.forEach(row => {
        let match = true;
        if (whereClause) {
          match = evaluateConditions(row, whereClause, params);
        }
        if (match) {
          deleted.push(row);
        } else {
          remaining.push(row);
        }
      });

      dbState[tableName] = remaining;
      saveDb();
      return { rows: deleted, rowCount: deleted.length };
    }
  }

  return { rows: [], rowCount: 0 };
}

function filterData(data: any[], whereClause: string, params: any[]): any[] {
  return data.filter(row => evaluateConditions(row, whereClause, params));
}

/**
 * Resolve COALESCE(arg1, arg2, ...) arguments against a row.
 * Each arg can be:
 *   - $N          → params[N-1]
 *   - 'literal'   → the literal string itself
 *   - column_name → the current row's value for that column (type-cast suffix like ::text is stripped)
 * Returns the first non-null / non-empty argument. Values that are literal
 * "COALESCE(" strings (from the old parser bug) are treated as empty so the
 * data self-heals instead of propagating the corruption.
 */
function resolveCoalesceArgs(row: any, args: string[], params: any[]): any {
  const isEmptyVal = (v: any) =>
    v === null ||
    v === undefined ||
    v === "" ||
    (typeof v === "string" && v.trim().toUpperCase().startsWith("COALESCE("));

  for (const rawArg of args) {
    const arg = rawArg.trim();
    if (!arg) continue;

    let value: any;
    if (arg.startsWith("$")) {
      const pIdx = parseInt(arg.substring(1)) - 1;
      value = params[pIdx];
    } else if (arg.startsWith("'") && arg.endsWith("'")) {
      value = arg.substring(1, arg.length - 1);
    } else {
      // Column reference (strip Postgres type casts like ::text)
      const colName = arg.replace(/::[a-zA-Z_]+(\(\d+\))?/g, "").trim();
      value = row[colName];
    }

    if (!isEmptyVal(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Evaluate a SQL WHERE clause against a row.
 * Handles AND, OR, parentheses, LIKE with wildcards, and Postgres type casts (::text).
 * This is a lightweight evaluator for the offline DB fallback - it doesn't need to be
 * a full SQL parser, just good enough for the queries our own code generates.
 */
function evaluateConditions(row: any, clause: string, params: any[]): boolean {
  // Tokenize: split into AND/OR groups while respecting parentheses
  // First, normalize whitespace
  const normalized = clause.replace(/\s+/g, " ").trim();

  // Split by OR at the top level (respecting parens)
  const orParts = splitByKeyword(normalized, "or");
  for (const orPart of orParts) {
    // Each OR part is an AND group
    const andParts = splitByKeyword(orPart, "and");
    let allMatch = true;
    for (const part of andParts) {
      const trimmed = part.trim();
      // Strip outer parens if they wrap the whole expression
      const unwrapped = stripOuterParens(trimmed);
      if (!evaluateSingleCondition(row, unwrapped, params)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true; // OR: any matching group is enough
  }
  return false;
}

/** Split a clause by a keyword (AND/OR) at the top level, respecting parentheses. */
function splitByKeyword(clause: string, keyword: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  const tokens = clause.split(/\s+/);
  for (const tok of tokens) {
    const lowerTok = tok.toLowerCase();
    if (tok === "(") depth++;
    if (tok === ")") depth--;
    if (depth === 0 && lowerTok === keyword) {
      parts.push(current.trim());
      current = "";
    } else {
      current += (current ? " " : "") + tok;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Remove wrapping parentheses like "(notes LIKE '...')" → "notes LIKE '...'" */
function stripOuterParens(s: string): string {
  let str = s.trim();
  while (str.startsWith("(") && str.endsWith(")")) {
    // Check the parens are balanced as a wrapper
    let depth = 0;
    let isWrapper = true;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "(") depth++;
      else if (str[i] === ")") depth--;
      if (depth === 0 && i < str.length - 1) { isWrapper = false; break; }
    }
    if (isWrapper) {
      str = str.substring(1, str.length - 1).trim();
    } else {
      break;
    }
  }
  return str;
}

/** Evaluate a single leaf condition like "col = $1" or "col LIKE 'pattern%'" */
function evaluateSingleCondition(row: any, part: string, params: any[]): boolean {
  const trimmed = part.trim();
  if (trimmed === "1=1" || trimmed === "1 = 1" || trimmed === "true") {
    return true;
  }

  // BUGFIX 2026-08-25 — SUPPORT `col IN (...)` CLAUSES:
  // The old code had no IN handler, so any `WHERE x IN ('a','b')` fell
  // through the operator regex, hit `return true` (unknown clause), and
  // matched EVERY row — turning targeted DELETE/SELECT statements into
  // table-wide wipes. This bit hr_settings cleanup: DELETE ... WHERE key
  // IN ('key','value') erased the whole table right after a successful
  // save, making settings "disappear" on the next page load.
  const inMatch = trimmed.match(/^([a-zA-Z0-9_\.]+)\s+in\s*\((.+)\)$/i);
  if (inMatch) {
    let inCol: string = inMatch[1].trim();
    const inCastIdx = inCol.indexOf("::");
    if (inCastIdx !== -1) inCol = inCol.substring(0, inCastIdx).trim();
    if (inCol.includes(".")) inCol = inCol.split(".")[1];

    // Parse the value list: 'a', 'b', $1, 123, NULL ...
    const listRaw = inMatch[2];
    const values: any[] = [];
    const listRegex = /'([^']*)'|\$(\d+)|([^,\s()]+)/g;
    let m: RegExpExecArray | null;
    while ((m = listRegex.exec(listRaw)) !== null) {
      if (m[1] !== undefined) {
        values.push(m[1]);               // quoted literal
      } else if (m[2] !== undefined) {
        values.push(params[parseInt(m[2]) - 1]); // positional param
      } else if (m[3] !== undefined) {
        const tok = m[3];
        if (tok.toLowerCase() === "null") continue;
        const num = Number(tok);
        values.push(isNaN(num) ? tok : num);
      }
    }

    const rowVal = row[inCol];
    if (rowVal === undefined) return false;
    return values.some(v => String(rowVal) === String(v));
  }

  const match = trimmed.match(/([a-zA-Z0-9_\.]+(?:\s*::\s*[a-zA-Z0-9_]+)?)\s*(<=|>=|!=|<>|=|>|<|like)\s*(.+)/i);
  if (!match) return true; // unknown clause → don't filter (safer for offline mode)

  let col = match[1].trim();
  // Strip Postgres-style type cast (e.g. "a.date::text" -> "date")
  const castIdx = col.indexOf("::");
  if (castIdx !== -1) {
    col = col.substring(0, castIdx).trim();
  }
  if (col.includes(".")) {
    col = col.split(".")[1];
  }
  const op = match[2].trim().toLowerCase();
  let valRaw = match[3].trim();

  let val: any;
  if (valRaw.startsWith("$")) {
    const pIdx = parseInt(valRaw.substring(1)) - 1;
    val = params[pIdx];
  } else if (valRaw.startsWith("'")) {
    // Quoted string: extract everything between the first quote and the NEXT quote
    // (handles cases like "'خصم تلقائي:%')" where there's trailing junk after the closing quote)
    const endQuoteIdx = valRaw.indexOf("'", 1);
    if (endQuoteIdx !== -1) {
      val = valRaw.substring(1, endQuoteIdx);
    } else {
      val = valRaw.substring(1);
    }
  } else {
    // Unquoted literal - take up to the first space or closing paren
    val = valRaw.split(/\s|\)/)[0];
  }

  const rowVal = row[col];
  if (rowVal === undefined) return false;

  if (op === "=") {
    return String(rowVal) === String(val);
  } else if (op === "!=" || op === "<>") {
    return String(rowVal) !== String(val);
  } else if (op === ">") {
    return Number(rowVal) > Number(val);
  } else if (op === "<") {
    return Number(rowVal) < Number(val);
  } else if (op === ">=") {
    return Number(rowVal) >= Number(val);
  } else if (op === "<=") {
    return Number(rowVal) <= Number(val);
  } else if (op === "like") {
    const regexStr = String(val).replace(/%/g, ".*").replace(/_/g, ".");
    const regex = new RegExp(`^${regexStr}$`, "i");
    return regex.test(String(rowVal));
  }
  return true;
}

let useOfflineFallback = !process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "";

if (useOfflineFallback) {
  console.log("Offline fallback database is active.");
}

declare global {
  // Reuse one PostgreSQL pool during Vite/tsx hot reloads.
  // This prevents every module reload from creating another set of DB clients.
  // eslint-disable-next-line no-var
  var __remoPgPool: any;
}

const realPool = globalThis.__remoPgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  // Keep the application footprint small. PostgreSQL installations used by
  // this ERP may have a low max_connections value, and the ERP has many
  // modules sharing this single pool.
  max: Number(process.env.PG_POOL_MAX || 6),
  min: 0,
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000),
  maxUses: 7500,
  allowExitOnIdle: false,
});

globalThis.__remoPgPool = realPool;

realPool.on('error', (err: any) => {
  console.error('[DB Pool] Unexpected idle client error:', err);
});

export const pool = {
  async query(sql: string, params?: any[]) {
    if (useOfflineFallback) {
      return handleFallbackQuery(sql, params);
    }
    try {
      return await realPool.query(sql, params);
    } catch (error: any) {
      // Only treat actual connection-level errors as fallback triggers
      // NOT query-level errors like "column already exists" or "relation does not exist"
      const isConnectionError = 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'EHOSTUNREACH' ||
        error.code === '57P03' ||  // cannot connect now
        error.code === '08006' ||  // connection failure
        error.code === '08001' ||  // SQLCLIENT_UNABLE_TO_ESTABLISH_SQLCONNECTION
        error.message?.includes('ECONNREFUSED') || 
        error.message?.includes('Connection refused') ||
        error.message?.includes('ENOTFOUND') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('no pg_hba.conf entry') ||
        error.message?.includes('password authentication') ||
        (error.message?.includes('database') && error.message?.includes('does not exist'));

      if (isConnectionError) {
        if (!useOfflineFallback) {
          console.log("Offline fallback database activated.");
          useOfflineFallback = true;
        }
        return handleFallbackQuery(sql, params);
      }
      throw error;
    }
  },
  async connect() {
    if (useOfflineFallback) {
      return {
        query: async (sql: string, params?: any[]) => handleFallbackQuery(sql, params),
        release: () => {},
      };
    }
    try {
      return await realPool.connect();
    } catch (error: any) {
      const isConnectionError = 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'EHOSTUNREACH' ||
        error.code === '57P03' ||
        error.code === '08006' ||
        error.code === '08001' ||
        error.message?.includes('ECONNREFUSED') || 
        error.message?.includes('Connection refused') ||
        error.message?.includes('ENOTFOUND') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('no pg_hba.conf entry') ||
        error.message?.includes('password authentication') ||
        (error.message?.includes('database') && error.message?.includes('does not exist'));

      if (isConnectionError) {
        if (!useOfflineFallback) {
          console.log("Offline fallback database activated.");
          useOfflineFallback = true;
        }
        return {
          query: async (sql: string, params?: any[]) => handleFallbackQuery(sql, params),
          release: () => {},
        };
      }
      throw error;
    }
  },
  async end() {
    if (!useOfflineFallback) {
      return await realPool.end();
    }
  },
  on(event: any, listener: (...args: any[]) => void) {
    return realPool.on(event, listener);
  }
} as any;
