/**
 * Scheduling Module Automatic Seeding
 * 
 * Runs on server startup to ensure Scheduling module exists in database
 * Similar to registerBuiltInModules but for the module record itself
 */

import { prisma } from '../lib/prisma';

export async function seedSchedulingModuleOnStartup(): Promise<void> {
  try {
    console.log('📦 Checking Scheduling module registration...');
    
    // Check if Scheduling module already exists
    let existing;
    try {
      existing = await prisma.module.findUnique({
        where: { id: 'scheduling' }
      });
    } catch (dbError) {
      // Database might not be available during startup
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      if (errorMessage.includes("Can't reach database") || errorMessage.includes('localhost:5432')) {
        console.log('   ⚠️  Database not available during startup');
        console.log('   Scheduling module seed will be skipped');
        console.log('   Server will continue, but Scheduling module may not be available.\n');
        return;
      }
      // Re-throw if it's a different database error
      throw dbError;
    }
    
    if (existing) {
      console.log('   ✅ Scheduling module already registered');
      return;
    }
    
    console.log('   📝 Creating Scheduling module record...');
    
    // Get a user to be the developer (first admin)
    let systemUser;
    try {
      systemUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
      });
    } catch (dbError) {
      // Database connection lost during seeding
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      if (errorMessage.includes("Can't reach database") || errorMessage.includes('localhost:5432')) {
        console.log('   ⚠️  Database connection lost during seeding');
        console.log('   Scheduling module seed will be skipped');
        console.log('   Server will continue, but Scheduling module may not be available.\n');
        return;
      }
      throw dbError;
    }
    
    if (!systemUser) {
      console.warn('   ⚠️  No admin user found. Scheduling module seed will retry on next startup.');
      return;
    }
    
    // Create Scheduling module
    await prisma.module.create({
      data: {
        id: 'scheduling',
        name: 'Employee Scheduling',
        description: 'Employee shift scheduling and workforce planning for businesses with shift management, availability, and swap requests',
        version: '1.0.0',
        category: 'PRODUCTIVITY',
        tags: ['scheduling', 'shifts', 'roster', 'staffing', 'coverage', 'business', 'workforce'],
        icon: 'calendar-clock',
        screenshots: [],
        developerId: systemUser.id,
        status: 'APPROVED',
        downloads: 0,
        rating: 5.0,
        reviewCount: 0,
        pricingTier: 'business-basic',
        basePrice: 0,
        enterprisePrice: 0,
        isProprietary: true,
        revenueSplit: 0,
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
        permissions: ['scheduling:admin', 'scheduling:schedules:write', 'scheduling:team:view', 'scheduling:swaps:approve', 'scheduling:self:view']
      }
    });
    
    console.log('   ✅ Scheduling module registered successfully');
  } catch (error) {
    console.error('   ❌ Scheduling module seed failed:', error);
    console.error('   Server will continue, but Scheduling module may not be available.');
  }
}

