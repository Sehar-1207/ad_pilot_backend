import { InstagramAccount } from "../models/InstagramAccount.js";
import { InstagramMedia } from "../models/InstaMediaModel.js";

import {
  getMetaInstagramAccounts,
  getMetaInstagramAccount,
  getMetaInstagramInsights,
  getMetaInstagramMedia,
  getMetaInstagramMediaInsights,
} from "../utils/metaService.js";

const getMetaToken = (req) => {
  return req.user?.metaAccessToken || null;
};

const validateMetaConnection = (req, res) => {
  const accessToken = getMetaToken(req);

  if (!accessToken) {
    res.status(400).json({
      success: false,
      code: "META_NOT_CONNECTED",
      message: "Meta account is not connected",
    });

    return null;
  }

  return accessToken;
};

const getMetaErrorStatus = (error) => {
  return (
    error?.httpStatus ||
    error?.response?.status ||
    500
  );
};

const getMetaErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
};

export const getInstagramAccounts = async (req, res) => {
  try {
    const accessToken = validateMetaConnection(req, res);

    if (!accessToken) {
      return;
    }

    const result =
      await getMetaInstagramAccounts(
        accessToken
      );

    const accounts = Array.isArray(result?.data)
      ? result.data
      : [];

    return res.status(200).json({
      success: true,
      data: accounts,
      pages: result?.pages || [],
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM ACCOUNTS ERROR]",
      error?.response?.data || error
    );

    return res.status(
      getMetaErrorStatus(error)
    ).json({
      success: false,
      code:
        error?.code ||
        "INSTAGRAM_ACCOUNTS_FAILED",
      message: getMetaErrorMessage(
        error,
        "Failed to retrieve Instagram accounts"
      ),
      metaCode: error?.code || null,
      metaType: error?.type || null,
      metaSubcode:
        error?.errorSubcode || null,
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
      error
    );

    return res.status(500).json({
      success: false,
      code: "INSTAGRAM_CONNECTED_FAILED",
      message:
        error?.message ||
        "Failed to retrieve connected Instagram account",
    });
  }
};

export const connectInstagram = async (req, res) => {
  try {
    const accessToken = validateMetaConnection(req, res);

    if (!accessToken) {
      return;
    }

    const {
      instagramAccountId,
    } = req.body;

    if (!instagramAccountId) {
      return res.status(400).json({
        success: false,
        code: "INSTAGRAM_ACCOUNT_ID_REQUIRED",
        message:
          "Instagram account ID is required",
      });
    }

    const availableAccounts =
      await getMetaInstagramAccounts(
        accessToken
      );

    const accounts =
      Array.isArray(
        availableAccounts?.data
      )
        ? availableAccounts.data
        : [];

    const selectedAccount =
      accounts.find(
        (account) =>
          String(account.id) ===
          String(instagramAccountId)
      );

    if (!selectedAccount) {
      return res.status(403).json({
        success: false,
        code:
          "INSTAGRAM_ACCOUNT_NOT_AVAILABLE",
        message:
          "Instagram account is not available through your Meta connection",
      });
    }

    const instagramAccount =
      await getMetaInstagramAccount(
        accessToken,
        selectedAccount.id
      );

    if (!instagramAccount?.id) {
      return res.status(400).json({
        success: false,
        code: "INSTAGRAM_ACCOUNT_INVALID",
        message:
          "The selected Instagram account could not be verified",
      });
    }

    const savedAccount = await InstagramAccount.findOneAndUpdate(
      {
        user: req.user._id,
      },
      {
        $set: {
          user: req.user._id,
          instagramAccountId:
            instagramAccount.id,
          username:
            instagramAccount.username ||
            null,
          name:
            instagramAccount.name ||
            null,
          profilePictureUrl:
            instagramAccount.profile_picture_url ||
            null,
          followersCount:
            Number(
              instagramAccount.followers_count ||
              0
            ),
          followsCount:
            Number(
              instagramAccount.follows_count ||
              0
            ),
          mediaCount:
            Number(
              instagramAccount.media_count ||
              0
            ),
          facebookPageId:
            selectedAccount.facebookPageId ||
            null,
          facebookPageName:
            selectedAccount.facebookPageName ||
            null,
          isConnected: true,
          lastSyncedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Instagram account connected successfully",
      data: savedAccount,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM CONNECT ERROR]",
      error?.response?.data || error
    );

    return res.status(
      getMetaErrorStatus(error)
    ).json({
      success: false,
      code:
        error?.code ||
        "INSTAGRAM_CONNECT_FAILED",
      message: getMetaErrorMessage(
        error,
        "Failed to connect Instagram account"
      ),
      metaCode: error?.code || null,
      metaType: error?.type || null,
      metaSubcode:
        error?.errorSubcode || null,
    });
  }
};

export const syncInstagram = async (req, res) => {
  try {
    const accessToken = validateMetaConnection(req, res);

    if (!accessToken) {
      return;
    }

    const instagramAccount =
      await InstagramAccount.findOne({
        user: req.user._id,
        isConnected: true,
      });

    if (!instagramAccount) {
      return res.status(404).json({
        success: false,
        code:
          "INSTAGRAM_NOT_CONNECTED",
        message:
          "No Instagram account is connected",
      });
    }

    const freshAccount =
      await getMetaInstagramAccount(
        accessToken,
        instagramAccount.instagramAccountId
      );

    if (!freshAccount?.id) {
      return res.status(404).json({
        success: false,
        code:
          "INSTAGRAM_ACCOUNT_NOT_FOUND",
        message:
          "The connected Instagram account could not be found through your Meta connection",
      });
    }

    instagramAccount.username =
      freshAccount.username || null;

    instagramAccount.name =
      freshAccount.name || null;

    instagramAccount.profilePictureUrl =
      freshAccount.profile_picture_url ||
      null;

    instagramAccount.followersCount =
      Number(
        freshAccount.followers_count || 0
      );

    instagramAccount.followsCount =
      Number(
        freshAccount.follows_count || 0
      );

    instagramAccount.mediaCount =
      Number(
        freshAccount.media_count || 0
      );

    instagramAccount.isConnected = true;

    instagramAccount.lastSyncedAt =
      new Date();

    await instagramAccount.save();

    return res.status(200).json({
      success: true,
      message:
        "Instagram account synced successfully",
      data: instagramAccount,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM SYNC ERROR]",
      error?.response?.data || error
    );

    return res.status(
      getMetaErrorStatus(error)
    ).json({
      success: false,
      code:
        error?.code ||
        "INSTAGRAM_SYNC_FAILED",
      message: getMetaErrorMessage(
        error,
        "Failed to sync Instagram account"
      ),
      metaCode: error?.code || null,
      metaType: error?.type || null,
      metaSubcode:
        error?.errorSubcode || null,
    });
  }
};

export const getInstagramInsights = async (req, res) => {
  try {
    const accessToken = validateMetaConnection(req, res);

    if (!accessToken) {
      return;
    }

    const instagramAccount =
      await InstagramAccount.findOne({
        user: req.user._id,
        isConnected: true,
      });

    if (!instagramAccount) {
      return res.status(404).json({
        success: false,
        code:
          "INSTAGRAM_NOT_CONNECTED",
        message:
          "No Instagram account is connected",
      });
    }

    const metrics =
      typeof req.query.metrics === "string" &&
        req.query.metrics.trim()
        ? req.query.metrics.trim()
        : "impressions,reach,profile_views";

    const insights =
      await getMetaInstagramInsights(
        accessToken,
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
      error?.response?.data || error
    );

    return res.status(
      getMetaErrorStatus(error)
    ).json({
      success: false,
      code:
        error?.code ||
        "INSTAGRAM_INSIGHTS_FAILED",
      message: getMetaErrorMessage(
        error,
        "Failed to retrieve Instagram insights"
      ),
      metaCode: error?.code || null,
      metaType: error?.type || null,
      metaSubcode:
        error?.errorSubcode || null,
    });
  }
};

export const getInstagramAccount = async (req, res) => {
  try {
    const accessToken = validateMetaConnection(req, res);

    if (!accessToken) {
      return;
    }

    const instagramAccount =
      await InstagramAccount.findOne({
        user: req.user._id,
        isConnected: true,
      });

    if (!instagramAccount) {
      return res.status(404).json({
        success: false,
        code:
          "INSTAGRAM_NOT_CONNECTED",
        message:
          "No Instagram account is connected",
      });
    }

    const account =
      await getMetaInstagramAccount(
        accessToken,
        instagramAccount.instagramAccountId
      );

    if (!account?.id) {
      return res.status(404).json({
        success: false,
        code:
          "INSTAGRAM_ACCOUNT_NOT_FOUND",
        message:
          "Instagram account could not be retrieved",
      });
    }

    return res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM ACCOUNT ERROR]",
      error?.response?.data || error
    );

    return res.status(
      getMetaErrorStatus(error)
    ).json({
      success: false,
      code:
        error?.code ||
        "INSTAGRAM_ACCOUNT_FAILED",
      message: getMetaErrorMessage(
        error,
        "Failed to retrieve Instagram account"
      ),
      metaCode: error?.code || null,
      metaType: error?.type || null,
      metaSubcode:
        error?.errorSubcode || null,
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
        code:
          "INSTAGRAM_NOT_CONNECTED",
        message:
          "No Instagram account is connected",
      });
    }

    instagramAccount.isConnected = false;

    await instagramAccount.save();

    return res.status(200).json({
      success: true,
      message:
        "Instagram account disconnected successfully",
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM DISCONNECT ERROR]",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "INSTAGRAM_DISCONNECT_FAILED",
      message:
        error?.message ||
        "Failed to disconnect Instagram account",
    });
  }
};

