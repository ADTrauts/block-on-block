import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { PricingService } from './pricingService';

export interface UsageLimit {
  metric: string;
  limit: number;
  currentUsage: number;
  remaining: number;
  percentageUsed: number;
  overage?: number;
  overageCost?: number;
}

export interface UsageAlert {
  metric: string;
  severity: 'info' | 'warning' | 'critical';
  percentageUsed: number;
  message: string;
  limit: number;
  currentUsage: number;
  remaining: number;
}

export interface TierUsageLimits {
  [metric: string]: number | null; // null means unlimited
}

// Usage limits by tier (included in subscription)
// Note: AI queries are handled separately via AIQueryService
const TIER_USAGE_LIMITS: Record<string, TierUsageLimits> = {
  free: {
    storage_gb: 5, // 5 GB storage
    api_calls: 1000, // 1,000 API calls/month
    messages: 1000, // 1,000 messages/month
    files: 100, // 100 files
    ai_requests: 50, // Already tracked separately via AIQueryService
  },
  pro: {
    storage_gb: 100, // 100 GB storage
    api_calls: 10000, // 10,000 API calls/month
    messages: null, // Unlimited
    files: null, // Unlimited
    ai_requests: null, // Handled by AIQueryService (base allowance + purchases)
  },
  business_basic: {
    storage_gb: 500, // 500 GB storage (team-wide)
    api_calls: 50000, // 50,000 API calls/month (team-wide)
    messages: null, // Unlimited
    files: null, // Unlimited
    ai_requests: null, // Handled by AIQueryService (team pool)
  },
  business_advanced: {
    storage_gb: 2000, // 2 TB storage (team-wide)
    api_calls: 200000, // 200,000 API calls/month (team-wide)
    messages: null, // Unlimited
    files: null, // Unlimited
    ai_requests: null, // Handled by AIQueryService (team pool)
  },
  enterprise: {
    storage_gb: null, // Unlimited
    api_calls: null, // Unlimited
    messages: null, // Unlimited
    files: null, // Unlimited
    ai_requests: null, // Unlimited (handled by AIQueryService)
  },
};

// Overage pricing (per unit over limit)
const OVERAGE_PRICING: Record<string, number> = {
  storage_gb: 0.10, // $0.10 per GB over limit
  api_calls: 0.01, // $0.01 per API call over limit
  messages: 0.001, // $0.001 per message over limit
  files: 0.10, // $0.10 per file over limit
};

export class UsageTrackingService {
  /**
   * Get usage limits for a tier
   */
  static getTierLimits(tier: string): TierUsageLimits {
    return TIER_USAGE_LIMITS[tier] || TIER_USAGE_LIMITS.free;
  }

