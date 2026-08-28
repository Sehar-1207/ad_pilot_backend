import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Meta campaign ID
    metaCampaignId: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"],
      default: "ACTIVE",
    },

    // Calculated health used by frontend filters
    health: {
      type: String,
      enum: ["PROFITABLE", "FATIGUED", "NEEDS_ATTENTION", "NORMAL"],
      default: "NORMAL",
    },

    adAccountId: {
      type: String,
      default: null,
    },

    adAccountName: {
      type: String,
      default: null,
    },

    spend: {
      type: Number,
      default: 0,
    },

    impressions: {
      type: Number,
      default: 0,
    },

    reach: {
      type: Number,
      default: 0,
    },

    clicks: {
      type: Number,
      default: 0,
    },

    ctr: {
      type: Number,
      default: 0,
    },

    cpc: {
      type: Number,
      default: 0,
    },

    cpm: {
      type: Number,
      default: 0,
    },

    conversions: {
      type: Number,
      default: 0,
    },

    costPerConversion: {
      type: Number,
      default: 0,
    },

    revenue: {
      type: Number,
      default: 0,
    },

    roas: {
      type: Number,
      default: 0,
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

campaignSchema.index(
  { user: 1, metaCampaignId: 1 },
  { unique: true }
);

export const Campaign = mongoose.model(
  "Campaign",
  campaignSchema
);