import { logger } from '../../lib/logger';
import { OpenAIAdminService, OpenAIUsageData, OpenAIBillingData } from './openAIAdminService';
import { AnthropicAdminService, AnthropicUsageReport, AnthropicCostReport } from './anthropicAdminService';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface CombinedUsageData {
  dateRange: DateRange;
  summary: {
    totalCost: number;
    openaiCost: number;
    anthropicCost: number;
    totalTokens: number;
    totalRequests: number;
    openaiTokens: number;
    anthropicTokens: number;
  };
  byProvider: {
    openai: {
      tokens: number;
      requests: number;
      cost: number;
      models: Array<{
        model: string;
        tokens: number;
        requests: number;
        cost: number;
      }>;
    };
    anthropic: {
      tokens: number;
      requests: number;
      cost: number;
      models: Array<{
        model: string;
        tokens: number;
        requests: number;
        cost: number;
      }>;
    };
  };
  trends: {
    cost: Array<{ date: string; openai: number; anthropic: number; total: number }>;
    tokens: Array<{ date: string; openai: number; anthropic: number; total: number }>;
    requests: Array<{ date: string; openai: number; anthropic: number; total: number }>;
  };
  ourMetrics: {
    avgConfidence: number;
    userSatisfaction: number;
    avgResponseTime: number;
  };
}

export interface UsageTrends {
  period: string;
  costTrend: {
    openai: number; // percentage change
    anthropic: number;
    total: number;
  };
  tokenTrend: {
    openai: number;
    anthropic: number;
    total: number;
  };
  requestTrend: {
    openai: number;
    anthropic: number;
    total: number;
  };
}

export interface ProviderComparison {
  metric: string;
  openai: {
    value: number;
    percentage: number;
  };
  anthropic: {
    value: number;
    percentage: number;
  };
  winner: 'openai' | 'anthropic' | 'tie';
}

export class CombinedProviderService {
  private openAIAdmin: OpenAIAdminService;
  private anthropicAdmin: AnthropicAdminService;

  constructor() {
    this.openAIAdmin = new OpenAIAdminService();
    this.anthropicAdmin = new AnthropicAdminService();
  }

