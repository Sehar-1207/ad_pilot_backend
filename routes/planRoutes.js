import express from 'express';

import {
  getPlans,
  getPlanById,
  subscribeToPlan,
} from '../controllers/planController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.get('/', getPlans);
router.get('/:id', getPlanById);
router.post('/:id/subscribe', protect, subscribeToPlan);

export default router;