import { Request, Response, NextFunction } from 'express';
import { UsageTrackingService } from '../services/usageTrackingService';
import { logger } from '../lib/logger';
import { AuthenticatedRequest } from './auth';

/**
 * Middleware to check usage limits for a specific metric
 * Usage: router.post('/api/files/upload', usageLimitMiddleware('storage_gb'), uploadFile);
 */
export function usageLimitMiddleware(metric: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const businessId = req.body?.businessId || req.query?.businessId;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check usage limit
      const limitCheck = await UsageTrackingService.checkLimit(userId, metric, businessId);

      if (!limitCheck.allowed) {
        await logger.info('Usage limit exceeded', {
          operation: 'usage_limit_check',
          userId,
          metric,
          businessId,
          usageInfo: limitCheck.usageInfo,
        });

        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: limitCheck.reason,
          usageInfo: limitCheck.usageInfo,
          metric,
        });
      }

      // Attach usage info to request for potential use in route handler
      (req as any).usageInfo = limitCheck.usageInfo;

      next();
    } catch (error) {
      await logger.error('Error in usage limit middleware', {
        operation: 'usage_limit_middleware',
        metric,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      // Fail open - allow request if middleware fails
      next();
    }
  };
}

/**
 * Middleware to record usage after a successful operation
 * Usage: router.post('/api/files/upload', recordUsageMiddleware('storage_gb', calculateStorageSize), uploadFile);
 */
export function recordUsageMiddleware(
  metric: string,
  quantityCalculator?: (req: Request) => number | Promise<number>
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to record usage after response is sent
    res.json = function (body: unknown) {
      // Record usage in background (don't block response)
      setImmediate(async () => {
        try {
          const userId = req.user?.id;
          const businessId = (req.body as any)?.businessId || (req.query as any)?.businessId;

          if (!userId) return;

          let quantity = 1;
          if (quantityCalculator) {
            quantity = await quantityCalculator(req as unknown as Request);
          }

          await UsageTrackingService.recordUsage(userId, metric, quantity, 0, businessId);
        } catch (error) {
          // Silently fail - usage recording shouldn't break responses
          console.error('Error recording usage:', error);
        }
      });

      return originalJson(body);
    };

    next();
  };
}

/**
 * Combined middleware: check limit before, record usage after
 * Usage: router.post('/api/files/upload', usageLimitWithRecording('storage_gb', calculateStorageSize), uploadFile);
 */
export function usageLimitWithRecording(
  metric: string,
  quantityCalculator?: (req: Request) => number | Promise<number>
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const businessId = (req.body as any)?.businessId || (req.query as any)?.businessId;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check usage limit first
      const limitCheck = await UsageTrackingService.checkLimit(userId, metric, businessId);

      if (!limitCheck.allowed) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: limitCheck.reason,
          usageInfo: limitCheck.usageInfo,
          metric,
        });
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json to record usage after response
      res.json = function (body: unknown) {
        // Record usage in background
        setImmediate(async () => {
          try {
      let quantity = 1;
      if (quantityCalculator) {
        quantity = await quantityCalculator(req as unknown as Request);
      }

      await UsageTrackingService.recordUsage(userId!, metric, quantity, 0, businessId);
          } catch (error) {
            console.error('Error recording usage:', error);
          }
        });

        return originalJson(body);
      };

      next();
    } catch (error) {
      await logger.error('Error in usage limit with recording middleware', {
        operation: 'usage_limit_with_recording',
        metric,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Fail open
      next();
    }
  };
}

