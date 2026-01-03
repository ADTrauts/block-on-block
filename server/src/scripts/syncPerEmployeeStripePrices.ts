/**
 * Sync existing per-employee prices to Stripe
 * 
 * This script:
 * 1. Finds all pricing configs with perEmployeePrice but no perEmployeeStripePriceId
 * 2. Creates Stripe prices for them
 * 3. Updates the database with the new Stripe price IDs
 * 
 * Usage:
 *   pnpm stripe:sync-per-employee
 * 
 * Requirements:
 *   - STRIPE_SECRET_KEY environment variable set in .env file
 *   - Pricing configs with perEmployeePrice already set in database
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../lib/prisma';
import { stripe, isStripeConfigured, STRIPE_PRODUCTS } from '../config/stripe';
import { StripeService } from '../services/stripeService';
import { logger } from '../lib/logger';

if (!isStripeConfigured() || !stripe) {
  console.error('❌ Error: STRIPE_SECRET_KEY environment variable is required');
  console.log('💡 Set it in server/.env file');
  process.exit(1);
}

async function syncPerEmployeePrices() {
  console.log('🔄 Syncing per-employee prices to Stripe...\n');

  const keyPreview = process.env.STRIPE_SECRET_KEY?.substring(0, 12) || 'unknown';
  const isTest = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || false;
  console.log(`🔑 Using Stripe key: ${keyPreview}...`);
  console.log(`🌍 Environment: ${isTest ? 'TEST' : 'LIVE'}`);
  console.log();

  // Map tier to Stripe product ID
  const tierToProductId: Record<string, string> = {
    pro: STRIPE_PRODUCTS.PRO,
    business_basic: STRIPE_PRODUCTS.BUSINESS_BASIC,
    business_advanced: STRIPE_PRODUCTS.BUSINESS_ADVANCED,
    enterprise: STRIPE_PRODUCTS.ENTERPRISE,
  };

  // Find all pricing configs with perEmployeePrice but no perEmployeeStripePriceId
  const pricingConfigs = await prisma.pricingConfig.findMany({
    where: {
      isActive: true,
      perEmployeePrice: { not: null },
      OR: [
        { perEmployeeStripePriceId: null },
        { perEmployeeStripePriceId: '' },
      ],
    },
    orderBy: [
      { tier: 'asc' },
      { billingCycle: 'asc' },
    ],
  });

  console.log(`Found ${pricingConfigs.length} pricing configs needing per-employee Stripe prices\n`);

  if (pricingConfigs.length === 0) {
    console.log('✅ All per-employee prices are already synced!');
    return;
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const config of pricingConfigs) {
    const productId = tierToProductId[config.tier];
    if (!productId) {
      console.log(`⚠️  No product ID mapping for tier: ${config.tier}`);
      skipped++;
      continue;
    }

    if (!config.perEmployeePrice || config.perEmployeePrice <= 0) {
      console.log(`⚠️  Invalid per-employee price for ${config.tier}/${config.billingCycle}`);
      skipped++;
      continue;
    }

    try {
      console.log(`📦 Creating per-employee price for ${config.tier}/${config.billingCycle}...`);

      const interval = config.billingCycle === 'monthly' ? 'month' : 'year';
      const amountInCents = Math.round(config.perEmployeePrice * 100);

      // Create Stripe price
      const perEmployeePrice = await StripeService.createPrice(
        productId,
        amountInCents,
        'usd',
        {
          interval: interval as 'month' | 'year',
          metadata: {
            type: 'per_employee',
            tier: config.tier,
            billingCycle: config.billingCycle,
          },
        }
      );

      // Update database with Stripe price ID
      await prisma.pricingConfig.update({
        where: { id: config.id },
        data: { perEmployeeStripePriceId: perEmployeePrice.id },
      });

      console.log(`  ✅ Created: ${perEmployeePrice.id}`);
      console.log(`     Amount: $${config.perEmployeePrice.toFixed(2)}/${interval}`);
      created++;

      await logger.info('Created per-employee Stripe price', {
        operation: 'sync_per_employee_stripe_price',
        tier: config.tier,
        billingCycle: config.billingCycle,
        stripePriceId: perEmployeePrice.id,
        amount: config.perEmployeePrice,
      });
    } catch (error) {
      errors++;
      const err = error as Error;
      console.error(`  ❌ Error: ${err.message}`);
      
      await logger.error('Failed to create per-employee Stripe price', {
        operation: 'sync_per_employee_stripe_price',
        tier: config.tier,
        billingCycle: config.billingCycle,
        error: {
          message: err.message,
          stack: err.stack,
        },
      });
    }

    console.log();
  }

  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log();

  if (created > 0) {
    console.log('✅ Per-employee prices synced successfully!');
    console.log('💡 You can verify them by running: pnpm stripe:list-per-employee');
  }
}

// Run if called directly
if (require.main === module) {
  syncPerEmployeePrices()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { syncPerEmployeePrices };

