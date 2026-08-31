import { User } from "../models/User.js";
import { getMetaLoginUrl, exchangeCodeForToken, getMetaUser, getAdAccounts, getCampaignsFromMeta, getCampaignInsights, } from "../utils/metaService.js";

// =====================================================
// META OAUTH-> GET /api/meta/auth
// =====================================================

export const startMetaAuth = async (req, res) => {
  try {
    const url = getMetaLoginUrl();
    res.redirect(url);

  } catch (error) {
    console.error("Meta auth error:", error);
    res.status(500).json({ success: false, message: "Failed to start Meta authentication", });
  }
};

// =====================================================
// META CALLBACK -> GET /api/meta/callback
// =====================================================

export const metaCallback = async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.CLIENT_URL}/dashboard/settings?meta=cancelled`);
    }

    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL}/dashboard/settings?meta=error`);
    }

    const tokenData = await exchangeCodeForToken(code);
    const accessToken = tokenData.access_token;
    const metaUser = await getMetaUser(accessToken);
    res.redirect(`${process.env.CLIENT_URL}/dashboard/settings?meta=authorized&metaUserId=${metaUser.id}`);

  } catch (error) {
    console.error("Meta callback error:", error.response?.data || error.message);
    res.redirect(`${process.env.CLIENT_URL}/dashboard/settings?meta=error`);
  }
};


// =====================================================
//  AD ACCOUNTS -> GET /api/meta/ad-accounts
// =====================================================

export const listAdAccounts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({ success: false, code: "META_NOT_CONNECTED", message: "Meta account is not connected", });
    }

    const accounts = await getAdAccounts(user.metaAccessToken);
    res.json({
      success: true, data: accounts.map((account) => ({
        id: account.id, accountId: account.account_id, name: account.name,
        status: account.account_status, currency: account.currency, timezone: account.timezone_name,
      })),
    });

  } catch (error) {
    console.error("Ad accounts error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Failed to fetch Meta ad accounts", });
  }
};


// =====================================================
// CONNECT SELECTED AD ACCOUNT -> POST /api/meta/connect
// =====================================================

export const connectAdAccount = async (req, res) => {
  try {
    const { adAccountId, adAccountName, } = req.body;

    if (!adAccountId) {
      return res.status(400).json({ success: false, message: "Ad account ID is required", });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    if (!user.metaAccessToken) {
      return res.status(400).json({ success: false, code: "META_NOT_CONNECTED", message: "Complete Meta authorization first", });
    }

    const accounts = await getAdAccounts(user.metaAccessToken);
    const account = accounts.find((item) => item.id === adAccountId || item.account_id === adAccountId.replace("act_", ""));

    if (!account) {
      return res.status(403).json({ success: false, message: "You do not have access to this ad account", });
    }

    user.metaAdAccountId = account.id;
    user.metaAdAccountName = account.name || adAccountName || null;
    user.isMetaConnected = true;
    await user.save();
    res.json({
      success: true, message: "Meta ad account connected successfully",
      data: { adAccountId: user.metaAdAccountId, adAccountName: user.metaAdAccountName, isMetaConnected: user.isMetaConnected, },
    });

  } catch (error) {
    console.error("Connect ad account error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Failed to connect ad account", });
  }
};


// =====================================================
// META STATUS -> GET /api/meta/status
// =====================================================

export const getMetaStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("metaUserId metaAdAccountId metaAdAccountName metaTokenExpiresAt isMetaConnected");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    res.json({
      success: true, data: {
        connected: user.isMetaConnected, metaUserId: user.metaUserId,
        adAccountId: user.metaAdAccountId, adAccountName: user.metaAdAccountName, tokenExpiresAt: user.metaTokenExpiresAt,
      },
    });

  } catch (error) {
    console.error("Meta status error:", error);
    res.status(500).json({ success: false, message: "Failed to get Meta status", });
  }
};


// =====================================================
// DISCONNECT META -> POST /api/meta/disconnect
// =====================================================

export const disconnectMeta = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    user.metaUserId = null;
    user.metaAccessToken = null;
    user.metaAdAccountId = null;
    user.metaAdAccountName = null;
    user.metaTokenExpiresAt = null;
    user.isMetaConnected = false;
    await user.save();
    
    res.json({ success: true, message: "Meta account disconnected", });

  } catch (error) {
    console.error("Disconnect Meta error:", error);
    res.status(500).json({ success: false, message: "Failed to disconnect Meta account", });
  }
};


// =====================================================
// SYNC META CAMPAIGNS-> POST /api/meta/sync
// =====================================================

export const syncMetaData = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }

    if (!user.isMetaConnected || !user.metaAccessToken || !user.metaAdAccountId) {
      return res.status(400).json({ success: false, code: "META_NOT_CONNECTED", message: "Connect a Meta ad account first", });
    }

    const campaigns = await getCampaignsFromMeta({ accessToken: user.metaAccessToken, adAccountId: user.metaAdAccountId, });

    const insights = await getCampaignInsights({ accessToken: user.metaAccessToken, adAccountId: user.metaAdAccountId, });
    res.json({ success: true, message: "Meta data fetched successfully", data: { campaigns, insights, }, });

  } catch (error) {
    console.error("Meta sync error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Failed to sync Meta data", });
  }
};