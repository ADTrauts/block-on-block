import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import {
  getAllPricing,
  getPricing,
  getPricingInfo,
  upsertPricing,
  getPriceHistory,
  getAllPriceHistory,
  calculatePriceImpact,
  clearPricingCache,
} from '../controllers/pricingController';

const router: express.Router = express.Router();

// Helper middleware to check admin role
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Public routes (for frontend to display pricing)
router.get('/', getAllPricing);
router.get('/:tier', getPricing);
router.get('/:tier/info', getPricingInfo);

// Admin-only routes
router.post('/', authenticateJWT, requireAdmin, upsertPricing);
router.post('/calculate-impact', authenticateJWT, requireAdmin, calculatePriceImpact);
router.get('/history/all', authenticateJWT, requireAdmin, getAllPriceHistory);
router.get('/:pricingConfigId/history', authenticateJWT, requireAdmin, getPriceHistory);
router.post('/clear-cache', authenticateJWT, requireAdmin, clearPricingCache);

export default router;

