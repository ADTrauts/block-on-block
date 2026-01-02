/**
 * Seed script to migrate hardcoded pricing from stripe.ts to database
 * Run this once to initialize pricing in the database
 */

import { prisma } from '../lib/prisma';
import { PRICING_CONFIG } from '../config/stripe';

async function seedPricing() {
  console.log('🌱 Seeding pricing configurations...');

  // Find first admin user
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true },
  });

  if (!adminUser) {
    console.error('❌ No admin user found in database');
    console.log('💡 Please create an admin user first');
    process.exit(1);
  }

  const ADMIN_USER_ID = adminUser.id;
  console.log(`✅ Using admin user: ${adminUser.email} (${adminUser.name || 'No name'})`);

  const now = new Date();
  const tiers = ['FREE', 'PRO', 'BUSINESS_BASIC', 'BUSINESS_ADVANCED', 'ENTERPRISE'] as const;

  for (const tier of tiers) {
    const config = PRICING_CONFIG[tier] as any; // Type assertion to handle union types
    
    // Deactivate any existing active pricing for this tier/cycle
    await prisma.pricingConfig.updateMany({
      where: {
        tier: tier.toLowerCase(),
        billingCycle: 'monthly',
        isActive: true,
      },
      data: {
        isActive: false,
        endDate: now,
      },
    });

    await prisma.pricingConfig.updateMany({
      where: {
        tier: tier.toLowerCase(),
        billingCycle: 'yearly',
        isActive: true,
      },
      data: {
        isActive: false,
        endDate: now,
      },
    });

    // Create monthly pricing
    if (config.monthly !== undefined) {
      await prisma.pricingConfig.create({
        data: {
          tier: tier.toLowerCase(),
          billingCycle: 'monthly',
          basePrice: config.monthly,
          perEmployeePrice: config.perEmployee || null,
          includedEmployees: config.includedEmployees || null,
          effectiveDate: now,
          isActive: true,
          createdBy: ADMIN_USER_ID,
        },
      });
      console.log(`✅ Created ${tier} monthly pricing: $${config.monthly}`);
    }

    // Create yearly pricing
    if (config.yearly !== undefined) {
      await prisma.pricingConfig.create({
        data: {
          tier: tier.toLowerCase(),
          billingCycle: 'yearly',
          basePrice: config.yearly,
          perEmployeePrice: config.perEmployee || null,
          includedEmployees: config.includedEmployees || null,
          effectiveDate: now,
          isActive: true,
          createdBy: ADMIN_USER_ID,
        },
      });
      console.log(`✅ Created ${tier} yearly pricing: $${config.yearly}`);
    }
  }

  console.log('🎉 Pricing seeding completed!');
}

// Run if called directly
if (require.main === module) {
  seedPricing()
    .catch((error) => {
      console.error('❌ Error seeding pricing:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedPricing };

