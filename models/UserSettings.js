import mongoose from "mongoose";

const adAccountSchema = new mongoose.Schema(
  {
    accountId: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    pixelId: {
      type: String,
      default: null,
    },

    syncEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);

const userSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    adAccounts: {
      type: [adAccountSchema],
      default: [],
    },

    sync: {
      frequency: {
        type: String,
        enum: ["MANUAL", "HOURLY", "DAILY"],
        default: "DAILY",
      },

      importRange: {
        type: String,
        enum: ["7d", "14d", "30d", "90d"],
        default: "7d",
      },

      lastSyncAt: {
        type: Date,
        default: null,
      },
    },

    notifications: {
      emailAlerts: {
        type: Boolean,
        default: true,
      },

      campaignAlerts: {
        type: Boolean,
        default: true,
      },

      weeklyReports: {
        type: Boolean,
        default: true,
      },

      syncFailureAlerts: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const UserSettings = mongoose.model( "UserSettings",  userSettingsSchema);