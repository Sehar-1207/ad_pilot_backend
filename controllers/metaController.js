import crypto from "crypto";

import { getMetaLoginUrl, exchangeCodeForToken, getMetaUser, debugMetaToken, getMetaAdAccounts, getMetaAdAccount, } from "../utils/metaService.js";
import { User } from "../models/User.js";

const CLIENT_URL = process.env.CLIENT_URL;

const META_REDIRECT_URI = process.env.META_REDIRECT_URI;

if (!META_REDIRECT_URI) {
  console.warn("WARNING: META_REDIRECT_URI is not configured");
}


const createState = (userId) => {
  const nonce = crypto.randomBytes(32).toString("hex");
  const statePayload = { userId: userId.toString(), nonce, createdAt: Date.now(), };
  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");
  return { state, nonce, };
};

const parseState = (state) => {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const redirectWithError = (res, errorCode, errorMessage) => {
  const params = new URLSearchParams({
    meta: "error",
    error: errorCode,
    message: errorMessage,
  });

  return res.redirect(
    `${CLIENT_URL}/dashboard/settings?${params.toString()}`
  );
};

export const startMetaAuth = async (req, res) => {
  try {
    if (!req.user?._id) {
      return redirectWithError(res, "AUTH_REQUIRED", "You must be logged in to connect Meta.");
    }

    if (!process.env.META_APP_ID) {
      return redirectWithError(res, "META_CONFIG_ERROR", "META_APP_ID is not configured.");
    }

    if (!process.env.META_APP_SECRET) {
      return redirectWithError(res, "META_CONFIG_ERROR", "META_APP_SECRET is not configured.");
    }

    if (!META_REDIRECT_URI) {
      return redirectWithError(res, "META_CONFIG_ERROR", "META_REDIRECT_URI is not configured.");
    }

    const { state } = createState(req.user._id);
    const metaLoginUrl = getMetaLoginUrl(state);

    console.log("Starting Meta OAuth for user:", req.user._id.toString());
    return res.redirect(metaLoginUrl);
  } catch (error) {
    console.error("Start Meta Auth Error:", error);

    return redirectWithError(res, "OAUTH_START_FAILED", error.message || "Unable to start Meta authorization.");
  }
};

export const metaCallback = async (req, res) => {
  const { code, state, error, error_reason, error_description, } = req.query;

  if (error) {
    console.error("Meta OAuth returned an error:", { error, error_reason, error_description, });
    return redirectWithError(res, error, error_description || error_reason || "Meta authorization was cancelled or denied.");
  }

  if (!code) {
    console.error("Meta callback did not contain authorization code.");
    return redirectWithError(res, "MISSING_CODE", "Meta did not return an authorization code.");
  }

  if (!state) {
    console.error("Meta callback did not contain state.");
    return redirectWithError(res, "MISSING_STATE", "Meta authorization state is missing.");
  }

  try {
    const stateData = parseState(state);
    if (!stateData?.userId) {
      return redirectWithError(res, "INVALID_STATE", "Invalid Meta authorization state.");
    }

    if (stateData.createdAt && Date.now() - stateData.createdAt > 10 * 60 * 1000) {
      return redirectWithError(res, "STATE_EXPIRED", "Meta authorization session expired. Please try again.");
    }


    const user = await User.findById(stateData.userId);

    if (!user) {
      return redirectWithError(res, "USER_NOT_FOUND", "Ad Pilot user account could not be found.");
    }

    console.log("Exchanging Meta authorization code...");

    const tokenData = await exchangeCodeForToken(code);

    const { accessToken, expiresIn, } = tokenData;

    if (!accessToken) {
      return redirectWithError(res, "TOKEN_ERROR", "Meta did not return an access token.");
    }

    console.log("Validating Meta access token...");

    const tokenDebug = await debugMetaToken(accessToken);

    if (tokenDebug && tokenDebug.is_valid === false) {
      return redirectWithError(
        res,
        "INVALID_TOKEN",
        "Meta returned an invalid access token."
      );
    }
    const metaUser = await getMetaUser(accessToken);

    if (!metaUser?.id) {
      return redirectWithError(
        res,
        "META_USER_ERROR",
        "Could not retrieve your Meta account."
      );
    }

    let tokenExpiresAt = null;

    if (expiresIn) {
      tokenExpiresAt = new Date(
        Date.now() +
        Number(expiresIn) * 1000
      );
    }


    user.metaUserId = metaUser.id;
    user.metaAccessToken = accessToken;
    user.metaTokenExpiresAt =
      tokenExpiresAt;
    user.isMetaConnected = true;

    await user.save();

    console.log(
      "Meta successfully connected:",
      {
        userId: user._id.toString(),
        metaUserId: metaUser.id,
        expiresAt: tokenExpiresAt,
      }
    );
    return res.redirect(
      `${CLIENT_URL}/dashboard/settings?meta=connected`
    );
  } catch (error) {

    console.error(
      "META CALLBACK ERROR", error.message
    );

    console.error(
      "Meta response:",
      error.response?.data
    );

    return redirectWithError(
      res,
      "META_CALLBACK_FAILED",
      error.message ||
      "Unable to connect your Meta account."
    );
  }
};


export const getMetaStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("isMetaConnected metaUserId metaAdAccountId metaTokenExpiresAt");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let connected = Boolean(user.isMetaConnected);

    if (
      user.metaTokenExpiresAt &&
      new Date(user.metaTokenExpiresAt) <=
      new Date()
    ) {
      connected = false;
    }

    return res.json({
      success: true,
      connected,
      metaUserId: user.metaUserId || null,
      adAccountId: user.metaAdAccountId || null,
      tokenExpiresAt: user.metaTokenExpiresAt || null,
    });
  } catch (error) {
    console.error(
      "Get Meta Status Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get Meta connection status",
    });
  }
};


