import { erpPool } from "../../../server-erp-core.js";
import { CreateCustomerDTO, RecordCustomerTransactionDTO } from "../dto/customer.dto.js";

export class CustomerRepository {
  constructor() {
    this.ensureTablesExists();
  }

  private async ensureTablesExists(): Promise<void> {
    const custDdl = `
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(100),
        address TEXT,
        balance DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    const transDdl = `
      CREATE TABLE IF NOT EXISTS customer_transactions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'payment' (credit) or 'charge' (debit)
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    try {
      await erpPool.query(custDdl);
      await erpPool.query(transDdl);
    } catch (err: any) {
      console.error("Failed to ensure customers tables exists:", err.message);
    }
  }

  async getAll(): Promise<any[]> {
    await this.ensureTablesExists();
    const result = await erpPool.query("SELECT * FROM customers ORDER BY name ASC");
    return result.rows;
  }

  async create(cust: CreateCustomerDTO): Promise<any> {
    await this.ensureTablesExists();
    const query = `
      INSERT INTO customers (name, phone, email, address)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, address = EXCLUDED.address
      RETURNING *
    `;
    const result = await erpPool.query(query, [
      cust.name,
      cust.phone,
      cust.email || null,
      cust.address || null
    ]);
    return result.rows[0];
  }

  async recordTransaction(tx: RecordCustomerTransactionDTO): Promise<any> {
    await this.ensureTablesExists();
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // Insert transaction record
      const insertQuery = `
        INSERT INTO customer_transactions (customer_id, amount, type, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const txResult = await client.query(insertQuery, [
        tx.customer_id,
        tx.amount,
        tx.type,
        tx.notes || null
      ]);

      // Adjust customer balance
      const delta = tx.type === "charge" ? tx.amount : -tx.amount;
      await client.query("UPDATE customers SET balance = balance + $1 WHERE id = $2", [delta, tx.customer_id]);

      await client.query("COMMIT");
      return txResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getTransactions(customerId: number): Promise<any[]> {
    await this.ensureTablesExists();
    const result = await erpPool.query(
      "SELECT * FROM customer_transactions WHERE customer_id = $1 ORDER BY created_at DESC",
      [customerId]
    );
    return result.rows;
  }
}
