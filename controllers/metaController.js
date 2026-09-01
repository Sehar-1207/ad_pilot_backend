import axios from "axios";
import crypto from "crypto";
import { User } from "../models/User.js";

const META_GRAPH_VERSION = "v22.0";
const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// ============================================================
// START META OAUTH
// GET /api/meta/auth
// ============================================================

export const startMetaAuth = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "You must be logged in to connect Meta.",
      });
    }

    // Create a random nonce for OAuth state
    const nonce = crypto.randomBytes(32).toString("hex");

    const statePayload = {
      userId: req.user._id.toString(),
      nonce,
    };

    const state = Buffer.from(
      JSON.stringify(statePayload)
    ).toString("base64url");

    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      redirect_uri: process.env.META_REDIRECT_URI,
      response_type: "code",
      scope: "public_profile,email,ads_read",
      state,
    });

    const metaAuthUrl =
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?` +
      params.toString();

    return res.redirect(metaAuthUrl);
  } catch (error) {
    console.error("Start Meta Auth Error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to start Meta authentication.",
    });
  }
};


// ============================================================
// META OAUTH CALLBACK
// GET /api/meta/callback
// ============================================================

export const metaCallback = async (req, res) => {
  const {
    code,
    error,
    state,
  } = req.query;

  // User denied Meta authorization
  if (error || !code || !state) {
    return res.redirect(
      `${process.env.CLIENT_URL}/dashboard/settings?meta=denied`
    );
  }

  try {
    // --------------------------------------------------------
    // Decode OAuth state
    // --------------------------------------------------------

    let stateData;

    try {
      stateData = JSON.parse(
        Buffer.from(
          state,
          "base64url"
        ).toString("utf8")
      );
    } catch (stateError) {
      console.error(
        "Invalid Meta OAuth state:",
        stateError
      );

      return res.redirect(
        `${process.env.CLIENT_URL}/dashboard/settings?meta=invalid_state`
      );
    }

    const {
      userId,
      nonce,
    } = stateData;

    if (!userId || !nonce) {
      return res.redirect(
        `${process.env.CLIENT_URL}/dashboard/settings?meta=invalid_state`
      );
    }

    // --------------------------------------------------------
    // Find Ad Pilot user
    // --------------------------------------------------------

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect(
        `${process.env.CLIENT_URL}/dashboard/settings?meta=user_not_found`
      );
    }

    // --------------------------------------------------------
    // Exchange authorization code for access token
    // --------------------------------------------------------

    const tokenResponse = await axios.get(
      `${META_GRAPH_URL}/oauth/access_token`,
      {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: process.env.META_REDIRECT_URI,
          code,
        },
      }
    );

    const {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
    } = tokenResponse.data;

    if (!accessToken) {
      return res.redirect(
        `${process.env.CLIENT_URL}/dashboard/settings?meta=token_failed`
      );
    }

    // --------------------------------------------------------
    // Get Meta user profile
    // --------------------------------------------------------

    const profileResponse = await axios.get(
      `${META_GRAPH_URL}/me`,
      {
        params: {
          fields: "id,name",
          access_token: accessToken,
        },
      }
    );

    const metaUser = profileResponse.data;

    if (!metaUser?.id) {
      return res.redirect(
        `${process.env.CLIENT_URL}/dashboard/settings?meta=profile_failed`
      );
    }

    // --------------------------------------------------------
    // Calculate token expiration
    // --------------------------------------------------------

    let tokenExpiresAt = null;

    if (expiresIn) {
      tokenExpiresAt = new Date(
        Date.now() +
          Number(expiresIn) * 1000
      );
    }

    // --------------------------------------------------------
    // Save Meta connection
    // --------------------------------------------------------

    user.metaUserId = metaUser.id;
    user.metaAccessToken = accessToken;
    user.isMetaConnected = true;

    if (tokenExpiresAt) {
      user.metaTokenExpiresAt = tokenExpiresAt;
    }

    await user.save();

    console.log(
      `Meta account connected for Ad Pilot user: ${user._id}`
    );

    return res.redirect(
      `${process.env.CLIENT_URL}/dashboard/settings?meta=connected`
    );
  } catch (error) {
    console.error(
      "Meta Callback Error:",
      error.response?.data || error.message
    );

    return res.redirect(
      `${process.env.CLIENT_URL}/dashboard/settings?meta=error`
    );
  }
};


// ============================================================
// GET META AD ACCOUNTS
// GET /api/meta/ad-accounts
// ============================================================

export const getAdAccounts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        error: "Meta account is not connected.",
      });
    }

    const response = await axios.get(
      `${META_GRAPH_URL}/me/adaccounts`,
      {
        params: {
          fields:
            "id,name,account_id,account_status,currency,timezone_name",
          access_token: user.metaAccessToken,
        },
      }
    );

    return res.json({
      success: true,
      adAccounts:
        response.data.data || [],
    });
  } catch (error) {
    console.error(
      "Get Ad Accounts Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error:
        error.response?.data?.error?.message ||
        "Failed to fetch Meta ad accounts.",
    });
  }
};


// ============================================================
// CONNECT SELECTED AD ACCOUNT
// POST /api/meta/connect
// ============================================================

export const connectAdAccount = async (
  req,
  res
) => {
  try {
    const {
      adAccountId,
    } = req.body;

    if (!adAccountId) {
      return res.status(400).json({
        success: false,
        error: "Ad account ID is required.",
      });
    }

    const user = await User.findById(
      req.user._id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        error:
          "Meta account is not connected.",
      });
    }

    // Get all ad accounts available to user
    const response = await axios.get(
      `${META_GRAPH_URL}/me/adaccounts`,
      {
        params: {
          fields:
            "id,name,account_id,account_status,currency",
          access_token:
            user.metaAccessToken,
        },
      }
    );

    const adAccounts =
      response.data.data || [];

    // Check that selected account belongs to user
    const selectedAccount =
      adAccounts.find(
        (account) =>
          account.id === adAccountId ||
          account.account_id ===
            adAccountId ||
          `act_${account.account_id}` ===
            adAccountId
      );

    if (!selectedAccount) {
      return res.status(403).json({
        success: false,
        error:
          "You do not have access to this Meta ad account.",
      });
    }

    // Save selected ad account
    user.metaAdAccountId =
      selectedAccount.id;

    await user.save();

    return res.json({
      success: true,
      message:
        "Meta ad account connected successfully.",
      adAccount: selectedAccount,
    });
  } catch (error) {
    console.error(
      "Connect Ad Account Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error:
        error.response?.data?.error?.message ||
        "Failed to connect Meta ad account.",
    });
  }
};


// ============================================================
// GET META CONNECTION STATUS
// GET /api/meta/status
// ============================================================

export const getMetaStatus = async (
  req,
  res
) => {
  try {
    const user = await User.findById(
      req.user._id
    ).select(
      "-passwordHash -metaAccessToken"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    return res.json({
      success: true,
      isMetaConnected:
        Boolean(user.metaAccessToken),
      metaUserId:
        user.metaUserId || null,
      metaAdAccountId:
        user.metaAdAccountId || null,
      metaTokenExpiresAt:
        user.metaTokenExpiresAt || null,
    });
  } catch (error) {
    console.error(
      "Meta Status Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


// ============================================================
// DISCONNECT META
// POST /api/meta/disconnect
// ============================================================

export const disconnectMeta = async (
  req,
  res
) => {
  try {
    const user = await User.findById(
      req.user._id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    user.metaUserId = null;
    user.metaAccessToken = null;
    user.metaAdAccountId = null;
    user.metaTokenExpiresAt = null;
    user.isMetaConnected = false;

    await user.save();

    return res.json({
      success: true,
      message:
        "Meta account disconnected successfully.",
    });
  } catch (error) {
    console.error(
      "Disconnect Meta Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


// ============================================================
// SYNC META DATA
// POST /api/meta/sync
// ============================================================

export const syncMeta = async (
  req,
  res
) => {
  try {
    const user = await User.findById(
      req.user._id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({
        success: false,
        error:
          "Meta account is not connected.",
      });
    }

    if (!user.metaAdAccountId) {
      return res.status(400).json({
        success: false,
        error:
          "No Meta ad account has been selected.",
      });
    }

    const adAccountId =
      user.metaAdAccountId;

    // --------------------------------------------------------
    // Fetch campaigns
    // --------------------------------------------------------

    const campaignsResponse =
      await axios.get(
        `${META_GRAPH_URL}/${adAccountId}/campaigns`,
        {
          params: {
            fields:
              "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time",
            access_token:
              user.metaAccessToken,
          },
        }
      );

    const campaigns =
      campaignsResponse.data.data || [];

    // --------------------------------------------------------
    // Fetch account insights
    // --------------------------------------------------------

    const insightsResponse =
      await axios.get(
        `${META_GRAPH_URL}/${adAccountId}/insights`,
        {
          params: {
            fields:
              "spend,impressions,reach,clicks,ctr,cpc,cpm,actions",
            date_preset: "last_30d",
            access_token:
              user.metaAccessToken,
          },
        }
      );

    const insights =
      insightsResponse.data.data || [];

    return res.json({
      success: true,
      message:
        "Meta data synced successfully.",
      campaigns,
      insights,
    });
  } catch (error) {
    console.error(
      "Meta Sync Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error:
        error.response?.data?.error?.message ||
        "Failed to sync Meta data.",
    });
  }
};