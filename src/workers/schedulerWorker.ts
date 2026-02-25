import cron from "node-cron";
import * as automationsService from "../services/automatizationsService";
import { runTriggerCheck } from "./triggersWorker";

export function startScheduler() {
  cron.schedule("*/5 * * * * *", async () => {
    console.log("✅ Scheduler ejecutado");

    const { data: automations, error } =
      await automationsService.getAllActiveAutomations();

    if (error) {
      console.error("❌ Error cargando automatizaciones:", error);
      return;
    }

    if (!automations || automations.length === 0) {
      console.log("⚠️ No hay automatizaciones activas");
      return;
    }

    for (const automation of automations) {
      console.log("🔔 Ejecutando trigger:", automation.name);
      await runTriggerCheck(automation);
    }
  });
}
