import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { RevenueSplitService } from './revenueSplitService';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil' as any, // TypeScript types may lag behind Stripe API versions
}) : null;

export interface CreateModuleSubscriptionParams {
  userId: string;
  businessId?: string;
  moduleId: string;
  tier: 'premium' | 'enterprise';
  stripeCustomerId?: string;
}

export interface UpdateModuleSubscriptionParams {
  subscriptionId: string;
  tier?: 'premium' | 'enterprise';
  status?: 'active' | 'cancelled' | 'past_due';
}

export class ModuleSubscriptionService {
  /**
   * Create a new module subscription
   */
  async createModuleSubscription(params: CreateModuleSubscriptionParams) {
    const { userId, businessId, moduleId, tier, stripeCustomerId } = params;

    // Get module details
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { developer: true },
    });

    if (!module) {
      throw new Error('Module not found');
    }

    // Set subscription period (monthly)
    const now = new Date();
    const currentPeriodStart = now;
    const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Calculate pricing
    const amount = tier === 'enterprise' ? module.enterprisePrice : module.basePrice;
    
    // Calculate revenue split using Apple-style model
    const revenueSplit = await RevenueSplitService.calculateDeveloperShare(
      moduleId,
      amount,
      0 // New subscription, 0 months old
    );
    
    const platformRevenue = revenueSplit.platformShare;
    const developerRevenue = revenueSplit.developerShare;

    // Create subscription in database
    const subscription = await prisma.moduleSubscription.create({
      data: {
        userId,
        businessId,
        moduleId,
        tier,
        status: 'active',
        currentPeriodStart,
        currentPeriodEnd,
        stripeCustomerId,
        amount,
        platformRevenue,
        developerRevenue,
      },
      include: {
        user: true,
        business: true,
        module: {
          include: { developer: true },
        },
      },
    });

    // If this is a paid module, create Stripe subscription
    if (amount > 0 && stripeCustomerId && stripe) {
      try {
        const stripeSubscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [
            {
              price: this.getModuleStripePriceId(moduleId, tier),
            },
          ],
          metadata: {
            subscriptionId: subscription.id,
            userId,
            businessId: businessId || '',
            moduleId,
            isProprietary: module.isProprietary.toString(),
            developerId: module.developerId,
          },
        });

        // Update subscription with Stripe ID
        await prisma.moduleSubscription.update({
          where: { id: subscription.id },
          data: {
            stripeSubscriptionId: stripeSubscription.id,
          },
        });
      } catch (error) {
        console.error('Error creating Stripe module subscription:', error);
        // Continue with database subscription even if Stripe fails
      }
    }

    return subscription;
  }

  /**
   * Get module subscription by ID
   */
  async getModuleSubscription(subscriptionId: string) {
    return await prisma.moduleSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: true,
        business: true,
        module: {
          include: { developer: true },
        },
        usageRecords: true,
        invoices: true,
      },
    });
  }

  /**
   * Get user's active module subscriptions
   */
  async getUserModuleSubscriptions(userId: string) {
    return await prisma.moduleSubscription.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        module: {
          include: { developer: true },
        },
        usageRecords: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get business module subscriptions
   */
  async getBusinessModuleSubscriptions(businessId: string) {
    return await prisma.moduleSubscription.findMany({
      where: {
        businessId,
        status: 'active',
      },
      include: {
        user: true,
        module: {
          include: { developer: true },
        },
        usageRecords: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update module subscription
   */
  async updateModuleSubscription(params: UpdateModuleSubscriptionParams) {
    const { subscriptionId, tier, status } = params;

    const subscription = await prisma.moduleSubscription.findUnique({
      where: { id: subscriptionId },
      include: { module: true },
    });

    if (!subscription) {
      throw new Error('Module subscription not found');
    }

    const updateData: Record<string, unknown> = {};
    if (tier) updateData.tier = tier;
    if (status) updateData.status = status;

    // Recalculate pricing if tier changed
    if (tier && tier !== subscription.tier) {
      const amount = tier === 'enterprise' ? subscription.module.enterprisePrice : subscription.module.basePrice;
      
      // Calculate subscription age for revenue split
      const subscriptionAgeMonths = RevenueSplitService.calculateSubscriptionAgeMonths(
        subscription.currentPeriodStart
      );
      
      // Calculate revenue split using Apple-style model
      const revenueSplit = await RevenueSplitService.calculateDeveloperShare(
        subscription.moduleId,
        amount,
        subscriptionAgeMonths
      );
      
      updateData.amount = amount;
      updateData.platformRevenue = revenueSplit.platformShare;
      updateData.developerRevenue = revenueSplit.developerShare;
    }

    // Update in database
    const updatedSubscription = await prisma.moduleSubscription.update({
      where: { id: subscriptionId },
      data: updateData,
      include: {
        user: true,
        business: true,
        module: {
          include: { developer: true },
        },
      },
    });

    // Update Stripe subscription if it exists
    if (subscription.stripeSubscriptionId) {
      try {
        await stripe!.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [
            {
              id: (await stripe!.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
              price: this.getModuleStripePriceId(subscription.moduleId, tier || subscription.tier),
            },
          ],
        });
      } catch (error) {
        console.error('Error updating Stripe module subscription:', error);
      }
    }

    return updatedSubscription;
  }

  /**
   * Cancel module subscription
   */
  async cancelModuleSubscription(subscriptionId: string) {
    const subscription = await prisma.moduleSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Module subscription not found');
    }

    // Update database
    const updatedSubscription = await prisma.moduleSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'cancelled',
      },
      include: {
        user: true,
        business: true,
        module: {
          include: { developer: true },
        },
      },
    });

    // Cancel Stripe subscription if it exists
    if (subscription.stripeSubscriptionId) {
      try {
        await stripe!.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (error) {
        console.error('Error cancelling Stripe module subscription:', error);
      }
    }

    return updatedSubscription;
  }

  /**
   * Get module subscription usage
   */
  async getModuleSubscriptionUsage(subscriptionId: string) {
    const usageRecords = await prisma.usageRecord.findMany({
      where: { moduleSubscriptionId: subscriptionId },
      orderBy: { periodStart: 'desc' },
    });

    return usageRecords;
  }

  /**
   * Record usage for module subscription
   */
  async recordModuleUsage(subscriptionId: string, metric: string, quantity: number, cost: number) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return await prisma.usageRecord.create({
      data: {
        moduleSubscriptionId: subscriptionId,
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
   * Get developer revenue for a period
   */
  async getDeveloperRevenue(developerId: string, periodStart: Date, periodEnd: Date) {
    const revenue = await prisma.developerRevenue.findMany({
      where: {
        developerId,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
      include: {
        module: true,
      },
      orderBy: {
        periodStart: 'desc',
      },
    });

    return revenue;
  }

  /**
   * Calculate and record developer revenue
   */
  async calculateDeveloperRevenue(periodStart: Date, periodEnd: Date) {
    // Get all module subscriptions for the period
    const subscriptions = await prisma.moduleSubscription.findMany({
      where: {
        status: 'active',
        currentPeriodStart: { gte: periodStart },
        currentPeriodEnd: { lte: periodEnd },
        developerRevenue: { gt: 0 },
      },
      include: {
        module: {
          include: { developer: true },
        },
      },
    });

    // Create developer revenue records with proper revenue split calculation
    // Group by developer+module first, then calculate split based on average subscription age
    const revenueByDeveloperModule: Record<string, {
      developerId: string;
      moduleId: string;
      totalAmount: number;
      subscriptions: Array<{ amount: number; ageMonths: number }>;
    }> = {};
    
    for (const subscription of subscriptions) {
      const developerId = subscription.module.developerId;
      const moduleId = subscription.moduleId;
      const key = `${developerId}:${moduleId}`;
      
      // Calculate subscription age for revenue split
      const subscriptionAgeMonths = RevenueSplitService.calculateSubscriptionAgeMonths(
        subscription.currentPeriodStart
      );
      
      if (!revenueByDeveloperModule[key]) {
        revenueByDeveloperModule[key] = {
          developerId,
          moduleId,
          totalAmount: 0,
          subscriptions: [],
        };
      }
      
      revenueByDeveloperModule[key].totalAmount += subscription.amount;
      revenueByDeveloperModule[key].subscriptions.push({
        amount: subscription.amount,
        ageMonths: subscriptionAgeMonths,
      });
    }
    
    // Create database records with revenue split calculation
    const createdRecords = [];
    for (const [key, data] of Object.entries(revenueByDeveloperModule)) {
      // Calculate average subscription age (weighted by amount)
      const totalAmount = data.totalAmount;
      const weightedAge = data.subscriptions.reduce((sum, sub) => {
        return sum + (sub.ageMonths * (sub.amount / totalAmount));
      }, 0);
      const avgAgeMonths = Math.round(weightedAge);
      
      // Calculate revenue split using Apple-style model
      const revenueSplit = await RevenueSplitService.calculateDeveloperShare(
        data.moduleId,
        data.totalAmount,
        avgAgeMonths
      );
      
      const created = await prisma.developerRevenue.create({
        data: {
          developerId: data.developerId,
          moduleId: data.moduleId,
          periodStart,
          periodEnd,
          totalRevenue: data.totalAmount,
          platformRevenue: revenueSplit.platformShare,
          developerRevenue: revenueSplit.developerShare,
          commissionRate: revenueSplit.commissionRate,
          commissionType: revenueSplit.commissionType,
          subscriptionAgeMonths: avgAgeMonths,
          isFirstYear: avgAgeMonths <= 12,
          payoutStatus: 'pending',
        },
      });
      createdRecords.push(created);
    }

    return createdRecords;
  }

  /**
   * Get Stripe price ID for module and tier
   */
  private getModuleStripePriceId(moduleId: string, tier: string): string {
    // This would be configured per module in Stripe
    // For now, return a placeholder
    return `price_${moduleId}_${tier}`;
  }

  /**
   * Handle Stripe webhook events for module subscriptions
   */
  async handleStripeWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handleModulePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleModulePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.handleModuleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }
  }

  private async handleModulePaymentSucceeded(invoice: Stripe.Invoice) {
    const subscriptionId = (invoice as any).subscription as string;
    if (subscriptionId) {
      await prisma.moduleSubscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: 'active' },
      });
    }
  }

  private async handleModulePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = (invoice as any).subscription as string;
    if (subscriptionId) {
      await prisma.moduleSubscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: 'past_due' },
      });
    }
  }

  private async handleModuleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await prisma.moduleSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'cancelled' },
    });
  }
} 