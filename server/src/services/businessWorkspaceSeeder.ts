import { ConversationType, ParticipantRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

interface SeedParams {
  userId: string;
  businessId: string;
  businessName?: string | null;
  dashboardId: string;
}

export async function seedBusinessWorkspaceResources({
  userId,
  businessId,
  businessName,
  dashboardId,
}: SeedParams): Promise<void> {
  try {
    await ensureBusinessRootFolder(userId, dashboardId, businessName);
  } catch (error) {
    await logSeedingError('drive_root_folder', error);
  }

  try {
    await ensureBusinessPrimaryCalendar(userId, businessId, businessName);
  } catch (error) {
    await logSeedingError('business_calendar', error);
  }

  try {
    await ensureBusinessGeneralConversation(userId, dashboardId, businessName);
  } catch (error) {
    await logSeedingError('business_conversation', error);
  }
}

async function ensureBusinessRootFolder(
  userId: string,
  dashboardId: string,
  businessName?: string | null
) {
  const existingFolder = await prisma.folder.findFirst({
    where: {
      userId,
      dashboardId,
      parentId: null,
      trashedAt: null,
    },
  });

  if (existingFolder) {
    return;
  }

  const name = businessName ? `${businessName} Drive` : 'Company Drive';

  await prisma.folder.create({
    data: {
      userId,
      name,
      parentId: null,
      dashboardId,
      order: 0,
    },
  });

  await logger.info('Seeded business root drive folder', {
    operation: 'seed_business_drive_folder',
    userId,
    dashboardId,
  });
}

async function ensureBusinessPrimaryCalendar(
  userId: string,
  businessId: string,
  businessName?: string | null
) {
  const existing = await prisma.calendar.findFirst({
    where: {
      contextType: 'BUSINESS',
      contextId: businessId,
      isPrimary: true,
    },
  });

  if (existing) {
    return;
  }

  const calendarName = businessName ? `${businessName} Calendar` : 'Company Calendar';

  await prisma.calendar.create({
    data: {
      name: calendarName,
      contextType: 'BUSINESS',
      contextId: businessId,
      isPrimary: true,
      isSystem: false,
      isDeletable: true,
      defaultReminderMinutes: 10,
      members: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
  });

  await logger.info('Seeded business primary calendar', {
    operation: 'seed_business_calendar',
    userId,
    businessId,
  });
}

async function ensureBusinessGeneralConversation(
  userId: string,
  dashboardId: string,
  businessName?: string | null
) {
  const existing = await prisma.conversation.findFirst({
    where: {
      dashboardId,
      type: ConversationType.CHANNEL,
      trashedAt: null,
    },
  });

  if (existing) {
    return;
  }

  const conversationName = businessName ? `${businessName} HQ` : 'Company HQ';

  await prisma.conversation.create({
    data: {
      name: conversationName,
      type: ConversationType.CHANNEL,
      dashboardId,
      participants: {
        create: [
          {
            userId,
            role: ParticipantRole.OWNER,
          },
        ],
      },
    },
  });

  await logger.info('Seeded business general chat conversation', {
    operation: 'seed_business_chat_conversation',
    userId,
    dashboardId,
  });
}

async function logSeedingError(stage: string, error: unknown) {
  await logger.error('Failed to seed business workspace resource', {
    operation: 'seed_business_workspace',
    stage,
    error: {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
}

