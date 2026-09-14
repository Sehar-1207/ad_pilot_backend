import express from "express";

import { getDashboardOverview, getDashboardPerformance, syncDashboard, getCampaignSummary, getCampaigns,
  getCampaign, getCampaignAIInsights, getSettings, updateAdAccountSync, getProfile, updateProfile, changePassword,
} from "../controllers/dashboardController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { aiRateLimiter } from "../middlewares/aiRateLimiter.js";
import { requirePro } from "../middlewares/planMiddlewaree.js";

const router = express.Router();

router.get("/overview", protect, getDashboardOverview);
router.get("/performance", protect, getDashboardPerformance);
router.get("/campaigns/summary", protect, getCampaignSummary);
router.get("/campaigns", protect, getCampaigns);
router.get("/campaigns/:campaignId", protect, getCampaign);
router.get("/campaigns/:campaignId/ai-insights", protect, requirePro, aiRateLimiter, getCampaignAIInsights);

router.post("/sync", protect, syncDashboard);
router.get("/settings", protect, getSettings);
router.patch("/settings/ad-accounts/:accountId", protect, updateAdAccountSync);

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/profile/password", protect, changePassword);

export default router;
