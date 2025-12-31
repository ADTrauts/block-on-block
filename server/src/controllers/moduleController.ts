import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AuthenticatedRequest } from '../middleware/auth';
import { ModuleSecurityService } from '../services/moduleSecurityService';
import { initializeHrScheduleForBusiness } from '../services/hrScheduleService';

// Helper function to get user from request
const getUserFromRequest = (req: Request) => {
  return (req as AuthenticatedRequest).user;
};

// Get all installed modules for the current user
export const getInstalledModules = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const scope = (req.query.scope as 'personal' | 'business') || 'personal';
    const businessId = req.query.businessId as string | undefined;

    if (scope === 'business') {
      if (!businessId) {
        return res.status(400).json({ success: false, error: 'businessId is required for business scope' });
      }

      const membership = await prisma.businessMember.findFirst({
        where: { businessId, userId: user.id, isActive: true },
      });
      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied for this business' });
      }
      // Require admin/manager or explicit manage permission
      if (!(membership.role === 'ADMIN' || membership.role === 'MANAGER' || membership.canManage)) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions to install for this business' });
      }

      const installations = await (prisma as any).businessModuleInstallation.findMany({
        where: { businessId, enabled: true },
        include: {
          module: {
            include: {
              developer: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      const modules = installations.map((installation: Record<string, any>) => ({
        id: installation.module.id,
        name: installation.module.name,
        description: installation.module.description,
        version: installation.module.version,
        category: installation.module.category,
        developer: installation.module.developer.name || installation.module.developer.email,
        rating: installation.module.rating,
        reviewCount: installation.module.reviewCount,
        downloads: installation.module.downloads,
        status: 'installed' as const,
        icon: installation.module.icon,
        configured: installation.configured,
        installedAt: installation.installedAt,
        updatedAt: installation.module.updatedAt,
      }));

      return res.json({ success: true, data: modules });
    }

    // Get explicitly installed modules
    const installations = await prisma.moduleInstallation.findMany({
      where: {
        userId: user.id,
        enabled: true
      },
      include: {
        module: {
          include: {
            developer: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Get built-in modules (always available for personal users)
    const builtInModuleIds = ['drive', 'chat', 'calendar'];
    const builtInModules = await prisma.module.findMany({
      where: {
        id: { in: builtInModuleIds },
        status: 'APPROVED'
      },
      include: {
        developer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Combine explicitly installed modules with built-in modules
    const installedModules = installations.map(installation => ({
      id: installation.module.id,
      name: installation.module.name,
      description: installation.module.description,
      version: installation.module.version,
      category: installation.module.category,
      developer: installation.module.developer.name || installation.module.developer.email,
      rating: installation.module.rating,
      reviewCount: installation.module.reviewCount,
      downloads: installation.module.downloads,
      status: 'installed' as const,
      icon: installation.module.icon,
      configured: installation.configured as any,
      installedAt: installation.installedAt,
      updatedAt: installation.module.updatedAt,
      isBuiltIn: false
    }));

    // Add built-in modules (mark as built-in and always installed)
    const builtInModulesFormatted = builtInModules.map(module => ({
      id: module.id,
      name: module.name,
      description: module.description,
      version: module.version,
      category: module.category,
      developer: module.developer.name || module.developer.email,
      rating: module.rating,
      reviewCount: module.reviewCount,
      downloads: module.downloads,
      status: 'installed' as const,
      icon: module.icon,
      configured: {
        enabled: true,
        settings: {},
        permissions: [`${module.id}:read`, `${module.id}:write`]
      },
      installedAt: module.createdAt, // Use module creation date as "installed" date
      updatedAt: module.updatedAt,
      isBuiltIn: true
    }));

    // Combine all modules, avoiding duplicates (built-in modules take precedence)
    const allModules = [...builtInModulesFormatted];
    const installedModuleIds = new Set(builtInModulesFormatted.map(m => m.id));
    
    installedModules.forEach(module => {
      if (!installedModuleIds.has(module.id)) {
        allModules.push(module);
      }
    });

    res.json({ success: true, data: allModules });
  } catch (error) {
    console.error('Error getting installed modules:', error);
    res.status(500).json({ success: false, error: 'Failed to get installed modules' });
  }
};

// Get all available modules in the marketplace
export const getMarketplaceModules = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'downloads';
    const sortOrder = typeof req.query.sortOrder === 'string' ? req.query.sortOrder : 'desc';
    const pricingTier = typeof req.query.pricingTier === 'string' ? req.query.pricingTier : undefined;
    
    // Validate scope and businessId query parameters
    const scopeParam = req.query.scope;
    const businessIdParam = req.query.businessId;
    
    if (scopeParam && typeof scopeParam !== 'string') {
      return res.status(400).json({ error: 'scope must be a string' });
    }
    const scope = (scopeParam === 'business' ? 'business' : 'personal') as 'personal' | 'business';
    
    if (businessIdParam && typeof businessIdParam !== 'string') {
      return res.status(400).json({ error: 'businessId must be a string' });
    }
    const businessId = businessIdParam as string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      status: 'APPROVED'
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { tags: { has: search as string } }
      ];
    }

    if (category && category !== 'all') {
      whereClause.category = category;
    }

    // Filter by pricing tier
    if (pricingTier && pricingTier !== 'all') {
      whereClause.pricingTier = pricingTier;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBy: any = {};
    if (sortBy === 'rating') {
      orderBy.rating = sortOrder;
    } else if (sortBy === 'downloads') {
      orderBy.downloads = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    }

    const modules = await prisma.module.findMany({
      where: whereClause,
      include: {
        developer: { select: { id: true, name: true, email: true } },
        installations: scope === 'personal' ? { where: { userId: user.id } } : false,
        businessInstallations: scope === 'business' && businessId ? { where: { businessId } } : false,
        subscriptions:
          scope === 'personal'
            ? { where: { userId: user.id, status: 'active' } }
            : businessId
            ? { where: { businessId, status: 'active' } }
            : false,
      } as any,
      orderBy: orderBy
    });

    const modulesWithStatus = modules.map(module => {
      // Check if this is a built-in module for personal scope
      const builtInModuleIds = ['drive', 'chat', 'calendar'];
      const isBuiltInModule = builtInModuleIds.includes(module.id);
      
      // Determine status based on scope and installation
      let status: 'installed' | 'available';
      if (scope === 'business') {
        status = (module as any).businessInstallations?.length > 0 ? 'installed' : 'available';
      } else {
        // For personal scope, check both explicit installations and built-in modules
        const hasExplicitInstallation = (module as any).installations?.length > 0;
        const isBuiltInAndPersonal = isBuiltInModule && scope === 'personal';
        status = (hasExplicitInstallation || isBuiltInAndPersonal) ? 'installed' : 'available';
      }

      return {
        id: module.id,
        name: module.name,
        description: module.description,
        version: module.version,
        category: module.category,
        developer: (module as any).developer.name || (module as any).developer.email,
        rating: module.rating,
        reviewCount: module.reviewCount,
        downloads: module.downloads,
        status,
        icon: module.icon,
        screenshots: module.screenshots,
        tags: module.tags,
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
        // Pricing data
        pricingTier: module.pricingTier,
        basePrice: module.basePrice,
        enterprisePrice: module.enterprisePrice,
        isProprietary: module.isProprietary,
        revenueSplit: module.revenueSplit,
        // Subscription status
        subscriptionStatus: (module as any).subscriptions?.[0]?.status || null,
        subscriptionAmount: (module as any).subscriptions?.[0]?.amount || null,
        // Built-in module indicator
        isBuiltIn: isBuiltInModule,
      };
    });

    res.json({ success: true, data: modulesWithStatus });
  } catch (error) {
    console.error('Error getting marketplace modules:', error);
    res.status(500).json({ success: false, error: 'Failed to get marketplace modules' });
  }
};

// Install a module
export const installModule = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { moduleId } = req.params;
    
    // Validate query parameters
    const scopeParam = req.query.scope;
    const businessIdParam = req.query.businessId;
    
    if (scopeParam && typeof scopeParam !== 'string') {
      return res.status(400).json({ success: false, error: 'scope must be a string' });
    }
    const scope = (scopeParam === 'business' ? 'business' : 'personal') as 'personal' | 'business';
    
    if (businessIdParam && typeof businessIdParam !== 'string') {
      return res.status(400).json({ success: false, error: 'businessId must be a string' });
    }
    const businessId = businessIdParam as string | undefined;

    // Check if module exists
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // Check if module is approved
    if (module.status !== 'APPROVED') {
      return res.status(400).json({ success: false, error: 'Module is not available for installation' });
    }

    if (scope === 'business') {
      if (!businessId) {
        return res.status(400).json({ success: false, error: 'businessId is required for business scope' });
      }

      // Check business membership and permissions
      const membership = await prisma.businessMember.findFirst({
        where: { businessId, userId: user.id, isActive: true },
      });
      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied for this business' });
      }
      if (!(membership.role === 'ADMIN' || membership.role === 'MANAGER' || membership.canManage)) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions to install for this business' });
      }

      // Check if module is already installed for this business
      const existingInstallation = await (prisma as any).businessModuleInstallation.findUnique({
        where: { moduleId_businessId: { moduleId, businessId } },
      });
      if (existingInstallation) {
        return res.status(400).json({ success: false, error: 'Module is already installed for this business' });
      }

      // Check subscription requirements for paid modules
      // NOTE: Proprietary modules (like HR) are included in business tier, not separately paid
      if (module.pricingTier && module.pricingTier !== 'free' && !module.isProprietary) {
        const subscription = await (prisma as any).businessModuleSubscription.findFirst({
          where: { businessId, moduleId, status: 'active' },
        });
        if (!subscription) {
          return res.status(402).json({
            success: false,
            error: 'Business subscription required',
            requiresSubscription: true,
            moduleId,
            pricingTier: module.pricingTier,
            basePrice: module.basePrice,
            enterprisePrice: module.enterprisePrice,
          });
        }
      }
      
      // For proprietary modules (like HR), check business tier instead
      if (module.isProprietary && module.pricingTier && module.pricingTier !== 'free') {
        const business = await prisma.business.findUnique({
          where: { id: businessId },
          include: {
            subscriptions: {
              where: { status: 'active' },
              orderBy: { createdAt: 'desc' }
            }
          }
        });
        
        const activeSub = business?.subscriptions[0];
        const businessTier = activeSub?.tier || business?.tier || 'free';
        
        // HR module requires business_advanced or enterprise
        const requiredTiers = ['business_advanced', 'enterprise'];
        const hasRequiredTier = requiredTiers.includes(businessTier);
        
        if (!hasRequiredTier) {
          return res.status(403).json({
            success: false,
            error: 'Business tier upgrade required',
            requiresTier: module.pricingTier,
            currentTier: businessTier,
            message: `${module.name} requires Business Advanced or Enterprise tier`,
            upgradeUrl: '/billing/upgrade'
          });
        }
      }

      // Install module for business
      const installation = await (prisma as any).businessModuleInstallation.create({
        data: { 
          moduleId, 
          businessId, 
          enabled: true,
          installedAt: new Date()
          // Note: installedBy column doesn't exist in production DB yet
        },
        include: { 
          module: { 
            include: { 
              developer: { 
                select: { id: true, name: true, email: true } 
              } 
            } 
          } 
        },
      });

      // Update module download count
      await prisma.module.update({ 
        where: { id: moduleId }, 
        data: { downloads: { increment: 1 } } 
      });

      if (moduleId === 'hr') {
        try {
          await initializeHrScheduleForBusiness(businessId);
        } catch (scheduleError) {
          const errorMessage = scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
          logger.warn('Failed to initialize HR schedule calendar', {
            businessId,
            error: { message: errorMessage }
          });
        }
      }

      return res.json({
        success: true,
        message: 'Module installed for business successfully',
        installation: {
          id: installation.id,
          moduleId: installation.moduleId,
          businessId: installation.businessId,
          installedAt: installation.installedAt,
          configured: installation.configured,
          enabled: installation.enabled,
          module: {
            id: installation.module.id,
            name: installation.module.name,
            description: installation.module.description,
            version: installation.module.version,
            category: installation.module.category,
            developer: installation.module.developer.name || installation.module.developer.email,
            pricingTier: installation.module.pricingTier,
            basePrice: installation.module.basePrice,
            enterprisePrice: installation.module.enterprisePrice,
          },
        },
      });
    } else {
      // Personal installation logic
      const existingInstallation = await prisma.moduleInstallation.findUnique({
        where: { moduleId_userId: { moduleId, userId: user.id } },
      });
      if (existingInstallation) {
        return res.status(400).json({ success: false, error: 'Module is already installed' });
      }

      if (module.pricingTier && module.pricingTier !== 'free') {
        const subscription = await prisma.moduleSubscription.findFirst({
          where: { userId: user.id, moduleId, status: 'active' },
        });
        if (!subscription) {
          return res.status(402).json({
            success: false,
            error: 'Subscription required',
            requiresSubscription: true,
            moduleId,
            pricingTier: module.pricingTier,
            basePrice: module.basePrice,
            enterprisePrice: module.enterprisePrice,
          });
        }
      }

      const installation = await prisma.moduleInstallation.create({
        data: { moduleId, userId: user.id, enabled: true },
        include: { module: { include: { developer: { select: { id: true, name: true, email: true } } } } },
      });

      await prisma.module.update({ where: { id: moduleId }, data: { downloads: { increment: 1 } } });

      return res.json({
        success: true,
        message: 'Module installed successfully',
        installation: {
          id: installation.id,
          moduleId: installation.moduleId,
          userId: installation.userId,
          installedAt: installation.installedAt,
          configured: installation.configured,
          enabled: installation.enabled,
          module: {
            id: installation.module.id,
            name: installation.module.name,
            description: installation.module.description,
            version: installation.module.version,
            category: installation.module.category,
            developer: installation.module.developer.name || installation.module.developer.email,
            pricingTier: installation.module.pricingTier,
            basePrice: installation.module.basePrice,
            enterprisePrice: installation.module.enterprisePrice,
          },
        },
      });
    }
  } catch (error) {
    console.error('Error installing module:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to install module',
      // Show details always for now (debugging production issue)
      details: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown'
    });
  }
};

// Uninstall a module
export const uninstallModule = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { moduleId } = req.params;
    const scope = (req.query.scope as 'personal' | 'business') || 'personal';
    const businessId = req.query.businessId as string | undefined;

    if (scope === 'business') {
      if (!businessId) {
        return res.status(400).json({ success: false, error: 'businessId is required for business scope' });
      }
      const membership = await prisma.businessMember.findFirst({ where: { businessId, userId: user.id, isActive: true } });
      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied for this business' });
      }
      if (!(membership.role === 'ADMIN' || membership.role === 'MANAGER' || membership.canManage)) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions to uninstall for this business' });
      }

      const installation = await (prisma as any).businessModuleInstallation.findUnique({
        where: { moduleId_businessId: { moduleId, businessId } }
      });
      if (!installation) {
        return res.status(404).json({ success: false, error: 'Module is not installed for this business' });
      }

      await (prisma as any).businessModuleInstallation.delete({ where: { moduleId_businessId: { moduleId, businessId } } });
      return res.json({ success: true, data: { message: 'Module uninstalled for business successfully' } });
    }

    const installation = await prisma.moduleInstallation.findUnique({
      where: { moduleId_userId: { moduleId, userId: user.id } }
    });
    if (!installation) {
      return res.status(404).json({ success: false, error: 'Module is not installed' });
    }

    await prisma.moduleInstallation.delete({ where: { moduleId_userId: { moduleId, userId: user.id } } });

    res.json({ success: true, data: { message: 'Module uninstalled successfully' } });
  } catch (error) {
    console.error('Error uninstalling module:', error);
    res.status(500).json({ success: false, error: 'Failed to uninstall module' });
  }
};

