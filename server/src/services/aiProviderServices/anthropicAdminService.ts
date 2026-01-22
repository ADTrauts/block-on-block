import { logger } from '../../lib/logger';

/**
 * Anthropic Admin Service
 * Pulls usage and cost data from Anthropic Usage & Cost API
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface UsageReportParams {
  startDate?: Date;
  endDate?: Date;
  workspaceId?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface AnthropicUsageReport {
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
  byWorkspace?: Array<{
    workspaceId: string;
    workspaceName?: string;
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

export interface CostReportParams {
  startDate?: Date;
  endDate?: Date;
  workspaceId?: string;
}

export interface AnthropicCostReport {
  period: string;
  totalCost: number;
  currency: string;
  breakdown: Array<{
    date: string;
    cost: number;
    description: string;
    model?: string;
    workspace?: string;
  }>;
  byModel: Array<{
    model: string;
    cost: number;
    tokens: number;
  }>;
  byWorkspace?: Array<{
    workspaceId: string;
    workspaceName?: string;
    cost: number;
  }>;
}

export interface ProjectUsage {
  projectId: string;
  projectName?: string;
  tokens: number;
  requests: number;
  cost: number;
}

export class AnthropicAdminService {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com/v1';

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn('Anthropic API key not configured - admin service will not function');
    }
  }

  /**
   * Get usage report from Anthropic Usage & Cost API
   * Endpoint: GET /v1/organizations/usage_report/messages
   */
  async getUsageReport(params: UsageReportParams): Promise<AnthropicUsageReport> {
    const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = params.endDate || new Date();

    if (!this.apiKey) {
      logger.warn('Anthropic API key not configured - returning empty usage report', {
        operation: 'anthropic_admin_get_usage_report'
      });
      return this.getEmptyUsageReport(startDate, endDate);
    }

    try {

      logger.info('Fetching Anthropic usage report', {
        operation: 'anthropic_admin_get_usage_report',
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          workspaceId: params.workspaceId
        }
      });

      try {
        // Anthropic Usage Report API
        // Endpoint: GET /v1/organizations/usage_report/messages
        // Uses starting_at and ending_at (ISO 8601 strings) and bucket_width
        const queryParams = new URLSearchParams();
        queryParams.append('starting_at', startDate.toISOString());
        queryParams.append('ending_at', endDate.toISOString());
        queryParams.append('bucket_width', '1d'); // Daily buckets
        if (params.groupBy) queryParams.append('group_by', params.groupBy);
        if (params.workspaceId) queryParams.append('workspace_id', params.workspaceId);

        const response = await fetch(
          `${this.baseUrl}/organizations/usage_report/messages?${queryParams.toString()}`,
          {
            method: 'GET',
            headers: {
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            logger.warn('Anthropic usage report endpoint not available - may need different permissions or endpoint', {
              operation: 'anthropic_admin_get_usage_report',
              status: response.status
            });
            return this.getEmptyUsageReport(startDate, endDate);
          }
          throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return this.parseAnthropicUsageReport(data, startDate, endDate);

      } catch (error) {
        logger.warn('Failed to fetch Anthropic usage report', {
          operation: 'anthropic_admin_get_usage_report',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        return this.getEmptyUsageReport(startDate, endDate);
      }

    } catch (error) {
      await logger.error('Failed to get Anthropic usage report', {
        operation: 'anthropic_admin_get_usage_report',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Get cost report from Anthropic
   * Endpoint: GET /v1/organizations/cost_report
   */
  async getCostReport(params: CostReportParams): Promise<AnthropicCostReport> {
    const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = params.endDate || new Date();

    if (!this.apiKey) {
      logger.warn('Anthropic API key not configured - returning empty cost report', {
        operation: 'anthropic_admin_get_cost_report'
      });
      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        totalCost: 0,
        currency: 'USD',
        breakdown: [],
        byModel: []
      };
    }

    try {

      logger.info('Fetching Anthropic cost report', {
        operation: 'anthropic_admin_get_cost_report',
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          workspaceId: params.workspaceId
        }
      });

      try {
        // Anthropic Cost Report API
        // Endpoint: GET /v1/organizations/cost_report
        // Uses starting_at and ending_at (ISO 8601 strings) and bucket_width
        const queryParams = new URLSearchParams();
        queryParams.append('starting_at', startDate.toISOString());
        queryParams.append('ending_at', endDate.toISOString());
        queryParams.append('bucket_width', '1d'); // Daily buckets
        if (params.workspaceId) queryParams.append('workspace_id', params.workspaceId);

        const response = await fetch(
          `${this.baseUrl}/organizations/cost_report?${queryParams.toString()}`,
          {
            method: 'GET',
            headers: {
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            logger.warn('Anthropic cost report endpoint not available', {
              operation: 'anthropic_admin_get_cost_report',
              status: response.status
            });
            return {
              period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
              totalCost: 0,
              currency: 'USD',
              breakdown: [],
              byModel: []
            };
          }
          throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        return this.parseAnthropicCostReport(data, startDate, endDate);

      } catch (error) {
        logger.warn('Failed to fetch Anthropic cost report', {
          operation: 'anthropic_admin_get_cost_report',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        return {
          period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          totalCost: 0,
          currency: 'USD',
          breakdown: [],
          byModel: []
        };
      }

    } catch (error) {
      await logger.error('Failed to get Anthropic cost report', {
        operation: 'anthropic_admin_get_cost_report',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Get workspace/project usage breakdown
   */
  async getProjectUsage(workspaceId?: string): Promise<ProjectUsage[]> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    try {
      logger.info('Fetching Anthropic project usage', {
        operation: 'anthropic_admin_get_project_usage',
        workspaceId
      });

      try {
        // Get usage report and filter by workspace if provided
        const endDate = new Date();
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const usageReport = await this.getUsageReport({
          startDate,
          endDate,
          workspaceId
        });

        // Extract project/workspace breakdown from usage report
        // Map workspaceId to projectId for ProjectUsage interface
        return (usageReport.byWorkspace || []).map(ws => ({
          projectId: ws.workspaceId,
          projectName: ws.workspaceName,
          tokens: ws.tokens || 0,
          requests: ws.requests || 0,
          cost: ws.cost || 0
        }));

      } catch (error) {
        logger.warn('Failed to get project usage', {
          operation: 'anthropic_admin_get_project_usage',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        return [];
      }

    } catch (error) {
      await logger.error('Failed to get project usage', {
        operation: 'anthropic_admin_get_project_usage',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Helper: Get empty usage report structure
   */
  private getEmptyUsageReport(startDate: Date, endDate: Date): AnthropicUsageReport {
    return {
      dateRange: { startDate, endDate },
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
   * Helper: Parse Anthropic usage report response
   */
  /**
   * Helper: Parse Anthropic usage report response
   * Anthropic API returns: { data: [{ start_time, end_time, n_requests, n_input_tokens, n_output_tokens, ... }] }
   */
  private parseAnthropicUsageReport(data: any, startDate: Date, endDate: Date): AnthropicUsageReport {
    try {
      // Anthropic returns data in a 'data' array with buckets
      const buckets = data.data || data.buckets || [];
      
      // Aggregate totals
      let totalTokens = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let totalRequests = 0;
      let totalCost = 0;
      
      // Group by model and workspace
      const modelMap = new Map<string, { tokens: number; requests: number; cost: number }>();
      const workspaceMap = new Map<string, { tokens: number; requests: number; cost: number; name?: string }>();
      
      // Process time series
      const timeSeries = buckets.map((bucket: any) => {
        const input = bucket.n_input_tokens || bucket.input_tokens || 0;
        const output = bucket.n_output_tokens || bucket.output_tokens || 0;
        const tokens = input + output;
        const requests = bucket.n_requests || bucket.requests || 0;
        
        // Calculate cost (approximate if not provided)
        // Anthropic pricing varies by model
        const cost = bucket.cost || (input * 0.000003 + output * 0.000015); // Default pricing
        
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
        
        // Group by workspace if available
        const workspaceId = bucket.workspace_id || bucket.workspaceId;
        if (workspaceId) {
          if (!workspaceMap.has(workspaceId)) {
            workspaceMap.set(workspaceId, { tokens: 0, requests: 0, cost: 0, name: bucket.workspace_name });
          }
          const wsData = workspaceMap.get(workspaceId)!;
          wsData.tokens += tokens;
          wsData.requests += requests;
          wsData.cost += cost;
        }
        
        // Format date from timestamp or ISO string
        let date: string;
        if (bucket.start_time) {
          date = typeof bucket.start_time === 'number' 
            ? new Date(bucket.start_time * 1000).toISOString().split('T')[0]
            : new Date(bucket.start_time).toISOString().split('T')[0];
        } else {
          date = new Date().toISOString().split('T')[0];
        }
        
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
      
      // Convert workspace map to array
      const byWorkspace = Array.from(workspaceMap.entries()).map(([workspaceId, data]) => ({
        workspaceId,
        workspaceName: data.name,
        tokens: data.tokens,
        requests: data.requests,
        cost: data.cost
      }));
      
      return {
        dateRange: { startDate, endDate },
        summary: {
          totalTokens,
          inputTokens,
          outputTokens,
          totalRequests,
          totalCost
        },
        byModel,
        byWorkspace,
        timeSeries
      };
    } catch (error) {
      logger.warn('Failed to parse Anthropic usage report', {
        operation: 'parse_anthropic_usage_report',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      return this.getEmptyUsageReport(startDate, endDate);
    }
  }

  /**
   * Helper: Parse Anthropic cost report response
   */
  private parseAnthropicCostReport(data: any, startDate: Date, endDate: Date): AnthropicCostReport {
    try {
      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        totalCost: data.total_cost || data.totalCost || 0,
        currency: data.currency || 'USD',
        breakdown: (data.breakdown || data.daily || []).map((item: any) => ({
          date: item.date || item.timestamp,
          cost: item.cost || 0,
          description: item.description || '',
          model: item.model,
          workspace: item.workspace
        })),
        byModel: (data.by_model || []).map((model: any) => ({
          model: model.model || model.name,
          cost: model.cost || 0,
          tokens: model.tokens || 0
        })),
        byWorkspace: (data.by_workspace || []).map((ws: any) => ({
          workspaceId: ws.workspace_id || ws.id,
          workspaceName: ws.name,
          cost: ws.cost || 0
        }))
      };
    } catch (error) {
      logger.warn('Failed to parse Anthropic cost report', {
        operation: 'parse_anthropic_cost_report',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        totalCost: 0,
        currency: 'USD',
        breakdown: [],
        byModel: []
      };
    }
  }
}
