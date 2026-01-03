/**
 * List all per-employee Stripe prices
 * 
 * This script lists all Stripe prices that are marked as per-employee pricing
 * by checking their metadata.
 * 
 * Usage:
 *   pnpm ts-node src/scripts/listStripePerEmployeePrices.ts
 * 
 * Requirements:
 *   - STRIPE_SECRET_KEY environment variable set in .env file
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { stripe, isStripeConfigured } from '../config/stripe';
import { STRIPE_PRODUCTS } from '../config/stripe';

if (!isStripeConfigured() || !stripe) {
  console.error('❌ Error: STRIPE_SECRET_KEY environment variable is required');
  console.log('💡 Set it in server/.env file');
  process.exit(1);
}

async function listPerEmployeePrices() {
  console.log('🔍 Listing all per-employee Stripe prices...\n');

  const keyPreview = process.env.STRIPE_SECRET_KEY?.substring(0, 12) || 'unknown';
  const isTest = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || false;
  console.log(`🔑 Using Stripe key: ${keyPreview}...`);
  console.log(`🌍 Environment: ${isTest ? 'TEST' : 'LIVE'}`);
  console.log();

  // Map of product IDs to tier names
  const productIdToTier: Record<string, string> = {
    [STRIPE_PRODUCTS.PRO]: 'pro',
    [STRIPE_PRODUCTS.BUSINESS_BASIC]: 'business_basic',
    [STRIPE_PRODUCTS.BUSINESS_ADVANCED]: 'business_advanced',
    [STRIPE_PRODUCTS.ENTERPRISE]: 'enterprise',
  };

  let totalPerEmployeePrices = 0;
  let totalBasePrices = 0;

  // Get all products
  const products = Object.values(STRIPE_PRODUCTS);
  
  for (const productId of products) {
    const tier = productIdToTier[productId] || 'unknown';
    
    try {
      // Get all prices for this product
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 100,
      });

      if (prices.data.length === 0) {
        console.log(`📦 ${tier.toUpperCase()}: No prices found`);
        continue;
      }

      console.log(`📦 ${tier.toUpperCase()} (${productId}):`);
      
      // Separate base prices from per-employee prices
      const basePrices = prices.data.filter(
        (p) => !p.metadata?.type || p.metadata.type !== 'per_employee'
      );
      const perEmployeePrices = prices.data.filter(
        (p) => p.metadata?.type === 'per_employee'
      );

      // Display base prices
      if (basePrices.length > 0) {
        console.log('  Base Prices:');
        for (const price of basePrices) {
          const amount = (price.unit_amount || 0) / 100;
          const interval = price.recurring?.interval || 'one-time';
          const nickname = price.nickname || 'No nickname';
          console.log(`    • ${nickname}`);
          console.log(`      Price ID: ${price.id}`);
          console.log(`      Amount: $${amount.toFixed(2)}/${interval}`);
          console.log(`      Created: ${new Date(price.created * 1000).toLocaleDateString()}`);
          totalBasePrices++;
        }
      }

      // Display per-employee prices
      if (perEmployeePrices.length > 0) {
        console.log('  Per-Employee Prices:');
        for (const price of perEmployeePrices) {
          const amount = (price.unit_amount || 0) / 100;
          const interval = price.recurring?.interval || 'one-time';
          const tierFromMeta = price.metadata?.tier || 'unknown';
          const billingCycle = price.metadata?.billingCycle || 'unknown';
          
          console.log(`    ✅ Per-Employee Price`);
          console.log(`       Price ID: ${price.id}`);
          console.log(`       Amount: $${amount.toFixed(2)}/${interval}`);
          console.log(`       Tier: ${tierFromMeta}`);
          console.log(`       Billing Cycle: ${billingCycle}`);
          console.log(`       Created: ${new Date(price.created * 1000).toLocaleDateString()}`);
          totalPerEmployeePrices++;
        }
      } else {
        console.log('  ⚠️  No per-employee prices found');
      }

      console.log();
    } catch (error) {
      const err = error as Error;
      console.error(`❌ Error fetching prices for ${tier}:`, err.message);
      console.log();
    }
  }

  console.log('📊 Summary:');
  console.log(`   Base prices: ${totalBasePrices}`);
  console.log(`   Per-employee prices: ${totalPerEmployeePrices}`);
  console.log();

  if (totalPerEmployeePrices === 0) {
    console.log('💡 Tip: Per-employee prices are created automatically when you update');
    console.log('   pricing in the admin portal with a per-employee price set.');
    console.log('   They are identified by metadata.type = "per_employee"');
  }
}

// Run if called directly
if (require.main === module) {
  listPerEmployeePrices()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { listPerEmployeePrices };

