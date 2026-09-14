import { User } from "../models/User.js";
import { Campaign } from "../models/Campaign.js";
import { UserSettings } from "../models/UserSettings.js";
import { hashPassword, comparePassword } from "../utils/security.js";
import { generateAIResponse } from "../utils/geminiService.js";
import {getMetaCampaigns, getMetaCampaignInsights,} from "../utils/metaService.js";

const getDateFromRange = (range) => {
  const now = new Date();

  const days = {
    "7d": 7,
    "14d": 14,
    "30d": 30,
    "90d": 90,
  };

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
  status: campaign.status?.toLowerCase() || "unknown",
  health: campaign.health || calculateHealth(campaign),
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
  costPerConversion: Number(
    campaign.costPerConversion || 0
  ),
  revenue: Number(campaign.revenue || 0),
  roas: Number(campaign.roas || 0),
  lastSyncedAt: campaign.lastSyncedAt || null,
});

const serializeFreeCampaign = (campaign) => ({
  id: campaign.metaCampaignId,
  name: campaign.name,
  status: campaign.status?.toLowerCase() || "unknown",
  health: campaign.health || calculateHealth(campaign),
  spend: Number(campaign.spend || 0),
  impressions: Number(campaign.impressions || 0),
  clicks: Number(campaign.clicks || 0),
  ctr: Number(campaign.ctr || 0),
});

export const getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user._id;

    const campaigns = await Campaign.find({
      user: userId,
    }).lean();

    const activeCampaigns = campaigns.filter(
      (campaign) => campaign.status === "ACTIVE"
    );

    const totalSpend = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.spend || 0),
      0
    );

    const totalRevenue = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.revenue || 0),
      0
    );

    const totalClicks = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.clicks || 0),
      0
    );

    const totalImpressions = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.impressions || 0),
      0
    );

    const totalConversions = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.conversions || 0),
      0
    );

    const averageRoas =
      totalSpend > 0
        ? totalRevenue / totalSpend
        : 0;

    const averageCtr =
      totalImpressions > 0
        ? (totalClicks / totalImpressions) * 100
        : 0;

    const needsAttention = campaigns.filter(
      (campaign) => {
        const health =
          campaign.health ||
          calculateHealth(campaign);

        return (
          health === "NEEDS_ATTENTION" ||
          health === "FATIGUED"
        );
      }
    ).length;

    return res.json({
      success: true,
      data: {
        totalActiveCampaigns:
          activeCampaigns.length,
        totalCampaigns: campaigns.length,
        totalSpend: Number(
          totalSpend.toFixed(2)
        ),
        totalRevenue: Number(
          totalRevenue.toFixed(2)
        ),
        averageRoas: Number(
          averageRoas.toFixed(2)
        ),
        averageCtr: Number(
          averageCtr.toFixed(2)
        ),
        totalClicks,
        totalImpressions,
        totalConversions,
        needsAttention,
      },
    });
  } catch (error) {
    console.error(
      "Dashboard overview error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load dashboard overview",
    });
  }
};

export const getDashboardPerformance = async (req, res) => {
  try {
    const userId = req.user._id;
    const range = req.query.range || "7d";

    const startDate =
      getDateFromRange(range);

    const campaigns = await Campaign.find({
      user: userId,
      lastSyncedAt: {
        $gte: startDate,
      },
    }).lean();

    const totalSpend = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.spend || 0),
      0
    );

    const totalRevenue = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.revenue || 0),
      0
    );

    const totalClicks = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.clicks || 0),
      0
    );

    const totalImpressions =
      campaigns.reduce(
        (sum, campaign) =>
          sum +
          Number(
            campaign.impressions || 0
          ),
        0
      );

    const totalConversions =
      campaigns.reduce(
        (sum, campaign) =>
          sum +
          Number(
            campaign.conversions || 0
          ),
        0
      );

    const ctr =
      totalImpressions > 0
        ? (totalClicks /
          totalImpressions) *
        100
        : 0;

    const cpc =
      totalClicks > 0
        ? totalSpend / totalClicks
        : 0;

    const cpm =
      totalImpressions > 0
        ? (totalSpend /
          totalImpressions) *
        1000
        : 0;

    const roas =
      totalSpend > 0
        ? totalRevenue / totalSpend
        : 0;

    const costPerConversion =
      totalConversions > 0
        ? totalSpend /
        totalConversions
        : 0;

    return res.json({
      success: true,
      data: {
        range,
        spend: Number(
          totalSpend.toFixed(2)
        ),
        revenue: Number(
          totalRevenue.toFixed(2)
        ),
        impressions:
          totalImpressions,
        clicks: totalClicks,
        conversions:
          totalConversions,
        ctr: Number(
          ctr.toFixed(2)
        ),
        cpc: Number(
          cpc.toFixed(2)
        ),
        cpm: Number(
          cpm.toFixed(2)
        ),
        roas: Number(
          roas.toFixed(2)
        ),
        costPerConversion:
          Number(
            costPerConversion.toFixed(
              2
            )
          ),
      },
    });
  } catch (error) {
    console.error(
      "Dashboard performance error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load dashboard performance",
    });
  }
};

