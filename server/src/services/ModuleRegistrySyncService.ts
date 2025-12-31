/**
 * MODULE REGISTRY SYNC SERVICE
 * 
 * Keeps the Module AI Context Registry synchronized with module updates.
 * 
 * Functions:
 * - Nightly sync of all modules
 * - Real-time sync when developer updates a module
 * - Cleanup of deleted modules
 * - Version tracking and diff detection
 */

import { PrismaClient } from '@prisma/client';
import type { ModuleAIContext } from '../../../shared/src/types/module-ai-context';
import { logger } from '../lib/logger';

export class ModuleRegistrySyncService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Sync all modules in the database with the registry
   * Called by nightly cron job
   */
  async syncAllModules(): Promise<{
    success: boolean;
    added: number;
    updated: number;
    removed: number;
    errors: number;
    details: Array<{ moduleId: string; action: string; status: string; error?: string }>;
  }> {
    await logger.info('Module AI Context Registry - Full Sync starting', {
      operation: 'module_registry_sync_start'
    });

    const results = {
      success: true,
      added: 0,
      updated: 0,
      removed: 0,
      errors: 0,
      details: [] as Array<{ moduleId: string; action: string; status: string; error?: string }>,
    };

    try {
      // Step 1: Get all approved modules from database
      const modules = await this.prisma.module.findMany({
        where: {
          status: 'APPROVED',
        },
        select: {
          id: true,
          name: true,
          version: true,
          manifest: true,
        },
      });

      await logger.info('Found active modules to check', {
        operation: 'module_registry_found_modules',
        count: modules.length
      });

      // Step 2: Sync each module
      for (const module of modules) {
        try {
          const syncResult = await this.syncModule(module.id);
          
          if (syncResult.action === 'added') {
            results.added++;
            results.details.push({
              moduleId: module.id,
              action: 'added',
              status: 'success',
            });
          } else if (syncResult.action === 'updated') {
            results.updated++;
            results.details.push({
              moduleId: module.id,
              action: 'updated',
              status: 'success',
            });
          } else {
            // No change
            results.details.push({
              moduleId: module.id,
              action: 'no_change',
              status: 'success',
            });
          }
        } catch (error) {
          await logger.error('Failed to sync module', {
            operation: 'module_registry_sync_module_error',
            moduleName: module.name,
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });
          results.errors++;
          results.success = false;
          results.details.push({
            moduleId: module.id,
            action: 'error',
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Step 3: Cleanup orphaned entries (modules that were deleted)
      const cleanupResult = await this.cleanupOrphanedEntries();
      results.removed = cleanupResult.removed;

      // Summary
      await logger.info('Module registry sync summary', {
        operation: 'module_registry_sync_summary',
        added: results.added,
        updated: results.updated,
        removed: results.removed,
        errors: results.errors
      });

      if (results.errors === 0) {
        await logger.info('Module registry sync completed successfully', {
          operation: 'module_registry_sync_success'
        });
      } else {
        await logger.warn('Sync completed with errors', {
          operation: 'module_registry_sync_with_errors',
          errorCount: results.errors
        });
      }

      return results;
    } catch (error) {
      await logger.error('Fatal error during module sync', {
        operation: 'module_registry_sync_fatal',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      results.success = false;
      results.errors++;
      return results;
    }
  }

  /**
   * Sync a specific module
   * Called when a developer publishes a module update
   */
  async syncModule(moduleId: string): Promise<{
    action: 'added' | 'updated' | 'no_change' | 'skipped';
    reason?: string;
  }> {
    try {
      // Get the module from database
      const module = await this.prisma.module.findUnique({
        where: { id: moduleId },
        select: {
          id: true,
          name: true,
          version: true,
          manifest: true,
          status: true,
        },
      });

      if (!module) {
        await logger.warn('Module not found in database', {
          operation: 'module_registry_module_not_found',
          moduleId
        });
        return { action: 'skipped', reason: 'module_not_found' };
      }

      if (module.status !== 'APPROVED') {
        await logger.warn('Module is not approved', {
          operation: 'module_registry_not_approved',
          moduleName: module.name,
          status: module.status
        });
        return { action: 'skipped', reason: 'module_not_approved' };
      }

      // Extract AI context from module manifest
      const aiContext = await this.extractAIContextFromManifest(module.manifest);

      if (!aiContext) {
        await logger.warn('Module has no AI context in manifest', {
          operation: 'module_registry_no_ai_context',
          moduleName: module.name
        });
        return { action: 'skipped', reason: 'no_ai_context' };
      }

      // Check if already in registry
      const existing = await this.prisma.moduleAIContextRegistry.findUnique({
        where: { moduleId: module.id },
      });

      if (!existing) {
        // Add to registry
        await this.addModuleToRegistry(module.id, module.name, module.version, aiContext);
        await logger.info('Added module to registry', {
          operation: 'module_registry_added',
          moduleName: module.name
        });

        // Register action executor if present (non-blocking)
        await this.registerActionExecutor(module.id, module.manifest);

        return { action: 'added' };
      }

      // Check if AI context changed
      const hasChanges = this.detectChanges(existing, aiContext, module.version);

      if (!hasChanges) {
        return { action: 'no_change' };
      }

      // Update registry
      await this.updateModuleInRegistry(module.id, module.name, module.version, aiContext);
      await logger.info('Updated module in registry', {
        operation: 'module_registry_updated',
        moduleName: module.name
      });

      // Register action executor if present (non-blocking)
      await this.registerActionExecutor(module.id, module.manifest);

      return { action: 'updated' };
    } catch (error) {
      await logger.error('Failed to sync module', {
        operation: 'module_registry_sync_error',
        moduleId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Remove registry entries for deleted modules
   */
  async cleanupOrphanedEntries(): Promise<{ removed: number }> {
    try {
      await logger.info('Cleaning up orphaned registry entries', {
        operation: 'module_registry_cleanup_start'
      });

      // Get all registry entries
      const registryEntries = await this.prisma.moduleAIContextRegistry.findMany({
        select: { moduleId: true },
      });

      // Get all approved module IDs
      const approvedModules = await this.prisma.module.findMany({
        where: { status: 'APPROVED' },
        select: { id: true },
      });

      const approvedModuleIds = new Set(approvedModules.map(m => m.id));

      // Find orphaned entries
      const orphanedEntries = registryEntries.filter(
        entry => !approvedModuleIds.has(entry.moduleId)
      );

      if (orphanedEntries.length === 0) {
        await logger.info('No orphaned entries found', {
          operation: 'module_registry_cleanup_none'
        });
        return { removed: 0 };
      }

      // Remove orphaned entries
      await this.prisma.moduleAIContextRegistry.deleteMany({
        where: {
          moduleId: {
            in: orphanedEntries.map(e => e.moduleId),
          },
        },
      });

      await logger.info('Removed orphaned entries', {
        operation: 'module_registry_cleanup_removed',
        count: orphanedEntries.length
      });
      return { removed: orphanedEntries.length };
    } catch (error) {
      await logger.error('Failed to clean up orphaned entries', {
        operation: 'module_registry_cleanup_error',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      return { removed: 0 };
    }
  }

  /**
   * Get sync status and statistics
   */
  async getSyncStatus(): Promise<{
    totalModules: number;
    registeredModules: number;
    unregisteredModules: number;
    orphanedEntries: number;
    lastSync?: Date;
  }> {
    try {
      const [totalModules, registeredModules, registryEntries, approvedModules] = await Promise.all([
        this.prisma.module.count({ where: { status: 'APPROVED' } }),
        this.prisma.moduleAIContextRegistry.count(),
        this.prisma.moduleAIContextRegistry.findMany({ select: { moduleId: true } }),
        this.prisma.module.findMany({
          where: { status: 'APPROVED' },
          select: { id: true },
        }),
      ]);

      const approvedIds = new Set(approvedModules.map(m => m.id));
      const orphanedEntries = registryEntries.filter(
        entry => !approvedIds.has(entry.moduleId)
      ).length;

      const unregisteredModules = totalModules - registeredModules + orphanedEntries;

      // Get last sync time from most recent registry update
      const lastUpdated = await this.prisma.moduleAIContextRegistry.findFirst({
        orderBy: { lastUpdated: 'desc' },
        select: { lastUpdated: true },
      });

      return {
        totalModules,
        registeredModules,
        unregisteredModules,
        orphanedEntries,
        lastSync: lastUpdated?.lastUpdated,
      };
    } catch (error) {
      await logger.error('Failed to get sync status', {
        operation: 'module_registry_get_sync_status',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Extract AI context from module manifest
   */
  private async extractAIContextFromManifest(manifest: any): Promise<ModuleAIContext | null> {
    try {
      // Check if manifest has aiContext field
      if (!manifest || typeof manifest !== 'object') {
        return null;
      }

      const aiContext = manifest.aiContext || manifest.ai_context;

      if (!aiContext) {
        return null;
      }

      // Validate required fields
      if (!aiContext.purpose || !aiContext.category || !aiContext.keywords) {
        await logger.warn('Invalid AI context: missing required fields', {
          operation: 'module_registry_invalid_ai_context'
        });
        return null;
      }

      return aiContext as ModuleAIContext;
    } catch (error) {
      await logger.error('Failed to extract AI context from manifest', {
        operation: 'module_registry_extract_ai_context',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      return null;
    }
  }

  /**
   * Register action executor from module manifest (non-blocking)
   * Called after AI context is registered
   */
  private async registerActionExecutor(moduleId: string, manifest: any): Promise<void> {
    try {
      // Extract executor config from manifest
      const executorConfig = this.extractActionExecutorFromManifest(manifest);
      
      if (!executorConfig) {
        // No executor config - this is fine, not all modules need executors
        return;
      }

      // Import registry (dynamic import to avoid circular dependencies)
      const { actionExecutorRegistry } = await import('../ai/core/ActionExecutorRegistry');

      // Register the executor
      actionExecutorRegistry.register({
        moduleId,
        supportedOperations: executorConfig.supportedOperations,
        executorType: executorConfig.executorType,
        executor: executorConfig.executor,
        webhookConfig: executorConfig.webhookConfig
      });

      await logger.info('Registered action executor for module', {
        operation: 'module_registry_executor_registered',
        moduleId,
        executorType: executorConfig.executorType,
        operationCount: executorConfig.supportedOperations.length
      });
    } catch (error) {
      // Log error but don't fail the sync - executor registration is optional
      await logger.warn('Failed to register action executor', {
        operation: 'module_registry_executor_error',
        moduleId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    }
  }

  /**
   * Extract action executor configuration from module manifest
   */
  private extractActionExecutorFromManifest(manifest: any): {
    executorType: 'in-process' | 'webhook';
    supportedOperations: string[];
    executor?: any; // In-process executor function (would need to be loaded)
    webhookConfig?: {
      executorUrl: string;
      apiKey?: string;
      timeout?: number;
    };
  } | null {
    try {
      if (!manifest || typeof manifest !== 'object') {
        return null;
      }

      const executorConfig = manifest.aiActionExecutor || manifest.ai_action_executor;

      if (!executorConfig) {
        return null;
      }

      // Validate required fields
      if (!executorConfig.supportedOperations || !Array.isArray(executorConfig.supportedOperations)) {
        return null;
      }

      if (executorConfig.supportedOperations.length === 0) {
        return null;
      }

      // Check for webhook executor
      if (executorConfig.executorUrl) {
        return {
          executorType: 'webhook',
          supportedOperations: executorConfig.supportedOperations,
          webhookConfig: {
            executorUrl: executorConfig.executorUrl,
            apiKey: executorConfig.apiKey,
            timeout: executorConfig.timeout || 30000
          }
        };
      }

      // Check for in-process executor (path to executor function)
      // Note: In-process executors would need to be loaded dynamically
      // For now, we only support webhook executors from manifest
      // In-process executors would be registered directly by the module during installation
      if (executorConfig.executorPath) {
        // This would require dynamic module loading - not implemented yet
        // Modules can register in-process executors directly via API
        return null;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect if AI context has changed
   */
  private detectChanges(
    existing: any,
    newContext: ModuleAIContext,
    newVersion: string
  ): boolean {
    // Check version first (simplest check)
    if (existing.version !== newVersion) {
      return true;
    }

    // Deep comparison of key fields
    const fieldsToCheck: (keyof ModuleAIContext)[] = [
      'purpose',
      'category',
      'keywords',
      'patterns',
      'concepts',
    ];

    for (const field of fieldsToCheck) {
      const existingValue = JSON.stringify(existing[field]);
      const newValue = JSON.stringify(newContext[field]);

      if (existingValue !== newValue) {
        return true;
      }
    }

    // Check context providers (compare by name and endpoint)
    const existingProviders = JSON.stringify(existing.contextProviders);
    const newProviders = JSON.stringify(newContext.contextProviders);

    if (existingProviders !== newProviders) {
      return true;
    }

    return false;
  }

  /**
   * Add a module to the registry
   */
  private async addModuleToRegistry(
    moduleId: string,
    moduleName: string,
    version: string,
    aiContext: ModuleAIContext
  ): Promise<void> {
    await this.prisma.moduleAIContextRegistry.create({
      data: {
        moduleId,
        moduleName,
        purpose: aiContext.purpose,
        category: aiContext.category,
        keywords: aiContext.keywords,
        patterns: aiContext.patterns,
        concepts: aiContext.concepts,
        entities: aiContext.entities as any,
        actions: aiContext.actions as any,
        contextProviders: aiContext.contextProviders as any,
        relationships: (aiContext.relationships || []) as any,
        fullAIContext: aiContext as any,
        version,
      },
    });
  }

  /**
   * Update a module in the registry
   */
  private async updateModuleInRegistry(
    moduleId: string,
    moduleName: string,
    version: string,
    aiContext: ModuleAIContext
  ): Promise<void> {
    await this.prisma.moduleAIContextRegistry.update({
      where: { moduleId },
      data: {
        moduleName,
        purpose: aiContext.purpose,
        category: aiContext.category,
        keywords: aiContext.keywords,
        patterns: aiContext.patterns,
        concepts: aiContext.concepts,
        entities: aiContext.entities as any,
        actions: aiContext.actions as any,
        contextProviders: aiContext.contextProviders as any,
        relationships: (aiContext.relationships || []) as any,
        fullAIContext: aiContext as any,
        version,
        lastUpdated: new Date(),
      },
    });
  }
}

// Export singleton instance
export const moduleRegistrySyncService = new ModuleRegistrySyncService();

