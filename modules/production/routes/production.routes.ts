import { Router } from "express";
import { ProductionController } from "../controllers/production.controller.js";

const router = Router();
const controller = new ProductionController();

router.get("/", controller.getProductionRuns);
router.post("/", controller.createProductionRun);

export default router;
