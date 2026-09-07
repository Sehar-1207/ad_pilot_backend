import express from "express";

import { getDashboardOverview, getDashboardPerformance, syncDashboard, getCampaignSummary, getCampaigns,
  getCampaign, askAI, askCampaignAI, getAIConversations, getAIConversation, getCampaignAIInsights, getSettings, updateSyncSettings, updateAdAccountSync, getNotifications, updateNotifications, getProfile, updateProfile, changePassword,
} from "../controllers/dashboardController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { aiRateLimiter } from "../middlewares/aiRateLimiter.js";
import { requirePro } from "../middlewares/planMiddlewaree.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
const router = express.Router();

requireRole("USER", "ADMIN");
router.get("/overview", protect, getDashboardOverview);
router.get("/performance", protect, getDashboardPerformance);
router.get("/campaigns/summary", protect, getCampaignSummary);
router.get("/campaigns", protect, getCampaigns);
router.get("/campaigns/:campaignId", protect, getCampaign);
router.get("/ai/conversations", protect, requirePro, getAIConversations);
router.get( "/ai/conversations/:conversationId", protect, requirePro, getAIConversation,);
router.post("/ai", protect, requirePro, aiRateLimiter, askAI);
router.post( "/campaigns/:campaignId/ai", protect, requirePro, aiRateLimiter, askCampaignAI,);
router.get("/campaigns/:campaignId/ai-insights", protect, requirePro, aiRateLimiter, getCampaignAIInsights,);

// META SYNC
router.post("/sync", protect, syncDashboard);

router.get("/settings", protect, getSettings);
router.put("/settings/sync", protect, updateSyncSettings);
router.patch("/settings/ad-accounts/:accountId", protect, updateAdAccountSync);

router.get("/settings/notifications", protect, getNotifications);
router.put("/settings/notifications", protect, updateNotifications);

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/profile/password", protect, changePassword);

export default router;
