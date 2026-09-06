export interface CreatePurchaseItemDTO {
  ingredient_id: number;
  quantity: number;
  unit_price: number;
}

export interface CreatePurchaseDTO {
  supplier_id: number;
  warehouse_id: number;
  invoice_number?: string;
  total_amount: number;
  paid_amount?: number;
  due_date?: string;
  currency?: string;
  notes?: string;
  purchase_order_id?: number;
  order_id?: number;
  receipt_id?: number;
  branch_id?: number;
  cost_center_id?: number;
  payment_method?: string;
  treasury_account_id?: number;
  created_by?: number | string;
  items: CreatePurchaseItemDTO[];
}
