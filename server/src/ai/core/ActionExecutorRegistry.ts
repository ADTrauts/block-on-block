/**
 * ACTION EXECUTOR REGISTRY
 * 
 * Runtime registry for third-party module action executors.
 * Allows modules to register their executor functions or webhook URLs
 * so the AI can execute actions in their modules.
 * 
 * This is an in-memory registry that gets populated when modules
 * are approved and synced via ModuleRegistrySyncService.
 */

import { AIAction, UserContext } from './DigitalLifeTwinService';
import { ActionExecutionResult } from './ActionExecutor';

/**
 * Configuration for webhook-based executors (external modules)
 */
export interface WebhookExecutorConfig {
  executorUrl: string;
  apiKey?: string;
  timeout?: number; // milliseconds, default 30000
}

/**
 * In-process executor function (for modules installed in codebase)
 */
export type InProcessExecutor = (
  action: AIAction,
  userContext: UserContext
) => Promise<ActionExecutionResult>;

/**
 * Module action executor definition
 */
export interface ModuleActionExecutor {
  moduleId: string;
  supportedOperations: string[];
  executorType: 'in-process' | 'webhook';
  executor?: InProcessExecutor; // For in-process modules
  webhookConfig?: WebhookExecutorConfig; // For external modules
  registeredAt: Date;
}

/**
 * Action Executor Registry
 * 
 * Singleton service that manages registered action executors for third-party modules.
 * Built-in modules are handled directly in ActionExecutor, not through this registry.
 */
export class ActionExecutorRegistry {
  private executors: Map<string, ModuleActionExecutor> = new Map();

  /**
   * Register an action executor for a module
   * Called during module sync when module is approved
   */
  register(executor: Omit<ModuleActionExecutor, 'registeredAt'>): void {
    const fullExecutor: ModuleActionExecutor = {
      ...executor,
      registeredAt: new Date()
    };

    // Validate executor
    if (!executor.moduleId) {
      throw new Error('Module ID is required');
    }

    if (!executor.supportedOperations || executor.supportedOperations.length === 0) {
      throw new Error('At least one supported operation is required');
    }

    if (executor.executorType === 'in-process' && !executor.executor) {
      throw new Error('In-process executor requires executor function');
    }

    if (executor.executorType === 'webhook' && !executor.webhookConfig?.executorUrl) {
      throw new Error('Webhook executor requires executorUrl');
    }

    this.executors.set(executor.moduleId, fullExecutor);
    console.log(`✅ Registered action executor for module: ${executor.moduleId} (${executor.supportedOperations.length} operations)`);
  }

  /**
   * Unregister an executor (when module is uninstalled or removed)
   */
  unregister(moduleId: string): void {
    const removed = this.executors.delete(moduleId);
    if (removed) {
      console.log(`🗑️  Unregistered action executor for module: ${moduleId}`);
    }
  }

  /**
   * Get executor for a module
   */
  get(moduleId: string): ModuleActionExecutor | undefined {
    return this.executors.get(moduleId);
  }

  /**
   * Check if module has executor registered
   */
  has(moduleId: string): boolean {
    return this.executors.has(moduleId);
  }

  /**
   * Check if module supports a specific operation
   */
  supportsOperation(moduleId: string, operation: string): boolean {
    const executor = this.executors.get(moduleId);
    if (!executor) {
      return false;
    }
    return executor.supportedOperations.includes(operation);
  }

  /**
   * List all registered module IDs
   */
  listModules(): string[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Get all registered executors (for debugging/admin)
   */
  getAll(): ModuleActionExecutor[] {
    return Array.from(this.executors.values());
  }

  /**
   * Execute action using registered executor
   * Handles both in-process and webhook executors
   */
  async execute(
    action: AIAction,
    userContext: UserContext
  ): Promise<ActionExecutionResult> {
    const executor = this.executors.get(action.module);
    
    if (!executor) {
      throw new Error(`No executor registered for module: ${action.module}`);
    }

    // Check if operation is supported
    if (!executor.supportedOperations.includes(action.operation)) {
      throw new Error(
        `Operation '${action.operation}' not supported by module '${action.module}'. ` +
        `Supported operations: ${executor.supportedOperations.join(', ')}`
      );
    }

    // Execute based on type
    if (executor.executorType === 'in-process' && executor.executor) {
      return await executor.executor(action, userContext);
    }

    if (executor.executorType === 'webhook' && executor.webhookConfig) {
      return await this.executeWebhook(action, userContext, executor.webhookConfig);
    }

    throw new Error(`Invalid executor configuration for module: ${action.module}`);
  }

  /**
   * Execute action via webhook (for external modules)
   */
  private async executeWebhook(
    action: AIAction,
    userContext: UserContext,
    config: WebhookExecutorConfig
  ): Promise<ActionExecutionResult> {
    const timeout = config.timeout || 30000; // Default 30 seconds

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(config.executorUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: action.operation,
          parameters: action.parameters,
          userId: userContext.userId,
          context: userContext,
          actionId: action.id,
          requiresApproval: action.requiresApproval,
          reasoning: action.reasoning,
          affectedUsers: action.affectedUsers
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Webhook executor returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as ActionExecutionResult;

      // Validate result format
      if (!result.actionId || typeof result.success !== 'boolean') {
        throw new Error('Invalid response format from webhook executor');
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Webhook executor timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Clear all executors (for testing/cleanup)
   */
  clear(): void {
    this.executors.clear();
  }
}

// Singleton instance
export const actionExecutorRegistry = new ActionExecutorRegistry();

