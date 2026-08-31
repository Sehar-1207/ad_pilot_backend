import { User } from "../models/User.js";
import { Campaign } from "../models/Campaign.js";
import { UserSettings } from "../models/UserSettings.js";
import { AIConversation } from "../models/AiConversation.js";
import { hashPassword, comparePassword, } from "../utils/security.js";
import { generateAIResponse } from "../utils/geminiService.js";

// HELPERS
const getDateFromRange = (range) => {
  const now = new Date();
  const days = { "7d": 7, "14d": 14, "30d": 30, "90d": 90, };
  const numberOfDays = days[range] || 7;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - numberOfDays);
  return startDate;
};


const calculateHealth = (campaign) => {
  const roas = Number(campaign.roas || 0);
  const ctr = Number(campaign.ctr || 0);
  if (roas >= 3) {
    return "PROFITABLE";
  }
  if (ctr < 1 || roas < 1) {
    return "NEEDS_ATTENTION";
  }
  if (ctr < 1.5) {
    return "FATIGUED";
  }
  return "NORMAL";
};


const serializeCampaign = (campaign) => ({
  id: campaign.metaCampaignId,
  name: campaign.name,
  status: campaign.status?.toLowerCase(),
  health: campaign.health,
  adAccountId: campaign.adAccountId,
  adAccountName: campaign.adAccountName,
  spend: Number(campaign.spend || 0),
  impressions: Number(campaign.impressions || 0),
  reach: Number(campaign.reach || 0),
  clicks: Number(campaign.clicks || 0),
  ctr: Number(campaign.ctr || 0),
  cpc: Number(campaign.cpc || 0),
  cpm: Number(campaign.cpm || 0),
  conversions: Number(campaign.conversions || 0),
  costPerConversion: Number(campaign.costPerConversion || 0),
  revenue: Number(campaign.revenue || 0),
  roas: Number(campaign.roas || 0),
  lastSyncedAt: campaign.lastSyncedAt,
});

// GET /api/dashboard/overview
export const getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user._id;
    const campaigns = await Campaign.find({ user: userId, }).lean();
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === "ACTIVE");
    const totalSpend = campaigns.reduce((sum, campaign) => sum + Number(campaign.spend || 0), 0);
    const totalRevenue = campaigns.reduce((sum, campaign) => sum + Number(campaign.revenue || 0), 0);
    const totalClicks = campaigns.reduce((sum, campaign) => sum + Number(campaign.clicks || 0), 0);
    const totalImpressions = campaigns.reduce((sum, campaign) => sum + Number(campaign.impressions || 0), 0);
    const totalConversions = campaigns.reduce((sum, campaign) => sum + Number(campaign.conversions || 0), 0);
    const averageRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const needsAttention = campaigns.filter((campaign) => campaign.health === "NEEDS_ATTENTION" || campaign.health === "FATIGUED").length;

    res.json({
      success: true, data: {
        totalActiveCampaigns: activeCampaigns.length, totalCampaigns: campaigns.length, totalSpend: Number(totalSpend.toFixed(2)),
        totalRevenue: Number(totalRevenue.toFixed(2)), averageRoas: Number(averageRoas.toFixed(2)), averageCtr: Number(averageCtr.toFixed(2)),
        totalClicks, totalImpressions, totalConversions, needsAttention
      }
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard overview",
    });
  }
};