export const getCampaignSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const campaigns = await Campaign.find({
      user: userId,
      status: {
        $in: ["ACTIVE", "PAUSED"],
      },
    }).lean();

    const totalActiveCampaigns =
      campaigns.filter(
        (campaign) =>
          campaign.status === "ACTIVE"
      ).length;

    const totalSpend = campaigns.reduce(
      (sum, campaign) =>
        sum + Number(campaign.spend || 0),
      0
    );

    const totalRevenue =
      campaigns.reduce(
        (sum, campaign) =>
          sum +
          Number(
            campaign.revenue || 0
          ),
        0
      );

    const averageRoas =
      totalSpend > 0
        ? totalRevenue / totalSpend
        : 0;

    const campaignHealth = campaigns.map(
      (campaign) => ({
        ...campaign,
        health:
          campaign.health ||
          calculateHealth(campaign),
      })
    );

    const needsAttention =
      campaignHealth.filter(
        (campaign) =>
          campaign.health ===
          "NEEDS_ATTENTION" ||
          campaign.health === "FATIGUED"
      ).length;

    const fatigued =
      campaignHealth.filter(
        (campaign) =>
          campaign.health ===
          "FATIGUED"
      ).length;

    return res.json({
      success: true,
      data: {
        totalActiveCampaigns,
        totalSpend: Number(
          totalSpend.toFixed(2)
        ),
        averageRoas: Number(
          averageRoas.toFixed(2)
        ),
        needsAttention,
        fatigued,
      },
    });
  } catch (error) {
    console.error(
      "Campaign summary error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load campaign summary",
    });
  }
};

export const getCampaigns = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      search = "",
      status = "all",
      health = "all",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {
      user: userId,
    };

    if (
      status &&
      status.toLowerCase() !== "all"
    ) {
      filter.status =
        status.toUpperCase();
    }

    if (
      health &&
      health.toLowerCase() !== "all"
    ) {
      filter.health =
        health.toUpperCase();
    }

    if (search.trim()) {
      filter.name = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const isPro =
      req.user.plan === "PRO";

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const requestedLimit = Math.min(
      Math.max(
        Number(limit) || 20,
        1
      ),
      100
    );

    const limitNumber = isPro
      ? requestedLimit
      : 3;

    const skip = isPro
      ? (pageNumber - 1) *
      limitNumber
      : 0;

    const [
      campaigns,
      total,
    ] = await Promise.all([
      Campaign.find(filter)
        .sort({
          spend: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Campaign.countDocuments(filter),
    ]);

    const formattedCampaigns =
      campaigns.map((campaign) => {
        const normalizedCampaign = {
          ...campaign,
          health:
            campaign.health ||
            calculateHealth(campaign),
        };

        return isPro
          ? serializeCampaign(
            normalizedCampaign
          )
          : serializeFreeCampaign(
            normalizedCampaign
          );
      });

    const pages = isPro
      ? Math.ceil(
        total / limitNumber
      )
      : 1;

    const visible =
      formattedCampaigns.length;

    const hidden = isPro
      ? 0
      : Math.max(
        total - visible,
        0
      );

    const hasMore = isPro
      ? pageNumber <
      pages
      : false;

    return res.json({
      success: true,

      data: {
        campaigns:
          formattedCampaigns,
        pagination: {
          page: isPro
            ? pageNumber
            : 1,
          limit: limitNumber,
          total,
          pages,
          hiddenCount: hidden,
          hasMore,
        },

        range:
          req.query.range ||
          "7d",

        access: {
          isPro,

          visible,

          total,

          hidden,
        },
      },
    });
  } catch (error) {
    console.error(
      "Get campaigns error:",
      error
    );

    return res.status(500).json({
      success: false,
      data: {
        campaigns: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
          hiddenCount: 0,
          hasMore: false,
        },
        range:
          req.query.range ||
          "7d",
        access: {
          isPro:
            req.user?.plan === "PRO",
          visible: 0,
          total: 0,
          hidden: 0,
        },
      },
      message:
        "Failed to load campaigns",
    });
  }
};

