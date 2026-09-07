import express from 'express';

import {getPlans} from '../controllers/planController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.get('/', getPlans);

export default router;