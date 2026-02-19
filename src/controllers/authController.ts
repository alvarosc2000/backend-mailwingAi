import { Request, Response } from "express";
import { supabase } from "../config/supabase";
import 'dotenv/config';

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);


/**
 * Registro de usuario
 * - Verifica que la contraseña se escriba dos veces
 * - Usa Supabase para crear el usuario
 */
export const register = async (req: Request, res: Response) => {
  const { email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ error: "Email y contraseña son requeridos" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Las contraseñas no coinciden" });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signUp({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const userId = data.user?.id;
    if (!userId) {
      return res.status(500).json({ error: "User not created" });
    }

    // ✅ Crear billing base
    const { error: billingError } = await supabaseAdmin
      .from("billing_subscriptions")
      .insert({
        user_id: userId,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        plan: null,
        status: "inactive",
        executions_used: 0,
        executions_limit: 0,
        automations_extra: 0,
        current_period_start: null,
        current_period_end: null,
      });

    if (billingError) {
      console.error("❌ Error creando billing:", billingError);
      return res.status(500).json({ error: "Billing creation failed" });
    }

    return res.status(201).json({
      message: "Usuario creado. Revisa tu email para confirmar la cuenta.",
      user: data.user,
    });

  } catch (err: any) {
    console.error("❌ Register error:", err);
    return res.status(500).json({ error: err.message });
  }
};






/**
 * Login de usuario
 */
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son requeridos" });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    // ⚡ Aquí mandamos el access_token directamente
    res.json({ 
      user: data.user, 
      token: data.session?.access_token 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Obtener información del usuario logueado
 */
export const getMe = async (req: Request, res: Response) => {
  const user = (req as any).user; // Requiere authMiddleware
  res.json({ user });
};

/**
 * Cambiar contraseña del usuario autenticado
 * - Requiere token de Service Role Key
 */
export const changePassword = async (req: Request, res: Response) => {
  const { newPassword } = req.body;
  const user = (req as any).user;

  if (!newPassword) {
    return res.status(400).json({ error: "Debes proporcionar una nueva contraseña" });
  }

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Contraseña actualizada correctamente", user: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Solicitar recuperación de contraseña
 */
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email es requerido" });

  const redirectUrl = process.env.RESET_PASSWORD_URL;
  if (!redirectUrl) return res.status(500).json({ error: "RESET_PASSWORD_URL no definida" });

  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Email de recuperación enviado", data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Cambiar contraseña desde backend usando access_token
export const resetPassword = async (req: Request, res: Response) => {
  const { newPassword, access_token } = req.body;
  if (!newPassword || !access_token)
    return res.status(400).json({ error: "Contraseña y access_token son requeridos" });

  try {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword }, access_token);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Contraseña actualizada correctamente", user: data.user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
/**
 * Reenviar confirmación de email
 */
export const resendConfirmationEmail = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ error: "Email y contraseña requeridos" });

  // Llamar a signUp de nuevo con el mismo email para reenviar confirmación
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "Email de confirmación reenviado", user: data.user });
};