// Configure a module
export const configureModule = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { moduleId } = req.params;
    const { configuration } = req.body;
    const scope = (req.query.scope as 'personal' | 'business') || 'personal';
    const businessId = req.query.businessId as string | undefined;

    if (scope === 'business') {
      if (!businessId) {
        return res.status(400).json({ success: false, error: 'businessId is required for business scope' });
      }

      const membership = await prisma.businessMember.findFirst({
        where: { businessId, userId: user.id, isActive: true }
      });

      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied for this business' });
      }

      if (!(membership.role === 'ADMIN' || membership.role === 'MANAGER' || membership.canManage)) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions to configure this business module' });
      }

      const installation = await (prisma as any).businessModuleInstallation.findUnique({
        where: { moduleId_businessId: { moduleId, businessId } }
      });

      if (!installation) {
        return res.status(404).json({ success: false, error: 'Module is not installed for this business' });
      }

      const updatedInstallation = await (prisma as any).businessModuleInstallation.update({
        where: { moduleId_businessId: { moduleId, businessId } },
        data: {
          configured: configuration
        }
      });

      return res.json({
        success: true,
        data: {
          message: 'Business module configured successfully',
          installation: updatedInstallation
        }
      });
    }

    const installation = await prisma.moduleInstallation.findUnique({
      where: {
        moduleId_userId: {
          moduleId,
          userId: user.id
        }
      }
    });

    if (!installation) {
      return res.status(404).json({ success: false, error: 'Module is not installed' });
    }

    const updatedInstallation = await prisma.moduleInstallation.update({
      where: {
        moduleId_userId: {
          moduleId,
          userId: user.id
        }
      },
      data: {
        configured: configuration
      }
    });

    res.json({ 
      success: true, 
      data: { 
        message: 'Module configured successfully',
        installation: updatedInstallation 
      } 
    });
  } catch (error) {
    console.error('Error configuring module:', error);
    res.status(500).json({ success: false, error: 'Failed to configure module' });
  }
};

