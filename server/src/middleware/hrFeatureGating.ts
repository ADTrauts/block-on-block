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

type HRFeatureOverrides = {
  employees?: {
    enabled?: boolean;
    customFields?: boolean;
  };
  attendance?: {
    enabled?: boolean;
    clockInOut?: boolean;
    geolocation?: boolean;
  };
  onboarding?: {
    enabled?: boolean;
    automation?: boolean;
  };
  payroll?: boolean;
  recruitment?: boolean;
  performance?: boolean;
  benefits?: boolean;
};

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

function applyFeatureOverrides(base: HRFeatures, overrides?: HRFeatureOverrides | null): HRFeatures {
  if (!overrides) {
    return base;
  }

  const employeesOverride = overrides.employees ?? {};
  const employeesEnabled = base.employees.enabled && (employeesOverride.enabled ?? true);
  const employeesCustomFields =
    employeesEnabled && base.employees.customFields && (employeesOverride.customFields ?? true);

  const attendanceOverride = overrides.attendance ?? {};
  const attendanceEnabled = base.attendance.enabled && (attendanceOverride.enabled ?? true);
  const attendanceClockInOut =
    attendanceEnabled && base.attendance.clockInOut && (attendanceOverride.clockInOut ?? true);
  const attendanceGeolocation =
    attendanceEnabled && base.attendance.geolocation && (attendanceOverride.geolocation ?? true);

  const onboardingOverride = overrides.onboarding ?? {};
  const onboardingEnabled = base.onboarding.enabled && (onboardingOverride.enabled ?? true);
  const onboardingAutomation =
    onboardingEnabled && base.onboarding.automation && (onboardingOverride.automation ?? true);

  return {
    employees: {
      enabled: employeesEnabled,
      limit: employeesEnabled ? base.employees.limit : 0,
      customFields: employeesCustomFields
    },
    attendance: {
      enabled: attendanceEnabled,
      clockInOut: attendanceClockInOut,
      geolocation: attendanceGeolocation
    },
    onboarding: {
      enabled: onboardingEnabled,
      automation: onboardingAutomation
    },
    payroll: base.payroll && (overrides.payroll ?? true),
    recruitment: base.recruitment && (overrides.recruitment ?? true),
    performance: base.performance && (overrides.performance ?? true),
    benefits: base.benefits && (overrides.benefits ?? true)
  };
}

async function getHRFeatureOverrides(businessId: string): Promise<HRFeatureOverrides | null> {
  const installation = await prisma.businessModuleInstallation.findUnique({
    where: { moduleId_businessId: { moduleId: 'hr', businessId } },
    select: { configured: true }
  });

  if (!installation?.configured) {
    return null;
  }

  const configured = installation.configured as {
    settings?: { hrFeatures?: HRFeatureOverrides };
  } | null;

  return configured?.settings?.hrFeatures ?? null;
}

/**
 * Check if tier has access to a specific HR feature
 * Feature path examples: 'payroll', 'attendance.clockInOut', 'employees.limit'
 */
export function checkFeatureAccessByFeatures(features: HRFeatures, featurePath: string): boolean {
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
  
  if (typeof current === 'object' && current !== null) {
    const record = current as Record<string, unknown>;
    if (typeof record.enabled === 'boolean') {
      return record.enabled;
    }
    const booleanValues = Object.values(record).filter(
      (value): value is boolean => typeof value === 'boolean'
    );
    if (booleanValues.length > 0) {
      return booleanValues.some(Boolean);
    }
    return true;
  }

  if (typeof current === 'number') {
    return current > 0;
  }

  return !!current;
}

export function checkFeatureAccess(tier: string, featurePath: string): boolean {
  return checkFeatureAccessByFeatures(getHRFeaturesForTier(tier), featurePath);
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
      
      let features = req.hrFeatures as HRFeatures | undefined;
      if (!features) {
        const overrides = await getHRFeatureOverrides(businessId);
        features = applyFeatureOverrides(getHRFeaturesForTier(tier), overrides);
      }

      const hasAccess = checkFeatureAccessByFeatures(features, featureName);
      
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
      req.hrFeatures = features as any;
      
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
    
    const overrides = await getHRFeatureOverrides(businessId);
    const features = applyFeatureOverrides(getHRFeaturesForTier(tier), overrides);
    
    req.hrTier = tier;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req.hrFeatures = features as any;
    
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

  const overrides = await getHRFeatureOverrides(businessId);
  const features = applyFeatureOverrides(getHRFeaturesForTier(tier), overrides);

  return {
    tier,
    features
  };
}

