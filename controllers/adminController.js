import Stripe from "stripe";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sanitizeUser = (user) => {
    if (!user) return null;
    const userObject = user.toObject ? user.toObject() : { ...user };
    delete userObject.password;
    return userObject;
};

//  ADMIN DASHBOARD -> GET /api/admin/overview
export const getAdminOverview = async (req, res) => {
    try {
        const [totalUsers, proUsers, freeUsers, metaConnectedUsers, recentUsers,] = await Promise.all([User.countDocuments(),
        User.countDocuments({ plan: "PRO", }), User.countDocuments({ plan: "FREE", }), User.countDocuments({ isMetaConnected: true, }),
        User.find().select("-password").sort({ createdAt: -1 }).limit(5).lean(),]);

        const proPercentage = totalUsers > 0 ? Number(((proUsers / totalUsers) * 100).toFixed(2)) : 0;
        let mrr = 0;
        const proUsersWithSubscriptions = await User.find({ plan: "PRO", stripeSubscriptionId: { $ne: null } }).select("stripeSubscriptionId stripeCustomerId");

        for (const user of proUsersWithSubscriptions) {
            try {
                const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

                if (subscription.status !== "active" && subscription.status !== "trialing") {
                    continue;
                }
                const price = subscription.items.data[0]?.price;
                if (!price) continue;
                const amount = Number(price.unit_amount || 0);

                if (price.recurring?.interval === "month") {
                    mrr += amount / 100;
                }

                if (price.recurring?.interval === "year") {
                    mrr += amount / 100 / 12;
                }
            } catch (stripeError) {
                console.error(`Failed to retrieve subscription for user ${user._id}:`, stripeError.message);
            }
        }

        return res.status(200).json({
            success: true, data: {
                totalUsers, proUsers, freeUsers, metaConnectedUsers,
                proPercentage, mrr: Number(mrr.toFixed(2)), recentUsers,
            },
        });
    } catch (error) {
        console.error("Admin overview error:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch admin overview.", });
    }
};

// GET ALL USERS -> GET /api/admin/users
export const getAdminUsers = async (req, res) => {
    try {
        const { search = "", plan, page = 1, limit = 10, } = req.query;
        const pageNumber = Math.max(Number(page) || 1, 1);
        const limitNumber = Math.min(Math.max(Number(limit) || 10, 1), 100);
        const query = {};

        if (plan && plan.toUpperCase() !== "ALL") {
            query.plan = plan.toUpperCase();
        }

        if (search.trim()) {
            query.$or = [
                { name: { $regex: search.trim(), $options: "i", }, },
                { email: { $regex: search.trim(), $options: "i", }, },
            ];
        }

        const skip = (pageNumber - 1) * limitNumber;

        const [users, total, proUsers, freeUsers,] = await Promise.all([User.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limitNumber).lean(),
        User.countDocuments(query), User.countDocuments({ ...query, plan: "PRO", }), User.countDocuments({ ...query, plan: "FREE", }),
        ]);

        return res.status(200).json({
            success: true, data: {
                users, statistics: { total, proUsers, freeUsers, },
                pagination: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber), },
            },
        });
    } catch (error) {
        console.error("Admin users error:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch users.", });
    }
};


// GET SINGLE USER -> GET /api/admin/users/:id
export const getAdminUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select("-password").lean();

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found.", });
        }
        return res.status(200).json({ success: true, user, });

    } catch (error) {
        console.error("Get admin user error:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch user.", });
    }
};