export const getAdAccounts = async (req, res) => {
  try {
    const user = await User.findById(
      req.user._id
    ).select(
      "metaAccessToken isMetaConnected metaTokenExpiresAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      !user.isMetaConnected ||
      !user.metaAccessToken
    ) {
      return res.status(400).json({
        success: false,
        code: "META_NOT_CONNECTED",
        message:
          "Please connect your Meta account first.",
      });
    }

    if (
      user.metaTokenExpiresAt &&
      new Date(user.metaTokenExpiresAt) <=
      new Date()
    ) {
      return res.status(401).json({
        success: false,
        code: "META_TOKEN_EXPIRED",
        message:
          "Your Meta connection has expired. Please reconnect.",
      });
    }

    const accounts =
      await getMetaAdAccounts(
        user.metaAccessToken
      );

    return res.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error(
      "Get Meta Ad Accounts Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve Meta ad accounts",
    });
  }
};


export const connectMetaAdAccount = async (req, res) => {
  try {
    const { adAccountId, } = req.body;

    if (!adAccountId) {
      return res.status(400).json({
        success: false,
        message:
          "adAccountId is required",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      !user.isMetaConnected ||
      !user.metaAccessToken
    ) {
      return res.status(400).json({
        success: false,
        code: "META_NOT_CONNECTED",
        message:
          "Please connect your Meta account first.",
      });
    }

    const adAccount =
      await getMetaAdAccount(
        user.metaAccessToken,
        adAccountId
      );

    if (!adAccount?.id) {
      return res.status(400).json({
        success: false,
        message:
          "The selected Meta ad account could not be verified.",
      });
    }

    user.metaAdAccountId =
      adAccount.id;

    await user.save();

    return res.json({
      success: true,
      message:
        "Meta ad account connected successfully.",
      data: adAccount,
    });
  } catch (error) {
    console.error(
      "Connect Meta Ad Account Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to connect Meta ad account",
    });
  }
};


export const disconnectMeta = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
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
      message:
        "Failed to disconnect Meta account",
    });
  }
};