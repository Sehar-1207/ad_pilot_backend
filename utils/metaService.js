import axios from "axios";

const META_GRAPH_URL = "https://graph.facebook.com/v24.0";

//META LOGIN URL
export const getMetaLoginUrl = () => {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    response_type: "code",
    scope: ["ads_read", "business_management", ].join(","),
  });
  return `https://www.facebook.com/v24.0/dialog/oauth?${params.toString()}`;
};

// FOR ACCESS TOKEN
export const exchangeCodeForToken = async (code) => {
  const response = await axios.get(
    `${META_GRAPH_URL}/oauth/access_token`,
    {
      params: {
        client_id:
          process.env.META_APP_ID,
        client_secret:
          process.env.META_APP_SECRET,
        redirect_uri:
          process.env.META_REDIRECT_URI,
        code,
      },
    }
  );
  return response.data;
};


// Single META USER
export const getMetaUser = async (accessToken) => {
  const response = await axios.get(
    `${META_GRAPH_URL}/me`,
    {
      params: {
        fields: "id,name",
        access_token: accessToken,
      },
    }
  );
  return response.data;
};


// USER'S AD ACCOUNTS
export const getAdAccounts = async (accessToken) => {
  const response = await axios.get(
    `${META_GRAPH_URL}/me/adaccounts`,
    {
      params: {
        fields:
          "id,name,account_id,account_status,currency,timezone_name",
        access_token: accessToken,
        limit: 100,
      },
    }
  );
  return response.data.data || [];
};

// CAMPAIGNS
export const getCampaignsFromMeta = async ({accessToken, adAccountId,}) => {
  const response = await axios.get(
    `${META_GRAPH_URL}/${adAccountId}/campaigns`,
    {
      params: {
        fields: ["id", "name", "status", "objective", "daily_budget", "lifetime_budget", "created_time", "updated_time",].join(","),
        access_token: accessToken,
        limit: 100,
      },
    }
  );
  return response.data.data || [];
};

// CAMPAIGN INSIGHTS
export const getCampaignInsights = async ({accessToken, adAccountId,}) => {
  const response = await axios.get(
    `${META_GRAPH_URL}/${adAccountId}/insights`,
    {
      params: {
        level: "campaign",
        fields: ["campaign_id",  "campaign_name",  "spend",  "impressions",  "reach",  "clicks",  "ctr",  "cpc",  "cpm",  "actions",  "action_values",  "date_start",  "date_stop",].join(","),
        date_preset: "last_30d",
        access_token: accessToken,
        limit: 100,
      },
    }
  );
  return response.data.data || [];
};