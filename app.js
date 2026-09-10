import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import userRoutes from "./routes/userRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import contactRoutes from "./routes/contactRoute.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import metaRoutes from "./routes/metaRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

import { handleStripeWebhook } from "./controllers/webhookController.js";

const app = express();

app.use(helmet());

const allowedOrigins =[
  "http://localhost:3000",
  "https://ad-pilot-one.vercel.app",
  ];
  
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) { return callback(null, true); }
      return callback(new Error(`CORS blocked for origin: ${origin}`)
      );
    }, credentials: true,
  }));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Ad Pilot Backend is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Ad Pilot API is healthy",
  });
});

app.post(
  "/api/subscriptions/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", userRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.originalUrl}`,
  });
});

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