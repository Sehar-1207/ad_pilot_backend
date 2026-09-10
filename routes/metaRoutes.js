import express from "express";

import {
  startMetaAuth,
  metaCallback,
  getMetaStatus,
  getAdAccounts,
  connectMetaAdAccount,
  disconnectMeta,
} from "../controllers/metaController.js";

import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// OAuth
router.get(
  "/auth",
  protect,
  startMetaAuth
);

router.get(
  "/callback",
  metaCallback
);

// Connection status
router.get(
  "/status",
  protect,
  getMetaStatus
);

// Ad accounts
router.get(
  "/ad-accounts",
  protect,
  getAdAccounts
);

router.post(
  "/connect",
  protect,
  connectMetaAdAccount
);

// Disconnect
router.delete(
  "/disconnect",
  protect,
  disconnectMeta
);

export default router;