  /**
   * Get combined usage data from both providers
   */
  async getCombinedUsage(dateRange: DateRange): Promise<CombinedUsageData> {
    try {
      logger.info('Fetching combined provider usage', {
        operation: 'combined_provider_get_usage',
        dateRange: {
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString()
        }
      });

      // Fetch data from both providers in parallel
      const [openaiUsage, anthropicUsage] = await Promise.all([
        this.openAIAdmin.getUsageData(dateRange).catch(error => {
          logger.warn('Failed to fetch OpenAI usage', { error: error.message });
          return null;
        }),
        this.anthropicAdmin.getUsageReport({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }).catch(error => {
          logger.warn('Failed to fetch Anthropic usage', { error: error.message });
          return null;
        })
      ]);

      // Combine the data
      const combined: CombinedUsageData = {
        dateRange,
        summary: {
          totalCost: (openaiUsage?.summary.totalCost || 0) + (anthropicUsage?.summary.totalCost || 0),
          openaiCost: openaiUsage?.summary.totalCost || 0,
          anthropicCost: anthropicUsage?.summary.totalCost || 0,
          totalTokens: (openaiUsage?.summary.totalTokens || 0) + (anthropicUsage?.summary.totalTokens || 0),
          totalRequests: (openaiUsage?.summary.totalRequests || 0) + (anthropicUsage?.summary.totalRequests || 0),
          openaiTokens: openaiUsage?.summary.totalTokens || 0,
          anthropicTokens: anthropicUsage?.summary.totalTokens || 0
        },
        byProvider: {
          openai: {
            tokens: openaiUsage?.summary.totalTokens || 0,
            requests: openaiUsage?.summary.totalRequests || 0,
            cost: openaiUsage?.summary.totalCost || 0,
            models: openaiUsage?.byModel || []
          },
          anthropic: {
            tokens: anthropicUsage?.summary.totalTokens || 0,
            requests: anthropicUsage?.summary.totalRequests || 0,
            cost: anthropicUsage?.summary.totalCost || 0,
            models: anthropicUsage?.byModel || []
          }
        },
        trends: {
          cost: this.combineTimeSeries(
            openaiUsage?.timeSeries || [],
            anthropicUsage?.timeSeries || [],
            'cost'
          ),
          tokens: this.combineTimeSeries(
            openaiUsage?.timeSeries || [],
            anthropicUsage?.timeSeries || [],
            'tokens'
          ),
          requests: this.combineTimeSeries(
            openaiUsage?.timeSeries || [],
            anthropicUsage?.timeSeries || [],
            'requests'
          )
        },
        ourMetrics: {
          // TODO: Pull these from our database
          avgConfidence: 0,
          userSatisfaction: 0,
          avgResponseTime: 0
        }
      };

      return combined;

    } catch (error) {
      await logger.error('Failed to get combined usage', {
        operation: 'combined_provider_get_usage',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(period: string = '30d'): Promise<UsageTrends> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      if (period === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (period === '90d') {
        startDate.setDate(startDate.getDate() - 90);
      }

      // TODO: Calculate trends by comparing current period to previous period
      // For now, return placeholder structure
      
      return {
        period,
        costTrend: {
          openai: 0,
          anthropic: 0,
          total: 0
        },
        tokenTrend: {
          openai: 0,
          anthropic: 0,
          total: 0
        },
        requestTrend: {
          openai: 0,
          anthropic: 0,
          total: 0
        }
      };

    } catch (error) {
      await logger.error('Failed to get usage trends', {
        operation: 'combined_provider_get_trends',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Compare providers on specific metrics
   */
  async compareProviders(metrics: string[]): Promise<ProviderComparison[]> {
    try {
      const endDate = new Date();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const combined = await this.getCombinedUsage({ startDate, endDate });
      
      const comparisons: ProviderComparison[] = [];
      
      if (metrics.includes('cost')) {
        const total = combined.summary.totalCost;
        comparisons.push({
          metric: 'cost',
          openai: {
            value: combined.summary.openaiCost,
            percentage: total > 0 ? (combined.summary.openaiCost / total) * 100 : 0
          },
          anthropic: {
            value: combined.summary.anthropicCost,
            percentage: total > 0 ? (combined.summary.anthropicCost / total) * 100 : 0
          },
          winner: combined.summary.openaiCost < combined.summary.anthropicCost ? 'openai' : 
                 combined.summary.openaiCost > combined.summary.anthropicCost ? 'anthropic' : 'tie'
        });
      }
      
      if (metrics.includes('tokens')) {
        const total = combined.summary.totalTokens;
        comparisons.push({
          metric: 'tokens',
          openai: {
            value: combined.summary.openaiTokens,
            percentage: total > 0 ? (combined.summary.openaiTokens / total) * 100 : 0
          },
          anthropic: {
            value: combined.summary.anthropicTokens,
            percentage: total > 0 ? (combined.summary.anthropicTokens / total) * 100 : 0
          },
          winner: combined.summary.openaiTokens > combined.summary.anthropicTokens ? 'openai' : 
                 combined.summary.openaiTokens < combined.summary.anthropicTokens ? 'anthropic' : 'tie'
        });
      }
      
      return comparisons;

    } catch (error) {
      await logger.error('Failed to compare providers', {
        operation: 'combined_provider_compare',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Helper to combine time series data from both providers
   */
  private combineTimeSeries(
    openaiSeries: Array<{ date: string; tokens?: number; requests?: number; cost?: number }>,
    anthropicSeries: Array<{ date: string; tokens?: number; requests?: number; cost?: number }>,
    metric: 'tokens' | 'requests' | 'cost'
  ): Array<{ date: string; openai: number; anthropic: number; total: number }> {
    // Combine dates from both series
    const allDates = new Set([
      ...openaiSeries.map(s => s.date),
      ...anthropicSeries.map(s => s.date)
    ]);
    
    const combined = Array.from(allDates)
      .sort()
      .map(date => {
        const openai = openaiSeries.find(s => s.date === date)?.[metric] || 0;
        const anthropic = anthropicSeries.find(s => s.date === date)?.[metric] || 0;
        
        return {
          date,
          openai,
          anthropic,
          total: openai + anthropic
        };
      });
    
    return combined;
  }
}
