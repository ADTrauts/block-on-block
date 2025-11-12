/**
 * useHRFeatures Hook
 * 
 * Returns HR features available based on business subscription tier
 * 
 * Tiers:
 * - Business Advanced: Limited HR (50 employees, basic attendance)
 * - Enterprise: Full HR (unlimited employees, payroll, recruitment, etc.)
 */

'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';

interface HRFeatures {
  tier: 'business_advanced' | 'enterprise' | null;
  hasHRAccess: boolean;
  employees: {
    enabled: boolean;
    limit: number | null;
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

interface UseHRFeaturesReturn extends HRFeatures {
  loading: boolean;
  canAccessHR: (businessTier?: string) => boolean;
  getFeatureUpgradeMessage: (feature: string) => string | null;
}

/**
 * Hook to check HR feature availability
 * Usage: const { hasHRAccess, payroll, tier } = useHRFeatures();
 */
export function useHRFeatures(businessTier?: string): UseHRFeaturesReturn {
  const { data: session, status } = useSession();
  const loading = status === 'loading';
  
  // Get tier from parameter or session
  const tier = useMemo(() => {
    if (businessTier) {
      return businessTier;
    }
    
    // TODO: Get from business context or subscription API
    // For now, return null (no HR access)
    return null;
  }, [businessTier]);
  
  const features = useMemo((): HRFeatures => {
    if (tier === 'enterprise') {
      return {
        tier: 'enterprise',
        hasHRAccess: true,
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
      };
    }
    
    if (tier === 'business_advanced') {
      return {
        tier: 'business_advanced',
        hasHRAccess: true,
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
        payroll: false,        // Enterprise only
        recruitment: false,    // Enterprise only
        performance: false,    // Enterprise only
        benefits: false        // Enterprise only
      };
    }
    
    // No HR access
    return {
      tier: null,
      hasHRAccess: false,
      employees: {
        enabled: false,
        limit: 0,
        customFields: false
      },
      attendance: {
        enabled: false,
        clockInOut: false,
        geolocation: false
      },
      onboarding: {
        enabled: false,
        automation: false
      },
      payroll: false,
      recruitment: false,
      performance: false,
      benefits: false
    };
  }, [tier]);
  
  /**
   * Check if a tier has HR access
   */
  const canAccessHR = (checkTier?: string): boolean => {
    const tierToCheck = checkTier || tier;
    return tierToCheck === 'business_advanced' || tierToCheck === 'enterprise';
  };
  
  /**
   * Get upgrade message for a feature
   */
  const getFeatureUpgradeMessage = (feature: string): string | null => {
    const ENTERPRISE_ONLY = ['payroll', 'recruitment', 'performance', 'benefits', 'clockInOut', 'geolocation'];
    
    if (!features.hasHRAccess) {
      return 'Upgrade to Business Advanced or Enterprise to access HR features';
    }
    
    if (features.tier === 'business_advanced' && ENTERPRISE_ONLY.includes(feature)) {
      return 'Upgrade to Enterprise to access this feature';
    }
    
    return null;
  };
  
  return {
    ...features,
    loading,
    canAccessHR,
    getFeatureUpgradeMessage
  };
}

/**
 * Helper: Get required tier for a feature
 */
export function getRequiredTierForFeature(feature: string): 'business_advanced' | 'enterprise' {
  const ENTERPRISE_ONLY = ['payroll', 'recruitment', 'performance', 'benefits', 'clockInOut', 'geolocation'];
  return ENTERPRISE_ONLY.includes(feature) ? 'enterprise' : 'business_advanced';
}

