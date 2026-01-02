import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { UsageTrackingService } from './usageTrackingService';
import { StripeService } from './stripeService';
import { AI_QUERY_OVERAGE_CONFIG } from '../config/aiQueryPacks';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil' as any, // TypeScript types may lag behind Stripe API versions
    })
  : null;

/**
 * Service for handling overage billing
 * Creates Stripe invoice items for usage that exceeds subscription limits
 */
export class OverageBillingService {
  /**
   * Process overage billing for a user's current period
   * Creates Stripe invoice items for any overage charges
   */
  static async processOverageBilling(
    userId: string,
    businessId?: string
  ): Promise<{
    success: boolean;
    invoiceItemsCreated: number;
    totalOverage: number;
    error?: string;
  }> {
    try {
      // Get user's subscription
      const subscription = await prisma.subscription.findFirst({
        where: businessId
          ? { businessId, status: 'active' }
          : { userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) {
        return {
          success: false,
          invoiceItemsCreated: 0,
          totalOverage: 0,
          error: 'No active subscription found',
        };
      }

      if (!subscription.stripeCustomerId) {
        return {
          success: false,
          invoiceItemsCreated: 0,
          totalOverage: 0,
          error: 'Subscription has no Stripe customer ID',
        };
      }

      // Get all usage information
      const allUsage = await UsageTrackingService.getAllUsage(userId, businessId);

      // Get AI query overage from balance
      const aiBalance = businessId
        ? await prisma.aIQueryBalance.findUnique({
            where: { 
              userId_businessId: { 
                userId, 
                businessId 
              } 
            },
          })
        : await prisma.aIQueryBalance.findFirst({
            where: { 
              userId,
              businessId: null
            },
          });

      // Calculate total overage (including AI queries)
      const totalOverage = await UsageTrackingService.calculateOverageCost(userId, businessId);
      const aiOverageCost = aiBalance?.overageQueriesCost || 0;
      const totalOverageWithAI = totalOverage + aiOverageCost;

      if (totalOverageWithAI <= 0) {
        // No overage, nothing to bill
        return {
          success: true,
          invoiceItemsCreated: 0,
          totalOverage: 0,
        };
      }

      if (!stripe) {
        await logger.error('Stripe not configured', {
          operation: 'overage_billing_process',
          userId,
          businessId,
        });
        return {
          success: false,
          invoiceItemsCreated: 0,
          totalOverage,
          error: 'Stripe not configured',
        };
      }

      // Group overage by metric for invoice items
      const overageItems: Array<{
        metric: string;
        quantity: number;
        amount: number;
        description: string;
      }> = [];

      for (const usage of allUsage) {
        if (usage.overage && usage.overageCost && usage.overageCost > 0) {
          overageItems.push({
            metric: usage.metric,
            quantity: usage.overage,
            amount: usage.overageCost,
            description: `Overage: ${usage.metric.replace(/_/g, ' ')} (${usage.overage} units)`,
          });
        }
      }

      // Add AI query overage if present
      if (aiBalance && aiBalance.overageQueriesUsed > 0 && aiBalance.overageQueriesCost > 0) {
        overageItems.push({
          metric: 'ai_queries_overage',
          quantity: aiBalance.overageQueriesUsed,
          amount: aiBalance.overageQueriesCost,
          description: `AI Query Overage: ${aiBalance.overageQueriesUsed} queries @ $${AI_QUERY_OVERAGE_CONFIG.pricePerQuery.toFixed(2)} each`,
        });
      }

      // Create invoice items in Stripe
      let invoiceItemsCreated = 0;
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      for (const item of overageItems) {
        try {
          await stripe.invoiceItems.create({
            customer: subscription.stripeCustomerId,
            amount: Math.round(item.amount * 100), // Convert to cents
            currency: 'usd',
            description: item.description,
            metadata: {
              userId,
              businessId: businessId || '',
              metric: item.metric,
              quantity: item.quantity.toString(),
              periodEnd: periodEnd.toISOString(),
              type: 'usage_overage',
            },
          });

          invoiceItemsCreated++;

          await logger.info('Overage invoice item created', {
            operation: 'overage_billing_create_item',
            userId,
            businessId,
            metric: item.metric,
            amount: item.amount,
            quantity: item.quantity,
          });
        } catch (error) {
          await logger.error('Failed to create overage invoice item', {
            operation: 'overage_billing_create_item',
            userId,
            businessId,
            metric: item.metric,
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
            },
          });
        }
      }

      // Create a usage record for overage tracking
      if (invoiceItemsCreated > 0) {
        try {
          const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          await prisma.usageRecord.create({
            data: {
              userId,
              subscriptionId: subscription.id,
              metric: 'overage_charges',
              quantity: 1,
              cost: totalOverage,
              periodStart,
              periodEnd,
              businessId: businessId || null,
            },
          });
        } catch (error) {
          // Log but don't fail - this is just for tracking
          console.error('Failed to create overage usage record:', error);
        }
      }

      return {
        success: true,
        invoiceItemsCreated,
        totalOverage: totalOverageWithAI,
      };
    } catch (error) {
      await logger.error('Failed to process overage billing', {
        operation: 'overage_billing_process',
        userId,
        businessId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      return {
        success: false,
        invoiceItemsCreated: 0,
        totalOverage: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process overage billing for all active subscriptions
   * Typically called by a cron job at the end of each billing period
   */
  static async processAllOverageBilling(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    totalOverage: number;
  }> {
    try {
      const activeSubscriptions = await prisma.subscription.findMany({
        where: { status: 'active' },
        include: {
          user: true,
          business: true,
        },
      });

      let processed = 0;
      let successful = 0;
      let failed = 0;
      let totalOverage = 0;

      for (const subscription of activeSubscriptions) {
        processed++;

        const result = await this.processOverageBilling(
          subscription.userId,
          subscription.businessId || undefined
        );

        if (result.success) {
          successful++;
          totalOverage += result.totalOverage;
        } else {
          failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await logger.info('Processed overage billing for all subscriptions', {
        operation: 'overage_billing_process_all',
        processed,
        successful,
        failed,
        totalOverage,
      });

      return {
        processed,
        successful,
        failed,
        totalOverage,
      };
    } catch (error) {
      await logger.error('Failed to process all overage billing', {
        operation: 'overage_billing_process_all',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      return {
        processed: 0,
        successful: 0,
        failed: 0,
        totalOverage: 0,
      };
    }
  }
}

