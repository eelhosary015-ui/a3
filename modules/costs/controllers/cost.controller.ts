import { Request, Response } from "express";
import { CostService } from "../services/cost.service.js";

export class CostController {
  private service: CostService;

  constructor() {
    this.service = new CostService();
  }

  getCosts = async (req: Request, res: Response): Promise<void> => {
    try {
      const costs = await this.service.getCosts();
      res.status(200).json({ success: true, data: costs });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch costs" });
    }
  };

  createCost = async (req: Request, res: Response): Promise<void> => {
    try {
      const cost = await this.service.createCost(req.body);
      res.status(201).json({ success: true, data: cost });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create cost" });
    }
  };
}
