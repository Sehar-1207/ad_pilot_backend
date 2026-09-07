import express from "express";

import {
    getAdminOverview, getAdminUsers, getAdminUserById, getAdminSubscriptions, getAdminSubscriptionByUser, getAdminSubscriptionStats, cancelAdminSubscription,retryAdminSubscriptionPayment,
    getAdminProfile, updateAdminProfile, updateAdminPassword,
} from "../controllers/adminController.js";
import {protect} from "../middlewares/authMiddleware.js";
import adminMiddleware from "../middlewares/adminMiddleware.js";

const router = express.Router();
router.use(protect);
router.use(adminMiddleware);

router.get("/overview", getAdminOverview);
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserById);

router.get("/subscriptions/stats", getAdminSubscriptionStats);
router.get("/subscriptions/:userId", getAdminSubscriptionByUser);
router.get("/subscriptions", getAdminSubscriptions);
router.patch("/subscriptions/:id/cancel", cancelAdminSubscription);
router.post("/subscriptions/:id/retry",  retryAdminSubscriptionPayment);


router.get("/profile", getAdminProfile);
router.patch("/profile", updateAdminProfile);
router.patch("/profile/password", updateAdminPassword);

export default router;