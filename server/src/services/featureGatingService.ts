import { prisma } from '../lib/prisma';
import { AIQueryService } from './aiQueryService';
import { isUnlimitedTier } from '../config/aiQueryPacks';

export interface FeatureConfig {
  name: string;
  requiredTier: 'free' | 'pro' | 'business_basic' | 'business_advanced' | 'enterprise';
  module: string;
  category: 'personal' | 'business';
  description: string;
  usageLimit?: number;
  usageMetric?: string;
}

export interface UsageLimit {
  metric: string;
  limit: number;
  currentUsage: number;
  remaining: number;
}

export class FeatureGatingService {
  // Feature configurations
  private static readonly FEATURES: Record<string, FeatureConfig> = {
    // ===== CORE PLATFORM FEATURES =====
    'basic_modules': {
      name: 'Basic Modules Access',
      requiredTier: 'free',
      module: 'core',
      category: 'personal',
      description: 'Access to all core modules (Chat, Drive, Calendar, Dashboard)',
    },
    'ads_supported': {
      name: 'Ad-Supported Experience',
      requiredTier: 'free',
      module: 'core',
      category: 'personal',
      description: 'Platform experience includes advertisements',
    },
    'limited_ai': {
      name: 'Limited AI Usage',
      requiredTier: 'free',
      module: 'ai',
      category: 'personal',
      description: 'Taste of AI features with usage restrictions',
      usageLimit: 50,
      usageMetric: 'ai_requests',
    },

    // ===== PRO FEATURES =====
    'all_modules': {
      name: 'All Modules Access',
      requiredTier: 'pro',
      module: 'core',
      category: 'personal',
      description: 'Full access to all platform modules',
    },
    'unlimited_ai': {
      name: 'AI Usage',
      requiredTier: 'pro',
      module: 'ai',
      category: 'personal',
      description: 'AI features with base allowance and purchasable query packs',
    },
    'no_ads': {
      name: 'Ad-Free Experience',
      requiredTier: 'pro',
      module: 'core',
      category: 'personal',
      description: 'Clean, ad-free platform experience',
    },

    // ===== BUSINESS BASIC FEATURES =====
    'team_management': {
      name: 'Team Management',
      requiredTier: 'business_basic',
      module: 'business',
      category: 'business',
      description: 'Basic team management and collaboration features',
    },
    'enterprise_features': {
      name: 'Enterprise Features',
      requiredTier: 'business_basic',
      module: 'business',
      category: 'business',
      description: 'Basic enterprise-level features and settings',
    },
    'basic_ai': {
      name: 'Basic AI Settings',
      requiredTier: 'business_basic',
      module: 'ai',
      category: 'business',
      description: 'Basic AI configuration for business use',
    },

    // ===== BUSINESS ADVANCED FEATURES =====
    'advanced_ai': {
      name: 'Advanced AI Settings',
      requiredTier: 'business_advanced',
      module: 'ai',
      category: 'business',
      description: 'Advanced AI configuration and customization',
    },
    'advanced_analytics': {
      name: 'Advanced Analytics',
      requiredTier: 'business_advanced',
      module: 'analytics',
      category: 'business',
      description: 'Advanced business analytics and reporting',
    },

    // ===== ENTERPRISE FEATURES =====
    'custom_integrations': {
      name: 'Custom Integrations',
      requiredTier: 'enterprise',
      module: 'business',
      category: 'business',
      description: 'Custom API integrations and third-party connections',
    },
    'dedicated_support': {
      name: 'Dedicated Support',
      requiredTier: 'enterprise',
      module: 'support',
      category: 'business',
      description: 'Dedicated customer success and technical support',
    },

    // ===== DRIVE ENTERPRISE FEATURES =====
    'drive_advanced_sharing': {
      name: 'Advanced File Sharing',
      requiredTier: 'business_basic',
      module: 'drive',
      category: 'business',
      description: 'Advanced file sharing with granular permissions and collaboration features',
    },
    'drive_dlp': {
      name: 'Data Loss Prevention',
      requiredTier: 'business_advanced',
      module: 'drive',
      category: 'business',
      description: 'Data classification, DLP policies, and compliance features',
    },
    'drive_audit_logs': {
      name: 'Drive Audit Logs',
      requiredTier: 'business_advanced',
      module: 'drive',
      category: 'business',
      description: 'Comprehensive audit trails and compliance reporting for drive activities',
    },
  };

