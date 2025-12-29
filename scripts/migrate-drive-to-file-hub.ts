/**
 * Database Migration Script: Update Drive to File Hub
 * 
 * This script updates existing database records to change the display name
 * from "Drive" to "File Hub" while keeping the module ID as "drive".
 * 
 * Run with: pnpm exec ts-node scripts/migrate-drive-to-file-hub.ts
 * Or: cd server && pnpm exec ts-node ../scripts/migrate-drive-to-file-hub.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateDriveToFileHub() {
  try {
    console.log('🔄 Starting migration: Drive → File Hub\n');

    // 1. Update Module table
    console.log('📝 Updating Module records...');
    const moduleUpdate = await prisma.module.updateMany({
      where: { id: 'drive' },
      data: { name: 'File Hub' }
    });
    console.log(`   ✅ Updated ${moduleUpdate.count} Module record(s)\n`);

    // 2. Update ModuleAIContextRegistry table
    console.log('📝 Updating ModuleAIContextRegistry records...');
    const registryUpdate = await prisma.moduleAIContextRegistry.updateMany({
      where: { moduleId: 'drive' },
      data: { moduleName: 'File Hub' }
    });
    console.log(`   ✅ Updated ${registryUpdate.count} ModuleAIContextRegistry record(s)\n`);

    // 3. Verify the updates
    console.log('🔍 Verifying updates...\n');
    const module = await prisma.module.findUnique({
      where: { id: 'drive' },
      select: { id: true, name: true }
    });

    const registry = await prisma.moduleAIContextRegistry.findUnique({
      where: { moduleId: 'drive' },
      select: { moduleId: true, moduleName: true }
    });

    if (module) {
      console.log(`   Module: id="${module.id}", name="${module.name}"`);
    } else {
      console.log('   ⚠️  Module record not found (this is OK if module hasn\'t been created yet)');
    }

    if (registry) {
      console.log(`   Registry: moduleId="${registry.moduleId}", moduleName="${registry.moduleName}"`);
    } else {
      console.log('   ⚠️  Registry record not found (this is OK if AI context hasn\'t been registered yet)');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('   The module ID remains "drive" for compatibility.');
    console.log('   Display names have been updated to "File Hub".\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateDriveToFileHub();

