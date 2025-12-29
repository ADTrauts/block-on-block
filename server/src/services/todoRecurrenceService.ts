/**
 * To-Do Recurrence Service
 * Handles RRULE parsing and task instance generation
 */

import { rrulestr, RRule } from 'rrule';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Generate recurring task instances based on RRULE
 * @param parentTaskId - The parent recurring task ID
 * @param startDate - Start date for generating instances
 * @param endDate - End date for generating instances (optional, uses recurrenceEndAt if not provided)
 * @returns Array of generated task instances
 */
export async function generateRecurringInstances(
  parentTaskId: string,
  startDate: Date,
  endDate?: Date
): Promise<Array<{ dueDate: Date; startDate?: Date }>> {
  try {
    // Get parent task
    const parentTask = await prisma.task.findUnique({
      where: { id: parentTaskId },
      select: {
        id: true,
        title: true,
        description: true,
        recurrenceRule: true,
        recurrenceEndAt: true,
        dueDate: true,
        startDate: true,
        dashboardId: true,
        businessId: true,
        createdById: true,
        priority: true,
        projectId: true,
      },
    });

    if (!parentTask || !parentTask.recurrenceRule) {
      return [];
    }

    // Parse RRULE
    const rule = rrulestr(parentTask.recurrenceRule, {
      dtstart: parentTask.dueDate ? new Date(parentTask.dueDate) : new Date(),
      forceset: /EXDATE/i.test(parentTask.recurrenceRule),
    });

    // Determine end date for generation
    const generationEndDate = endDate || parentTask.recurrenceEndAt 
      ? new Date(parentTask.recurrenceEndAt!) 
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Default: 1 year ahead

    // Generate occurrences
    let occurrences: Date[] = [];
    if ((rule as any).between) {
      occurrences = (rule as any).between(startDate, generationEndDate, true);
    } else {
      const allOccurrences = (rule as any).all();
      occurrences = allOccurrences.filter((d: Date) => d >= startDate && d <= generationEndDate);
    }

    // Respect recurrenceEndAt if provided
    if (parentTask.recurrenceEndAt) {
      const until = new Date(parentTask.recurrenceEndAt);
      occurrences = occurrences.filter((d: Date) => d.getTime() <= until.getTime());
    }

    // Calculate duration if startDate exists
    const durationMs = parentTask.startDate && parentTask.dueDate
      ? new Date(parentTask.dueDate).getTime() - new Date(parentTask.startDate).getTime()
      : 0;

    // Map occurrences to task instance data
    const instances = occurrences.map((occurrence: Date) => {
      const instanceDueDate = new Date(occurrence);
      const instanceStartDate = parentTask.startDate && durationMs > 0
        ? new Date(instanceDueDate.getTime() - durationMs)
        : undefined;

      return {
        dueDate: instanceDueDate,
        startDate: instanceStartDate,
      };
    });

    return instances;
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to generate recurring instances', {
      operation: 'todo_generate_recurring_instances',
      parentTaskId,
      error: { message: err.message, stack: err.stack },
    });
    throw error;
  }
}

/**
 * Create task instances for a recurring task
 * @param parentTaskId - The parent recurring task ID
 * @param maxInstances - Maximum number of instances to create (default: 100)
 * @returns Number of instances created
 */
