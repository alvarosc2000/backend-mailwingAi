import { Request, Response } from "express";
import crypto from "crypto";
import { supabase } from "../config/supabase";
import * as connectionsService from "../services/connectionsService";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export class TelegramController {
  // --------------------------------------------------
  // 🔗 Generar link temporal de conexión
  // --------------------------------------------------
  static async generateLink(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        console.log("[generateLink] Usuario no autenticado");
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const token = `tl_${crypto.randomBytes(16).toString("hex")}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      console.log("[generateLink] Creando token para usuario:", userId, token);

      await supabase.from("telegram_link_tokens").insert({
        user_id: userId,
        token,
        expires_at: expiresAt,
        used: false,
      });

      console.log("[generateLink] Token insertado correctamente en DB");

      return res.json({ token });
    } catch (err) {
      console.error("[generateLink] Error generando link:", err);
      return res.status(500).json({ error: "Error generando link de Telegram" });
    }
  }

  // --------------------------------------------------
  // 🤖 Webhook de Telegram
  // --------------------------------------------------
  static async webhook(req: Request, res: Response) {
    console.log("[webhook] Update recibido:", JSON.stringify(req.body, null, 2));

    try {
      const update = req.body;

      // Mensaje normal con /start o /start <token>
      if (update.message?.text?.startsWith("/start")) {
        const chatId = update.message.chat.id.toString();
        const parts = update.message.text.split(" ");
        const token = parts[1]; // Puede ser undefined si solo es "/start"

        console.log("[webhook] /start recibido de chat:", chatId, "con token:", token);

        if (token) {
          await TelegramController.handleToken(chatId, token);
        } else {
          await TelegramController.sendConnectButton(chatId); // ⚡ Corregido
        }

        return res.sendStatus(200);
      }

      // Callback de botón inline
      if (update.callback_query) {
        const chatId = update.callback_query.from.id.toString();
        const token = update.callback_query.data;

        console.log("[webhook] Callback recibido de chat:", chatId, "con token:", token);

        if (token) {
          await TelegramController.handleToken(chatId, token);
        }

        // Confirmación visual en Telegram
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: update.callback_query.id }),
        });

        console.log("[webhook] Callback confirmado en Telegram");

        return res.sendStatus(200);
      }

      // Otros mensajes
      return res.sendStatus(200);
    } catch (err) {
      console.error("[webhook] Error:", err);
      return res.sendStatus(500);
    }
  }

  // --------------------------------------------------
  // 🔐 Validar token y crear conexión
  // --------------------------------------------------
  private static async handleToken(chatId: string, token: string) {
    try {
      console.log("[handleToken] Validando token:", token, "para chat:", chatId);

      const { data: link, error } = await supabase
        .from("telegram_link_tokens")
        .select("*")
        .eq("token", token)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .single();

      if (error || !link) {
        console.warn("[handleToken] Token inválido o expirado:", token);
        await TelegramController.sendMessage(chatId, "❌ Token inválido o expirado. Genera un nuevo link desde tu dashboard.");
        return;
      }

      console.log("[handleToken] Token válido, usuario:", link.user_id);

      // Marcar token como usado
      await supabase.from("telegram_link_tokens").update({ used: true }).eq("id", link.id);
      console.log("[handleToken] Token marcado como usado");

      // Eliminar conexiones previas de Telegram
      await connectionsService.deleteProviderConnections(link.user_id, "telegram");
      console.log("[handleToken] Conexiones previas eliminadas");

      // Crear nueva conexión
      const newConnection = await connectionsService.createConnection(link.user_id, {
        provider: "telegram",
        external_id: chatId,
      });
      console.log("[handleToken] Nueva conexión creada:", newConnection);

      // Confirmación al usuario
      await TelegramController.sendMessage(chatId, "✅ Telegram conectado correctamente. ¡Listo para automatizaciones!");
    } catch (err) {
      console.error("[handleToken] Error:", err);
      await TelegramController.sendMessage(chatId, "❌ Ocurrió un error al conectar Telegram.");
    }
  }

  // --------------------------------------------------
  // 🔘 Enviar botón de conexión
  // --------------------------------------------------
  private static async sendConnectButton(chatId: string) {
    console.log("[sendConnectButton] Buscando token activo para chat:", chatId);

    const { data: tokens } = await supabase
      .from("telegram_link_tokens")
      .select("*")
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!tokens || tokens.length === 0) {
      console.warn("[sendConnectButton] No se encontró token activo");
      await TelegramController.sendMessage(chatId, "❌ No se encontró token activo. Genera uno desde tu dashboard.");
      return;
    }

    const token = tokens[0].token;
    console.log("[sendConnectButton] Enviando botón con token:", token);

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Pulsa el botón para conectar MailWingAi automáticamente:",
        reply_markup: {
          inline_keyboard: [[{ text: "Conectar MailWingAi", callback_data: token }]],
        },
      }),
    });
  }

  // --------------------------------------------------
  // 📩 Enviar mensaje genérico
  // --------------------------------------------------
  static async sendMessage(chatId: string, text: string) {
    console.log("[sendMessage] Enviando mensaje a chat:", chatId, "Texto:", text);
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }
}

export const sendTelegramMessage = TelegramController.sendMessage;
