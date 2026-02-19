import { Request, Response } from "express";
import * as service from "../services/connectionsService";
import * as gmail from "../integrations/gmailIntegration";
import * as auth from "../integrations/googleOAuthIntegrations";
import { supabase } from "../config/supabase";

export class ConnectionsController {

  // =========================
  // LISTAR CONEXIONES
  // =========================
  static async listConnections(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const connections = await service.listConnections(userId);
      res.json(connections);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error listando conexiones" });
    }
  }

  // =========================
  // ELIMINAR CONEXIÓN
  // =========================
  static async deleteConnection(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "ID de conexión requerido" });
      }

      await service.deleteConnection(id, userId);

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error eliminando conexión" });
    }
  }

// =========================
// INICIAR OAUTH GMAIL
// =========================
static async gmailInit(req: Request, res: Response) {
  try {
    // 🔑 Token enviado desde frontend en query params
    const tokenQueryRaw = req.query.token;
    const token = Array.isArray(tokenQueryRaw) ? tokenQueryRaw[0] : tokenQueryRaw;

    if (!token || typeof token !== "string") {
      return res.status(401).json({ error: "Authorization token missing" });
    }

    // Validamos el token con Supabase
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid or expired token" });

    const userId = data.user.id;

    // Guardamos userId en state para el callback
    const state = encodeURIComponent(JSON.stringify({ userId }));

    // Generamos URL de OAuth Google
    const url = auth.generateGoogleAuthUrl(state);

    // 🔁 Redirigimos al navegador a Google
    res.redirect(url);
  } catch (err) {
    console.error("Error iniciando OAuth Gmail:", err);
    res.status(500).json({ error: "Error iniciando OAuth Gmail" });
  }
}

// =========================
// CALLBACK OAUTH
// =========================
static async gmailCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const rawState = req.query.state as string;

    if (!code || !rawState) return res.status(400).send("Missing code or state");

    // Decode the state
    let state: { userId?: string };
    try {
      state = JSON.parse(decodeURIComponent(rawState));
    } catch {
      return res.status(400).send("Invalid state");
    }

    if (!state.userId) return res.status(400).send("User not identified");

    const userId = state.userId;

    // Exchange code for tokens
    const tokens = await auth.exchangeCodeForTokens(code);

    // Delete previous Google connections
    await service.deleteProviderConnections(userId, "google");

    // Save new connection
    await service.createConnection(userId, {
      provider: "google",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    });

    // Redirect to frontend success page
    return res.redirect(`${process.env.FRONTEND_URL}/integrations/google/success`);
  } catch (err) {
    console.error("OAuth Gmail error:", err);
    return res.status(500).send("Error connecting Google");
  }
}




  // =========================
  // LISTAR EMAILS
  // =========================
  static async gmailMessages(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const conn = await service.getConnectionByProvider(userId, "google");

      if (!conn) return res.status(400).json({ error: "No hay Gmail conectado" });

      let accessToken = conn.access_token;

      // 🔄 Refrescar token si expiró
      if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
        const refreshed = await auth.refreshAccessToken(conn.refresh_token);
        accessToken = refreshed.access_token;

        await service.updateConnection(conn.id, {
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000),
        });
      }

      const emails = await gmail.getEmails(accessToken);
      res.json({ emails });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error obteniendo mensajes" });
    }
  }

  // ----------------------------------------------------
  // 📌 OBTENER EMAIL POR ID (FIX COMPLETO)
  // ----------------------------------------------------
static async gmailMessageById(req: any, res: Response) {
  try {
    const messageId = req.params.id;
    if (!messageId) {
      return res.status(400).json({ error: "Falta el ID del mensaje" });
    }

    // ❌ No hardcodees el userId
    const userId = (req as any).user.id; // 🔑 toma del middleware de auth
    const connection = await service.getConnectionByProvider(userId, "google");

    if (!connection) {
      return res.status(400).json({ error: "No hay Gmail conectado" });
    }

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    const data = await response.json();

    if (data.error) {
      return res
        .status(data.error.code || 500)
        .json({ error: data.error.message });
    }

    const decodeBase64Url = (str: string) => {
      if (!str) return "";
      str = str.replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(str, "base64").toString("utf-8");
    };

    const extractBody = (
      payload: any,
      result: { text: string; html: string }
    ) => {
      if (!payload) return;

      if (payload.mimeType === "text/plain" && payload.body?.data) {
        result.text += decodeBase64Url(payload.body.data);
      }

      if (payload.mimeType === "text/html" && payload.body?.data) {
        result.html += decodeBase64Url(payload.body.data);
      }

      if (payload.parts && payload.parts.length > 0) {
        payload.parts.forEach((part: any) => extractBody(part, result));
      }
    };

    const body = { text: "", html: "" };
    extractBody(data.payload, body);

    const headers = data.payload.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
        ?.value || "";

    const subject = getHeader("subject");
    const from = getHeader("from");
    const date = getHeader("date");

    const isRead = !data.labelIds?.includes("UNREAD");

    res.json({
      id: data.id,
      threadId: data.threadId,
      labels: data.labelIds,
      subject,
      from,
      date,
      snippet: data.snippet,
      text: body.text,
      html: body.html,
      isRead,
    });
  } catch (error) {
    console.error("Error fetching Gmail message:", error);
    res.status(500).json({ error: "Error obteniendo mensaje" });
  }
}

}
