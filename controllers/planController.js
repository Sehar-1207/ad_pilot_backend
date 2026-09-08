import { Plan } from "../models/Plan.js";

export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({
      isActive: true,
    })
      .sort({ sortOrder: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Get Plans Error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to fetch plans.",
    });
  }
};

export const createPlan = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      price,
      currency,
      billingPeriod,
      features,
      isPopular,
      isActive,
      sortOrder,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Plan name is required.",
      });
    }

    if (!slug) {
      return res.status(400).json({
        success: false,
        error: "Plan slug is required.",
      });
    }

    if (price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        error: "Plan price is required.",
      });
    }

    const existingPlan = await Plan.findOne({
      $or: [
        { name: name.trim().toUpperCase() },
        { slug: slug.trim().toLowerCase() },
      ],
    });

    if (existingPlan) {
      return res.status(409).json({
        success: false,
        error: "A plan with this name or slug already exists.",
      });
    }

    const plan = await Plan.create({
      name: name.trim().toUpperCase(),
      slug: slug.trim().toLowerCase(),
      description: description || "",
      price: Number(price),
      currency: currency || "USD",
      billingPeriod: billingPeriod || "monthly",
      features: Array.isArray(features) ? features : [],
      isPopular:
        isPopular !== undefined
          ? Boolean(isPopular)
          : false,
      isActive:
        isActive !== undefined
          ? Boolean(isActive)
          : true,
      sortOrder:
        sortOrder !== undefined
          ? Number(sortOrder)
          : 0,
    });

    return res.status(201).json({
      success: true,
      message: "Plan created successfully.",
      plan,
    });
  } catch (error) {
    console.error("Create Plan Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create plan.",
    });
  }
};