  /**
   * Get usage information for a specific metric
   */
  static async getUsageInfo(
    userId: string,
    metric: string,
    businessId?: string
  ): Promise<UsageLimit | null> {
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get user's subscription to determine tier
      const subscription = await prisma.subscription.findFirst({
        where: businessId
          ? { businessId, status: 'active' }
          : { userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });

      const tier = subscription?.tier || 'free';
      const tierLimits = this.getTierLimits(tier);
      const limit = tierLimits[metric];

      // If limit is null, it's unlimited
      if (limit === null || limit === undefined) {
        // Get current usage for display purposes
        const usage = await prisma.usageRecord.aggregate({
          where: businessId
            ? { businessId, metric, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } }
            : { userId, metric, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
          _sum: { quantity: true },
        });

        const currentUsage = usage._sum.quantity || 0;

        return {
          metric,
          limit: -1, // -1 means unlimited
          currentUsage,
          remaining: -1, // -1 means unlimited
          percentageUsed: 0,
        };
      }

      // Get current usage
      const usage = await prisma.usageRecord.aggregate({
        where: businessId
          ? { businessId, metric, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } }
          : { userId, metric, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
        _sum: { quantity: true },
      });

      const currentUsage = usage._sum.quantity || 0;
      const remaining = Math.max(0, limit - currentUsage);
      const percentageUsed = limit > 0 ? (currentUsage / limit) * 100 : 0;
      const overage = Math.max(0, currentUsage - limit);
      const overageCost = overage > 0 && OVERAGE_PRICING[metric] ? overage * OVERAGE_PRICING[metric] : 0;

      return {
        metric,
        limit,
        currentUsage,
        remaining,
        percentageUsed,
        overage: overage > 0 ? overage : undefined,
        overageCost: overageCost > 0 ? overageCost : undefined,
      };
    } catch (error) {
      await logger.error('Failed to get usage info', {
        operation: 'usage_tracking_get_usage_info',
        userId,
        metric,
        businessId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      return null;
    }
  }

  /**
   * Get all usage information for a user
   */
  static async getAllUsage(userId: string, businessId?: string): Promise<UsageLimit[]> {
    try {
      // Get user's subscription to determine tier
      const subscription = await prisma.subscription.findFirst({
        where: businessId
          ? { businessId, status: 'active' }
          : { userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });

      const tier = subscription?.tier || 'free';
      const tierLimits = this.getTierLimits(tier);

      // Get all usage records for current period
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const usageRecords = await prisma.usageRecord.groupBy({
        by: ['metric'],
        where: businessId
          ? { businessId, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } }
          : { userId, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
        _sum: { quantity: true },
      });

      // Build usage info for all metrics with limits
      const usageInfo: UsageLimit[] = [];
      
      for (const [metric, limit] of Object.entries(tierLimits)) {
        // Skip ai_requests as it's handled by AIQueryService
        if (metric === 'ai_requests') continue;

        const record = usageRecords.find(r => r.metric === metric);
        const currentUsage = record?._sum.quantity || 0;

        if (limit === null) {
          // Unlimited
          usageInfo.push({
            metric,
            limit: -1,
            currentUsage,
            remaining: -1,
            percentageUsed: 0,
          });
        } else {
          const remaining = Math.max(0, limit - currentUsage);
          const percentageUsed = limit > 0 ? (currentUsage / limit) * 100 : 0;
          const overage = Math.max(0, currentUsage - limit);
          const overageCost = overage > 0 && OVERAGE_PRICING[metric] ? overage * OVERAGE_PRICING[metric] : 0;

          usageInfo.push({
            metric,
            limit,
            currentUsage,
            remaining,
            percentageUsed,
            overage: overage > 0 ? overage : undefined,
            overageCost: overageCost > 0 ? overageCost : undefined,
          });
        }
      }

      return usageInfo;
    } catch (error) {
      await logger.error('Failed to get all usage', {
        operation: 'usage_tracking_get_all_usage',
        userId,
        businessId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      return [];
    }
  }

  /**
   * Record usage for a specific metric
   */
  static async recordUsage(
    userId: string,
    metric: string,
    quantity: number = 1,
    cost: number = 0,
    businessId?: string
  ): Promise<void> {
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get user's active subscription
      const subscription = await prisma.subscription.findFirst({
        where: businessId ? { businessId, status: 'active' } : { userId, status: 'active' },
      });

      await prisma.usageRecord.create({
        data: {
          userId,
          subscriptionId: subscription?.id,
          metric,
          quantity,
          cost,
          periodStart,
          periodEnd,
          businessId: businessId || null,
        },
      });
    } catch (error) {
      await logger.error('Failed to record usage', {
        operation: 'usage_tracking_record_usage',
        userId,
        metric,
        quantity,
        businessId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      // Don't throw - usage tracking failures shouldn't break the app
    }
  }

  /**
   * Check if usage limit is exceeded
   */
  static async checkLimit(
    userId: string,
    metric: string,
    businessId?: string
  ): Promise<{ allowed: boolean; usageInfo: UsageLimit | null; reason?: string }> {
    const usageInfo = await this.getUsageInfo(userId, metric, businessId);

    if (!usageInfo) {
      // If we can't get usage info, allow access (fail open)
      return { allowed: true, usageInfo: null };
    }

    // Unlimited means always allowed
    if (usageInfo.limit === -1) {
      return { allowed: true, usageInfo };
    }

    // Check if limit is exceeded
    if (usageInfo.currentUsage >= usageInfo.limit) {
      return {
        allowed: false,
        usageInfo,
        reason: `Usage limit exceeded for ${metric}. Current: ${usageInfo.currentUsage}/${usageInfo.limit}`,
      };
    }

    return { allowed: true, usageInfo };
  }

  /**
   * Get usage alerts (warnings at 80%, 90%, 100%)
   */
  static async getUsageAlerts(userId: string, businessId?: string): Promise<UsageAlert[]> {
    try {
      const allUsage = await this.getAllUsage(userId, businessId);
      const alerts: UsageAlert[] = [];

      for (const usage of allUsage) {
        // Skip unlimited metrics
        if (usage.limit === -1) continue;

        const percentage = usage.percentageUsed;

        if (percentage >= 100) {
          alerts.push({
            metric: usage.metric,
            severity: 'critical',
            percentageUsed: percentage,
            message: `Usage limit exceeded for ${usage.metric}. You are ${usage.overage} units over your limit.`,
            limit: usage.limit,
            currentUsage: usage.currentUsage,
            remaining: 0,
          });
        } else if (percentage >= 90) {
          alerts.push({
            metric: usage.metric,
            severity: 'critical',
            percentageUsed: percentage,
            message: `Critical: You've used ${percentage.toFixed(0)}% of your ${usage.metric} limit. Only ${usage.remaining} remaining.`,
            limit: usage.limit,
            currentUsage: usage.currentUsage,
            remaining: usage.remaining,
          });
        } else if (percentage >= 80) {
          alerts.push({
            metric: usage.metric,
            severity: 'warning',
            percentageUsed: percentage,
            message: `Warning: You've used ${percentage.toFixed(0)}% of your ${usage.metric} limit. ${usage.remaining} remaining.`,
            limit: usage.limit,
            currentUsage: usage.currentUsage,
            remaining: usage.remaining,
          });
        }
      }

      return alerts;
    } catch (error) {
      await logger.error('Failed to get usage alerts', {
        operation: 'usage_tracking_get_alerts',
        userId,
        businessId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return [];
    }
  }

  /**
   * Calculate total overage cost for a user in the current period
   */
  static async calculateOverageCost(userId: string, businessId?: string): Promise<number> {
    try {
      const allUsage = await this.getAllUsage(userId, businessId);
      let totalOverage = 0;

      for (const usage of allUsage) {
        if (usage.overageCost) {
          totalOverage += usage.overageCost;
        }
      }

      return totalOverage;
    } catch (error) {
      await logger.error('Failed to calculate overage cost', {
        operation: 'usage_tracking_calculate_overage',
        userId,
        businessId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return 0;
    }
  }
}

