import axios from "axios";

const META_GRAPH_VERSION = "v24.0";
const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const getMetaConfig = () => {
  const { META_APP_ID, META_APP_SECRET, META_REDIRECT_URI } = process.env;

  if (!META_APP_ID) {
    throw new Error("META_APP_ID is missing");
  }

  if (!META_APP_SECRET) {
    throw new Error("META_APP_SECRET is missing");
  }

  if (!META_REDIRECT_URI) {
    throw new Error("META_REDIRECT_URI is missing");
  }

  return {
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    redirectUri: META_REDIRECT_URI,
  };
};


export const getMetaLoginUrl = (state) => {
  const { appId, redirectUri } = getMetaConfig();

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",

    scope: [
      "public_profile",
      "email",
      "ads_read",
      "ads_management",
      "business_management",
    ].join(","),

    state,
  });

  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
};


export const exchangeCodeForToken = async (code) => {
  const { appId, appSecret, redirectUri } = getMetaConfig();

  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/oauth/access_token`,
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      }
    );

    if (!response.data?.access_token) {
      throw new Error("Meta did not return an access token");
    }

    return {
      accessToken: response.data.access_token,
      tokenType: response.data.token_type || "bearer",
      expiresIn: response.data.expires_in || null,
    };
  } catch (error) {
    console.error(
      "Meta token exchange failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
        "Failed to exchange Meta authorization code"
    );
  }
};


export const getMetaUser = async (accessToken) => {
  try {
    const response = await axios.get(`${META_GRAPH_URL}/me`, {
      params: {
        fields: "id,name,email",
        access_token: accessToken,
      },
    });

    return response.data;
  } catch (error) {
    console.error(
      "Meta user request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
        "Failed to retrieve Meta user"
    );
  }
};


export const debugMetaToken = async (accessToken) => {
  const { appId, appSecret } = getMetaConfig();

  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/debug_token`,
      {
        params: {
          input_token: accessToken,
          access_token: `${appId}|${appSecret}`,
        },
      }
    );

    return response.data?.data || null;
  } catch (error) {
    console.error(
      "Meta token debug failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
        "Failed to validate Meta access token"
    );
  }
};
export const getMetaAdAccounts = async (accessToken) => {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/me/adaccounts`,
      {
        params: {
          fields: [
            "id",
            "account_id",
            "name",
            "account_status",
            "currency",
            "timezone_name",
            "business",
          ].join(","),

          access_token: accessToken,

          limit: 100,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Meta ad accounts request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
        "Failed to retrieve Meta ad accounts"
    );
  }
};


export const getMetaAdAccount = async (
  accessToken,
  adAccountId
) => {
  const normalizedId = adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;

  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${normalizedId}`,
      {
        params: {
          fields: [
            "id",
            "account_id",
            "name",
            "account_status",
            "currency",
            "timezone_name",
            "business",
          ].join(","),

          access_token: accessToken,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Meta ad account request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
        "Failed to retrieve Meta ad account"
    );
  }
};


export const getMetaCampaigns = async (
  accessToken,
  adAccountId
) => {
  const normalizedId = adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;

  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${normalizedId}/campaigns`,
      {
        params: {
          fields: [
            "id",
            "name",
            "status",
            "effective_status",
            "objective",
            "created_time",
            "updated_time",
          ].join(","),

          access_token: accessToken,

          limit: 100,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Meta campaigns request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
        "Failed to retrieve Meta campaigns"
    );
  }
};


export const getMetaCampaignInsights = async (
  accessToken,
  campaignId,
  datePreset = "last_30d"
) => {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${campaignId}/insights`,
      {
        params: {
          fields: [
            "campaign_id",
            "campaign_name",
            "impressions",
            "reach",
            "clicks",
            "spend",
            "ctr",
            "cpc",
            "cpm",
            "actions",
            "action_values",
            "purchase_roas",
          ].join(","),

          date_preset: datePreset,

          access_token: accessToken,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Meta campaign insights request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
        "Failed to retrieve campaign insights"
    );
  }
};

export const metaGraphRequest = async ({
  method = "GET",
  endpoint,
  accessToken,
  params = {},
  data = {},
}) => {
  try {
    const response = await axios({
      method,
      url: `${META_GRAPH_URL}${endpoint}`,
      params: {
        ...params,
        access_token: accessToken,
      },
      data,
    });

    return response.data;
  } catch (error) {
    console.error(
      "Meta Graph API request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
        "Meta Graph API request failed"
    );
  }
};

export {
  META_GRAPH_VERSION,
  META_GRAPH_URL,
};