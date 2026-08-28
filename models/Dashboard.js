import mongoose from "mongoose";

const performanceSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    spend: {
      type: Number,
      default: 0,
    },

    revenue: {
      type: Number,
      default: 0,
    },

    impressions: {
      type: Number,
      default: 0,
    },

    clicks: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const dashboardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    totalSpend: {
      type: Number,
      default: 0,
    },

    impressions: {
      type: Number,
      default: 0,
    },

    totalClicks: {
      type: Number,
      default: 0,
    },

    ctr: {
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

    spendChange: {
      type: Number,
      default: 0,
    },

    impressionsChange: {
      type: Number,
      default: 0,
    },

    clicksChange: {
      type: Number,
      default: 0,
    },

    performance: [performanceSchema],
  },
  {
    timestamps: true,
  }
);

const Dashboard = mongoose.model("Dashboard", dashboardSchema);

export default Dashboard;