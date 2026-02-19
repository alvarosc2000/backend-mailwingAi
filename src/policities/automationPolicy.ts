import { supabase } from "../config/supabase";
import {
  getUserSubscription,
  getAutomationLimit,
  canUseIA,
  canUseLanguage
} from "../services/billingService";

export async function validateAutomationCreation(
  userId: string,
  actions: any[],
  analysisLanguage: "es" | "en"
) {
  const sub = await getUserSubscription(userId);

  // 🔴 1. No subscription or inactive
  if (!sub || sub.status !== "active") {
    const error: any = new Error("NO_ACTIVE_SUBSCRIPTION");
    error.code = "NO_ACTIVE_SUBSCRIPTION";
    throw error;
  }

  // 🔵 2. Count active automations
  const { count, error: countError } = await supabase
    .from("automations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  if (countError) throw countError;

  const limit = getAutomationLimit(sub);

  if ((count ?? 0) >= limit) {
    const error: any = new Error("AUTOMATION_LIMIT_REACHED");
    error.code = "AUTOMATION_LIMIT_REACHED";
    throw error;
  }

  // 🧠 3. IA validation
  const usesIA = actions.some(a => a.type?.startsWith("ia."));
  if (usesIA && !canUseIA(sub)) {
    const error: any = new Error("IA_NOT_ALLOWED");
    error.code = "IA_NOT_ALLOWED";
    throw error;
  }

  // 🌍 4. Language validation
  if (analysisLanguage === "en" && !canUseLanguage(sub)) {
    const error: any = new Error("LANGUAGE_NOT_ALLOWED");
    error.code = "LANGUAGE_NOT_ALLOWED";
    throw error;
  }

  return true;
}