// GET ADMIN SUBSCRIPTIONS -> GET /api/admin/subscriptions
export const getAdminSubscriptions = async (req, res) => {
    try {
        const { search = "", status, page = 1, limit = 10, } = req.query;
        const pageNumber = Math.max(Number(page) || 1, 1);
        const limitNumber = Math.min(Math.max(Number(limit) || 10, 1), 100);
        const query = { stripeSubscriptionId: { $ne: null, }, };

        if (search.trim()) {
            query.$or = [
                { name: { $regex: search.trim(), $options: "i", }, },
                { email: { $regex: search.trim(), $options: "i", }, },
                { stripeCustomerId: { $regex: search.trim(), $options: "i", }, },
                { stripeSubscriptionId: { $regex: search.trim(), $options: "i", }, },
            ];
        }

        if (status && status.toUpperCase() === "ACTIVE") {
            query.plan = "PRO";
        }

        const skip = (pageNumber - 1) * limitNumber;
        const [users, total] = await Promise.all([User.find(query).select(["name", "email", "plan", "stripeCustomerId", "stripeSubscriptionId", "stripePriceId", "planEndsAt", "createdAt",].join(" "))
            .sort({ createdAt: -1 }).skip(skip).limit(limitNumber).lean(), User.countDocuments(query),]);

        const subscriptions = await Promise.all(
            users.map(async (user) => {
                let stripeSubscription = null;
                if (user.stripeSubscriptionId) {
                    try {
                        stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                    } catch (stripeError) {
                        console.error(`Stripe subscription error for ${user._id}:`, stripeError.message);
                    }
                }

                const item = stripeSubscription?.items?.data?.[0];
                const price = item?.price;

                return {
                    userId: user._id, customer: { name: user.name, email: user.email, }, plan: user.plan,
                    stripe: {
                        customerId: user.stripeCustomerId || null,
                        subscriptionId: user.stripeSubscriptionId || null,
                        priceId: user.stripePriceId || null,
                        status: stripeSubscription?.status || null,
                        cancelAtPeriodEnd: stripeSubscription?.cancel_at_period_end || false,
                        currentPeriodStart: stripeSubscription?.current_period_start ? new Date(stripeSubscription.current_period_start * 1000) : null,
                        currentPeriodEnd: stripeSubscription?.current_period_end ? new Date(stripeSubscription.current_period_end * 1000) : null,
                        amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
                        currency: price?.currency || null,
                        billingInterval: price?.recurring?.interval || null,
                    },
                    planEndsAt: user.planEndsAt || null,
                    createdAt: user.createdAt,
                };
            })
        );

        return res.status(200).json({
            success: true, data: {
                subscriptions,
                pagination: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) }
            },
        });
    } catch (error) {
        console.error("Admin subscriptions error:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch subscriptions.", });
    }
};

// GET SUBSCRIPTION BY USER -> GET /api/admin/subscriptions/:userId
export const getAdminSubscriptionByUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select(["name", "email", "plan", "stripeCustomerId",
            "stripeSubscriptionId", "stripePriceId", "planEndsAt",].join(" ")).lean();

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found.", });
        }

        if (!user.stripeSubscriptionId) {
            return res.status(404).json({ success: false, error: "User does not have a Stripe subscription.", });
        }

        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const item = subscription.items?.data?.[0];
        const price = item?.price;

        return res.status(200).json({
            success: true, data: {
                user: { id: user._id, name: user.name, email: user.email, plan: user.plan, },
                subscription: {
                    id: subscription.id,
                    customer: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
                    status: subscription.status,
                    priceId: price?.id || user.stripePriceId || null,
                    amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
                    currency: price?.currency || null,
                    billingInterval: price?.recurring?.interval || null,
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
                    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
                },
            }
        });
    } catch (error) {
        console.error("Admin subscription details error:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch subscription details.", });
    }
};


//SUBSCRIPTION STATISTICS -> GET /api/admin/subscriptions/stats

