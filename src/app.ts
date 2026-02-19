import express from "express";
import "dotenv/config";
import cors from "cors";

import authRoutes from "./routes/authRoutes";
import connectionsRoutes from "./routes/connectionRoutes";
import telegramRoutes from "./routes/telegramRoutes";
import sheetsRoutes from "./routes/sheetsRoutes";
import driveRoutes from "./routes/driveRoutes";
import automatizationRoutes from "./routes/automatizationsRoutes";
import stripeRoutes from "./routes/stripeWebhookRoutes";
import { startScheduler } from "./workers/schedulerWorker";
import checkoutRoutes from "./routes/checkoutRoutes";
import billingRoutes from "./routes/billingRoutes"; 

const app = express();
startScheduler();

/**
 * -------------------------
 * CORS
 * -------------------------
 */
const allowedOrigins = [
  "http://localhost:3000",
  "http://192.168.1.34:3000",
  "https://mailwing-ai.com"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * -------------------------
 * 🚨 STRIPE WEBHOOK (RAW BODY)
 * -------------------------
 * DEBE ir ANTES de express.json()
 */
app.use(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeRoutes
);

/**
 * -------------------------
 * Middlewares base
 * -------------------------
 */
app.use(express.json());

/**
 * -------------------------
 * Health check
 * -------------------------
 */
app.get("/", (_, res) => {
  res.send("Servidor funcionando 🚀");
});

/**
 * -------------------------
 * Routes normales
 * -------------------------
 */
app.use("/auth", authRoutes);
app.use("/connections", connectionsRoutes);
app.use("/telegram", telegramRoutes);
app.use("/sheets", sheetsRoutes);
app.use("/drive", driveRoutes);
app.use("/automations", automatizationRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/billing", billingRoutes);

/**
 * -------------------------
 * Server
 * -------------------------
 */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

export default app;