export async function createRecurringInstances(
  parentTaskId: string,
  maxInstances: number = 100
): Promise<number> {
  try {
    // Get parent task
    const parentTask = await prisma.task.findUnique({
      where: { id: parentTaskId },
      select: {
        id: true,
        title: true,
        description: true,
        recurrenceRule: true,
        recurrenceEndAt: true,
        dueDate: true,
        startDate: true,
        dashboardId: true,
        businessId: true,
        createdById: true,
        priority: true,
        projectId: true,
        status: true,
        category: true,
        tags: true,
        timeEstimate: true,
      },
    });

    if (!parentTask || !parentTask.recurrenceRule) {
      return 0;
    }

    // Check existing instances to avoid duplicates
    const existingInstances = await prisma.task.findMany({
      where: {
        parentRecurringTaskId: parentTaskId,
        trashedAt: null,
      },
      select: {
        dueDate: true,
      },
    });

    const existingDates = new Set(
      existingInstances.map(inst => inst.dueDate?.toISOString() || '')
    );

    // Generate instances starting from the parent task's due date (or now if no due date)
    const startDate = parentTask.dueDate ? new Date(parentTask.dueDate) : new Date();
    const instances = await generateRecurringInstances(
      parentTaskId,
      startDate,
      parentTask.recurrenceEndAt ? new Date(parentTask.recurrenceEndAt) : undefined
    );

    // Filter out existing instances and limit to maxInstances
    const newInstances = instances
      .filter(inst => !existingDates.has(inst.dueDate.toISOString()))
      .slice(0, maxInstances);

    if (newInstances.length === 0) {
      return 0;
    }

    // Create instances in bulk
    const created = await prisma.task.createMany({
      data: newInstances.map(inst => ({
        title: parentTask.title,
        description: parentTask.description,
        status: 'TODO' as const, // Instances always start as TODO
        priority: parentTask.priority,
        dashboardId: parentTask.dashboardId,
        businessId: parentTask.businessId,
        createdById: parentTask.createdById,
        dueDate: inst.dueDate,
        startDate: inst.startDate,
        parentRecurringTaskId: parentTaskId,
        projectId: parentTask.projectId,
        category: parentTask.category,
        tags: parentTask.tags,
        timeEstimate: parentTask.timeEstimate,
      })),
    });

    await logger.info('Recurring task instances created', {
      operation: 'todo_create_recurring_instances',
      parentTaskId,
      count: created.count,
    });

    return created.count;
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to create recurring instances', {
      operation: 'todo_create_recurring_instances',
      parentTaskId,
      error: { message: err.message, stack: err.stack },
    });
    throw error;
  }
}

/**
 * Validate an RRULE string
 * @param rrule - The RRULE string to validate
 * @param dtstart - Optional start date for validation
 * @returns true if valid, false otherwise
 */
export function validateRRULE(rrule: string, dtstart?: Date): boolean {
  try {
    if (!rrule || typeof rrule !== 'string') {
      return false;
    }

    // Basic validation: must contain FREQ
    if (!/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i.test(rrule)) {
      return false;
    }

    // Try to parse the rule
    rrulestr(rrule, {
      dtstart: dtstart || new Date(),
      forceset: /EXDATE/i.test(rrule),
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a human-readable description of an RRULE
 * @param rrule - The RRULE string
 * @param dtstart - Optional start date
 * @returns Human-readable description
 */
export function describeRRULE(rrule: string, dtstart?: Date): string {
  try {
    if (!rrule) {
      return 'No recurrence';
    }

    const rule = rrulestr(rrule, {
      dtstart: dtstart || new Date(),
      forceset: /EXDATE/i.test(rrule),
    });

    // Get frequency
    const freq = (rule as any).options?.freq;
    const interval = (rule as any).options?.interval || 1;

    let description = '';
    switch (freq) {
      case RRule.DAILY:
        description = interval === 1 ? 'Daily' : `Every ${interval} days`;
        break;
      case RRule.WEEKLY:
        description = interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
        break;
      case RRule.MONTHLY:
        description = interval === 1 ? 'Monthly' : `Every ${interval} months`;
        break;
      case RRule.YEARLY:
        description = interval === 1 ? 'Yearly' : `Every ${interval} years`;
        break;
      default:
        description = 'Recurring';
    }

    // Add day of week if specified
    const byweekday = (rule as any).options?.byweekday;
    if (byweekday && Array.isArray(byweekday) && byweekday.length > 0) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const days = byweekday.map((d: number) => dayNames[d]).join(', ');
      description += ` on ${days}`;
    }

    return description;
  } catch {
    return 'Invalid recurrence rule';
  }
}

