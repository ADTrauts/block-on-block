import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper function to get user from request
const getUserFromRequest = (req: Request) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return null;
  return user;
};

// Get user's personal audit logs
export const getPersonalAuditLogs = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { 
      page = 1, 
      limit = 50, 
      action, 
      resourceType, 
      startDate, 
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId: user.id
    };

    if (action) {
      where.action = action;
    }

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate as string);
      }
    }

    // Build order by clause
    const orderBy: Record<string, unknown> = {};
    if (sortBy === 'action') {
      orderBy.action = sortOrder;
    } else if (sortBy === 'resourceType') {
      orderBy.resourceType = sortOrder;
    } else {
      orderBy.timestamp = sortOrder;
    }

    // Get audit logs
    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: Number(limit),
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    // Process audit logs to mask sensitive data
    const processedLogs = auditLogs.map(log => ({
      ...log,
      details: maskSensitiveData(log.details),
      ipAddress: log.ipAddress ? maskIPAddress(log.ipAddress) : null
    }));

    res.json({
      success: true,
      data: {
        auditLogs: processedLogs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error getting personal audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit logs' });
  }
};

// Export user's personal audit logs
export const exportPersonalAuditLogs = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { 
      format = 'json',
      action, 
      resourceType, 
      startDate, 
      endDate 
    } = req.query;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId: user.id
    };

    if (action) {
      where.action = action;
    }

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate as string);
      }
    }

    // Get all audit logs for export
    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Process audit logs to mask sensitive data
    const processedLogs = auditLogs.map(log => ({
      ...log,
      details: maskSensitiveData(log.details),
      ipAddress: log.ipAddress ? maskIPAddress(log.ipAddress) : null
    }));

    if (format === 'csv') {
      // Generate CSV
      const csvData = generateCSV(processedLogs);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: {
          auditLogs: processedLogs,
          exportInfo: {
            exportedAt: new Date().toISOString(),
            totalRecords: processedLogs.length,
            format: 'json'
          }
        }
      });
    }
  } catch (error) {
    console.error('Error exporting personal audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to export audit logs' });
  }
};

// Get audit log statistics for user
export const getPersonalAuditStats = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { startDate, endDate } = req.query;

    // Build date filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) {
        dateFilter.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.timestamp.lte = new Date(endDate as string);
      }
    }

    // Get statistics
    const [totalActions, actionBreakdown, resourceBreakdown, recentActivity] = await Promise.all([
      // Total actions
      prisma.auditLog.count({
        where: {
          userId: user.id,
          ...dateFilter
        }
      }),
      // Action breakdown
      prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          userId: user.id,
          ...dateFilter
        },
        _count: {
          action: true
        }
      }),
      // Resource type breakdown
      prisma.auditLog.groupBy({
        by: ['resourceType'],
        where: {
          userId: user.id,
          ...dateFilter
        },
        _count: {
          resourceType: true
        }
      }),
      // Recent activity (last 7 days)
      prisma.auditLog.count({
        where: {
          userId: user.id,
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalActions,
        actionBreakdown: actionBreakdown.map(item => ({
          action: item.action,
          count: item._count.action
        })),
        resourceBreakdown: resourceBreakdown.map(item => ({
          resourceType: item.resourceType,
          count: item._count.resourceType
        })),
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error getting personal audit stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit statistics' });
  }
};

// Helper function to mask sensitive data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const maskSensitiveData = (details: any): Record<string, unknown> => {
  if (!details) return details;

  const masked = { ...details };

  // Mask sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'content'];
  sensitiveFields.forEach(field => {
    if (masked[field]) {
      masked[field] = '[REDACTED]';
    }
  });

  return masked;
};

// Helper function to mask IP addresses
const maskIPAddress = (ip: string): string => {
  if (!ip) return ip;
  
  // Keep first two octets, mask the rest
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  
  return ip;
};

// Interface for audit log CSV export
interface AuditLogData {
  timestamp: Date | string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
  [key: string]: unknown;
}

// Helper function to generate CSV
const generateCSV = (auditLogs: AuditLogData[]): string => {
  const headers = ['Timestamp', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'User Agent', 'Details'];
  
  const rows = auditLogs.map(log => [
    log.timestamp,
    log.action,
    log.resourceType || '',
    log.resourceId || '',
    log.ipAddress || '',
    log.userAgent || '',
    JSON.stringify(log.details || {})
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  return csvContent;
}; 