/**
 * Seed Core Modules Script
 * 
 * Creates Module records for Drive, Chat, and Calendar in the database
 * These are the foundational modules that every business needs
 * 
 * Run with: npx ts-node scripts/seed-core-modules.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// System user ID for proprietary modules
// This should be a special "system" user or the first admin user
const SYSTEM_USER_ID = 'system'; // You'll need to update this with actual user ID

const CORE_MODULES = [
  {
    id: 'drive',
    name: 'File Hub',
    description: 'File management and storage system with folder organization, sharing, and collaboration features',
    version: '1.0.0',
    category: 'PRODUCTIVITY',
    tags: ['files', 'storage', 'documents', 'collaboration', 'sharing'],
    icon: 'folder',
    screenshots: [],
    manifest: {
      name: 'File Hub',
      version: '1.0.0',
      description: 'File management system',
      author: 'Vssyl',
      license: 'proprietary',
      entryPoint: '/drive',
      permissions: ['drive:read', 'drive:write', 'drive:delete', 'drive:share'],
      dependencies: [],
      runtime: { apiVersion: '1.0' },
      frontend: { entryUrl: '/drive' },
      settings: {}
    },
    dependencies: [],
    permissions: ['drive:read', 'drive:write', 'drive:delete', 'drive:share'],
    status: 'APPROVED',
    pricingTier: 'free',
    basePrice: 0,
    enterprisePrice: 0,
    isProprietary: true,
    revenueSplit: 0
  },
  {
    id: 'chat',
    name: 'Chat',
    description: 'Real-time messaging and communication system with conversations, file sharing, and thread support',
    version: '1.0.0',
    category: 'COMMUNICATION',
    tags: ['messaging', 'chat', 'communication', 'real-time', 'collaboration'],
    icon: 'message-square',
    screenshots: [],
    manifest: {
      name: 'Chat',
      version: '1.0.0',
      description: 'Real-time messaging system',
      author: 'Vssyl',
      license: 'proprietary',
      entryPoint: '/chat',
      permissions: ['chat:read', 'chat:write'],
      dependencies: [],
      runtime: { apiVersion: '1.0' },
      frontend: { entryUrl: '/chat' },
      settings: {}
    },
    dependencies: [],
    permissions: ['chat:read', 'chat:write'],
    status: 'APPROVED',
    pricingTier: 'free',
    basePrice: 0,
    enterprisePrice: 0,
    isProprietary: true,
    revenueSplit: 0
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Calendar and scheduling system with events, reminders, and availability management',
    version: '1.0.0',
    category: 'PRODUCTIVITY',
    tags: ['calendar', 'events', 'scheduling', 'appointments', 'time management'],
    icon: 'calendar',
    screenshots: [],
    manifest: {
      name: 'Calendar',
      version: '1.0.0',
      description: 'Calendar and scheduling system',
      author: 'Vssyl',
      license: 'proprietary',
      entryPoint: '/calendar',
      permissions: ['calendar:read', 'calendar:write'],
      dependencies: [],
      runtime: { apiVersion: '1.0' },
      frontend: { entryUrl: '/calendar' },
      settings: {}
    },
    dependencies: [],
    permissions: ['calendar:read', 'calendar:write'],
    status: 'APPROVED',
    pricingTier: 'free',
    basePrice: 0,
    enterprisePrice: 0,
    isProprietary: true,
    revenueSplit: 0
  }
];

async function seedCoreModules() {
  console.log('🌱 Seeding core modules...\n');

  try {
    // Get or create a system user for proprietary modules
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@vssyl.com' }
    });

    if (!systemUser) {
      console.log('📝 Creating system user for proprietary modules...');
      systemUser = await prisma.user.create({
        data: {
          email: 'system@vssyl.com',
          name: 'Vssyl System',
          password: 'N/A', // System user doesn't need password
          role: 'ADMIN'
        }
      });
      console.log('✅ System user created:', systemUser.id);
    } else {
      console.log('✅ Found existing system user:', systemUser.id);
    }

    // Seed each core module
    for (const moduleData of CORE_MODULES) {
      console.log(`\n📦 Processing: ${moduleData.name}`);

      // Check if module already exists
      const existing = await prisma.module.findUnique({
        where: { id: moduleData.id }
      });

      if (existing) {
        console.log(`   ℹ️  Module already exists, updating...`);
        
        await prisma.module.update({
          where: { id: moduleData.id },
          data: {
            name: moduleData.name,
            description: moduleData.description,
            version: moduleData.version,
            category: moduleData.category as any,
            tags: moduleData.tags,
            icon: moduleData.icon,
            manifest: moduleData.manifest as any,
            dependencies: moduleData.dependencies,
            permissions: moduleData.permissions,
            status: moduleData.status as any,
            pricingTier: moduleData.pricingTier,
            basePrice: moduleData.basePrice,
            enterprisePrice: moduleData.enterprisePrice,
            isProprietary: moduleData.isProprietary,
            revenueSplit: moduleData.revenueSplit
          }
        });
        
        console.log(`   ✅ Updated ${moduleData.name}`);
      } else {
        console.log(`   📝 Creating new module...`);
        
        await prisma.module.create({
          data: {
            id: moduleData.id,
            name: moduleData.name,
            description: moduleData.description,
            version: moduleData.version,
            category: moduleData.category as any,
            tags: moduleData.tags,
            icon: moduleData.icon,
            screenshots: moduleData.screenshots,
            developerId: systemUser.id,
            manifest: moduleData.manifest as any,
            dependencies: moduleData.dependencies,
            permissions: moduleData.permissions,
            status: moduleData.status as any,
            pricingTier: moduleData.pricingTier,
            basePrice: moduleData.basePrice,
            enterprisePrice: moduleData.enterprisePrice,
            isProprietary: moduleData.isProprietary,
            revenueSplit: moduleData.revenueSplit,
            downloads: 0,
            rating: 5.0,
            reviewCount: 0
          }
        });
        
        console.log(`   ✅ Created ${moduleData.name}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ CORE MODULES SEEDED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\nNext step: Run the migration script to install these modules for existing businesses');
    console.log('Command: node scripts/install-core-modules-existing-businesses.js\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedCoreModules()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

