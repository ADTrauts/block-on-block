/**
 * AI Query Controller
 * 
 * Handles API endpoints for AI query balance, consumption, and pack purchases.
 */

import { Request, Response } from 'express';
import { AIQueryService } from '../services/aiQueryService';
import { AI_QUERY_PACKS, type QueryPackType } from '../config/aiQueryPacks';
import { logger } from '../lib/logger';

/**
 * GET /api/ai/queries/balance
 * Get current query balance and availability
 */
export async function getQueryBalance(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { businessId } = req.query;
    const businessIdParam = typeof businessId === 'string' ? businessId : null;

    // Admin users get unlimited access
    if (userRole === 'ADMIN') {
      res.json({
        success: true,
        data: {
          available: true,
          remaining: -1, // -1 means unlimited
          totalAvailable: -1,
          breakdown: {
            baseAllowance: -1,
            purchased: 0,
            rolledOver: 0,
          },
          isUnlimited: true,
        },
      });
      return;
    }

    const availability = await AIQueryService.checkQueryAvailability(userId, businessIdParam);

    res.json({
      success: true,
      data: availability,
    });
  } catch (error: unknown) {
    const err = error as Error;
    // Log detailed error for debugging
    console.error('Error in getQueryBalance:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    await logger.error('Failed to get query balance', {
      operation: 'ai_query_get_balance',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false,
      error: 'Failed to get query balance',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
}

/**
 * POST /api/ai/queries/consume
 * Consume AI queries (typically called internally by AI services)
 */
export async function consumeQuery(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { businessId, amount } = req.body;
    const consumeAmount = typeof amount === 'number' ? amount : 1;
    const businessIdParam = typeof businessId === 'string' ? businessId : null;

    if (consumeAmount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than 0' });
      return;
    }

    const result = await AIQueryService.consumeQuery(userId, businessIdParam, consumeAmount);

    if (!result.success) {
      res.status(429).json({
        success: false,
        error: result.error || 'Insufficient query balance',
        remaining: result.remaining,
      });
      return;
    }

    res.json({
      success: true,
      remaining: result.remaining,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to consume query', {
      operation: 'ai_query_consume',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false,
      error: 'Failed to consume query' 
    });
  }
}

/**
 * POST /api/ai/queries/purchase
 * Create payment intent for query pack purchase
 */
export async function purchaseQueryPack(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { packType, businessId } = req.body;

    if (!packType || typeof packType !== 'string') {
      res.status(400).json({ error: 'packType is required' });
      return;
    }

    if (!Object.keys(AI_QUERY_PACKS).includes(packType)) {
      res.status(400).json({ error: 'Invalid pack type' });
      return;
    }

    const businessIdParam = typeof businessId === 'string' ? businessId : null;

    const result = await AIQueryService.purchaseQueryPack(
      userId,
      packType as QueryPackType,
      businessIdParam
    );

    res.json({
      success: true,
      data: {
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        queries: result.queries,
        price: result.price,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to create query pack purchase', {
      operation: 'ai_query_purchase',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false,
      error: 'Failed to create purchase' 
    });
  }
}

/**
 * GET /api/ai/queries/purchases
 * Get purchase history
 */
export async function getPurchaseHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { businessId, limit } = req.query;
    const businessIdParam = typeof businessId === 'string' ? businessId : null;
    const limitParam = typeof limit === 'string' ? parseInt(limit, 10) : 50;

    const purchases = await AIQueryService.getPurchaseHistory(
      userId,
      businessIdParam,
      limitParam
    );

    res.json({
      success: true,
      data: purchases,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get purchase history', {
      operation: 'ai_query_get_history',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false,
      error: 'Failed to get purchase history' 
    });
  }
}

/**
 * GET /api/ai/queries/packs
 * Get available query pack options
 */
export async function getQueryPacks(req: Request, res: Response): Promise<void> {
  try {
    // Convert pack config to array format for frontend
    const packs = Object.entries(AI_QUERY_PACKS).map(([key, pack]) => ({
      id: key,
      ...pack,
    }));

    res.json({
      success: true,
      data: packs,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get query packs', {
      operation: 'ai_query_get_packs',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false,
      error: 'Failed to get query packs' 
    });
  }
}

/**
 * GET /api/ai/queries/spending
 * Get current spending status and limit
 */
export async function getSpendingStatus(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  const { businessId } = req.query;
  const businessIdParam = typeof businessId === 'string' ? businessId : null;

  try {
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const status = await AIQueryService.getSpendingStatus(userId, businessIdParam);

    res.json({ success: true, data: status });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get spending status', {
      operation: 'ai_query_get_spending',
      error: { message: err.message, stack: err.stack },
      userId: userId || undefined,
      businessId: businessIdParam || undefined
    });
    
    // Include error details in development mode for debugging
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: 'Failed to get spending status',
      ...(isDevelopment && { details: err.message })
    });
  }
}

/**
 * PUT /api/ai/queries/spending/limit
 * Set monthly spending limit for AI query overage
 */
export async function setSpendingLimit(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { limit, businessId } = req.body;

    if (typeof limit !== 'number' || limit < 0) {
      res.status(400).json({ error: 'Limit must be a number >= 0' });
      return;
    }

    const businessIdParam = typeof businessId === 'string' ? businessId : null;

    await AIQueryService.setSpendingLimit(userId, limit, businessIdParam);

    res.json({ success: true, message: 'Spending limit updated' });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to set spending limit', {
      operation: 'ai_query_set_spending_limit',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to set spending limit' });
  }
}

