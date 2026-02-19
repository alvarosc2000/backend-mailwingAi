import { supabase } from "../config/supabase";
import { PLAN_RULES } from "./planRulesService";
import { UserSubscription } from "../types/billings";

// src/services/billingService.ts

export async function getUserSubscription(
  userId: string
): Promise<UserSubscription | null> {
  // 1️⃣ Obtener suscripción base
  const { data: sub, error } = await supabase
    .from("billing_subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .single();

  if (error || !sub) return null;

  // 2️⃣ Si no está activa → no tiene derechos
  if (sub.status !== "active" || !sub.plan) {
    return {
      plan: null,
      automations_extra: 0,
      status: "inactive",
    };
  }

  // 3️⃣ Calcular extras del mes (solo si active)
  const { data: extras } = await supabase
    .from("billing_extras")
    .select("quantity")
    .eq("user_id", userId);

  const automations_extra =
    extras?.reduce((sum, e) => sum + (e.quantity ?? 0), 0) ?? 0;

  return {
    plan: sub.plan,
    automations_extra,
    status: sub.status,
  };
}



// =====================
// Función segura que verifica que plan exista
// =====================
function getPlanRules(plan: string | null) {
  if (!plan || !(plan in PLAN_RULES)) {
    throw new Error("Invalid plan or plan is null");
  }
  return PLAN_RULES[plan as keyof typeof PLAN_RULES];
}

export function getAutomationLimit(sub: UserSubscription) {
  const rules = getPlanRules(sub.plan);
  return rules.baseAutomations + sub.automations_extra;
}

export function canUseIA(sub: UserSubscription) {
  const rules = getPlanRules(sub.plan);
  return rules.allowsIA;
}

export function canUseLanguage(sub: UserSubscription) {
  const rules = getPlanRules(sub.plan);
  return rules.allowsLanguage;
}
