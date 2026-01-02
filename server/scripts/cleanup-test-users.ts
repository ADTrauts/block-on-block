import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestUserInfo {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  userNumber: string | null;
  relatedData: {
    files: number;
    messages: number;
    businesses: number;
    dashboards: number;
    conversations: number;
  };
}

// Users to preserve (will not be deleted)
const PRESERVED_USERS: string[] = [];

async function identifyTestUsers(excludeEmails: string[] = PRESERVED_USERS): Promise<TestUserInfo[]> {
  console.log('🔍 Identifying test users...\n');

  // Get all users with @test.com email domain (test users)
  const allUsers = await prisma.user.findMany({
    where: {
      AND: [
        {
          email: {
            endsWith: '@test.com',
          },
        },
        {
          email: {
            notIn: excludeEmails,
          },
        },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      userNumber: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`Found ${allUsers.length} potential test users (excluding preserved users)\n`);

  // Get related data counts for each user
  const usersWithCounts: TestUserInfo[] = await Promise.all(
    allUsers.map(async (user) => {
      const [filesCount, messagesCount, businessesCount, dashboardsCount, conversationsCount] = await Promise.all([
        prisma.file.count({ where: { userId: user.id } }),
        prisma.message.count({ where: { senderId: user.id } }),
        prisma.businessMember.count({ where: { userId: user.id } }),
        prisma.dashboard.count({ where: { userId: user.id } }),
        prisma.conversationParticipant.count({ where: { userId: user.id } }),
      ]);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        userNumber: user.userNumber,
        relatedData: {
          files: filesCount,
          messages: messagesCount,
          businesses: businessesCount,
          dashboards: dashboardsCount,
          conversations: conversationsCount,
        },
      };
    })
  );

  return usersWithCounts;
}

function displayPreview(users: TestUserInfo[]): void {
  console.log('📋 PREVIEW: Test users that will be deleted\n');
  console.log('═'.repeat(100));

  if (users.length === 0) {
    console.log('✅ No test users found to delete!\n');
    return;
  }

  // Display summary
  const totalRelatedData = users.reduce(
    (acc, user) => ({
      files: acc.files + user.relatedData.files,
      messages: acc.messages + user.relatedData.messages,
      businesses: acc.businesses + user.relatedData.businesses,
      dashboards: acc.dashboards + user.relatedData.dashboards,
      conversations: acc.conversations + user.relatedData.conversations,
    }),
    { files: 0, messages: 0, businesses: 0, dashboards: 0, conversations: 0 }
  );

  console.log(`Total users to delete: ${users.length}`);
  console.log(`Total related data:`);
  console.log(`  - Files: ${totalRelatedData.files}`);
  console.log(`  - Messages: ${totalRelatedData.messages}`);
  console.log(`  - Business memberships: ${totalRelatedData.businesses}`);
  console.log(`  - Dashboards: ${totalRelatedData.dashboards}`);
  console.log(`  - Conversations: ${totalRelatedData.conversations}`);
  console.log('─'.repeat(100));
  console.log('\nUser details:\n');

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} (${user.name || 'No name'})`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role: ${user.role} | Created: ${user.createdAt.toISOString().split('T')[0]}`);
    if (user.userNumber) {
      console.log(`   User Number: ${user.userNumber}`);
    }
    console.log(`   Related data: ${user.relatedData.files} files, ${user.relatedData.messages} messages, ${user.relatedData.businesses} businesses, ${user.relatedData.dashboards} dashboards, ${user.relatedData.conversations} conversations`);
    console.log('');
  });

  console.log('═'.repeat(100));
}

async function deleteTestUsers(users: TestUserInfo[], dryRun: boolean): Promise<{ deleted: number; errors: string[] }> {
  if (users.length === 0) {
    console.log('✅ No users to delete.\n');
    return { deleted: 0, errors: [] };
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No users will be deleted');
    console.log('Run with --confirm to actually delete these users\n');
    return { deleted: 0, errors: [] };
  }

  console.log(`\n🗑️  Deleting ${users.length} test users...\n`);

  const errors: string[] = [];
  let deletedCount = 0;

  for (const user of users) {
    try {
      // Delete related records first (ones with RESTRICT constraints)
      await Promise.all([
        // Delete content reports where user is reporter
        prisma.contentReport.deleteMany({
          where: { reporterId: user.id },
        }),
        // Delete admin impersonations where user is admin or target
        prisma.adminImpersonation.deleteMany({
          where: {
            OR: [
              { adminId: user.id },
              { targetUserId: user.id },
            ],
          },
        }),
        // Delete calendar memberships
        prisma.calendarMember.deleteMany({
          where: { userId: user.id },
        }),
        // Delete audit logs
        prisma.auditLog.deleteMany({
          where: { userId: user.id },
        }),
        // Delete dashboards
        prisma.dashboard.deleteMany({
          where: { userId: user.id },
        }),
      ]);

      // Now delete the user (Prisma will handle other cascading deletes)
      await prisma.user.delete({
        where: { id: user.id },
      });
      deletedCount++;
      console.log(`✅ Deleted: ${user.email}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorMsg = `❌ Failed to delete ${user.email}: ${errorMessage}`;
      errors.push(errorMsg);
      console.log(errorMsg);
    }
  }

  console.log(`\n📊 Deletion Summary:`);
  console.log(`   ✅ Successfully deleted: ${deletedCount} users`);
  console.log(`   ❌ Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log(`\n   Error details:`);
    errors.forEach((error) => console.log(`   - ${error}`));
  }

  return { deleted: deletedCount, errors };
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--confirm');
    const excludeIndex = args.indexOf('--exclude');
    const excludeEmails = excludeIndex !== -1 && args[excludeIndex + 1]
      ? args[excludeIndex + 1].split(',').map((e) => e.trim())
      : PRESERVED_USERS;

    console.log('🧹 Test User Cleanup Script\n');
    console.log('═'.repeat(100));

    if (dryRun) {
      console.log('🔍 Running in DRY-RUN mode (preview only)');
    } else {
      console.log('⚠️  Running in DELETE mode - users will be permanently deleted!');
    }

    console.log(`Preserved users: ${excludeEmails.join(', ')}`);
    console.log('─'.repeat(100));
    console.log('');

    // Identify test users
    const testUsers = await identifyTestUsers(excludeEmails);

    // Display preview
    displayPreview(testUsers);

    // Delete users if confirmed
    const result = await deleteTestUsers(testUsers, dryRun);

    // Get current user count
    const totalUsers = await prisma.user.count();
    console.log(`\n📈 Current total users in database: ${totalUsers}`);

    console.log('\n✅ Cleanup script completed!\n');
  } catch (error) {
    console.error('\n❌ Error running cleanup script:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

