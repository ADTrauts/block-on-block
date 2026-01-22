import { logger } from '../../lib/logger';
import { OpenAIAdminService } from './openAIAdminService';
import { AnthropicAdminService } from './anthropicAdminService';
import { CombinedProviderService } from './combinedProviderService';
import { HistoricalDataService } from './historicalDataService';

/**
 * Provider Sync Service
 * Regularly syncs usage and expense data from AI providers
 */
export class ProviderSyncService {
  private openAIAdmin: OpenAIAdminService;
  private anthropicAdmin: AnthropicAdminService;
  private combinedService: CombinedProviderService;
  private historicalService: HistoricalDataService;
  private lastSyncTimestamp: Date | null = null;
  private syncInProgress: boolean = false;

  constructor() {
    this.openAIAdmin = new OpenAIAdminService();
    this.anthropicAdmin = new AnthropicAdminService();
    this.combinedService = new CombinedProviderService();
    this.historicalService = new HistoricalDataService();
  }

  /**
   * Sync provider data from both OpenAI and Anthropic
   * This should be called regularly (daily/hourly) to keep data fresh
   */
  async syncProviderData(): Promise<void> {
    // Prevent concurrent syncs
    if (this.syncInProgress) {
      logger.warn('Provider sync already in progress, skipping', {
        operation: 'provider_sync_check'
      });
      return;
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      logger.info('Starting provider data sync', {
        operation: 'provider_sync_start',
        timestamp: new Date().toISOString()
      });

      // Calculate date range (last 30 days for historical data)
      const endDate = new Date();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Fetch data from both providers in parallel
      const [openaiUsage, anthropicUsage, openaiBilling, anthropicCost] = await Promise.all([
        this.openAIAdmin.getUsageData({ startDate, endDate }).catch(error => {
          logger.warn('Failed to sync OpenAI usage data', {
            operation: 'provider_sync_openai_usage',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });
          return null;
        }),
        this.anthropicAdmin.getUsageReport({ startDate, endDate }).catch(error => {
          logger.warn('Failed to sync Anthropic usage data', {
            operation: 'provider_sync_anthropic_usage',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });
          return null;
        }),
        this.openAIAdmin.getBillingData('month').catch(error => {
          logger.warn('Failed to sync OpenAI billing data', {
            operation: 'provider_sync_openai_billing',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });
          return null;
        }),
        this.anthropicAdmin.getCostReport({ startDate, endDate }).catch(error => {
          logger.warn('Failed to sync Anthropic cost data', {
            operation: 'provider_sync_anthropic_cost',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });
          return null;
        })
      ]);

      // Store historical data in database
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Store usage snapshots
      if (openaiUsage) {
        await this.historicalService.storeUsageSnapshot('openai', openaiUsage, today).catch(error => {
          logger.warn('Failed to store OpenAI usage snapshot', {
            operation: 'provider_sync_store_openai',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        });
      }

      if (anthropicUsage) {
        await this.historicalService.storeUsageSnapshot('anthropic', anthropicUsage, today).catch(error => {
          logger.warn('Failed to store Anthropic usage snapshot', {
            operation: 'provider_sync_store_anthropic',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        });
      }

      // Store expense snapshots
      if (openaiBilling) {
        const periodStart = new Date();
        periodStart.setMonth(periodStart.getMonth() - 1);
        const periodEnd = new Date();
        
        await this.historicalService.storeExpenseSnapshot(
          'openai',
          openaiBilling,
          'month',
          periodStart,
          periodEnd
        ).catch(error => {
          logger.warn('Failed to store OpenAI expense snapshot', {
            operation: 'provider_sync_store_openai_expense',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        });
      }

      if (anthropicCost) {
        const periodStart = new Date(startDate);
        const periodEnd = new Date(endDate);
        
        await this.historicalService.storeExpenseSnapshot(
          'anthropic',
          anthropicCost,
          'month',
          periodStart,
          periodEnd
        ).catch(error => {
          logger.warn('Failed to store Anthropic expense snapshot', {
            operation: 'provider_sync_store_anthropic_expense',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        });
      }

      // Calculate summary statistics
      const syncSummary = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        openai: {
          usageSynced: openaiUsage !== null,
          billingSynced: openaiBilling !== null,
          totalTokens: openaiUsage?.summary.totalTokens || 0,
          totalCost: openaiBilling?.totalCost || 0
        },
        anthropic: {
          usageSynced: anthropicUsage !== null,
          costSynced: anthropicCost !== null,
          totalTokens: anthropicUsage?.summary.totalTokens || 0,
          totalCost: anthropicCost?.totalCost || 0
        }
      };

      this.lastSyncTimestamp = new Date();

      logger.info('Provider data sync completed', {
        operation: 'provider_sync_complete',
        summary: syncSummary
      });

    } catch (error) {
      await logger.error('Provider data sync failed', {
        operation: 'provider_sync_error',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTimestamp(): Date | null {
    return this.lastSyncTimestamp;
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Force sync (useful for manual triggers)
   */
  async forceSync(): Promise<void> {
    this.syncInProgress = false; // Reset flag
    return this.syncProviderData();
  }
}