export const getCampaign = async (req, res) => {
  try {
    const userId = req.user._id;
    const campaignId =
      req.params.campaignId;

    const isPro =
      req.user.plan === "PRO";

    if (!isPro) {
      const allowedCampaigns =
        await Campaign.find({
          user: userId,
        })
          .sort({
            spend: -1,
          })
          .limit(3)
          .select({
            metaCampaignId: 1,
          })
          .lean();

      const allowedCampaignIds =
        allowedCampaigns.map(
          (campaign) =>
            campaign.metaCampaignId
        );

      if (
        !allowedCampaignIds.includes(
          campaignId
        )
      ) {
        return res.status(403).json({
          success: false,
          code: "PRO_FEATURE",
          message:
            "Upgrade to Pro to access this campaign",
        });
      }
    }

    const campaign =
      await Campaign.findOne({
        user: userId,
        metaCampaignId: campaignId,
      }).lean();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message:
          "Campaign not found",
      });
    }

    const normalizedCampaign = {
      ...campaign,
      health:
        campaign.health ||
        calculateHealth(campaign),
    };

    return res.json({
      success: true,
      data: isPro
        ? serializeCampaign(
          normalizedCampaign
        )
        : serializeFreeCampaign(
          normalizedCampaign
        ),
    });
  } catch (error) {
    console.error(
      "Get campaign error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load campaign",
    });
  }
};

export const getCampaignAIInsights = async (req, res) => {
  try {
    const userId = req.user._id;

    const user =
      await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    if (
      user.plan !== "PRO" ||
      (
        user.planEndsAt &&
        new Date(
          user.planEndsAt
        ) <= new Date()
      )
    ) {
      return res.status(403).json({
        success: false,
        code: "PRO_REQUIRED",
        message:
          "AI Insights are available on the Pro plan.",
      });
    }

    const campaign =
      await Campaign.findOne({
        user: userId,
        metaCampaignId:
          req.params.campaignId,
      }).lean();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message:
          "Campaign not found",
      });
    }

    const question = `
Analyze this Meta Ads campaign and provide actionable performance insights.

Focus on:
1. Overall performance
2. ROAS
3. CTR
4. CPC
5. Conversion performance
6. Potential problems
7. Recommended actions

Campaign data:
${JSON.stringify(
      campaign,
      null,
      2
    )}
`;

    const answer =
      await generateAIResponse({
        question,
        campaignData:
          campaign,
        conversationHistory: [],
      });

    return res.json({
      success: true,
      data: {
        campaignId:
          campaign.metaCampaignId,
        campaignName:
          campaign.name,
        answer,
        generatedAt:
          new Date(),
      },
    });
  } catch (error) {
    console.error(
      "Campaign AI insights error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate AI insights",
    });
  }
};

