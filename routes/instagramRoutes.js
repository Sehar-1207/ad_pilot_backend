import express from "express";

import { getInstagramAccounts, getConnectedInstagram, connectInstagram, syncInstagram, getInstagramInsights, getInstagramAccount, disconnectInstagram, getInstagramMedia, syncInstagramMedia, getInstagramMediaInsights,} from "../controllers/instagramController.js";
import { verifyInstagramWebhook, handleInstagramWebhook} from "../controllers/instagramWebhook.js";

import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.get("/webhook", verifyInstagramWebhook);
router.post("/webhook", handleInstagramWebhook);
router.use(protect);

router.get("/accounts", getInstagramAccounts);
router.get("/connected", getConnectedInstagram);
router.post("/connect", connectInstagram);
router.get("/account", getInstagramAccount);
router.post("/sync", syncInstagram);
router.get("/insights", getInstagramInsights);
router.delete("/disconnect", disconnectInstagram);
router.get("/media", getInstagramMedia);
router.post("/media/sync", syncInstagramMedia);
router.get("/media/insights", getInstagramMediaInsights);

export default router;