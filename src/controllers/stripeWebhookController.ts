import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../config/stripe";
import { supabase } from "../config/supabase";
import { PLAN_RULES } from "../services/planRulesService";
import { PlanId } from "../types/billings";

export const stripeWebhook = async (req: Request, res: Response) => {
  let event: Stripe.Event;

  // ===== VERIFY SIGNATURE =====
  try {
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string")
      return res.status(400).send("Missing Stripe signature");

    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("❌ Webhook signature error:", err);
    return res.status(400).send("Webhook signature verification failed");
  }

  // ===== PREVENT DUPLICATES =====
  const { data: exists } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .single();

  if (exists) return res.status(200).json({ received: true });

  await supabase.from("stripe_events").insert({ id: event.id });

  try {
    // =========================================================
    // CHECKOUT SESSION COMPLETED → CREA SUSCRIPCIÓN PENDING
    // =========================================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const type = session.metadata?.type;
      const plan = session.metadata?.plan as PlanId | undefined;

      if (!userId || !type) return res.status(200).json({ received: true });

      // ===== PLAN BASE =====
      if (type === "base" && session.subscription) {
        if (!plan || !(plan in PLAN_RULES))
          throw new Error("Plan inválido");

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        await supabase.from("billing_extras").delete().eq("user_id", userId);

        await supabase.from("billing_subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: subscription.id,
          plan,
          status: "pending",
          executions_used: 0,
          automations_extra: 0,
        });
      }

      // ===== EXTRAS =====
      if (type === "extra") {
        const quantity = Number(session.metadata?.quantity ?? 1);

        const { data: subRow } = await supabase
          .from("billing_subscriptions")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")
          .single();

        if (!subRow) return res.status(200).json({ received: true });

        await supabase.from("billing_extras").insert({
          user_id: userId,
          quantity,
          source: "stripe",
          subscription_id: subRow.id,
          period_start: subRow.current_period_start,
          period_end: subRow.current_period_end,
        });
      }
    }

    // =========================================================
    // ⭐ ACTIVACIÓN REAL DE SUSCRIPCIÓN (EVENTO CORRECTO)
    // =========================================================
    if (event.type === "customer.subscription.created") {
      const subscription = event.data.object as Stripe.Subscription;

      const subscriptionId = subscription.id;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      const item = subscription.items.data[0];

      if (!item) {
        console.error("Subscription without items:", subscription.id);
        return res.status(200).json({ received: true });
      }

      const start = new Date(item.current_period_start * 1000);
      const end = new Date(item.current_period_end * 1000);

      const { data: subRow } = await supabase
        .from("billing_subscriptions")
        .select("*")
        .eq("stripe_subscription_id", subscriptionId)
        .single();

      if (!subRow) return res.status(200).json({ received: true });

      await supabase
        .from("billing_subscriptions")
        .update({
          status: "active",
          current_period_start: start,
          current_period_end: end,
          stripe_customer_id: customerId,
        })
        .eq("stripe_subscription_id", subscriptionId);
    }

    // =========================================================
    // INVOICE PAID → RENOVACIONES FUTURAS
    // =========================================================
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string;
      };

      if (!invoice.subscription) {
        console.warn("Invoice without subscription:", invoice.id);
        return res.status(200).json({ received: true });
      }

      const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription
      );

      const item = subscription.items.data[0];

      if (!item) {
        console.error("Subscription without items:", subscription.id);
        return res.status(200).json({ received: true });
      }

      const start = new Date(item.current_period_start * 1000);
      const end = new Date(item.current_period_end * 1000);

      const { data: subRow } = await supabase
        .from("billing_subscriptions")
        .select("*")
        .eq("stripe_subscription_id", subscription.id)
        .single();

      if (!subRow) return res.status(200).json({ received: true });

      await supabase
        .from("billing_extras")
        .delete()
        .eq("user_id", subRow.user_id);

      await supabase
        .from("billing_subscriptions")
        .update({
          status: "active",
          executions_used: 0,
          automations_extra: 0,
          current_period_start: start,
          current_period_end: end,
        })
        .eq("stripe_subscription_id", subscription.id);
    }

    // =========================================================
    // SUBSCRIPTION CANCELED
    // =========================================================
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      await supabase
        .from("billing_subscriptions")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", subscription.id);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
};