import { Router } from "express";
import { stripeWebhook } from "../controllers/stripeWebhookController";

const router = Router();

// POST /webhooks/stripe
router.post("/", stripeWebhook);

export default router;
