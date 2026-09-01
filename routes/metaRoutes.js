import express from "express";

import { startMetaAuth, metaCallback, getAdAccounts, connectAdAccount, getMetaStatus, disconnectMeta, syncMeta,} from "../controllers/metaController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/auth", protect, startMetaAuth);
router.get("/callback", metaCallback);
router.get("/ad-accounts", protect, getAdAccounts);
router.post("/connect", protect, connectAdAccount);
router.get("/status", protect, getMetaStatus);
router.post("/disconnect", protect, disconnectMeta);
router.post("/sync", protect, syncMeta);

export default router;