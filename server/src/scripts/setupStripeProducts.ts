/**
 * Stripe Products Setup Script for Vssyl
 * 
 * This script creates all the necessary products and prices in your Stripe account
 * to match the configuration in your Vssyl codebase.
 * 
 * Usage:
 *   pnpm stripe:setup
 * 
 * Requirements:
 *   - STRIPE_SECRET_KEY environment variable set in .env file
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Stripe from 'stripe';
import { isStripeConfigured } from '../config/stripe';

if (!isStripeConfigured() || !process.env.STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY environment variable is required');
  console.log('💡 Set it in server/.env file');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil' as any, // TypeScript types may lag behind Stripe API versions
});

console.log('🚀 Setting up Stripe products for Vssyl...\n');

// Product and price configurations matching your new simplified structure
const PRODUCTS_CONFIG = [
  {
    id: 'prod_pro',
    name: 'Vssyl Pro Plan',
    description: 'Full platform access with unlimited AI features',
    prices: [
      {
        id: 'price_pro_monthly',
        amount: 2900, // $29.00 in cents
        currency: 'usd',
        interval: 'month' as const,
        nickname: 'Pro Monthly',
      },
      {
        id: 'price_pro_yearly',
        amount: 29000, // $290.00 in cents
        currency: 'usd',
        interval: 'year' as const,
        nickname: 'Pro Yearly',
      },
    ],
  },
  {
    id: 'prod_business_basic',
    name: 'Vssyl Business Basic',
    description: 'Team workspace with basic AI settings and 10 included employees',
    prices: [
      {
        id: 'price_business_basic_monthly',
        amount: 4999, // $49.99 in cents
        currency: 'usd',
        interval: 'month' as const,
        nickname: 'Business Basic Monthly',
      },
      {
        id: 'price_business_basic_yearly',
        amount: 49999, // $499.99 in cents
        currency: 'usd',
        interval: 'year' as const,
        nickname: 'Business Basic Yearly',
      },
    ],
  },
  {
    id: 'prod_business_advanced',
    name: 'Vssyl Business Advanced',
    description: 'Team workspace with advanced AI settings and 10 included employees',
    prices: [
      {
        id: 'price_business_advanced_monthly',
        amount: 6999, // $69.99 in cents
        currency: 'usd',
        interval: 'month' as const,
        nickname: 'Business Advanced Monthly',
      },
      {
        id: 'price_business_advanced_yearly',
        amount: 69999, // $699.99 in cents
        currency: 'usd',
        interval: 'year' as const,
        nickname: 'Business Advanced Yearly',
      },
    ],
  },
  {
    id: 'prod_enterprise',
    name: 'Vssyl Enterprise Plan',
    description: 'Enterprise workspace with unlimited AI, custom integrations, and dedicated support',
    prices: [
      {
        id: 'price_enterprise_monthly',
        amount: 12999, // $129.99 in cents
        currency: 'usd',
        interval: 'month' as const,
        nickname: 'Enterprise Monthly',
      },
      {
        id: 'price_enterprise_yearly',
        amount: 129999, // $1299.99 in cents
        currency: 'usd',
        interval: 'year' as const,
        nickname: 'Enterprise Yearly',
      },
    ],
  },
];

interface ProductConfig {
  id: string;
  name: string;
  description: string;
  prices: Array<{
    id: string;
    amount: number;
    currency: string;
    interval: 'month' | 'year';
    nickname: string;
  }>;
}

async function createProduct(productConfig: ProductConfig) {
  try {
    console.log(`📦 Creating product: ${productConfig.name}`);

    // Create the product
    const product = await stripe.products.create({
      id: productConfig.id,
      name: productConfig.name,
      description: productConfig.description,
      type: 'service',
    });

    console.log(`✅ Product created: ${product.id}`);

    // Create prices for this product
    for (const priceConfig of productConfig.prices) {
      console.log(`  💰 Creating price: ${priceConfig.nickname}`);

      // Note: Stripe doesn't allow custom IDs for prices, only products
      // We'll create the price and then sync the ID to database
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceConfig.amount,
        currency: priceConfig.currency,
        recurring: {
          interval: priceConfig.interval,
        },
        nickname: priceConfig.nickname,
      });

      console.log(
        `  ✅ Price created: ${price.id} ($${priceConfig.amount / 100}/${priceConfig.interval})`
      );
    }

    console.log();
    return product;
  } catch (error: unknown) {
    const err = error as Stripe.errors.StripeError;
    if (err.code === 'resource_already_exists') {
      console.log(`⚠️  Product ${productConfig.id} already exists, skipping...`);

      // Still try to create prices if product exists
      for (const priceConfig of productConfig.prices) {
        try {
          console.log(`  💰 Creating price: ${priceConfig.nickname}`);

          // Note: Stripe doesn't allow custom IDs for prices, only products
          // We'll create the price and then sync the ID to database
          const price = await stripe.prices.create({
            product: productConfig.id,
            unit_amount: priceConfig.amount,
            currency: priceConfig.currency,
            recurring: {
              interval: priceConfig.interval,
            },
            nickname: priceConfig.nickname,
          });

          console.log(
            `  ✅ Price created: ${price.id} ($${priceConfig.amount / 100}/${priceConfig.interval})`
          );
        } catch (priceError: unknown) {
          const priceErr = priceError as Stripe.errors.StripeError;
          if (priceErr.code === 'resource_already_exists') {
            console.log(`  ⚠️  Price ${priceConfig.id} already exists, skipping...`);
          } else {
            console.error(`  ❌ Error creating price ${priceConfig.id}:`, priceErr.message);
          }
        }
      }
      console.log();
    } else {
      console.error(`❌ Error creating product ${productConfig.id}:`, err.message);
      throw error;
    }
  }
}

async function setupStripeProducts() {
  try {
    const keyPreview = process.env.STRIPE_SECRET_KEY?.substring(0, 12) || 'unknown';
    const isTest = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || false;
    console.log(`🔑 Using Stripe key: ${keyPreview}...`);
    console.log(`🌍 Environment: ${isTest ? 'TEST' : 'LIVE'}`);
    console.log();

    // Create all products and prices
    for (const productConfig of PRODUCTS_CONFIG) {
      await createProduct(productConfig);
    }

    console.log('🎉 All Stripe products and prices created successfully!');
    console.log();
    console.log('📋 Summary:');
    console.log('Products created:');
    PRODUCTS_CONFIG.forEach((product) => {
      console.log(`  • ${product.name} (${product.id})`);
      product.prices.forEach((price) => {
        console.log(`    - ${price.nickname}: $${price.amount / 100}/${price.interval}`);
      });
    });

    console.log();
    console.log('🔗 Next Steps:');
    console.log('1. Run: pnpm stripe:sync (to sync price IDs to database)');
    console.log('2. Verify: pnpm stripe:verify (to confirm everything is set up)');
    console.log('3. Test subscription creation in your application');
  } catch (error) {
    const err = error as Error;
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupStripeProducts()
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { setupStripeProducts };

