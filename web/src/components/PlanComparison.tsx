'use client';

import React from 'react';
import { Card, Button, Badge } from 'shared/components';
import { Check, X } from 'lucide-react';

export type Tier = 'free' | 'pro' | 'business_basic' | 'business_advanced' | 'enterprise';

export interface TierFeature {
  name: string;
  tiers: {
    free: boolean | string;
    pro: boolean | string;
    business_basic: boolean | string;
    business_advanced: boolean | string;
    enterprise: boolean | string;
  };
}

interface PlanComparisonProps {
  currentTier?: Tier;
  onSelectTier?: (tier: Tier) => void;
  showActions?: boolean;
  userType?: 'personal' | 'business'; // Filter plans based on user type
}

// Feature definitions for comparison table
const TIER_FEATURES: TierFeature[] = [
  {
    name: 'Price (Monthly)',
    tiers: {
      free: '$0',
      pro: '$29.00',
      business_basic: '$49.99',
      business_advanced: '$69.99',
      enterprise: '$129.99',
    },
  },
  {
    name: 'Price (Yearly)',
    tiers: {
      free: '$0',
      pro: '$290.00',
      business_basic: '$499.99',
      business_advanced: '$699.99',
      enterprise: '$1,299.99',
    },
  },
  {
    name: 'Core Modules',
    tiers: {
      free: true,
      pro: true,
      business_basic: true,
      business_advanced: true,
      enterprise: true,
    },
  },
  {
    name: 'AI Queries (Monthly)',
    tiers: {
      free: '50',
      pro: '1,000 + packs',
      business_basic: '2,000 + packs',
      business_advanced: '5,000 + packs',
      enterprise: 'Unlimited',
    },
  },
  {
    name: 'Storage',
    tiers: {
      free: '5 GB',
      pro: '100 GB',
      business_basic: '500 GB',
      business_advanced: '2 TB',
      enterprise: 'Unlimited',
    },
  },
  {
    name: 'Ad-Free Experience',
    tiers: {
      free: false,
      pro: true,
      business_basic: true,
      business_advanced: true,
      enterprise: true,
    },
  },
  {
    name: 'Team Management',
    tiers: {
      free: false,
      pro: false,
      business_basic: true,
      business_advanced: true,
      enterprise: true,
    },
  },
  {
    name: 'Advanced AI Settings',
    tiers: {
      free: false,
      pro: false,
      business_basic: false,
      business_advanced: true,
      enterprise: true,
    },
  },
  {
    name: 'Advanced Analytics',
    tiers: {
      free: false,
      pro: false,
      business_basic: false,
      business_advanced: true,
      enterprise: true,
    },
  },
  {
    name: 'Data Loss Prevention',
    tiers: {
      free: false,
      pro: false,
      business_basic: false,
      business_advanced: true,
      enterprise: true,
    },
  },
  {
    name: 'Custom Integrations',
    tiers: {
      free: false,
      pro: false,
      business_basic: false,
      business_advanced: false,
      enterprise: true,
    },
  },
  {
    name: 'Dedicated Support',
    tiers: {
      free: false,
      pro: false,
      business_basic: false,
      business_advanced: false,
      enterprise: true,
    },
  },
];

const TIER_NAMES: Record<Tier, string> = {
  free: 'Free',
  pro: 'Pro',
  business_basic: 'Business Basic',
  business_advanced: 'Business Advanced',
  enterprise: 'Enterprise',
};

const TIER_COLORS: Record<Tier, 'gray' | 'blue' | 'green' | 'yellow' | 'red'> = {
  free: 'gray',
  pro: 'blue',
  business_basic: 'green',
  business_advanced: 'green', // Using green since purple isn't available
  enterprise: 'yellow',
};

export default function PlanComparison({ currentTier, onSelectTier, showActions = true, userType }: PlanComparisonProps) {
  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-green-600" />
      ) : (
        <X className="h-5 w-5 text-gray-400" />
      );
    }
    return <span className="text-sm text-gray-700">{value}</span>;
  };

  const isCurrentTier = (tier: Tier) => tier === currentTier;

  // Filter tiers based on user type
  const getAvailableTiers = (): Tier[] => {
    if (userType === 'business') {
      // Business users can only see business plans
      return ['free', 'business_basic', 'business_advanced', 'enterprise'];
    } else if (userType === 'personal') {
      // Personal users can only see personal plans
      return ['free', 'pro'];
    }
    // Default: show all tiers (for backwards compatibility)
    return ['free', 'pro', 'business_basic', 'business_advanced', 'enterprise'];
  };

  const availableTiers = getAvailableTiers();

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Plan</h3>
        <p className="text-gray-600">Compare features and find the perfect plan for your needs</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-4 border-b border-gray-200 font-semibold text-gray-900">Feature</th>
                {availableTiers.map((tier) => (
                  <th key={tier} className="text-center p-4 border-b border-gray-200">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">{TIER_NAMES[tier]}</span>
                        {isCurrentTier(tier) && (
                          <Badge color={TIER_COLORS[tier]} className="text-xs">Current</Badge>
                        )}
                      </div>
                      {showActions && onSelectTier && !isCurrentTier(tier) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectTier(tier)}
                          className="mt-2"
                        >
                          {currentTier && ['free', 'pro'].includes(currentTier) && ['business_basic', 'business_advanced', 'enterprise'].includes(tier)
                            ? 'Upgrade'
                            : currentTier && ['business_basic', 'business_advanced', 'enterprise'].includes(currentTier) && ['free', 'pro'].includes(tier)
                            ? 'Downgrade'
                            : currentTier && tier === 'enterprise'
                            ? 'Upgrade'
                            : 'Select'}
                        </Button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIER_FEATURES.map((feature, index) => (
                <tr key={feature.name} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="p-4 border-b border-gray-200 font-medium text-gray-900">{feature.name}</td>
                  {availableTiers.map((tier) => (
                    <td key={tier} className="p-4 border-b border-gray-200 text-center">
                      {renderFeatureValue(feature.tiers[tier])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600 text-center">
        <p>All prices are in USD. Business plans include 10 employees, additional employees are $5/month each.</p>
        <p className="mt-1">Yearly plans save approximately 17% compared to monthly billing.</p>
      </div>
    </div>
  );
}

