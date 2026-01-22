import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { OpenAIUsageData, OpenAIBillingData } from './openAIAdminService';
import { AnthropicUsageReport, AnthropicCostReport } from './anthropicAdminService';

export interface UsageSnapshot {
  provider: 'openai' | 'anthropic';
  snapshotDate: Date;
  totalTokens: bigint;
  inputTokens: bigint;
  outputTokens: bigint;
  totalRequests: number;
  totalCost: number;
  currency: string;
  modelBreakdown: Array<{
    model: string;
    tokens: number;
    requests: number;
    cost: number;
  }>;
  hourlyData?: Array<{
    hour: number;
    tokens: number;
    requests: number;
    cost: number;
  }>;
}

export interface ExpenseSnapshot {
  provider: 'openai' | 'anthropic';
  period: 'day' | 'week' | 'month' | 'year';
  periodStart: Date;
  periodEnd: Date;
  totalCost: number;
  currency: string;
  dailyBreakdown?: Array<{
    date: string;
    cost: number;
    description: string;
  }>;
  modelBreakdown?: Array<{
    model: string;
    cost: number;
  }>;
}

export class HistoricalDataService {
  /**
   * Store usage snapshot for a provider
   */
  async storeUsageSnapshot(
    provider: 'openai' | 'anthropic',
    usageData: OpenAIUsageData | AnthropicUsageReport,
    snapshotDate: Date = new Date()
  ): Promise<void> {
    try {
      // Normalize date to start of day
      const date = new Date(snapshotDate);
      date.setHours(0, 0, 0, 0);

      const snapshot: UsageSnapshot = {
        provider,
        snapshotDate: date,
        totalTokens: BigInt(usageData.summary.totalTokens),
        inputTokens: BigInt(usageData.summary.inputTokens || 0),
        outputTokens: BigInt(usageData.summary.outputTokens || 0),
        totalRequests: usageData.summary.totalRequests,
        totalCost: usageData.summary.totalCost,
        currency: 'USD',
        modelBreakdown: usageData.byModel || []
      };

      // Convert hourly data if available (from time series)
      if (usageData.timeSeries && usageData.timeSeries.length > 0) {
        snapshot.hourlyData = usageData.timeSeries.map(item => {
          const itemDate = new Date(item.date);
          return {
            hour: itemDate.getHours(),
            tokens: item.tokens,
            requests: item.requests,
            cost: item.cost
          };
        });
      }

      // Upsert snapshot (update if exists, create if not)
      await prisma.aIProviderUsageSnapshot.upsert({
        where: {
          provider_snapshotDate: {
            provider,
            snapshotDate: date
          }
        },
        update: {
          totalTokens: snapshot.totalTokens,
          inputTokens: snapshot.inputTokens,
          outputTokens: snapshot.outputTokens,
          totalRequests: snapshot.totalRequests,
          totalCost: snapshot.totalCost,
          modelBreakdown: snapshot.modelBreakdown as any,
          hourlyData: snapshot.hourlyData as any,
          syncedAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          provider,
          snapshotDate: date,
          totalTokens: snapshot.totalTokens,
          inputTokens: snapshot.inputTokens,
          outputTokens: snapshot.outputTokens,
          totalRequests: snapshot.totalRequests,
          totalCost: snapshot.totalCost,
          modelBreakdown: snapshot.modelBreakdown as any,
          hourlyData: snapshot.hourlyData as any,
          syncedAt: new Date()
        }
      });

      logger.info('Stored usage snapshot', {
        operation: 'historical_store_usage',
        provider,
        snapshotDate: date.toISOString()
      });
    } catch (error) {
      await logger.error('Failed to store usage snapshot', {
        operation: 'historical_store_usage',
        provider,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Store expense snapshot for a provider
   */
  async storeExpenseSnapshot(
    provider: 'openai' | 'anthropic',
    expenseData: OpenAIBillingData | AnthropicCostReport,
    period: 'day' | 'week' | 'month' | 'year',
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    try {
      const snapshot: ExpenseSnapshot = {
        provider,
        period,
        periodStart,
        periodEnd,
        totalCost: expenseData.totalCost,
        currency: expenseData.currency || 'USD',
        dailyBreakdown: 'breakdown' in expenseData ? expenseData.breakdown : undefined,
        modelBreakdown: 'byModel' in expenseData ? expenseData.byModel : undefined
      };

      // Upsert expense snapshot
      await prisma.aIProviderExpenseSnapshot.upsert({
        where: {
          provider_period_periodStart: {
            provider,
            period,
            periodStart
          }
        },
        update: {
          periodEnd,
          totalCost: snapshot.totalCost,
          currency: snapshot.currency,
          dailyBreakdown: snapshot.dailyBreakdown as any,
          modelBreakdown: snapshot.modelBreakdown as any,
          syncedAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          provider,
          period,
          periodStart,
          periodEnd,
          totalCost: snapshot.totalCost,
          currency: snapshot.currency,
          dailyBreakdown: snapshot.dailyBreakdown as any,
          modelBreakdown: snapshot.modelBreakdown as any,
          syncedAt: new Date()
        }
      });

      logger.info('Stored expense snapshot', {
        operation: 'historical_store_expense',
        provider,
        period,
        periodStart: periodStart.toISOString()
      });
    } catch (error) {
      await logger.error('Failed to store expense snapshot', {
        operation: 'historical_store_expense',
        provider,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Get historical usage data for a date range
   */
  async getHistoricalUsage(
    provider: 'openai' | 'anthropic' | 'all',
    startDate: Date,
    endDate: Date
  ) {
    try {
      const where: any = {
        snapshotDate: {
          gte: startDate,
          lte: endDate
        }
      };

      if (provider !== 'all') {
        where.provider = provider;
      }

      const snapshots = await prisma.aIProviderUsageSnapshot.findMany({
        where,
        orderBy: {
          snapshotDate: 'asc'
        }
      });

      return snapshots.map(snapshot => ({
        provider: snapshot.provider,
        date: snapshot.snapshotDate.toISOString().split('T')[0],
        totalTokens: Number(snapshot.totalTokens),
        inputTokens: Number(snapshot.inputTokens),
        outputTokens: Number(snapshot.outputTokens),
        totalRequests: snapshot.totalRequests,
        totalCost: Number(snapshot.totalCost),
        currency: snapshot.currency,
        modelBreakdown: snapshot.modelBreakdown as any,
        hourlyData: snapshot.hourlyData as any
      }));
    } catch (error) {
      await logger.error('Failed to get historical usage', {
        operation: 'historical_get_usage',
        provider,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Get historical expense data for a period
   */
  async getHistoricalExpenses(
    provider: 'openai' | 'anthropic' | 'all',
    period: 'day' | 'week' | 'month' | 'year',
    startDate: Date,
    endDate: Date
  ) {
    try {
      const where: any = {
        period,
        periodStart: {
          gte: startDate,
          lte: endDate
        }
      };

      if (provider !== 'all') {
        where.provider = provider;
      }

      const snapshots = await prisma.aIProviderExpenseSnapshot.findMany({
        where,
        orderBy: {
          periodStart: 'asc'
        }
      });

      return snapshots.map(snapshot => ({
        provider: snapshot.provider,
        period: snapshot.period,
        periodStart: snapshot.periodStart.toISOString(),
        periodEnd: snapshot.periodEnd.toISOString(),
        totalCost: Number(snapshot.totalCost),
        currency: snapshot.currency,
        dailyBreakdown: snapshot.dailyBreakdown as any,
        modelBreakdown: snapshot.modelBreakdown as any
      }));
    } catch (error) {
      await logger.error('Failed to get historical expenses', {
        operation: 'historical_get_expenses',
        provider,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Get usage trends (aggregated by day/week/month)
   */
  async getUsageTrends(
    provider: 'openai' | 'anthropic' | 'all',
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ) {
    try {
      const usage = await this.getHistoricalUsage(provider, startDate, endDate);
      
      // Group by period
      const grouped = new Map<string, {
        date: string;
        tokens: number;
        requests: number;
        cost: number;
      }>();

      for (const snapshot of usage) {
        let key: string;
        const date = new Date(snapshot.date);

        if (groupBy === 'day') {
          key = snapshot.date;
        } else if (groupBy === 'week') {
          // Get start of week (Monday)
          const dayOfWeek = date.getDay();
          const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          const weekStart = new Date(date.setDate(diff));
          key = weekStart.toISOString().split('T')[0];
        } else {
          // Month
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!grouped.has(key)) {
          grouped.set(key, {
            date: key,
            tokens: 0,
            requests: 0,
            cost: 0
          });
        }

        const group = grouped.get(key)!;
        group.tokens += snapshot.totalTokens;
        group.requests += snapshot.totalRequests;
        group.cost += snapshot.totalCost;
      }

      return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      await logger.error('Failed to get usage trends', {
        operation: 'historical_get_trends',
        provider,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }
}
