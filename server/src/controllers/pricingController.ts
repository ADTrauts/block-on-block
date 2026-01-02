import { Request, Response } from 'express';
import { PricingService } from '../services/pricingService';
import { logger } from '../lib/logger';
import { sendPriceChangeNotification } from '../services/emailService';
import { prisma } from '../lib/prisma';

/**
 * GET /api/pricing
 * Get all active pricing configurations
 */
export const getAllPricing = async (req: Request, res: Response): Promise<void> => {
  try {
    const pricing = await PricingService.getAllActivePricing();
    res.json({ pricing });
  } catch (error) {
    await logger.error('Failed to get all pricing', {
      operation: 'pricing_get_all',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to get pricing' });
  }
};

/**
 * GET /api/pricing/:tier
 * Get pricing for a specific tier
 */
export const getPricing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tier } = req.params;
    const { billingCycle } = req.query;

    const cycle = (billingCycle as string) === 'yearly' ? 'yearly' : 'monthly';
    const pricing = await PricingService.getPricing(tier, cycle);

    if (!pricing) {
      res.status(404).json({ error: 'Pricing not found for tier' });
      return;
    }

    res.json({ pricing });
  } catch (error) {
    await logger.error('Failed to get pricing', {
      operation: 'pricing_get',
      tier: req.params.tier,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to get pricing' });
  }
};

/**
 * GET /api/pricing/:tier/info
 * Get pricing info in compatible format
 */
export const getPricingInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tier } = req.params;
    const pricingInfo = await PricingService.getPricingInfo(tier);

    if (!pricingInfo) {
      res.status(404).json({ error: 'Pricing not found for tier' });
      return;
    }

    res.json({ pricing: pricingInfo });
  } catch (error) {
    await logger.error('Failed to get pricing info', {
      operation: 'pricing_get_info',
      tier: req.params.tier,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to get pricing info' });
  }
};

/**
 * POST /api/pricing
 * Create or update pricing configuration (admin only)
 */
export const upsertPricing = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { tier, billingCycle, basePrice, perEmployeePrice, includedEmployees, queryPackSmall, queryPackMedium, queryPackLarge, queryPackEnterprise, baseAIAllowance, stripePriceId, effectiveDate } = req.body;

    if (!tier || !billingCycle || basePrice === undefined) {
      res.status(400).json({ error: 'Missing required fields: tier, billingCycle, basePrice' });
      return;
    }

    // Get current pricing to compare
    const currentPricing = await PricingService.getPricing(tier, billingCycle);
    const oldPrice = currentPricing?.basePrice || 0;

    // Record price change if price changed
    if (currentPricing && basePrice !== oldPrice) {
      await PricingService.recordPriceChange(
        currentPricing.id,
        'base_price',
        oldPrice,
        basePrice,
        req.body.reason || null,
        user.id
      );
    }

    const effectiveDateObj = effectiveDate ? new Date(effectiveDate) : new Date();
    const pricing = await PricingService.upsertPricing(
      tier,
      billingCycle,
      {
        basePrice,
        perEmployeePrice,
        includedEmployees,
        queryPackSmall,
        queryPackMedium,
        queryPackLarge,
        queryPackEnterprise,
        baseAIAllowance,
        stripePriceId,
        effectiveDate: effectiveDateObj,
        createdBy: user.id,
      }
    );

    // Send email notifications if requested and price changed
    if (req.body.sendNotifications && basePrice !== oldPrice && oldPrice > 0) {
      try {
        // Get all active subscriptions for this tier
        const subscriptions = await prisma.subscription.findMany({
          where: {
            tier,
            status: 'active',
          },
          include: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        });

        // Send notifications (non-blocking)
        Promise.all(
          subscriptions.map((sub) =>
            sendPriceChangeNotification({
              toEmail: sub.user.email,
              tier,
              billingCycle,
              oldPrice,
              newPrice: basePrice,
              effectiveDate: effectiveDateObj,
              userName: sub.user.name || undefined,
            }).catch((err) => {
              console.error(`Failed to send notification to ${sub.user.email}:`, err);
            })
          )
        ).catch((err) => {
          console.error('Error sending price change notifications:', err);
        });

        // Mark price change as notification sent
        if (currentPricing) {
          await prisma.priceChange.updateMany({
            where: {
              pricingConfigId: currentPricing.id,
              changeType: 'base_price',
              oldValue: oldPrice,
              newValue: basePrice,
            },
            data: {
              notificationSent: true,
              notificationSentAt: new Date(),
            },
          });
        }
      } catch (error) {
        // Log but don't fail the request
        await logger.error('Failed to send price change notifications', {
          operation: 'pricing_send_notifications',
          tier,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    res.json({ pricing });
  } catch (error) {
    await logger.error('Failed to upsert pricing', {
      operation: 'pricing_upsert',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to update pricing' });
  }
};

/**
 * GET /api/pricing/:pricingConfigId/history
 * Get price change history for a pricing config
 */
export const getPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pricingConfigId } = req.params;
    const history = await PricingService.getPriceHistory(pricingConfigId);
    res.json({ history });
  } catch (error) {
    await logger.error('Failed to get price history', {
      operation: 'pricing_get_history',
      pricingConfigId: req.params.pricingConfigId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to get price history' });
  }
};

/**
 * POST /api/pricing/clear-cache
 * Clear pricing cache (admin only)
 */
export const clearPricingCache = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    PricingService.clearCache();
    res.json({ message: 'Pricing cache cleared' });
  } catch (error) {
    await logger.error('Failed to clear pricing cache', {
      operation: 'pricing_clear_cache',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to clear cache' });
  }
};

/**
 * POST /api/pricing/calculate-impact
 * Calculate impact of a price change (admin only)
 */
export const calculatePriceImpact = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { tier, newBasePrice, billingCycle } = req.body;

    if (!tier || newBasePrice === undefined) {
      res.status(400).json({ error: 'Missing required fields: tier, newBasePrice' });
      return;
    }

    const impact = await PricingService.calculatePriceChangeImpact(
      tier,
      newBasePrice,
      billingCycle || 'monthly'
    );

    res.json({ impact });
  } catch (error) {
    await logger.error('Failed to calculate price impact', {
      operation: 'pricing_calculate_impact',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to calculate impact' });
  }
};

/**
 * GET /api/pricing/history/all
 * Get all price change history (admin only)
 */
export const getAllPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { prisma } = await import('../lib/prisma');
    const history = await prisma.priceChange.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pricingConfig: {
          select: {
            tier: true,
            billingCycle: true,
          },
        },
      },
      take: 100, // Limit to last 100 changes
    });

    res.json({ history });
  } catch (error) {
    await logger.error('Failed to get all price history', {
      operation: 'pricing_get_all_history',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to get price history' });
  }
};

