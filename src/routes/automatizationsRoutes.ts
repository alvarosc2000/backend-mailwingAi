// src/routes/automations.routes.ts
import { Router } from "express";
import { AutomationsController } from "../controllers/automationsController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// 🔐 TODAS las rutas de automations protegidas
router.use(authMiddleware);

router.post("/create", AutomationsController.create);
router.get("/list", AutomationsController.list);
router.get("/list_paused", AutomationsController.list_paused);
router.patch("/:id/status", AutomationsController.updateStatus);
router.delete("/:id", AutomationsController.delete);
router.get("/info/:id", AutomationsController.getById);

export default router;
