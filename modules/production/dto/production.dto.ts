export interface CreateProductionRunDTO {
  product_id: number;
  warehouse_id: number;
  finished_warehouse_id?: number;
  quantity: number;
  notes?: string;
}

export interface ProductionRunResponseDTO {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  status: string;
  notes?: string;
  created_at: Date;
}