  /**
   * Check if user has access to a specific feature
   */
  static async checkFeatureAccess(
    userId: string,
    featureName: string,
    businessId?: string
  ): Promise<{ hasAccess: boolean; reason?: string; usageInfo?: UsageLimit }> {
    const feature = this.FEATURES[featureName];
    if (!feature) {
      return { hasAccess: false, reason: 'Feature not found' };
    }

    // Get user's subscription
    let subscription = null;
    let userTier = 'free';
    
    try {
      subscription = await prisma.subscription.findFirst({
        where: businessId
          ? { businessId, status: 'active' }
          : { userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });
      
      userTier = subscription?.tier || 'free';
    } catch (dbError) {
      console.error('Database error in feature gating:', dbError);
      // If database query fails, default to free tier
      userTier = 'free';
    }
    const hasTierAccess = this.compareTiers(userTier, feature.requiredTier);

    if (!hasTierAccess) {
      return {
        hasAccess: false,
        reason: `Requires ${feature.requiredTier} tier, current tier: ${userTier}`,
      };
    }

    // Special handling for AI features - check query balance
    if (featureName === 'unlimited_ai' || featureName === 'limited_ai') {
      try {
        const availability = await AIQueryService.checkQueryAvailability(userId, businessId || undefined);
        
        // Enterprise tier is truly unlimited
        if (availability.isUnlimited) {
          return { hasAccess: true };
        }

        // Check if queries are available
        if (!availability.available || availability.remaining <= 0) {
          return {
            hasAccess: false,
            reason: `AI query balance exhausted. ${availability.remaining} queries remaining.`,
            usageInfo: {
              metric: 'ai_queries',
              limit: availability.totalAvailable,
              currentUsage: availability.totalAvailable - availability.remaining,
              remaining: availability.remaining,
            },
          };
        }

        // Return access with query information
        return {
          hasAccess: true,
          usageInfo: {
            metric: 'ai_queries',
            limit: availability.totalAvailable,
            currentUsage: availability.totalAvailable - availability.remaining,
            remaining: availability.remaining,
          },
        };
      } catch (queryError) {
        console.error('Query balance check error in feature gating:', queryError);
        // If query check fails, allow access (fail open)
        return { hasAccess: true };
      }
    }

    // Check usage limits if applicable
    if (feature.usageLimit && feature.usageMetric) {
      try {
        const usageInfo = await this.getUsageInfo(userId, feature.usageMetric, feature.usageLimit, businessId);
        
        if (usageInfo.currentUsage >= usageInfo.limit) {
          return {
            hasAccess: false,
            reason: `Usage limit exceeded for ${feature.name}`,
            usageInfo,
          };
        }

        return { hasAccess: true, usageInfo };
      } catch (usageError) {
        console.error('Usage check error in feature gating:', usageError);
        // If usage check fails, allow access (fail open)
        return { hasAccess: true };
      }
    }

    return { hasAccess: true };
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
  }

  /**
   * Get usage information for a specific metric
   */
  static async getUsageInfo(
    userId: string,
    metric: string,
    limit: number,
    businessId?: string
  ): Promise<UsageLimit> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const usage = await prisma.usageRecord.aggregate({
      where: businessId
        ? { businessId, metric, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } }
        : { userId, metric, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
      _sum: {
        quantity: true,
      },
    });

    const currentUsage = usage._sum.quantity || 0;

    return {
      metric,
      limit,
      currentUsage,
      remaining: Math.max(0, limit - currentUsage),
    };
  }

  /**
   * Get all usage information for a user
   */
  static async getUserUsage(userId: string, businessId?: string): Promise<UsageLimit[]> {
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

    return usageRecords.map(record => {
      const feature = Object.values(this.FEATURES).find(f => f.usageMetric === record.metric);
      const limit = feature?.usageLimit || 0;
      
      return {
        metric: record.metric,
        limit,
        currentUsage: record._sum.quantity || 0,
        remaining: Math.max(0, limit - (record._sum.quantity || 0)),
      };
    });
  }

  /**
   * Get all available features for a user
   */
  static async getUserFeatures(userId: string, businessId?: string): Promise<Array<FeatureConfig & { hasAccess: boolean; usageInfo?: UsageLimit }>> {
    const results = [];

    for (const [featureName, feature] of Object.entries(this.FEATURES)) {
      const access = await this.checkFeatureAccess(userId, featureName, businessId);
      results.push({
        ...feature,
        hasAccess: access.hasAccess,
        usageInfo: access.usageInfo,
      });
    }

    return results;
  }

