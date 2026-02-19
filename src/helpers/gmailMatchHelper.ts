import { GmailFromFilter } from "../types/types";

/**
 * Extrae el email real desde el header FROM de Gmail
 * Ej: "Amazon AWS <aws@amazon.com>" → "aws@amazon.com"
 */
function extractEmail(fromHeader?: string): string {
  if (!fromHeader) return "";

  const match = fromHeader.match(/<([^>]+)>/);

  if (match && match[1]) {
    return match[1].toLowerCase().trim();
  }

  return fromHeader.toLowerCase().trim();
}

export function matchFromTrigger(
  fromHeader?: string,
  triggerFrom?: GmailFromFilter
): boolean {
  if (!triggerFrom) return true;
  if (!fromHeader) return false;

  const email = extractEmail(fromHeader);

  // 🔹 Trigger simple: "email@dominio.com"
  if (typeof triggerFrom === "string") {
    return email === triggerFrom.toLowerCase();
  }

  const value = triggerFrom.value.toLowerCase();

  switch (triggerFrom.operator) {
    case "equals":
      return email === value;

    case "ends_with":
      return email.endsWith(value);

    case "contains":
      return email.includes(value);

    default:
      return false;
  }
}
