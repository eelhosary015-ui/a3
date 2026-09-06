import { Router } from "express";
import { QuotationController } from "./controllers/quotation.controller.js";
import { SalesOrderController } from "./controllers/sales_order.controller.js";
import { ReturnController } from "./controllers/return.controller.js";
import { InvoiceController } from "./controllers/invoice.controller.js";

const salesRoutes = Router();
const quotationController = new QuotationController();
const orderController = new SalesOrderController();
const returnController = new ReturnController();
const invoiceController = new InvoiceController();

// Quotations
salesRoutes.get("/quotations", quotationController.getQuotations);
salesRoutes.post("/quotations", quotationController.createQuotation);
salesRoutes.put("/quotations/:id", quotationController.updateQuotation);
salesRoutes.delete("/quotations/:id", quotationController.deleteQuotation);

// Sales Orders
salesRoutes.get("/orders", orderController.getSalesOrders);
salesRoutes.post("/orders", orderController.createSalesOrder);
salesRoutes.put("/orders/:id", orderController.updateSalesOrder);
salesRoutes.delete("/orders/:id", orderController.deleteSalesOrder);

// Sales Invoices (real invoicing: stock deduction + customer balance + GL posting)
salesRoutes.get("/invoices", invoiceController.getInvoices);
salesRoutes.get("/invoices/:id", invoiceController.getInvoiceById);
salesRoutes.post("/invoices", invoiceController.createInvoice);
salesRoutes.put("/invoices/:id", invoiceController.updateInvoice);
salesRoutes.delete("/invoices/:id", invoiceController.deleteInvoice);
salesRoutes.post("/invoices/:id/payments", invoiceController.recordPayment);

// Sales Returns
salesRoutes.get("/returns", returnController.getReturns);
salesRoutes.post("/returns", returnController.createReturn);
salesRoutes.put("/returns/:id", returnController.updateReturn);
salesRoutes.delete("/returns/:id", returnController.deleteReturn);

export function bootstrapSalesModule() {
  console.log("⚡ Bootstrapping Sales (Quotations, Sales Orders, Invoices & Returns) Module...");
}

export { salesRoutes };
export * from "./dto/quotation.dto.js";
export * from "./dto/sales_order.dto.js";
export * from "./dto/return.dto.js";
export * from "./dto/invoice.dto.js";
export * from "./validators/quotation.validator.js";
export * from "./validators/sales_order.validator.js";
export * from "./validators/return.validator.js";
export * from "./validators/invoice.validator.js";
export * from "./services/quotation.service.js";
export * from "./services/sales_order.service.js";
export * from "./services/return.service.js";
export * from "./services/invoice.service.js";
