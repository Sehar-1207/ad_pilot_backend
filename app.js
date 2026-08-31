import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import userRoutes from "./routes/userRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import contactRoutes from "./routes/contactRoute.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import metaRoutes from "./routes/metaRoutes.js";

import { handleStripeWebhook } from "./controllers/webhookController.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Stripe Webhook
app.post(
  "/api/subscriptions/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);


// Health Check
app.get("/health", (req, res) =>
  res.json({
    status: "OK",
    timestamp: new Date(),
  })
);

// API Routes
app.use("/api/auth", userRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/meta",metaRoutes);
app.use("/api/admin", adminRoutes);

// Error 404 Handler
app.use((req, res) =>
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.originalUrl}`,
  })
);


// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
});


export default app;