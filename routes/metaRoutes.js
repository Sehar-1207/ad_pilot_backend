import express from "express";

import { startMetaAuth, metaCallback, getMetaStatus, getAdAccounts, connectMetaAdAccount, disconnectMetaAdAccount, getConnectedAdAccounts, disconnectMeta, syncMeta,} from "../controllers/metaController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/auth", protect, startMetaAuth);
router.get("/callback", metaCallback);
router.get("/status", protect, getMetaStatus);
router.get("/ad-accounts", protect, getAdAccounts);
router.get("/ad-accounts/connected", protect, getConnectedAdAccounts);
router.post("/connect", protect, connectMetaAdAccount);
router.delete("/ad-accounts/:accountId", protect, disconnectMetaAdAccount);
router.delete("/disconnect", protect, disconnectMeta);
router.post("/sync", protect, syncMeta);

export default router;