import crypto from "crypto";
import { User } from "../models/User.js";

import {
  getMetaLoginUrl,
  exchangeCodeForToken,
  getMetaUser,
  getAdAccounts as fetchMetaAdAccounts,
  getCampaignsFromMeta,
  getCampaignInsights,
} from "../utils/metaService.js";

// ============================================================
// HELPERS
// ============================================================

const getClientSettingsUrl = (params = "") => {
  return `${process.env.CLIENT_URL}/dashboard/settings${params}`;
};

const getMetaErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

// ============================================================
// START META AUTH
// ============================================================

export const startMetaAuth = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "You must be logged in to connect Meta.",
      });
    }

    if (!process.env.META_APP_ID) {
      return res.status(500).json({
        success: false,
        error: "Meta App ID is not configured.",
      });
    }

    if (!process.env.META_REDIRECT_URI) {
      return res.status(500).json({
        success: false,
        error: "Meta redirect URI is not configured.",
      });
    }

    if (!process.env.CLIENT_URL) {
      return res.status(500).json({
        success: false,
        error: "CLIENT_URL is not configured.",
      });
    }

    // Generate random nonce.
    const nonce = crypto.randomBytes(32).toString("hex");

    // Store user ID + nonce in OAuth state.
    const statePayload = {
      userId: req.user._id.toString(),
      nonce,
      createdAt: Date.now(),
    };

    const state = Buffer.from(
      JSON.stringify(statePayload)
    ).toString("base64url");

    const metaAuthUrl = getMetaLoginUrl(state);

    console.log("Starting Meta OAuth...");
    console.log("Meta Redirect URI:", process.env.META_REDIRECT_URI);

    return res.redirect(metaAuthUrl);
  } catch (error) {
    console.error(
      "Start Meta Auth Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error: "Unable to start Meta authentication.",
    });
  }
};

// ============================================================
// META CALLBACK
// ============================================================

export const metaCallback = async (req, res) => {
  const {
    code,
    error,
    error_description,
    state,
  } = req.query;

  // ----------------------------------------------------------
  // USER DENIED / META RETURNED ERROR
  // ----------------------------------------------------------

  if (error || !code || !state) {
    console.error("Meta OAuth denied:", {
      error,
      error_description,
    });

    return res.redirect(
      getClientSettingsUrl("?meta=denied")
    );
  }

  try {
    // --------------------------------------------------------
    // DECODE STATE
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
        getClientSettingsUrl("?meta=invalid_state")
      );
    }

    const {
      userId,
      nonce,
      createdAt,
    } = stateData;

    // --------------------------------------------------------
    // VALIDATE STATE
    // --------------------------------------------------------

    if (!userId || !nonce || !createdAt) {
      return res.redirect(
        getClientSettingsUrl("?meta=invalid_state")
      );
    }

    // Reject very old OAuth states.
    // 10 minutes is enough for an OAuth flow.
    const stateAge = Date.now() - Number(createdAt);

    if (
      Number.isNaN(stateAge) ||
      stateAge > 10 * 60 * 1000
    ) {
      console.error("Meta OAuth state expired.");

      return res.redirect(
        getClientSettingsUrl("?meta=state_expired")
      );
    }

    // --------------------------------------------------------
    // FIND USER
    // --------------------------------------------------------

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect(
        getClientSettingsUrl("?meta=user_not_found")
      );
    }

    // --------------------------------------------------------
    // EXCHANGE CODE FOR ACCESS TOKEN
    // --------------------------------------------------------

    const tokenResponse =
      await exchangeCodeForToken(code);

    const {
      access_token: accessToken,
      expires_in: expiresIn,
    } = tokenResponse || {};

    if (!accessToken) {
      console.error(
        "Meta did not return an access token."
      );

      return res.redirect(
        getClientSettingsUrl("?meta=token_failed")
      );
    }

    // --------------------------------------------------------
    // GET META USER
    // --------------------------------------------------------

    const metaUser =
      await getMetaUser(accessToken);

    if (!metaUser?.id) {
      console.error(
        "Meta user information was not returned."
      );

      return res.redirect(
        getClientSettingsUrl("?meta=profile_failed")
      );
    }

    // --------------------------------------------------------
    // CALCULATE TOKEN EXPIRATION
    // --------------------------------------------------------

    let tokenExpiresAt = null;

    if (expiresIn) {
      const expiresInSeconds =
        Number(expiresIn);

      if (
        Number.isFinite(expiresInSeconds) &&
        expiresInSeconds > 0
      ) {
        tokenExpiresAt = new Date(
          Date.now() +
            expiresInSeconds * 1000
        );
      }
    }

    // --------------------------------------------------------
    // SAVE META INFORMATION
    // --------------------------------------------------------

    user.metaUserId = metaUser.id;
    user.metaAccessToken = accessToken;
    user.isMetaConnected = true;

    user.metaTokenExpiresAt =
      tokenExpiresAt;

    // Do not automatically select an ad account here.
    // The user should select one through the dashboard.

    await user.save();

    console.log(
      `Meta account connected for Ad Pilot user: ${user._id}`
    );

    return res.redirect(
      getClientSettingsUrl("?meta=connected")
    );
  } catch (error) {
    console.error(
      "Meta Callback Error:",
      error.response?.data || error.message
    );

    return res.redirect(
      getClientSettingsUrl("?meta=error")
    );
  }
};