  /**
   * Compare subscription tiers
   */
  private static compareTiers(userTier: string, requiredTier: string): boolean {
    const tierHierarchy = {
      free: 0,
      pro: 1,
      business_basic: 2,
      business_advanced: 3,
      enterprise: 4,
    };

    const userLevel = tierHierarchy[userTier as keyof typeof tierHierarchy] || 0;
    const requiredLevel = tierHierarchy[requiredTier as keyof typeof tierHierarchy] || 0;

    return userLevel >= requiredLevel;
  }

  /**
   * Get feature configuration
   */
  static getFeatureConfig(featureName: string): FeatureConfig | null {
    return this.FEATURES[featureName] || null;
  }

  /**
   * Get all feature configurations
   */
  static getAllFeatures(): Record<string, FeatureConfig> {
    return { ...this.FEATURES };
  }

  /**
   * Get features by module
   */
  static getModuleFeatures(module: string): Record<string, FeatureConfig> {
    const moduleFeatures: Record<string, FeatureConfig> = {};
    
    for (const [featureName, feature] of Object.entries(this.FEATURES)) {
      if (feature.module === module) {
        moduleFeatures[featureName] = feature;
      }
    }
    
    return moduleFeatures;
  }

  /**
   * Get features by category
   */
  static getFeaturesByCategory(category: 'personal' | 'business'): Record<string, FeatureConfig> {
    const categoryFeatures: Record<string, FeatureConfig> = {};
    
    for (const [featureName, feature] of Object.entries(this.FEATURES)) {
      if (feature.category === category) {
        categoryFeatures[featureName] = feature;
      }
    }
    
    return categoryFeatures;
  }

  /**
   * Get features by tier
   */
  static getFeaturesByTier(tier: 'free' | 'pro' | 'business_basic' | 'business_advanced' | 'enterprise'): Record<string, FeatureConfig> {
    const tierFeatures: Record<string, FeatureConfig> = {};
    
    for (const [featureName, feature] of Object.entries(this.FEATURES)) {
      if (feature.requiredTier === tier) {
        tierFeatures[featureName] = feature;
      }
    }
    
    return tierFeatures;
  }

  /**
   * Check if user has access to all core features of a module
   */
  static async checkModuleAccess(
    userId: string,
    module: string,
    businessId?: string
  ): Promise<{ hasAccess: boolean; missingFeatures: string[]; availableFeatures: string[] }> {
    const moduleFeatures = this.getModuleFeatures(module);
    const coreFeatures = Object.entries(moduleFeatures).filter(([_, feature]) => feature.category === 'personal');
    
    const missingFeatures: string[] = [];
    const availableFeatures: string[] = [];
    
    for (const [featureName, _] of coreFeatures) {
      const access = await this.checkFeatureAccess(userId, featureName, businessId);
      if (access.hasAccess) {
        availableFeatures.push(featureName);
      } else {
        missingFeatures.push(featureName);
      }
    }
    
    return {
      hasAccess: missingFeatures.length === 0,
      missingFeatures,
      availableFeatures
    };
  }

  /**
   * Get user's feature access summary for a module
   */
  static async getModuleFeatureAccess(
    userId: string,
    module: string,
    businessId?: string
  ): Promise<{
    personal: { available: string[]; locked: string[] };
    business: { available: string[]; locked: string[] };
  }> {
    const moduleFeatures = this.getModuleFeatures(module);
    
    const result = {
      personal: { available: [] as string[], locked: [] as string[] },
      business: { available: [] as string[], locked: [] as string[] }
    };
    
    for (const [featureName, feature] of Object.entries(moduleFeatures)) {
      const access = await this.checkFeatureAccess(userId, featureName, businessId);
      const category = feature.category;
      
      if (access.hasAccess) {
        result[category].available.push(featureName);
      } else {
        result[category].locked.push(featureName);
      }
    }
    
    return result;
  }

  /**
   * Check if feature requires business context
   */
  static requiresBusinessContext(featureName: string): boolean {
    const feature = this.FEATURES[featureName];
    if (!feature) return false;
    
    // Business workspace and team collaboration features require business context
    return feature.module === 'business' || 
           featureName.includes('team_') || 
           featureName.includes('business_');
  }
} 