// GET /api/dashboard/performance
export const getDashboardPerformance = async (req, res) => {
  try {
    const userId = req.user._id;
    const range = req.query.range || "7d";
    const startDate = getDateFromRange(range);
    const campaigns = await Campaign.find({ user: userId, lastSyncedAt: { $gte: startDate, } }).lean();
    const totalSpend = campaigns.reduce((sum, campaign) => sum + Number(campaign.spend || 0), 0);
    const totalRevenue = campaigns.reduce((sum, campaign) => sum + Number(campaign.revenue || 0), 0);
    const totalClicks = campaigns.reduce((sum, campaign) => sum + Number(campaign.clicks || 0), 0);
    const totalImpressions = campaigns.reduce((sum, campaign) => sum + Number(campaign.impressions || 0), 0);
    const totalConversions = campaigns.reduce((sum, campaign) => sum + Number(campaign.conversions || 0), 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;

    res.json({ success: true, data: { range, spend: Number(totalSpend.toFixed(2)), revenue: Number(totalRevenue.toFixed(2)), impressions: totalImpressions, clicks: totalClicks, conversions: totalConversions, ctr: Number(ctr.toFixed(2)), cpc: Number(cpc.toFixed(2)), cpm: Number(cpm.toFixed(2)), roas: Number(roas.toFixed(2)), costPerConversion: Number(costPerConversion.toFixed(2)), }, });
  } catch (error) {
    console.error("Dashboard performance error:", error);
    res.status(500).json({ success: false, message: "Failed to load dashboard performance", });
  }
};

// GET /api/dashboard/campaigns/summary
export const getCampaignSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const campaigns = await Campaign.find({ user: userId, status: { $in: ["ACTIVE", "PAUSED"] } }).lean();
    const totalActiveCampaigns = campaigns.filter((campaign) => campaign.status === "ACTIVE").length;
    const totalSpend = campaigns.reduce((sum, campaign) => sum + Number(campaign.spend || 0), 0);
    const totalRevenue = campaigns.reduce((sum, campaign) => sum + Number(campaign.revenue || 0), 0);
    const averageRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const needsAttention = campaigns.filter((campaign) => campaign.health === "NEEDS_ATTENTION" || campaign.health === "FATIGUED").length;
    const fatigued = campaigns.filter((campaign) => campaign.health === "FATIGUED").length;

    res.json({ success: true, data: { totalActiveCampaigns, totalSpend: Number(totalSpend.toFixed(2)), averageRoas: Number(averageRoas.toFixed(2)), needsAttention, fatigued } });
  } catch (error) {
    console.error("Campaign summary error:", error);
    res.status(500).json({ success: false, message: "Failed to load campaign summary", });
  }
};

// GET /api/dashboard/campaigns 
export const getCampaigns = async (req, res) => {
  try {
    const userId = req.user._id;
    const { search = "", status = "all", health = "all", range = "7d", page = 1, limit = 20, } = req.query;
    const filter = { user: userId, };
    if (status && status.toLowerCase() !== "all") {
      filter.status = status.toUpperCase();
    }

    if (health && health.toLowerCase() !== "all") {
      filter.health = health.toUpperCase();
    }

    if (search.trim()) {
      filter.name = { $regex: search.trim(), $options: "i", };
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const [campaigns, total] = await Promise.all([Campaign.find(filter).sort({ spend: -1, }).skip(skip).limit(limitNumber).lean(),
    Campaign.countDocuments(filter),
    ]);

    res.json({
      success: true, data: {
        campaigns: campaigns.map(serializeCampaign), pagination: { page: pageNumber, limit: limitNumber, total, pages: Math.ceil(total / limitNumber), }, range,
      },
    });
  } catch (error) {
    console.error("Get campaigns error:", error);
    res.status(500).json({ success: false, message: "Failed to load campaigns", });
  }
};

// GET /api/dashboard/campaigns/:campaignId
export const getCampaign = async (req, res) => {
  try {
    const userId = req.user._id;
    const campaign = await Campaign.findOne({ user: userId, metaCampaignId: req.params.campaignId, }).lean();

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found", });
    }
    res.json({ success: true, data: serializeCampaign(campaign), });

  } catch (error) {
    console.error("Get campaign error:", error);
    res.status(500).json({ success: false, message: "Failed to load campaign", });
  }
};

