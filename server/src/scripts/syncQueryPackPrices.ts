/**
 * Sync Stripe Price IDs for AI Query Packs to environment variables
 * 
 * This script:
 * 1. Fetches all Stripe prices for the AI Query Packs product
 * 2. Matches them to query pack types by metadata
 * 3. Outputs the price IDs for you to add to .env file
 * 
 * Usage:
 *   pnpm stripe:sync-query-pack-prices
 * 
 * Requirements:
 *   - STRIPE_SECRET_KEY environment variable set in .env file
 *   - Query pack products/prices already created (run stripe:setup-query-packs first)
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { isStripeConfigured, STRIPE_PRODUCTS } from '../config/stripe';
import { AI_QUERY_PACKS } from '../config/aiQueryPacks';
import Stripe from 'stripe';

if (!isStripeConfigured() || !process.env.STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY environment variable is required');
  console.log('💡 Set it in server/.env file');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil' as any,
});

async function syncQueryPackPrices() {
  console.log('🔄 Syncing Stripe price IDs for AI Query Packs...\n');

  const keyPreview = process.env.STRIPE_SECRET_KEY?.substring(0, 12) || 'unknown';
  const isTest = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || false;
  console.log(`🔑 Using Stripe key: ${keyPreview}...`);
  console.log(`🌍 Environment: ${isTest ? 'TEST' : 'LIVE'}`);
  console.log();

  try {
    const productId = STRIPE_PRODUCTS.AI_QUERY_PACKS;

    // Get all prices for the AI Query Packs product
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
    });

    if (prices.data.length === 0) {
      console.log('⚠️  No prices found for AI Query Packs product');
      console.log('💡 Run: pnpm stripe:setup-query-packs first');
      return;
    }

    console.log(`Found ${prices.data.length} prices for AI Query Packs\n`);

    // Match prices to pack types by metadata
    const packTypes = Object.keys(AI_QUERY_PACKS) as Array<keyof typeof AI_QUERY_PACKS>;
    const priceMap: Record<string, string> = {};

    for (const packType of packTypes) {
      const pack = AI_QUERY_PACKS[packType];
      
      // Find matching price by metadata.packType
      const matchingPrice = prices.data.find(
        (p) => p.metadata?.packType === packType
      );

      if (matchingPrice) {
        priceMap[packType] = matchingPrice.id;
        console.log(`✅ ${pack.name}:`);
        console.log(`   Price ID: ${matchingPrice.id}`);
        console.log(`   Amount: $${(matchingPrice.unit_amount || 0) / 100}/${pack.queries.toLocaleString()} queries`);
        console.log();
      } else {
        console.log(`⚠️  No Stripe price found for ${pack.name} (${packType})`);
        console.log();
      }
    }

    // Output environment variables to add to .env
    console.log('📋 Add these to your server/.env file:');
    console.log();
    for (const [packType, priceId] of Object.entries(priceMap)) {
      const envVarName = `STRIPE_QUERY_PACK_${packType.toUpperCase()}_PRICE_ID`;
      console.log(`${envVarName}=${priceId}`);
    }
    console.log();
    console.log('✅ Price IDs synced!');
    console.log('💡 After adding to .env, restart your server for changes to take effect');

  } catch (error) {
    const err = error as Error;
    console.error('❌ Error syncing price IDs:', err.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncQueryPackPrices()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { syncQueryPackPrices };

