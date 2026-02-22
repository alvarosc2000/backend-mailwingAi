// src/services/automatizationsService.ts
import { supabase } from "../config/supabase";
import * as connectionsService from "./connectionsService";
import * as gmail from "../integrations/gmailIntegration";
import { buildFromQuery } from "../helpers/gmailQueryHelper";

/* =========================================================
   CREATE AUTOMATION
   Se encarga de ignorar emails previos y guardar en DB
========================================================= */
export async function createAutomation(
  userId: string,
  data: {
    name: string;
    description?: string;
    trigger: any;
    actions: any;
    resources?: {
      spreadsheetId?: string;
      sheetName?: string;
      driveFolderId?: string;
    };
    analysis_language?: "es" | "en";
  }
) {
  // 🔥 Ignorar correos previos si trigger Gmail
  if (data.trigger.type === "gmail.new_email") {
    const conn = await connectionsService.getConnectionByProvider(userId, "google");
    if (conn) {
      const fromQuery = buildFromQuery(data.trigger.from);
      const query = `is:unread ${fromQuery}`;
      const emails = await gmail.getEmails(conn.access_token, query);
      for (const msg of emails.messages ?? []) {
        await gmail.markAsRead(conn.access_token, msg.id);
      }
    }
  }

  // 🔹 Insertar automatización en DB
  return supabase
    .from("automations")
    .insert([{
      user_id: userId,
      name: data.name,
      description: data.description,
      trigger: data.trigger,
      actions: data.actions,
      resources: data.resources,
      status: "active",
      analysis_language: data.analysis_language ?? "es",
    }])
    .select()
    .single();
}

/* =========================================================
   GET AUTOMATIONS
========================================================= */
export async function getActiveAutomations(userId: string) {
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  return {
    data: data?.map(row => ({ ...row, analysisLanguage: row.analysis_language ?? "es" })) ?? [],
    error,
  };
}

export async function getPausedAutomations(userId: string) {
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "paused");

  return {
    data: data?.map(row => ({ ...row, analysisLanguage: row.analysis_language ?? "es" })) ?? [],
    error,
  };
}

export async function getAutomationById(id: string, userId: string) {
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId);

  return { data, error };
}

/* =========================================================
   UPDATE STATUS
   Permite cambiar active <-> paused
========================================================= */
export async function updateAutomationStatus(
  automationId: string,
  userId: string,
  status: "active" | "paused"
) {
  return supabase
    .from("automations")
    .update({ status })
    .eq("id", automationId)
   // .eq("user_id", userId)
    .select(); // No single() para mantener consistencia
}

/* =========================================================
   DELETE AUTOMATION
========================================================= */
export async function deleteAutomation(id: string, userId: string) {
  return supabase
    .from("automations")
    .delete()
    .eq("id", id)
   //.eq("user_id", userId)
    .select(); // Devuelve data si eliminó algo
}

/* =========================================================
   UTILS PARA PLAN Y LÍMITES
========================================================= */
export async function countActiveAutomations(userId: string) {
  const { count } = await supabase
    .from("automations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");
  return count ?? 0;
}

export async function getAllActiveAutomations() {
  return supabase
    .from("automations")
    .select("*")
    .eq("status", "active");
}

export async function getAllActiveAutomationsByUser(userId: string) {
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  return {
    data: data?.map(row => ({ ...row, analysisLanguage: row.analysis_language ?? "es" })) ?? [],
    error,
  };
}
