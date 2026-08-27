import express from 'express';
import { createCheckoutSession } from '../controllers/subscriptionController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.post('/checkout', protect, createCheckoutSession);
export default router;