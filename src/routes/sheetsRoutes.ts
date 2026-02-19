import { Router } from "express";
import { SheetsController } from "../controllers/sheetsController";

const router = Router();

router.get("/", SheetsController.getSheet);
router.post("/append", SheetsController.appendRow);

export default router;
