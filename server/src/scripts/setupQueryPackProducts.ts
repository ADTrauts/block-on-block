/**
 * Setup Stripe Products and Prices for AI Query Packs
 * 
 * This script creates Stripe products and prices for AI query packs
 * (one-time payment products, not subscriptions)
 * 
 * Usage:
 *   pnpm stripe:setup-query-packs
 * 
 * Requirements:
 *   - STRIPE_SECRET_KEY environment variable set in .env file
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Stripe from 'stripe';
import { isStripeConfigured, STRIPE_PRODUCTS } from '../config/stripe';
import { AI_QUERY_PACKS } from '../config/aiQueryPacks';

if (!isStripeConfigured() || !process.env.STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY environment variable is required');
  console.log('💡 Set it in server/.env file');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil' as any, // TypeScript types may lag behind Stripe API versions
});

console.log('🚀 Setting up Stripe products for AI Query Packs...\n');

const keyPreview = process.env.STRIPE_SECRET_KEY?.substring(0, 12) || 'unknown';
const isTest = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || false;
console.log(`🔑 Using Stripe key: ${keyPreview}...`);
console.log(`🌍 Environment: ${isTest ? 'TEST' : 'LIVE'}`);
console.log();

async function setupQueryPackProducts() {
  try {
    // Create product for AI Query Packs
    const productId = STRIPE_PRODUCTS.AI_QUERY_PACKS;
    
    console.log(`📦 Creating product: AI Query Packs`);
    
    let product;
    try {
      product = await stripe.products.create({
        id: productId,
        name: 'AI Query Packs',
        description: 'One-time purchase of additional AI queries that never expire',
        type: 'service',
      });
      console.log(`✅ Product created: ${product.id}`);
    } catch (error: unknown) {
      const err = error as Stripe.errors.StripeError;
      if (err.code === 'resource_already_exists') {
        console.log(`⚠️  Product ${productId} already exists, using existing product...`);
        product = await stripe.products.retrieve(productId);
      } else {
        throw error;
      }
    }

    console.log();

    // Create prices for each query pack
    const packTypes = Object.keys(AI_QUERY_PACKS) as Array<keyof typeof AI_QUERY_PACKS>;
    
    for (const packType of packTypes) {
      const pack = AI_QUERY_PACKS[packType];
      console.log(`💰 Creating price for ${pack.name}...`);

      try {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(pack.price * 100), // Convert to cents
          currency: 'usd',
          metadata: {
            packType,
            queries: pack.queries.toString(),
            type: 'ai_query_pack',
          },
          nickname: `${pack.name} - ${pack.queries.toLocaleString()} queries`,
        });

        console.log(`  ✅ Price created: ${price.id}`);
        console.log(`     Amount: $${pack.price.toFixed(2)} (${pack.queries.toLocaleString()} queries)`);
        console.log();
      } catch (error: unknown) {
        const err = error as Stripe.errors.StripeError;
        if (err.code === 'resource_already_exists') {
          console.log(`  ⚠️  Price for ${pack.name} already exists, skipping...`);
          console.log();
        } else {
          console.error(`  ❌ Error creating price for ${pack.name}:`, err.message);
          console.log();
        }
      }
    }

    console.log('🎉 AI Query Pack products and prices setup complete!');
    console.log();
    console.log('📋 Summary:');
    console.log(`  Product: ${product.name} (${product.id})`);
    console.log(`  Packs created: ${packTypes.length}`);
    packTypes.forEach(packType => {
      const pack = AI_QUERY_PACKS[packType];
      console.log(`    • ${pack.name}: $${pack.price.toFixed(2)} (${pack.queries.toLocaleString()} queries)`);
    });
    console.log();
    console.log('💡 Next Steps:');
    console.log('1. Run: pnpm stripe:sync-query-pack-prices (to sync price IDs to config)');
    console.log('2. Update code to use Stripe Price IDs instead of hardcoded amounts');
    console.log('3. Test query pack purchase flow');
  } catch (error) {
    const err = error as Error;
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupQueryPackProducts()
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { setupQueryPackProducts };

