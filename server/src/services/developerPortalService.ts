import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil' as any, // TypeScript types may lag behind Stripe API versions
}) : null;

export interface DeveloperStats {
  totalRevenue: number;
  totalPayouts: number;
  pendingPayouts: number;
  activeSubscriptions: number;
  totalDownloads: number;
  averageRating: number;
}

export interface ModuleRevenue {
  moduleId: string;
  moduleName: string;
  totalRevenue: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  lifetimeValue: number;
}

export interface PayoutHistoryItem {
  id: string;
  amount: number;
  status: string;
  date: Date;
}

export interface PayoutRequest {
  developerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface DeveloperRevenue {
  id: string;
  developerRevenue: number;
  periodStart: Date;
  payoutStatus: string;
}

export interface ModuleSubscription {
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  user: {
    name: string | null;
  };
}

export interface ModuleReview {
  id: string;
  rating: number;
  reviewer: {
    name: string | null;
  };
}

export interface ModuleAnalytics {
  moduleId: string;
  moduleName: string;
  monthlyRevenue: number;
  activeSubscriptions: number;
  totalInstallations: number;
  averageRating: number;
  totalReviews: number;
  revenueHistory: Array<{
    period: Date;
    amount: number;
    status: string;
  }>;
  subscriptionHistory: Array<{
    userId: string;
    userName: string | null;
    status: string;
    createdAt: Date;
  }>;
}

export interface DeveloperDashboard {
  stats: DeveloperStats;
  moduleRevenue: ModuleRevenue[];
  payoutHistory: PayoutHistoryItem[];
}

export class DeveloperPortalService {
  /**
   * Get developer statistics
   */
  static async getDeveloperStats(developerId: string, businessId?: string): Promise<DeveloperStats> {
    const modules = await prisma.module.findMany({
      where: { 
        developerId,
        ...(businessId ? { businessId } : {}),
      },
      include: {
        subscriptions: {
          where: { status: 'active' },
        },
        developerRevenue: true,
      },
    });

    const totalRevenue = modules.reduce((sum, module) => {
      return sum + module.developerRevenue.reduce((moduleSum, revenue) => {
        return moduleSum + revenue.developerRevenue;
      }, 0);
    }, 0);

    const totalPayouts = modules.reduce((sum, module) => {
      return sum + module.developerRevenue
        .filter(revenue => revenue.payoutStatus === 'paid')
        .reduce((moduleSum, revenue) => {
          return moduleSum + revenue.developerRevenue;
        }, 0);
    }, 0);

    const pendingPayouts = modules.reduce((sum, module) => {
      return sum + module.developerRevenue
        .filter(revenue => revenue.payoutStatus === 'pending')
        .reduce((moduleSum, revenue) => {
          return moduleSum + revenue.developerRevenue;
        }, 0);
    }, 0);

    const activeSubscriptions = modules.reduce((sum, module) => {
      return sum + module.subscriptions.length;
    }, 0);

    const totalDownloads = modules.reduce((sum, module) => {
      return sum + module.downloads;
    }, 0);

    const averageRating = modules.length > 0 
      ? modules.reduce((sum, module) => sum + module.rating, 0) / modules.length
      : 0;

    return {
      totalRevenue,
      totalPayouts,
      pendingPayouts,
      activeSubscriptions,
      totalDownloads,
      averageRating,
    };
  }

  /**
   * Get module revenue breakdown
   */
  static async getModuleRevenue(developerId: string, businessId?: string): Promise<ModuleRevenue[]> {
    const modules = await prisma.module.findMany({
      where: { 
        developerId,
        ...(businessId ? { businessId } : {}),
      },
      include: {
        subscriptions: {
          where: { status: 'active' },
        },
        developerRevenue: true,
      },
    });

    return modules.map(module => {
      const totalRevenue = module.developerRevenue.reduce((sum, revenue) => {
        return sum + revenue.developerRevenue;
      }, 0);

      const monthlyRecurringRevenue = module.subscriptions.reduce((sum, subscription) => {
        return sum + (subscription.amount * module.revenueSplit);
      }, 0);

      const lifetimeValue = totalRevenue + monthlyRecurringRevenue;

      return {
        moduleId: module.id,
        moduleName: module.name,
        totalRevenue,
        activeSubscriptions: module.subscriptions.length,
        monthlyRecurringRevenue,
        lifetimeValue,
      };
    });
  }

