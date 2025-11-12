import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import * as bcrypt from 'bcrypt';
import { SupportTicketEmailService } from './supportTicketEmailService';
import { SecurityService } from './securityService';
import { logger } from '../lib/logger';

// ============================================================================
// INTERFACES
// ============================================================================

interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
}

interface ContentReport {
  id: string;
  contentType: 'post' | 'comment' | 'file' | 'message';
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  reporter: {
    email: string;
    name: string;
  };
  content: {
    id: string;
    title: string;
    description: string;
    url: string;
  };
  severity: 'low' | 'medium' | 'high';
  autoModerated: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  action?: string;
}

interface ContentReportFilters {
  status?: string;
  severity?: string;
  contentType?: string;
  page?: number;
  limit?: number;
}

interface AnalyticsFilters {
  dateRange?: string;
  userType?: string;
  metric?: string;
  businessId?: string;
  moduleId?: string;
}

interface SecurityEventData {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  userEmail?: string;
  adminId: string;
  adminEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

interface SystemConfig {
  configKey: string;
  configValue: string | number | boolean | Record<string, unknown>;
  description: string;
}

interface ABTestData {
  name: string;
  description: string;
  variantA: Record<string, unknown>;
  variantB: Record<string, unknown>;
  trafficSplit: number;
  metrics: string[];
}

interface UserSegmentData {
  name: string;
  description: string;
  criteria: Record<string, unknown>;
  filters: Record<string, unknown>;
}

interface ReportConfig {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  format: string;
  filters: Record<string, unknown>;
}

interface SupportTicketData {
  title: string;
  description: string;
  priority: string;
  category: string;
  userId?: string;
  customerId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  customer: {
    id: string;
    name: string;
    email: string;
    plan: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  responseTime: number;
  satisfaction?: number;
  tags: string[];
  attachments: string[];
}

interface SupportTicketFilters {
  status?: string;
  priority?: string;
  category?: string;
  dateRange?: string;
}

interface KnowledgeArticleData {
  title: string;
  content: string;
  category: string;
  tags: string[];
  authorId: string;
  status: 'draft' | 'published' | 'archived';
  metadata?: Record<string, unknown>;
}

interface PerformanceAlertConfig {
  metric: string;
  threshold: number;
  condition: 'above' | 'below';
  severity: string;
  notificationChannels: string[];
}

interface SecurityReportFilters {
  severity?: string;
  status?: string;
  timeRange?: string;
}

interface ModuleSubmission {
  id: string;
  status: string;
  submittedAt: Date;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  module: {
    id: string;
    name: string;
    category: string;
    downloads?: number | null;
    rating?: number | null;
    pricingTier?: string | null;
    developer: {
      id: string;
      name: string | null;
      email: string;
    };
  };
  submitter: {
    id: string;
    name: string | null;
    email: string;
  };
  reviewer?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface AnalyticsData {
  userGrowth: {
    total: number;
    newThisMonth: number;
    growthRate: number;
    monthlyTrend: unknown[];
  };
  revenue: {
    total: number;
    thisMonth: number;
    growthRate: number;
    monthlyTrend: unknown[];
  };
  engagement: {
    activeUsers: number;
    avgSessionDuration: number;
    retentionRate: number;
    dailyActiveUsers: unknown[];
  };
  system: {
    uptime: number;
    avgResponseTime: number;
    errorRate: number;
    performanceTrend: unknown[];
  };
}

interface SystemMetricData {
  metricType: string;
  metricName: string;
  metricValue: number;
  metadata?: Record<string, unknown>;
}

interface ModuleDataFilters {
  status?: string;
  category?: string;
  dateRange?: string;
  developerId?: string;
}

interface BusinessIntelligenceFilters {
  dateRange?: string;
  businessId?: string;
  moduleId?: string;
  userType?: string;
  metric?: string;
}

interface BusinessIntelligenceData {
  userGrowth: unknown; // Will be defined by getUserGrowthMetrics return type
  revenueMetrics: unknown; // Will be defined by getRevenueMetrics return type
  engagementMetrics: unknown; // Will be defined by getEngagementMetrics return type
  predictiveInsights: unknown; // Will be defined by getPredictiveInsights return type
  abTests: unknown; // Will be defined by getABTests return type
  userSegments: unknown; // Will be defined by getUserSegments return type
  competitiveAnalysis: unknown; // Will be defined by getCompetitiveAnalysis return type
}

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: {
    id: string;
    name: string;
  };
  status: string;
  views: number;
  helpful: number;
  notHelpful: number;
  createdAt: string;
  updatedAt: string;
}

interface PerformanceAlertFilters {
  severity?: string;
  status?: string;
  type?: string;
}

interface PerformanceAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  severity: string;
  acknowledged: boolean;
  resolved: boolean;
}

interface LiveChat {
  id: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  agent?: {
    id: string;
    name: string;
  };
  status: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  duration: number;
}

interface OptimizationRecommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  impact: string;
  effort: string;
  estimatedSavings: number;
  priority: number;
  status: string;
}

