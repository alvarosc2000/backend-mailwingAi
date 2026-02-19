// src/services/triggers.service.ts
import * as automations from "./automatizationsService";
import * as gmail from "../integrations/gmailIntegration";
import * as connections from "./connectionsService";

export async function checkGmailTriggers() {
  const userId = "some_user_id"; // obtenerlo de tu contexto
  const { data: automationsList } = await automations.getActiveAutomations(userId);

  if (!automationsList) return;

  for (const automation of automationsList) {
    if (automation.trigger.type !== "gmail_new_email") continue;

    const conn = await connections.getConnectionByProvider(
      automation.user_id,
      "google"
    );
    if (!conn) continue;

    const emails = await gmail.getEmails(conn.access_token);

    // aquí luego filtraremos por remitente, asunto, adjuntos, etc
    // si hay match → ejecutar acciones
  }
}
