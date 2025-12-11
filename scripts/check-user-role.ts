/**
 * Script to check and update a user's BusinessMember role
 * Usage: npx tsx scripts/check-user-role.ts <businessId> [userId] [newRole]
 */

import { PrismaClient, BusinessRole } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const prisma = new PrismaClient();

async function main() {
  const businessId = process.argv[2];
  const userId = process.argv[3];
  const newRole = process.argv[4] as BusinessRole | undefined;

  if (!businessId) {
    console.error('Usage: npx tsx scripts/check-user-role.ts <businessId> [userId] [newRole]');
    console.error('Example: npx tsx scripts/check-user-role.ts 4f310a85-4a47-451e-8286-1470f364605b');
    process.exit(1);
  }

  try {
    if (userId) {
      // Check specific user
      const member = await prisma.businessMember.findUnique({
        where: {
          businessId_userId: {
            businessId,
            userId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!member) {
        console.log(`❌ User ${userId} is not a member of business ${businessId}`);
        process.exit(1);
      }

      console.log('\n📊 Current User Role:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`User: ${member.user.name || member.user.email} (${member.user.id})`);
      console.log(`Business ID: ${businessId}`);
      console.log(`Role: ${member.role}`);
      console.log(`Is Active: ${member.isActive}`);
      console.log(`Can Manage: ${member.canManage}`);
      console.log(`Can Invite: ${member.canInvite}`);
      console.log(`Can Billing: ${member.canBilling}`);

      if (newRole && Object.values(BusinessRole).includes(newRole)) {
        // Update role
        const updated = await prisma.businessMember.update({
          where: {
            businessId_userId: {
              businessId,
              userId,
            },
          },
          data: {
            role: newRole,
            canManage: newRole === BusinessRole.ADMIN || newRole === BusinessRole.MANAGER,
          },
        });

        console.log('\n✅ Role Updated:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`New Role: ${updated.role}`);
        console.log(`Can Manage: ${updated.canManage}`);
      } else if (newRole) {
        console.error(`\n❌ Invalid role: ${newRole}`);
        console.error(`Valid roles: ${Object.values(BusinessRole).join(', ')}`);
        process.exit(1);
      }
    } else {
      // List all members
      const members = await prisma.businessMember.findMany({
        where: { businessId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      });

      console.log(`\n📋 All Members of Business ${businessId}:`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      members.forEach((member) => {
        console.log(`\n${member.user.name || member.user.email} (${member.user.id})`);
        console.log(`  Role: ${member.role}`);
        console.log(`  Active: ${member.isActive}`);
        console.log(`  Can Manage: ${member.canManage}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

