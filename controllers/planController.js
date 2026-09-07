import { Plan } from "../models/Plan.js";

export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true, }).sort({ sortOrder: 1 }).lean();
    return res.status(200).json({ success: true, plans, });

  } catch (error) {
    console.error("Get Plans Error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch plans.", });
  }
};