// POST /api/dashboard/ai
export const askAI = async (req, res) => {
  try {
    const userId = req.user._id;
    const { question, conversationId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: "Question is required", });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    if (user.plan !== "PRO") {
      return res.status(403).json({ success: false, code: "PRO_REQUIRED", message: "AI suggestions are available on the Pro plan.", });
    }

    const campaigns = await Campaign.find({ user: userId, }).select(["metaCampaignId", "name", "status", "health", "spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "conversions", "costPerConversion", "revenue", "roas",].join(" ")).lean();
    let conversation = null;

    if (conversationId) {
      conversation = await AIConversation.findOne({ _id: conversationId, user: userId, });
    }

    const previousMessages = conversation?.messages?.slice(-10) || [];
    const answer = await generateAIResponse({ question: question.trim(), campaignData: campaigns, conversationHistory: previousMessages.map((message) => ({ role: message.role, content: message.content, })) });

    if (!conversation) {
      conversation = await AIConversation.create({ user: userId, title: question.trim().slice(0, 80), messages: [], });
    }

    conversation.messages.push({ role: "user", content: question.trim(), });
    conversation.messages.push({ role: "assistant", content: answer, });
    await conversation.save();

    res.status(200).json({ success: true, data: { conversationId: conversation._id, question: question.trim(), answer, campaignsAnalyzed: campaigns.length, }, });
  } catch (error) {
    console.error("AI error:", error);

    res.status(500).json({ success: false, message: "Failed to generate AI response", });
  }
};

// POST /api/dashboard/campaigns/:campaignId/ai
export const askCampaignAI = async (req, res) => {
  try {
    const userId = req.user._id;
    const { question, conversationId, } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: "Question is required", });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    if (user.plan !== "PRO") {
      return res.status(403).json({ success: false, code: "PRO_REQUIRED", message: "AI suggestions are available on the Pro plan.", });
    }

    const campaign = await Campaign.findOne({ user: userId, metaCampaignId: req.params.campaignId, }).select(["metaCampaignId", "name", "status", "health", "spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "conversions", "costPerConversion", "revenue", "roas",].join(" ")).lean();

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found", });
    }

    let conversation = null;
    if (conversationId) {
      conversation = await AIConversation.findOne({ _id: conversationId, user: userId, campaignId: campaign.metaCampaignId, });
    }

    const previousMessages = conversation?.messages?.slice(-10) || [];
    const answer = await generateAIResponse({ question: question.trim(), campaignData: campaign, conversationHistory: previousMessages.map((message) => ({ role: message.role, content: message.content, })), });

    if (!conversation) {
      conversation = await AIConversation.create({ user: userId, title: question.trim().slice(0, 80), campaignId: campaign.metaCampaignId, messages: [], });
    }

    conversation.messages.push({ role: "user", content: question.trim(), campaignId: campaign.metaCampaignId, });
    conversation.messages.push({ role: "assistant", content: answer, campaignId: campaign.metaCampaignId, });
    await conversation.save();

    res.status(200).json({ success: true, data: { conversationId: conversation._id, campaign: { id: campaign.metaCampaignId, name: campaign.name, }, question: question.trim(), answer, }, });
  } catch (error) {
    console.error("Campaign AI error:", error);
    res.status(500).json({ success: false, message: "Failed to generate campaign AI response", });
  }
};

// GET /api/dashboard/ai/conversations
export const getAIConversations = async (req, res) => {
  try {
    const conversations = await AIConversation.find({ user: req.user._id, }).select("_id title campaignId createdAt updatedAt").sort({ updatedAt: -1, }).lean();
    res.json({ success: true, data: conversations, });
  } catch (error) {
    console.error("Get AI conversations error:", error);
    res.status(500).json({ success: false, message: "Failed to load conversations", });
  }
};


