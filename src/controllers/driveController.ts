import { Request, Response } from "express";
import * as service from "../services/connectionsService";
import * as drive from "../integrations/googleDriveIntegration";
import * as auth from "../integrations/googleOAuthIntegrations";

export class DriveController {

  // =========================
  // 📌 LISTAR ARCHIVOS DRIVE
  // =========================
  static async listFiles(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      const conn = await service.getConnectionByProvider(userId, "google");
      if (!conn) {
        return res.status(400).json({ error: "Google Drive no conectado" });
      }

      let accessToken = conn.access_token;

      // 🔄 Refresh token si expiró
      if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
        const refreshed = await auth.refreshAccessToken(conn.refresh_token);

        accessToken = refreshed.access_token;

        await service.updateConnection(conn.id, {
          access_token: refreshed.access_token,
          expires_at: new Date(
            Date.now() + (refreshed.expires_in ?? 3600) * 1000
          ),
        });
      }

      const files = await drive.listFiles(accessToken);

      return res.json({files});
    } catch (err) {
      console.error("❌ Drive list error:", err);
      return res.status(500).json({ error: "Error listando archivos de Drive" });
    }
  }

  // =========================
  // 📌 SUBIR ARCHIVO A DRIVE
  // =========================
  static async uploadFile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { name, mimeType, base64Data, folderId } = req.body;

      if (!name || !mimeType || !base64Data || !folderId) {
        return res.status(400).json({
          error: "name, mimeType, base64Data y folderId son obligatorios",
        });
      }

      const conn = await service.getConnectionByProvider(userId, "google");
      if (!conn) {
        return res.status(400).json({ error: "Google Drive no conectado" });
      }

      let accessToken = conn.access_token;

      // 🔄 Refresh token si expiró
      if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
        const refreshed = await auth.refreshAccessToken(conn.refresh_token);

        accessToken = refreshed.access_token;

        await service.updateConnection(conn.id, {
          access_token: refreshed.access_token,
          expires_at: new Date(
            Date.now() + (refreshed.expires_in ?? 3600) * 1000
          ),
        });
      }

      // 🧼 Limpiar base64 (data:*;base64,)
      const cleanBase64 = base64Data.includes("base64,")
        ? base64Data.split("base64,")[1]
        : base64Data;

      const file = await drive.uploadFile(
        accessToken,
        name,
        mimeType,
        cleanBase64,
        folderId
      );

      return res.json({
        file,
      });
    } catch (err) {
      console.error("❌ Drive upload error:", err);
      return res.status(500).json({ error: "Error subiendo archivo a Drive" });
    }
  }
}