export const syncDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isMetaConnected || !user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        code: "META_NOT_CONNECTED",
        message:
          "Connect your Meta Ads account before syncing data.",
      });
    }

    if (!user.metaAdAccountId) {
      return res.status(400).json({
        success: false,
        code: "META_AD_ACCOUNT_NOT_CONNECTED",
        message:
          "Connect a Meta ad account before syncing data.",
      });
    }

    if (
      user.metaTokenExpiresAt &&
      new Date(user.metaTokenExpiresAt) <= new Date()
    ) {
      return res.status(401).json({
        success: false,
        code: "META_TOKEN_EXPIRED",
        message:
          "Your Meta connection has expired. Please reconnect.",
      });
    }

    console.log("[DASHBOARD SYNC] Starting");
    console.log("[DASHBOARD SYNC] User:", userId.toString());
    console.log(
      "[DASHBOARD SYNC] Ad Account:",
      user.metaAdAccountId
    );

    const campaignsResponse = await getMetaCampaigns(
      user.metaAccessToken,
      user.metaAdAccountId
    );

    const metaCampaigns = campaignsResponse?.data || [];

    console.log(
      "[DASHBOARD SYNC] Campaigns found:",
      metaCampaigns.length
    );

    let campaignsSynced = 0;
    let campaignsFailed = 0;

    for (const metaCampaign of metaCampaigns) {
      try {
        const insightsResponse =
          await getMetaCampaignInsights(
            user.metaAccessToken,
            metaCampaign.id
          );

        const insight =
          insightsResponse?.data?.[0] || {};

        const spend = Number(
          insight.spend || 0
        );

        const impressions = Number(
          insight.impressions || 0
        );

        const reach = Number(
          insight.reach || 0
        );

        const clicks = Number(
          insight.clicks || 0
        );

        const ctr = Number(
          insight.ctr || 0
        );

        const cpc = Number(
          insight.cpc || 0
        );

        const cpm = Number(
          insight.cpm || 0
        );

        const purchaseRoas =
          Array.isArray(
            insight.purchase_roas
          )
            ? Number(
                insight.purchase_roas[0]
                  ?.value || 0
              )
            : Number(
                insight.purchase_roas || 0
              );

        const actions =
          Array.isArray(insight.actions)
            ? insight.actions
            : [];

        const actionValues =
          Array.isArray(
            insight.action_values
          )
            ? insight.action_values
            : [];

        const purchases =
          actions.find(
            (action) =>
              action.action_type ===
              "purchase"
          )?.value || 0;

        const revenue =
          actionValues.find(
            (action) =>
              action.action_type ===
              "purchase"
          )?.value || 0;

        const conversions =
          Number(purchases || 0);

        const costPerConversion =
          conversions > 0
            ? spend / conversions
            : 0;

        const roas =
          purchaseRoas ||
          (spend > 0
            ? Number(revenue) / spend
            : 0);

        await Campaign.findOneAndUpdate(
          {
            user: userId,
            metaCampaignId:
              metaCampaign.id,
          },
          {
            $set: {
              user: userId,
              metaCampaignId:
                metaCampaign.id,
              name: metaCampaign.name,
              status: (
                metaCampaign.effective_status ||
                metaCampaign.status ||
                "UNKNOWN"
              ).toLowerCase(),
              objective:
                metaCampaign.objective ||
                null,
              adAccountId:
                user.metaAdAccountId,
              spend,
              impressions,
              reach,
              clicks,
              ctr,
              cpc,
              cpm,
              conversions,
              costPerConversion,
              revenue: Number(
                revenue || 0
              ),
              roas,
              lastSyncedAt: new Date(),
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        campaignsSynced += 1;

        console.log(
          "[DASHBOARD SYNC] Campaign synced:",
          metaCampaign.id
        );
      } catch (campaignError) {
        campaignsFailed += 1;

        console.error(
          "[DASHBOARD SYNC] Campaign failed:",
          metaCampaign.id
        );

        console.error(
          "[DASHBOARD SYNC] Error:",
          campaignError.message
        );
      }
    }

    let settings =
      await UserSettings.findOne({
        user: userId,
      });

    if (!settings) {
      settings =
        await UserSettings.create({
          user: userId,
        });
    }

    const enabledAccounts =
      settings.adAccounts.filter(
        (account) =>
          account.syncEnabled
      );

    const now = new Date();

    settings.sync.lastSyncAt = now;

    await settings.save();

    console.log(
      "[DASHBOARD SYNC] Completed"
    );

    return res.json({
      success: true,
      message:
        "Dashboard sync completed successfully.",
      data: {
        accountsSynced:
          enabledAccounts.length,
        campaignsFound:
          metaCampaigns.length,
        campaignsSynced,
        campaignsFailed,
        lastSync: now,
      },
    });
  } catch (error) {
    console.error(
      "[DASHBOARD SYNC] Error:",
      error
    );

    return res.status(
      error.httpStatus || 500
    ).json({
      success: false,
      code:
        error.code ||
        "DASHBOARD_SYNC_FAILED",
      message:
        error.message ||
        "Failed to sync dashboard data",
      metaCode:
        error.code || null,
      metaType:
        error.type || null,
      metaSubcode:
        error.errorSubcode || null,
    });
  }
};

export const getSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    let settings =
      await UserSettings.findOne({
        user: userId,
      });

    if (!settings) {
      settings =
        await UserSettings.create({
          user: userId,
        });
    }

    return res.json({
      success: true,
      data: {
        meta: {
          connected:
            req.user.isMetaConnected,
          adAccountId:
            req.user.metaAdAccountId,
          adAccountName:
            req.user.metaAdAccountName,
          tokenExpiresAt:
            req.user.metaTokenExpiresAt,
        },

        adAccounts:
          settings.adAccounts,

        sync: {
          frequency:
            settings.sync.frequency,
          importRange:
            settings.sync.importRange,
          lastSyncAt:
            settings.sync.lastSyncAt,
        },

        notifications:
          settings.notifications,
      },
    });
  } catch (error) {
    console.error(
      "Get settings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load settings",
    });
  }
};

