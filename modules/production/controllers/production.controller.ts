import { Request, Response } from "express";
import { ProductionService } from "../services/production.service.js";
import { validateCreateProductionRun } from "../validators/production.validator.js";

export class ProductionController {
  private service: ProductionService;

  constructor() {
    this.service = new ProductionService();
  }

  getProductionRuns = async (req: Request, res: Response): Promise<void> => {
    try {
      const runs = await this.service.getProductionRuns();
      res.status(200).json({ success: true, data: runs });
    } catch (err: any) {
      console.error("Controller Error in getProductionRuns:", err);
      res.status(500).json({ error: err.message || "Failed to fetch production runs" });
    }
  };

  createProductionRun = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateProductionRun(req.body);
      if (error || !value) {
        res.status(400).json({ error });
        return;
      }

      const run = await this.service.recordProductionRun(value);
      res.status(201).json({ success: true, data: run });
    } catch (err: any) {
      console.error("Controller Error in createProductionRun:", err);
      res.status(500).json({ error: err.message || "Failed to record production run" });
    }
  };
}