// GET /api/dashboard/ai/conversations/:conversationId
export const getAIConversation =
  async (req, res) => {
    try {
      const conversation = await AIConversation.findOne({ _id: req.params.conversationId, user: req.user._id, }).lean();

      if (!conversation) {
        return res.status(404).json({ success: false, message: "Conversation not found", });
      }

      res.json({ success: true, data: conversation, });
    } catch (error) {
      console.error("Get AI conversation error:", error);

      res.status(500).json({ success: false, message: "Failed to load conversation", });
    }
  };


// GET /api/dashboard/campaigns/:campaignId/ai-insights

export const getCampaignAIInsights =
  async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found", });
      }

      if (user.plan !== "PRO") {
        return res.status(403).json({ success: false, code: "PRO_REQUIRED", message: "AI Insights are available on the Pro plan.", });
      }

      const campaign =
        await Campaign.findOne({ user: userId, metaCampaignId: req.params.campaignId, }).lean();

      if (!campaign) {
        return res.status(404).json({ success: false, message: "Campaign not found", });
      }

      const question = `Analyze this Meta Ads campaign and provide actionable performance insights.
Focus on:
1. Overall performance
2. ROAS
3. CTR
4. CPC
5. Conversion performance
6. Potential problems
7. Recommended actions

Campaign data: ${JSON.stringify(campaign, null, 2)}`;

      const answer = await generateAIResponse({ question, campaignData: campaign, conversationHistory: [], });
      res.json({ success: true, data: { campaignId: campaign.metaCampaignId, campaignName: campaign.name, answer, generatedAt: new Date(), }, });

    } catch (error) {
      console.error("Campaign AI insights error:", error);
      res.status(500).json({ success: false, message: "Failed to generate AI insights", });
    }
  };

// POST /api/dashboard/sync

export const syncDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    if (!user.isMetaConnected) {
      return res.status(400).json({ success: false, code: "META_NOT_CONNECTED", message: "Connect your Meta Ads account before syncing data.", });
    }

    let settings = await UserSettings.findOne({ user: userId, });

    if (!settings) {
      settings = await UserSettings.create({ user: userId, });
    }

    const enabledAccounts = settings.adAccounts.filter((account) => account.syncEnabled);
    // {implementaton required} Meta Graph API 
    const now = new Date();
    settings.sync.lastSyncAt = now;
    await settings.save();
    res.json({ success: true, message: "Dashboard sync completed", data: { accountsSynced: enabledAccounts.length, campaignsSynced: await Campaign.countDocuments({ user: userId, }), lastSync: now, status: "SYNC_REQUIRES_META_SERVICE", }, });

  } catch (error) {
    console.error("Dashboard sync error:", error);
    res.status(500).json({ success: false, message: "Failed to sync dashboard data", });
  }
};


// ============================================================
// GET /api/dashboard/settings
// ============================================================

export const getSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    let settings = await UserSettings.findOne({ user: userId, });

    if (!settings) {
      settings = await UserSettings.create({ user: userId, });
    }
    res.json({
      success: true, data: {
        meta: { connected: req.user.isMetaConnected, adAccountId: req.user.metaAdAccountId, adAccountName: req.user.metaAdAccountName, tokenExpiresAt: req.user.metaTokenExpiresAt, }, adAccounts: settings.adAccounts,
        sync: { frequency: settings.sync.frequency, importRange: settings.sync.importRange, lastSyncAt: settings.sync.lastSyncAt, }, notifications: settings.notifications,
      },
    });

  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ success: false, message: "Failed to load settings", });
  }
};

// ============================================================
// PUT /api/dashboard/settings/sync
// ============================================================

