// src/services/executor.service.ts
import * as sheets from "../integrations/googleSheetsIntegrations";
import { TelegramController } from "../controllers/telegramController";

export async function executeActions(
  actions: any[],
  context: any
) {
  for (const action of actions) {
    switch (action.type) {
      case "telegram_message":
        await TelegramController.sendMessage(
          action.chatId,
          action.text
        );
        break;

      case "sheets_append":
        await sheets.appendRow(
          context.accessToken,
          action.spreadsheetId,
          action.range,
          action.values
        );
        break;

      // drive_upload → siguiente paso
    }
  }
}
