/**
 * HR MODULE FEATURE GATING MIDDLEWARE
 * 
 * Controls access to HR features based on business subscription tier
 * 
 * Tier Structure:
 * - Business Advanced: Limited HR features (50 employees, basic attendance)
 * - Enterprise: Full HR features (unlimited employees, payroll, recruitment, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

/**
 * HR Features by Tier
 */
interface HRFeatures {
  employees: {
    enabled: boolean;
    limit: number | null;  // null = unlimited
    customFields: boolean;
  };
  attendance: {
    enabled: boolean;
    clockInOut: boolean;
    geolocation: boolean;
  };
  onboarding: {
    enabled: boolean;
    automation: boolean;
  };
  payroll: boolean;
  recruitment: boolean;
  performance: boolean;
  benefits: boolean;
}

const TIER_FEATURES: Record<string, HRFeatures> = {
  business_advanced: {
    employees: {
      enabled: true,
      limit: 50,  // Max 50 employees
      customFields: false
    },
    attendance: {
      enabled: true,
      clockInOut: false,  // No clock in/out
      geolocation: false
    },
    onboarding: {
      enabled: true,
      automation: false
    },
    payroll: false,       // Enterprise only
    recruitment: false,   // Enterprise only
    performance: false,   // Enterprise only
    benefits: false       // Enterprise only
  },
  enterprise: {
    employees: {
      enabled: true,
      limit: null,  // Unlimited
      customFields: true
    },
    attendance: {
      enabled: true,
      clockInOut: true,
      geolocation: true
    },
    onboarding: {
      enabled: true,
      automation: true
    },
    payroll: true,
    recruitment: true,
    performance: true,
    benefits: true
  }
};

/**
 * Get HR features available for a business tier
 */
export function getHRFeaturesForTier(tier: string): HRFeatures {
  // Default to business_advanced if tier not found
  return TIER_FEATURES[tier] || TIER_FEATURES.business_advanced;
}

/**
 * Check if tier has access to a specific HR feature
 * Feature path examples: 'payroll', 'attendance.clockInOut', 'employees.limit'
 */
export function checkFeatureAccess(tier: string, featurePath: string): boolean {
  const features = getHRFeaturesForTier(tier);
  
  // Parse feature path (e.g., "payroll", "attendance.clockInOut")
  const parts = featurePath.split('.');
  let current: unknown = features;
  
  for (const part of parts) {
    if (typeof current === 'object' && current !== null && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return false;
    }
  }
  
  // Feature exists - check if it's enabled (boolean) or has a value
  return !!current;
}

/**
 * Get required tier for a specific feature
 */
export function getRequiredTierForFeature(featureName: string): string {
  const ENTERPRISE_ONLY = [
    'payroll',
    'recruitment',
    'performance',
    'benefits',
    'attendance.clockInOut',
    'attendance.geolocation',
    'employees.customFields',
    'onboarding.automation'
  ];
  
  return ENTERPRISE_ONLY.includes(featureName) 
    ? 'enterprise' 
    : 'business_advanced';
}

/**
 * Middleware: Check if business tier allows specific HR feature
 * Usage: router.get('/payroll', checkHRFeature('payroll'), handler)
 */
export function checkHRFeature(featureName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.query.businessId as string || req.body.businessId;
      
      if (!businessId) {
        return res.status(400).json({ error: 'Business ID required' });
      }
      
      // Get business subscription tier
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: { 
          subscriptions: {
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      
      // Get active subscription or use business tier
      const activeSub = business.subscriptions[0];
      const tier = activeSub?.tier || business.tier || 'free';
      
      // Check if HR module is even available on this tier
      if (tier !== 'business_advanced' && tier !== 'enterprise') {
        return res.status(403).json({
          error: 'HR module not available on this tier',
          currentTier: tier,
          minimumTier: 'business_advanced',
          upgradeUrl: '/billing/upgrade'
        });
      }
      
      // Check feature access by tier
      const hasAccess = checkFeatureAccess(tier, featureName);
      
      if (!hasAccess) {
        return res.status(403).json({
          error: `Feature '${featureName}' not available on ${tier} tier`,
          currentTier: tier,
          requiredTier: getRequiredTierForFeature(featureName),
          upgradeUrl: '/billing/upgrade'
        });
      }
      
      // Attach tier info to request for use in controllers
      req.hrTier = tier;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req.hrFeatures = getHRFeaturesForTier(tier) as any;
      
      next();
    } catch (error) {
      console.error('HR feature gate check error:', error);
      return res.status(500).json({ error: 'Feature check failed' });
    }
  };
}

/**
 * Middleware: Check if business has Business Advanced or Enterprise tier
 * (Minimum tier to access HR module at all)
 */
export async function checkBusinessAdvancedOrHigher(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.query.businessId as string || req.body.businessId;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }
    
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subscriptions: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    const activeSub = business.subscriptions[0];
    const tier = activeSub?.tier || business.tier || 'free';
    
    const hasAccess = tier === 'business_advanced' || tier === 'enterprise';
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'HR module requires Business Advanced or Enterprise tier',
        currentTier: tier,
        requiredTier: 'business_advanced',
        upgradeUrl: '/billing/upgrade'
      });
    }
    
    // Attach tier info for later use
    req.hrTier = tier;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req.hrFeatures = getHRFeaturesForTier(tier) as any;
    
    next();
  } catch (error) {
    console.error('Tier check error:', error);
    return res.status(500).json({ error: 'Tier check failed' });
  }
}

/**
 * Middleware: Check if HR module is installed for the business
 */
export async function checkHRModuleInstalled(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.query.businessId as string || req.body.businessId;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }
    
    // Check if HR module is installed
    const installation = await prisma.businessModuleInstallation.findFirst({
      where: {
        businessId,
        moduleId: 'hr',
        enabled: true
      }
    });
    
    if (!installation) {
      return res.status(403).json({
        error: 'HR module not installed',
        message: 'Please install the HR module from the module marketplace',
        moduleId: 'hr'
      });
    }
    
    next();
  } catch (error) {
    console.error('Module installation check error:', error);
    return res.status(500).json({ error: 'Module check failed' });
  }
}

/**
 * Helper: Get HR features for a business
 * Can be used in controllers to check feature availability
 */
export async function getBusinessHRFeatures(businessId: string): Promise<{
  tier: string;
  features: HRFeatures;
}> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      subscriptions: {
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  
  if (!business) {
    throw new Error('Business not found');
  }
  
  const activeSub = business.subscriptions[0];
  const tier = activeSub?.tier || business.tier || 'free';
  
  return {
    tier,
    features: getHRFeaturesForTier(tier)
  };
}

