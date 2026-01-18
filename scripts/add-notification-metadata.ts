/**
 * Add Notification Metadata to Built-in Modules
 * 
 * This script updates existing module manifests with notification metadata.
 * It merges the notifications array into existing manifests without overwriting other data.
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from '../server/src/lib/prisma';

// Notification metadata for each module
const MODULE_NOTIFICATIONS: Record<string, Array<{
  type: string;
  name: string;
  description: string;
  category: string;
  defaultChannels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  requiresAction?: boolean;
}>> = {
  hr: [
    {
      type: 'hr_onboarding_task_approved',
      name: 'Onboarding Task Approved',
      description: 'Sent when a manager approves an employee\'s onboarding task',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: true,
        push: false
      },
      priority: 'normal',
      requiresAction: false
    },
    {
      type: 'hr_onboarding_task_pending_approval',
      name: 'Onboarding Task Pending Approval',
      description: 'Sent to manager when employee completes a task requiring approval',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: true,
        push: true
      },
      priority: 'high',
      requiresAction: true
    },
    {
      type: 'hr_onboarding_journey_completed',
      name: 'Onboarding Journey Completed',
      description: 'Sent when employee completes all onboarding tasks',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: true,
        push: false
      },
      priority: 'normal',
      requiresAction: false
    },
    {
      type: 'hr_time_off_request_submitted',
      name: 'Time-Off Request Submitted',
      description: 'Sent to manager when employee submits time-off request',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: true,
        push: true
      },
      priority: 'high',
      requiresAction: true
    },
    {
      type: 'hr_time_off_request_approved',
      name: 'Time-Off Request Approved',
      description: 'Sent to employee when manager approves time-off request',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: true,
        push: false
      },
      priority: 'normal',
      requiresAction: false
    },
    {
      type: 'hr_time_off_request_denied',
      name: 'Time-Off Request Denied',
      description: 'Sent to employee when manager denies time-off request',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: true,
        push: false
      },
      priority: 'normal',
      requiresAction: false
    },
    {
      type: 'hr_time_off_balance_low',
      name: 'Low PTO Balance Warning',
      description: 'Sent when employee\'s PTO balance falls below threshold',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: true,
        push: false
      },
      priority: 'low',
      requiresAction: false
    },
    {
      type: 'hr_attendance_exception_created',
      name: 'Attendance Exception Created',
      description: 'Sent when an attendance exception is detected',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: true,
        push: false
      },
      priority: 'normal',
      requiresAction: true
    },
    {
      type: 'hr_attendance_policy_violation',
      name: 'Attendance Policy Violation',
      description: 'Sent when employee violates attendance policy',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: true,
        push: true
      },
      priority: 'high',
      requiresAction: true
    },
    {
      type: 'hr_attendance_missing_punch',
      name: 'Missing Punch Reminder',
      description: 'Sent when employee forgets to clock in/out',
      category: 'hr',
      defaultChannels: {
        inApp: true,
        email: false,
        push: true
      },
      priority: 'normal',
      requiresAction: true
    }
  ],
  chat: [
    {
      type: 'chat_message',
      name: 'New Message',
      description: 'Sent when a new message is received in a conversation',
      category: 'chat',
      defaultChannels: {
        inApp: true,
        email: false,
        push: true
      },
      priority: 'normal',
      requiresAction: false
    },
    {
      type: 'chat_mention',
      name: 'Mentioned in Chat',
      description: 'Sent when you are mentioned in a chat message',
      category: 'mentions',
      defaultChannels: {
        inApp: true,
        email: true,
        push: true
      },
      priority: 'high',
      requiresAction: false
    },
    {
      type: 'chat_reaction',
      name: 'Message Reaction',
      description: 'Sent when someone reacts to your message',
      category: 'chat',
      defaultChannels: {
        inApp: true,
        email: false,
        push: false
      },
      priority: 'low',
      requiresAction: false
    }
  ],
  drive: [
    {
      type: 'drive_shared',
      name: 'File Shared',
      description: 'Sent when a file or folder is shared with you',
      category: 'drive',
      defaultChannels: {
        inApp: true,
        email: true,
        push: false
      },
      priority: 'normal',
      requiresAction: false
    },
    {
      type: 'drive_permission',
      name: 'Permission Changed',
      description: 'Sent when file or folder permissions are changed',
      category: 'drive',
      defaultChannels: {
        inApp: true,
        email: false,
        push: false
      },
      priority: 'normal',
      requiresAction: false
    }
  ],
  calendar: [
    {
      type: 'calendar_reminder',
      name: 'Event Reminder',
      description: 'Sent before a calendar event starts',
      category: 'calendar',
      defaultChannels: {
        inApp: true,
        email: false,
        push: true
      },
      priority: 'normal',
      requiresAction: false
    }
  ]
};

async function addNotificationMetadata() {
  try {
    console.log('\n🔔 ============================================');
    console.log('🔔 Adding Notification Metadata to Modules');
    console.log('🔔 ============================================\n');

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const [moduleId, notifications] of Object.entries(MODULE_NOTIFICATIONS)) {
      try {
        const module = await prisma.module.findUnique({
          where: { id: moduleId }
        });

        if (!module) {
          console.log(`⚠️  Module '${moduleId}' not found, skipping...`);
          skippedCount++;
          continue;
        }

        const manifest = module.manifest as Record<string, unknown>;
        
        // Check if notifications already exist
        if (manifest.notifications && Array.isArray(manifest.notifications)) {
          const existingNotifications = manifest.notifications as Array<Record<string, unknown>>;
          if (existingNotifications.length > 0) {
            console.log(`ℹ️  Module '${moduleId}' already has ${existingNotifications.length} notification types, skipping...`);
            skippedCount++;
            continue;
          }
        }

        // Merge notifications into manifest
        const updatedManifest = {
          ...manifest,
          notifications
        };

        await prisma.module.update({
          where: { id: moduleId },
          data: {
            manifest: updatedManifest as any
          }
        });

        console.log(`✅ Updated module '${moduleId}' with ${notifications.length} notification types`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Error updating module '${moduleId}':`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updatedCount} modules`);
    console.log(`   ℹ️  Skipped: ${skippedCount} modules`);
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount} modules`);
    }
    console.log('');

    if (updatedCount > 0) {
      console.log('✅ Notification metadata added successfully!');
      console.log('   Notification center and settings page will now show module categories automatically.\n');
    } else {
      console.log('ℹ️  All modules already have notification metadata.\n');
    }

  } catch (error) {
    console.error('❌ Error adding notification metadata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  addNotificationMetadata()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { addNotificationMetadata };
