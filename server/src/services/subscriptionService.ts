import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil' as any, // TypeScript types may lag behind Stripe API versions
}) : null;

export interface CreateSubscriptionParams {
  userId: string;
  businessId?: string;
  tier: 'free' | 'standard' | 'enterprise';
  stripeCustomerId?: string;
  employeeCount?: number; // Total employees for business plans
  billingCycle?: 'monthly' | 'yearly'; // Billing cycle for the subscription
}

export interface UpdateSubscriptionParams {
  subscriptionId: string;
  tier?: 'free' | 'standard' | 'enterprise';
  status?: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  cancelAtPeriodEnd?: boolean;
}

export class SubscriptionService {
  /**
   * Create a new subscription
   */
  async createSubscription(params: CreateSubscriptionParams) {
    const { userId, businessId, tier, stripeCustomerId, employeeCount, billingCycle = 'monthly' } = params;

    // Get pricing configuration for this tier
    const { PricingService } = await import('./pricingService');
    const pricingConfig = await PricingService.getPricing(tier, billingCycle);
    
    const includedEmployees = pricingConfig?.includedEmployees || 0;
    const perEmployeePrice = pricingConfig?.perEmployeePrice || null;
    
    // Calculate additional employees and cost
    const additionalEmployees = employeeCount && includedEmployees 
      ? Math.max(0, employeeCount - includedEmployees) 
      : 0;
    const additionalEmployeeCost = perEmployeePrice && additionalEmployees > 0
      ? perEmployeePrice * additionalEmployees
      : null;

    // Set subscription period
    const now = new Date();
    const periodDays = billingCycle === 'yearly' ? 365 : 30;
    const currentPeriodStart = now;
    const currentPeriodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    // Create subscription in database
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        businessId,
        tier,
        status: 'active',
        currentPeriodStart,
        currentPeriodEnd,
        stripeCustomerId,
        cancelAtPeriodEnd: false,
        employeeCount: employeeCount || null,
        includedEmployees: includedEmployees || null,
        additionalEmployeeCost: additionalEmployeeCost || null,
      },
      include: {
        user: true,
        business: true,
      },
    });

    // If this is a paid tier, create Stripe subscription
    if (tier !== 'free' && stripeCustomerId && stripe) {
      try {
        const stripePriceId = await this.getStripePriceId(tier, billingCycle);
        if (!stripePriceId) {
          throw new Error(`No Stripe price ID found for tier: ${tier}`);
        }

        // Build subscription items: base price + per-employee price (if applicable)
        const subscriptionItems: Array<{ price: string; quantity?: number }> = [
          {
            price: stripePriceId,
          },
        ];

        // Add per-employee pricing if there are additional employees
        if (additionalEmployees > 0 && pricingConfig?.perEmployeeStripePriceId) {
          subscriptionItems.push({
            price: pricingConfig.perEmployeeStripePriceId,
            quantity: additionalEmployees,
          });
        }

        const stripeSubscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: subscriptionItems,
          metadata: {
            subscriptionId: subscription.id,
            userId,
            businessId: businessId || '',
            employeeCount: employeeCount?.toString() || '0',
            includedEmployees: includedEmployees?.toString() || '0',
          },
        });

        // Update subscription with Stripe ID
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            stripeSubscriptionId: stripeSubscription.id,
          },
        });
      } catch (error) {
        console.error('Error creating Stripe subscription:', error);
        // Continue with database subscription even if Stripe fails
      }
    }

    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string) {
    return await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: true,
        business: true,
        usageRecords: true,
        invoices: true,
      },
    });
  }

  /**
   * Get user's active subscription
   */
  async getUserSubscription(userId: string) {
    return await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
      },
      include: {
        business: true,
        usageRecords: true,
        invoices: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update subscription
   */
  async updateSubscription(params: UpdateSubscriptionParams) {
    const { subscriptionId, tier, status, cancelAtPeriodEnd } = params;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const updateData: Record<string, unknown> = {};
    if (tier) updateData.tier = tier;
    if (status) updateData.status = status;
    if (cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = cancelAtPeriodEnd;

    // Update in database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
      include: {
        user: true,
        business: true,
      },
    });

    // Update Stripe subscription if it exists
    if (subscription.stripeSubscriptionId && stripe) {
      try {
        if (tier && tier !== 'free') {
          // Update to new tier
          const stripePriceId = await this.getStripePriceId(tier, 'monthly');
          if (!stripePriceId) {
            throw new Error(`No Stripe price ID found for tier: ${tier}`);
          }

          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            items: [
              {
                id: (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
                price: stripePriceId,
              },
            ],
          });
        } else if (tier === 'free') {
          // Cancel Stripe subscription for free tier
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        }
      } catch (error) {
        console.error('Error updating Stripe subscription:', error);
      }
    }

    return updatedSubscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Update database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'cancelled',
        cancelAtPeriodEnd: true,
      },
      include: {
        user: true,
        business: true,
      },
    });

    // Cancel Stripe subscription if it exists
    if (subscription.stripeSubscriptionId && stripe) {
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (error) {
        console.error('Error cancelling Stripe subscription:', error);
      }
    }

    return updatedSubscription;
  }

  /**
   * Update employee count for a subscription
   * This updates both the database and Stripe subscription
   */
  async updateEmployeeCount(subscriptionId: string, employeeCount: number) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get current pricing configuration
    const { PricingService } = await import('./pricingService');
    const billingCycle = subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime() > 200 * 24 * 60 * 60 * 1000 ? 'yearly' : 'monthly';
    const pricingConfig = await PricingService.getPricing(subscription.tier, billingCycle);
    
    const includedEmployees = pricingConfig?.includedEmployees || 0;
    const perEmployeePrice = pricingConfig?.perEmployeePrice || null;
    
    // Calculate additional employees and cost
    const additionalEmployees = employeeCount > includedEmployees 
      ? Math.max(0, employeeCount - includedEmployees) 
      : 0;
    const additionalEmployeeCost = perEmployeePrice && additionalEmployees > 0
      ? perEmployeePrice * additionalEmployees
      : null;

    // Update database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        employeeCount,
        includedEmployees: includedEmployees || null,
        additionalEmployeeCost: additionalEmployeeCost || null,
      },
      include: {
        user: true,
        business: true,
      },
    });

    // Update Stripe subscription if it exists
    if (subscription.stripeSubscriptionId && stripe && pricingConfig) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        const basePriceItem = stripeSubscription.items.data.find(item => 
          item.price.id === pricingConfig.stripePriceId
        );
        const perEmployeeItem = stripeSubscription.items.data.find(item => 
          item.price.id === pricingConfig.perEmployeeStripePriceId
        );

        const itemsToUpdate: Array<{ id: string; price: string; quantity?: number }> = [];

        // Always include base price item
        if (basePriceItem) {
          itemsToUpdate.push({
            id: basePriceItem.id,
            price: basePriceItem.price.id,
          });
        }

        // Update or add per-employee item
        if (additionalEmployees > 0 && pricingConfig.perEmployeeStripePriceId) {
          if (perEmployeeItem) {
            // Update existing per-employee item
            itemsToUpdate.push({
              id: perEmployeeItem.id,
              price: perEmployeeItem.price.id,
              quantity: additionalEmployees,
            });
          } else {
            // Add new per-employee item
            itemsToUpdate.push({
              price: pricingConfig.perEmployeeStripePriceId,
              quantity: additionalEmployees,
            });
          }
        } else if (perEmployeeItem) {
          // Remove per-employee item if no additional employees
          await stripe.subscriptionItems.del(perEmployeeItem.id);
        }

        // Update Stripe subscription
        if (itemsToUpdate.length > 0) {
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            items: itemsToUpdate,
            proration_behavior: 'always_invoice', // Prorate charges for employee changes
            metadata: {
              ...stripeSubscription.metadata,
              employeeCount: employeeCount.toString(),
              includedEmployees: includedEmployees?.toString() || '0',
            },
          });
        }
      } catch (error) {
        console.error('Error updating Stripe subscription employee count:', error);
        // Continue even if Stripe update fails - database is already updated
      }
    }

    return updatedSubscription;
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Update database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      include: {
        user: true,
        business: true,
      },
    });

    // Reactivate Stripe subscription if it exists
    if (subscription.stripeSubscriptionId && stripe) {
      try {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });
      } catch (error) {
        console.error('Error reactivating Stripe subscription:', error);
      }
    }

    return updatedSubscription;
  }

  /**
   * Get subscription usage
   */
  async getSubscriptionUsage(subscriptionId: string) {
    const usageRecords = await prisma.usageRecord.findMany({
      where: { subscriptionId },
      orderBy: { periodStart: 'desc' },
    });

    return usageRecords;
  }

  /**
   * Record usage for subscription
   */
  async recordUsage(subscriptionId: string, metric: string, quantity: number, cost: number) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return await prisma.usageRecord.create({
      data: {
        subscriptionId,
        metric,
        quantity,
        cost,
        periodStart,
        periodEnd,
        userId: '', // Will be set by the calling service
        businessId: '', // Will be set by the calling service
      },
    });
  }

  /**
   * Get Stripe price ID for tier
   * Now uses PricingService to get stripePriceId from database
   */
  private async getStripePriceId(tier: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<string | null> {
    try {
      const { PricingService } = await import('./pricingService');
      const pricing = await PricingService.getPricing(tier, billingCycle);
      
      if (pricing?.stripePriceId) {
        return pricing.stripePriceId;
      }
    } catch (error) {
      console.warn('Failed to get Stripe price ID from database, using fallback:', error);
    }

    // Fallback to environment variables (for backward compatibility)
    const priceIds: Record<string, string> = {
      pro: process.env.STRIPE_PRO_PRICE_ID || '',
      business_basic: process.env.STRIPE_BUSINESS_BASIC_PRICE_ID || '',
      business_advanced: process.env.STRIPE_BUSINESS_ADVANCED_PRICE_ID || '',
      enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
      standard: process.env.STRIPE_STANDARD_PRICE_ID || '', // Legacy
    };

    const priceId = priceIds[tier];
    if (!priceId) {
      throw new Error(`No Stripe price ID configured for tier: ${tier}`);
    }

    return priceId;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const subscriptionId = (invoice as any).subscription as string;
    if (subscriptionId) {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: 'active' },
      });
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = (invoice as any).subscription as string;
    if (subscriptionId) {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: 'past_due' },
      });
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'cancelled' },
    });
  }
} 