import { PlanId, PlanRules } from "../types/billings";

export const PLAN_RULES: Record<PlanId, PlanRules> = {
  basic: {
    baseAutomations: 2,
    allowsIA: false,
    allowsLanguage: false,
    extraAutomationPrice: 6,
  },
  pro: {
    baseAutomations: 3,
    allowsIA: true,
    allowsLanguage: true,
    extraAutomationPrice: 4,
  },
  advanced: {
    baseAutomations: 6,
    allowsIA: true,
    allowsLanguage: true,
    extraAutomationPrice: 3,
  },
};
