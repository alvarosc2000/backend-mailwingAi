// src/controllers/billingController.ts
import { Request, Response } from "express";
import {
  getUserSubscription,
  getAutomationLimit,
  canUseIA,
  canUseLanguage,
} from "../services/billingService";
import { countActiveAutomations } from "../services/automatizationsService";

export class BillingController {
  static async me(req: Request, res: Response) {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ code: "NOT_AUTHENTICATED" });
    }

    const sub = await getUserSubscription(userId);

    // 🚨 SIN SUSCRIPCIÓN ACTIVA
    if (!sub || sub.status !== "active" || !sub.plan) {
      return res.json({
        status: "inactive",
        plan: null,

        automationLimit: 0,
        activeAutomations: 0,

        canCreateAutomation: false,
        canUseIA: false,
        canUseEnglish: false,
      });
    }

    const activeAutomations = await countActiveAutomations(userId);
    const automationLimit = getAutomationLimit(sub);

    return res.json({
      status: sub.status,
      plan: sub.plan,

      automationLimit,
      activeAutomations,

      canCreateAutomation: activeAutomations < automationLimit,
      canUseIA: canUseIA(sub),
      canUseEnglish: canUseLanguage(sub),
    });
  }
}