import { Response, NextFunction } from 'express';
import { AuthenticatedRequest as BaseAuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

// Extend AuthenticatedRequest to include scheduling-specific properties
export interface AuthenticatedRequest extends BaseAuthenticatedRequest {
  businessId?: string;
}

/**
 * Middleware to check if the Scheduling module is installed/subscribed for the business
 */
export const checkSchedulingModuleInstalled = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Validate businessId from query or body
  const businessIdParam = req.query.businessId;
  const businessIdBody = req.body?.businessId;
  
  let businessId: string | undefined;
  if (businessIdParam) {
    if (typeof businessIdParam !== 'string') {
      void res.status(400).json({ error: 'businessId query parameter must be a string' });
      return;
    }
    businessId = businessIdParam;
  } else if (businessIdBody) {
    if (typeof businessIdBody !== 'string') {
      void res.status(400).json({ error: 'businessId body parameter must be a string' });
      return;
    }
    businessId = businessIdBody;
  }

  // Enhanced logging for availability routes
  if (req.method === 'POST' && (req.path?.includes('/me/availability') || req.url?.includes('/me/availability'))) {
    console.log('🔍 [MODULE CHECK] checkSchedulingModuleInstalled called', {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      businessId,
      queryBusinessId: req.query.businessId,
      bodyBusinessId: req.body?.businessId
    });
  }

  if (!businessId) {
    logger.warn('checkSchedulingModuleInstalled: No businessId in request', {
      operation: 'scheduling_module_check',
      path: req.path,
      url: req.url,
      query: req.query,
      hasBody: !!req.body
    });
    res.status(400).json({ message: 'Business ID is required' });
    return;
  }

  // Attach businessId to request for downstream use
  req.businessId = businessId;

  try {
    // Check if scheduling module is installed for this business
    const installation = await prisma.businessModuleInstallation.findFirst({
      where: {
        businessId,
        moduleId: 'scheduling',
        enabled: true,
      },
    });

    if (!installation) {
      logger.warn(`Scheduling module not installed for business ${businessId}`, {
        operation: 'scheduling_module_check',
        businessId,
        moduleId: 'scheduling'
      });
      res.status(403).json({
        message: 'Scheduling module is not installed for this business',
        code: 'MODULE_NOT_INSTALLED',
      });
      return;
    }

    // Enhanced logging for availability routes
    if (req.method === 'POST' && (req.path?.includes('/me/availability') || req.url?.includes('/me/availability'))) {
      console.log('✅ [MODULE CHECK] Scheduling module installed, proceeding', {
        businessId,
        installationId: installation.id
      });
    }

    // Attach module installation to request for potential future use
    // Note: ModuleSubscription is for paid modules, BusinessModuleInstallation is for all modules
    next();
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error checking scheduling module installation for business ${businessId}`, {
      error: {
        message: err.message,
        stack: err.stack,
      },
      operation: 'scheduling_module_check',
      businessId
    });
    res.status(500).json({ message: 'Internal server error during module check' });
  }
};