// Get module categories
export const getModuleCategories = async (req: Request, res: Response) => {
  try {
    const categories = Object.values(require('@prisma/client').ModuleCategory);
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error getting module categories:', error);
    res.status(500).json({ success: false, error: 'Failed to get module categories' });
  }
};

// Get module details
export const getModuleDetails = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { moduleId } = req.params;

    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        developer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        installations: {
          where: {
            userId: user.id
          }
        },
        moduleReviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    });

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const moduleData = {
      id: module.id,
      name: module.name,
      description: module.description,
      version: module.version,
      category: module.category,
      developer: module.developer.name || module.developer.email,
      rating: module.rating,
      reviewCount: module.reviewCount,
      downloads: module.downloads,
      status: module.status,
      icon: module.icon,
      screenshots: module.screenshots,
      tags: module.tags,
      manifest: module.manifest,
      dependencies: module.dependencies,
      permissions: module.permissions,
      isInstalled: module.installations.length > 0,
      installation: module.installations[0] || null,
      reviews: module.moduleReviews,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt
    };

    res.json({ success: true, data: moduleData });
  } catch (error) {
    console.error('Error getting module details:', error);
    res.status(500).json({ success: false, error: 'Failed to get module details' });
  }
}; 

// Submit a module for review
export const submitModule = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      name,
      description,
      version,
      category,
      tags,
      manifest,
      dependencies,
      permissions,
      readme,
      license
    } = req.body;

    // Validate required fields
    if (!name || !description || !version || !category) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, description, version, category' 
      });
    }

    // Enhanced security validation
    const securityService = new ModuleSecurityService(prisma);
    const securityValidation = await securityService.validateModuleSubmission(req.body);
    
    if (!securityValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Module failed security validation',
        details: {
          errors: securityValidation.errors,
          warnings: securityValidation.warnings,
          securityScore: securityValidation.securityScore,
          recommendations: securityValidation.recommendations
        }
      });
    }

    // Log security warnings if any
    if (securityValidation.warnings.length > 0) {
      console.warn('⚠️ Module submission has security warnings:', securityValidation.warnings);
    }

    // Create the module
    const module = await prisma.module.create({
      data: {
        name,
        description,
        version,
        category,
        tags: tags || [],
        manifest,
        dependencies: dependencies || [],
        permissions: permissions || [],
        developerId: user.id,
        status: 'PENDING'
      }
    });

    // Create the submission record
    const submission = await prisma.moduleSubmission.create({
      data: {
        moduleId: module.id,
        submitterId: user.id,
        status: 'PENDING'
      },
      include: {
        module: {
          include: {
            developer: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        submitter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({ 
      success: true, 
      data: { 
        message: 'Module submitted successfully for review',
        submission,
        securityValidation: {
          securityScore: securityValidation.securityScore,
          status: securityValidation.validationDetails.securityStatus,
          warnings: securityValidation.warnings,
          recommendations: securityValidation.recommendations
        }
      } 
    });
  } catch (error) {
    console.error('Error submitting module:', error);
    res.status(500).json({ success: false, error: 'Failed to submit module' });
  }
};

// Get all module submissions (admin only)
export const getModuleSubmissions = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const submissions = await prisma.moduleSubmission.findMany({
      include: {
        module: {
          include: {
            developer: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        submitter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    res.json({ success: true, data: submissions });
  } catch (error) {
    console.error('Error getting module submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to get module submissions' });
  }
};

// Review a module submission (admin only)
export const reviewModuleSubmission = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { submissionId } = req.params;
    const { action, reviewNotes } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid action. Must be "approve" or "reject"' 
      });
    }

    const submission = await prisma.moduleSubmission.findUnique({
      where: { id: submissionId },
      include: {
        module: true
      }
    });

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    if (submission.status !== 'PENDING') {
      return res.status(400).json({ 
        success: false, 
        error: 'Submission has already been reviewed' 
      });
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Update submission
    const updatedSubmission = await prisma.moduleSubmission.update({
      where: { id: submissionId },
      data: {
        status: newStatus,
        reviewNotes,
        reviewerId: user.id,
        reviewedAt: new Date()
      },
      include: {
        module: {
          include: {
            developer: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        submitter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // If approved, update module status and sync AI context
    if (action === 'approve') {
      await prisma.module.update({
        where: { id: submission.moduleId },
        data: {
          status: 'APPROVED'
        }
      });

      // Sync module AI context to registry (non-blocking)
      try {
        const { moduleRegistrySyncService } = await import('../services/ModuleRegistrySyncService');
        await moduleRegistrySyncService.syncModule(submission.moduleId);
        console.log(`✅ Module AI context synced for: ${submission.module.name}`);
      } catch (syncError) {
        // Log error but don't fail the approval
        console.error(`⚠️  Failed to sync AI context for module ${submission.module.name}:`, syncError);
        console.error('   Module is approved, but AI context may need manual sync');
      }
    }

    res.json({ 
      success: true, 
      data: { 
        message: `Module ${action}d successfully`,
        submission: updatedSubmission 
      } 
    });
  } catch (error) {
    console.error('Error reviewing module submission:', error);
    res.status(500).json({ success: false, error: 'Failed to review module submission' });
  }
};

// Get user's submitted modules
export const getUserSubmissions = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const submissions = await prisma.moduleSubmission.findMany({
      where: {
        submitterId: user.id
      },
      include: {
        module: {
          include: {
            developer: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    res.json({ success: true, data: submissions });
  } catch (error) {
    console.error('Error getting user submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to get user submissions' });
  }
};

// Link a module to a business
export const linkModuleToBusiness = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { moduleId, businessId } = req.body;

    if (!moduleId || !businessId) {
      return res.status(400).json({ success: false, error: 'Module ID and Business ID are required' });
    }

    // Verify the module exists and belongs to the user
    const module = await prisma.module.findFirst({
      where: {
        id: moduleId,
        developerId: user.id
      }
    });

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found or access denied' });
    }

    // Verify the business exists and user has access
    const businessMember = await prisma.businessMember.findFirst({
      where: {
        businessId: businessId,
        userId: user.id,
        isActive: true
      },
      include: {
        business: true
      }
    });

    if (!businessMember) {
      return res.status(404).json({ success: false, error: 'Business not found or access denied' });
    }

    // Update the module to link it to the business
    const updatedModule = await prisma.module.update({
      where: {
        id: moduleId
      },
      data: {
        businessId: businessId
      },
      include: {
        business: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json({ 
      success: true, 
      data: {
        message: 'Module linked to business successfully',
        module: updatedModule
      }
    });
  } catch (error) {
    console.error('Error linking module to business:', error);
    res.status(500).json({ success: false, error: 'Failed to link module to business' });
  }
};

// Get modules for a specific business
export const getBusinessModules = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { businessId } = req.params;

    // Verify the business exists and user has access
    const businessMember = await prisma.businessMember.findFirst({
      where: {
        businessId: businessId,
        userId: user.id,
        isActive: true
      },
      include: {
        business: true
      }
    });

    if (!businessMember) {
      return res.status(404).json({ success: false, error: 'Business not found or access denied' });
    }

    // Get all modules linked to this business
    const modules = await prisma.module.findMany({
      where: {
        businessId: businessId
      },
      include: {
        developer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('Error getting business modules:', error);
    res.status(500).json({ success: false, error: 'Failed to get business modules' });
  }
}; 

// Get runtime configuration for a module (sanitized manifest for frontend runtime)
export const getModuleRuntimeConfig = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { moduleId } = req.params;
    const scope = (req.query.scope as 'personal' | 'business') || 'personal';
    const businessId = req.query.businessId as string | undefined;

    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        installations: scope === 'personal' ? { where: { userId: user.id }, take: 1 } : false,
        businessInstallations: scope === 'business' && businessId ? { where: { businessId }, take: 1 } : false,
        subscriptions:
          scope === 'personal'
            ? { where: { userId: user.id, status: 'active' }, take: 1 }
            : businessId
            ? { where: { businessId, status: 'active' }, take: 1 }
            : false,
      } as any,
    });

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.status !== 'APPROVED') {
      return res.status(400).json({ success: false, error: 'Module not approved' });
    }

    const isInstalled = scope === 'business' ? Boolean((module as any).businessInstallations?.length) : Boolean((module as any).installations?.length);
    if (!isInstalled) {
      return res.status(403).json({ success: false, error: scope === 'business' ? 'Module not installed for business' : 'Module not installed by user' });
    }

    // For paid modules, ensure an active subscription exists
    if (module.pricingTier && module.pricingTier !== 'free') {
      const hasActiveSubscription = Boolean((module as any).subscriptions?.length);
      if (!hasActiveSubscription) {
        return res.status(402).json({ success: false, error: 'Active subscription required' });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest: any = (module as any).manifest || {};
    const runtime = manifest.runtime || {};
    const frontend = manifest.frontend || {};
    const entryUrl = frontend.entryUrl;

    if (!entryUrl || typeof entryUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Module manifest missing frontend.entryUrl' });
    }

    // Build a sanitized runtime config response
    const runtimeConfig = {
      id: module.id,
      name: (module as any).name,
      version: (module as any).version,
      runtime: {
        apiVersion: typeof runtime.apiVersion === 'string' ? runtime.apiVersion : 'v1',
      },
      frontend: {
        entryUrl,
      },
      permissions: Array.isArray((module as any).permissions) ? (module as any).permissions : [],
      settings: manifest.settings && typeof manifest.settings === 'object' ? manifest.settings : {},
      accessContext: { scope, businessId: scope === 'business' ? businessId : undefined },
    };

    return res.json({ success: true, data: runtimeConfig });
  } catch (error) {
    console.error('Error getting module runtime config:', error);
    return res.status(500).json({ success: false, error: 'Failed to get module runtime config' });
  }
};