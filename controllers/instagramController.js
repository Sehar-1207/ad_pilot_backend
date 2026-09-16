import InstagramAccount from "../models/InstagramAccount.js";

import { getMetaInstagramAccounts, getMetaInstagramAccount, getMetaInstagramInsights,} from "../services/metaService.js";

export const getInstagramAccounts = async (req, res) => {
  try {
    const user = req.user;

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        message: "Meta account is not connected",
      });
    }

    const result = await getMetaInstagramAccounts(
      user.metaAccessToken
    );

    return res.status(200).json({
      success: true,
      data: result.data || [],
      pages: result.pages || [],
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM ACCOUNTS ERROR]",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve Instagram accounts",
    });
  }
};

export const getConnectedInstagram = async (req, res) => {
  try {
    const instagramAccount =
      await InstagramAccount.findOne({
        user: req.user._id,
        isConnected: true,
      }).lean();

    if (!instagramAccount) {
      return res.status(200).json({
        success: true,
        connected: false,
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      connected: true,
      data: instagramAccount,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM CONNECTED ERROR]",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve connected Instagram account",
    });
  }
};

export const connectInstagram = async (req, res) => {
  try {
    const user = req.user;

    const {
      instagramAccountId,
      facebookPageId,
      facebookPageName,
    } = req.body;

    if (!instagramAccountId) {
      return res.status(400).json({
        success: false,
        message: "Instagram account ID is required",
      });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        message: "Meta account is not connected",
      });
    }

    const availableAccounts =
      await getMetaInstagramAccounts(
        user.metaAccessToken
      );

    const selectedAccount =
      availableAccounts.data?.find(
        (account) =>
          String(account.id) ===
          String(instagramAccountId)
      );

    if (!selectedAccount) {
      return res.status(403).json({
        success: false,
        message:
          "Instagram account is not available through your Meta connection",
      });
    }

    const instagramAccount =
      await getMetaInstagramAccount(
        user.metaAccessToken,
        instagramAccountId
      );

    const savedAccount =
      await InstagramAccount.findOneAndUpdate(
        {
          user: user._id,
        },
        {
          user: user._id,
          instagramAccountId:
            instagramAccount.id,
          username:
            instagramAccount.username || null,
          name:
            instagramAccount.name || null,
          profilePictureUrl:
            instagramAccount.profile_picture_url || null,
          followersCount:
            instagramAccount.followers_count || 0,
          followsCount:
            instagramAccount.follows_count || 0,
          mediaCount:
            instagramAccount.media_count || 0,
          facebookPageId:
            facebookPageId ||
            selectedAccount.facebookPageId ||
            null,
          facebookPageName:
            facebookPageName ||
            selectedAccount.facebookPageName ||
            null,
          accessToken:
            user.metaAccessToken,
          isConnected: true,
          lastSyncedAt: new Date(),
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      );

    return res.status(200).json({
      success: true,
      message: "Instagram account connected successfully",
      data: savedAccount,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM CONNECT ERROR]",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to connect Instagram account",
    });
  }
};

export const syncInstagram = async (req, res) => {
  try {
    const user = req.user;

    const instagramAccount =
      await InstagramAccount.findOne({
        user: user._id,
        isConnected: true,
      });

    if (!instagramAccount) {
      return res.status(404).json({
        success: false,
        message: "No Instagram account is connected",
      });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        message: "Meta account is not connected",
      });
    }

    const freshAccount =
      await getMetaInstagramAccount(
        user.metaAccessToken,
        instagramAccount.instagramAccountId
      );

    instagramAccount.username =
      freshAccount.username || null;

    instagramAccount.name =
      freshAccount.name || null;

    instagramAccount.profilePictureUrl =
      freshAccount.profile_picture_url || null;

    instagramAccount.followersCount =
      freshAccount.followers_count || 0;

    instagramAccount.followsCount =
      freshAccount.follows_count || 0;

    instagramAccount.mediaCount =
      freshAccount.media_count || 0;

    instagramAccount.accessToken =
      user.metaAccessToken;

    instagramAccount.isConnected = true;

    instagramAccount.lastSyncedAt = new Date();

    await instagramAccount.save();

    return res.status(200).json({
      success: true,
      message: "Instagram account synced successfully",
      data: instagramAccount,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM SYNC ERROR]",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to sync Instagram account",
    });
  }
};

export const getInstagramInsights = async (req, res) => {
  try {
    const user = req.user;

    const instagramAccount =
      await InstagramAccount.findOne({
        user: user._id,
        isConnected: true,
      });

    if (!instagramAccount) {
      return res.status(404).json({
        success: false,
        message: "No Instagram account is connected",
      });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        message: "Meta account is not connected",
      });
    }

    const metrics =
      req.query.metrics ||
      "impressions,reach,profile_views";

    const insights =
      await getMetaInstagramInsights(
        user.metaAccessToken,
        instagramAccount.instagramAccountId,
        metrics
      );

    return res.status(200).json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM INSIGHTS ERROR]",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve Instagram insights",
    });
  }
};

export const getInstagramAccount = async (req, res) => {
  try {
    const user = req.user;

    const instagramAccount =
      await InstagramAccount.findOne({
        user: user._id,
        isConnected: true,
      });

    if (!instagramAccount) {
      return res.status(404).json({
        success: false,
        message: "No Instagram account is connected",
      });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        message: "Meta account is not connected",
      });
    }

    const account =
      await getMetaInstagramAccount(
        user.metaAccessToken,
        instagramAccount.instagramAccountId
      );

    return res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM ACCOUNT ERROR]",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve Instagram account",
    });
  }
};

export const disconnectInstagram = async (req, res) => {
  try {
    const instagramAccount =
      await InstagramAccount.findOne({
        user: req.user._id,
        isConnected: true,
      });

    if (!instagramAccount) {
      return res.status(404).json({
        success: false,
        message: "No Instagram account is connected",
      });
    }

    instagramAccount.isConnected = false;
    instagramAccount.accessToken = null;

    await instagramAccount.save();

    return res.status(200).json({
      success: true,
      message: "Instagram account disconnected successfully",
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM DISCONNECT ERROR]",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to disconnect Instagram account",
    });
  }
};