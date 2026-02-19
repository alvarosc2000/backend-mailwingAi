import { Router } from "express";
import { 
  register, 
  login, 
  getMe, 
  changePassword, 
  forgotPassword, 
  resetPassword 
} from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// Endpoints de autenticación
router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.post("/change-password", authMiddleware, changePassword);

// Recuperación de contraseña
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
