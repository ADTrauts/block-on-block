// Enhanced structured logging utility for production monitoring
// Integrates with Google Cloud Logging for centralized log management
// Also stores logs in PostgreSQL database for long-term analysis

import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMetadata {
  userId?: string;
  operation?: string;
  context?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  businessId?: string;
  dashboardId?: string;
  module?: string;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
  timestamp: string;
  service: 'vssyl-server';
  environment: string;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private formatLog(level: LogLevel, message: string, metadata?: LogMetadata): LogEntry {
    return {
      level,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      service: 'vssyl-server',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  private logToConsole(entry: LogEntry): void {
    const { level, message, metadata, timestamp } = entry;
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (metadata && Object.keys(metadata).length > 0) {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        prefix, message, metadata
      );
    } else {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        prefix, message
      );
    }
  }

  private async logToDatabase(entry: LogEntry): Promise<void> {
    try {
      // Skip database logging if database is not configured or accessible
      if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('password@localhost')) {
        return; // Silently skip if database URL is placeholder or not configured
      }
      
      // Store log in database for long-term analysis
      await prisma.log.create({
        data: {
          level: entry.level,
          message: entry.message,
          service: 'vssyl_server',
          operation: entry.metadata?.operation as string | undefined,
          userId: entry.metadata?.userId as string | undefined,
          businessId: entry.metadata?.businessId as string | undefined,
          module: entry.metadata?.module as string | undefined,
          metadata: entry.metadata as Prisma.InputJsonValue,
          ipAddress: entry.metadata?.ipAddress as string | undefined,
          userAgent: entry.metadata?.userAgent as string | undefined,
          requestId: entry.metadata?.requestId as string | undefined,
          duration: entry.metadata?.duration as number | undefined,
          errorStack: entry.metadata?.error?.stack as string | undefined,
          environment: entry.environment,
          timestamp: new Date(entry.timestamp)
        }
      });
    } catch (error) {
      // Check if it's a database connection error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes("Can't reach database") || 
          errorMessage.includes('localhost:5432') ||
          errorMessage.includes('empty host') ||
          errorMessage.includes('database string is invalid') ||
          errorMessage.includes('PrismaClientInitializationError')) {
        // Silently skip if database is not available - logs will still go to console
        return;
      }
      // Only log non-connection errors (schema issues, etc.)
      console.error('Failed to log to database:', error);
    }
  }

  private async logToGoogleCloud(entry: LogEntry): Promise<void> {
    if (!this.isProduction) return;

    try {
      // In production, logs will be automatically captured by Google Cloud Logging
      // when running on Cloud Run with Application Default Credentials
      // This method is a placeholder for future direct API integration if needed
      
      // For now, structured console logs are automatically captured by Cloud Logging
      this.logToConsole(entry);
    } catch (error) {
      // Fallback to console if Google Cloud Logging fails
      console.error('Failed to log to Google Cloud:', error);
      this.logToConsole(entry);
    }
  }

  private async log(level: LogLevel, message: string, metadata?: LogMetadata): Promise<void> {
    const entry = this.formatLog(level, message, metadata);

    // Always log to console
    this.logToConsole(entry);

    // Store in database (async, non-blocking)
    this.logToDatabase(entry).catch(err => {
      console.error('Database logging failed:', err);
    });

    // In production, also send to Google Cloud Logging
    if (this.isProduction) {
      await this.logToGoogleCloud(entry);
    }
  }

  // Public logging methods
  async debug(message: string, metadata?: LogMetadata): Promise<void> {
    if (this.isDevelopment) {
      await this.log('debug', message, metadata);
    }
  }

  async info(message: string, metadata?: LogMetadata): Promise<void> {
    await this.log('info', message, metadata);
  }

  async warn(message: string, metadata?: LogMetadata): Promise<void> {
    await this.log('warn', message, metadata);
  }

  async error(message: string, metadata?: LogMetadata): Promise<void> {
    await this.log('error', message, metadata);
  }

  // Convenience methods for common operations
  async logUserAction(userId: string, action: string, metadata?: Omit<LogMetadata, 'userId' | 'operation'>): Promise<void> {
    await this.info(`User action: ${action}`, {
      userId,
      operation: action,
      ...metadata
    });
  }

  async logApiRequest(
    method: string, 
    path: string, 
    userId?: string, 
    duration?: number, 
    statusCode?: number,
    metadata?: LogMetadata
  ): Promise<void> {
    const level = statusCode && statusCode >= 400 ? 'warn' : 'info';
    await this.log(level, `API ${method} ${path}`, {
      operation: 'api_request',
      method,
      path,
      userId,
      duration,
      statusCode,
      ...metadata
    });
  }

  async logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: LogMetadata): Promise<void> {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    await this.log(level, `Security event: ${event}`, {
      operation: 'security_event',
      securityEvent: event,
      severity,
      ...metadata
    });
  }

  async logDatabaseOperation(operation: string, table: string, duration?: number, metadata?: LogMetadata): Promise<void> {
    await this.info(`Database ${operation} on ${table}`, {
      operation: 'database_operation',
      dbOperation: operation,
      table,
      duration,
      ...metadata
    });
  }

  async logFileOperation(operation: string, filePath: string, userId?: string, metadata?: LogMetadata): Promise<void> {
    await this.info(`File ${operation}: ${filePath}`, {
      operation: 'file_operation',
      fileOperation: operation,
      filePath,
      userId,
      ...metadata
    });
  }

  async logBusinessAction(businessId: string, action: string, userId?: string, metadata?: LogMetadata): Promise<void> {
    await this.info(`Business action: ${action}`, {
      operation: 'business_action',
      businessId,
      action,
      userId,
      ...metadata
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for use in other files
export type { LogEntry };
