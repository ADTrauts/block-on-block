import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Comprehensive script to ensure a user has full access:
 * - ADMIN role for admin portal and system management
 * - Enterprise tier subscription for all premium features
 * - All necessary permissions for enterprise systems
 */
async function setupFullAdminAccess(email: string) {
  try {
    console.log('🔍 Checking user access for:', email);
    console.log('━'.repeat(80));
    
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        role: true,
        createdAt: true
      }
    });

    // Create user if doesn't exist
    if (!user) {
      console.log('📝 User not found. Creating new user...');
      
      const hashedPassword = await bcrypt.hash('VssylAdmin2025!', 10);
      
      user = await prisma.user.create({
        data: {
          email: email,
          password: hashedPassword,
          name: 'Andrew Trautman',
          role: 'ADMIN',
          emailVerified: new Date(),
        },
        select: { 
          id: true, 
          email: true, 
          name: true, 
          role: true,
          createdAt: true
        }
      });

      console.log('✅ User created successfully!');
      console.log(`  📧 Email: ${user.email}`);
      console.log(`  👤 Name: ${user.name}`);
      console.log(`  🔑 Role: ${user.role}`);
      console.log(`  🔐 Password: VssylAdmin2025!`);
      console.log(`  ⚠️  Please change password after first login!`);
      console.log('');
    } else {
      console.log('✅ User found!');
      console.log(`  📧 Email: ${user.email}`);
      console.log(`  👤 Name: ${user.name}`);
      console.log(`  🔑 Current Role: ${user.role}`);
      console.log(`  📅 Created: ${user.createdAt.toLocaleDateString()}`);
      console.log('');
    }

    // Ensure user has ADMIN role
    if (user.role !== 'ADMIN') {
      console.log('🔄 Promoting user to ADMIN role...');
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
        select: { 
          id: true, 
          email: true, 
          name: true, 
          role: true,
          createdAt: true
        }
      });
      console.log('✅ User promoted to ADMIN!');
      console.log('');
    } else {
      console.log('✅ User already has ADMIN role');
      console.log('');
    }

    // Check for existing enterprise subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'active'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingSubscription) {
      console.log('📊 Current subscription found:');
      console.log(`  💳 Tier: ${existingSubscription.tier}`);
      console.log(`  ✅ Status: ${existingSubscription.status}`);
      console.log(`  📅 Current Period: ${existingSubscription.currentPeriodStart.toLocaleDateString()} - ${existingSubscription.currentPeriodEnd.toLocaleDateString()}`);
      
      if (existingSubscription.tier !== 'enterprise') {
        console.log('  🔄 Upgrading to Enterprise tier...');
        await prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: { tier: 'enterprise' }
        });
        console.log('  ✅ Upgraded to Enterprise tier!');
      } else {
        console.log('  ✅ Already on Enterprise tier');
      }
      console.log('');
    } else {
      console.log('📝 No active subscription found. Creating Enterprise tier subscription...');
      
      const subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          tier: 'enterprise',
          status: 'active',
          stripeSubscriptionId: `admin_grant_${Date.now()}`,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        }
      });
      
      console.log('✅ Enterprise subscription created!');
      console.log(`  💳 Tier: ${subscription.tier}`);
      console.log(`  ✅ Status: ${subscription.status}`);
      console.log(`  📅 Valid until: ${subscription.currentPeriodEnd.toLocaleDateString()}`);
      console.log('');
    }

    // Display final status
    console.log('━'.repeat(80));
    console.log('🎉 SETUP COMPLETE - FULL ACCESS GRANTED!');
    console.log('━'.repeat(80));
    console.log('');
    console.log('✅ Admin Portal Access:');
    console.log(`  🌐 Production: https://vssyl.com/admin-portal`);
    console.log(`  🌐 Local: http://localhost:3002/admin-portal`);
    console.log('');
    console.log('✅ Permissions Granted:');
    console.log('  🛡️  ADMIN role - Full system access');
    console.log('  🏢 Enterprise tier - All premium features');
    console.log('  📊 Admin Portal - User management, analytics, security');
    console.log('  🔧 System Management - Full configuration access');
    console.log('  💼 Business Features - All enterprise modules');
    console.log('  🤖 AI Systems - Advanced AI configuration');
    console.log('  📈 Analytics - Complete business intelligence');
    console.log('  🔒 Security - Compliance and audit tools');
    console.log('');
    console.log('✅ Feature Access:');
    console.log('  • Advanced Analytics & Business Intelligence');
    console.log('  • Custom Integrations & API Access');
    console.log('  • Advanced File Sharing & DLP');
    console.log('  • Compliance & Legal Hold');
    console.log('  • Resource Booking & Workflows');
    console.log('  • Custom Widgets & Dashboards');
    console.log('  • SSO Integration');
    console.log('  • Priority Support');
    console.log('  • All features across all modules');
    console.log('');

    // Show all admin users
    console.log('━'.repeat(80));
    console.log('📊 All Admin Users:');
    console.log('━'.repeat(80));
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true, name: true, role: true, createdAt: true }
    });
    adminUsers.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.email}`);
      console.log(`   Name: ${admin.name || 'N/A'}`);
      console.log(`   Created: ${admin.createdAt.toLocaleDateString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error setting up admin access:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'Andrew.Trautman@Vssyl.com';

console.log('🚀 Vssyl Full Admin Access Setup');
console.log('━'.repeat(80));
console.log(`📧 Target Email: ${email}`);
console.log('━'.repeat(80));
console.log('');

setupFullAdminAccess(email);

