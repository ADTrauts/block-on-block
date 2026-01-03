import { Request, Response } from 'express';
import { PricingService } from '../services/pricingService';
import { logger } from '../lib/logger';
import { sendPriceChangeNotification } from '../services/emailService';
import { prisma } from '../lib/prisma';
import { StripeService } from '../services/stripeService';
import { STRIPE_PRODUCTS, stripe } from '../config/stripe';

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

    const { tier, billingCycle, basePrice, perEmployeePrice, includedEmployees, queryPackSmall, queryPackMedium, queryPackLarge, queryPackEnterprise, baseAIAllowance, stripePriceId, perEmployeeStripePriceId, effectiveDate, updateExistingSubscriptions } = req.body;

    if (!tier || !billingCycle || basePrice === undefined) {
      res.status(400).json({ error: 'Missing required fields: tier, billingCycle, basePrice' });
      return;
    }

    // Get current pricing to compare
    const currentPricing = await PricingService.getPricing(tier, billingCycle);
    const oldPrice = currentPricing?.basePrice || 0;
    const oldPerEmployeePrice = currentPricing?.perEmployeePrice || null;

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
    
    // Map tier to Stripe product ID
    const tierToProductId: Record<string, string> = {
      pro: STRIPE_PRODUCTS.PRO,
      business_basic: STRIPE_PRODUCTS.BUSINESS_BASIC,
      business_advanced: STRIPE_PRODUCTS.BUSINESS_ADVANCED,
      enterprise: STRIPE_PRODUCTS.ENTERPRISE,
    };

    // Automatically create/update Stripe price if basePrice changed and tier is paid
    let updatedStripePriceId = stripePriceId;
    if (basePrice > 0 && tierToProductId[tier] && basePrice !== oldPrice) {
      try {
        // Check if Stripe is configured
        const { isStripeConfigured } = await import('../config/stripe');
        if (!isStripeConfigured()) {
          await logger.warn('Stripe not configured, skipping price creation', {
            operation: 'pricing_create_stripe_price',
            tier,
            billingCycle,
          });
        } else {
          const productId = tierToProductId[tier];
          const interval = billingCycle === 'monthly' ? 'month' : 'year';
          const amountInCents = Math.round(basePrice * 100);

          // Create new Stripe price (Stripe doesn't allow updating prices, must create new)
          const newStripePrice = await StripeService.createPrice(
            productId,
            amountInCents,
            'usd',
            { 
              interval: interval as 'month' | 'year',
              metadata: { type: 'base', tier, billingCycle }
            }
          );

          updatedStripePriceId = newStripePrice.id;

          await logger.info('Created new Stripe price', {
            operation: 'pricing_create_stripe_price',
            tier,
            billingCycle,
            oldPrice,
            newPrice: basePrice,
            stripePriceId: newStripePrice.id,
          });
        }
      } catch (error) {
        // Log error but don't fail the request - pricing will still be saved
        await logger.error('Failed to create Stripe price', {
          operation: 'pricing_create_stripe_price',
          tier,
          billingCycle,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
        // Continue with existing stripePriceId if provided
      }
    }

    // Automatically create/update Stripe per-employee price if perEmployeePrice changed and tier is paid
    let updatedPerEmployeeStripePriceId = perEmployeeStripePriceId;
    if (perEmployeePrice !== undefined && perEmployeePrice !== null && perEmployeePrice > 0 && tierToProductId[tier] && perEmployeePrice !== oldPerEmployeePrice) {
      try {
        // Check if Stripe is configured
        const { isStripeConfigured } = await import('../config/stripe');
        if (!isStripeConfigured()) {
          await logger.warn('Stripe not configured, skipping per-employee price creation', {
            operation: 'pricing_create_per_employee_stripe_price',
            tier,
            billingCycle,
          });
        } else {
          const productId = tierToProductId[tier];
          const interval = billingCycle === 'monthly' ? 'month' : 'year';
          const amountInCents = Math.round(perEmployeePrice * 100);

          // Create new Stripe price for per-employee charges
          // Use a separate product for per-employee pricing to keep it organized
          // Or use the same product with a different price
          const perEmployeePriceObj = await StripeService.createPrice(
            productId,
            amountInCents,
            'usd',
            { 
              interval: interval as 'month' | 'year',
              // Add metadata to identify this as per-employee pricing
              metadata: { type: 'per_employee', tier, billingCycle }
            }
          );

          updatedPerEmployeeStripePriceId = perEmployeePriceObj.id;

          await logger.info('Created new Stripe per-employee price', {
            operation: 'pricing_create_per_employee_stripe_price',
            tier,
            billingCycle,
            oldPerEmployeePrice,
            newPerEmployeePrice: perEmployeePrice,
            stripePriceId: perEmployeePriceObj.id,
          });
        }
      } catch (error) {
        // Log error but don't fail the request - pricing will still be saved
        await logger.error('Failed to create Stripe per-employee price', {
          operation: 'pricing_create_per_employee_stripe_price',
          tier,
          billingCycle,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
        // Continue with existing perEmployeeStripePriceId if provided
      }
    } else if (perEmployeePrice === null || perEmployeePrice === 0) {
      // If per-employee price is removed, clear the Stripe price ID
      updatedPerEmployeeStripePriceId = null;
    }

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
        stripePriceId: updatedStripePriceId,
        perEmployeeStripePriceId: updatedPerEmployeeStripePriceId,
        effectiveDate: effectiveDateObj,
        createdBy: user.id,
      }
    );

    // Update existing subscriptions to new price if requested
    if (updateExistingSubscriptions && basePrice !== oldPrice && updatedStripePriceId && oldPrice > 0) {
      try {
        const { SubscriptionService } = await import('../services/subscriptionService');
        const subscriptionService = new SubscriptionService();
        
        // Get all active subscriptions for this tier
        const subscriptions = await prisma.subscription.findMany({
          where: {
            tier,
            status: 'active',
            stripeSubscriptionId: { not: null },
          },
        });

        let updated = 0;
        let failed = 0;

        for (const subscription of subscriptions) {
          try {
            if (subscription.stripeSubscriptionId && stripe) {
              // Update Stripe subscription to use new price
              const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
              const subscriptionItemId = stripeSubscription.items.data[0]?.id;

              if (subscriptionItemId) {
                await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                  items: [
                    {
                      id: subscriptionItemId,
                      price: updatedStripePriceId,
                    },
                  ],
                  proration_behavior: 'none', // No proration - change takes effect on next billing cycle
                });

                updated++;
                await logger.info('Updated existing subscription to new price', {
                  operation: 'pricing_update_existing_subscription',
                  subscriptionId: subscription.id,
                  tier,
                  oldPrice,
                  newPrice: basePrice,
                  stripePriceId: updatedStripePriceId,
                });
              }
            }
          } catch (error) {
            failed++;
            await logger.error('Failed to update existing subscription', {
              operation: 'pricing_update_existing_subscription',
              subscriptionId: subscription.id,
              tier,
              error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
              },
            });
          }
        }

        await logger.info('Updated existing subscriptions to new price', {
          operation: 'pricing_update_all_subscriptions',
          tier,
          total: subscriptions.length,
          updated,
          failed,
        });
      } catch (error) {
        // Log but don't fail the request
        await logger.error('Failed to update existing subscriptions', {
          operation: 'pricing_update_all_subscriptions',
          tier,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    }

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

