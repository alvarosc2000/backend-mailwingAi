import { Router } from "express";
import { createCheckoutSession, createExtraCheckoutSession } from "../controllers/stripeController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authMiddleware, createCheckoutSession);
// routes/checkoutRoutes.ts
router.post("/extra", authMiddleware, createExtraCheckoutSession);

export default router;
