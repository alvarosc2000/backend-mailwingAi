// src/controllers/automationsController.ts
import { Request, Response } from "express";
import * as automations from "../services/automatizationsService";
import * as drive from "../integrations/googleDriveIntegration";
import * as sheets from "../integrations/googleSheetsIntegrations";
import { getValidGoogleAccessToken } from "../helpers/googleAuthHelper";
import { supabase } from "../config/supabase";
import { validateAutomationCreation } from "../policities/automationPolicy";
import { getUserSubscription, getAutomationLimit } from "../services/billingService";

export class AutomationsController {
  // =============================
  // CREATE
  // =============================
static async create(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ code: "NOT_AUTHENTICATED" });
    }

    const { name, description, trigger, actions, analysisLanguage } = req.body;

    if (!name || !trigger || !Array.isArray(actions)) {
      return res.status(400).json({
        code: "INVALID_PAYLOAD",
        message: "Datos incompletos",
      });
    }

    // ============================
    // VALIDACIÓN DE PLAN Y LÍMITES
    // ============================
    try {
      await validateAutomationCreation(
        userId,
        actions,
        analysisLanguage ?? "es"
      );
    } catch (e: any) {
      const statusMap: Record<string, number> = {
        NO_ACTIVE_SUBSCRIPTION: 403,
        AUTOMATION_LIMIT_REACHED: 409,
        IA_NOT_ALLOWED: 403,
        LANGUAGE_NOT_ALLOWED: 403,
      };

      const code = e.code || e.message || "VALIDATION_ERROR";

      return res
        .status(statusMap[code] ?? 400)
        .json({ code });
    }

    // ============================
    // NOMBRE ÚNICO
    // ============================
    const { data: existing, error: existingError } = await supabase
      .from("automations")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .limit(1);

    if (existingError) {
      console.error("Error comprobando nombre:", existingError);
      return res.status(500).json({ code: "INTERNAL_ERROR" });
    }

    if (existing && existing.length > 0) {
      return res.status(409).json({
        code: "AUTOMATION_ALREADY_EXISTS",
      });
    }

    // ============================
    // INTEGRACIONES
    // ============================
    const requiresGoogle = actions.some((a: any) =>
      a.type?.startsWith("sheets.") ||
      a.type?.startsWith("drive.")
    );

    const requiresTelegram = actions.some((a: any) =>
      a.type?.startsWith("telegram.")
    );

    const resources: any = {};
    let googleToken: string | null = null;

    // ---- GOOGLE ----
    if (requiresGoogle) {
      googleToken = await getValidGoogleAccessToken(userId);

      if (!googleToken) {
        return res.status(400).json({
          code: "INTEGRATION_NOT_CONNECTED",
          integration: "google",
        });
      }

      if (actions.some((a: any) => a.type.startsWith("sheets."))) {
        const sheet = await sheets.createSpreadsheet(googleToken, name, [
          "Fecha",
          "Origen",
          "Prioridad",
          "Categoría",
          "Sentimiento",
          "Requiere acción",
          "Resumen IA",
        ]);

        if (sheet?.sheetId) {
          await sheets.formatSheet(
            googleToken,
            sheet.spreadsheetId,
            sheet.sheetId
          );
        }

        resources.spreadsheetId = sheet.spreadsheetId;
        resources.sheetName = sheet.sheetName;
      }

      if (actions.some((a: any) => a.type.startsWith("drive."))) {
        const folder = await drive.createAutomationFolder(
          googleToken,
          name
        );

        resources.driveFolderId = folder.folderId;
      }
    }

    // ---- TELEGRAM ----
    if (requiresTelegram) {
      const { data: telegram } = await supabase
        .from("connections")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", "telegram")
        .single();

      if (!telegram) {
        return res.status(400).json({
          code: "INTEGRATION_NOT_CONNECTED",
          integration: "telegram",
        });
      }
    }

    // ============================
    // CREAR AUTOMATIZACIÓN
    // ============================
    const { data, error } = await automations.createAutomation(userId, {
      name,
      description,
      trigger,
      actions,
      resources,
      analysis_language: analysisLanguage ?? "es",
    });

    if (error) {
      if ((error as any).code === "23505") {
        return res.status(409).json({
          code: "AUTOMATION_ALREADY_EXISTS",
        });
      }

      console.error("Error insertando automatización:", error);
      return res.status(500).json({ code: "INTERNAL_ERROR" });
    }

    return res.status(201).json(data);

  } catch (err) {
    console.error("❌ Error creando automatización:", err);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
}


  // =============================
  // LIST ACTIVE
  // =============================
  static async list(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await automations.getActiveAutomations(userId);
    if (error) return res.status(500).json({ error: "Error listando" });

    return res.json(data ?? []);
  }

  // =============================
  // LIST PAUSED
  // =============================
  static async list_paused(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await automations.getPausedAutomations(userId);
    if (error) return res.status(500).json({ error: "Error listando" });

    return res.json(data ?? []);
  }

// =============================
// UPDATE STATUS
// =============================
static async updateStatus(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    const { status } = req.body;

    if (!id) {
      return res.status(400).json({ error: "ID requerido" });
    }

    if (!["active", "paused"].includes(status)) {
      return res.status(400).json({ error: "status inválido" });
    }

    // 🔥 Si se activa → validar límite de plan
    if (status === "active") {
      const { data: active } =
        await automations.getAllActiveAutomationsByUser(userId);

      const sub = await getUserSubscription(userId);
      const limit = sub ? getAutomationLimit(sub) : 0;

      if ((active?.length ?? 0) >= limit) {
        return res.status(409).json({
          code: "AUTOMATION_LIMIT_REACHED",
        });
      }
    }

    // ✅ Actualizar estado
    const { error } = await automations.updateAutomationStatus(
      id,
      userId,
      status
    );

    if (error) {
      console.error("Update status error:", error);
      return res.status(500).json({ error: "Update failed" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Error actualizando status:", err);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
}

// =============================
// DELETE
// =============================
static async delete(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    console.log("TOKEN USER:", userId);    
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      return res.status(400).json({ error: "ID requerido" });
    }


    console.log("DELETE USER:", userId);
    console.log("DELETE ID:", id);

    const { error } = await automations.deleteAutomation(id, userId);

    if (error) {
      console.error("Delete error:", error);
      return res.status(500).json({ error: "Delete failed" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Error eliminando automatización:", err);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
}

// =============================
// GET BY ID
// =============================
static async getById(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id) return res.status(400).json({ error: "ID requerido" });

  const { data, error } = await automations.getAutomationById(id, userId);
  if (error || !data || data.length === 0) return res.status(404).json({ error: "No encontrada" });

  return res.json({ automation: data[0] });
}

}