export const updateAdAccountSync = async (req, res) => {
  try {
    const userId = req.user._id;
    const { syncEnabled } =
      req.body;

    if (
      typeof syncEnabled !==
      "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "syncEnabled must be true or false",
      });
    }

    const settings =
      await UserSettings.findOne({
        user: userId,
      });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message:
          "Settings not found",
      });
    }

    const account =
      settings.adAccounts.find(
        (item) =>
          item.accountId ===
          req.params.accountId
      );

    if (!account) {
      return res.status(404).json({
        success: false,
        message:
          "Ad account not found",
      });
    }

    account.syncEnabled =
      syncEnabled;

    await settings.save();

    return res.json({
      success: true,
      message:
        "Ad account sync preference updated",
      data: account,
    });
  } catch (error) {
    console.error(
      "Ad account sync error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update ad account",
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user =
      await User.findById(
        req.user._id
      ).select(
        "-passwordHash -metaAccessToken"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    return res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone:
          user.phone || null,
        role: user.role,
        avatarUrl:
          user.avatarUrl,
        plan: user.plan,
        isMetaConnected:
          user.isMetaConnected,
        createdAt:user.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Get profile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load profile",
    });
  }
};

export const updateProfile = async (req,res) => {
  try {
    const userId =
      req.user._id;

    const {
      name,
      phone,
    } = req.body;

    if (
      !name ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name is required",
      });
    }

    const user =
      await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            name:
              name.trim(),
            phone:
              phone?.trim() ||
              null,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "-passwordHash -metaAccessToken"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    return res.json({
      success: true,
      message:
        "Profile updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl:
          user.avatarUrl,
        plan: user.plan,
      },
    });
  } catch (error) {
    console.error(
      "Update profile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update profile",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId =
      req.user._id;

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Current password, new password and confirmation are required",
      });
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "New passwords do not match",
      });
    }

    if (
      newPassword.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "New password must contain at least 8 characters",
      });
    }

    const user =
      await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    const valid =
      await comparePassword(
        currentPassword,
        user.passwordHash
      );

    if (!valid) {
      return res.status(401).json({
        success: false,
        message:
          "Current password is incorrect",
      });
    }

    user.passwordHash =
      await hashPassword(
        newPassword
      );

    await user.save();

    return res.json({
      success: true,
      message:
        "Password updated successfully",
    });
  } catch (error) {
    console.error(
      "Change password error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update password",
    });
  }
};