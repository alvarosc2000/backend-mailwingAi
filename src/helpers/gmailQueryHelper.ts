// src/helpers/gmailQueryHelper.ts
import { GmailFromFilter } from "../types/types";

export function buildFromQuery(from?: GmailFromFilter): string {
  if (!from) return "";

  if (typeof from === "string") {
    return `from:${from}`;
  }

  switch (from.operator) {
    case "equals":
      return `from:${from.value}`; // exacto
    case "ends_with":
      return `from:@${from.value.replace(/^@/, "")}`; // dominio: "@gmail.com"
    case "contains":
      return `from:${from.value}`; // Gmail buscará dentro del nombre y correo
    default:
      return "";
  }
}
