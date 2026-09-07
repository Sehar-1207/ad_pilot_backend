import express from "express";

import {
    getAdminOverview, getAdminUsers, getAdminUserById, getAdminSubscriptions, getAdminSubscriptionByUser, getAdminSubscriptionStats,
    getAdminProfile, updateAdminProfile, updateAdminPassword,
} from "../controllers/adminController.js";
import {protect} from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireRole("ADMIN"));

router.get("/overview", getAdminOverview);
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserById);

router.get("/subscriptions/stats", getAdminSubscriptionStats);
router.get("/subscriptions/:userId", getAdminSubscriptionByUser);
router.get("/subscriptions", getAdminSubscriptions);


router.get("/profile", getAdminProfile);
router.patch("/profile", updateAdminProfile);
router.patch("/profile/password", updateAdminPassword);

export default router;