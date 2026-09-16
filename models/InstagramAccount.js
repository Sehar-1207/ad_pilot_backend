import mongoose from "mongoose";

const instagramAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    instagramAccountId: {
      type: String,
      required: true,
    },

    username: {
      type: String,
      default: null,
    },

    name: {
      type: String,
      default: null,
    },

    profilePictureUrl: {
      type: String,
      default: null,
    },

    followersCount: {
      type: Number,
      default: 0,
    },

    followsCount: {
      type: Number,
      default: 0,
    },

    mediaCount: {
      type: Number,
      default: 0,
    },

    facebookPageId: {
      type: String,
      default: null,
    },

    facebookPageName: {
      type: String,
      default: null,
    },

    isConnected: {
      type: Boolean,
      default: true,
    },

    connectedAt: {
      type: Date,
      default: Date.now,
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

export const InstagramAccount = mongoose.models.InstagramAccount || mongoose.model("InstagramAccount", instagramAccountSchema);