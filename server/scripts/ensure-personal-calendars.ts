import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';

/**
 * Script to ensure all users have a personal primary calendar.
 * This fixes the issue where some users may not have calendars due to:
 * - Registration flow failures
 * - Dashboard creation before calendar provisioning was added
 * - Other edge cases
 */
async function ensurePersonalCalendars() {
  try {
    console.log('🔍 Finding users without personal primary calendars...');

    // Find all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    console.log(`📊 Found ${users.length} total users`);

    let createdCount = 0;
    let existingCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Check if user has a personal primary calendar
        const existingCalendar = await prisma.calendar.findFirst({
          where: {
            contextType: 'PERSONAL',
            contextId: user.id,
            isPrimary: true,
          },
        });

        if (existingCalendar) {
          existingCount++;
          continue;
        }

        // Find user's first personal dashboard for naming
        const personalDashboard = await prisma.dashboard.findFirst({
          where: {
            userId: user.id,
            businessId: null,
            institutionId: null,
            householdId: null,
          },
          orderBy: { createdAt: 'asc' },
        });

        const calendarName = personalDashboard?.name || 'My Dashboard';

        // Create personal primary calendar
        await prisma.calendar.create({
          data: {
            name: calendarName,
            contextType: 'PERSONAL',
            contextId: user.id,
            isPrimary: true,
            isSystem: true,
            isDeletable: false,
            defaultReminderMinutes: 10,
            members: {
              create: {
                userId: user.id,
                role: 'OWNER',
              },
            },
          },
        });

        createdCount++;
        console.log(`✅ Created calendar for user ${user.email} (${user.id})`);

        await logger.info('Created missing personal primary calendar', {
          operation: 'ensure_personal_calendar',
          context: { userId: user.id, email: user.email },
        });
      } catch (error: unknown) {
        errorCount++;
        const err = error as Error;
        console.error(`❌ Failed to create calendar for user ${user.email}:`, err.message);

        await logger.error('Failed to create personal calendar in ensure script', {
          operation: 'ensure_personal_calendar',
          error: { message: err.message, stack: err.stack },
          context: { userId: user.id, email: user.email },
        });
      }
    }

    console.log('\n📈 Summary:');
    console.log(`   ✅ Created: ${createdCount}`);
    console.log(`   ✓ Already existed: ${existingCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📊 Total processed: ${users.length}`);

    if (createdCount > 0) {
      console.log(`\n✨ Successfully created ${createdCount} personal primary calendars!`);
    } else {
      console.log(`\n✨ All users already have personal primary calendars!`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Fatal error in ensurePersonalCalendars:', err);
    await logger.error('Fatal error in ensure personal calendars script', {
      operation: 'ensure_personal_calendars',
      error: { message: err.message, stack: err.stack },
    });
    process.exit(1);
  }
}

// Run the script
ensurePersonalCalendars()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

