import path from 'path';
import {
  OnboardingJourneyStatus,
  OnboardingTaskOwnerType,
  OnboardingTaskStatus,
  OnboardingTaskType,
  Prisma
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { ensureBusinessDashboardForUser } from './dashboardService';
import { ensureEmployeeDocumentsFolder } from './driveService';
import { storageService } from './storageService';
import { NotificationService } from './notificationService';

type JsonInput = Prisma.InputJsonValue | null | undefined;

export interface OnboardingTaskTemplateInput {
  id?: string;
  title: string;
  description?: string | null;
  orderIndex?: number | null;
  taskType?: OnboardingTaskType;
  ownerType?: OnboardingTaskOwnerType;
  ownerReference?: string | null;
  dueOffsetDays?: number | null;
  requiresApproval?: boolean;
  requiresDocument?: boolean;
  metadata?: JsonInput;
  isActive?: boolean;
}

export interface UpsertOnboardingTemplateInput {
  id?: string;
  businessId: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  ownerUserId?: string | null;
  applicabilityRules?: JsonInput;
  automationSettings?: JsonInput;
  tasks?: OnboardingTaskTemplateInput[];
}

export interface StartOnboardingJourneyInput {
  businessId: string;
  employeeHrProfileId: string;
  onboardingTemplateId?: string;
  startDate?: Date;
  metadata?: JsonInput;
  initiatedByUserId?: string | null;
}

export interface CompleteOnboardingTaskInput {
  businessId: string;
  taskId: string;
  completedByUserId: string;
  status?: OnboardingTaskStatus;
  notes?: string | null;
  metadata?: JsonInput;
  approved?: boolean;
  approvedByUserId?: string | null;
}

interface OnboardingDocumentChecklistItemConfig {
  id: string;
  title: string;
  description?: string | null;
  required: boolean;
  driveFileId?: string;
  driveFileName?: string;
  driveFileType?: string;
  driveFileUrl?: string;
}

interface OnboardingModuleSettingsConfig {
  documentChecklist?: OnboardingDocumentChecklistItemConfig[];
}

const jsonOrNull = (value: JsonInput): Prisma.InputJsonValue => {
  if (value === undefined || value === null) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }
  return value;
};

const sanitizeFileName = (name: string): string => {
  const trimmed = name.trim();
  const sanitized = trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-');
  return sanitized.length > 0 ? sanitized : 'Document';
};

async function getOnboardingModuleSettings(
  businessId: string
): Promise<OnboardingModuleSettingsConfig | null> {
  const installation = await prisma.businessModuleInstallation.findUnique({
    where: { moduleId_businessId: { moduleId: 'hr', businessId } },
    select: { configured: true }
  });

  if (!installation?.configured) {
    return null;
  }

  const configured = installation.configured as {
    settings?: {
      onboarding?: OnboardingModuleSettingsConfig;
    };
  } | null;

  return configured?.settings?.onboarding ?? null;
}

export async function findEmployeeHrProfileByUser(
  businessId: string,
  userId: string
) {
  return prisma.employeeHRProfile.findFirst({
    where: {
      businessId,
      employeePosition: {
        businessId,
        userId,
        active: true
      }
    },
    include: {
      employeePosition: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true }
          },
          position: {
            include: {
              department: true,
              tier: true
            }
          }
        }
      }
    }
  });
}

export async function listEmployeeJourneysForProfile(
  businessId: string,
  employeeHrProfileId: string
) {
  return prisma.employeeOnboardingJourney.findMany({
    where: {
      businessId,
      employeeHrProfileId
    },
    orderBy: { createdAt: 'desc' },
    include: {
      onboardingTemplate: true,
      tasks: {
        orderBy: { orderIndex: 'asc' }
      }
    }
  });
}

export async function listEmployeeJourneysForUser(
  businessId: string,
  userId: string
) {
  const profile = await findEmployeeHrProfileByUser(businessId, userId);
  if (!profile) {
    return { profile: null, journeys: [] };
  }

  const journeys = await listEmployeeJourneysForProfile(businessId, profile.id);

  return {
    profile,
    journeys
  };
}

