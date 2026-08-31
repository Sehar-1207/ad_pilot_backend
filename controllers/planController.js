import { Plan } from '../models/Plan.js';
import { User } from '../models/User.js';

export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    return res.json({ success: true, plans });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, isActive: true, });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found.', });
    }

    return res.json({ success: true, plan, });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, });
  }
};

export const subscribeToPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findOne({ _id: id, isActive: true, });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found.', });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.', });
    }

    user.plan = plan.slug;
    await user.save();

    return res.json({
      success: true, message: `Successfully selected ${plan.name} plan.`,
      plan: { id: plan._id, name: plan.name, slug: plan.slug, price: plan.price, billingPeriod: plan.billingPeriod, },
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan, },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, });
  }
};