export const updateSyncSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { frequency, importRange, } = req.body;
    const allowedFrequency = ["MANUAL", "HOURLY", "DAILY",];
    const allowedRanges = ["7d", "14d", "30d", "90d",];

    if (frequency && !allowedFrequency.includes(frequency)) {
      return res.status(400).json({ success: false, message: "Invalid sync frequency", });
    }

    if (importRange && !allowedRanges.includes(importRange)) {
      return res.status(400).json({ success: false, message: "Invalid import range", });
    }

    const update = {};

    if (frequency) {
      update["sync.frequency"] = frequency;
    }

    if (importRange) {
      update["sync.importRange"] = importRange;
    }

    const settings = await UserSettings.findOneAndUpdate({ user: userId, }, { $set: update, }, { new: true, upsert: true, runValidators: true, });
    res.json({ success: true, message: "Sync preferences updated", data: settings.sync, });

  } catch (error) {
    console.error("Update sync settings error:", error);
    res.status(500).json({ success: false, message: "Failed to update sync preferences", });
  }
};

// ============================================================
// PATCH /api/dashboard/settings/ad-accounts/:accountId
// ============================================================

export const updateAdAccountSync = async (req, res) => {
  try {
    const userId = req.user._id;
    const { syncEnabled, } = req.body;

    if (typeof syncEnabled !== "boolean") {
      return res.status(400).json({ success: false, message: "syncEnabled must be true or false", });
    }

    const settings = await UserSettings.findOne({ user: userId, });

    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found", });
    }

    const account = settings.adAccounts.find((item) => item.accountId === req.params.accountId);

    if (!account) {
      return res.status(404).json({ success: false, message: "Ad account not found", });
    }

    account.syncEnabled = syncEnabled;
    await settings.save();
    res.json({ success: true, message: "Ad account sync preference updated", data: account, });

  } catch (error) {
    console.error("Ad account sync error:", error);
    res.status(500).json({ success: false, message: "Failed to update ad account", });
  }
};


// ============================================================
// GET /api/dashboard/settings/notifications
// ============================================================

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    let settings = await UserSettings.findOne({ user: userId, });

    if (!settings) {
      settings = await UserSettings.create({ user: userId, });
    }
    res.json({ success: true, data: settings.notifications, });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: "Failed to load notification settings", });
  }
};


// ============================================================
// PUT /api/dashboard/settings/notifications
// ============================================================

export const updateNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const fields = ["emailAlerts", "campaignAlerts", "weeklyReports", "syncFailureAlerts",];
    const update = {};

    for (const field of fields) {
      if (typeof req.body[field] === "boolean") { update[`notifications.${field}`] = req.body[field]; }
    }

    const settings = await UserSettings.findOneAndUpdate({ user: userId, }, { $set: update, }, { new: true, upsert: true, runValidators: true, });
    res.json({ success: true, message: "Notification preferences updated", data: settings.notifications, });
  } catch (error) {
    console.error("Update notifications error:", error);
    res.status(500).json({ success: false, message: "Failed to update notifications", });
  }
};


// ============================================================
// GET /api/dashboard/profile
// ============================================================

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-passwordHash -metaAccessToken");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    res.json({
      success: true, data: {
        id: user._id, name: user.name, email: user.email, phone: user.phone || null, role: user.role,
        avatarUrl: user.avatarUrl, plan: user.plan, isMetaConnected: user.isMetaConnected, memberSince: user.createdAt,
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: "Failed to load profile", });
  }
};


// ============================================================
// PUT /api/dashboard/profile
// ============================================================

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required", });
    }

    const user = await User.findByIdAndUpdate(userId, { $set: { name: name.trim(), phone: phone?.trim() || null, }, },
      { new: true, runValidators: true, }).select("-passwordHash -metaAccessToken");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    res.json({
      success: true, message: "Profile updated successfully",
      data: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatarUrl: user.avatarUrl, plan: user.plan, },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Failed to update profile", });
  }
};


// ============================================================
// PUT /api/dashboard/profile/password
// ============================================================

export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword, confirmPassword, } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Current password, new password and confirmation are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "New passwords do not match", });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must contain at least 8 characters", });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    const valid = await comparePassword(currentPassword, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ success: false, message: "Current password is incorrect", });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    res.json({ success: true, message: "Password updated successfully", });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Failed to update password", });
  }
};