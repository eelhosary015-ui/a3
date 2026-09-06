export interface ReturnItemDTO {
  itemCode: string;
  itemName: string;
  unit?: string;
  qtyInvoiced: number;
  qtyReturned: number;
  discount?: number;
  taxRate?: number;
  price: number;
  total: number;
}

export interface CreateReturnDTO {
  returnNo?: string;
  invoiceId?: string;
  customerName: string;
  date: string;
  reason?: string;
  returnType?: string;
  refundMethod?: string;
  salesRep?: string;
  warehouse?: string;
  notes?: string;
  status?: string;
  itemsTotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  expenses?: number;
  grandTotal?: number;
  items: ReturnItemDTO[];
}

export interface UpdateReturnDTO extends CreateReturnDTO {}
