/**
 * AI Query Service
 * 
 * Manages AI query balances, consumption, and query pack purchases.
 * Implements Cursor-style query pack system with base allowances and purchasable packs.
 */

import { prisma } from '../lib/prisma';
import Stripe from 'stripe';
import { AI_QUERY_PACKS, AI_BASE_ALLOWANCES, getBaseAllowance, isUnlimitedTier, type QueryPackType, AI_QUERY_OVERAGE_CONFIG } from '../config/aiQueryPacks';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil' as any, // TypeScript types may lag behind Stripe API versions
}) : null;

export interface QueryAvailability {
  available: boolean;
  remaining: number;
  totalAvailable: number;
  breakdown: {
    baseAllowance: number;
    purchased: number;
    rolledOver: number;
  };
  isUnlimited: boolean;
}

export interface ConsumeQueryResult {
  success: boolean;
  remaining: number;
  error?: string;
}

export class AIQueryService {
  /**
   * Check if user has available AI queries
   */
  static async checkQueryAvailability(
    userId: string,
    businessId?: string | null
  ): Promise<QueryAvailability> {
    try {
      // Get or create balance
      // Handle null businessId case - use findFirst when businessId is null
      // because Prisma's compound unique constraint doesn't work well with null values
      let balance = businessId
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

      if (!balance) {
        // Initialize balance based on subscription tier
        balance = await this.initializeBalance(userId, businessId || undefined);
      }

      // Check if user has unlimited queries (Enterprise tier)
      const subscription = await prisma.subscription.findFirst({
        where: businessId
          ? { businessId, status: 'active' }
          : { userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });

      const tier = subscription?.tier || 'free';
      const unlimited = isUnlimitedTier(tier);

      if (unlimited) {
        return {
          available: true,
          remaining: -1, // -1 means unlimited
          totalAvailable: -1,
          breakdown: {
            baseAllowance: -1,
            purchased: 0,
            rolledOver: 0,
          },
          isUnlimited: true,
        };
      }

      // Calculate total available
      const baseRemaining = Math.max(0, balance.baseAllowance - balance.baseAllowanceUsed);
      const purchasedRemaining = balance.purchasedQueries - balance.purchasedQueriesUsed;
      const totalRemaining = baseRemaining + purchasedRemaining + balance.queriesRolledOver;

      return {
        available: totalRemaining > 0,
        remaining: totalRemaining,
        totalAvailable: balance.baseAllowance + balance.purchasedQueries + balance.queriesRolledOver,
        breakdown: {
          baseAllowance: baseRemaining,
          purchased: purchasedRemaining,
          rolledOver: balance.queriesRolledOver,
        },
        isUnlimited: false,
      };
    } catch (error) {
      // Log detailed error for debugging
      const err = error as Error;
      console.error('Error in checkQueryAvailability:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        userId,
        businessId: businessId ?? null,
      });
      // Re-throw to let controller handle it with proper error response
      throw error;
    }
  }