export async function listOnboardingTasksForEmployeePositions(
  businessId: string,
  employeePositionIds: string[]
) {
  if (employeePositionIds.length === 0) {
    return [];
  }

  return prisma.employeeOnboardingTask.findMany({
    where: {
      businessId,
      status: {
        notIn: [OnboardingTaskStatus.COMPLETED, OnboardingTaskStatus.CANCELLED]
      },
      onboardingJourney: {
        employeeHrProfile: {
          employeePositionId: {
            in: employeePositionIds
          }
        }
      }
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    include: {
      onboardingJourney: {
        include: {
          onboardingTemplate: true,
          employeeHrProfile: {
            include: {
              employeePosition: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true, image: true }
                  },
                  position: {
                    include: {
                      department: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
}

export async function listOnboardingTemplates(businessId: string) {
  return prisma.onboardingTemplate.findMany({
    where: { businessId, archivedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    include: {
      taskTemplates: {
        where: { isActive: true },
        orderBy: { orderIndex: 'asc' }
      }
    }
  });
}

export async function upsertOnboardingTemplate(input: UpsertOnboardingTemplateInput) {
  const {
    id,
    businessId,
    name,
    description,
    isDefault,
    isActive,
    ownerUserId,
    applicabilityRules,
    automationSettings,
    tasks = []
  } = input;

  return prisma.$transaction(async (tx) => {
    const templateData: Prisma.OnboardingTemplateUncheckedCreateInput = {
      businessId,
      name,
      description: description ?? null,
      isDefault: isDefault ?? false,
      isActive: isActive ?? true,
      ownerUserId: ownerUserId ?? null,
      applicabilityRules: jsonOrNull(applicabilityRules),
      automationSettings: jsonOrNull(automationSettings)
    };

    const template = id
      ? await tx.onboardingTemplate.update({
          where: { id, businessId },
          data: templateData
        })
      : await tx.onboardingTemplate.create({
          data: templateData
        });

    // Synchronize task templates
    const existingTasks = await tx.onboardingTaskTemplate.findMany({
      where: { onboardingTemplateId: template.id }
    });
    const incomingIds = tasks
      .map((task) => task.id)
      .filter((taskId): taskId is string => typeof taskId === 'string');

    const tasksToArchive = existingTasks.filter(
      (task) => !incomingIds.includes(task.id)
    );

    if (tasksToArchive.length > 0) {
      await tx.onboardingTaskTemplate.updateMany({
        where: { id: { in: tasksToArchive.map((task) => task.id) } },
        data: { isActive: false }
      });
    }

    for (const [index, taskInput] of tasks.entries()) {
      const {
        id: taskId,
        title,
        description: taskDescription,
        taskType,
        ownerType,
        ownerReference,
        dueOffsetDays,
        requiresApproval,
        requiresDocument,
        metadata,
        isActive: taskIsActive
      } = taskInput;

      const taskData: Prisma.OnboardingTaskTemplateUncheckedCreateInput = {
        onboardingTemplateId: template.id,
        businessId,
        title,
        description: taskDescription ?? null,
        taskType: taskType ?? OnboardingTaskType.CUSTOM,
        ownerType: ownerType ?? OnboardingTaskOwnerType.EMPLOYEE,
        ownerReference: ownerReference ?? null,
        dueOffsetDays: dueOffsetDays ?? null,
        requiresApproval: requiresApproval ?? false,
        requiresDocument: requiresDocument ?? false,
        metadata: jsonOrNull(metadata),
        orderIndex: taskInput.orderIndex ?? index,
        isActive: taskIsActive ?? true
      };

      if (taskId) {
        await tx.onboardingTaskTemplate.update({
          where: { id: taskId, onboardingTemplateId: template.id },
          data: taskData
        });
      } else {
        await tx.onboardingTaskTemplate.create({ data: taskData });
      }
    }

    if (template.isDefault) {
      await tx.onboardingTemplate.updateMany({
        where: {
          businessId,
          id: { not: template.id },
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    return tx.onboardingTemplate.findUnique({
      where: { id: template.id },
      include: {
        taskTemplates: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
  });
}

export async function archiveOnboardingTemplate(businessId: string, templateId: string, archivedByUserId?: string | null) {
  await prisma.onboardingTemplate.updateMany({
    where: { id: templateId, businessId },
    data: {
      isActive: false,
      archivedAt: new Date(),
      archivedBy: archivedByUserId ?? null
    }
  });
}

export async function startOnboardingJourney(input: StartOnboardingJourneyInput) {
  const {
    businessId,
    employeeHrProfileId,
    onboardingTemplateId,
    metadata,
    initiatedByUserId
  } = input;
  const startDate = input.startDate ?? new Date();

  const template = onboardingTemplateId
    ? await prisma.onboardingTemplate.findFirst({
        where: { id: onboardingTemplateId, businessId, isActive: true },
        include: {
          taskTemplates: {
            where: { isActive: true },
            orderBy: { orderIndex: 'asc' }
          }
        }
      })
    : await prisma.onboardingTemplate.findFirst({
        where: { businessId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        include: {
          taskTemplates: {
            where: { isActive: true },
            orderBy: { orderIndex: 'asc' }
          }
        }
      });

  if (!template) {
    throw new Error('No onboarding template available for this business');
  }

  return prisma.$transaction(async (tx) => {
    const journey = await tx.employeeOnboardingJourney.create({
      data: {
        businessId,
        employeeHrProfileId,
        onboardingTemplateId: template.id,
        startDate,
        status: OnboardingJourneyStatus.IN_PROGRESS,
        metadata: jsonOrNull(metadata)
      }
    });

    const taskCreates: Prisma.EmployeeOnboardingTaskUncheckedCreateInput[] =
      template.taskTemplates.map((taskTemplate) => {
        const dueDate = typeof taskTemplate.dueOffsetDays === 'number'
          ? new Date(startDate.getTime() + taskTemplate.dueOffsetDays * 24 * 60 * 60 * 1000)
          : null;

        return {
          businessId,
          onboardingJourneyId: journey.id,
          onboardingTaskTemplateId: taskTemplate.id,
          title: taskTemplate.title,
          description: taskTemplate.description ?? null,
          taskType: taskTemplate.taskType,
          ownerType: taskTemplate.ownerType,
          ownerReference: taskTemplate.ownerReference ?? null,
          dueDate,
          requiresApproval: taskTemplate.requiresApproval ?? false,
          metadata: taskTemplate.metadata ?? Prisma.JsonNull,
          orderIndex: taskTemplate.orderIndex ?? 0,
          status: OnboardingTaskStatus.PENDING
        };
      });

    if (taskCreates.length > 0) {
      await tx.employeeOnboardingTask.createMany({ data: taskCreates });
    }

    logger.info('Started onboarding journey', {
      businessId,
      employeeHrProfileId,
      journeyId: journey.id,
      templateId: template.id,
      initiatedByUserId: initiatedByUserId ?? null
    });

    return tx.employeeOnboardingJourney.findUnique({
      where: { id: journey.id },
      include: {
        onboardingTemplate: true,
        tasks: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
  });
}

export async function listEmployeeJourneys(businessId: string, employeeHrProfileId: string) {
  return prisma.employeeOnboardingJourney.findMany({
    where: {
      businessId,
      employeeHrProfileId
    },
    orderBy: { createdAt: 'desc' },
    include: {
      onboardingTemplate: true,
      tasks: {
        orderBy: { orderIndex: 'asc' }
      }
    }
  });
}

export async function listAllOnboardingJourneys(businessId: string) {
  return prisma.employeeOnboardingJourney.findMany({
    where: {
      businessId
    },
    orderBy: { createdAt: 'desc' },
    include: {
      onboardingTemplate: true,
      employeeHrProfile: {
        include: {
          employeePosition: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      },
      tasks: {
        orderBy: { orderIndex: 'asc' }
      }
    }
  });
}

export async function completeOnboardingTask(input: CompleteOnboardingTaskInput) {
  const {
    businessId,
    taskId,
    completedByUserId,
    status,
    notes,
    metadata,
    approved,
    approvedByUserId
  } = input;

  const task = await prisma.employeeOnboardingTask.findFirst({
    where: { id: taskId, businessId }
  });

  if (!task) {
    throw new Error('Onboarding task not found');
  }

  const updates: Prisma.EmployeeOnboardingTaskUpdateInput = {
    status: status ?? OnboardingTaskStatus.COMPLETED,
    completedAt: task.completedAt ?? new Date(),
    completedByUserId,
    notes: notes ?? task.notes ?? null,
    metadata: metadata ?? task.metadata ?? Prisma.JsonNull
  };

  if (approved) {
    updates.approvedAt = task.approvedAt ?? new Date();
    updates.approvedByUserId = approvedByUserId ?? completedByUserId;
  }

  const updatedTask = await prisma.employeeOnboardingTask.update({
    where: { id: taskId },
    data: updates,
    include: {
      onboardingJourney: {
        include: {
          employeeHrProfile: {
            include: {
              employeePosition: {
                include: {
                  user: { select: { id: true, name: true, email: true } }
                }
              }
            }
          }
        }
      }
    }
  });

  // Send notifications based on task completion/approval
  try {
    const employeeUserId = updatedTask.onboardingJourney.employeeHrProfile?.employeePosition?.user?.id;
    
    if (approved && employeeUserId) {
      // Notify employee that their task was approved
      await NotificationService.createNotification({
        userId: employeeUserId,
        type: 'hr_onboarding_task_approved',
        title: 'Onboarding Task Approved',
        body: `Your task "${updatedTask.title}" has been approved.`,
        data: {
          taskId: updatedTask.id,
          journeyId: updatedTask.onboardingJourneyId,
          businessId,
          actionUrl: `/business/${businessId}/workspace/hr/me`
        }
      });
    } else if (status === OnboardingTaskStatus.COMPLETED && updatedTask.requiresApproval && employeeUserId) {
      // Notify manager that a task needs approval
      // Find the manager (ownerReference or default manager)
      const managerUserId = updatedTask.ownerReference || null;
      if (managerUserId) {
        await NotificationService.createNotification({
          userId: managerUserId,
          type: 'hr_onboarding_task_pending_approval',
          title: 'Onboarding Task Pending Approval',
          body: `${updatedTask.onboardingJourney.employeeHrProfile?.employeePosition?.user?.name || 'An employee'} completed "${updatedTask.title}" and needs your approval.`,
          data: {
            taskId: updatedTask.id,
            journeyId: updatedTask.onboardingJourneyId,
            businessId,
            employeeUserId,
            actionUrl: `/business/${businessId}/workspace/hr/team`
          }
        });
      }
    }
  } catch (notificationError) {
    // Don't fail task completion if notification fails
    await logger.warn('Failed to send onboarding notification', {
      operation: 'onboarding_notification_error',
      taskId: updatedTask.id,
      error: notificationError instanceof Error ? notificationError.message : 'Unknown error'
    });
  }

  // If all tasks completed, mark journey as completed
  const remaining = await prisma.employeeOnboardingTask.count({
    where: {
      onboardingJourneyId: updatedTask.onboardingJourneyId,
      businessId,
      status: { notIn: [OnboardingTaskStatus.COMPLETED, OnboardingTaskStatus.CANCELLED] }
    }
  });

  if (remaining === 0) {
    const completedJourney = await prisma.employeeOnboardingJourney.update({
      where: { id: updatedTask.onboardingJourneyId },
      data: {
        status: OnboardingJourneyStatus.COMPLETED,
        completionDate: new Date()
      },
      include: {
        employeeHrProfile: {
          include: {
            employeePosition: {
              include: {
                user: { select: { id: true, name: true, email: true } }
              }
            }
          }
        }
      }
    });

    // Notify employee and HR that journey is completed
    try {
      const employeeUserId = completedJourney.employeeHrProfile?.employeePosition?.user?.id;
      if (employeeUserId) {
        await NotificationService.createNotification({
          userId: employeeUserId,
          type: 'hr_onboarding_journey_completed',
          title: 'Onboarding Journey Completed! 🎉',
          body: 'Congratulations! You have completed your onboarding journey.',
          data: {
            journeyId: completedJourney.id,
            businessId,
            actionUrl: `/business/${businessId}/workspace/hr/me`
          }
        });
      }
    } catch (notificationError) {
      await logger.warn('Failed to send journey completion notification', {
        operation: 'onboarding_journey_completion_notification_error',
        journeyId: completedJourney.id,
        error: notificationError instanceof Error ? notificationError.message : 'Unknown error'
      });
    }
  }

  return updatedTask;
}

export async function getJourneySummary(businessId: string, journeyId: string) {
  return prisma.employeeOnboardingJourney.findFirst({
    where: { id: journeyId, businessId },
    include: {
      onboardingTemplate: true,
      tasks: {
        orderBy: { orderIndex: 'asc' }
      }
    }
  });
}

export async function deliverOnboardingDocuments(params: {
  businessId: string;
  employeeUserId: string;
  initiatedByUserId?: string | null;
}) {
  const { businessId, employeeUserId, initiatedByUserId } = params;

  const settings = await getOnboardingModuleSettings(businessId);
  const checklist = settings?.documentChecklist?.filter(
    (item): item is OnboardingDocumentChecklistItemConfig & { driveFileId: string } =>
      Boolean(item.driveFileId)
  );

  if (!checklist || checklist.length === 0) {
    await logger.info('No onboarding documents configured for delivery', {
      operation: 'onboarding_deliver_documents_skip',
      businessId,
      employeeUserId
    });
    return [];
  }

  const dashboard = await ensureBusinessDashboardForUser(employeeUserId, businessId);
  if (!dashboard) {
    console.error('Failed to create or retrieve dashboard for employee:', employeeUserId);
    return [];
  }
  const folder = await ensureEmployeeDocumentsFolder(employeeUserId, dashboard.id);

  const delivered: Array<{ checklistId: string; fileId: string }> = [];

  for (const item of checklist) {
    try {
      const sourceFile = await prisma.file.findUnique({
        where: { id: item.driveFileId }
      });

      if (!sourceFile || !sourceFile.path) {
        await logger.warn('Source onboarding document not found or missing path', {
          operation: 'onboarding_deliver_document_missing_source',
          businessId,
          employeeUserId,
          sourceFileId: item.driveFileId
        });
        continue;
      }

      const originalName = sourceFile.name || item.driveFileName || item.title || 'Document';
      const extension = path.extname(originalName);
      const baseName =
        item.driveFileName?.replace(extension, '') ||
        item.title?.replace(extension, '') ||
        originalName.replace(extension, '');
      const safeBaseName = sanitizeFileName(baseName);
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const storageFileName = `${safeBaseName.toLowerCase().replace(/\s+/g, '-')}-${uniqueSuffix}${extension}`;
      const destinationPath = `files/hr-onboarding/${employeeUserId}/${storageFileName}`;

      const copyResult = await storageService.copyFile(sourceFile.path, destinationPath);

      const finalDisplayName = extension
        ? `${sanitizeFileName(item.driveFileName ?? item.title ?? baseName)}${extension}`
        : sanitizeFileName(item.driveFileName ?? item.title ?? baseName);

      const clonedFile = await prisma.file.create({
        data: {
          userId: employeeUserId,
          name: finalDisplayName,
          type: item.driveFileType ?? sourceFile.type,
          size: sourceFile.size,
          url: copyResult.url,
          path: copyResult.path,
          folderId: folder.id,
          dashboardId: dashboard.id
        }
      });

      delivered.push({ checklistId: item.id, fileId: clonedFile.id });

      await logger.info('Delivered onboarding document to employee', {
        operation: 'onboarding_deliver_document_success',
        businessId,
        employeeUserId,
        checklistId: item.id,
        clonedFileId: clonedFile.id,
        initiatedByUserId: initiatedByUserId ?? null
      });
    } catch (error) {
      await logger.error('Failed to deliver onboarding document', {
        operation: 'onboarding_deliver_document_error',
        businessId,
        employeeUserId,
        checklistId: item.id,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    }
  }

  return delivered;
}