  /**
   * Request payout for developer
   */
  static async requestPayout(developerId: string, amount: number): Promise<PayoutRequest> {
    // Check if developer has sufficient pending revenue
    const pendingRevenue = await this.getDeveloperStats(developerId);
    
    if (pendingRevenue.pendingPayouts < amount) {
      throw new Error('Insufficient pending revenue for payout');
    }

    // Create payout record
    // Note: This is a special payout record, not a revenue split calculation
    // Using default values for commission fields since this is a manual payout
    const payout = await prisma.developerRevenue.create({
      data: {
        developerId,
        moduleId: 'payout', // Special identifier for payouts
        periodStart: new Date(),
        periodEnd: new Date(),
        totalRevenue: 0,
        platformRevenue: 0,
        developerRevenue: amount,
        payoutStatus: 'pending',
        commissionRate: 0.3, // Default 30% (not used for manual payouts)
        commissionType: 'standard', // Default type
        subscriptionAgeMonths: 0, // Not applicable for manual payouts
        isFirstYear: false, // Not applicable for manual payouts
      },
    });

    // If Stripe is configured, create transfer
    if (stripe) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: developerId },
        });

        // For now, just mark as pending since we don't have stripeCustomerId
        // In a real implementation, you would need to set up Stripe Connect
        // or use a different payout method
        console.log(`Payout requested for developer ${developerId}: $${amount}`);
        
        // Update payout status to processing
        await prisma.developerRevenue.update({
          where: { id: payout.id },
          data: {
            payoutStatus: 'pending', // Keep as pending for manual processing
          },
        });
      } catch (error) {
        console.error('Payout processing failed:', error);
        // Keep payout as pending for manual processing
      }
    }

    return {
      developerId,
      amount,
      currency: 'USD',
      status: 'pending',
    };
  }

  /**
   * Get payout history
   */
  static async getPayoutHistory(developerId: string): Promise<PayoutHistoryItem[]> {
    const payouts = await prisma.developerRevenue.findMany({
      where: {
        developerId,
        moduleId: 'payout',
      },
      orderBy: { createdAt: 'desc' },
    });

    return payouts.map(payout => ({
      id: payout.id,
      amount: payout.developerRevenue,
      status: payout.payoutStatus,
      date: payout.payoutDate || payout.createdAt,
    }));
  }

  /**
   * Get module analytics
   */
  static async getModuleAnalytics(moduleId: string): Promise<ModuleAnalytics> {
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        subscriptions: {
          include: { user: true },
        },
        installations: {
          include: { user: true },
        },
        moduleReviews: {
          include: { reviewer: true },
        },
        developerRevenue: true,
      },
    });

    if (!module) {
      throw new Error('Module not found');
    }

    const monthlyRevenue = module.developerRevenue.reduce((sum: number, revenue: DeveloperRevenue) => {
      return sum + revenue.developerRevenue;
    }, 0);

    const activeSubscriptions = module.subscriptions.filter((sub: ModuleSubscription) => sub.status === 'active');
    const totalInstallations = module.installations.length;
    const averageRating = module.moduleReviews.length > 0 
      ? module.moduleReviews.reduce((sum: number, review: ModuleReview) => sum + review.rating, 0) / module.moduleReviews.length
      : 0;

    return {
      moduleId: module.id,
      moduleName: module.name,
      monthlyRevenue,
      activeSubscriptions: activeSubscriptions.length,
      totalInstallations,
      averageRating,
      totalReviews: module.moduleReviews.length,
      revenueHistory: module.developerRevenue.map((revenue: DeveloperRevenue) => ({
        period: revenue.periodStart,
        amount: revenue.developerRevenue,
        status: revenue.payoutStatus,
      })),
      subscriptionHistory: module.subscriptions.map((sub: ModuleSubscription) => ({
        userId: sub.userId,
        userName: sub.user.name,
        status: sub.status,
        createdAt: sub.createdAt,
      })),
    };
  }

  /**
   * Update module pricing
   */
  static async updateModulePricing(
    moduleId: string, 
    basePrice: number, 
    enterprisePrice?: number
  ): Promise<unknown> {
    const module = await prisma.module.update({
      where: { id: moduleId },
      data: {
        basePrice,
        enterprisePrice,
        pricingTier: basePrice > 0 ? 'premium' : 'free',
      },
    });

    return module;
  }

  /**
   * Get developer dashboard data
   */
  static async getDeveloperDashboard(developerId: string, businessId?: string): Promise<DeveloperDashboard> {
    const [stats, moduleRevenue, payoutHistory] = await Promise.all([
      this.getDeveloperStats(developerId, businessId),
      this.getModuleRevenue(developerId, businessId),
      this.getPayoutHistory(developerId),
    ]);

    return {
      stats,
      moduleRevenue,
      payoutHistory,
    };
  }
} 