export class AdminService {
  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  static async getUsers(params: UserFilters) {
    const { page = 1, limit = 20, search, status, role } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { userNumber: { contains: search } }
      ];
    }
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          userNumber: true,
          role: true,
          createdAt: true,
          emailVerified: true,
          _count: {
            select: {
              businesses: true,
              files: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getUserDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        businesses: {
          include: {
            business: true
          }
        },
        files: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        subscriptions: true,
        activities: {
          take: 20,
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    return user;
  }

  static async updateUserStatus(userId: string, status: string, adminId: string, reason?: string) {
    // Note: User model doesn't have a status field, so we'll log this action instead
    await logger.info('Admin attempted to update user status', {
      operation: 'admin_update_user_status',
      adminId,
      userId,
      status,
      reason: reason || 'No reason provided'
    });
    
    // For now, return the user without status update since the field doesn't exist
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    return user;
  }

  static async resetUserPassword(userId: string, adminId: string) {
    // Generate new password
    const newPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    await logger.logSecurityEvent('password_reset_by_admin', 'medium', {
      operation: 'admin_reset_user_password',
      adminId,
      userId
    });

    return { message: 'Password reset successfully' };
  }

  // ============================================================================
  // CONTENT MODERATION
  // ============================================================================

  static async getReportedContent(filters: ContentReportFilters) {
    try {
      // Build where clause for filtering
      const whereClause: any = {};
      
      if (filters.status && filters.status !== 'all') {
        whereClause.status = filters.status;
      }
      
      if (filters.severity && filters.severity !== 'all') {
        whereClause.severity = filters.severity;
      }
      
      if (filters.contentType && filters.contentType !== 'all') {
        whereClause.contentType = filters.contentType;
      }

      // Calculate pagination
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const total = await prisma.contentReport.count({
        where: whereClause
      });

      // Get reports with pagination
      const reports = await prisma.contentReport.findMany({
        where: whereClause,
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      });

      // Transform data to match frontend expectations
      const transformedReports = reports.map(report => ({
        id: report.id,
        contentType: report.contentType,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
        reviewedBy: report.reviewedBy,
        reviewedAt: report.reviewedAt?.toISOString(),
        action: report.action,
        reporter: {
          email: report.reporter.email,
          name: report.reporter.name || 'Unknown User'
        },
        content: {
          id: report.contentId,
          title: 'No title', // TODO: Add contentTitle field to schema
          description: 'No description', // TODO: Add contentDescription field to schema
          url: '#' // TODO: Add contentUrl field to schema
        },
        severity: 'medium' as 'low' | 'medium' | 'high' | 'critical', // TODO: Add severity field to schema
        autoModerated: false // TODO: Add autoModerated field to schema
      }));

      return {
        reports: transformedReports,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      await logger.error('Failed to get reported content', {
        operation: 'admin_get_reported_content',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  static async updateReportStatus(reportId: string, status: string, action: string, reason: string, adminId: string) {
    try {
      // Update the report in the database
      const updatedReport = await prisma.contentReport.update({
        where: { id: reportId },
        data: {
          status,
          action,
          details: reason,
          reviewedBy: adminId,
          reviewedAt: new Date()
        }
      });

      // Log the moderation action
      await this.logSecurityEvent({
        eventType: 'content_moderated',
        severity: 'medium',
        adminId: adminId,
        details: {
          reportId: reportId,
          status: status,
          action: action,
          reason: reason,
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        reportId: reportId,
        status: status,
        action: action,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      await logger.error('Failed to update report status', {
        operation: 'admin_update_report_status',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  static async createContentReport(data: {
    reporterId: string;
    contentId: string;
    contentType: string;
    reason: string;
    severity?: string;
    contentTitle?: string;
    contentDescription?: string;
    contentUrl?: string;
  }) {
    try {
      const report = await prisma.contentReport.create({
        data: {
          reporterId: data.reporterId,
          contentId: data.contentId,
          contentType: data.contentType,
          reason: data.reason,
          status: 'pending'
        },
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      return report;
    } catch (error) {
      await logger.error('Failed to create content report', {
        operation: 'admin_create_content_report',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  static async getModerationStats() {
    try {
      const [
        totalReports,
        pendingReports,
        autoModeratedReports,
        resolvedReports
      ] = await Promise.all([
        prisma.contentReport.count(),
        prisma.contentReport.count({ where: { status: 'pending' } }),
        prisma.contentReport.count({ where: { status: 'pending' } }), // Mock auto-moderated count
        prisma.contentReport.count({ where: { status: 'resolved' } })
      ]);

      return {
        totalReports,
        pendingReview: pendingReports,
        autoModerated: autoModeratedReports,
        resolved: resolvedReports
      };
    } catch (error) {
      await logger.error('Failed to get moderation statistics', {
        operation: 'admin_get_moderation_stats',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  static async getDashboardStats() {
    const [
      totalUsers,
      totalBusinesses,
      moduleRevenue
    ] = await Promise.all([
      prisma.user.count(),
      prisma.business.count(),
      prisma.moduleSubscription.aggregate({
        _sum: { amount: true },
        where: { status: 'active' }
      })
    ]);

    return {
      totalUsers,
      activeUsers: totalUsers, // Since we don't have status field, assume all are active
      totalBusinesses,
      monthlyRevenue: moduleRevenue._sum.amount || 0,
      systemHealth: 99.9 // Mock value for now
    };
  }

  static async getSystemMetrics(timeRange: string = '24h') {
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
    
    const metrics = await prisma.systemMetrics.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - hours * 60 * 60 * 1000)
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return metrics;
  }

  static async getUserAnalytics(timeRange: string = '30d') {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    
    const userStats = await prisma.user.groupBy({
      by: ['createdAt'],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      }
    });

    return userStats;
  }

  // ============================================================================
  // ANALYTICS METHODS
  // ============================================================================

  static async getAnalytics(filters: AnalyticsFilters) {
    try {
      const dateRange = filters.dateRange || '30d';
      const userType = filters.userType || 'all';
      const metric = filters.metric || 'all';

      // Get user growth data
      const totalUsers = await prisma.user.count();
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const newThisMonth = await prisma.user.count({
        where: {
          createdAt: {
            gte: lastMonth
          }
        }
      });

      // Get revenue data
      const totalRevenue = await prisma.moduleSubscription.aggregate({
        _sum: {
          amount: true
        }
      });

      const thisMonthRevenue = await prisma.moduleSubscription.aggregate({
        _sum: {
          amount: true
        },
        where: {
          createdAt: {
            gte: lastMonth
          }
        }
      });

      // Get engagement data - use createdAt as proxy for activity since no lastLoginAt
      const activeUsers = await prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      });

      // Get system metrics - use the SystemMetrics structure
      const systemMetrics = await prisma.systemMetrics.findMany({
        where: {
          metricType: 'system_performance'
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 1
      });

      const latestMetrics = systemMetrics[0];

      return {
        userGrowth: {
          total: totalUsers,
          newThisMonth: newThisMonth,
          growthRate: totalUsers > 0 ? ((newThisMonth / totalUsers) * 100) : 0,
          monthlyTrend: [] // Would need to implement trend calculation
        },
        revenue: {
          total: totalRevenue._sum.amount || 0,
          thisMonth: thisMonthRevenue._sum.amount || 0,
          growthRate: 0, // Would need to calculate growth rate
          monthlyTrend: [] // Would need to implement trend calculation
        },
        engagement: {
          activeUsers: activeUsers,
          avgSessionDuration: 15, // Mock data
          retentionRate: 85, // Mock data
          dailyActiveUsers: [] // Would need to implement daily tracking
        },
        system: {
          uptime: latestMetrics?.metricValue || 99.9,
          avgResponseTime: 120, // Mock data
          errorRate: 0.1, // Mock data
          performanceTrend: [] // Would need to implement trend calculation
        }
      };
    } catch (error) {
      await logger.error('Failed to get analytics', {
        operation: 'admin_get_analytics',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  static async exportAnalytics(filters: AnalyticsFilters, format: string) {
    try {
      const analyticsData = await this.getAnalytics(filters);
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvData = this.convertToCSV(analyticsData);
        return csvData;
      } else {
        // Return JSON format
        return JSON.stringify(analyticsData, null, 2);
      }
    } catch (error) {
      await logger.error('Failed to export analytics', {
        operation: 'admin_export_analytics',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  static async getRealTimeMetrics() {
    try {
      // Get real-time system metrics
      const currentMetrics = await prisma.systemMetrics.findMany({
        where: {
          metricType: 'system_performance'
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 1
      });

      // Get recent user activity - use recent users as proxy
      const recentUsers = await prisma.user.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true
        }
      });

      return {
        system: currentMetrics[0] || {
          metricType: 'system_performance',
          metricName: 'uptime',
          metricValue: 99.9,
          timestamp: new Date()
        },
        recentActivity: recentUsers.map(user => ({
          type: 'user_registration',
          user: user.name || user.email,
          timestamp: user.createdAt
        }))
      };
    } catch (error) {
      await logger.error('Failed to get real-time metrics', {
        operation: 'admin_get_realtime_metrics',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }



  private static convertToCSV(data: AnalyticsData): string {
    // Simple CSV conversion - in a real implementation, this would be more sophisticated
    const csvRows = [];
    
    // Add headers
    csvRows.push('Metric,Value,Change');
    
    // Add data rows
    csvRows.push(`Total Users,${data.userGrowth.total},${data.userGrowth.growthRate}%`);
    csvRows.push(`New Users This Month,${data.userGrowth.newThisMonth},`);
    csvRows.push(`Total Revenue,$${data.revenue.total},${data.revenue.growthRate}%`);
    csvRows.push(`Monthly Revenue,$${data.revenue.thisMonth},`);
    csvRows.push(`Active Users,${data.engagement.activeUsers},`);
    csvRows.push(`System Uptime,${data.system.uptime}%,`);
    csvRows.push(`Avg Response Time,${data.system.avgResponseTime}ms,`);
    csvRows.push(`Error Rate,${data.system.errorRate}%,`);
    
    return csvRows.join('\n');
  }

  // ============================================================================
  // FINANCIAL MANAGEMENT
  // ============================================================================

  static async getSubscriptions(params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 20, status } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { email: true, name: true }
          }
        }
      }),
      prisma.subscription.count({ where })
    ]);

    return {
      subscriptions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Note: Payment model was removed, so we'll return empty data for now
  static async getPayments(params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 20, status } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          subscription: {
            include: { user: true }
          },
          moduleSubscription: {
            include: { 
              user: true,
              module: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.invoice.count({ where })
    ]);

    return {
      payments: payments.map(payment => ({
        id: payment.id,
        subscriptionId: payment.subscriptionId,
        moduleSubscriptionId: payment.moduleSubscriptionId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt.toISOString(),
        paidAt: payment.paidAt?.toISOString(),
        customerEmail: payment.subscription?.user?.email || payment.moduleSubscription?.user?.email || 'Unknown',
        stripeInvoiceId: payment.stripeInvoiceId
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getDeveloperPayouts(params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 20, status } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.payoutStatus = status;

    const [payouts, total] = await Promise.all([
      prisma.developerRevenue.findMany({
        where,
        include: {
          developer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          module: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.developerRevenue.count({ where })
    ]);

    return {
      payouts: payouts.map(payout => ({
        id: payout.id,
        developerId: payout.developerId,
        developerName: payout.developer.name || 'Unknown Developer',
        developerEmail: payout.developer.email,
        moduleName: payout.module.name,
        amount: payout.developerRevenue,
        totalRevenue: payout.totalRevenue,
        platformRevenue: payout.platformRevenue,
        status: payout.payoutStatus,
        requestedAt: payout.createdAt.toISOString(),
        paidAt: payout.payoutDate?.toISOString(),
        periodStart: payout.periodStart.toISOString(),
        periodEnd: payout.periodEnd.toISOString()
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // ============================================================================
  // SECURITY & COMPLIANCE
  // ============================================================================

  static async getSecurityEvents(params: {
    page?: number;
    limit?: number;
    severity?: string;
    type?: string;
    resolved?: boolean;
    timeRange?: string;
  }) {
    return SecurityService.getSecurityEvents(params);
  }

  static async getAuditLogs(params: {
    page?: number;
    limit?: number;
    adminId?: string;
    action?: string;
  }) {
    const { page = 1, limit = 20, adminId, action } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (adminId) where.adminId = adminId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // ============================================================================
  // SECURITY METHODS
  // ============================================================================

  static async getSecurityMetrics() {
    return SecurityService.getSecurityMetrics();
  }

  static async getComplianceStatus() {
    return SecurityService.getComplianceStatus();
  }

  static async resolveSecurityEvent(eventId: string, adminId: string) {
    return SecurityService.resolveSecurityEvent(eventId, adminId);
  }

  static async exportSecurityReport(filters: SecurityReportFilters, format: string) {
    try {
      const events = await prisma.securityEvent.findMany({
        where: {
          ...(filters.severity && filters.severity !== 'all' ? { severity: filters.severity } : {}),
          ...(filters.status && filters.status !== 'all' ? { resolved: filters.status === 'resolved' } : {}),
          ...(filters.timeRange ? {
            timestamp: {
              gte: new Date(Date.now() - this.getTimeRangeInMs(filters.timeRange))
            }
          } : {})
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      if (format === 'csv') {
        return this.convertSecurityEventsToCSV(events);
      } else {
        return JSON.stringify(events, null, 2);
      }
    } catch (error) {
      await logger.error('Failed to export security report', {
        operation: 'admin_export_security_report',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  private static getTimeRangeInMs(timeRange: string): number {
    switch (timeRange) {
      case '1h': return 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000; // Default to 24 hours
    }
  }

  private static convertSecurityEventsToCSV(events: Record<string, unknown>[]): string {
    const csvRows = [];
    
    // Add headers
    csvRows.push('Event ID,Event Type,Severity,User Email,IP Address,Timestamp,Resolved');
    
    // Add data rows
    events.forEach(event => {
      csvRows.push(`${event.id},${event.eventType},${event.severity},${event.userEmail || ''},${event.ipAddress || ''},${event.timestamp},${event.resolved}`);
    });
    
    return csvRows.join('\n');
  }

  // ============================================================================
  // MODERATION METHODS
  // ============================================================================


  static async getModerationRules() {
    try {
      // TODO: Fix ModerationRule model access
      // For now, return mock data
      return [
        {
          id: '1',
          name: 'Spam Detection',
          description: 'Automatically flag content containing spam keywords',
          conditions: ['Contains spam keywords', 'Multiple links', 'Repetitive content'],
          actions: ['Flag for review', 'Send warning'],
          enabled: true,
          priority: 1
        },
        {
          id: '2',
          name: 'Inappropriate Content',
          description: 'Detect and flag inappropriate or offensive content',
          conditions: ['Contains profanity', 'Hate speech', 'Violent content'],
          actions: ['Remove content', 'Ban user', 'Send warning'],
          enabled: true,
          priority: 2
        }
      ];
    } catch (error) {
      await logger.error('Failed to get moderation rules', {
        operation: 'admin_get_moderation_rules',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  static async bulkModerationAction(reportIds: string[], action: string, adminId: string) {
    try {
      const results = [];

      for (const reportId of reportIds) {
        const result = await this.updateReportStatus(reportId, 'resolved', action, 'Bulk action', adminId);
        results.push(result);
      }

      // Log the bulk action
      await this.logSecurityEvent({
        eventType: 'bulk_moderation_action',
        severity: 'medium',
        adminId: adminId,
        details: {
          action: action,
          reportIds: reportIds,
          count: reportIds.length
        }
      });

      return {
        success: true,
        processed: reportIds.length,
        results: results
      };
    } catch (error) {
      await logger.error('Failed to perform bulk moderation action', {
        operation: 'admin_bulk_moderate',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  // ============================================================================
  // SYSTEM ADMINISTRATION
  // ============================================================================

  static async getSystemHealth() {
    try {
      const { SystemMonitoringService } = await import('./systemMonitoringService');
      return await SystemMonitoringService.getSystemHealth();
    } catch (error) {
      await logger.error('Failed to get system health', {
        operation: 'admin_get_system_health',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      // Fallback to basic metrics
      return {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0,
        uptime: '0d 0h 0m',
        responseTime: 0,
        activeConnections: 0,
        errorRate: 0,
        timestamp: new Date()
      };
    }
  }

  static async getSystemConfig() {
    const configs = await prisma.systemConfig.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    return configs;
  }

  static async updateSystemConfig(configKey: string, configValue: string | number | boolean, description: string, adminId: string) {
    const config = await prisma.systemConfig.upsert({
      where: { configKey },
      update: {
        configValue,
        description,
        updatedBy: adminId,
        updatedAt: new Date()
      },
      create: {
        configKey,
        configValue,
        description,
        updatedBy: adminId
      }
    });

    await logger.info('Admin updated system configuration', {
      operation: 'admin_update_system_config',
      adminId,
      configKey
    });

    return config;
  }

  // ============================================================================
  // SYSTEM ADMINISTRATION METHODS
  // ============================================================================

  static async getBackupStatus() {
    try {
      const { SystemMonitoringService } = await import('./systemMonitoringService');
      return await SystemMonitoringService.getBackupStatus();
    } catch (error) {
      await logger.error('Failed to get backup status', {
        operation: 'admin_get_backup_status',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      // Fallback to basic status
      return {
        lastBackup: new Date().toISOString(),
        nextBackup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        backupSize: '0 GB',
        status: 'failed' as const,
        retentionDays: 30
      };
    }
  }

  static async createBackup(adminId: string) {
    try {
      // Mock backup creation - in a real implementation, this would create an actual backup
      await logger.info('Admin initiated backup creation', {
      operation: 'admin_create_backup',
      adminId
    });
      
      // Log the backup action
      await this.logSecurityEvent({
        eventType: 'backup_created',
        severity: 'low',
        adminId: adminId,
        details: {
          backupType: 'manual',
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        backupId: `backup_${Date.now()}`,
        message: 'Backup created successfully'
      };
    } catch (error) {
      await logger.error('Failed to create backup', {
        operation: 'admin_create_backup',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  static async getMaintenanceMode() {
    try {
      const { SystemMonitoringService } = await import('./systemMonitoringService');
      return await SystemMonitoringService.getMaintenanceMode();
    } catch (error) {
      await logger.error('Failed to get maintenance mode', {
        operation: 'admin_get_maintenance_mode',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      // Fallback to basic status
      return {
        enabled: false,
        message: 'System is currently under maintenance. Please try again later.',
        scheduledStart: undefined,
        scheduledEnd: undefined
      };
    }
  }

  static async setMaintenanceMode(enabled: boolean, message: string, adminId: string) {
    try {
      const { SystemMonitoringService } = await import('./systemMonitoringService');
      await SystemMonitoringService.setMaintenanceMode(enabled, message, adminId);
      
      // Log the maintenance mode action
      await this.logSecurityEvent({
        eventType: 'maintenance_mode_changed',
        severity: 'high',
        adminId: adminId,
        details: {
          enabled: enabled,
          message: message,
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        enabled: enabled,
        message: message,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      await logger.error('Failed to set maintenance mode', {
        operation: 'admin_set_maintenance_mode',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  // ============================================================================
  // USER IMPERSONATION
  // ============================================================================

  static async startImpersonation(
    adminId: string,
    targetUserId: string,
    options: {
      reason?: string;
      businessId?: string | null;
      context?: string | null;
      sessionTokenHash?: string | null;
      expiresAt?: Date | null;
    } = {}
  ) {
    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, name: true }
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Check if admin is already impersonating someone
    const existingImpersonation = await prisma.adminImpersonation.findFirst({
      where: {
        adminId,
        endedAt: null
      }
    });

    if (existingImpersonation) {
      throw new Error('Admin is already impersonating a user');
    }

    if (options.businessId) {
      const membership = await prisma.businessMember.findUnique({
        where: {
          businessId_userId: {
            businessId: options.businessId,
            userId: targetUserId
          }
        },
        select: { id: true }
      });

      if (!membership) {
        throw new Error('Target user is not a member of the specified business');
      }
    }

    // Create impersonation session
    const impersonation = await prisma.adminImpersonation.create({
      data: {
        adminId,
        targetUserId,
        reason: options.reason || 'Admin impersonation for debugging/support',
        businessId: options.businessId ?? null,
        context: options.context ?? null,
        sessionTokenHash: options.sessionTokenHash ?? null,
        expiresAt: options.expiresAt ?? null
      }
    });

    return {
      impersonation,
      targetUser
    };
  }

  static async endImpersonation(adminId: string) {
    // Find active impersonation session
    const impersonation = await prisma.adminImpersonation.findFirst({
      where: {
        adminId,
        endedAt: null
      },
      include: {
        targetUser: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    if (!impersonation) {
      throw new Error('No active impersonation session found');
    }

    // End the impersonation session
    await prisma.adminImpersonation.update({
      where: { id: impersonation.id },
      data: {
        endedAt: new Date(),
        sessionTokenHash: null
      }
    });

    return impersonation;
  }

  static async getCurrentImpersonation(adminId: string) {
    const impersonation = await prisma.adminImpersonation.findFirst({
      where: {
        adminId,
        endedAt: null
      },
      include: {
        targetUser: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    return impersonation;
  }

  static async getImpersonationHistory(adminId: string, params: {
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [impersonations, total] = await Promise.all([
      prisma.adminImpersonation.findMany({
        where: { adminId },
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          targetUser: {
            select: { id: true, email: true, name: true }
          }
        }
      }),
      prisma.adminImpersonation.count({ where: { adminId } })
    ]);

    return {
      impersonations,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  static async logSecurityEvent(eventData: SecurityEventData) {
    return await prisma.securityEvent.create({
      data: {
        eventType: eventData.eventType,
        severity: eventData.severity,
        userId: eventData.userId,
        userEmail: eventData.userEmail,
        adminId: eventData.adminId,
        adminEmail: eventData.adminEmail,
        ipAddress: eventData.ipAddress,
        userAgent: eventData.userAgent,
        // TODO: Prisma JSON compatibility issue - using any temporarily
        // Need to research proper Prisma JSON field typing solutions
        details: eventData.details as Prisma.InputJsonValue
      }
    });
  }

  static async logSystemMetric(metricData: SystemMetricData) {
    return await prisma.systemMetrics.create({
      data: {
        metricType: metricData.metricType,
        metricName: metricData.metricName,
        metricValue: metricData.metricValue,
        // TODO: Prisma JSON compatibility issue - using any temporarily
        // Need to research proper Prisma JSON field typing solutions
        metadata: metricData.metadata as Prisma.InputJsonValue
      }
    });
  }

  // Module Management Methods
  static async getModuleSubmissions(filters: ModuleDataFilters = {}): Promise<ModuleSubmission[]> {
    try {
      const whereClause: Record<string, unknown> = {};
      
      if (filters.status && filters.status !== 'all') {
        whereClause.status = filters.status;
      }
      
      if (filters.category && filters.category !== 'all') {
        whereClause.module = {
          category: filters.category
        };
      }

      const submissions = await prisma.moduleSubmission.findMany({
        where: whereClause,
        include: {
          module: {
            include: {
              developer: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          submitter: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          submittedAt: 'desc'
        }
      });

      return submissions;
    } catch (error) {
      await logger.error('Failed to get module submissions', {
        operation: 'admin_get_module_submissions',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get module submissions');
    }
  }

  static async getModuleStats(): Promise<unknown> {
    try {
      const [
        totalSubmissions,
        pendingReviews,
        approvedToday,
        rejectedToday,
        totalRevenue,
        activeDevelopers,
        averageRating,
        topCategory
      ] = await Promise.all([
        prisma.moduleSubmission.count(),
        prisma.moduleSubmission.count({
          where: { status: 'PENDING' }
        }),
        prisma.moduleSubmission.count({
          where: {
            status: 'APPROVED',
            reviewedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),
        prisma.moduleSubmission.count({
          where: {
            status: 'REJECTED',
            reviewedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),
        prisma.moduleSubscription.aggregate({
          _sum: {
            amount: true
          },
          where: {
            status: 'active'
          }
        }),
        prisma.user.count({
          where: {
            modules: {
              some: {}
            }
          }
        }),
        prisma.module.aggregate({
          _avg: {
            rating: true
          },
          where: {
            status: 'APPROVED'
          }
        }),
        prisma.module.groupBy({
          by: ['category'],
          _count: {
            id: true
          },
          orderBy: {
            _count: {
              id: 'desc'
            }
          },
          take: 1
        })
      ]);

      return {
        totalSubmissions,
        pendingReviews,
        approvedToday,
        rejectedToday,
        totalRevenue: totalRevenue._sum.amount || 0,
        activeDevelopers,
        averageRating: averageRating._avg.rating || 0,
        topCategory: topCategory[0]?.category || 'N/A'
      };
    } catch (error) {
      await logger.error('Failed to get module statistics', {
        operation: 'admin_get_module_stats',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get module stats');
    }
  }

  static async reviewModuleSubmission(
    submissionId: string,
    action: 'approve' | 'reject',
    reviewNotes?: string,
    adminId?: string
  ): Promise<unknown> {
    try {
      const submission = await prisma.moduleSubmission.findUnique({
        where: { id: submissionId },
        include: {
          module: true
        }
      });

      if (!submission) {
        throw new Error('Submission not found');
      }

      if (submission.status !== 'PENDING') {
        throw new Error('Submission has already been reviewed');
      }

      const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

      // Update submission
      const updatedSubmission = await prisma.moduleSubmission.update({
        where: { id: submissionId },
        data: {
          status: newStatus,
          reviewNotes,
          reviewerId: adminId,
          reviewedAt: new Date()
        },
        include: {
          module: {
            include: {
              developer: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          submitter: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // If approved, update module status
      if (action === 'approve') {
        await prisma.module.update({
          where: { id: submission.moduleId },
          data: {
            status: 'APPROVED'
          }
        });
      }

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: `MODULE_${action.toUpperCase()}`,
          details: JSON.stringify({
            submissionId,
            moduleId: submission.moduleId,
            moduleName: submission.module.name,
            action,
            reviewNotes
          }),
          timestamp: new Date()
        }
      });

      return updatedSubmission;
    } catch (error) {
      await logger.error('Failed to review module submission', {
        operation: 'admin_review_module_submission',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to review module submission');
    }
  }

  static async bulkModuleAction(
    submissionIds: string[],
    action: 'approve' | 'reject',
    adminId?: string
  ): Promise<unknown> {
    try {
      const results = await Promise.all(
        submissionIds.map(submissionId =>
          this.reviewModuleSubmission(submissionId, action, undefined, adminId)
        )
      );

      return {
        message: `Successfully ${action}ed ${submissionIds.length} submissions`,
        results
      };
    } catch (error) {
      await logger.error('Failed to perform bulk module action', {
        operation: 'admin_bulk_module_action',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to perform bulk module action');
    }
  }

  static async getModuleAnalytics(): Promise<unknown> {
    try {
      const [
        categoryStats,
        revenueStats,
        developerStats,
        ratingStats
      ] = await Promise.all([
        prisma.module.groupBy({
          by: ['category'],
          _count: {
            id: true
          },
          _avg: {
            rating: true
          }
        }),
        prisma.moduleSubscription.groupBy({
          by: ['moduleId'],
          _sum: {
            amount: true
          },
          where: {
            status: 'active'
          }
        }),
        prisma.user.groupBy({
          by: ['id'],
          _count: {
            id: true
          },
          where: {
            modules: {
              some: {}
            }
          }
        }),
        prisma.module.aggregate({
          _avg: {
            rating: true
          },
          _count: {
            id: true
          },
          where: {
            status: 'APPROVED'
          }
        })
      ]);

      return {
        categoryStats,
        revenueStats,
        developerStats,
        ratingStats
      };
    } catch (error) {
      await logger.error('Failed to get module analytics', {
        operation: 'admin_get_module_analytics',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get module analytics');
    }
  }

  static async getDeveloperStats(): Promise<unknown> {
    try {
      const developers = await prisma.user.findMany({
        where: {
          modules: {
            some: {}
          }
        },
        include: {
          modules: {
            include: {
              submissions: true,
              installations: true,
              subscriptions: {
                where: {
                  status: 'active'
                }
              }
            }
          }
        }
      });

      return developers.map(developer => ({
        id: developer.id,
        name: developer.name,
        email: developer.email,
        totalModules: developer.modules.length,
        approvedModules: developer.modules.filter(m => m.status === 'APPROVED').length,
        totalDownloads: developer.modules.reduce((sum, m) => sum + m.downloads, 0),
        totalRevenue: developer.modules.reduce((sum, m) => 
          sum + m.subscriptions.reduce((s, sub) => s + sub.amount, 0), 0
        ),
        averageRating: developer.modules.length > 0 
          ? developer.modules.reduce((sum, m) => sum + m.rating, 0) / developer.modules.length 
          : 0
      }));
    } catch (error) {
      await logger.error('Failed to get developer statistics', {
        operation: 'admin_get_developer_stats',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get developer stats');
    }
  }

  static async updateModuleStatus(
    moduleId: string,
    status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    adminId?: string
  ): Promise<any> {
    try {
      const module = await prisma.module.update({
        where: { id: moduleId },
        data: { status },
        include: {
          developer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'MODULE_STATUS_UPDATE',
          details: JSON.stringify({
            moduleId,
            moduleName: module.name,
            oldStatus: 'UNKNOWN',
            newStatus: status
          }),
          timestamp: new Date()
        }
      });

      return module;
    } catch (error) {
      await logger.error('Failed to update module status', {
        operation: 'admin_update_module_status',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to update module status');
    }
  }

  static async getModuleRevenue(moduleId: string): Promise<unknown> {
    try {
      const revenue = await prisma.moduleSubscription.aggregate({
        where: {
          moduleId,
          status: 'active'
        },
        _sum: {
          amount: true,
          platformRevenue: true,
          developerRevenue: true
        },
        _count: {
          id: true
        }
      });

      return {
        totalRevenue: revenue._sum.amount || 0,
        platformRevenue: revenue._sum.platformRevenue || 0,
        developerRevenue: revenue._sum.developerRevenue || 0,
        activeSubscriptions: revenue._count.id
      };
    } catch (error) {
      await logger.error('Failed to get module revenue', {
        operation: 'admin_get_module_revenue',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get module revenue');
    }
  }

  static async exportModuleData(filters: ModuleDataFilters = {}): Promise<string> {
    try {
      const submissions = await this.getModuleSubmissions(filters);
      
      const csvHeaders = [
        'ID',
        'Module Name',
        'Developer',
        'Category',
        'Status',
        'Submitted At',
        'Reviewed At',
        'Review Notes',
        'Downloads',
        'Rating',
        'Pricing Tier'
      ];

      const csvRows = submissions.map(submission => [
        submission.id,
        submission.module.name,
        submission.submitter.name,
        submission.module.category,
        submission.status,
        submission.submittedAt,
        submission.reviewedAt || '',
        submission.reviewNotes || '',
        submission.module.downloads || 0,
        submission.module.rating || 0,
        submission.module.pricingTier || 'free'
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      await logger.error('Failed to export module data', {
        operation: 'admin_export_module_data',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to export module data');
    }
  }

  // Business Intelligence Methods
  static async getBusinessIntelligence(filters: BusinessIntelligenceFilters = {}): Promise<BusinessIntelligenceData> {
    try {
      // Get date range
      const dateRange = this.getDateRangeFromFilter(filters.dateRange || '30d');
      
      // Get user growth metrics
      const userGrowth = await this.getUserGrowthMetrics(dateRange);
      
      // Get revenue metrics
      const revenueMetrics = await this.getRevenueMetrics(dateRange);
      
      // Get engagement metrics
      const engagementMetrics = await this.getEngagementMetrics(dateRange);
      
      // Get predictive insights (AI-powered)
      const predictiveInsights = await this.getPredictiveInsights();
      
      // Get A/B tests
      const abTests = await this.getABTests();
      
      // Get user segments
      const userSegments = await this.getUserSegments();
      
      // Get competitive analysis
      const competitiveAnalysis = await this.getCompetitiveAnalysis();

      return {
        userGrowth,
        revenueMetrics,
        engagementMetrics,
        predictiveInsights,
        abTests,
        userSegments,
        competitiveAnalysis
      };
    } catch (error) {
      await logger.error('Failed to get business intelligence data', {
        operation: 'admin_get_business_intelligence',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get business intelligence data');
    }
  }

  static async exportBusinessIntelligence(filters: BusinessIntelligenceFilters = {}): Promise<string> {
    try {
      const data = await this.getBusinessIntelligence(filters);
      
      // Generate CSV content
      const csvHeaders = [
        'Metric',
        'Value',
        'Change',
        'Trend'
      ];

      const csvRows = [
        ['User Growth', (data.userGrowth as any)?.totalUsers || 0, (data.userGrowth as any)?.growthRate || 0, (data.userGrowth as any)?.trend || 'stable'],
        ['Revenue', (data.revenueMetrics as any)?.totalRevenue || 0, (data.revenueMetrics as any)?.growthRate || 0, (data.revenueMetrics as any)?.trend || 'stable'],
        ['Engagement', (data.engagementMetrics as any)?.activeUsers || 0, (data.engagementMetrics as any)?.changeRate || 0, (data.engagementMetrics as any)?.trend || 'stable']
      ];

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      await logger.error('Failed to export business intelligence data', {
        operation: 'admin_export_business_intelligence',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to export business intelligence data');
    }
  }

  static async createABTest(testData: ABTestData, adminId?: string): Promise<unknown> {
    try {
      // In a real implementation, this would create an A/B test in the database
      const test = {
        id: `test_${Date.now()}`,
        ...testData,
        status: 'running',
        createdAt: new Date(),
        createdBy: adminId
      };

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'AB_TEST_CREATED',
          details: JSON.stringify({
            testId: test.id,
            testName: testData.name,
            variantA: testData.variantA,
            variantB: testData.variantB
          }),
          timestamp: new Date()
        }
      });

      return test;
    } catch (error) {
      await logger.error('Failed to create A/B test', {
        operation: 'admin_create_ab_test',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to create A/B test');
    }
  }

  static async getABTestResults(testId: string): Promise<unknown> {
    try {
      // Mock A/B test results
      return {
        testId,
        status: 'running',
        results: {
          variantA: {
            users: 5000,
            conversionRate: 3.2,
            revenue: 16000
          },
          variantB: {
            users: 5000,
            conversionRate: 4.1,
            revenue: 20500
          },
          confidence: 95,
          winner: 'B'
        }
      };
    } catch (error) {
      await logger.error('Failed to get A/B test results', {
        operation: 'admin_get_ab_test_results',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get A/B test results');
    }
  }

  static async updateABTest(testId: string, updates: Partial<ABTestData>, adminId?: string): Promise<unknown> {
    try {
      // In a real implementation, this would update the A/B test in the database
      const updatedTest = {
        id: testId,
        ...updates,
        updatedAt: new Date(),
        updatedBy: adminId
      };

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'AB_TEST_UPDATED',
          details: JSON.stringify({
            testId,
            updates
          }),
          timestamp: new Date()
        }
      });

      return updatedTest;
    } catch (error) {
      await logger.error('Failed to update A/B test', {
        operation: 'admin_update_ab_test',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to update A/B test');
    }
  }

  static async getUserSegments(): Promise<unknown[]> {
    try {
      // Get user segments based on behavior and demographics
      const segments = await prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true
        }
      });

      return segments.map(segment => ({
        id: segment.role,
        name: `${segment.role.charAt(0).toUpperCase() + segment.role.slice(1)} Users`,
        criteria: `Role: ${segment.role}`,
        userCount: segment._count.id,
        averageValue: 0, // Would calculate based on subscription data
        growthRate: 0 // Would calculate based on historical data
      }));
    } catch (error) {
      await logger.error('Failed to get user segments', {
        operation: 'admin_get_user_segments',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get user segments');
    }
  }

  static async createUserSegment(segmentData: UserSegmentData, adminId?: string): Promise<unknown> {
    try {
      const segment = {
        id: `segment_${Date.now()}`,
        ...segmentData,
        createdAt: new Date(),
        createdBy: adminId
      };

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'USER_SEGMENT_CREATED',
          details: JSON.stringify({
            segmentId: segment.id,
            segmentName: segmentData.name,
            criteria: segmentData.criteria
          }),
          timestamp: new Date()
        }
      });

      return segment;
    } catch (error) {
      await logger.error('Failed to create user segment', {
        operation: 'admin_create_user_segment',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to create user segment');
    }
  }

  static async getPredictiveInsights(): Promise<unknown[]> {
    try {
      // In a real implementation, this would use ML models to generate insights
      const insights = [
        {
          type: 'churn',
          title: 'High Churn Risk - Enterprise Users',
          description: 'Enterprise users showing 15% higher churn probability due to feature gaps',
          confidence: 87,
          impact: 'high',
          recommendedAction: 'Implement advanced analytics features and improve enterprise support'
        },
        {
          type: 'upsell',
          title: 'Upsell Opportunity - Free Users',
          description: '45% of free users are ready for premium upgrade based on usage patterns',
          confidence: 92,
          impact: 'medium',
          recommendedAction: 'Targeted email campaign with personalized upgrade offers'
        },
        {
          type: 'growth',
          title: 'Market Expansion - Asia Pacific',
          description: 'Strong growth potential in APAC region with 200% YoY interest increase',
          confidence: 78,
          impact: 'high',
          recommendedAction: 'Launch localized marketing campaigns and partner with regional distributors'
        }
      ];

      return insights;
    } catch (error) {
      await logger.error('Failed to get predictive insights', {
        operation: 'admin_get_predictive_insights',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get predictive insights');
    }
  }

  static async getCompetitiveAnalysis(): Promise<unknown> {
    try {
      // In a real implementation, this would gather data from market research
      return {
        marketPosition: 'Emerging Leader',
        keyCompetitors: [
          {
            name: 'Competitor A',
            marketShare: 35,
            strengths: ['Established brand', 'Large user base'],
            weaknesses: ['Outdated UI', 'Poor mobile experience']
          },
          {
            name: 'Competitor B',
            marketShare: 25,
            strengths: ['Advanced features', 'Good mobile app'],
            weaknesses: ['High pricing', 'Complex onboarding']
          }
        ],
        opportunities: [
          'Mobile-first approach',
          'AI-powered features',
          'Better pricing strategy',
          'Improved user experience'
        ],
        threats: [
          'Large tech companies entering market',
          'Economic downturn affecting spending',
          'Regulatory changes',
          'Rapid technological changes'
        ]
      };
    } catch (error) {
      await logger.error('Failed to get competitive analysis', {
        operation: 'admin_get_competitive_analysis',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get competitive analysis');
    }
  }

  static async generateCustomReport(reportConfig: ReportConfig, adminId?: string): Promise<unknown> {
    try {
      const report = {
        id: `report_${Date.now()}`,
        name: reportConfig.name,
        type: reportConfig.type,
        data: await this.getBusinessIntelligence(reportConfig.filters),
        generatedAt: new Date(),
        generatedBy: adminId
      };

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'CUSTOM_REPORT_GENERATED',
          details: JSON.stringify({
            reportId: report.id,
            reportName: reportConfig.name,
            reportType: reportConfig.type
          }),
          timestamp: new Date()
        }
      });

      return report;
    } catch (error) {
      await logger.error('Failed to generate custom report', {
        operation: 'admin_generate_custom_report',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to generate custom report');
    }
  }

  // Helper methods for business intelligence
  private static async getUserGrowthMetrics(dateRange: { start: Date; end: Date }): Promise<unknown> {
    const [totalUsers, newUsers, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end
          }
        }
      }),
      prisma.user.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Active in last 30 days
          }
        }
      })
    ]);

    const growthRate = totalUsers > 0 ? ((newUsers / totalUsers) * 100) : 0;
    const churnRate = 2.3; // Mock churn rate

    return {
      totalUsers,
      newUsersThisMonth: newUsers,
      activeUsers,
      churnRate,
      growthRate
    };
  }

  private static async getRevenueMetrics(dateRange: { start: Date; end: Date }): Promise<unknown> {
    const revenue = await prisma.moduleSubscription.aggregate({
      _sum: {
        amount: true
      },
      where: {
        status: 'active',
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }
    });

    const totalRevenue = revenue._sum.amount || 0;
    const monthlyRecurringRevenue = totalRevenue;
    const averageRevenuePerUser = totalRevenue / 15420; // Mock user count
    const revenueGrowth = 12.5; // Mock growth rate

    return {
      totalRevenue,
      monthlyRecurringRevenue,
      averageRevenuePerUser,
      revenueGrowth,
      topRevenueSources: [
        { source: 'Premium Subscriptions', amount: totalRevenue * 0.68, percentage: 68 },
        { source: 'Module Marketplace', amount: totalRevenue * 0.20, percentage: 20 },
        { source: 'Enterprise Licenses', amount: totalRevenue * 0.12, percentage: 12 }
      ]
    };
  }

  private static async getEngagementMetrics(dateRange: { start: Date; end: Date }): Promise<unknown> {
    return {
      averageSessionDuration: 24.5,
      dailyActiveUsers: 3420,
      weeklyActiveUsers: 8923,
      monthlyActiveUsers: 15420,
      featureUsage: [
        { feature: 'Chat', usageCount: 12500, percentage: 81 },
        { feature: 'Drive', usageCount: 9800, percentage: 64 },
        { feature: 'Analytics', usageCount: 7200, percentage: 47 },
        { feature: 'Modules', usageCount: 5600, percentage: 36 }
      ]
    };
  }

  private static async getABTests(): Promise<unknown[]> {
    return [
      {
        id: '1',
        name: 'Pricing Page Redesign',
        status: 'running',
        startDate: '2024-01-15',
        variantA: {
          name: 'Control (Current)',
          users: 5000,
          conversionRate: 3.2,
          revenue: 16000
        },
        variantB: {
          name: 'New Design',
          users: 5000,
          conversionRate: 4.1,
          revenue: 20500
        },
        confidence: 95
      },
      {
        id: '2',
        name: 'Onboarding Flow',
        status: 'completed',
        startDate: '2023-12-01',
        endDate: '2024-01-15',
        variantA: {
          name: 'Original Flow',
          users: 3000,
          conversionRate: 65,
          revenue: 19500
        },
        variantB: {
          name: 'Simplified Flow',
          users: 3000,
          conversionRate: 78,
          revenue: 23400
        },
        winner: 'B',
        confidence: 99
      }
    ];
  }

  private static getDateRangeFromFilter(dateRange: string): { start: Date; end: Date } {
    const end = new Date();
    let start: Date;

    switch (dateRange) {
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  // Customer Support Methods
  static async getSupportTickets(filters: SupportTicketFilters = {}): Promise<SupportTicket[]> {
    try {
      const whereClause: any = {};
      
      // Apply filters
      if (filters.status && filters.status !== 'all') {
        whereClause.status = filters.status;
      }
      
      if (filters.priority && filters.priority !== 'all') {
        whereClause.priority = filters.priority;
      }
      
      if (filters.category && filters.category !== 'all') {
        whereClause.category = filters.category;
      }

      const tickets = await prisma.supportTicket.findMany({
        where: whereClause,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          attachments: true,
          messages: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Transform to match the expected interface
      return tickets.map(ticket => ({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status.toLowerCase() as 'open' | 'pending' | 'resolved' | 'closed',
        priority: ticket.priority.toLowerCase() as 'low' | 'medium' | 'high' | 'urgent',
        category: ticket.category,
        customer: {
          id: ticket.customer.id,
          name: ticket.customer.name || 'Unknown',
          email: ticket.customer.email,
          plan: 'premium' // TODO: Get actual plan from subscription
        },
        assignedTo: ticket.assignedTo ? {
          id: ticket.assignedTo.id,
          name: ticket.assignedTo.name || 'Unknown',
          email: ticket.assignedTo.email
        } : undefined,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        responseTime: ticket.responseTime || 0,
        satisfaction: ticket.satisfaction || undefined,
        tags: ticket.tags,
        attachments: ticket.attachments.map(att => att.filename)
      }));
    } catch (error) {
      await logger.error('Failed to get support tickets', {
        operation: 'admin_get_support_tickets',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get support tickets');
    }
  }

  static async getSupportStats(): Promise<unknown> {
    try {
      // Get real ticket counts
      const [totalTickets, openTickets, resolvedToday] = await Promise.all([
        prisma.supportTicket.count(),
        prisma.supportTicket.count({
          where: { status: 'OPEN' }
        }),
        prisma.supportTicket.count({
          where: {
            status: 'RESOLVED',
            resolvedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        })
      ]);

      // Get average response time
      const ticketsWithResponseTime = await prisma.supportTicket.findMany({
        where: {
          responseTime: { not: null }
        },
        select: { responseTime: true }
      });
      
      const averageResponseTime = ticketsWithResponseTime.length > 0
        ? ticketsWithResponseTime.reduce((sum, ticket) => sum + (ticket.responseTime || 0), 0) / ticketsWithResponseTime.length
        : 0;

      // Get average satisfaction
      const ticketsWithSatisfaction = await prisma.supportTicket.findMany({
        where: {
          satisfaction: { not: null }
        },
        select: { satisfaction: true }
      });
      
      const customerSatisfaction = ticketsWithSatisfaction.length > 0
        ? ticketsWithSatisfaction.reduce((sum, ticket) => sum + (ticket.satisfaction || 0), 0) / ticketsWithSatisfaction.length
        : 0;

      // Get top categories
      const categoryStats = await prisma.supportTicket.groupBy({
        by: ['category'],
        _count: { id: true }
      });

      const topCategories = categoryStats
        .map(stat => ({
          category: stat.category,
          count: stat._count.id,
          percentage: Math.round((stat._count.id / totalTickets) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalTickets,
        openTickets,
        resolvedToday,
        averageResponseTime: Math.round(averageResponseTime * 10) / 10,
        customerSatisfaction: Math.round(customerSatisfaction * 10) / 10,
        activeAgents: 5, // TODO: Get real agent count
        averageResolutionTime: 8.5, // TODO: Calculate from resolved tickets
        topCategories
      };
    } catch (error) {
      await logger.error('Failed to get support statistics', {
        operation: 'admin_get_support_stats',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get support stats');
    }
  }

  static async updateSupportTicket(ticketId: string, action: string, data?: Record<string, unknown>, adminId?: string): Promise<unknown> {
    try {
      let updateData: any = {
        updatedAt: new Date()
      };

      // Handle different actions
      switch (action) {
        case 'assign':
          updateData.assignedToId = adminId;
          break;
        case 'start_progress':
          updateData.status = 'IN_PROGRESS';
          break;
        case 'resolve':
          updateData.status = 'RESOLVED';
          updateData.resolvedAt = new Date();
          break;
        case 'close':
          updateData.status = 'CLOSED';
          updateData.closedAt = new Date();
          break;
        case 'update_priority':
          updateData.priority = data?.priority;
          break;
        case 'update_category':
          updateData.category = data?.category;
          break;
        case 'add_response_time':
          updateData.responseTime = data?.responseTime;
          break;
        case 'add_satisfaction':
          updateData.satisfaction = data?.satisfaction;
          break;
        default:
          // For any other action, just update the data
          if (data) {
            Object.assign(updateData, data);
          }
      }

      const ticket = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: updateData,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'SUPPORT_TICKET_UPDATED',
          details: JSON.stringify({
            ticketId,
            action,
            data
          }),
          timestamp: new Date()
        }
      });

      // Send email notifications based on action
      try {
        const emailService = new SupportTicketEmailService();
        
        switch (action) {
          case 'assign':
            await emailService.sendTicketAssignedEmail(ticketId, adminId || '');
            break;
          case 'start_progress':
            await emailService.sendTicketInProgressEmail(ticketId);
            break;
          case 'resolve':
            await emailService.sendTicketResolvedEmail(ticketId);
            break;
        }
      } catch (emailError) {
        await logger.error('Failed to send ticket update email notification', {
          operation: 'admin_send_ticket_email',
          error: {
            message: emailError instanceof Error ? emailError.message : 'Unknown error',
            stack: emailError instanceof Error ? emailError.stack : undefined
          }
        });
        // Don't fail the ticket update if email fails
      }

      return ticket;
    } catch (error) {
      await logger.error('Failed to update support ticket', {
        operation: 'admin_update_support_ticket',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to update support ticket');
    }
  }

  static async getKnowledgeBase(): Promise<KnowledgeArticle[]> {
    try {
      const articles = await prisma.knowledgeBaseArticle.findMany({
        include: {
          author: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return articles.map(article => ({
        id: article.id,
        title: article.title,
        content: article.content,
        category: article.category,
        tags: article.tags,
        author: {
          id: article.author.id,
          name: article.author.name || 'Unknown'
        },
        status: article.status.toLowerCase(),
        views: article.views,
        helpful: article.helpful,
        notHelpful: article.notHelpful,
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString()
      }));
    } catch (error) {
      await logger.error('Failed to get knowledge base', {
        operation: 'admin_get_knowledge_base',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get knowledge base');
    }
  }

  static async updateKnowledgeArticle(articleId: string, action: string, data?: Record<string, unknown>, adminId?: string): Promise<unknown> {
    try {
      const article = {
        id: articleId,
        action,
        data,
        updatedBy: adminId,
        updatedAt: new Date()
      };

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'KNOWLEDGE_ARTICLE_UPDATED',
          details: JSON.stringify({
            articleId,
            action,
            data
          }),
          timestamp: new Date()
        }
      });

      return article;
    } catch (error) {
      await logger.error('Failed to update knowledge article', {
        operation: 'admin_update_knowledge_article',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to update knowledge article');
    }
  }

  static async getLiveChats(): Promise<LiveChat[]> {
    try {
      const chats = await prisma.liveChatSession.findMany({
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          agent: {
            select: {
              id: true,
              name: true
            }
          },
          messages: {
            select: {
              id: true
            }
          }
        },
        orderBy: {
          startedAt: 'desc'
        }
      });

      return chats.map(chat => ({
        id: chat.id,
        customer: {
          id: chat.customer.id,
          name: chat.customer.name || 'Unknown',
          email: chat.customer.email
        },
        agent: chat.agent ? {
          id: chat.agent.id,
          name: chat.agent.name || 'Unknown'
        } : undefined,
        status: chat.status.toLowerCase(),
        startedAt: chat.startedAt.toISOString(),
        lastMessageAt: chat.lastMessageAt.toISOString(),
        messageCount: chat.messageCount,
        duration: chat.duration || 0
      }));
    } catch (error) {
      await logger.error('Failed to get live chats', {
        operation: 'admin_get_live_chats',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get live chats');
    }
  }

  static async joinLiveChat(chatId: string, adminId?: string): Promise<unknown> {
    try {
      const chat = {
        id: chatId,
        agentId: adminId,
        joinedAt: new Date()
      };

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'LIVE_CHAT_JOINED',
          details: JSON.stringify({
            chatId,
            agentId: adminId
          }),
          timestamp: new Date()
        }
      });

      return chat;
    } catch (error) {
      await logger.error('Failed to join live chat', {
        operation: 'admin_join_live_chat',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to join live chat');
    }
  }

  static async getSupportAnalytics(): Promise<unknown> {
    try {
      return {
        responseTime: {
          average: 2.3,
          median: 1.8,
          p95: 4.2
        },
        resolutionTime: {
          average: 8.5,
          median: 6.2,
          p95: 15.8
        },
        satisfaction: {
          average: 4.2,
          totalRatings: 145,
          distribution: {
            '5': 89,
            '4': 32,
            '3': 15,
            '2': 6,
            '1': 3
          }
        },
        volume: {
          daily: 12,
          weekly: 84,
          monthly: 342
        },
        categories: [
          { name: 'Technical', count: 45, percentage: 29 },
          { name: 'Billing', count: 32, percentage: 21 },
          { name: 'Account', count: 28, percentage: 18 },
          { name: 'Features', count: 25, percentage: 16 },
          { name: 'Other', count: 26, percentage: 16 }
        ]
      };
    } catch (error) {
      await logger.error('Failed to get support analytics', {
        operation: 'admin_get_support_analytics',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get support analytics');
    }
  }

  static async createSupportTicket(ticketData: SupportTicketData, adminId?: string): Promise<unknown> {
    try {
      const ticket = await prisma.supportTicket.create({
        data: {
          title: ticketData.title,
          description: ticketData.description,
          status: 'OPEN',
          priority: (ticketData.priority || 'MEDIUM').toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
          category: ticketData.category || 'General',
          tags: ticketData.tags || [],
          customerId: ticketData.customerId || 'unknown',
          assignedToId: adminId || null
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'SUPPORT_TICKET_CREATED',
          details: JSON.stringify({
            ticketId: ticket.id,
            title: ticketData.title,
            category: ticketData.category
          }),
          timestamp: new Date()
        }
      });

      // Send email notification for ticket creation (if customer-facing)
      if (!adminId) { // Customer-created ticket
        try {
          const emailService = new SupportTicketEmailService();
          // We could add a "ticket created" email template here
          await logger.info('Customer support ticket created', {
            operation: 'customer_create_support_ticket',
            ticketId: ticket.id
          });
        } catch (emailError) {
          await logger.error('Failed to send ticket creation email', {
            operation: 'customer_send_ticket_email',
            error: {
              message: emailError instanceof Error ? emailError.message : 'Unknown error',
              stack: emailError instanceof Error ? emailError.stack : undefined
            }
          });
        }
      }

      return ticket;
    } catch (error) {
      await logger.error('Failed to create support ticket', {
        operation: 'admin_create_support_ticket',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to create support ticket');
    }
  }

  static async createKnowledgeArticle(articleData: KnowledgeArticleData, adminId?: string): Promise<unknown> {
    try {
      const article = await prisma.knowledgeBaseArticle.create({
        data: {
          title: articleData.title,
          content: articleData.content,
          excerpt: articleData.content.substring(0, 200) + '...',
          category: articleData.category,
          tags: articleData.tags || [],
          status: (articleData.status || 'DRAFT').toUpperCase() as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
          slug: articleData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          authorId: adminId || 'unknown',
          views: 0,
          helpful: 0,
          notHelpful: 0,
          publishedAt: articleData.status === 'published' ? new Date() : null
        },
        include: {
          author: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'KNOWLEDGE_ARTICLE_CREATED',
          details: JSON.stringify({
            articleId: article.id,
            title: articleData.title,
            category: articleData.category
          }),
          timestamp: new Date()
        }
      });

      return article;
    } catch (error) {
      await logger.error('Failed to create knowledge article', {
        operation: 'admin_create_knowledge_article',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to create knowledge article');
    }
  }

  static async exportSupportData(filters: SupportTicketFilters = {}): Promise<string> {
    try {
      const tickets = await this.getSupportTickets(filters);
      const stats = await this.getSupportStats();

      // Generate CSV content
      const csvHeaders = [
        'Ticket ID',
        'Title',
        'Status',
        'Priority',
        'Category',
        'Customer',
        'Created At',
        'Response Time (hours)',
        'Satisfaction'
      ];

      const csvRows = tickets.map(ticket => [
        ticket.id,
        ticket.title,
        ticket.status,
        ticket.priority,
        ticket.category,
        ticket.customer.name,
        new Date(ticket.createdAt).toLocaleDateString(),
        ticket.responseTime || 'N/A',
        ticket.satisfaction || 'N/A'
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      await logger.error('Failed to export support data', {
        operation: 'admin_export_support_data',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to export support data');
    }
  }

  // Performance & Scalability Methods
  static async getPerformanceMetrics(filters: Record<string, unknown> = {}): Promise<unknown> {
    try {
      // In a real implementation, this would collect actual system metrics
      return {
        cpu: {
          usage: Math.floor(Math.random() * 30) + 20, // 20-50%
          cores: 8,
          temperature: Math.floor(Math.random() * 20) + 55, // 55-75°C
          loadAverage: [1.2, 1.1, 1.0]
        },
        memory: {
          total: 16384, // MB
          used: Math.floor(Math.random() * 8000) + 4000, // 4-12GB used
          available: 8192,
          swapUsed: 512,
          swapTotal: 2048
        },
        disk: {
          total: 1000000, // MB
          used: Math.floor(Math.random() * 300000) + 300000, // 300-600GB used
          available: 550000,
          iops: Math.floor(Math.random() * 1000) + 500, // 500-1500 IOPS
          latency: Math.random() * 5 + 1 // 1-6ms latency
        },
        network: {
          bytesIn: Math.floor(Math.random() * 2000000) + 500000, // 500KB-2.5MB/s
          bytesOut: Math.floor(Math.random() * 1000000) + 200000, // 200KB-1.2MB/s
          packetsIn: Math.floor(Math.random() * 20000) + 10000, // 10K-30K packets/s
          packetsOut: Math.floor(Math.random() * 15000) + 8000, // 8K-23K packets/s
          connections: Math.floor(Math.random() * 1000) + 500 // 500-1500 connections
        },
        database: {
          connections: Math.floor(Math.random() * 50) + 50, // 50-100 connections
          queries: Math.floor(Math.random() * 10000) + 5000, // 5K-15K queries/min
          slowQueries: Math.floor(Math.random() * 20) + 5, // 5-25 slow queries
          cacheHitRate: Math.floor(Math.random() * 20) + 80, // 80-100% cache hit rate
          avgResponseTime: Math.random() * 20 + 10 // 10-30ms avg response time
        },
        application: {
          responseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
          throughput: Math.floor(Math.random() * 500) + 500, // 500-1000 req/s
          errorRate: Math.random() * 0.5, // 0-0.5% error rate
          activeUsers: Math.floor(Math.random() * 1000) + 500, // 500-1500 active users
          requestsPerSecond: Math.floor(Math.random() * 50) + 25 // 25-75 req/s
        }
      };
    } catch (error) {
      await logger.error('Failed to get performance metrics', {
        operation: 'admin_get_performance_metrics',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get performance metrics');
    }
  }

  static async getScalabilityMetrics(): Promise<unknown> {
    try {
      return {
        autoScaling: {
          enabled: true,
          minInstances: 2,
          maxInstances: 10,
          currentInstances: Math.floor(Math.random() * 6) + 2, // 2-8 instances
          targetCpuUtilization: 70
        },
        loadBalancing: {
          enabled: true,
          healthyInstances: Math.floor(Math.random() * 6) + 2, // 2-8 healthy instances
          totalInstances: Math.floor(Math.random() * 6) + 2, // 2-8 total instances
          distribution: 'round-robin'
        },
        caching: {
          hitRate: Math.floor(Math.random() * 20) + 80, // 80-100% hit rate
          missRate: Math.floor(Math.random() * 20) + 0, // 0-20% miss rate
          totalRequests: Math.floor(Math.random() * 100000) + 50000, // 50K-150K requests
          cacheSize: Math.floor(Math.random() * 2048) + 1024, // 1-3GB cache size
          evictions: Math.floor(Math.random() * 200) + 50 // 50-250 evictions
        },
        database: {
          connections: Math.floor(Math.random() * 100) + 50, // 50-150 connections
          maxConnections: 200,
          replicationLag: Math.random() * 2, // 0-2s replication lag
          readReplicas: 2,
          writeReplicas: 1
        }
      };
    } catch (error) {
      await logger.error('Failed to get scalability metrics', {
        operation: 'admin_get_scalability_metrics',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get scalability metrics');
    }
  }

  static async getOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    try {
      return [
        {
          id: '1',
          type: 'performance',
          title: 'Optimize Database Queries',
          description: 'Implement query optimization and indexing to reduce database response time by 40%',
          impact: 'high',
          effort: 'medium',
          estimatedSavings: 25000,
          priority: 1,
          status: 'pending'
        },
        {
          id: '2',
          type: 'scalability',
          title: 'Enable Redis Caching',
          description: 'Implement Redis caching layer to improve response times and reduce database load',
          impact: 'high',
          effort: 'low',
          estimatedSavings: 15000,
          priority: 2,
          status: 'in_progress'
        },
        {
          id: '3',
          type: 'cost',
          title: 'Optimize Auto-scaling Configuration',
          description: 'Adjust auto-scaling thresholds to reduce unnecessary instance scaling',
          impact: 'medium',
          effort: 'low',
          estimatedSavings: 8000,
          priority: 3,
          status: 'pending'
        },
        {
          id: '4',
          type: 'performance',
          title: 'Implement CDN',
          description: 'Deploy CDN to reduce latency and improve global performance',
          impact: 'high',
          effort: 'medium',
          estimatedSavings: 12000,
          priority: 4,
          status: 'pending'
        },
        {
          id: '5',
          type: 'security',
          title: 'Enable Rate Limiting',
          description: 'Implement rate limiting to prevent abuse and improve stability',
          impact: 'medium',
          effort: 'low',
          estimatedSavings: 5000,
          priority: 5,
          status: 'completed'
        }
      ];
    } catch (error) {
      await logger.error('Failed to get optimization recommendations', {
        operation: 'admin_get_optimization_recommendations',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get optimization recommendations');
    }
  }

  static async updateOptimizationRecommendation(recommendationId: string, action: string, adminId?: string): Promise<unknown> {
    try {
      const recommendation = {
        id: recommendationId,
        action,
        updatedBy: adminId,
        updatedAt: new Date()
      };

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'OPTIMIZATION_RECOMMENDATION_UPDATED',
          details: JSON.stringify({
            recommendationId,
            action
          }),
          timestamp: new Date()
        }
      });

      return recommendation;
    } catch (error) {
      await logger.error('Failed to update optimization recommendation', {
        operation: 'admin_update_optimization_recommendation',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to update optimization recommendation');
    }
  }

  static async getPerformanceAlerts(filters: PerformanceAlertFilters = {}): Promise<PerformanceAlert[]> {
    try {
      const alerts: PerformanceAlert[] = [
        {
          id: '1',
          type: 'warning',
          title: 'High CPU Usage',
          description: 'CPU usage has exceeded 80% for the last 5 minutes',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          severity: 'medium',
          acknowledged: false,
          resolved: false
        },
        {
          id: '2',
          type: 'error',
          title: 'Database Connection Pool Exhausted',
          description: 'Database connection pool is at 95% capacity',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          severity: 'high',
          acknowledged: true,
          resolved: false
        },
        {
          id: '3',
          type: 'warning',
          title: 'Memory Usage High',
          description: 'Memory usage has reached 85% of available capacity',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          severity: 'medium',
          acknowledged: false,
          resolved: false
        },
        {
          id: '4',
          type: 'info',
          title: 'Auto-scaling Triggered',
          description: 'Auto-scaling has added 2 new instances due to high load',
          timestamp: new Date(Date.now() - 1200000).toISOString(),
          severity: 'low',
          acknowledged: true,
          resolved: true
        }
      ];

      // Apply filters
      let filteredAlerts = alerts;
      
      if (filters.severity && filters.severity !== 'all') {
        filteredAlerts = filteredAlerts.filter(alert => alert.severity === filters.severity);
      }
      
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'resolved') {
          filteredAlerts = filteredAlerts.filter(alert => alert.resolved);
        } else if (filters.status === 'active') {
          filteredAlerts = filteredAlerts.filter(alert => !alert.resolved);
        }
      }

      return filteredAlerts;
    } catch (error) {
      await logger.error('Failed to get performance alerts', {
        operation: 'admin_get_performance_alerts',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get performance alerts');
    }
  }

  static async updatePerformanceAlert(alertId: string, action: string, adminId?: string): Promise<unknown> {
    try {
      const alert = {
        id: alertId,
        action,
        updatedBy: adminId,
        updatedAt: new Date()
      };

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'PERFORMANCE_ALERT_UPDATED',
          details: JSON.stringify({
            alertId,
            action
          }),
          timestamp: new Date()
        }
      });

      return alert;
    } catch (error) {
      await logger.error('Failed to update performance alert', {
        operation: 'admin_update_performance_alert',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to update performance alert');
    }
  }

  static async getPerformanceAnalytics(): Promise<unknown> {
    try {
      return {
        trends: {
          cpu: [45, 52, 48, 55, 42, 58, 51, 47, 53, 49],
          memory: [65, 72, 68, 75, 62, 78, 71, 67, 73, 69],
          responseTime: [125, 118, 132, 115, 128, 110, 135, 120, 125, 118],
          throughput: [850, 920, 780, 950, 820, 980, 760, 890, 840, 910]
        },
        bottlenecks: [
          {
            type: 'database',
            description: 'Slow query execution',
            impact: 'high',
            frequency: 15
          },
          {
            type: 'network',
            description: 'High latency connections',
            impact: 'medium',
            frequency: 8
          },
          {
            type: 'memory',
            description: 'Memory leaks in application',
            impact: 'low',
            frequency: 3
          }
        ],
        recommendations: [
          {
            type: 'immediate',
            title: 'Add database indexes',
            impact: 'high',
            effort: 'low'
          },
          {
            type: 'short-term',
            title: 'Implement connection pooling',
            impact: 'medium',
            effort: 'medium'
          },
          {
            type: 'long-term',
            title: 'Migrate to microservices',
            impact: 'high',
            effort: 'high'
          }
        ]
      };
    } catch (error) {
      await logger.error('Failed to get performance analytics', {
        operation: 'admin_get_performance_analytics',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to get performance analytics');
    }
  }

  static async configurePerformanceAlert(alertConfig: Record<string, unknown>, adminId?: string): Promise<unknown> {
    try {
      const config = {
        id: `config_${Date.now()}`,
        ...alertConfig,
        createdBy: adminId,
        createdAt: new Date()
      };

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: adminId || 'system',
          action: 'PERFORMANCE_ALERT_CONFIGURED',
          details: JSON.stringify({
            configId: config.id,
            alertType: alertConfig.type,
            thresholds: alertConfig.thresholds
          }),
          timestamp: new Date()
        }
      });

      return config;
    } catch (error) {
      await logger.error('Failed to configure performance alert', {
        operation: 'admin_configure_performance_alert',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to configure performance alert');
    }
  }

  static async exportPerformanceData(filters: Record<string, unknown> = {}): Promise<string> {
    try {
      const metrics = await this.getPerformanceMetrics(filters);
      const alerts = await this.getPerformanceAlerts(filters);
      
      // Generate CSV content
      const csvHeaders = [
        'Metric',
        'Value',
        'Unit',
        'Timestamp'
      ];

      const csvRows = [
        ['CPU Usage', (metrics as any).cpu?.usage || 0, '%', new Date().toISOString()],
        ['Memory Usage', ((metrics as any).memory?.used / (metrics as any).memory?.total * 100).toFixed(2) || 0, '%', new Date().toISOString()],
        ['Response Time', (metrics as any).application?.responseTime || 0, 'ms', new Date().toISOString()],
        ['Throughput', (metrics as any).application?.throughput || 0, 'req/s', new Date().toISOString()],
        ['Error Rate', (metrics as any).application?.errorRate || 0, '%', new Date().toISOString()],
        ['Active Users', (metrics as any).application?.activeUsers || 0, 'users', new Date().toISOString()],
        ['Database Connections', (metrics as any).database?.connections || 0, 'connections', new Date().toISOString()],
        ['Cache Hit Rate', (metrics as any).database?.cacheHitRate || 0, '%', new Date().toISOString()]
      ];

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      await logger.error('Failed to export performance data', {
        operation: 'admin_export_performance_data',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw new Error('Failed to export performance data');
    }
  }
} 