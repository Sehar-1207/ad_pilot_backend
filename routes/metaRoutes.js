import express from "express";

import {startMetaAuth, metaCallback, listAdAccounts, connectAdAccount, getMetaStatus, disconnectMeta, syncMetaData,} from "../controllers/metaController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.get("/auth", protect, startMetaAuth);

// Meta OAuth callback
router.get("/callback", metaCallback);

// META ACCOUNT
router.get("/status", protect, getMetaStatus);
router.get("/ad-accounts", protect, listAdAccounts);
router.post("/connect", protect, connectAdAccount);
router.post("/disconnect", protect, disconnectMeta);

// META DATA SYNC
router.post("/sync", protect, syncMetaData);

export default router;