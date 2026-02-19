import { Request, Response } from "express";
import { stripe } from "../config/stripe";
import { supabase } from "../config/supabase";

// ================== CHECKOUT GENERAL ==================
export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { priceId, plan, type, quantity } = req.body;
    const userId = (req as any).user?.id;
    const email = (req as any).user?.email;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!priceId || !type)
      return res.status(400).json({ error: "Datos de checkout incompletos" });

    const isExtra = type === "extra";

    const session = await stripe.checkout.sessions.create({
      mode: isExtra ? "payment" : "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      client_reference_id: userId,

      // 🔥 METADATA GLOBAL (para pagos únicos)
      metadata: {
        type, // "base" | "extra"
        plan: plan ?? "",
        quantity: String(quantity ?? 1),
        user_id: userId,
      },

      // 🔥 METADATA EN SUBSCRIPTION (CLAVE para invoice.paid)
      ...(isExtra
        ? {}
        : {
            subscription_data: {
              metadata: {
                type: "base",
                plan: plan ?? "",
                user_id: userId,
              },
            },
          }),

      line_items: [
        {
          price: priceId,
          quantity: quantity ?? 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout error:", err);
    return res.status(500).json({ error: "Error creando sesión de pago" });
  }
};

// ================== CHECKOUT EXTRAS ==================
export const createExtraCheckoutSession = async (
  req: Request,
  res: Response
) => {
  try {
    const { quantity } = req.body;
    const userId = (req as any).user?.id;
    const email = (req as any).user?.email;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // 1️⃣ Obtener suscripción activa
    const { data: sub, error } = await supabase
      .from("billing_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (error || !sub)
      return res.status(400).json({ error: "No tienes plan activo" });

    // 2️⃣ Price según plan
    const allowedPrices: Record<string, string> = {
      basic: process.env.STRIPE_PRICE_EXTRA_BASIC!,
      pro: process.env.STRIPE_PRICE_EXTRA_PRO!,
      advanced: process.env.STRIPE_PRICE_EXTRA_ADVANCED!,
    };

    const priceId = allowedPrices[sub.plan];
    if (!priceId)
      return res
        .status(403)
        .json({ error: "Extras no permitidos para tu plan" });

    // 3️⃣ Crear sesión Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      client_reference_id: userId,
      metadata: {
        type: "extra",
        plan: sub.plan,
        quantity: String(quantity ?? 1),
        user_id: userId,
      },
      line_items: [
        {
          price: priceId,
          quantity: quantity ?? 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Extra checkout error:", err);
    return res
      .status(500)
      .json({ error: "Error creando checkout de extras" });
  }
};
