/**
 * MODULE AI CONTEXT API ROUTES
 * 
 * Endpoints for:
 * - Module developers to register/update their AI context
 * - AI system to query module contexts
 * - Admin portal to view module analytics
 * 
 * NOTE: TypeScript errors for Prisma models will be resolved after running:
 * npx prisma migrate dev --name add_module_ai_context_registry
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { moduleAIContextService } from '../ai/services/ModuleAIContextService';
import type { ModuleAIContext } from '../../../shared/src/types/module-ai-context';
import { prisma } from '../lib/prisma';

const router: Router = Router();

// ============================================================================
// MODULE DEVELOPER ENDPOINTS
// ============================================================================

/**
 * Register or update a module's AI context
 * POST /api/modules/:moduleId/ai/context
 */
router.post(
  '/modules/:moduleId/ai/context',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const aiContext: ModuleAIContext = req.body;
      const userId = (req as any).user.id;

      // Verify user owns this module or is admin
      const module = await prisma.module.findUnique({
        where: { id: moduleId },
      });

      if (!module) {
        return res.status(404).json({ error: 'Module not found' });
      }

      if (module.developerId !== userId && (req as any).user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only module owner can update AI context' });
      }

      // Validate AI context structure
      if (!aiContext.purpose || !aiContext.category || !aiContext.keywords) {
        return res.status(400).json({
          error: 'Invalid AI context: must include purpose, category, and keywords',
        });
      }

      // Register/update in registry
      const registered = await moduleAIContextService.registerModuleContext(
        moduleId,
        module.name,
        aiContext
      );

      res.json({
        success: true,
        message: 'Module AI context registered successfully',
        registry: registered,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error registering module AI context:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Get a module's AI context registry entry
 * GET /api/modules/:moduleId/ai/context
 */
router.get(
  '/modules/:moduleId/ai/context',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;

      const registry = await prisma.moduleAIContextRegistry.findUnique({
        where: { moduleId },
      });

      if (!registry) {
        return res.status(404).json({ error: 'Module AI context not found' });
      }

      res.json(registry);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error getting module AI context:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================================================================
// AI SYSTEM ENDPOINTS (Internal use)
// ============================================================================

/**
 * Analyze a query to find relevant modules
 * POST /api/ai/analyze-query
 */
router.post(
  '/ai/analyze-query',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      const userId = (req as any).user.id;

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const analysis = await moduleAIContextService.analyzeQuery(query, userId);

      res.json(analysis);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error analyzing query:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Fetch context from a specific module context provider
 * GET /api/modules/:moduleId/ai/fetch-context/:providerName
 */
router.get(
  '/modules/:moduleId/ai/fetch-context/:providerName',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { moduleId, providerName } = req.params;
      const userId = (req as any).user.id;
      const parameters = req.query;

      const context = await moduleAIContextService.fetchModuleContext(
        moduleId,
        providerName,
        userId,
        parameters as Record<string, unknown>
      );

      res.json(context);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error fetching module context:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Clear user's AI context cache
 * DELETE /api/ai/context-cache
 */
router.delete(
  '/ai/context-cache',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      await moduleAIContextService.clearUserContextCache(userId);

      res.json({
        success: true,
        message: 'AI context cache cleared successfully',
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error clearing context cache:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Invalidate cache for a specific module
 * DELETE /api/modules/:moduleId/ai/cache
 */
router.delete(
  '/modules/:moduleId/ai/cache',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;

      await moduleAIContextService.invalidateModuleCache(moduleId);

      res.json({
        success: true,
        message: `Cache invalidated for module: ${moduleId}`,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error invalidating module cache:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================================================================
// ADMIN PORTAL ENDPOINTS
// ============================================================================

/**
 * Get all module AI context registries (admin only)
 * GET /api/admin/modules/ai/registry
 */
router.get(
  '/admin/modules/ai/registry',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const registries = await prisma.moduleAIContextRegistry.findMany({
        include: {
          module: {
            select: {
              id: true,
              name: true,
              category: true,
              status: true,
              downloads: true,
            },
          },
        },
        orderBy: { lastUpdated: 'desc' },
      });

      res.json(registries);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error getting module registries:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Get all modules with AI context status (admin only)
 * GET /api/admin/modules/ai/status
 * 
 * Returns comprehensive status of all modules including:
 * - Which modules are registered in AI context registry
 * - AI context details (keywords, patterns, context providers)
 * - Health status summary
 */
router.get(
  '/admin/modules/ai/status',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      // Get all modules from database
      const allModules = await prisma.module.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
      }).catch(() => []);

      // Get all registered AI contexts
      // Query all fields to avoid issues with missing columns
      const registeredContexts = await prisma.moduleAIContextRegistry.findMany().catch(() => []);

      // Define type for registry entries
      type RegistryEntry = typeof registeredContexts[number];

      // Create a map of registered contexts by moduleId
      const contextMap = new Map<string, RegistryEntry>(
        registeredContexts.map((ctx: RegistryEntry) => [ctx.moduleId, ctx])
      );

      // Combine modules with their AI context status
      const modulesWithStatus = allModules.map((module: typeof allModules[number]) => {
        const aiContext: RegistryEntry | undefined = contextMap.get(module.id);
        
        if (!aiContext) {
          return {
            moduleId: module.id,
            moduleName: module.name,
            description: module.description,
            category: module.category,
            status: module.status,
            version: module.version,
            createdAt: module.createdAt,
            updatedAt: module.updatedAt,
            aiContextRegistered: false,
            aiContext: null,
          };
        }
        
        // Store createdAt to avoid TypeScript narrowing issues
        const contextCreatedAt = aiContext.createdAt || new Date();
        const contextLastUpdated = aiContext.lastUpdated || contextCreatedAt;
        
        return {
          moduleId: module.id,
          moduleName: module.name,
          description: module.description,
          category: module.category,
          status: module.status,
          version: module.version,
          createdAt: module.createdAt,
          updatedAt: module.updatedAt,
          // AI Context Status
          aiContextRegistered: true,
          aiContext: {
            purpose: aiContext.purpose || '',
            category: aiContext.category || '',
            keywords: Array.isArray(aiContext.keywords) ? aiContext.keywords : [],
            patterns: Array.isArray(aiContext.patterns) ? aiContext.patterns : [],
            concepts: Array.isArray(aiContext.concepts) ? aiContext.concepts : [],
            // Handle entities field - JSON field, could be array, object, or null
            entities: aiContext.entities != null 
              ? (Array.isArray(aiContext.entities) ? aiContext.entities : (typeof aiContext.entities === 'object' ? [aiContext.entities] : []))
              : [],
            // Handle actions field - JSON field, could be array, object, or null
            actions: aiContext.actions != null
              ? (Array.isArray(aiContext.actions) ? aiContext.actions : (typeof aiContext.actions === 'object' ? [aiContext.actions] : []))
              : [],
            // Handle contextProviders field - JSON field, could be array, object, or null
            contextProviders: aiContext.contextProviders != null
              ? (Array.isArray(aiContext.contextProviders) 
                  ? aiContext.contextProviders 
                  : (typeof aiContext.contextProviders === 'object' ? [aiContext.contextProviders] : []))
              : [],
            // Handle relationships field
            relationships: aiContext.relationships != null ? aiContext.relationships : null,
            version: aiContext.version || '1.0.0',
            registeredAt: contextCreatedAt,
            lastUpdated: contextLastUpdated,
          },
        };
      });

      // Calculate summary
      const registeredCount = modulesWithStatus.filter((m: { aiContextRegistered: boolean }) => m.aiContextRegistered).length;
      const notRegisteredCount = modulesWithStatus.filter((m: { aiContextRegistered: boolean }) => !m.aiContextRegistered).length;
      
      // Determine health status
      let healthStatus: 'good' | 'warning' | 'critical' = 'good';
      const totalModules = modulesWithStatus.length;
      const registrationRate = totalModules > 0 ? registeredCount / totalModules : 1;
      
      if (registrationRate < 0.5) {
        healthStatus = 'critical';
      } else if (registrationRate < 0.8 || notRegisteredCount > 3) {
        healthStatus = 'warning';
      }

      res.json({
        success: true,
        modules: modulesWithStatus,
        summary: {
          totalModules: totalModules,
          registered: registeredCount,
          notRegistered: notRegisteredCount,
          registrationRate: Math.round(registrationRate * 100),
          healthStatus,
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error getting module AI status:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        error: error
      });
      
      // Log more details in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      }
      
      res.status(500).json({ 
        success: false,
        error: err.message || 'Failed to get module AI status',
        ...(process.env.NODE_ENV === 'development' && { 
          details: err.stack,
          errorType: err.name 
        })
      });
    }
  }
);

/**
 * Get module analytics (admin only)
 * GET /api/admin/modules/:moduleId/ai/analytics
 */
router.get(
  '/admin/modules/:moduleId/ai/analytics',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const analytics = await moduleAIContextService.getModuleAnalytics(moduleId, days);

      res.json(analytics);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error getting module analytics:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Get all module performance metrics (admin only)
 * GET /api/admin/modules/ai/performance
 */
router.get(
  '/admin/modules/ai/performance',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const metrics = await prisma.moduleAIPerformanceMetric.findMany({
        where: {
          date: { gte: startDate },
        },
        include: {
          module: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: [
          { moduleId: 'asc' },
          { date: 'desc' },
        ],
      });

      // Define type for metric entry
      type MetricEntry = typeof metrics[number];
      
      // Define type for module performance aggregation
      interface ModulePerformanceData {
        moduleId: string;
        moduleName: string;
        moduleCategory: string;
        metrics: MetricEntry[];
        totals: {
          queries: number;
          successfulQueries: number;
          failedQueries: number;
          totalLatency: number;
          queryCount: number;
        };
        averageLatency?: number;
        successRate?: number;
      }

      // Group by module and calculate aggregates
      const modulePerformance: Record<string, ModulePerformanceData> = {};
      
      metrics.forEach((metric: MetricEntry) => {
        const moduleId = metric.moduleId;
        if (!modulePerformance[moduleId]) {
          modulePerformance[moduleId] = {
            moduleId,
            moduleName: metric.module.name,
            moduleCategory: metric.module.category,
            metrics: [],
            totals: {
              queries: 0,
              successfulQueries: 0,
              failedQueries: 0,
              totalLatency: 0,
              queryCount: 0,
            },
          };
        }

        modulePerformance[moduleId].metrics.push(metric);
        modulePerformance[moduleId].totals.queries += metric.totalQueries;
        modulePerformance[moduleId].totals.successfulQueries += metric.successfulQueries;
        modulePerformance[moduleId].totals.failedQueries += metric.failedQueries;
        modulePerformance[moduleId].totals.totalLatency += metric.averageLatency * metric.totalQueries;
        modulePerformance[moduleId].totals.queryCount += metric.totalQueries;
      });

      // Calculate averages
      const modulePerformanceValues = Object.values(modulePerformance);
      modulePerformanceValues.forEach((module: ModulePerformanceData) => {
        module.averageLatency =
          module.totals.queryCount > 0
            ? module.totals.totalLatency / module.totals.queryCount
            : 0;
        module.successRate =
          module.totals.queries > 0
            ? (module.totals.successfulQueries / module.totals.queries) * 100
            : 0;
      });

      res.json({
        startDate,
        endDate: new Date(),
        modules: modulePerformanceValues,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error getting module performance:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Search modules by category (admin only)
 * GET /api/admin/modules/ai/category/:category
 */
router.get(
  '/admin/modules/ai/category/:category',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { category } = req.params;

      const modules = await moduleAIContextService.getModulesByCategory(category);

      res.json(modules);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error getting modules by category:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Search modules by keywords (admin only)
 * POST /api/admin/modules/ai/search-keywords
 */
router.post(
  '/admin/modules/ai/search-keywords',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { keywords } = req.body;

      if (!keywords || !Array.isArray(keywords)) {
        return res.status(400).json({ error: 'Keywords array is required' });
      }

      const modules = await moduleAIContextService.searchByKeywords(keywords);

      res.json(modules);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error searching modules by keywords:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Manually trigger built-in module registration (admin only)
 * POST /api/admin/modules/ai/register-built-ins
 * 
 * This endpoint allows admins to manually register the built-in modules
 * if the automatic registration during deployment failed or if new modules were added.
 * 
 * Uses the same registration logic as startup, which will only register missing modules.
 */
router.post(
  '/admin/modules/ai/register-built-ins',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      console.log('='.repeat(60));
      console.log('🤖 ADMIN-TRIGGERED MODULE REGISTRATION');
      console.log('='.repeat(60));
      
      // Get count BEFORE registration
      const beforeCount = await prisma.moduleAIContextRegistry.count();
      console.log(`📊 Registry count BEFORE registration: ${beforeCount}`);
      
      // Import and call the startup registration function
      const { registerBuiltInModulesOnStartup } = await import('../startup/registerBuiltInModules');
      
      // Call the registration function
      console.log('🚀 Calling registerBuiltInModulesOnStartup()...');
      await registerBuiltInModulesOnStartup();
      console.log('✅ registerBuiltInModulesOnStartup() completed');
      
      // Get detailed status AFTER registration
      const registryEntries = await prisma.moduleAIContextRegistry.findMany({
        select: { moduleId: true, moduleName: true, createdAt: true },
      });
      
      const afterCount = registryEntries.length;
      console.log(`📊 Registry count AFTER registration: ${afterCount}`);
      console.log(`📊 New registrations: ${afterCount - beforeCount}`);
      
      const allModules = await prisma.module.findMany({
        select: { id: true, name: true, status: true },
      });
      
      console.log(`📊 Total modules in Module table: ${allModules.length}`);
      console.log(`📊 Module IDs: ${allModules.map((m: { id: string }) => m.id).join(', ')}`);
      
      // Check which built-in modules exist and which are registered
      const builtInIds = ['drive', 'chat', 'calendar', 'hr', 'scheduling', 'todo'];
      const moduleStatus = builtInIds.map((id: string) => {
        const moduleExists = allModules.find((m: { id: string; name: string; status: string }) => m.id === id);
        const registryExists = registryEntries.find((r: { moduleId: string }) => r.moduleId === id);
        return {
          moduleId: id,
          moduleExists: !!moduleExists,
          moduleStatus: moduleExists?.status || 'NOT_FOUND',
          moduleName: moduleExists?.name || 'NOT_FOUND',
          registryExists: !!registryExists,
          registryCreatedAt: registryExists?.createdAt || null,
        };
      });
      
      console.log('📊 Built-in module status:');
      moduleStatus.forEach((m: { moduleId: string; moduleExists: boolean; registryExists: boolean }) => {
        console.log(`   - ${m.moduleId}: module=${m.moduleExists ? 'EXISTS' : 'MISSING'}, registry=${m.registryExists ? 'REGISTERED' : 'NOT_REGISTERED'}`);
      });
      console.log('='.repeat(60));
      
      res.json({
        success: true,
        message: 'Module registration completed',
        registeredCount: afterCount,
        newRegistrations: afterCount - beforeCount,
        totalModules: allModules.length,
        builtInModuleStatus: moduleStatus,
        allModuleIds: allModules.map((m: { id: string }) => m.id),
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error in manual module registration:', error);
      res.status(500).json({ 
        success: false,
        error: err.message,
        stack: err.stack,
      });
    }
  }
);

/**
 * Sync all modules with the registry (admin only, called by cron)
 * POST /api/admin/modules/ai/sync
 * 
 * This endpoint is called nightly by Cloud Scheduler to keep the registry
 * synchronized with module updates. Can also be triggered manually by admins.
 */
router.post(
  '/admin/modules/ai/sync',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      console.log('🔄 Admin/Cron triggered module registry sync');

      const { moduleRegistrySyncService } = await import('../services/ModuleRegistrySyncService');
      
      const result = await moduleRegistrySyncService.syncAllModules();

      res.json({
        success: result.success,
        message: result.success 
          ? 'Module registry sync completed successfully'
          : 'Module registry sync completed with errors',
        summary: {
          added: result.added,
          updated: result.updated,
          removed: result.removed,
          errors: result.errors,
        },
        details: result.details,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error in module registry sync:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Get module registry sync status (admin only)
 * GET /api/admin/modules/ai/sync/status
 * 
 * Returns statistics about the current state of the registry
 * and when it was last synchronized.
 */
router.get(
  '/admin/modules/ai/sync/status',
  authenticateJWT,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { moduleRegistrySyncService } = await import('../services/ModuleRegistrySyncService');
      
      const status = await moduleRegistrySyncService.getSyncStatus();

      res.json({
        success: true,
        status,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error getting sync status:', error);
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;

