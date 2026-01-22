import { logger } from '../../lib/logger';

/**
 * OpenAI Admin Service
 * Pulls usage and billing data from OpenAI Admin & Audit Logs API
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface OpenAIUsageData {
  dateRange: DateRange;
  summary: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalRequests: number;
    totalCost: number;
  };
  byModel: Array<{
    model: string;
    tokens: number;
    requests: number;
    cost: number;
  }>;
  byProject?: Array<{
    projectId: string;
    projectName?: string;
    tokens: number;
    requests: number;
    cost: number;
  }>;
  byAPIKey?: Array<{
    keyId: string;
    keyName?: string;
    tokens: number;
    requests: number;
    cost: number;
  }>;
  timeSeries: Array<{
    date: string;
    tokens: number;
    requests: number;
    cost: number;
  }>;
}

export interface OpenAIBillingData {
  period: string;
  totalCost: number;
  currency: string;
  breakdown: Array<{
    date: string;
    cost: number;
    description: string;
  }>;
  invoice?: {
    invoiceId: string;
    amount: number;
    status: string;
    dueDate?: string;
  };
}

export interface OpenAIAuditLog {
  id: string;
  timestamp: string;
  actor: {
    type: string;
    id?: string;
    name?: string;
  };
  action: string;
  resource: {
    type: string;
    id?: string;
    name?: string;
  };
  metadata?: Record<string, unknown>;
}

export class OpenAIAdminService {
  private adminApiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor() {
    this.adminApiKey = process.env.OPENAI_ADMIN_API_KEY || '';
    
    if (!this.adminApiKey) {
      logger.warn('OpenAI Admin API key not configured - admin service will not function');
    }
  }

  /**
   * Get usage data from OpenAI organization
   * Note: OpenAI doesn't have a direct /organization/usage endpoint
   * We'll need to use the usage dashboard API or aggregate from audit logs
   */
  async getUsageData(dateRange: DateRange): Promise<OpenAIUsageData> {
    if (!this.adminApiKey) {
      logger.warn('OpenAI Admin API key not configured - returning empty usage data', {
        operation: 'openai_admin_get_usage'
      });
      return this.getEmptyUsageData(dateRange);
    }

    try {
      // OpenAI's organization usage endpoints require specific structure
      // For now, we'll fetch what's available via admin API
      // This may need adjustment based on actual OpenAI API structure
      
      const startDate = dateRange.startDate.toISOString().split('T')[0];
      const endDate = dateRange.endDate.toISOString().split('T')[0];

      logger.info('Fetching OpenAI usage data', {
        operation: 'openai_admin_get_usage',
        dateRange: { startDate, endDate }
      });

      // OpenAI Usage API - organization-level usage data
      // Endpoint: GET /v1/organization/usage/completions
      // Uses Unix timestamps (seconds) for start_time and end_time
      try {
        const startTime = Math.floor(dateRange.startDate.getTime() / 1000);
        const endTime = Math.floor(dateRange.endDate.getTime() / 1000);
        
        // OpenAI Usage API endpoint
        const response = await fetch(
          `${this.baseUrl}/organization/usage/completions?start_time=${startTime}&end_time=${endTime}&bucket_width=1d`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.adminApiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Organization': process.env.OPENAI_ORG_ID || ''
            }
          }
        );

        if (!response.ok) {
          // If endpoint doesn't exist, log warning and return empty data
          if (response.status === 404) {
            logger.warn('OpenAI usage endpoint not available - may need different endpoint structure', {
              operation: 'openai_admin_get_usage',
              status: response.status
            });
            return this.getEmptyUsageData(dateRange);
          }
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Parse OpenAI response format
        // OpenAI may return data in different structures - adapt as needed
        return this.parseOpenAIUsageResponse(data, dateRange);

      } catch (error) {
        // If API call fails, return empty structure with warning
        logger.warn('Failed to fetch OpenAI usage data - returning empty structure', {
          operation: 'openai_admin_get_usage',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        return this.getEmptyUsageData(dateRange);
      }

    } catch (error) {
      await logger.error('Failed to get OpenAI usage data', {
        operation: 'openai_admin_get_usage',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Get billing/cost data from OpenAI
   */
  async getBillingData(period: string = 'month'): Promise<OpenAIBillingData> {
    if (!this.adminApiKey) {
      logger.warn('OpenAI Admin API key not configured - returning empty billing data', {
        operation: 'openai_admin_get_billing'
      });
      return {
        period,
        totalCost: 0,
        currency: 'USD',
        breakdown: []
      };
    }

    try {
      logger.info('Fetching OpenAI billing data', {
        operation: 'openai_admin_get_billing',
        period
      });

      try {
        // OpenAI Billing API - fetch cost/billing data
        // Note: OpenAI may not have a direct billing endpoint
        // We'll use the usage endpoint and calculate costs, or use subscription endpoint
        // For now, we'll fetch usage data and calculate costs from it
        const endDate = new Date();
        const startDate = new Date();
        if (period === 'month') {
          startDate.setMonth(startDate.getMonth() - 1);
        } else if (period === 'week') {
          startDate.setDate(startDate.getDate() - 7);
        }
        
        // Fetch usage data and calculate billing from it
        const usageData = await this.getUsageData({ startDate, endDate });
        
        return {
          period,
          totalCost: usageData.summary.totalCost,
          currency: 'USD',
          breakdown: usageData.timeSeries.map(item => ({
            date: item.date,
            cost: item.cost,
            description: `Usage on ${item.date}`
          }))
        };

      } catch (error) {
        logger.warn('Failed to fetch OpenAI billing data', {
          operation: 'openai_admin_get_billing',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        return {
          period,
          totalCost: 0,
          currency: 'USD',
          breakdown: []
        };
      }

    } catch (error) {
      await logger.error('Failed to get OpenAI billing data', {
        operation: 'openai_admin_get_billing',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Get audit logs from OpenAI
   */
  async getAuditLogs(filters?: {
    startDate?: Date;
    endDate?: Date;
    action?: string;
    limit?: number;
  }): Promise<OpenAIAuditLog[]> {
    if (!this.adminApiKey) {
      throw new Error('OpenAI Admin API key not configured');
    }

    try {
      logger.info('Fetching OpenAI audit logs', {
        operation: 'openai_admin_get_audit_logs',
        filters
      });

      try {
        // OpenAI Audit Logs API
        const params = new URLSearchParams();
        if (filters?.startDate) params.append('start_date', filters.startDate.toISOString());
        if (filters?.endDate) params.append('end_date', filters.endDate.toISOString());
        if (filters?.action) params.append('action', filters.action);
        if (filters?.limit) params.append('limit', filters.limit.toString());

        const response = await fetch(
          `${this.baseUrl}/organization/audit_logs?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.adminApiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Organization': process.env.OPENAI_ORG_ID || ''
            }
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            logger.warn('OpenAI audit logs endpoint not available - may need different permissions', {
              operation: 'openai_admin_get_audit_logs',
              status: response.status
            });
            return [];
          }
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return this.parseOpenAIAuditLogs(data);

      } catch (error) {
        logger.warn('Failed to fetch OpenAI audit logs', {
          operation: 'openai_admin_get_audit_logs',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        return [];
      }

    } catch (error) {
      await logger.error('Failed to get OpenAI audit logs', {
        operation: 'openai_admin_get_audit_logs',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Get API key usage breakdown
   */
  async getAPIKeyUsage(apiKeyId?: string): Promise<Array<{
    keyId: string;
    keyName?: string;
    tokens: number;
    requests: number;
    cost: number;
  }>> {
    if (!this.adminApiKey) {
      throw new Error('OpenAI Admin API key not configured');
    }

    try {
      logger.info('Fetching OpenAI API key usage', {
        operation: 'openai_admin_get_api_key_usage',
        apiKeyId
      });

      try {
        // Get usage data and aggregate by API key
        const endDate = new Date();
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const usageData = await this.getUsageData({ startDate, endDate });
        
        // Extract API key usage from usage data
        // OpenAI may return this grouped by key or we may need to aggregate
        return usageData.byAPIKey || [];

      } catch (error) {
        logger.warn('Failed to get API key usage', {
          operation: 'openai_admin_get_api_key_usage',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        return [];
      }

    } catch (error) {
      await logger.error('Failed to get API key usage', {
        operation: 'openai_admin_get_api_key_usage',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Helper: Get empty usage data structure
   */
  private getEmptyUsageData(dateRange: DateRange): OpenAIUsageData {
    return {
      dateRange,
      summary: {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalRequests: 0,
        totalCost: 0
      },
      byModel: [],
      timeSeries: []
    };
  }

  /**
   * Helper: Parse OpenAI usage response
   * OpenAI API returns: { data: [{ start_time, end_time, n_requests, n_input_tokens, n_output_tokens, ... }] }
   */
  private parseOpenAIUsageResponse(data: any, dateRange: DateRange): OpenAIUsageData {
    try {
      // OpenAI returns data in a 'data' array with buckets
      const buckets = data.data || data.buckets || [];
      
      // Aggregate totals
      let totalTokens = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let totalRequests = 0;
      let totalCost = 0;
      
      // Group by model
      const modelMap = new Map<string, { tokens: number; requests: number; cost: number }>();
      
      // Process time series
      const timeSeries = buckets.map((bucket: any) => {
        const input = bucket.n_input_tokens || bucket.input_tokens || 0;
        const output = bucket.n_output_tokens || bucket.output_tokens || 0;
        const tokens = input + output;
        const requests = bucket.n_requests || bucket.requests || 0;
        
        // Calculate cost (approximate if not provided)
        // OpenAI pricing varies by model, but we'll use a default if cost not provided
        const cost = bucket.cost || (input * 0.000005 + output * 0.000015); // Default pricing
        
        totalTokens += tokens;
        inputTokens += input;
        outputTokens += output;
        totalRequests += requests;
        totalCost += cost;
        
        // Group by model if available
        const model = bucket.model || 'unknown';
        if (!modelMap.has(model)) {
          modelMap.set(model, { tokens: 0, requests: 0, cost: 0 });
        }
        const modelData = modelMap.get(model)!;
        modelData.tokens += tokens;
        modelData.requests += requests;
        modelData.cost += cost;
        
        // Format date from timestamp
        const date = bucket.start_time 
          ? new Date(bucket.start_time * 1000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        
        return {
          date,
          tokens,
          requests,
          cost
        };
      });
      
      // Convert model map to array
      const byModel = Array.from(modelMap.entries()).map(([model, data]) => ({
        model,
        tokens: data.tokens,
        requests: data.requests,
        cost: data.cost
      }));
      
      return {
        dateRange,
        summary: {
          totalTokens,
          inputTokens,
          outputTokens,
          totalRequests,
          totalCost
        },
        byModel,
        timeSeries
      };
    } catch (error) {
      logger.warn('Failed to parse OpenAI usage response', {
        operation: 'parse_openai_usage',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      return this.getEmptyUsageData(dateRange);
    }
  }

  /**
   * Helper: Parse OpenAI billing response
   */
  private parseOpenAIBillingResponse(data: any, period: string): OpenAIBillingData {
    try {
      return {
        period,
        totalCost: data.total_cost || data.totalCost || 0,
        currency: data.currency || 'USD',
        breakdown: (data.breakdown || data.daily || []).map((item: any) => ({
          date: item.date || item.timestamp,
          cost: item.cost || 0,
          description: item.description || ''
        })),
        invoice: data.invoice ? {
          invoiceId: data.invoice.id || data.invoice.invoice_id,
          amount: data.invoice.amount || 0,
          status: data.invoice.status || 'unknown',
          dueDate: data.invoice.due_date
        } : undefined
      };
    } catch (error) {
      logger.warn('Failed to parse OpenAI billing response', {
        operation: 'parse_openai_billing',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      return {
        period,
        totalCost: 0,
        currency: 'USD',
        breakdown: []
      };
    }
  }

  /**
   * Helper: Parse OpenAI audit logs response
   */
  private parseOpenAIAuditLogs(data: any): OpenAIAuditLog[] {
    try {
      const logs = data.logs || data.data || data || [];
      return logs.map((log: any) => ({
        id: log.id || '',
        timestamp: log.timestamp || log.created_at || new Date().toISOString(),
        actor: {
          type: log.actor?.type || 'unknown',
          id: log.actor?.id,
          name: log.actor?.name
        },
        action: log.action || '',
        resource: {
          type: log.resource?.type || 'unknown',
          id: log.resource?.id,
          name: log.resource?.name
        },
        metadata: log.metadata || {}
      }));
    } catch (error) {
      logger.warn('Failed to parse OpenAI audit logs', {
        operation: 'parse_openai_audit_logs',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      return [];
    }
  }
}