export const getInstagramMedia = async (req, res) => {
  try {
    const media = await InstagramMedia.find({
      user: req.user._id,
    })
      .sort({ timestamp: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: media,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM MEDIA ERROR]",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve Instagram media",
    });
  }
};

export const syncInstagramMedia = async (req, res) => {
  try {
    const user = req.user;

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        code: "META_NOT_CONNECTED",
        message: "Meta account is not connected",
      });
    }

    const instagramAccount =
      await InstagramAccount.findOne({
        user: user._id,
        isConnected: true,
      });

    if (!instagramAccount) {
      return res.status(404).json({
        success: false,
        code: "INSTAGRAM_NOT_CONNECTED",
        message: "No Instagram account is connected",
      });
    }

    const mediaResponse = await getMetaInstagramMedia(
      user.metaAccessToken,
      instagramAccount.instagramAccountId
    );

    const media = mediaResponse?.data || [];

    let synced = 0;
    let failed = 0;

    for (const item of media) {
      try {
        await InstagramMedia.findOneAndUpdate(
          {
            user: user._id,
            mediaId: item.id,
          },
          {
            $set: {
              user: user._id,
              instagramAccountId:
                instagramAccount.instagramAccountId,
              mediaId: item.id,
              caption: item.caption || null,
              mediaType: item.media_type || null,
              mediaProductType:
                item.media_product_type || null,
              mediaUrl: item.media_url || null,
              thumbnailUrl:
                item.thumbnail_url || null,
              permalink: item.permalink || null,
              timestamp: item.timestamp
                ? new Date(item.timestamp)
                : null,
              username: item.username || null,
              lastSyncedAt: new Date(),
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        synced += 1;
      } catch (mediaError) {
        failed += 1;

        console.error(
          `[INSTAGRAM MEDIA SYNC] Failed: ${item.id}`,
          mediaError.message
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Instagram media synced successfully",
      data: {
        mediaFound: media.length,
        mediaSynced: synced,
        mediaFailed: failed,
        syncedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM MEDIA SYNC ERROR]",
      error.response?.data || error.message
    );

    return res.status(error.httpStatus || 500).json({
      success: false,
      code: error.code || "INSTAGRAM_MEDIA_SYNC_FAILED",
      message:
        error.message ||
        "Failed to synchronize Instagram media",
      metaCode: error.code || null,
      metaType: error.type || null,
      metaSubcode:
        error.errorSubcode || null,
    });
  }
};

export const getInstagramMediaInsights = async (req, res) => {
  try {
    const user = req.user;
    const { mediaId, metrics } = req.query;

    if (!mediaId) {
      return res.status(400).json({
        success: false,
        message: "mediaId is required",
      });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        code: "META_NOT_CONNECTED",
        message: "Meta account is not connected",
      });
    }

    const instagramAccount =
      await InstagramAccount.findOne({
        user: user._id,
        isConnected: true,
      });

    if (!instagramAccount) {
      return res.status(404).json({
        success: false,
        code: "INSTAGRAM_NOT_CONNECTED",
        message: "No Instagram account is connected",
      });
    }

    const media = await InstagramMedia.findOne({
      user: user._id,
      instagramAccountId:
        instagramAccount.instagramAccountId,
      mediaId,
    }).lean();

    if (!media) {
      return res.status(404).json({
        success: false,
        code: "MEDIA_NOT_FOUND",
        message:
          "Instagram media was not found for this account",
      });
    }

    if (!metrics) {
      return res.status(400).json({
        success: false,
        code: "METRICS_REQUIRED",
        message:
          "Provide the Instagram media metrics to retrieve",
      });
    }

    const insights =
      await getMetaInstagramMediaInsights(
        user.metaAccessToken,
        mediaId,
        metrics
      );

    return res.status(200).json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error(
      "[INSTAGRAM MEDIA INSIGHTS ERROR]",
      error.response?.data || error.message
    );

    return res.status(error.httpStatus || 500).json({
      success: false,
      code:
        error.code ||
        "INSTAGRAM_MEDIA_INSIGHTS_FAILED",
      message:
        error.message ||
        "Failed to retrieve Instagram media insights",
      metaCode: error.code || null,
      metaType: error.type || null,
      metaSubcode:
        error.errorSubcode || null,
    });
  }
};