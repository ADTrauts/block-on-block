import { Request, Response } from 'express';
import { UsageTrackingService } from '../services/usageTrackingService';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

/**
 * GET /api/usage
 * Get all usage information for the authenticated user
 */
export async function getAllUsage(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { businessId } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const usage = await UsageTrackingService.getAllUsage(
      userId,
      typeof businessId === 'string' ? businessId : undefined
    );

    res.json({ success: true, usage });
  } catch (error) {
    await logger.error('Failed to get all usage', {
      operation: 'usage_tracking_get_all',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage information',
    });
  }
}

/**
 * GET /api/usage/:metric
 * Get usage information for a specific metric
 */
export async function getUsage(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { metric } = req.params;
    const { businessId } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!metric) {
      res.status(400).json({ error: 'Metric parameter is required' });
      return;
    }

    const usageInfo = await UsageTrackingService.getUsageInfo(
      userId,
      metric,
      typeof businessId === 'string' ? businessId : undefined
    );

    if (!usageInfo) {
      res.status(404).json({ error: 'Usage information not found' });
      return;
    }

    res.json({ success: true, usage: usageInfo });
  } catch (error) {
    await logger.error('Failed to get usage', {
      operation: 'usage_tracking_get',
      metric: req.params.metric,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage information',
    });
  }
}

/**
 * GET /api/usage/alerts
 * Get usage alerts (warnings at 80%, 90%, 100%)
 */
export async function getUsageAlerts(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { businessId } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const alerts = await UsageTrackingService.getUsageAlerts(
      userId,
      typeof businessId === 'string' ? businessId : undefined
    );

    res.json({ success: true, alerts });
  } catch (error) {
    await logger.error('Failed to get usage alerts', {
      operation: 'usage_tracking_get_alerts',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage alerts',
    });
  }
}

/**
 * GET /api/usage/overage
 * Get total overage cost for the current period
 */
export async function getOverageCost(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { businessId } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const overageCost = await UsageTrackingService.calculateOverageCost(
      userId,
      typeof businessId === 'string' ? businessId : undefined
    );

    res.json({ success: true, overageCost });
  } catch (error) {
    await logger.error('Failed to calculate overage cost', {
      operation: 'usage_tracking_get_overage',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to calculate overage cost',
    });
  }
}

