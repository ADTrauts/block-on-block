/**
 * AI Query Pack Configuration
 * 
 * Defines available query packs for purchase and base allowances by subscription tier.
 * Query packs are one-time purchases that never expire (unlike monthly base allowances).
 */

export const AI_QUERY_PACKS = {
  small: {
    queries: 500,
    price: 10.0,
    name: 'Small Pack',
    description: '500 additional queries',
    stripePriceId: process.env.STRIPE_QUERY_PACK_SMALL_PRICE_ID || '', // Set after running setup script
  },
  medium: {
    queries: 2500,
    price: 40.0, // 20% discount vs buying 5 small packs (50.00)
    name: 'Medium Pack',
    description: '2,500 additional queries (Best Value)',
    stripePriceId: process.env.STRIPE_QUERY_PACK_MEDIUM_PRICE_ID || '', // Set after running setup script
  },
  large: {
    queries: 5000,
    price: 70.0, // 30% discount vs buying 10 small packs (100.00)
    name: 'Large Pack',
    description: '5,000 additional queries',
    stripePriceId: process.env.STRIPE_QUERY_PACK_LARGE_PRICE_ID || '', // Set after running setup script
  },
  enterprise: {
    queries: 10000,
    price: 120.0, // 40% discount vs buying 20 small packs (200.00)
    name: 'Enterprise Pack',
    description: '10,000 additional queries',
    stripePriceId: process.env.STRIPE_QUERY_PACK_ENTERPRISE_PRICE_ID || '', // Set after running setup script
  },
} as const;

export type QueryPackType = keyof typeof AI_QUERY_PACKS;

/**
 * Base AI query allowances by subscription tier (per month)
 * -1 means unlimited (Enterprise tier only)
 */
export const AI_BASE_ALLOWANCES = {
  free: 50,
  pro: 1000,
  business_basic: 2000, // Team-wide pool
  business_advanced: 5000, // Team-wide pool
  enterprise: -1, // Unlimited (-1 means unlimited)
} as const;

export type SubscriptionTier = keyof typeof AI_BASE_ALLOWANCES;

/**
 * Check if a tier has unlimited queries
 */
export function isUnlimitedTier(tier: string): boolean {
  const allowance = AI_BASE_ALLOWANCES[tier as SubscriptionTier];
  return allowance === -1;
}

/**
 * Get base allowance for a tier
 */
export function getBaseAllowance(tier: string): number {
  const allowance = AI_BASE_ALLOWANCES[tier as SubscriptionTier];
  if (allowance === -1) {
    return -1; // Unlimited
  }
  return allowance ?? 0;
}

/**
 * AI Query Overage Configuration
 * Cursor-style spending limit system
 */
export const AI_QUERY_OVERAGE_CONFIG = {
  pricePerQuery: 0.02, // $0.02 per query over base allowance
  defaultLimit: 0, // Default to $0 (disabled - maintains current blocking behavior)
} as const;

