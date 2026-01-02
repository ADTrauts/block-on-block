/**
 * Verification script for Stripe setup
 * 
 * This script verifies:
 * 1. Stripe environment variables are set
 * 2. Database pricing records exist
 * 3. Pricing amounts match between database and config
 * 4. Stripe products/prices exist (optional check)
 * 
 * Usage:
 *   pnpm stripe:verify
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../lib/prisma';
import { stripe, isStripeConfigured, PRICING_CONFIG } from '../config/stripe';

interface VerificationResult {
  step: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

async function verifyStripeSetup() {
  const results: VerificationResult[] = [];

  console.log('🔍 Verifying Stripe Setup...\n');

  // Step 1: Check Stripe environment variables
  console.log('1️⃣ Checking Stripe environment variables...');
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;
  const hasPublishableKey = !!process.env.STRIPE_PUBLISHABLE_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;

  if (hasSecretKey && process.env.STRIPE_SECRET_KEY) {
    const isTest = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
    results.push({
      step: 'Stripe Secret Key',
      status: 'pass',
      message: `✅ Set (${isTest ? 'TEST' : 'LIVE'} mode)`,
    });
  } else {
    results.push({
      step: 'Stripe Secret Key',
      status: 'fail',
      message: '❌ Not set - Required for Stripe operations',
    });
  }

  if (hasPublishableKey) {
    results.push({
      step: 'Stripe Publishable Key',
      status: 'pass',
      message: '✅ Set',
    });
  } else {
    results.push({
      step: 'Stripe Publishable Key',
      status: 'warning',
      message: '⚠️  Not set - Required for frontend checkout',
    });
  }

  if (hasWebhookSecret) {
    results.push({
      step: 'Stripe Webhook Secret',
      status: 'pass',
      message: '✅ Set',
    });
  } else {
    results.push({
      step: 'Stripe Webhook Secret',
      status: 'warning',
      message: '⚠️  Not set - Required for webhook verification',
    });
  }

  // Step 2: Check database pricing records
  console.log('\n2️⃣ Checking database pricing records...');
  const pricingConfigs = await prisma.pricingConfig.findMany({
    where: { isActive: true },
    orderBy: [{ tier: 'asc' }, { billingCycle: 'asc' }],
  });

  if (pricingConfigs.length === 0) {
    results.push({
      step: 'Database Pricing Records',
      status: 'fail',
      message: '❌ No pricing records found - Run seedPricing.ts first',
    });
  } else {
    results.push({
      step: 'Database Pricing Records',
      status: 'pass',
      message: `✅ Found ${pricingConfigs.length} pricing record(s)`,
    });

    // Check each tier
    const expectedTiers = ['free', 'pro', 'business_basic', 'business_advanced', 'enterprise'];
    const foundTiers = new Set(pricingConfigs.map((p) => p.tier));

    for (const tier of expectedTiers) {
      const tierConfigs = pricingConfigs.filter((p) => p.tier === tier);
      const hasMonthly = tierConfigs.some((p) => p.billingCycle === 'monthly');
      const hasYearly = tierConfigs.some((p) => p.billingCycle === 'yearly');

      if (hasMonthly && hasYearly) {
        results.push({
          step: `  ${tier} pricing`,
          status: 'pass',
          message: '✅ Monthly and yearly configured',
        });
      } else {
        results.push({
          step: `  ${tier} pricing`,
          status: 'warning',
          message: `⚠️  Missing: ${!hasMonthly ? 'monthly' : ''} ${!hasYearly ? 'yearly' : ''}`.trim(),
        });
      }
    }
  }

  // Step 3: Verify pricing amounts match config
  console.log('\n3️⃣ Verifying pricing amounts match config...');
  if (pricingConfigs.length > 0) {
    const tierMap: Record<string, keyof typeof PRICING_CONFIG> = {
      free: 'FREE',
      pro: 'PRO',
      business_basic: 'BUSINESS_BASIC',
      business_advanced: 'BUSINESS_ADVANCED',
      enterprise: 'ENTERPRISE',
    };

    for (const config of pricingConfigs) {
      if (config.tier === 'free') continue; // Skip free tier

      const configKey = tierMap[config.tier];
      const expectedConfig = PRICING_CONFIG[configKey] as any;

      if (expectedConfig) {
        const expectedAmount =
          config.billingCycle === 'monthly'
            ? expectedConfig.monthly
            : expectedConfig.yearly;

        if (Math.abs(config.basePrice - expectedAmount) < 0.01) {
          results.push({
            step: `  ${config.tier}/${config.billingCycle} amount`,
            status: 'pass',
            message: `✅ $${config.basePrice.toFixed(2)} matches config`,
          });
        } else {
          results.push({
            step: `  ${config.tier}/${config.billingCycle} amount`,
            status: 'fail',
            message: `❌ Mismatch: DB=$${config.basePrice.toFixed(2)}, Config=$${expectedAmount.toFixed(2)}`,
          });
        }
      }
    }
  }

  // Step 4: Check Stripe price IDs in database
  console.log('\n4️⃣ Checking Stripe price IDs in database...');
  const configsWithPriceIds = pricingConfigs.filter(
    (p) => p.stripePriceId && p.tier !== 'free'
  );
  const configsWithoutPriceIds = pricingConfigs.filter(
    (p) => !p.stripePriceId && p.tier !== 'free'
  );

  if (configsWithoutPriceIds.length === 0 && configsWithPriceIds.length > 0) {
    results.push({
      step: 'Stripe Price IDs',
      status: 'pass',
      message: `✅ All ${configsWithPriceIds.length} price(s) have Stripe IDs`,
    });
  } else if (configsWithPriceIds.length > 0) {
    results.push({
      step: 'Stripe Price IDs',
      status: 'warning',
      message: `⚠️  ${configsWithPriceIds.length} synced, ${configsWithoutPriceIds.length} missing - Run syncStripePrices.ts`,
    });
  } else {
    results.push({
      step: 'Stripe Price IDs',
      status: 'warning',
      message: '⚠️  No Stripe price IDs found - Run setup-stripe-products.js then syncStripePrices.ts',
    });
  }

  // Step 5: Verify Stripe connection (optional)
  console.log('\n5️⃣ Verifying Stripe API connection...');
  if (isStripeConfigured() && stripe) {
    try {
      // Try to list products to verify connection
      const products = await stripe.products.list({ limit: 1 });
      results.push({
        step: 'Stripe API Connection',
        status: 'pass',
        message: '✅ Connected successfully',
      });

      // Check if products exist
      const allProducts = await stripe.products.list({ limit: 100 });
      const expectedProductIds = [
        'prod_pro',
        'prod_business_basic',
        'prod_business_advanced',
        'prod_enterprise',
      ];

      const foundProductIds = allProducts.data.map((p) => p.id);
      const missingProducts = expectedProductIds.filter(
        (id) => !foundProductIds.includes(id)
      );

      if (missingProducts.length === 0) {
        results.push({
          step: 'Stripe Products',
          status: 'pass',
          message: `✅ All ${expectedProductIds.length} products exist in Stripe`,
        });
      } else {
        results.push({
          step: 'Stripe Products',
          status: 'warning',
          message: `⚠️  Missing products: ${missingProducts.join(', ')} - Run setup-stripe-products.js`,
        });
      }
    } catch (error) {
      const err = error as Error;
      results.push({
        step: 'Stripe API Connection',
        status: 'fail',
        message: `❌ Connection failed: ${err.message}`,
      });
    }
  } else {
    results.push({
      step: 'Stripe API Connection',
      status: 'warning',
      message: '⚠️  Cannot verify - Stripe not configured',
    });
  }

  // Print summary
  console.log('\n📊 Verification Summary:');
  console.log('='.repeat(50));

  const passed = results.filter((r) => r.status === 'pass').length;
  const warnings = results.filter((r) => r.status === 'warning').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  results.forEach((result) => {
    const icon =
      result.status === 'pass'
        ? '✅'
        : result.status === 'warning'
          ? '⚠️'
          : '❌';
    console.log(`${icon} ${result.step}: ${result.message}`);
  });

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0 && warnings === 0) {
    console.log('\n🎉 All checks passed! Ready to proceed with Stripe setup.');
  } else if (failed === 0) {
    console.log('\n⚠️  Some warnings found, but setup can proceed.');
  } else {
    console.log('\n❌ Some checks failed. Please fix issues before proceeding.');
    process.exit(1);
  }

  return results;
}

// Run if called directly
if (require.main === module) {
  verifyStripeSetup()
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { verifyStripeSetup };