  /**
   * Consume AI query (with priority: rollover → base → purchased)
   */
  static async consumeQuery(
    userId: string,
    businessId?: string | null,
    amount: number = 1
  ): Promise<ConsumeQueryResult> {
    // Check availability first
    const availability = await this.checkQueryAvailability(userId, businessId);

    if (availability.isUnlimited) {
      // Enterprise tier - no consumption needed
      return { success: true, remaining: -1 };
    }

    // Get balance for update
    // Handle null businessId case - use findFirst when businessId is null
    const balance = businessId
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

    if (!balance) {
      throw new Error('Balance not found');
    }

    // Check if we need to use overage (base + purchased exhausted)
    if (!availability.available || availability.remaining < amount) {
      // Base allowance and purchased queries exhausted - check spending limit
      if (balance.monthlySpendingLimit <= 0) {
        // No spending limit set - block access (current behavior)
        return { 
          success: false, 
          remaining: availability.remaining,
          error: 'Insufficient query balance. Set a spending limit to enable overage billing.' 
        };
      }

      // Calculate overage needed
      const overageQueries = amount - availability.remaining;
      const overageCost = overageQueries * AI_QUERY_OVERAGE_CONFIG.pricePerQuery;
      const remainingLimit = balance.monthlySpendingLimit - balance.currentPeriodSpending;

      // Check if overage fits within limit
      if (overageCost > remainingLimit) {
        return {
          success: false,
          remaining: availability.remaining,
          error: `Spending limit reached. Remaining limit: $${remainingLimit.toFixed(2)}. Need $${overageCost.toFixed(2)} for ${overageQueries} queries.`
        };
      }

      // Allow overage - use remaining base/purchased queries first, then charge overage
      let baseUsed = balance.baseAllowanceUsed;
      let purchasedUsed = balance.purchasedQueriesUsed;
      let rolledOver = balance.queriesRolledOver;
      let remaining = amount;

      // Use any remaining base/purchased queries first
      if (availability.remaining > 0) {
        // 1. Use rolled over queries first
        if (rolledOver > 0 && remaining > 0) {
          const useRolledOver = Math.min(rolledOver, remaining);
          rolledOver -= useRolledOver;
          remaining -= useRolledOver;
        }

        // 2. Use base allowance
        if (remaining > 0 && baseUsed < balance.baseAllowance) {
          const useBase = Math.min(balance.baseAllowance - baseUsed, remaining);
          baseUsed += useBase;
          remaining -= useBase;
        }

        // 3. Use purchased queries
        if (remaining > 0) {
          purchasedUsed += remaining;
          remaining = 0;
        }
      }

      // Remaining amount is overage
      const overageAmount = remaining > 0 ? remaining : overageQueries;

      // Update balance with overage
      await prisma.aIQueryBalance.update({
        where: { id: balance.id },
        data: {
          baseAllowanceUsed: baseUsed,
          purchasedQueriesUsed: purchasedUsed,
          queriesRolledOver: rolledOver,
          overageQueriesUsed: { increment: overageAmount },
          overageQueriesCost: { increment: overageCost },
          currentPeriodSpending: { increment: overageCost },
          updatedAt: new Date(),
        },
      });

      // Return success with negative remaining to indicate overage usage
      return { 
        success: true, 
        remaining: -1 // Negative means using overage
      };
    }

    // Calculate consumption with priority: rollover → base → purchased
    let baseUsed = balance.baseAllowanceUsed;
    let purchasedUsed = balance.purchasedQueriesUsed;
    let rolledOver = balance.queriesRolledOver;
    let remaining = amount;

    // 1. Use rolled over queries first
    if (rolledOver > 0 && remaining > 0) {
      const useRolledOver = Math.min(rolledOver, remaining);
      rolledOver -= useRolledOver;
      remaining -= useRolledOver;
    }

    // 2. Use base allowance
    if (remaining > 0 && baseUsed < balance.baseAllowance) {
      const useBase = Math.min(balance.baseAllowance - baseUsed, remaining);
      baseUsed += useBase;
      remaining -= useBase;
    }

    // 3. Use purchased queries
    if (remaining > 0) {
      purchasedUsed += remaining;
      remaining = 0;
    }

    // Update balance
    await prisma.aIQueryBalance.update({
      where: { id: balance.id },
      data: {
        baseAllowanceUsed: baseUsed,
        purchasedQueriesUsed: purchasedUsed,
        queriesRolledOver: rolledOver,
        updatedAt: new Date(),
      },
    });

    // Get updated availability
    const newAvailability = await this.checkQueryAvailability(userId, businessId);

    return { 
      success: true, 
      remaining: newAvailability.remaining 
    };
  }

