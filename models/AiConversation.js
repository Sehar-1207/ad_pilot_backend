import mongoose from "mongoose";

const aiMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    campaignId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const aiConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      default: "New AI Conversation",
    },

    campaignId: {
      type: String,
      default: null,
    },

    messages: {
      type: [aiMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const AIConversation = mongoose.model(
  "AIConversation",
  aiConversationSchema
);