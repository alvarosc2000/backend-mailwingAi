// src/config/stripe.ts
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY no definida");

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-11-17.clover",
});


// Opcional: helpers para obtener planes
export const plans = {
  starter: {
    name: "Starter",
    price: 500, // en centavos
    automations: 4,
  },
  professional: {
    name: "Professional",
    price: 1500,
    automations: 10,
  },
  unlimited: {
    name: "Unlimited",
    price: 3000,
    automations: Infinity,
  },
};
