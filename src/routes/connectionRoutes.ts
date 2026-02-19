import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ConnectionsController } from "../controllers/connectionsController";

const router = Router();

// 🔹 Rutas OAuth Gmail NO deben usar authMiddleware
router.get("/gmail/init", ConnectionsController.gmailInit);
router.get("/gmail/callback", ConnectionsController.gmailCallback);


// 🔹 Rutas protegidas con JWT
router.use(authMiddleware);
router.get("/", ConnectionsController.listConnections);
router.delete("/:id", ConnectionsController.deleteConnection);
router.get("/gmail/messages", ConnectionsController.gmailMessages);
router.get("/gmail/messages/:id", ConnectionsController.gmailMessageById);


export default router;
