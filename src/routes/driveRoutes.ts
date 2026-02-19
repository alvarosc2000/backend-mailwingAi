import { Router } from "express";
import { DriveController } from "../controllers/driveController";

const router = Router();

router.get("/", DriveController.listFiles);
router.post("/upload", DriveController.uploadFile);

export default router;
