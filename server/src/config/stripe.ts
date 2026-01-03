import Stripe from 'stripe';

// Stripe configuration
export const STRIPE_CONFIG = {
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  apiVersion: '2025-08-27.basil' as const,
};

// Initialize Stripe client
export const stripe = STRIPE_CONFIG.secretKey 
  ? new Stripe(STRIPE_CONFIG.secretKey, {
      apiVersion: STRIPE_CONFIG.apiVersion as any, // TypeScript types may lag behind Stripe API versions
    })
  : null;

// Stripe product IDs for different tiers
export const STRIPE_PRODUCTS = {
  FREE: 'prod_free',
  PRO: 'prod_pro',
  BUSINESS_BASIC: 'prod_business_basic',
  BUSINESS_ADVANCED: 'prod_business_advanced',
  ENTERPRISE: 'prod_enterprise',
  // AI Query Packs (one-time payment products)
  AI_QUERY_PACKS: 'prod_ai_query_packs',
};

// Stripe price IDs for different tiers
export const STRIPE_PRICES = {
  PRO_MONTHLY: 'price_pro_monthly',
  PRO_YEARLY: 'price_pro_yearly',
  BUSINESS_BASIC_MONTHLY: 'price_business_basic_monthly',
  BUSINESS_BASIC_YEARLY: 'price_business_basic_yearly',
  BUSINESS_ADVANCED_MONTHLY: 'price_business_advanced_monthly',
  BUSINESS_ADVANCED_YEARLY: 'price_business_advanced_yearly',
  ENTERPRISE_MONTHLY: 'price_enterprise_monthly',
  ENTERPRISE_YEARLY: 'price_enterprise_yearly',
};

// Pricing configuration
// NOTE: This is now deprecated - use PricingService instead
// Kept for backward compatibility during migration
export const PRICING_CONFIG = {
  FREE: {
    monthly: 0,
    yearly: 0,
    features: ['basic_modules', 'limited_ai', 'ads_supported'],
  },
  PRO: {
    monthly: 29.00,
    yearly: 290.00, // ~17% discount
    features: ['all_modules', 'unlimited_ai', 'no_ads'],
  },
  BUSINESS_BASIC: {
    monthly: 49.99,
    yearly: 499.99, // ~17% discount
    perEmployee: 5.00,
    includedEmployees: 10,
    features: ['all_modules', 'basic_ai', 'team_management', 'enterprise_features'],
  },
  BUSINESS_ADVANCED: {
    monthly: 69.99,
    yearly: 699.99, // ~17% discount
    perEmployee: 5.00,
    includedEmployees: 10,
    features: ['all_modules', 'advanced_ai', 'team_management', 'enterprise_features', 'advanced_analytics'],
  },
  ENTERPRISE: {
    monthly: 129.99,
    yearly: 1299.99, // ~17% discount
    perEmployee: 5.00,
    includedEmployees: 10,
    features: ['all_modules', 'unlimited_ai', 'team_management', 'enterprise_features', 'advanced_analytics', 'custom_integrations', 'dedicated_support'],
  },
};

/**
 * Get pricing from database (preferred method)
 * Falls back to hardcoded PRICING_CONFIG if database is not available
 */
export async function getPricingConfig(tier: string) {
  try {
    const { PricingService } = await import('../services/pricingService');
    const pricing = await PricingService.getPricingInfo(tier);
    if (pricing) {
      return pricing;
    }
  } catch (error) {
    console.warn('Failed to get pricing from database, using fallback:', error);
  }
  
  // Fallback to hardcoded config
  const tierUpper = tier.toUpperCase() as keyof typeof PRICING_CONFIG;
  const config = PRICING_CONFIG[tierUpper] as any; // Type assertion for union types
  if (!config) {
    return null;
  }
  
  return {
    monthly: config.monthly,
    yearly: config.yearly,
    perEmployee: config.perEmployee,
    includedEmployees: config.includedEmployees,
  };
}

// Revenue split configuration (DEPRECATED - Use RevenueSplitService instead)
// This is kept for backward compatibility but should not be used in new code
// The actual revenue split is now calculated dynamically based on:
// - Small Business Program (<$1M lifetime revenue = 15% platform)
// - Long-term subscriptions (>12 months = 15% platform)
// - Standard (first year, >=$1M revenue = 30% platform)
export const REVENUE_SPLIT = {
  PLATFORM_SHARE: 0.3, // 30% to platform (legacy default)
  DEVELOPER_SHARE: 0.7, // 70% to developer (legacy default)
};

// Stripe webhook events to handle
export const STRIPE_WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'transfer.created',
  'transfer.failed',
] as const;

export type StripeWebhookEvent = typeof STRIPE_WEBHOOK_EVENTS[number];

// Helper function to check if Stripe is configured
export const isStripeConfigured = (): boolean => {
  // Backend only needs secret key - publishable key is for frontend only
  return !!STRIPE_CONFIG.secretKey;
};

// Helper function to get Stripe client
export const getStripeClient = (): Stripe | null => {
  return stripe;
}; 