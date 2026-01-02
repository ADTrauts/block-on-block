/**
 * Sync Stripe price IDs to database pricing records
 * 
 * This script:
 * 1. Fetches all Stripe products and prices
 * 2. Matches them to database pricing records by tier and billing cycle
 * 3. Updates database with stripePriceId values
 * 
 * Usage:
 *   pnpm stripe:sync
 * 
 * Requirements:
 *   - STRIPE_SECRET_KEY environment variable set in .env file
 *   - Pricing records already exist in database (run seedPricing.ts first)
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../lib/prisma';
import { stripe, isStripeConfigured } from '../config/stripe';

async function syncStripePrices() {
  if (!isStripeConfigured() || !stripe) {
    console.error('❌ Stripe is not configured');
    console.log('💡 Set STRIPE_SECRET_KEY environment variable');
    process.exit(1);
  }

  console.log('🔄 Syncing Stripe prices to database...\n');

  // Map of tier names (database) to product IDs (Stripe)
  const tierToProductId: Record<string, string> = {
    'pro': 'prod_pro',
    'business_basic': 'prod_business_basic',
    'business_advanced': 'prod_business_advanced',
    'enterprise': 'prod_enterprise',
  };

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  // Get all active pricing configs from database
  const pricingConfigs = await prisma.pricingConfig.findMany({
    where: {
      isActive: true,
      tier: { not: 'free' }, // Free tier doesn't need Stripe
    },
    orderBy: [
      { tier: 'asc' },
      { billingCycle: 'asc' },
    ],
  });

  console.log(`Found ${pricingConfigs.length} pricing configs to sync\n`);

  for (const config of pricingConfigs) {
    const productId = tierToProductId[config.tier];
    if (!productId) {
      console.log(`⚠️  No product ID mapping for tier: ${config.tier}`);
      skipped++;
      continue;
    }

    try {
      // Get all prices for this product from Stripe
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
      });

      // Find matching price by interval
      const interval = config.billingCycle === 'monthly' ? 'month' : 'year';
      const matchingPrice = prices.data.find(
        (p) => p.recurring?.interval === interval
      );

      if (!matchingPrice) {
        console.log(`⚠️  No Stripe price found for ${config.tier}/${config.billingCycle}`);
        console.log(`   Product ID: ${productId}, Interval: ${interval}`);
        skipped++;
        continue;
      }

      // Verify amount matches (within 1 cent tolerance for rounding)
      const expectedAmount = Math.round(config.basePrice * 100);
      const actualAmount = matchingPrice.unit_amount || 0;
      
      if (Math.abs(expectedAmount - actualAmount) > 1) {
        console.log(`⚠️  Price mismatch for ${config.tier}/${config.billingCycle}:`);
        console.log(`   Database: $${config.basePrice.toFixed(2)} (${expectedAmount} cents)`);
        console.log(`   Stripe: $${(actualAmount / 100).toFixed(2)} (${actualAmount} cents)`);
        console.log(`   Difference: $${Math.abs(expectedAmount - actualAmount) / 100}`);
        skipped++;
        continue;
      }

      // Check if already synced
      if (config.stripePriceId === matchingPrice.id) {
        console.log(`✓ Already synced ${config.tier}/${config.billingCycle}: ${matchingPrice.id}`);
        skipped++;
        continue;
      }

      // Update database with Stripe price ID
      await prisma.pricingConfig.update({
        where: { id: config.id },
        data: { stripePriceId: matchingPrice.id },
      });

      console.log(`✅ Synced ${config.tier}/${config.billingCycle}: ${matchingPrice.id}`);
      synced++;
    } catch (error) {
      const err = error as Error;
      console.error(`❌ Error syncing ${config.tier}/${config.billingCycle}:`, err.message);
      errors++;
    }
  }

  console.log(`\n📊 Sync Summary:`);
  console.log(`   ✅ Synced: ${synced}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📦 Total: ${pricingConfigs.length}`);

  if (synced > 0) {
    console.log(`\n🎉 Sync completed! ${synced} price(s) synced to database.`);
  } else if (errors === 0) {
    console.log(`\n✅ All prices already synced or skipped.`);
  } else {
    console.log(`\n⚠️  Sync completed with errors. Please review above.`);
  }
}

// Run if called directly
if (require.main === module) {
  syncStripePrices()
    .catch((error) => {
      console.error('❌ Error syncing prices:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { syncStripePrices };