  /**
   * Purchase query pack
   */
  static async purchaseQueryPack(
    userId: string,
    packType: QueryPackType,
    businessId?: string | null
  ): Promise<{ paymentIntentId: string; queries: number; price: number; clientSecret: string }> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const pack = AI_QUERY_PACKS[packType];
    if (!pack) {
      throw new Error('Invalid pack type');
    }

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let customerId = (user as any).stripeCustomerId;
    if (!customerId) {
      const { StripeService } = await import('./stripeService');
      const customer = await StripeService.createCustomer({
        email: user.email || '',
        name: user.name || undefined,
        metadata: { userId },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id } as any,
      });
      customerId = customer.id;
    }

    // Create payment intent
    // Note: Payment Intents use amount directly (not price_id)
    // We create Stripe Products/Prices for management, but Payment Intents work with amounts
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pack.price * 100), // Convert to cents
      currency: 'usd',
      customer: customerId,
      metadata: {
        userId,
        businessId: businessId || '',
        packType,
        queries: pack.queries.toString(),
        type: 'ai_query_pack',
        // Include Stripe Price ID in metadata for reference (if configured)
        ...(pack.stripePriceId && { stripePriceId: pack.stripePriceId }),
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Failed to create payment intent');
    }

    // Create purchase record
    await prisma.aIQueryPurchase.create({
      data: {
        userId,
        businessId: businessId || null,
        packType,
        queriesAmount: pack.queries,
        amountPaid: pack.price,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
      },
    });

    return {
      paymentIntentId: paymentIntent.id,
      queries: pack.queries,
      price: pack.price,
      clientSecret: paymentIntent.client_secret,
    };
  }

  /**
   * Handle successful query pack purchase (webhook handler)
   */
  static async completeQueryPackPurchase(paymentIntentId: string): Promise<void> {
    const purchase = await prisma.aIQueryPurchase.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    if (purchase.status !== 'pending') {
      // Already processed
      return;
    }

    // Get or create balance
    // Handle null businessId case - use findFirst when businessId is null
    let balance = purchase.businessId
      ? await prisma.aIQueryBalance.findUnique({
          where: {
            userId_businessId: {
              userId: purchase.userId,
              businessId: purchase.businessId,
            },
          },
        })
      : await prisma.aIQueryBalance.findFirst({
          where: {
            userId: purchase.userId,
            businessId: null,
          },
        });

    if (!balance) {
      balance = await this.initializeBalance(purchase.userId, purchase.businessId || undefined);
    }

    // Add purchased queries (they never expire)
    await prisma.aIQueryBalance.update({
      where: { id: balance.id },
      data: {
        purchasedQueries: {
          increment: purchase.queriesAmount,
        },
        updatedAt: new Date(),
      },
    });

    // Mark purchase as completed
    await prisma.aIQueryPurchase.update({
      where: { id: purchase.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        balanceId: balance.id,
      },
    });
  }

  /**
   * Handle failed query pack purchase
   */
  static async failQueryPackPurchase(paymentIntentId: string): Promise<void> {
    const purchase = await prisma.aIQueryPurchase.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!purchase || purchase.status !== 'pending') {
      return;
    }

    await prisma.aIQueryPurchase.update({
      where: { id: purchase.id },
      data: {
        status: 'failed',
      },
    });
  }

  /**
   * Initialize balance based on subscription tier
   */
  private static async initializeBalance(
    userId: string,
    businessId?: string
  ) {
    // Get user's subscription
    const subscription = await prisma.subscription.findFirst({
      where: businessId
        ? { businessId, status: 'active' }
        : { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    const tier = subscription?.tier || 'free';
    const baseAllowance = getBaseAllowance(tier);

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return await prisma.aIQueryBalance.create({
      data: {
        userId,
        businessId: businessId || null,
        baseAllowance: baseAllowance === -1 ? 0 : baseAllowance, // Store 0 for unlimited, handle in logic
        baseAllowanceUsed: 0,
        purchasedQueries: 0,
        purchasedQueriesUsed: 0,
        queriesRolledOver: 0,
        monthlySpendingLimit: AI_QUERY_OVERAGE_CONFIG.defaultLimit,
        currentPeriodSpending: 0,
        overageQueriesUsed: 0,
        overageQueriesCost: 0,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  /**
   * Reset monthly base allowance (called at start of each month)
   * Rolls over unused base allowance
   */
  static async resetMonthlyAllowance(): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all balances that need reset (period has ended)
    const balances = await prisma.aIQueryBalance.findMany({
      where: {
        currentPeriodStart: { lt: periodStart },
      },
    });

    for (const balance of balances) {
      // Calculate rollover (unused base allowance)
      const unusedBase = Math.max(0, balance.baseAllowance - balance.baseAllowanceUsed);
      
      // Get subscription for new base allowance
      const subscription = await prisma.subscription.findFirst({
        where: balance.businessId
          ? { businessId: balance.businessId, status: 'active' }
          : { userId: balance.userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });

      const tier = subscription?.tier || 'free';
      const newBaseAllowance = getBaseAllowance(tier);

      await prisma.aIQueryBalance.update({
        where: { id: balance.id },
        data: {
          baseAllowance: newBaseAllowance === -1 ? 0 : newBaseAllowance,
          baseAllowanceUsed: 0,
          queriesRolledOver: unusedBase, // Roll over unused base allowance
          // Reset spending for new period (keep limit, reset spending)
          currentPeriodSpending: 0,
          overageQueriesUsed: 0,
          overageQueriesCost: 0,
          currentPeriodStart: periodStart,
          currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Get purchase history for a user
   */
  static async getPurchaseHistory(
    userId: string,
    businessId?: string | null,
    limit: number = 50
  ) {
    return await prisma.aIQueryPurchase.findMany({
      where: {
        userId,
        businessId: businessId || null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Set monthly spending limit for AI query overage (Cursor-style)
   */
  static async setSpendingLimit(
    userId: string,
    limit: number,
    businessId?: string | null
  ): Promise<void> {
    if (limit < 0) {
      throw new Error('Spending limit must be >= 0');
    }

    // Get or create balance
    let balance = businessId
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

    if (!balance) {
      balance = await this.initializeBalance(userId, businessId || undefined);
    }

    // If decreasing limit and current spending exceeds new limit, block further usage
    // (but don't prevent the limit change - user can increase it later)
    await prisma.aIQueryBalance.update({
      where: { id: balance.id },
      data: {
        monthlySpendingLimit: limit,
      },
    });
  }

  /**
   * Get current spending status
   */
  static async getSpendingStatus(
    userId: string,
    businessId?: string | null
  ): Promise<{
    limit: number;
    currentSpending: number;
    remaining: number;
    overageQueries: number;
    overageCost: number;
  }> {
    let balance = businessId
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

    if (!balance) {
      balance = await this.initializeBalance(userId, businessId || undefined);
    }

    return {
      limit: balance.monthlySpendingLimit,
      currentSpending: balance.currentPeriodSpending,
      remaining: Math.max(0, balance.monthlySpendingLimit - balance.currentPeriodSpending),
      overageQueries: balance.overageQueriesUsed,
      overageCost: balance.overageQueriesCost,
    };
  }
}

