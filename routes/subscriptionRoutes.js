import express from "express";

import {
  createCheckoutSession,
  getMySubscription,
  cancelMySubscription,
  retryMySubscriptionPayment,
} from "../controllers/subscriptionController.js";

import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/checkout", protect, createCheckoutSession);

router.get("/me", protect, getMySubscription);

router.post("/cancel", protect, cancelMySubscription);

router.post("/retry-payment", protect, retryMySubscriptionPayment);

export default router;