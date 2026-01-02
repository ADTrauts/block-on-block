import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import {
  getAllUsage,
  getUsage,
  getUsageAlerts,
  getOverageCost,
} from '../controllers/usageTrackingController';

const router: express.Router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// Get all usage information
router.get('/', getAllUsage);

// Get usage for a specific metric
router.get('/:metric', getUsage);

// Get usage alerts
router.get('/alerts/list', getUsageAlerts);

// Get overage cost
router.get('/overage/cost', getOverageCost);

export default router;

