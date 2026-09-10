import express from "express";

import { startMetaAuth, metaCallback, getMetaStatus, getAdAccounts, connectMetaAdAccount, disconnectMeta,} from "../controllers/metaController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get( "/auth", protect, startMetaAuth);
router.get( "/callback", metaCallback);
router.get( "/status", protect, getMetaStatus);
router.get( "/ad-accounts", protect, getAdAccounts);
router.post( "/connect", protect, connectMetaAdAccount);
router.delete( "/disconnect", protect, disconnectMeta);

export default router;