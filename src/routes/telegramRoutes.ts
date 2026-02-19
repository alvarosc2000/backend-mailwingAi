import { Router } from "express";
import { TelegramController } from "../controllers/telegramController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// Webhook que llama Telegram
router.post("/webhook", TelegramController.webhook);

// 🔗 Ruta que genera el link para dashboard
router.post("/link", authMiddleware, TelegramController.generateLink);

export default router;
