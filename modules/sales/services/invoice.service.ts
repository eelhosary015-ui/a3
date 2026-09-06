import { InvoiceRepository } from "../repositories/invoice.repository.js";
import { CreateInvoiceDTO, UpdateInvoiceDTO } from "../dto/invoice.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";
import { WarehouseService } from "../../warehouses/services/warehouse.service.js";
import { CustomerService } from "../../customers/services/customer.service.js";
import { postSalesEntry, postCustomerPaymentEntry } from "../../accounts/services/auto-posting.service.js";

const LIST_CACHE_KEY = "sales:invoices:all";

export class InvoiceService {
  private repository: InvoiceRepository;
  private warehouseService: WarehouseService;
  private customerService: CustomerService;

  constructor() {
    this.repository = new InvoiceRepository();
    this.warehouseService = new WarehouseService();
    this.customerService = new CustomerService();
  }

  async getInvoices(): Promise<any[]> {
    const cached = ERPCache.get(LIST_CACHE_KEY);
    if (cached) return cached;

    const invoices = await this.repository.getAll();
    ERPCache.set(LIST_CACHE_KEY, invoices, 60);
    return invoices;
  }

  async getInvoiceById(id: number): Promise<any> {
    const invoice = await this.repository.getById(id);
    if (!invoice) {
      const err: any = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }
    return invoice;
  }

  /**
   * Creates the invoice and, on a best-effort basis, wires it into the rest
   * of the ERP:
   *  - deducts real stock for any item that carries an ingredientId + the invoice has a warehouseId
   *  - charges the customer's account balance when a customerId is supplied
   *  - posts the corresponding journal entry through the existing auto-posting engine
   * Every integration step is wrapped so that a failure in one (e.g. GL accounts
   * not configured yet) never blocks the invoice itself from being saved.
   */
  async createInvoice(dto: CreateInvoiceDTO): Promise<any> {
    const invoice = await this.repository.create(dto);
    ERPCache.delete(LIST_CACHE_KEY);

    const integrationWarnings: string[] = [];

    // 1) Deduct real stock, item by item, when we know which warehouse and which stock item
    if (dto.warehouseId) {
      for (const item of dto.items) {
        if (!item.ingredientId) continue;
        try {
          await this.warehouseService.adjustStock({
            warehouse_id: dto.warehouseId,
            ingredient_id: item.ingredientId,
            quantity: item.qty,
            type: "deduction",
            notes: `فاتورة مبيعات ${invoice.invoice_no} — ${item.name}`
          });
        } catch (e: any) {
          integrationWarnings.push(`تعذر خصم مخزون الصنف "${item.name}": ${e.message}`);
        }
      }
    }

    // 2) Update the customer's account balance (accounts receivable)
    if (dto.customerId) {
      try {
        await this.customerService.recordTransaction({
          customer_id: dto.customerId,
          amount: invoice.net_amount,
          type: "charge",
          notes: `فاتورة مبيعات ${invoice.invoice_no}`
        });

        // If part of the invoice was paid immediately, record that collection too
        if (dto.paidAmount && dto.paidAmount > 0) {
          await this.customerService.recordTransaction({
            customer_id: dto.customerId,
            amount: dto.paidAmount,
            type: "payment",
            notes: `تحصيل عند إصدار فاتورة ${invoice.invoice_no}`
          });
        }
      } catch (e: any) {
        integrationWarnings.push(`تعذر تحديث رصيد العميل: ${e.message}`);
      }
    }

    // 3) Post the journal entry (revenue + AR/cash + tax + discount)
    try {
      await postSalesEntry({
        id: invoice.id,
        total: parseFloat(invoice.subtotal),
        discount: parseFloat(invoice.discount_total),
        tax_amount: parseFloat(invoice.tax_total),
        net_total: parseFloat(invoice.net_amount),
        payment_method: invoice.payment_method,
        customer_id: dto.customerId,
        customer_name: invoice.customer_name,
        items: (dto.items || []).map(i => ({ product_name: i.name, total: i.total }))
      });
    } catch (e: any) {
      integrationWarnings.push(`تعذر ترحيل القيد المحاسبي: ${e.message}`);
    }

    ERPEventBus.getInstance().emitEvent("SalesInvoiceCreated", {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoice_no,
      customerId: dto.customerId,
      customerName: invoice.customer_name,
      netAmount: invoice.net_amount,
      timestamp: new Date()
    });

    return { ...invoice, integrationWarnings };
  }

  async updateInvoice(id: number, dto: UpdateInvoiceDTO): Promise<any> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }

    // Once any payment has been collected or GL has picked it up, editing items
    // would silently desync stock/GL/customer balance, so we block it instead.
    if (found.paidAmount && found.paidAmount > 0) {
      const err: any = new Error("Cannot edit an invoice that already has recorded payments");
      err.statusCode = 409;
      throw err;
    }

    const invoice = await this.repository.update(id, dto);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesInvoiceUpdated", {
      invoiceId: id,
      timestamp: new Date()
    });

    return invoice;
  }

  async deleteInvoice(id: number): Promise<void> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }

    if (found.paidAmount && found.paidAmount > 0) {
      const err: any = new Error("Cannot delete an invoice that already has recorded payments");
      err.statusCode = 409;
      throw err;
    }

    await this.repository.delete(id);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesInvoiceDeleted", {
      invoiceId: id,
      timestamp: new Date()
    });
  }

  async recordPayment(id: number, amount: number, method?: string, notes?: string): Promise<any> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }

    const remaining = found.netAmount - found.paidAmount;
    if (amount > remaining) {
      const err: any = new Error(`Payment amount exceeds the remaining balance (${remaining})`);
      err.statusCode = 400;
      throw err;
    }

    const updatedInvoice = await this.repository.recordPayment(id, amount, method, notes);
    ERPCache.delete(LIST_CACHE_KEY);

    if (found.customerId) {
      try {
        await this.customerService.recordTransaction({
          customer_id: found.customerId,
          amount,
          type: "payment",
          notes: `تحصيل فاتورة ${found.invoiceNo}`
        });
      } catch (e) {
        // Non-blocking: the payment against the invoice itself already succeeded
      }
    }

    try {
      await postCustomerPaymentEntry({
        customer_id: found.customerId || 0,
        customer_name: found.customerName,
        amount,
        type: "payment",
        source_id: id
      });
    } catch (e) {
      // Non-blocking
    }

    ERPEventBus.getInstance().emitEvent("SalesInvoicePaymentRecorded", {
      invoiceId: id,
      amount,
      timestamp: new Date()
    });

    return updatedInvoice;
  }
}
