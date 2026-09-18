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
  const { META_APP_ID, META_CONFIG_ID, META_REDIRECT_URI } = process.env;

  if (!META_APP_ID) {
    throw new Error("META_APP_ID is missing");
  }

  if (!META_CONFIG_ID) {
    throw new Error("META_CONFIG_ID is missing");
  }

  if (!META_REDIRECT_URI) {
    throw new Error("META_REDIRECT_URI is missing");
  }

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    response_type: "code",
    config_id: META_CONFIG_ID,
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

    console.log(
      "[META CAMPAIGNS] Account:",
      normalizedId
    );

    console.log(
      "[META CAMPAIGNS] Received:",
      response.data?.data?.length ?? 0
    );

    return response.data;
  } catch (error) {
    console.error(
      "[META CAMPAIGNS] Error:",
      JSON.stringify(
        error.response?.data ?? error.message,
        null,
        2
      )
    );

    const metaError =
      error.response?.data?.error;

    const message =
      metaError?.message ||
      error.message ||
      "Failed to retrieve Meta campaigns";

    const enhancedError = new Error(message);

    enhancedError.code =
      metaError?.code ?? null;

    enhancedError.type =
      metaError?.type ?? null;

    enhancedError.errorSubcode =
      metaError?.error_subcode ?? null;

    enhancedError.httpStatus =
      error.response?.status ?? 500;

    throw enhancedError;
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
      "[META INSIGHTS] Error:",
      JSON.stringify(
        error.response?.data ?? error.message,
        null,
        2
      )
    );

    const metaError =
      error.response?.data?.error;

    const message =
      metaError?.message ||
      error.message ||
      "Failed to retrieve campaign insights";

    const enhancedError = new Error(message);

    enhancedError.code =
      metaError?.code ?? null;

    enhancedError.type =
      metaError?.type ?? null;

    enhancedError.errorSubcode =
      metaError?.error_subcode ?? null;

    enhancedError.httpStatus =
      error.response?.status ?? 500;

    throw enhancedError;
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

export const getMetaFacebookPages = async (accessToken) => {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/me/accounts`,
      {
        params: {
          fields: [
            "id",
            "name",
            "access_token",
            "category",
            "tasks",
            "instagram_business_account",
          ].join(","),
          access_token: accessToken,
          limit: 100,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Meta Facebook Pages request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
      "Failed to retrieve Facebook Pages"
    );
  }
};

export const getMetaInstagramAccounts = async (accessToken) => {
  try {
    const pagesResponse = await getMetaFacebookPages(accessToken);

    const pages = pagesResponse?.data || [];

    const instagramAccounts = [];

    for (const page of pages) {
      if (!page.instagram_business_account?.id) {
        continue;
      }

      try {
        const response = await axios.get(
          `${META_GRAPH_URL}/${page.instagram_business_account.id}`,
          {
            params: {
              fields: [
                "id",
                "username",
                "name",
                "profile_picture_url",
                "followers_count",
                "follows_count",
                "media_count",
              ].join(","),
              access_token: accessToken,
            },
          }
        );

        instagramAccounts.push({
          ...response.data,
          facebookPageId: page.id,
          facebookPageName: page.name,
        });
      } catch (error) {
        console.error(
          `[META INSTAGRAM] Failed for page ${page.id}:`,
          error.response?.data || error.message
        );
      }
    }

    return {
      data: instagramAccounts,
      pages,
    };
  } catch (error) {
    console.error(
      "Meta Instagram accounts request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
      "Failed to retrieve Instagram accounts"
    );
  }
};

export const getMetaInstagramAccount = async (accessToken, instagramAccountId) => {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${instagramAccountId}`,
      {
        params: {
          fields: [
            "id",
            "username",
            "name",
            "profile_picture_url",
            "followers_count",
            "follows_count",
            "media_count",
          ].join(","),
          access_token: accessToken,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Meta Instagram account request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
      "Failed to retrieve Instagram account"
    );
  }
};

export const getMetaInstagramInsights = async (accessToken, instagramAccountId, metrics = "impressions,reach,profile_views") => {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${instagramAccountId}/insights`,
      {
        params: {
          metric: metrics,
          period: "day",
          access_token: accessToken,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Meta Instagram insights request failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
      "Failed to retrieve Instagram insights"
    );
  }
};
export const getMetaInstagramMedia = async (
  accessToken,
  instagramAccountId,
  limit = 50
) => {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${instagramAccountId}/media`,
      {
        params: {
          fields: [
            "id",
            "caption",
            "media_type",
            "media_product_type",
            "media_url",
            "thumbnail_url",
            "permalink",
            "timestamp",
            "username",
          ].join(","),
          limit,
          access_token: accessToken,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "[META INSTAGRAM MEDIA] Error:",
      JSON.stringify(
        error.response?.data || error.message,
        null,
        2
      )
    );

    const metaError = error.response?.data?.error;

    const message =
      metaError?.message ||
      error.message ||
      "Failed to retrieve Instagram media";

    const enhancedError = new Error(message);

    enhancedError.code = metaError?.code ?? null;
    enhancedError.type = metaError?.type ?? null;
    enhancedError.errorSubcode =
      metaError?.error_subcode ?? null;
    enhancedError.httpStatus =
      error.response?.status ?? 500;

    throw enhancedError;
  }
};
export const getMetaInstagramMediaInsights = async (
  accessToken,
  mediaId,
  metrics
) => {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${mediaId}/insights`,
      {
        params: {
          metric: metrics,
          access_token: accessToken,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "[META INSTAGRAM MEDIA INSIGHTS] Error:",
      JSON.stringify(
        error.response?.data || error.message,
        null,
        2
      )
    );

    const metaError = error.response?.data?.error;

    const message =
      metaError?.message ||
      error.message ||
      "Failed to retrieve Instagram media insights";

    const enhancedError = new Error(message);

    enhancedError.code = metaError?.code ?? null;
    enhancedError.type = metaError?.type ?? null;
    enhancedError.errorSubcode =
      metaError?.error_subcode ?? null;
    enhancedError.httpStatus =
      error.response?.status ?? 500;

    throw enhancedError;
  }
};