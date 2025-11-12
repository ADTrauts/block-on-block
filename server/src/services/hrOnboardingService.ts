import {
  OnboardingJourneyStatus,
  OnboardingTaskOwnerType,
  OnboardingTaskStatus,
  OnboardingTaskType,
  Prisma
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

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

const jsonOrNull = (value: JsonInput): Prisma.InputJsonValue => {
  if (value === undefined || value === null) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }
  return value;
};

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
    data: updates
  });

  // If all tasks completed, mark journey as completed
  const remaining = await prisma.employeeOnboardingTask.count({
    where: {
      onboardingJourneyId: updatedTask.onboardingJourneyId,
      businessId,
      status: { notIn: [OnboardingTaskStatus.COMPLETED, OnboardingTaskStatus.CANCELLED] }
    }
  });

  if (remaining === 0) {
    await prisma.employeeOnboardingJourney.update({
      where: { id: updatedTask.onboardingJourneyId },
      data: {
        status: OnboardingJourneyStatus.COMPLETED,
        completionDate: new Date()
      }
    });
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


