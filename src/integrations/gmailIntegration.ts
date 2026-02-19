import fetch from "node-fetch";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

// ✅ Tipos
export interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  resultSizeEstimate: number;
}

export interface GmailMessagePayload {
  headers: { name: string; value: string }[];
  body?: {
    data?: string;
    size?: number;
    attachmentId?: string;  // 🔹 Aquí estaba faltando
  };
  parts?: GmailMessagePayload[];
  filename?: string;
  mimeType: string;
}


export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  payload: GmailMessagePayload;
  snippet: string;
}

// 🔹 Lista emails (ej: is:unread from:alguien@gmail.com)
export async function getEmails(
  accessToken: string,
  query = ""
): Promise<GmailListResponse> {
  const url =
    `${GMAIL_API}/messages?maxResults=20` +
    (query ? `&q=${encodeURIComponent(query)}` : "");

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Gmail getEmails error: ${res.statusText}`);
  }

  return res.json() as Promise<GmailListResponse>;
}

// 🔹 Obtiene email completo por ID
export async function getMessageById(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  return getMessageFull(accessToken, messageId); // delega a getMessageFull
}

// 🔹 Obtiene email completo (tipado)
export async function getMessageFull(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const res = await fetch(
    `${GMAIL_API}/messages/${messageId}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gmail getMessageFull error: ${error}`);
  }

  const data = (await res.json()) as GmailMessage;
  return data;
}

// 🔹 Marca email como leído
export async function markAsRead(
  accessToken: string,
  messageId: string
): Promise<void> {
  const res = await fetch(`${GMAIL_API}/messages/${messageId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      removeLabelIds: ["UNREAD"],
    }),
  });

  if (!res.ok) {
    throw new Error(`Gmail markAsRead error: ${res.statusText}`);
  }
}

// 🔹 Obtiene attachment
export async function getAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<string> {
  const res = await fetch(
    `${GMAIL_API}/messages/${messageId}/attachments/${attachmentId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gmail attachment error: ${error}`);
  }

  const json = (await res.json()) as { data?: string };

  if (!json.data) {
    throw new Error("Gmail attachment vacío");
  }

  return json.data;
}



// 🔍 Extraer attachments del payload (recursivo)
export function extractAttachments(
  part: GmailMessagePayload,
  result: { filename: string; mimeType: string; attachmentId: string }[] = []
) {
  if (!part) return result;

  // 🔹 Si es un adjunto real
  if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
    result.push({
      filename: part.filename,
      mimeType: part.mimeType,
      attachmentId: part.body.attachmentId,
    });
  }

  // 🔹 Recursión sobre subpartes
  if (part.parts && Array.isArray(part.parts)) {
    for (const sub of part.parts) {
      extractAttachments(sub, result);
    }
  }

  return result;
}

// 🔹 Extrae texto plano del body Gmail (recursivo)
export function extractBody(
  part?: GmailMessagePayload
): string {
  if (!part) return "";

  // Texto directo
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64").toString("utf-8");
  }

  // Multipart
  if (part.parts && Array.isArray(part.parts)) {
    for (const sub of part.parts) {
      const text = extractBody(sub);
      if (text) return text;
    }
  }

  return "";
}

