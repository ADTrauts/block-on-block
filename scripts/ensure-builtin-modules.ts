/**
 * Ensure Built-in Modules Script
 * 
 * Ensures that Drive, Chat, Calendar, HR, and Scheduling Module records exist in the database
 * This follows the same pattern as business module auto-installation
 * 
 * Run from server directory with: cd server && npx ts-node ../scripts/ensure-builtin-modules.ts
 * Or set DATABASE_URL environment variable before running
 */

import { PrismaClient } from '@prisma/client';

// Create a new Prisma client instance for this script
const prisma = new PrismaClient();

// System user ID for proprietary modules
// This should be a special "system" user or the first admin user
const SYSTEM_USER_ID = 'system'; // You'll need to update this with actual user ID

const BUILT_IN_MODULES = [
  {
    id: 'drive',
    name: 'Drive',
    description: 'File management and storage system with folder organization, sharing, and collaboration features',
    version: '1.0.0',
    category: 'PRODUCTIVITY',
    tags: ['files', 'storage', 'documents', 'collaboration', 'sharing'],
    icon: 'folder',
    screenshots: [],
    manifest: {
      name: 'Drive',
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
    description: 'Real-time messaging and communication system with team collaboration features',
    version: '1.0.0',
    category: 'COMMUNICATION',
    tags: ['messaging', 'communication', 'collaboration', 'team', 'chat'],
    icon: 'message-circle',
    screenshots: [],
    manifest: {
      name: 'Chat',
      version: '1.0.0',
      description: 'Real-time messaging system',
      author: 'Vssyl',
      license: 'proprietary',
      entryPoint: '/chat',
      permissions: ['chat:read', 'chat:write', 'chat:delete'],
      dependencies: [],
      runtime: { apiVersion: '1.0' },
      frontend: { entryUrl: '/chat' },
      settings: {}
    },
    dependencies: [],
    permissions: ['chat:read', 'chat:write', 'chat:delete'],
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
    description: 'Calendar and scheduling system with event management and team coordination',
    version: '1.0.0',
    category: 'PRODUCTIVITY',
    tags: ['calendar', 'scheduling', 'events', 'time', 'productivity'],
    icon: 'calendar',
    screenshots: [],
    manifest: {
      name: 'Calendar',
      version: '1.0.0',
      description: 'Calendar and scheduling system',
      author: 'Vssyl',
      license: 'proprietary',
      entryPoint: '/calendar',
      permissions: ['calendar:read', 'calendar:write', 'calendar:delete'],
      dependencies: [],
      runtime: { apiVersion: '1.0' },
      frontend: { entryUrl: '/calendar' },
      settings: {}
    },
    dependencies: [],
    permissions: ['calendar:read', 'calendar:write', 'calendar:delete'],
    status: 'APPROVED',
    pricingTier: 'free',
    basePrice: 0,
    enterprisePrice: 0,
    isProprietary: true,
    revenueSplit: 0
  },
  {
    id: 'hr',
    name: 'HR Management',
    description: 'Human resources management system for employee lifecycle, attendance, time-off, payroll, and performance management',
    version: '1.0.0',
    category: 'PRODUCTIVITY',
    tags: ['hr', 'human-resources', 'employees', 'attendance', 'payroll', 'business', 'time-off'],
    icon: 'users',
    screenshots: [],
    manifest: {
      name: 'HR Management',
      version: '1.0.0',
      description: 'Human resources management system',
      author: 'Vssyl',
      license: 'proprietary',
      entryPoint: '/business/[id]/admin/hr',
      permissions: ['hr:admin', 'hr:employees:write', 'hr:team:view', 'hr:team:approve', 'hr:self:view'],
      dependencies: [],
      runtime: { apiVersion: '1.0' },
      frontend: { entryUrl: '/business/[id]/admin/hr' },
      settings: {
        requiresBusinessContext: true,
        minimumTier: 'business-advanced'
      }
    },
    dependencies: [],
    permissions: ['hr:admin', 'hr:employees:write', 'hr:team:view', 'hr:team:approve', 'hr:self:view'],
    status: 'APPROVED',
    pricingTier: 'business-advanced',
    basePrice: 0,
    enterprisePrice: 0,
    isProprietary: true,
    revenueSplit: 0
  },
  {
    id: 'scheduling',
    name: 'Employee Scheduling',
    description: 'Employee shift scheduling and workforce planning for businesses with shift management, availability, and swap requests',
    version: '1.0.0',
    category: 'PRODUCTIVITY',
    tags: ['scheduling', 'shifts', 'roster', 'staffing', 'coverage', 'business', 'workforce'],
    icon: 'calendar-clock',
    screenshots: [],
    manifest: {
      name: 'Employee Scheduling',
      version: '1.0.0',
      description: 'Employee shift scheduling system',
      author: 'Vssyl',
      license: 'proprietary',
      entryPoint: '/business/[id]/admin/scheduling',
      permissions: ['scheduling:admin', 'scheduling:schedules:write', 'scheduling:team:view', 'scheduling:swaps:approve', 'scheduling:self:view'],
      dependencies: [],
      runtime: { apiVersion: '1.0' },
      frontend: { entryUrl: '/business/[id]/admin/scheduling' },
      settings: {
        requiresBusinessContext: true,
        minimumTier: 'business-basic'
      }
    },
    dependencies: [],
    permissions: ['scheduling:admin', 'scheduling:schedules:write', 'scheduling:team:view', 'scheduling:swaps:approve', 'scheduling:self:view'],
    status: 'APPROVED',
    pricingTier: 'business-basic',
    basePrice: 0,
    enterprisePrice: 0,
    isProprietary: true,
    revenueSplit: 0
  }
];

async function ensureBuiltInModules() {
  try {
    console.log('🔧 Ensuring built-in modules exist in database...\n');

    // Find or create a system user
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@vssyl.com' }
    });

    if (!systemUser) {
      console.log('📝 Creating system user for built-in modules...');
      systemUser = await prisma.user.create({
        data: {
          email: 'system@vssyl.com',
          name: 'System',
          password: 'system-password-not-used', // Required field
          emailVerified: new Date(),
          role: 'ADMIN'
        }
      });
      console.log('✅ Created system user');
    }

    let createdCount = 0;
    let existingCount = 0;

    for (const moduleData of BUILT_IN_MODULES) {
      const existingModule = await prisma.module.findUnique({
        where: { id: moduleData.id }
      });

      if (!existingModule) {
        console.log(`📝 Creating Module record for ${moduleData.name}...`);
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
        console.log(`✅ Created Module record for ${moduleData.name}`);
        createdCount++;
      } else {
        console.log(`ℹ️  Module record already exists: ${moduleData.name}`);
        existingCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${createdCount} modules`);
    console.log(`   ℹ️  Existing: ${existingCount} modules`);
    console.log(`   📦 Total: ${createdCount + existingCount} built-in modules`);
    
    if (createdCount > 0) {
      console.log('\n✅ Built-in modules ensured successfully!');
      console.log('   Drive, Chat, Calendar, HR, and Scheduling are now available in the database.');
    } else {
      console.log('\n✅ All built-in modules already exist in the database.');
    }

  } catch (error) {
    console.error('❌ Error ensuring built-in modules:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
ensureBuiltInModules();
