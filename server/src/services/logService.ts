import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { Prisma } from '@prisma/client';

interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  service: 'vssyl-server' | 'vssyl-web';
  environment: string;
  operation?: string;
  userId?: string;
  businessId?: string;
  module?: string;
}

interface LogFilters {
  level?: 'debug' | 'info' | 'warn' | 'error';
  service?: 'vssyl-server' | 'vssyl-web';
  operation?: string;
  userId?: string;
  businessId?: string;
  module?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface LogResult {
  entries: LogEntry[];
  total: number;
  hasMore: boolean;
}

interface LogAnalytics {
  totalLogs: number;
  errorRate: number;
  logsByLevel: Record<string, number>;
  logsByService: Record<string, number>;
  logsByOperation: Record<string, number>;
  topErrors: Array<{ message: string; count: number }>;
  performanceMetrics: {
    averageResponseTime: number;
    slowestOperations: Array<{ operation: string; avgDuration: number }>;
  };
}

interface LogAlert {
  id: string;
  name: string;
  description: string;
  conditions: {
    level?: string[];
    operation?: string[];
    message?: string;
  };
  actions: {
    email?: string[];
    webhook?: string;
    threshold?: number;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RetentionSettings {
  defaultRetentionDays: number;
  errorRetentionDays: number;
  auditRetentionDays: number;
  enabled: boolean;
  autoCleanup: boolean;
}

class LogService {
  constructor() {
    // Initialize auto-cleanup for log retention
    this.initializeAutoCleanup();
  }

  private async initializeAutoCleanup(): Promise<void> {
    try {
      // Get or create retention policy
      const policy = await this.getOrCreateRetentionPolicy();
      
      if (policy.autoCleanup) {
        setInterval(async () => {
          try {
            await this.cleanupOldLogs(policy.defaultRetentionDays);
          } catch (error) {
            // Silently fail cleanup - database might be temporarily unavailable
            console.error('[LogService] Auto-cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
          }
        }, 24 * 60 * 60 * 1000); // Run daily
      }
    } catch (error) {
      // Database might not be available during initialization
      // Log error but don't crash the service
      console.error('[LogService] Failed to initialize auto-cleanup:', error instanceof Error ? error.message : 'Unknown error');
      console.log('[LogService] Auto-cleanup will be retried on next log operation');
    }
  }

  private async getOrCreateRetentionPolicy() {
    try {
      let policy = await prisma.logRetentionPolicy.findFirst();
      
      if (!policy) {
        policy = await prisma.logRetentionPolicy.create({
          data: {
            defaultRetentionDays: 30,
            errorRetentionDays: 90,
            auditRetentionDays: 365,
            enabled: true,
            autoCleanup: true
          }
        });
      }
      
      return policy;
    } catch (error) {
      // If database is unavailable, return default policy
      console.warn('[LogService] Database unavailable, using default retention policy');
      return {
        id: 'default',
        defaultRetentionDays: 30,
        errorRetentionDays: 90,
        auditRetentionDays: 365,
        enabled: true,
        autoCleanup: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    return policy;
  }

  async storeClientLog(logEntry: Omit<LogEntry, 'id'>): Promise<void> {
    try {
      await prisma.log.create({
        data: {
          level: logEntry.level,
          message: logEntry.message,
          service: logEntry.service === 'vssyl-server' ? 'vssyl_server' : 'vssyl_web',
          operation: logEntry.operation,
          userId: logEntry.userId,
          businessId: logEntry.businessId,
          module: logEntry.module,
          metadata: logEntry.metadata as Prisma.InputJsonValue,
          environment: logEntry.environment,
          timestamp: new Date(logEntry.timestamp)
        }
      });

      await logger.info('Client log stored', {
        operation: 'store_client_log',
        level: logEntry.level,
        service: logEntry.service
      });
    } catch (error) {
      console.error('Error storing client log:', error);
      // Don't throw - logging should not break the main flow
    }
  }

  async getLogs(filters: LogFilters): Promise<LogResult> {
    try {
      const where: Prisma.LogWhereInput = {};

      if (filters.level) {
        where.level = filters.level;
      }

      if (filters.service) {
        where.service = filters.service === 'vssyl-server' ? 'vssyl_server' : 'vssyl_web';
      }

      if (filters.operation) {
        where.operation = filters.operation;
      }

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.businessId) {
        where.businessId = filters.businessId;
      }

      if (filters.module) {
        where.module = filters.module;
      }

      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) {
          where.timestamp.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.timestamp.lte = new Date(filters.endDate);
        }
      }

      if (filters.search) {
        where.OR = [
          { message: { contains: filters.search, mode: 'insensitive' } },
          { operation: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      const [logs, total] = await Promise.all([
        prisma.log.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { timestamp: 'desc' }
        }),
        prisma.log.count({ where })
      ]);

      const entries: LogEntry[] = logs.map(log => ({
        id: log.id,
        level: log.level,
        message: log.message,
        metadata: log.metadata as Record<string, unknown>,
        timestamp: log.timestamp.toISOString(),
        service: log.service === 'vssyl_server' ? 'vssyl-server' : 'vssyl-web',
        environment: log.environment,
        operation: log.operation || undefined,
        userId: log.userId || undefined,
        businessId: log.businessId || undefined,
        module: log.module || undefined
      }));

      return {
        entries,
        total,
        hasMore: offset + limit < total
      };
    } catch (error) {
      console.error('Error getting logs (returning empty):', error);
      // Return empty result if database query fails (schema mismatch)
      return {
        entries: [],
        total: 0,
        hasMore: false
      };
    }
  }

  async exportLogs(filters: LogFilters, format: string): Promise<string | LogEntry[]> {
    const result = await this.getLogs({ ...filters, limit: 10000 });

    if (format === 'csv') {
      const headers = ['Timestamp', 'Level', 'Service', 'Message', 'Operation', 'User ID', 'Business ID', 'Module'];
      const rows = result.entries.map(log => [
        log.timestamp,
        log.level,
        log.service,
        log.message,
        log.operation || '',
        log.userId || '',
        log.businessId || '',
        log.module || ''
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return csvContent;
    }

    return result.entries;
  }

  async getLogAnalytics(filters: LogFilters): Promise<LogAnalytics> {
    try {
      const where: Prisma.LogWhereInput = {};

      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) {
          where.timestamp.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.timestamp.lte = new Date(filters.endDate);
        }
      }

      if (filters.businessId) {
        where.businessId = filters.businessId;
      }

      // Get total logs
      const totalLogs = await prisma.log.count({ where });

      // Get error logs
      const errorLogs = await prisma.log.count({
        where: { ...where, level: 'error' }
      });

      const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

      // Logs by level
      const logsByLevelData = await prisma.log.groupBy({
        by: ['level'],
        where,
        _count: { level: true }
      });

      const logsByLevel = logsByLevelData.reduce((acc, item) => {
        acc[item.level] = item._count.level;
        return acc;
      }, {} as Record<string, number>);

      // Logs by service
      const logsByServiceData = await prisma.log.groupBy({
        by: ['service'],
        where,
        _count: { service: true }
      });

      const logsByService = logsByServiceData.reduce((acc, item) => {
        const serviceName = item.service === 'vssyl_server' ? 'vssyl-server' : 'vssyl-web';
        acc[serviceName] = item._count.service;
        return acc;
      }, {} as Record<string, number>);

      // Logs by operation
      const logsByOperationData = await prisma.log.groupBy({
        by: ['operation'],
        where: { ...where, operation: { not: null } },
        _count: { operation: true },
        orderBy: { _count: { operation: 'desc' } },
        take: 10
      });

      const logsByOperation = logsByOperationData.reduce((acc, item) => {
        if (item.operation) {
          acc[item.operation] = item._count.operation;
        }
        return acc;
      }, {} as Record<string, number>);

      // Top errors
      const topErrorsData = await prisma.log.groupBy({
        by: ['message'],
        where: { ...where, level: 'error' },
        _count: { message: true },
        orderBy: { _count: { message: 'desc' } },
        take: 10
      });

      const topErrors = topErrorsData.map(item => ({
        message: item.message,
        count: item._count.message
      }));

      // Performance metrics
      const performanceLogs = await prisma.log.findMany({
        where: {
          ...where,
          duration: { not: null }
        },
        select: {
          operation: true,
          duration: true
        }
      });

      const averageResponseTime = performanceLogs.length > 0
        ? performanceLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / performanceLogs.length
        : 0;

      const operationDurations = performanceLogs.reduce((acc, log) => {
        const operation = log.operation || 'unknown';
        if (!acc[operation]) {
          acc[operation] = [];
        }
        if (log.duration) {
          acc[operation].push(log.duration);
        }
        return acc;
      }, {} as Record<string, number[]>);

      const slowestOperations = Object.entries(operationDurations)
        .map(([operation, durations]) => ({
          operation,
          avgDuration: durations.reduce((sum, duration) => sum + duration, 0) / durations.length
        }))
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 10);

      return {
        totalLogs,
        errorRate,
        logsByLevel,
        logsByService,
        logsByOperation,
        topErrors,
        performanceMetrics: {
          averageResponseTime,
          slowestOperations
        }
      };
    } catch (error) {
      console.error('Error getting log analytics (returning empty):', error);
      // Return empty analytics if database query fails (schema mismatch)
      return {
        totalLogs: 0,
        errorRate: 0,
        logsByLevel: {},
        logsByService: {},
        logsByOperation: {},
        topErrors: [],
        performanceMetrics: {
          averageResponseTime: 0,
          slowestOperations: []
        }
      };
    }
  }

  async getLogAlerts(): Promise<LogAlert[]> {
    try {
      const alerts = await prisma.logAlert.findMany({
        orderBy: { createdAt: 'desc' }
      });

      return alerts.map(alert => ({
        id: alert.id,
        name: alert.name,
        description: alert.description || '',
        conditions: alert.conditions as LogAlert['conditions'],
        actions: alert.actions as LogAlert['actions'],
        enabled: alert.enabled,
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString()
      }));
    } catch (error) {
      console.error('Error getting log alerts (returning empty):', error);
      // Return empty array if database query fails (schema mismatch)
      return [];
    }
  }

  async createLogAlert(alertData: Omit<LogAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<LogAlert> {
    try {
      const alert = await prisma.logAlert.create({
        data: {
          name: alertData.name,
          description: alertData.description,
          conditions: alertData.conditions as Prisma.InputJsonValue,
          actions: alertData.actions as Prisma.InputJsonValue,
          enabled: alertData.enabled
        }
      });

      await logger.info('Log alert created', {
        operation: 'create_log_alert',
        alertId: alert.id,
        alertName: alert.name
      });

      return {
        id: alert.id,
        name: alert.name,
        description: alert.description || '',
        conditions: alert.conditions as LogAlert['conditions'],
        actions: alert.actions as LogAlert['actions'],
        enabled: alert.enabled,
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString()
      };
    } catch (error) {
      console.error('Error creating log alert:', error);
      throw error;
    }
  }

  async updateLogAlert(alertId: string, updateData: Partial<Omit<LogAlert, 'id' | 'createdAt'>>): Promise<LogAlert> {
    try {
      const data: Prisma.LogAlertUpdateInput = {};
      
      if (updateData.name) data.name = updateData.name;
      if (updateData.description !== undefined) data.description = updateData.description;
      if (updateData.conditions) data.conditions = updateData.conditions as Prisma.InputJsonValue;
      if (updateData.actions) data.actions = updateData.actions as Prisma.InputJsonValue;
      if (updateData.enabled !== undefined) data.enabled = updateData.enabled;

      const alert = await prisma.logAlert.update({
        where: { id: alertId },
        data
      });

      await logger.info('Log alert updated', {
        operation: 'update_log_alert',
        alertId: alertId
      });

      return {
        id: alert.id,
        name: alert.name,
        description: alert.description || '',
        conditions: alert.conditions as LogAlert['conditions'],
        actions: alert.actions as LogAlert['actions'],
        enabled: alert.enabled,
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString()
      };
    } catch (error) {
      console.error('Error updating log alert:', error);
      throw error;
    }
  }

  async deleteLogAlert(alertId: string): Promise<void> {
    try {
      await prisma.logAlert.delete({
        where: { id: alertId }
      });

      await logger.info('Log alert deleted', {
        operation: 'delete_log_alert',
        alertId: alertId
      });
    } catch (error) {
      console.error('Error deleting log alert:', error);
      throw error;
    }
  }

  async cleanupOldLogs(daysToKeep: number): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      const result = await prisma.log.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      await logger.info('Log cleanup completed', {
        operation: 'cleanup_old_logs',
        daysToKeep,
        deletedCount: result.count
      });

      // Update retention policy last cleanup date
      await prisma.logRetentionPolicy.updateMany({
        data: {
          lastCleanup: new Date()
        }
      });

      return { deletedCount: result.count };
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
      throw error;
    }
  }

  async getRetentionSettings(): Promise<RetentionSettings> {
    try {
      const policy = await this.getOrCreateRetentionPolicy();

      return {
        defaultRetentionDays: policy.defaultRetentionDays,
        errorRetentionDays: policy.errorRetentionDays,
        auditRetentionDays: policy.auditRetentionDays,
        enabled: policy.enabled,
        autoCleanup: policy.autoCleanup
      };
    } catch (error) {
      console.error('Error getting retention settings:', error);
      throw error;
    }
  }

  async updateRetentionSettings(settings: Partial<RetentionSettings>): Promise<RetentionSettings> {
    try {
      const policy = await this.getOrCreateRetentionPolicy();

      const data: Prisma.LogRetentionPolicyUpdateInput = {};
      if (settings.defaultRetentionDays !== undefined) data.defaultRetentionDays = settings.defaultRetentionDays;
      if (settings.errorRetentionDays !== undefined) data.errorRetentionDays = settings.errorRetentionDays;
      if (settings.auditRetentionDays !== undefined) data.auditRetentionDays = settings.auditRetentionDays;
      if (settings.enabled !== undefined) data.enabled = settings.enabled;
      if (settings.autoCleanup !== undefined) data.autoCleanup = settings.autoCleanup;

      const updatedPolicy = await prisma.logRetentionPolicy.update({
        where: { id: policy.id },
        data
      });

      await logger.info('Retention settings updated', {
        operation: 'update_retention_settings',
        settings: updatedPolicy
      });

      return {
        defaultRetentionDays: updatedPolicy.defaultRetentionDays,
        errorRetentionDays: updatedPolicy.errorRetentionDays,
        auditRetentionDays: updatedPolicy.auditRetentionDays,
        enabled: updatedPolicy.enabled,
        autoCleanup: updatedPolicy.autoCleanup
      };
    } catch (error) {
      console.error('Error updating retention settings:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const logService = new LogService();
