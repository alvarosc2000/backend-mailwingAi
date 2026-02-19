// src/workers/executorWorker.ts

import { sendTelegramMessage } from "../controllers/telegramController";
import * as sheets from "../integrations/googleSheetsIntegrations";
import * as drive from "../integrations/googleDriveIntegration";
import * as gmail from "../integrations/gmailIntegration";
import { getValidGoogleAccessToken } from "../helpers/googleAuthHelper";
import * as connectionsService from "../services/connectionsService";
import { GmailNewEmailTrigger } from "../types/types";
import { supabase } from "../config/supabase";

import {
  ContenidoCorreo,
  ResultadoAnalisisCorreoIA
} from "../types/aiEmailAnalysis";

import { analizarCorreoConIA } from "../services/analisisCorreoIAService";

/* =======================
   Utils
======================= */

function base64UrlToBase64(data: string): string {
  if (!data) return "";
  let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  return base64.replace(/\s/g, "");
}

/* =======================
   Tipos
======================= */

export interface EventData {
  id: string; // 🔑 ID del email (external_event_id)
  event?: string;
  payload?: any;
  from?: string;
}

export type AutomationAction =
  | { type: "telegram.send_message"; text: string }
  | { type: "sheets.append_row" }
  | { type: "drive.upload_attachment" }
  | { type: "ia.analyze_email" };

export type IdiomaAnalisis = "es" | "en";

export interface Automation {
  id: string; // ⬅️ IMPORTANTE
  user_id: string;
  trigger: GmailNewEmailTrigger;
  actions: AutomationAction[];
  analysisLanguage: IdiomaAnalisis; // ✅ ÚNICA fuente de idioma
  resources?: {
    spreadsheetId?: string;
    sheetName?: string;
    driveFolderId?: string;
  };
}

/* =======================
   Executor
======================= */

class AutomationExecutor {
  private analisisIA?: ResultadoAnalisisCorreoIA;

  constructor(
    private automation: Automation,
    private eventData: EventData
  ) {}

  async run() {
    console.log("⚙️ Ejecutando automatización para email:", this.eventData.id);

    /* =======================
       🔐 IDEMPOTENCIA (CLAVE)
    ======================= */

    const { error: executionError } = await supabase
      .from("automation_executions")
      .insert({
        automation_id: this.automation.id,
        external_event_id: this.eventData.id,
      });

    if (executionError) {
      console.log("⛔ Automatización ya ejecutada para este email");
      return;
    }

    try {
      // 1️⃣ Ejecutar IA solo 1 vez
      if (this.automation.actions.some(a => a.type === "ia.analyze_email")) {
        console.log("🧠 Ejecutando IA para este email...");
        await this.ejecutarIA();
      }

      // 2️⃣ Ejecutar acciones
      for (const action of this.automation.actions) {
        if (action.type === "ia.analyze_email") continue;

        switch (action.type) {
          case "telegram.send_message": {
            const texto =
              this.analisisIA?.resumenEjecutivo ?? action.text;
            await this.handleTelegram(texto);
            break;
          }

          case "sheets.append_row":
            await this.handleSheets();
            break;

          case "drive.upload_attachment":
            await this.handleDrive();
            break;
        }
      }

      // ✅ LOG SUCCESS
      await supabase.from("automation_logs").insert({
        automation_id: this.automation.id,
        status: "success",
        output: {
          ia: this.analisisIA,
          actions: this.automation.actions.map(a => a.type),
        },
      });

    } catch (err) {
      console.error("❌ Error ejecutando automatización:", err);

      // ❌ LOG ERROR
      await supabase.from("automation_logs").insert({
        automation_id: this.automation.id,
        status: "error",
        output: {
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  /* =======================
     IA
  ======================= */

  private async ejecutarIA() {
    try {
      const payload = this.eventData.payload?.payload;
      if (!payload) return;

      const headers = payload.headers ?? [];

      // 🔹 Extraer información básica del correo
      const asunto =
        headers.find((h: any) => h.name.toLowerCase() === "subject")?.value ?? "Sin asunto";
      const remitente =
        headers.find((h: any) => h.name.toLowerCase() === "from")?.value ?? "Desconocido";
      const fecha =
        headers.find((h: any) => h.name.toLowerCase() === "date")?.value;
      const textoPlano = gmail.extractBody(payload) ?? "";

      // 🔹 Transformar adjuntos
      const adjuntosRaw = gmail.extractAttachments(payload);
      const adjuntos = adjuntosRaw.map((a: any) => ({
        nombre: a.filename,
        tipoMime: a.mimeType,
        tamañoBytes: a.size,
        textoExtraido: a.textoExtraido
      }));

      const contenidoCorreo: ContenidoCorreo = {
        asunto,
        remitente,
        fecha,
        textoPlano,
        adjuntos,
      };

      // ✅ IDIOMA CORRECTO (ÚNICA FUENTE)
      const idiomaIA: IdiomaAnalisis =
        this.automation.analysisLanguage ?? "es";

      console.log(
        `🧠 Analizando correo con IA en idioma: ${idiomaIA.toUpperCase()} (automation.analysis_language)`
      );

      this.analisisIA = await analizarCorreoConIA(
        contenidoCorreo,
        idiomaIA
      );

      console.log("✅ Análisis IA completado");
    } catch (err) {
      console.error("❌ Error ejecutando IA:", err);
    }
  }

  /* =======================
     Telegram
  ======================= */

  private async handleTelegram(mensaje: string) {
    const conn = await connectionsService.getConnectionByProvider(
      this.automation.user_id,
      "telegram"
    );
    if (!conn) return;

    await sendTelegramMessage(conn.external_id, mensaje);
  }

  /* =======================
     Sheets
  ======================= */

  private async handleSheets() {
    const token = await getValidGoogleAccessToken(this.automation.user_id);
    if (!token) return;

    const { spreadsheetId, sheetName } = this.automation.resources ?? {};
    if (!spreadsheetId || !sheetName) return;

    const ia = this.analisisIA;

    await sheets.appendRow(token, spreadsheetId, `${sheetName}!A1`, [[
      new Date().toISOString(),
      this.eventData.from ?? "unknown",
      ia?.prioridad ?? "desconocida",
      ia?.categoria ?? "otro",
      ia?.sentimiento ?? "neutral",
      ia?.requiereAccion ? "sí" : "no",
      ia?.resumenEjecutivo ?? "Procesado sin IA",
    ]]);
  }

  /* =======================
     Drive
  ======================= */

  private async handleDrive() {
    const token = await getValidGoogleAccessToken(this.automation.user_id);
    if (!token) return;

    const folderId = this.automation.resources?.driveFolderId;
    if (!folderId) return;

    const message = await gmail.getMessageFull(token, this.eventData.id);
    if (!message?.payload) return;

    const attachments = gmail.extractAttachments(message.payload);

    for (const att of attachments) {
      if (!att.attachmentId) continue;

      const rawBase64 = await gmail.getAttachment(
        token,
        message.id,
        att.attachmentId
      );

      await drive.uploadFile(
        token,
        att.filename,
        att.mimeType,
        base64UrlToBase64(rawBase64),
        folderId
      );
    }
  }
}

/* =======================
   API pública
======================= */

export async function executeAutomation(
  automation: Automation,
  eventData: EventData
) {
  const executor = new AutomationExecutor(automation, eventData);
  await executor.run();
}
