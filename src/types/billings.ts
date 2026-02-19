export type PlanId = "basic" | "pro" | "advanced";

export interface PlanRules {
  baseAutomations: number;
  allowsIA: boolean;
  allowsLanguage: boolean;
  extraAutomationPrice: number;
}


export type UserSubscription = {
  plan: PlanId | null;
  status: "active" | "inactive" | "canceled";
  automations_extra: number;
};
