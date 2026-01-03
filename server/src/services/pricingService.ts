import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export interface PricingConfig {
  id: string;
  tier: string;
  billingCycle: 'monthly' | 'yearly';
  basePrice: number;
  perEmployeePrice?: number | null;
  includedEmployees?: number | null;
  queryPackSmall?: number | null;
  queryPackMedium?: number | null;
  queryPackLarge?: number | null;
  queryPackEnterprise?: number | null;
  baseAIAllowance?: number | null;
  stripePriceId?: string | null;
  isActive: boolean;
  effectiveDate: Date;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingInfo {
  monthly: number;
  yearly: number;
  perEmployee?: number;
  includedEmployees?: number;
  queryPackSmall?: number;
  queryPackMedium?: number;
  queryPackLarge?: number;
  queryPackEnterprise?: number;
  baseAIAllowance?: number;
}

// In-memory cache for pricing (refreshed every 5 minutes)
let pricingCache: Map<string, PricingConfig> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Pricing Service - Centralized pricing management
 * Reads from database instead of hardcoded config
 */
export class PricingService {
  /**
   * Get active pricing for a tier and billing cycle
   */
  static async getPricing(
    tier: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<PricingConfig | null> {
    try {
      // Check cache first
      const cacheKey = `${tier}_${billingCycle}`;
      const cached = this.getCachedPricing(cacheKey);
      if (cached) {
        return cached;
      }

      // Get from database
      const now = new Date();
      const pricing = await prisma.pricingConfig.findFirst({
        where: {
          tier,
          billingCycle,
          isActive: true,
          effectiveDate: { lte: now },
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
        orderBy: {
          effectiveDate: 'desc',
        },
      });

      if (pricing) {
        // Update cache
        this.updateCache(cacheKey, pricing);
        return pricing as PricingConfig;
      }

      return null;
    } catch (error) {
      await logger.error('Failed to get pricing', {
        operation: 'pricing_get',
        tier,
        billingCycle,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      return null;
    }
  }

  /**
   * Get all active pricing configurations
   */
  static async getAllActivePricing(): Promise<PricingConfig[]> {
    try {
      const now = new Date();
      const pricing = await prisma.pricingConfig.findMany({
        where: {
          isActive: true,
          effectiveDate: { lte: now },
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
        orderBy: [
          { tier: 'asc' },
          { billingCycle: 'asc' },
          { effectiveDate: 'desc' },
        ],
      });

      return pricing as PricingConfig[];
    } catch (error) {
      await logger.error('Failed to get all pricing', {
        operation: 'pricing_get_all',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      return [];
    }
  }

  /**
   * Get pricing info in the format expected by existing code
   * (compatible with old PRICING_CONFIG structure)
   */
  static async getPricingInfo(tier: string): Promise<PricingInfo | null> {
    const monthly = await this.getPricing(tier, 'monthly');
    const yearly = await this.getPricing(tier, 'yearly');

    if (!monthly) {
      return null;
    }

    return {
      monthly: monthly.basePrice,
      yearly: yearly?.basePrice || monthly.basePrice * 12,
      perEmployee: monthly.perEmployeePrice || undefined,
      includedEmployees: monthly.includedEmployees || undefined,
      queryPackSmall: monthly.queryPackSmall || undefined,
      queryPackMedium: monthly.queryPackMedium || undefined,
      queryPackLarge: monthly.queryPackLarge || undefined,
      queryPackEnterprise: monthly.queryPackEnterprise || undefined,
      baseAIAllowance: monthly.baseAIAllowance || undefined,
    };
  }

  /**
   * Create or update pricing configuration
   */
  static async upsertPricing(
    tier: string,
    billingCycle: 'monthly' | 'yearly',
    data: {
      basePrice: number;
      perEmployeePrice?: number;
      includedEmployees?: number;
      queryPackSmall?: number;
      queryPackMedium?: number;
      queryPackLarge?: number;
      queryPackEnterprise?: number;
      baseAIAllowance?: number;
      stripePriceId?: string;
      perEmployeeStripePriceId?: string | null;
      effectiveDate?: Date;
      createdBy: string;
    }
  ): Promise<PricingConfig> {
    try {
      const effectiveDate = data.effectiveDate || new Date();

      // Deactivate old pricing for this tier/cycle
      await prisma.pricingConfig.updateMany({
        where: {
          tier,
          billingCycle,
          isActive: true,
        },
        data: {
          isActive: false,
          endDate: effectiveDate,
        },
      });

      // Create new pricing config
      const pricing = await prisma.pricingConfig.create({
        data: {
          tier,
          billingCycle,
          basePrice: data.basePrice,
          perEmployeePrice: data.perEmployeePrice,
          includedEmployees: data.includedEmployees,
          queryPackSmall: data.queryPackSmall,
          queryPackMedium: data.queryPackMedium,
          queryPackLarge: data.queryPackLarge,
          queryPackEnterprise: data.queryPackEnterprise,
          baseAIAllowance: data.baseAIAllowance,
          stripePriceId: data.stripePriceId,
          perEmployeeStripePriceId: data.perEmployeeStripePriceId,
          effectiveDate,
          isActive: true,
          createdBy: data.createdBy,
        },
      });

      // Clear cache
      this.clearCache();

      await logger.info('Pricing configuration created/updated', {
        operation: 'pricing_upsert',
        tier,
        billingCycle,
        pricingId: pricing.id,
      });

      return pricing as PricingConfig;
    } catch (error) {
      await logger.error('Failed to upsert pricing', {
        operation: 'pricing_upsert',
        tier,
        billingCycle,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      throw error;
    }
  }

  /**
   * Record a price change for audit trail
   */
  static async recordPriceChange(
    pricingConfigId: string,
    changeType: string,
    oldValue: number,
    newValue: number,
    reason: string | null,
    createdBy: string
  ): Promise<void> {
    try {
      await prisma.priceChange.create({
        data: {
          pricingConfigId,
          changeType,
          oldValue,
          newValue,
          reason,
          createdBy,
        },
      });

      await logger.info('Price change recorded', {
        operation: 'pricing_record_change',
        pricingConfigId,
        changeType,
        oldValue,
        newValue,
      });
    } catch (error) {
      await logger.error('Failed to record price change', {
        operation: 'pricing_record_change',
        pricingConfigId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
  }

  /**
   * Get price change history for a pricing config
   */
  static async getPriceHistory(pricingConfigId: string) {
    return await prisma.priceChange.findMany({
      where: { pricingConfigId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get cached pricing (if available and not expired)
   */
  private static getCachedPricing(key: string): PricingConfig | null {
    if (!pricingCache || Date.now() - cacheTimestamp > CACHE_TTL) {
      return null;
    }
    return pricingCache.get(key) || null;
  }

  /**
   * Update pricing cache
   */
  private static updateCache(key: string, pricing: PricingConfig): void {
    if (!pricingCache) {
      pricingCache = new Map();
    }
    pricingCache.set(key, pricing);
    cacheTimestamp = Date.now();
  }

  /**
   * Clear pricing cache
   */
  static clearCache(): void {
    pricingCache = null;
    cacheTimestamp = 0;
  }

  /**
   * Calculate impact of a price change
   * Returns number of affected subscriptions and estimated revenue impact
   */
  static async calculatePriceChangeImpact(
    tier: string,
    newBasePrice: number,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<{
    affectedSubscriptions: number;
    currentRevenue: number;
    newRevenue: number;
    revenueChange: number;
    revenueChangePercent: number;
  }> {
    try {
      // Get current pricing
      const currentPricing = await this.getPricing(tier, billingCycle);
      if (!currentPricing) {
        return {
          affectedSubscriptions: 0,
          currentRevenue: 0,
          newRevenue: 0,
          revenueChange: 0,
          revenueChangePercent: 0,
        };
      }

      // Count active subscriptions for this tier
      const now = new Date();
      const activeSubscriptions = await prisma.subscription.count({
        where: {
          tier,
          status: 'active',
          currentPeriodEnd: { gte: now },
        },
      });

      // Calculate revenue impact
      const currentRevenue = activeSubscriptions * currentPricing.basePrice;
      const newRevenue = activeSubscriptions * newBasePrice;
      const revenueChange = newRevenue - currentRevenue;
      const revenueChangePercent = currentRevenue > 0 
        ? (revenueChange / currentRevenue) * 100 
        : 0;

      return {
        affectedSubscriptions: activeSubscriptions,
        currentRevenue,
        newRevenue,
        revenueChange,
        revenueChangePercent,
      };
    } catch (error) {
      await logger.error('Failed to calculate price change impact', {
        operation: 'pricing_calculate_impact',
        tier,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      return {
        affectedSubscriptions: 0,
        currentRevenue: 0,
        newRevenue: 0,
        revenueChange: 0,
        revenueChangePercent: 0,
      };
    }
  }
}

