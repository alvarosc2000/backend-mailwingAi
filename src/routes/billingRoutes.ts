import { Router } from "express";
import { BillingController } from "../controllers/billingController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// Info del plan del usuario autenticado
router.get("/me", authMiddleware, BillingController.me);

export default router;
