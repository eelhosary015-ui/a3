import { ProductionRepository } from "../repositories/production.repository.js";
import { CreateProductionRunDTO } from "../dto/production.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class ProductionService {
  private repository: ProductionRepository;

  constructor() {
    this.repository = new ProductionRepository();
  }

  async getProductionRuns(): Promise<any[]> {
    const cacheKey = "production:runs:all";
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const runs = await this.repository.getAll();
    ERPCache.set(cacheKey, runs, 60); // cache for 1 minute
    return runs;
  }

  async recordProductionRun(dto: CreateProductionRunDTO): Promise<any> {
    const run = await this.repository.create(dto);
    
    // Invalidate caches
    ERPCache.delete("production:runs:all");

    ERPEventBus.getInstance().emitEvent("ProductionRunCompleted", {
      runId: run.id,
      productId: run.product_id,
      producedQuantity: run.quantity,
      warehouseId: run.warehouse_id,
      timestamp: new Date()
    });

    return run;
  }
}
