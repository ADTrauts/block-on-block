/**
 * AI Query Routes
 * 
 * Handles routes for AI query balance, consumption, and pack purchases.
 */

import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as aiQueryController from '../controllers/aiQueryController';

const router: express.Router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// GET /api/ai/queries/balance - Get current query balance
router.get('/balance', aiQueryController.getQueryBalance);

// POST /api/ai/queries/consume - Consume queries (internal use)
router.post('/consume', aiQueryController.consumeQuery);

// POST /api/ai/queries/purchase - Create payment intent for pack purchase
router.post('/purchase', aiQueryController.purchaseQueryPack);

// GET /api/ai/queries/purchases - Get purchase history
router.get('/purchases', aiQueryController.getPurchaseHistory);

// GET /api/ai/queries/packs - Get available query pack options
router.get('/packs', aiQueryController.getQueryPacks);

// Spending limit management (Cursor-style)
router.get('/spending', aiQueryController.getSpendingStatus);
router.put('/spending/limit', aiQueryController.setSpendingLimit);

export default router;