export const getAdminSubscriptionStats = async (req, res) => {
    try {
        const proUsers = await User.find({ plan: "PRO", stripeSubscriptionId: { $ne: null, }, }).select("stripeSubscriptionId");
        let active = 0;
        let trialing = 0;
        let pastDue = 0;
        let canceled = 0;
        let unpaid = 0;
        let mrr = 0;

        for (const user of proUsers) {
            try {
                const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

                switch (subscription.status) {
                    case "active":
                        active++;
                        break;

                    case "trialing":
                        trialing++;
                        break;

                    case "past_due":
                        pastDue++;
                        break;

                    case "canceled":
                        canceled++;
                        break;

                    case "unpaid":
                        unpaid++;
                        break;

                    default:
                        break;
                }

                if (subscription.status === "active" || subscription.status === "trialing") {
                    const price = subscription.items.data[0]?.price;

                    if (price) {
                        const amount = Number(price.unit_amount || 0) / 100;

                        if (price.recurring?.interval === "month") {
                            mrr += amount;
                        }

                        if (price.recurring?.interval === "year") {
                            mrr += amount / 12;
                        }
                    }
                }
            } catch (stripeError) {
                console.error(`Failed to retrieve Stripe subscription ${user.stripeSubscriptionId}:`, stripeError.message);
            }
        }

        const totalProUsers = await User.countDocuments({ plan: "PRO", });
        const totalFreeUsers = await User.countDocuments({ plan: "FREE", });
        return res.status(200).json({
            success: true, data: {
                mrr: Number(mrr.toFixed(2)), active, trialing, pastDue, canceled,
                unpaid, totalProUsers, totalFreeUsers, totalSubscriptions: active + trialing + pastDue + canceled + unpaid,
            },
        });
    } catch (error) {
        console.error("Admin subscription statistics error:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch subscription statistics.", });
    }
};


// GET ADMIN PROFILE ->GET /api/admin/profile
export const getAdminProfile = async (req, res) => {
    try {
        const admin = await User.findById(req.user._id).select("-password").lean();

        if (!admin) {
            return res.status(404).json({ success: false, error: "Admin not found.", });
        }

        return res.status(200).json({
            success: true, admin: {
                id: admin._id, name: admin.name, email: admin.email, role: admin.role,
                plan: admin.plan, createdAt: admin.createdAt, updatedAt: admin.updatedAt,
            },
        });
    } catch (error) {
        console.error("Admin profile error:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch admin profile.", });
    }
};

// UPDATE ADMIN PROFILE -> PATCH /api/admin/profile
export const updateAdminProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const admin = await User.findById(req.user._id);

        if (!admin) {
            return res.status(404).json({ success: false, error: "Admin not found.", });
        }

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({ success: false, error: "Name cannot be empty.", });
            }
            admin.name = name.trim();
        }

        if (email !== undefined) {
            const normalizedEmail = email.trim().toLowerCase();
            if (!normalizedEmail) {
                return res.status(400).json({ success: false, error: "Email cannot be empty.", });
            }
            const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: admin._id, }, });
            if (existingUser) {
                return res.status(409).json({ success: false, error: "Another account already uses this email.", });
            }
            admin.email = normalizedEmail;
        }

        await admin.save();
        return res.status(200).json({
            success: true, message: "Admin profile updated successfully.",
            admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, plan: admin.plan, },
        });
    } catch (error) {
        console.error("Update admin profile error:", error);
        return res.status(500).json({ success: false, error: "Failed to update admin profile.", });
    }
};


//  CHANGE ADMIN PASSWORD ->PATCH /api/admin/profile/password
export const updateAdminPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: "Current password and new password are required.", });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: "New password must be at least 8 characters long.", });
        }

        const admin = await User.findById(req.user._id);

        if (!admin) {
            return res.status(404).json({ success: false, error: "Admin not found.", });
        }

        const passwordMatches =  await bcrypt.compare(currentPassword,  admin.password  );

        if (!passwordMatches) {
            return res.status(400).json({  success: false,  error:   "Current password is incorrect.", });
        }

        const samePassword =  await bcrypt.compare(   newPassword,admin.password);

        if (samePassword) {
            return res.status(400).json({success: false,  error:    "New password must be different from the current password.", });
        }

        const hashedPassword = await bcrypt.hash(  newPassword,  12  );
        admin.password = hashedPassword;
        await admin.save();
        return res.status(200).json({ success: true,   message:   "Admin password updated successfully."  });

    } catch (error) {
        console.error(  "Update admin password error:",error );
        return res.status(500).json({ success: false,  error:"Failed to update admin password.", });
    }
};