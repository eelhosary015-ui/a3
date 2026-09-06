import { erpPool } from "../../../server-erp-core.js";
import { CreateProductionRunDTO } from "../dto/production.dto.js";

export class ProductionRepository {
  constructor() {
    this.ensureTableExists();
  }

  private async ensureTableExists(): Promise<void> {
    const ddl = `
      CREATE TABLE IF NOT EXISTS production_runs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER,
        warehouse_id INTEGER,
        finished_warehouse_id INTEGER,
        quantity DECIMAL(10,2) NOT NULL,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    try {
      await erpPool.query(ddl);
      // Ensure finished_warehouse_id column exists
      try {
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS finished_warehouse_id INTEGER");
      } catch (colErr) {
        // Silently skip if column already added or database engines handle it
      }
    } catch (err: any) {
      console.error("Failed to ensure production_runs table exists:", err.message);
    }
  }

  async getAll(): Promise<any[]> {
    await this.ensureTableExists();
    const query = `
      SELECT pr.*, p.name as product_name, w.name as warehouse_name, fw.name as finished_warehouse_name
      FROM production_runs pr
      LEFT JOIN products p ON pr.product_id = p.id
      LEFT JOIN warehouses w ON pr.warehouse_id = w.id
      LEFT JOIN warehouses fw ON pr.finished_warehouse_id = fw.id
      ORDER BY pr.created_at DESC
    `;
    const result = await erpPool.query(query);
    return result.rows;
  }

  async findById(id: number): Promise<any> {
    await this.ensureTableExists();
    const query = `
      SELECT pr.*, p.name as product_name, w.name as warehouse_name, fw.name as finished_warehouse_name
      FROM production_runs pr
      LEFT JOIN products p ON pr.product_id = p.id
      LEFT JOIN warehouses w ON pr.warehouse_id = w.id
      LEFT JOIN warehouses fw ON pr.finished_warehouse_id = fw.id
      WHERE pr.id = $1
    `;
    const result = await erpPool.query(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async create(run: CreateProductionRunDTO): Promise<any> {
    await this.ensureTableExists();
    
    // Fetch recipe/BOM items for this product
    const recipeQuery = `
      SELECT ingredient_id, quantity 
      FROM product_ingredients 
      WHERE product_id = $1
    `;
    const recipeResult = await erpPool.query(recipeQuery, [run.product_id]);
    const recipeItems = recipeResult.rows;

    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // 1. Insert production execution run record
      const insertRunQuery = `
        INSERT INTO production_runs (product_id, warehouse_id, finished_warehouse_id, quantity, status, notes)
        VALUES ($1, $2, $3, $4, 'completed', $5)
        RETURNING *
      `;
      const runResult = await client.query(insertRunQuery, [
        run.product_id,
        run.warehouse_id,
        run.finished_warehouse_id || run.warehouse_id,
        run.quantity,
        run.notes || `تصنيع معتاد لمنتج #${run.product_id}`
      ]);
      const newRun = runResult.rows[0];

      // 2. Consume raw ingredients based on recipe requirements
      for (const ingredient of recipeItems) {
        const requiredQuantity = ingredient.quantity * run.quantity;

        // Deduct inventory items in the specified raw materials warehouse
        // Use + EXCLUDED.quantity because we insert negative quantity -$3
        const updateStockQuery = `
          INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, min_quantity)
          VALUES ($1, $2, -$3, 0)
          ON CONFLICT (warehouse_id, ingredient_id)
          DO UPDATE SET quantity = inventory_items.quantity + EXCLUDED.quantity
        `;
        await client.query(updateStockQuery, [run.warehouse_id, ingredient.ingredient_id, requiredQuantity]);

        // Log transaction for tracking raw material consumption
        await client.query(
          `INSERT INTO inventory_transactions (warehouse_id, ingredient_id, quantity, type, reference_id, notes)
           VALUES ($1, $2, -$3, 'production_waste', $4, $5)`,
          [
            run.warehouse_id,
            ingredient.ingredient_id,
            requiredQuantity,
            newRun.id,
            `استهلاك إنتاج لأمر رقم #${newRun.id}`
          ]
        );
      }

      // 3. Add produced finished goods in the specified finished goods warehouse
      const productObjRes = await client.query("SELECT name FROM products WHERE id = $1", [run.product_id]);
      const productName = productObjRes.rows[0]?.name;
      if (productName) {
        // Find matching ingredient by name (the finished product is recorded in ingredients for stocking)
        const ingredientRes = await client.query("SELECT id FROM ingredients WHERE name = $1", [productName]);
        const matchedIngredientId = ingredientRes.rows[0]?.id;
        
        if (matchedIngredientId) {
          const targetFinishedWarehouse = run.finished_warehouse_id || run.warehouse_id;
          
          // Add to Finished Goods warehouse
          const addFinishedStockQuery = `
            INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, min_quantity)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (warehouse_id, ingredient_id)
            DO UPDATE SET quantity = inventory_items.quantity + EXCLUDED.quantity
          `;
          await client.query(addFinishedStockQuery, [targetFinishedWarehouse, matchedIngredientId, run.quantity]);

          // Log transaction for finished product entry
          await client.query(
            `INSERT INTO inventory_transactions (warehouse_id, ingredient_id, quantity, type, reference_id, notes)
             VALUES ($1, $2, $3, 'in', $4, $5)`,
            [
              targetFinishedWarehouse,
              matchedIngredientId,
              run.quantity,
              newRun.id,
              `إضافة منتج تام الصنع من أمر الإنتاج #${newRun.id}`
            ]
          );
        }
      }

      await client.query("COMMIT");
      return newRun;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
