import express, { Response } from 'express';
import { logger } from '../lib/logger';
import { logService } from '../services/logService';
import { AuthenticatedRequest } from '../middleware/auth';

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

export const logController = {
  // Collect client logs from frontend
  async collectClientLog(req: express.Request, res: Response): Promise<void> {
    try {
      const logEntry = req.body;
      
      // Validate log entry structure
      if (!logEntry.level || !logEntry.message || !logEntry.timestamp) {
        res.status(400).json({ error: 'Invalid log entry format' });
        return;
      }

      // Store client log
      await logService.storeClientLog(logEntry);
      
      res.status(200).json({ success: true });
    } catch (error) {
      await logger.error('Failed to collect client log', {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to collect client log' });
    }
  },

  // Get logs with filtering
  async getLogs(req: express.Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const levelParam = req.query.level;
      const serviceParam = req.query.service;
      const operationParam = req.query.operation;
      const userIdParam = req.query.userId;
      const businessIdParam = req.query.businessId;
      const moduleParam = req.query.module;
      const startDateParam = req.query.startDate;
      const endDateParam = req.query.endDate;
      const searchParam = req.query.search;
      const limitParam = req.query.limit;
      const offsetParam = req.query.offset;
      
      // Validate string parameters
      if (levelParam && typeof levelParam !== 'string') {
        res.status(400).json({ error: 'level must be a string' });
        return;
      }
      if (serviceParam && typeof serviceParam !== 'string') {
        res.status(400).json({ error: 'service must be a string' });
        return;
      }
      if (operationParam && typeof operationParam !== 'string') {
        res.status(400).json({ error: 'operation must be a string' });
        return;
      }
      if (userIdParam && typeof userIdParam !== 'string') {
        res.status(400).json({ error: 'userId must be a string' });
        return;
      }
      if (businessIdParam && typeof businessIdParam !== 'string') {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
      if (moduleParam && typeof moduleParam !== 'string') {
        res.status(400).json({ error: 'module must be a string' });
        return;
      }
      if (startDateParam && typeof startDateParam !== 'string') {
        res.status(400).json({ error: 'startDate must be a string' });
        return;
      }
      if (endDateParam && typeof endDateParam !== 'string') {
        res.status(400).json({ error: 'endDate must be a string' });
        return;
      }
      if (searchParam && typeof searchParam !== 'string') {
        res.status(400).json({ error: 'search must be a string' });
        return;
      }
      
      // Validate and parse numeric parameters
      let limit = 100;
      if (limitParam) {
        if (typeof limitParam !== 'string') {
          res.status(400).json({ error: 'limit must be a string' });
          return;
        }
        const parsedLimit = parseInt(limitParam);
        if (isNaN(parsedLimit)) {
          res.status(400).json({ error: 'limit must be a valid number' });
          return;
        }
        limit = parsedLimit;
      }
      
      let offset = 0;
      if (offsetParam) {
        if (typeof offsetParam !== 'string') {
          res.status(400).json({ error: 'offset must be a string' });
          return;
        }
        const parsedOffset = parseInt(offsetParam);
        if (isNaN(parsedOffset)) {
          res.status(400).json({ error: 'offset must be a valid number' });
          return;
        }
        offset = parsedOffset;
      }
      
      const filters: LogFilters = {
        level: levelParam as LogFilters['level'],
        service: serviceParam as LogFilters['service'],
        operation: operationParam as string | undefined,
        userId: userIdParam as string | undefined,
        businessId: businessIdParam as string | undefined,
        module: moduleParam as string | undefined,
        startDate: startDateParam as string | undefined,
        endDate: endDateParam as string | undefined,
        search: searchParam as string | undefined,
        limit,
        offset
      };

      const logs = await logService.getLogs(filters);
      
      res.json({
        logs: logs.entries,
        total: logs.total,
        hasMore: logs.hasMore
      });
    } catch (error) {
      await logger.error('Failed to get logs', {
        operation: 'get_logs',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to retrieve logs' });
    }
  },

  // Export logs
  async exportLogs(req: express.Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const levelParam = req.query.level;
      const serviceParam = req.query.service;
      const operationParam = req.query.operation;
      const userIdParam = req.query.userId;
      const businessIdParam = req.query.businessId;
      const moduleParam = req.query.module;
      const startDateParam = req.query.startDate;
      const endDateParam = req.query.endDate;
      const searchParam = req.query.search;
      const formatParam = req.query.format;
      
      // Validate string parameters
      if (levelParam && typeof levelParam !== 'string') {
        res.status(400).json({ error: 'level must be a string' });
        return;
      }
      if (serviceParam && typeof serviceParam !== 'string') {
        res.status(400).json({ error: 'service must be a string' });
        return;
      }
      if (operationParam && typeof operationParam !== 'string') {
        res.status(400).json({ error: 'operation must be a string' });
        return;
      }
      if (userIdParam && typeof userIdParam !== 'string') {
        res.status(400).json({ error: 'userId must be a string' });
        return;
      }
      if (businessIdParam && typeof businessIdParam !== 'string') {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
      if (moduleParam && typeof moduleParam !== 'string') {
        res.status(400).json({ error: 'module must be a string' });
        return;
      }
      if (startDateParam && typeof startDateParam !== 'string') {
        res.status(400).json({ error: 'startDate must be a string' });
        return;
      }
      if (endDateParam && typeof endDateParam !== 'string') {
        res.status(400).json({ error: 'endDate must be a string' });
        return;
      }
      if (searchParam && typeof searchParam !== 'string') {
        res.status(400).json({ error: 'search must be a string' });
        return;
      }
      if (formatParam && typeof formatParam !== 'string') {
        res.status(400).json({ error: 'format must be a string' });
        return;
      }
      
      const filters: LogFilters = {
        level: levelParam as LogFilters['level'],
        service: serviceParam as LogFilters['service'],
        operation: operationParam as string | undefined,
        userId: userIdParam as string | undefined,
        businessId: businessIdParam as string | undefined,
        module: moduleParam as string | undefined,
        startDate: startDateParam as string | undefined,
        endDate: endDateParam as string | undefined,
        search: searchParam as string | undefined
      };

      const format = (formatParam as string) || 'json';
      const exportData = await logService.exportLogs(filters, format);
      
      // Set appropriate headers for download
      const filename = `logs-${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.send(exportData);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.json(exportData);
      }
    } catch (error) {
      await logger.error('Failed to export logs', {
        operation: 'export_logs',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to export logs' });
    }
  },

  // Get log analytics
  async getLogAnalytics(req: express.Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const startDateParam = req.query.startDate;
      const endDateParam = req.query.endDate;
      const businessIdParam = req.query.businessId;
      
      if (startDateParam && typeof startDateParam !== 'string') {
        res.status(400).json({ error: 'startDate must be a string' });
        return;
      }
      if (endDateParam && typeof endDateParam !== 'string') {
        res.status(400).json({ error: 'endDate must be a string' });
        return;
      }
      if (businessIdParam && typeof businessIdParam !== 'string') {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
      
      const filters: LogFilters = {
        startDate: startDateParam as string | undefined,
        endDate: endDateParam as string | undefined,
        businessId: businessIdParam as string | undefined
      };

      const analytics = await logService.getLogAnalytics(filters);
      
      res.json(analytics);
    } catch (error) {
      await logger.error('Failed to get log analytics', {
        operation: 'get_log_analytics',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to retrieve log analytics' });
    }
  },

  // Get log alerts
  async getLogAlerts(req: express.Request, res: Response): Promise<void> {
    try {
      const alerts = await logService.getLogAlerts();
      
      res.json(alerts);
    } catch (error) {
      await logger.error('Failed to get log alerts', {
        operation: 'get_log_alerts',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to retrieve log alerts' });
    }
  },

  // Create log alert
  async createLogAlert(req: express.Request, res: Response): Promise<void> {
    try {
      const alertData: Omit<LogAlert, 'id' | 'createdAt' | 'updatedAt'> = req.body;
      
      const alert = await logService.createLogAlert(alertData);
      
      res.status(201).json(alert);
    } catch (error) {
      await logger.error('Failed to create log alert', {
        operation: 'create_log_alert',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to create log alert' });
    }
  },

  // Update log alert
  async updateLogAlert(req: express.Request, res: Response): Promise<void> {
    try {
      const alertId = req.params.id;
      const updateData: Partial<Omit<LogAlert, 'id' | 'createdAt'>> = req.body;
      
      const alert = await logService.updateLogAlert(alertId, updateData);
      
      res.json(alert);
    } catch (error) {
      await logger.error('Failed to update log alert', {
        operation: 'update_log_alert',
        alertId: req.params.id,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to update log alert' });
    }
  },

  // Delete log alert
  async deleteLogAlert(req: express.Request, res: Response): Promise<void> {
    try {
      const alertId = req.params.id;
      
      await logService.deleteLogAlert(alertId);
      
      res.json({
        success: true,
        message: 'Log alert deleted successfully'
      });
    } catch (error) {
      await logger.error('Failed to delete log alert', {
        operation: 'delete_log_alert',
        alertId: req.params.id,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to delete log alert' });
    }
  },

  // Cleanup old logs
  async cleanupOldLogs(req: express.Request, res: Response): Promise<void> {
    try {
      const daysToKeep = parseInt(req.body.daysToKeep as string) || 30;
      
      const result = await logService.cleanupOldLogs(daysToKeep);
      
      res.json(result);
    } catch (error) {
      await logger.error('Failed to cleanup old logs', {
        operation: 'cleanup_old_logs',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to cleanup old logs' });
    }
  },

  // Get retention settings
  async getRetentionSettings(req: express.Request, res: Response): Promise<void> {
    try {
      const settings = await logService.getRetentionSettings();
      
      res.json(settings);
    } catch (error) {
      await logger.error('Failed to get retention settings', {
        operation: 'get_retention_settings',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to retrieve retention settings' });
    }
  },

  // Update retention settings
  async updateRetentionSettings(req: express.Request, res: Response): Promise<void> {
    try {
      const settings = req.body;
      
      const updatedSettings = await logService.updateRetentionSettings(settings);
      
      res.json(updatedSettings);
    } catch (error) {
      await logger.error('Failed to update retention settings', {
        operation: 'update_retention_settings',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to update retention settings' });
    }
  },

  // Get log stream (for real-time updates)
  async getLogStream(req: express.Request, res: Response): Promise<void> {
    try {
      // This would typically be handled by WebSocket, but we can provide a polling endpoint
      const filters: LogFilters = {
        level: req.query.level as LogFilters['level'],
        service: req.query.service as LogFilters['service'],
        operation: req.query.operation as string,
        startDate: new Date(Date.now() - 60000).toISOString() // Last minute
      };

      const recentLogs = await logService.getLogs(filters);
      
      res.json({
        logs: recentLogs.entries,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      await logger.error('Failed to get log stream', {
        operation: 'get_log_stream',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ error: 'Failed to retrieve log stream' });
    }
  }
};