// ============================================================
// GET AD ACCOUNTS
// ============================================================

export const getAdAccounts = async (req, res) => {
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
        error: "Meta account is not connected.",
      });
    }

    // Check token expiration if available.
    if (
      user.metaTokenExpiresAt &&
      new Date(user.metaTokenExpiresAt) <= new Date()
    ) {
      return res.status(401).json({
        success: false,
        error:
          "Your Meta connection has expired. Please reconnect your Meta account.",
        code: "META_TOKEN_EXPIRED",
      });
    }

    const adAccounts =
      await fetchMetaAdAccounts(
        user.metaAccessToken
      );

    return res.json({
      success: true,
      adAccounts,
    });
  } catch (error) {
    console.error(
      "Get Ad Accounts Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error: getMetaErrorMessage(
        error,
        "Failed to fetch Meta ad accounts."
      ),
    });
  }
};

// ============================================================
// CONNECT / SELECT AD ACCOUNT
// ============================================================

export const connectAdAccount = async (
  req,
  res
) => {
  try {
    const { adAccountId } =
      req.body;

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
        error: "Meta account is not connected.",
      });
    }

    const adAccounts =
      await fetchMetaAdAccounts(
        user.metaAccessToken
      );

    const requestedId = String(
      adAccountId
    );

    const normalizedRequestedId =
      requestedId.replace(/^act_/, "");

    const selectedAccount =
      adAccounts.find((account) => {
        const accountId =
          account?.account_id
            ? String(account.account_id)
            : null;

        const id =
          account?.id
            ? String(account.id)
            : null;

        return (
          id === requestedId ||
          accountId === requestedId ||
          id === `act_${normalizedRequestedId}` ||
          accountId === normalizedRequestedId
        );
      });

    if (!selectedAccount) {
      return res.status(403).json({
        success: false,
        error:
          "You do not have access to this Meta ad account.",
      });
    }

    // Always store normalized account ID.
    user.metaAdAccountId =
      normalizeStoredAdAccountId(
        selectedAccount
      );

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
      error: getMetaErrorMessage(
        error,
        "Failed to connect Meta ad account."
      ),
    });
  }
};

// ============================================================
// NORMALIZE STORED AD ACCOUNT ID
// ============================================================

const normalizeStoredAdAccountId = (
  account
) => {
  if (!account) {
    return null;
  }

  const accountId =
    account.account_id ||
    account.id;

  if (!accountId) {
    return null;
  }

  return String(accountId).replace(
    /^act_/,
    ""
  );
};

// ============================================================
// META CONNECTION STATUS
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

    const tokenExpired =
      user.metaTokenExpiresAt &&
      new Date(user.metaTokenExpiresAt) <=
        new Date();

    return res.json({
      success: true,

      isMetaConnected:
        Boolean(user.isMetaConnected) &&
        !tokenExpired,

      metaUserId:
        user.metaUserId || null,

      metaAdAccountId:
        user.metaAdAccountId || null,

      metaTokenExpiresAt:
        user.metaTokenExpiresAt || null,

      tokenExpired:
        Boolean(tokenExpired),
    });
  } catch (error) {
    console.error(
      "Meta Status Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Failed to get Meta connection status.",
    });
  }
};

// ============================================================
// DISCONNECT META
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
      error: "Failed to disconnect Meta account.",
    });
  }
};

// ============================================================
// SYNC META
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
        error: "Meta account is not connected.",
      });
    }

    if (
      user.metaTokenExpiresAt &&
      new Date(user.metaTokenExpiresAt) <=
        new Date()
    ) {
      return res.status(401).json({
        success: false,
        error:
          "Your Meta connection has expired. Please reconnect your Meta account.",
        code: "META_TOKEN_EXPIRED",
      });
    }

    if (!user.metaAdAccountId) {
      return res.status(400).json({
        success: false,
        error:
          "No Meta ad account has been selected.",
      });
    }

    const [
      campaigns,
      insights,
    ] = await Promise.all([
      getCampaignsFromMeta({
        accessToken:
          user.metaAccessToken,

        adAccountId:
          user.metaAdAccountId,
      }),

      getCampaignInsights({
        accessToken:
          user.metaAccessToken,

        adAccountId:
          user.metaAdAccountId,

        datePreset: "last_30d",
      }),
    ]);

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

      error: getMetaErrorMessage(
        error,
        "Failed to sync Meta data."
      ),
    });
  }
};