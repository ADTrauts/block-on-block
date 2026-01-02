import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export interface RevenueSplitResult {
  platformShare: number;
  developerShare: number;
  commissionRate: number;
  commissionType: 'standard' | 'small_business' | 'long_term';
}

export class RevenueSplitService {
  /**
   * Calculate revenue split based on Apple App Store model
   * 
   * Rules:
   * - Standard: 30% platform, 70% developer (first year)
   * - Small Business: 15% platform, 85% developer (<$1M lifetime revenue)
   * - Long-term: 15% platform, 85% developer (after first year)
   */
  static async calculateDeveloperShare(
    moduleId: string,
    subscriptionAmount: number,
    subscriptionAgeMonths: number
  ): Promise<RevenueSplitResult> {
    try {
      // Get module with developer info
      const module = await prisma.module.findUnique({
        where: { id: moduleId },
        include: {
          developer: true,
        },
      });

      if (!module) {
        throw new Error(`Module not found: ${moduleId}`);
      }

      // Proprietary modules (Vssyl-owned) don't get revenue split
      if (module.isProprietary) {
        return {
          platformShare: subscriptionAmount,
          developerShare: 0,
          commissionRate: 1.0,
          commissionType: 'standard',
        };
      }

      // Get developer's lifetime revenue
      const developerLifetimeRevenue = await this.getDeveloperLifetimeRevenue(module.developerId);

      // Determine commission type and rate
      let commissionRate: number;
      let commissionType: 'standard' | 'small_business' | 'long_term';

      // Small Business Program: <$1M lifetime revenue
      if (module.smallBusinessEligible || developerLifetimeRevenue < 1_000_000) {
        commissionRate = 0.15; // 15% platform, 85% developer
        commissionType = 'small_business';
      }
      // Long-term subscription: after first year (>12 months)
      else if (subscriptionAgeMonths > 12) {
        commissionRate = 0.15; // 15% platform, 85% developer
        commissionType = 'long_term';
      }
      // Standard: first year, >=$1M revenue
      else {
        commissionRate = 0.30; // 30% platform, 70% developer
        commissionType = 'standard';
      }

      const platformShare = subscriptionAmount * commissionRate;
      const developerShare = subscriptionAmount - platformShare;

      return {
        platformShare,
        developerShare,
        commissionRate,
        commissionType,
      };
    } catch (error) {
      logger.error('Error calculating revenue split', {
        operation: 'calculate_revenue_split',
        moduleId,
        subscriptionAmount,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      throw error;
    }
  }

  /**
   * Get developer's total lifetime revenue across all modules
   */
  static async getDeveloperLifetimeRevenue(developerId: string): Promise<number> {
    try {
      const result = await prisma.developerRevenue.aggregate({
        where: { developerId },
        _sum: { totalRevenue: true },
      });

      return result._sum.totalRevenue || 0;
    } catch (error) {
      logger.error('Error getting developer lifetime revenue', {
        operation: 'get_developer_lifetime_revenue',
        developerId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return 0;
    }
  }

  /**
   * Update module's small business eligibility based on developer's lifetime revenue
   */
  static async updateModuleSmallBusinessEligibility(moduleId: string): Promise<boolean> {
    try {
      const module = await prisma.module.findUnique({
        where: { id: moduleId },
        select: { developerId: true },
      });

      if (!module) {
        throw new Error(`Module not found: ${moduleId}`);
      }

      const lifetimeRevenue = await this.getDeveloperLifetimeRevenue(module.developerId);
      const isEligible = lifetimeRevenue < 1_000_000;

      await prisma.module.update({
        where: { id: moduleId },
        data: {
          smallBusinessEligible: isEligible,
          totalLifetimeRevenue: lifetimeRevenue,
        },
      });

      return isEligible;
    } catch (error) {
      logger.error('Error updating module small business eligibility', {
        operation: 'update_module_small_business_eligibility',
        moduleId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Calculate subscription age in months from creation date
   */
  static calculateSubscriptionAgeMonths(subscriptionStartDate: Date): number {
    const now = new Date();
    const diffTime = now.getTime() - subscriptionStartDate.getTime();
    const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30)); // Approximate months
    return diffMonths;
  }

  /**
   * Update all modules' small business eligibility based on developer lifetime revenue
   * This should be run monthly to keep eligibility up to date
   */
  static async updateAllModuleSmallBusinessEligibility(): Promise<{
    updated: number;
    errors: number;
  }> {
    try {
      // Get all non-proprietary modules
      const modules = await prisma.module.findMany({
        where: { isProprietary: false },
        select: { id: true, developerId: true },
      });

      let updated = 0;
      let errors = 0;

      for (const module of modules) {
        try {
          await this.updateModuleSmallBusinessEligibility(module.id);
          updated++;
        } catch (error) {
          logger.error('Error updating module small business eligibility', {
            operation: 'update_all_module_small_business_eligibility',
            moduleId: module.id,
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          errors++;
        }
      }

      logger.info('Updated all module small business eligibility', {
        operation: 'update_all_module_small_business_eligibility',
        updated,
        errors,
      });

      return { updated, errors };
    } catch (error) {
      logger.error('Error updating all module small business eligibility', {
        operation: 'update_all_module_small_business_eligibility',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }
}

