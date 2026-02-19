import { executeAutomation } from "./executorWorker";
import * as connectionsService from "../services/connectionsService";
import * as gmail from "../integrations/gmailIntegration";
import * as auth from "../integrations/googleOAuthIntegrations";
import * as automationsService from "../services/automatizationsService";
import { buildFromQuery } from "../helpers/gmailQueryHelper";
import { matchFromTrigger } from "../helpers/gmailMatchHelper";
import { supabase } from "../config/supabase";

export async function runTriggerCheck(automation: any) {
  // Solo Gmail por ahora
  if (automation.trigger?.type !== "gmail.new_email") return;

  const conn = await connectionsService.getConnectionByProvider(
    automation.user_id,
    "google"
  );

  if (!conn) {
    console.warn("⚠️ Usuario sin conexión Google");
    return;
  }

  /* ===========================
     TOKEN
  =========================== */

  let accessToken = conn.access_token;

  if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
    try {
      const refreshed = await auth.refreshAccessToken(conn.refresh_token);
      accessToken = refreshed.access_token;

      await connectionsService.updateConnection(conn.id, {
        access_token: refreshed.access_token,
        expires_at: new Date(
          Date.now() + (refreshed.expires_in ?? 3600) * 1000
        ),
      });

      console.log("🔄 Token Google refrescado");
    } catch (err) {
      console.error("❌ Error refrescando token Google:", err);
      return;
    }
  }

  /* ===========================
     GMAIL QUERY
  =========================== */

  const fromTrigger = automation.trigger.from;
  const fromQuery = buildFromQuery(fromTrigger);
  const query = `is:unread ${fromQuery}`;

  let emails;
  try {
    emails = await gmail.getEmails(accessToken, query);
  } catch (err) {
    console.error("❌ Error buscando emails en Gmail:", err);
    return;
  }

  if (!emails.messages || emails.messages.length === 0) {
    console.log("📭 No hay emails nuevos para esta automatización");
    return;
  }

  console.log(
    "📧 Emails candidatos:",
    emails.messages.map((m: any) => m.id)
  );

  /* ===========================
     PROCESAR EMAILS
  =========================== */

  for (const msg of emails.messages) {
    if (!msg.id) continue;

    let fullMessage;
    try {
      fullMessage = await gmail.getMessageById(accessToken, msg.id);
    } catch (err) {
      console.error("❌ Error obteniendo email completo:", msg.id, err);
      continue;
    }

    const headers = fullMessage.payload?.headers ?? [];
    const fromHeader =
      headers.find((h: any) => h.name.toLowerCase() === "from")?.value ?? "";

    // 🔒 VALIDAR TRIGGER REAL
    if (!matchFromTrigger(fromHeader, fromTrigger)) {
      console.log("⛔ Email no cumple trigger FROM:", fromHeader);

      // 🔕 Marcar como leído para no reprocesarlo
      try {
        await gmail.markAsRead(accessToken, msg.id);
      } catch (err) {
        console.error("⚠️ Error marcando email como leído:", msg.id, err);
      }

      continue;
    }

    /* ===========================
       OBTENER TODAS LAS AUTOMATIZACIONES ACTIVAS DEL USUARIO
       QUE COINCIDAN CON EL MISMO TRIGGER
    =========================== */

    let activeAutomations;
    try {
      const { data, error } = await automationsService.getAllActiveAutomationsByUser(
        automation.user_id
      );

      if (error || !data) {
        console.error("❌ Error obteniendo automatizaciones activas:", error);
        continue;
      }

      // Filtrar solo las que coincidan con el mismo trigger
      activeAutomations = data.filter((a: any) =>
        a.trigger?.type === "gmail.new_email" &&
        matchFromTrigger(fromHeader, a.trigger.from)
      );
    } catch (err) {
      console.error("❌ Error filtrando automatizaciones activas:", err);
      continue;
    }

    /* ===========================
       EJECUTAR TODAS LAS AUTOMATIZACIONES QUE APLICAN
    =========================== */

    for (const auto of activeAutomations) {
      try {
        await executeAutomation(auto, {
          event: "gmail.new_email",
          id: fullMessage.id,
          payload: fullMessage,
          from: fromHeader,
        });
      } catch (err) {
        console.error(
          `❌ Error ejecutando automatización ${auto.id} para email ${msg.id}:`,
          err
        );
      }
    }

    /* ===========================
       ✅ MARCAR COMO LEÍDO SOLO SI TODAS LAS AUTOMATIZACIONES
       SE EJECUTARON
    =========================== */

    try {
      await gmail.markAsRead(accessToken, msg.id);
      console.log("✅ Email marcado como leído:", msg.id);
    } catch (err) {
      console.error("⚠️ Error marcando email como leído:", msg.id, err);
    }
  }
}
