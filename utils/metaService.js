import axios from "axios";

const META_GRAPH_VERSION = "v24.0";
const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_OAUTH_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

// ============================================================
// HELPERS
// ============================================================

const normalizeAdAccountId = (id) => {
  if (!id) return null;

  return String(id).replace(/^act_/, "");
};

const fetchAllPages = async (url, params) => {
  let nextUrl = url;
  let nextParams = params;

  const results = [];

  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      params: nextParams,
      timeout: 30000,
    });

    results.push(...(response.data?.data || []));

    nextUrl = response.data?.paging?.next || null;

    // The paging.next URL already contains its parameters.
    nextParams = undefined;
  }

  return results;
};

// ============================================================
// META OAUTH
// ============================================================

export const getMetaLoginUrl = (state) => {
  if (!process.env.META_APP_ID) {
    throw new Error("META_APP_ID is not configured.");
  }

  if (!process.env.META_REDIRECT_URI) {
    throw new Error("META_REDIRECT_URI is not configured.");
  }

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    response_type: "code",

    // Permissions required by Ad Pilot.
    //
    // NOTE:
    // Meta must approve/allow these permissions for your app.
    scope:
      "public_profile,email,ads_read,ads_management,business_management",

    ...(state ? { state } : {}),
  });

  return `${META_OAUTH_URL}?${params.toString()}`;
};

// ============================================================
// EXCHANGE AUTHORIZATION CODE FOR ACCESS TOKEN
// ============================================================

export const exchangeCodeForToken = async (code) => {
  if (!code) {
    throw new Error("Meta authorization code is required.");
  }

  if (!process.env.META_APP_ID) {
    throw new Error("META_APP_ID is not configured.");
  }

  if (!process.env.META_APP_SECRET) {
    throw new Error("META_APP_SECRET is not configured.");
  }

  if (!process.env.META_REDIRECT_URI) {
    throw new Error("META_REDIRECT_URI is not configured.");
  }

  const response = await axios.get(
    `${META_GRAPH_URL}/oauth/access_token`,
    {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: process.env.META_REDIRECT_URI,
        code,
      },
      timeout: 30000,
    }
  );

  return response.data;
};

// ============================================================
// GET META USER
// ============================================================

export const getMetaUser = async (accessToken) => {
  if (!accessToken) {
    throw new Error("Meta access token is required.");
  }

  const response = await axios.get(
    `${META_GRAPH_URL}/me`,
    {
      params: {
        fields: "id,name",
        access_token: accessToken,
      },
      timeout: 30000,
    }
  );

  return response.data;
};

// ============================================================
// GET USER'S AD ACCOUNTS
// ============================================================

export const getAdAccounts = async (accessToken) => {
  if (!accessToken) {
    throw new Error("Meta access token is required.");
  }

  return fetchAllPages(
    `${META_GRAPH_URL}/me/adaccounts`,
    {
      fields:
        "id,name,account_id,account_status,currency,timezone_name",
      access_token: accessToken,
      limit: 100,
    }
  );
};

// ============================================================
// GET CAMPAIGNS
// ============================================================

export const getCampaignsFromMeta = async ({
  accessToken,
  adAccountId,
}) => {
  const normalizedId = normalizeAdAccountId(adAccountId);

  if (!accessToken) {
    throw new Error("Meta access token is required.");
  }

  if (!normalizedId) {
    throw new Error("Meta ad account ID is required.");
  }

  return fetchAllPages(
    `${META_GRAPH_URL}/act_${normalizedId}/campaigns`,
    {
      fields: [
        "id",
        "name",
        "status",
        "effective_status",
        "objective",
        "daily_budget",
        "lifetime_budget",
        "created_time",
        "updated_time",
        "start_time",
        "stop_time",
      ].join(","),
      access_token: accessToken,
      limit: 100,
    }
  );
};

// ============================================================
// GET CAMPAIGN INSIGHTS
// ============================================================

export const getCampaignInsights = async ({
  accessToken,
  adAccountId,
  datePreset = "last_30d",
}) => {
  const normalizedId = normalizeAdAccountId(adAccountId);

  if (!accessToken) {
    throw new Error("Meta access token is required.");
  }

  if (!normalizedId) {
    throw new Error("Meta ad account ID is required.");
  }

  return fetchAllPages(
    `${META_GRAPH_URL}/act_${normalizedId}/insights`,
    {
      level: "campaign",

      fields: [
        "campaign_id",
        "campaign_name",
        "spend",
        "impressions",
        "reach",
        "clicks",
        "ctr",
        "cpc",
        "cpm",
        "actions",
        "action_values",
        "date_start",
        "date_stop",
      ].join(","),

      date_preset: datePreset,
      access_token: accessToken,
      limit: 100,
    }
  );
};