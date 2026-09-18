import mongoose from "mongoose";

const instagramMediaSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    instagramAccountId: {
      type: String,
      required: true,
      index: true,
    },

    mediaId: {
      type: String,
      required: true,
      index: true,
    },

    caption: {
      type: String,
      default: null,
    },

    mediaType: {
      type: String,
      default: null,
    },

    mediaProductType: {
      type: String,
      default: null,
    },

    mediaUrl: {
      type: String,
      default: null,
    },

    thumbnailUrl: {
      type: String,
      default: null,
    },

    permalink: {
      type: String,
      default: null,
    },

    timestamp: {
      type: Date,
      default: null,
    },

    username: {
      type: String,
      default: null,
    },

    likes: {
      type: Number,
      default: 0,
    },

    comments: {
      type: Number,
      default: 0,
    },

    saves: {
      type: Number,
      default: 0,
    },

    shares: {
      type: Number,
      default: 0,
    },

    views: {
      type: Number,
      default: 0,
    },

    reach: {
      type: Number,
      default: 0,
    },

    totalInteractions: {
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

instagramMediaSchema.index(
  {user: 1,  mediaId: 1,},
  {  unique: true,}
);

export const InstagramMedia = mongoose.models.InstagramMedia || mongoose.model("InstagramMedia", instagramMediaSchema);