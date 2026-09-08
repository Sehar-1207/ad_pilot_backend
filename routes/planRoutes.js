import express from "express";

import {
  getPlans,
  createPlan,
} from "../controllers/planController.js";

const router = express.Router();

router.get("/", getPlans);

router.post("/", createPlan);

export default router;