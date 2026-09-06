import { ReturnRepository } from "../repositories/return.repository.js";
import { CreateReturnDTO, UpdateReturnDTO } from "../dto/return.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

const LIST_CACHE_KEY = "sales:returns:all";

export class ReturnService {
  private repository: ReturnRepository;

  constructor() {
    this.repository = new ReturnRepository();
  }

  async getReturns(): Promise<any[]> {
    const cached = ERPCache.get(LIST_CACHE_KEY);
    if (cached) return cached;

    const returns = await this.repository.getAll();
    ERPCache.set(LIST_CACHE_KEY, returns, 60);
    return returns;
  }

  async createReturn(dto: CreateReturnDTO): Promise<any> {
    const returnDoc = await this.repository.create(dto);
    ERPCache.delete(LIST_CACHE_KEY);

    // Emitted so inventory can eventually restock the returned quantities
    // and accounting can post the related credit note once they subscribe.
    ERPEventBus.getInstance().emitEvent("SalesReturnCreated", {
      returnId: returnDoc.id,
      returnNo: returnDoc.return_no,
      customerName: returnDoc.customer_name,
      grandTotal: returnDoc.grand_total,
      warehouse: returnDoc.warehouse,
      timestamp: new Date()
    });

    return returnDoc;
  }

  async updateReturn(id: number, dto: UpdateReturnDTO): Promise<any> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Return not found");
      err.statusCode = 404;
      throw err;
    }

    if (found.status === "تم التأكيد والمحاسبة") {
      const err: any = new Error("Cannot edit a return that has already been confirmed and posted");
      err.statusCode = 409;
      throw err;
    }

    const returnDoc = await this.repository.update(id, dto);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesReturnUpdated", {
      returnId: id,
      timestamp: new Date()
    });

    return returnDoc;
  }

  async deleteReturn(id: number): Promise<void> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Return not found");
      err.statusCode = 404;
      throw err;
    }

    if (found.status === "تم التأكيد والمحاسبة") {
      const err: any = new Error("Cannot delete a return that has already been confirmed and posted");
      err.statusCode = 409;
      throw err;
    }

    await this.repository.delete(id);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesReturnDeleted", {
      returnId: id,
      timestamp: new Date()
    });
  }
}
