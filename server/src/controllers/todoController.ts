/**
 * To-Do Module Controller
 * Handles all task-related operations
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import { Prisma } from '@prisma/client';
import { TodoAIPrioritizationService } from '../services/todoAIPrioritizationService';
import { TodoSmartSchedulingService } from '../services/todoSmartSchedulingService';
import { TodoChatIntegrationService } from '../services/todoChatIntegrationService';

/**
 * Helper function to automatically create or update calendar event for a task
 * This ensures tasks with due dates always have corresponding calendar events
 */
async function ensureTaskCalendarEvent(taskId: string, userId: string): Promise<void> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        linkedEvents: true,
      },
    });

    if (!task || !task.dueDate) {
      // No task or no due date - nothing to do
      return;
    }

    // Check if task already has a linked event
    const existingLink = task.linkedEvents?.[0];
    let existingEvent = null;
    
    if (existingLink) {
      // Query the event separately since TaskEventLink doesn't have a direct relation
      existingEvent = await prisma.event.findUnique({
        where: { id: existingLink.eventId },
      });
    }

    // Get or find user's personal primary calendar
    let primaryCalendar = await prisma.calendar.findFirst({
      where: {
        contextType: 'PERSONAL',
        contextId: userId,
        isPrimary: true,
      },
    });

    if (!primaryCalendar) {
      const personalCalendars = await prisma.calendar.findMany({
        where: {
          contextType: 'PERSONAL',
          contextId: userId,
        },
      });
      primaryCalendar = personalCalendars[0];
    }

    if (!primaryCalendar) {
      // Auto-provision personal calendar
      const personalDash = await prisma.dashboard.findFirst({
        where: {
          userId,
          businessId: null,
          householdId: null,
        },
        orderBy: { createdAt: 'asc' },
      });
      const calendarName = personalDash?.name || 'My Dashboard';

      primaryCalendar = await prisma.calendar.create({
        data: {
          name: calendarName,
          contextType: 'PERSONAL',
          contextId: userId,
          isPrimary: true,
          isSystem: true,
          isDeletable: false,
          defaultReminderMinutes: 10,
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
      });
    }

    const targetCalendarId = primaryCalendar.id;

    // Calculate event times
    const startAt = new Date(task.dueDate);
    let endAt = new Date(startAt);
    if (task.timeEstimate) {
      endAt.setMinutes(endAt.getMinutes() + task.timeEstimate);
    } else {
      endAt.setHours(endAt.getHours() + 1);
    }

    if (existingEvent) {
      // Update existing event
      await prisma.event.update({
        where: { id: existingEvent.id },
        data: {
          title: task.title,
          description: task.description || undefined,
          location: task.category || undefined,
          startAt,
          endAt,
        },
      });
    } else {
      // Create new event
      const event = await prisma.event.create({
        data: {
          calendarId: targetCalendarId,
          title: task.title,
          description: task.description || undefined,
          location: task.category || undefined,
          startAt,
          endAt,
          allDay: false,
          timezone: 'UTC',
          createdById: userId,
          reminders: {
            create: [{
              method: 'APP',
              minutesBefore: 10,
            }],
          },
        },
      });

      // Create link
      await prisma.taskEventLink.create({
        data: {
          taskId: task.id,
          eventId: event.id,
        },
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    // Log but don't fail task creation/update if calendar event creation fails
    await logger.error('Failed to ensure task calendar event', {
      operation: 'ensure_task_calendar_event',
      error: { message: err.message, stack: err.stack },
      context: { taskId, userId },
    });
  }
}

/**
 * GET /api/todo/tasks
 * List tasks with filtering and sorting
 */
export async function getTasks(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { dashboardId, businessId, status, priority, dueDate, assignedToId, projectId } = req.query;

    const where: Prisma.TaskWhereInput = {
      createdById: userId,
      trashedAt: null,
    };

    // Dashboard scoping (required for multi-tenant isolation)
    if (dashboardId && typeof dashboardId === 'string') {
      where.dashboardId = dashboardId;
    }

    // Business scoping
    if (businessId && typeof businessId === 'string') {
      where.businessId = businessId;
    } else {
      // Personal context: exclude business tasks
      where.businessId = null;
    }

    // Status filter
    if (status && typeof status === 'string') {
      where.status = status as Prisma.EnumTaskStatusFilter;
    }

    // Priority filter
    if (priority && typeof priority === 'string') {
      where.priority = priority as Prisma.EnumTaskPriorityFilter;
    }

    // Due date filter
    if (dueDate && typeof dueDate === 'string') {
      const date = new Date(dueDate);
      where.dueDate = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999)),
      };
    }

    // Assigned to filter
    if (assignedToId && typeof assignedToId === 'string') {
      where.assignedToId = assignedToId;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        subtasks: {
          where: { trashedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        comments: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        attachments: {
          select: {
            id: true,
            name: true,
            url: true,
            size: true,
            mimeType: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            subtasks: true,
            comments: true,
            watchers: true,
            attachments: true,
          },
        },
      },
      orderBy: [
        // Parent recurring tasks first (have recurrenceRule but no parentRecurringTaskId)
        { parentRecurringTaskId: { sort: 'asc', nulls: 'first' } },
        { dueDate: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json(tasks);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get tasks', {
      operation: 'todo_get_tasks',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

/**
 * POST /api/todo/tasks
 * Create a new task
 */
export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      title,
      description,
      status,
      priority,
      dashboardId,
      businessId,
      householdId,
      dueDate,
      startDate,
      category,
      tags,
      timeEstimate,
      assignedToId,
      parentTaskId,
      projectId,
      recurrenceRule,
      recurrenceEndAt,
    } = req.body;

    if (!title || !dashboardId) {
      res.status(400).json({ error: 'Title and dashboardId are required' });
      return;
    }

    // Validate recurrence rule if provided
    if (recurrenceRule) {
      // Due date is required for recurring tasks
      if (!dueDate) {
        res.status(400).json({ error: 'Due date is required for recurring tasks' });
        return;
      }
      
      const { validateRRULE } = await import('../services/todoRecurrenceService');
      if (!validateRRULE(recurrenceRule, dueDate ? new Date(dueDate) : undefined)) {
        res.status(400).json({ error: 'Invalid recurrence rule (RRULE)' });
        return;
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        dashboardId,
        businessId: businessId || null,
        householdId: householdId || null,
        createdById: userId,
        assignedToId: assignedToId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        category: category || null,
        tags: tags || [],
        timeEstimate: timeEstimate || null,
        parentTaskId: parentTaskId || null,
        projectId: projectId || null,
        recurrenceRule: recurrenceRule || null,
        recurrenceEndAt: recurrenceEndAt ? new Date(recurrenceEndAt) : null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await logger.info('Task created', {
      operation: 'todo_create_task',
      taskId: task.id,
      userId,
    });

    // Automatically create calendar event if task has a due date
    if (task.dueDate) {
      await ensureTaskCalendarEvent(task.id, userId);
    }

    // Generate initial recurring instances if this is a recurring task
    if (task.recurrenceRule) {
      try {
        const { createRecurringInstances } = await import('../services/todoRecurrenceService');
        await createRecurringInstances(task.id, 10); // Generate first 10 instances
      } catch (error) {
        // Log but don't fail task creation if instance generation fails
        await logger.error('Failed to generate initial recurring instances', {
          operation: 'todo_create_task_instances',
          taskId: task.id,
          error: { message: (error as Error).message },
        });
      }
    }

    res.status(201).json(task);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to create task', {
      operation: 'todo_create_task',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to create task' });
  }
}

/**
 * GET /api/todo/tasks/:id
 * Get a single task by ID
 */
export async function getTaskById(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const task = await prisma.task.findFirst({
      where: {
        id,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        subtasks: {
          where: { trashedAt: null },
          orderBy: { createdAt: 'asc' },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        attachments: true,
        linkedFiles: true,
        linkedEvents: true,
        dependsOnTasks: {
          include: {
            dependsOn: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        blockingTasks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        watchers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(task);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get task', {
      operation: 'todo_get_task',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to fetch task' });
  }
}

/**
 * PUT /api/todo/tasks/:id
 * Update a task
 */
export async function updateTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      startDate,
      category,
      tags,
      timeEstimate,
      assignedToId,
      snoozedUntil,
      recurrenceRule,
      recurrenceEndAt,
      // Exclude fields that shouldn't be updated
      // dashboardId, businessId, householdId, createdById, etc.
    } = req.body;

    // Check if task exists and user has access
    const existingTask = await prisma.task.findFirst({
      where: {
        id,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        startDate: true,
        recurrenceRule: true,
        recurrenceEndAt: true,
        parentRecurringTaskId: true,
        category: true,
        tags: true,
        timeEstimate: true,
        assignedToId: true,
        snoozedUntil: true,
        completedAt: true,
      },
    });

    if (!existingTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Check if this is a parent recurring task (has recurrenceRule, no parentRecurringTaskId)
    const isParentRecurringTask = existingTask.recurrenceRule && !existingTask.parentRecurringTaskId;
    const isInstance = !!existingTask.parentRecurringTaskId;

    // Validate recurrence rule if provided
    if (recurrenceRule !== undefined && recurrenceRule !== null) {
      // Due date is required for recurring tasks
      const taskDueDate = dueDate !== undefined 
        ? (dueDate ? new Date(dueDate) : null)
        : (existingTask.dueDate ? new Date(existingTask.dueDate) : null);
      
      if (!taskDueDate) {
        res.status(400).json({ error: 'Due date is required for recurring tasks' });
        return;
      }
      
      const { validateRRULE } = await import('../services/todoRecurrenceService');
      if (!validateRRULE(recurrenceRule, taskDueDate)) {
        res.status(400).json({ error: 'Invalid recurrence rule (RRULE)' });
        return;
      }
    }

    // Build update data object with only allowed fields
    const updateData: Prisma.TaskUpdateInput = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (category !== undefined) updateData.category = category || null;
    if (tags !== undefined) updateData.tags = tags;
    if (timeEstimate !== undefined) updateData.timeEstimate = timeEstimate || null;
    if (assignedToId !== undefined) {
      updateData.assignedTo = assignedToId ? { connect: { id: assignedToId } } : { disconnect: true };
    }
    
    // Handle date fields
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }
    if (startDate !== undefined) {
      updateData.startDate = startDate ? new Date(startDate) : null;
    }
    if (snoozedUntil !== undefined) {
      updateData.snoozedUntil = snoozedUntil ? new Date(snoozedUntil) : null;
    }

    // Handle recurrence fields
    if (recurrenceRule !== undefined) {
      updateData.recurrenceRule = recurrenceRule || null;
    }
    if (recurrenceEndAt !== undefined) {
      updateData.recurrenceEndAt = recurrenceEndAt ? new Date(recurrenceEndAt) : null;
    }

    // Handle status change to DONE
    if (status === 'DONE' && existingTask.status !== 'DONE') {
      updateData.completedAt = new Date();
    } else if (status !== undefined && status !== 'DONE' && existingTask.status === 'DONE') {
      updateData.completedAt = null;
    }

    // Prevent editing instances if they're already created (instances should be independent)
    // However, allow editing if user explicitly wants to modify an instance
    // For now, we'll allow editing instances - they become independent once edited

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await logger.info('Task updated', {
      operation: 'todo_update_task',
      taskId: task.id,
      userId,
    });

    // Handle recurrence rule changes for parent recurring tasks
    // Only regenerate if recurrence rule actually changed
    if (isParentRecurringTask) {
      const recurrenceRuleChanged = recurrenceRule !== undefined && 
        recurrenceRule !== existingTask.recurrenceRule &&
        (recurrenceRule || '') !== (existingTask.recurrenceRule || '');
      
      const oldEndAt = existingTask.recurrenceEndAt ? new Date(existingTask.recurrenceEndAt).toISOString() : null;
      const newEndAt = recurrenceEndAt !== undefined 
        ? (recurrenceEndAt ? new Date(recurrenceEndAt).toISOString() : null)
        : oldEndAt;
      const recurrenceEndAtChanged = recurrenceEndAt !== undefined && newEndAt !== oldEndAt;

      // Only regenerate instances if recurrence rule or end date actually changed
      if (recurrenceRuleChanged || recurrenceEndAtChanged) {
        try {
          // Delete existing future instances (keep completed ones)
          await prisma.task.deleteMany({
            where: {
              parentRecurringTaskId: id,
              status: { not: 'DONE' },
              trashedAt: null,
            },
          });

          // Generate new instances if recurrence rule still exists
          if (task.recurrenceRule) {
            const { createRecurringInstances } = await import('../services/todoRecurrenceService');
            await createRecurringInstances(task.id, 10);
          }
        } catch (error) {
          // Log but don't fail the update if instance regeneration fails
          await logger.error('Failed to regenerate recurring instances', {
            operation: 'todo_update_task_regenerate',
            taskId: task.id,
            error: { message: (error as Error).message },
          });
        }
      }
    } else if (!isInstance && recurrenceRule !== undefined && recurrenceRule && !existingTask.recurrenceRule) {
      // Task is being converted to a recurring task (recurrenceRule added for first time)
      // Only create instances if this is a new recurring task, not an update to existing one
      try {
        const { createRecurringInstances } = await import('../services/todoRecurrenceService');
        await createRecurringInstances(task.id, 10);
      } catch (error) {
        await logger.error('Failed to create initial recurring instances', {
          operation: 'todo_update_task_create_instances',
          taskId: task.id,
          error: { message: (error as Error).message },
        });
      }
    }

    // Automatically create/update calendar event if task has a due date
    // Also handle case where dueDate was added or changed
    const hadDueDate = existingTask.dueDate !== null;
    const hasDueDate = task.dueDate !== null;
    const dueDateChanged = hadDueDate !== hasDueDate || 
      (existingTask.dueDate && task.dueDate && 
       new Date(existingTask.dueDate).getTime() !== new Date(task.dueDate).getTime());

    if (hasDueDate && (dueDateChanged || !hadDueDate)) {
      await ensureTaskCalendarEvent(task.id, userId);
    } else if (hasDueDate) {
      // Due date exists, ensure event is synced (title, description, etc. may have changed)
      await ensureTaskCalendarEvent(task.id, userId);
    }

    res.json(task);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to update task', {
      operation: 'todo_update_task',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to update task' });
  }
}

/**
 * DELETE /api/todo/tasks/:id
 * Soft delete a task (move to trash)
 */
export async function deleteTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Check if task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Soft delete
    await prisma.task.update({
      where: { id },
      data: { trashedAt: new Date() },
    });

    await logger.info('Task deleted', {
      operation: 'todo_delete_task',
      taskId: id,
      userId,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to delete task', {
      operation: 'todo_delete_task',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to delete task' });
  }
}

/**
 * POST /api/todo/tasks/:id/complete
 * Mark a task as complete
 */
export async function completeTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    res.json(task);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to complete task', {
      operation: 'todo_complete_task',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to complete task' });
  }
}

/**
 * POST /api/todo/tasks/:id/reopen
 * Reopen a completed task
 */
export async function reopenTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: status || 'TODO',
        completedAt: null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    res.json(task);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to reopen task', {
      operation: 'todo_reopen_task',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to reopen task' });
  }
}

/**
 * POST /api/todo/tasks/:id/create-event
 * Create a calendar event from a task
 */
export async function createEventFromTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    const { calendarId } = req.body;

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify user owns the task
    if (task.createdById !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if task has a due date
    if (!task.dueDate) {
      res.status(400).json({ error: 'Task must have a due date to create calendar event' });
      return;
    }

    // Get or find user's personal primary calendar, auto-provision if missing
    let targetCalendarId = calendarId;
    if (!targetCalendarId) {
      // First, try to find existing primary calendar
      let primaryCalendar = await prisma.calendar.findFirst({
        where: {
          contextType: 'PERSONAL',
          contextId: userId,
          isPrimary: true,
        },
      });

      // If no primary calendar exists, try to find any personal calendar
      if (!primaryCalendar) {
        const personalCalendars = await prisma.calendar.findMany({
          where: {
            contextType: 'PERSONAL',
            contextId: userId,
          },
        });
        primaryCalendar = personalCalendars[0];
      }

      // If still no calendar exists, auto-provision one
      if (!primaryCalendar) {
        try {
          // Find the user's first personal dashboard name for calendar naming
          const personalDash = await prisma.dashboard.findFirst({
            where: {
              userId,
              businessId: null,
              householdId: null,
            },
            orderBy: { createdAt: 'asc' },
          });
          const calendarName = personalDash?.name || 'My Dashboard';

          // Create the primary calendar
          primaryCalendar = await prisma.calendar.create({
            data: {
              name: calendarName,
              contextType: 'PERSONAL',
              contextId: userId,
              isPrimary: true,
              isSystem: true,
              isDeletable: false,
              defaultReminderMinutes: 10,
              members: {
                create: {
                  userId,
                  role: 'OWNER',
                },
              },
            },
          });
        } catch (error: unknown) {
          const err = error as Error;
          logger.error('Failed to auto-provision personal calendar', {
            operation: 'auto_provision_calendar',
            error: { message: err.message, stack: err.stack },
          });
          res.status(500).json({ error: 'Failed to create calendar. Please create a calendar first.' });
          return;
        }
      }

      targetCalendarId = primaryCalendar.id;
    }

    // Verify user has access to calendar
    const calendarMember = await prisma.calendarMember.findFirst({
      where: {
        calendarId: targetCalendarId,
        userId,
        role: { in: ['OWNER', 'ADMIN', 'EDITOR'] },
      },
    });

    if (!calendarMember) {
      res.status(403).json({ error: 'Access denied to calendar' });
      return;
    }

    // Calculate event end time
    const startAt = new Date(task.dueDate);
    let endAt = new Date(startAt);
    
    // Use timeEstimate if available (in minutes), default to 1 hour
    if (task.timeEstimate) {
      endAt.setMinutes(endAt.getMinutes() + task.timeEstimate);
    } else {
      endAt.setHours(endAt.getHours() + 1);
    }

    // Create calendar event
    const event = await prisma.event.create({
      data: {
        calendarId: targetCalendarId,
        title: task.title,
        description: task.description || undefined,
        location: task.category || undefined,
        startAt,
        endAt,
        allDay: false,
        timezone: 'UTC',
        createdById: userId,
        reminders: {
          create: [{
            method: 'APP',
            minutesBefore: 10,
          }],
        },
      },
    });

    // Create link between task and event
    await prisma.taskEventLink.create({
      data: {
        taskId: task.id,
        eventId: event.id,
      },
    });

    res.json({
      success: true,
      task,
      event: {
        id: event.id,
        title: event.title,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to create event from task', {
      operation: 'create_event_from_task',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
}

/**
 * POST /api/todo/tasks/:id/link-event
 * Link a task to an existing calendar event
 */
export async function linkTaskToEvent(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    const { eventId } = req.body;

    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify user owns the task
    if (task.createdById !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Verify event exists and user has access
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        calendar: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Check if user has access to the calendar
    const hasAccess = event.calendar.members.some(
      m => m.role === 'OWNER' || m.role === 'ADMIN' || m.role === 'EDITOR' || m.role === 'READER'
    );

    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied to calendar event' });
      return;
    }

    // Check if link already exists
    const existingLink = await prisma.taskEventLink.findUnique({
      where: {
        taskId_eventId: {
          taskId,
          eventId,
        },
      },
    });

    if (existingLink) {
      res.status(409).json({ error: 'Task is already linked to this event' });
      return;
    }

    // Create link
    await prisma.taskEventLink.create({
      data: {
        taskId,
        eventId,
      },
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to link task to event', {
      operation: 'link_task_to_event',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to link task to event' });
  }
}

/**
 * DELETE /api/todo/tasks/:id/unlink-event/:eventId
 * Unlink a task from a calendar event
 */
export async function unlinkTaskFromEvent(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    const eventId = req.params.eventId;

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify user owns the task
    if (task.createdById !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Delete the link
    await prisma.taskEventLink.delete({
      where: {
        taskId_eventId: {
          taskId,
          eventId,
        },
      },
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to unlink task from event', {
      operation: 'unlink_task_from_event',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to unlink task from event' });
  }
}

/**
 * POST /api/todo/tasks/:id/link-file
 * Link a Drive file to a task
 */
export async function linkTaskToFile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    const { fileId } = req.body;

    if (!fileId || typeof fileId !== 'string') {
      res.status(400).json({ error: 'fileId is required' });
      return;
    }

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify user owns the task
    if (task.createdById !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Verify file exists (check Drive module)
    // Note: In a real implementation, you'd verify the file exists in the Drive module
    // For now, we'll just create the link

    // Check if link already exists
    const existingLink = await prisma.taskFileLink.findUnique({
      where: {
        taskId_fileId: {
          taskId,
          fileId,
        },
      },
    });

    if (existingLink) {
      res.status(409).json({ error: 'File is already linked to this task' });
      return;
    }

    // Create link
    const link = await prisma.taskFileLink.create({
      data: {
        taskId,
        fileId,
      },
    });

    await logger.info('File linked to task', {
      operation: 'todo_link_file',
      taskId,
      fileId,
      userId,
    });

    res.json({ success: true, link });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to link file to task', {
      operation: 'todo_link_file',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to link file to task' });
  }
}

/**
 * DELETE /api/todo/tasks/:id/unlink-file/:fileId
 * Unlink a file from a task
 */
export async function unlinkTaskFromFile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    const fileId = req.params.fileId;

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify user owns the task
    if (task.createdById !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Delete the link
    await prisma.taskFileLink.delete({
      where: {
        taskId_fileId: {
          taskId,
          fileId,
        },
      },
    });

    await logger.info('File unlinked from task', {
      operation: 'todo_unlink_file',
      taskId,
      fileId,
      userId,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to unlink file from task', {
      operation: 'todo_unlink_file',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to unlink file from task' });
  }
}

/**
 * GET /api/todo/tasks/:id/linked-files
 * Get all Drive files linked to a task
 */
export async function getTaskLinkedFiles(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify user owns the task
    if (task.createdById !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get linked files
    const links = await prisma.taskFileLink.findMany({
      where: { taskId },
    });

    // Get file details from Drive module
    // Note: In a real implementation, you'd query the Drive module for file details
    // For now, we'll return the file IDs and let the frontend fetch details
    const fileIds = links.map(link => link.fileId);

    res.json({
      success: true,
      files: links.map(link => ({
        id: link.id,
        fileId: link.fileId,
        taskId: link.taskId,
      })),
      fileIds,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get linked files', {
      operation: 'todo_get_linked_files',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to get linked files' });
  }
}

/**
 * GET /api/todo/tasks/:id/linked-events
 * Get all calendar events linked to a task
 */
export async function getTaskLinkedEvents(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify user owns the task
    if (task.createdById !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get linked events
    const links = await prisma.taskEventLink.findMany({
      where: { taskId },
      include: {
        // Note: We can't directly include Event via Prisma relation, so we'll query separately
      },
    });

    // Get event details
    const eventIds = links.map(link => link.eventId);
    const events = await prisma.event.findMany({
      where: {
        id: { in: eventIds },
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        calendarId: true,
        description: true,
        location: true,
      },
    });

    res.json(events.map(event => ({
      id: event.id,
      title: event.title,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      calendarId: event.calendarId,
      description: event.description,
      location: event.location,
    })));
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to get linked events', {
      operation: 'get_task_linked_events',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to get linked events' });
  }
}

/**
 * POST /api/todo/tasks/:id/comments
 * Create a comment on a task
 */
export async function createTaskComment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    // Verify task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Create comment
    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await logger.info('Task comment created', {
      operation: 'todo_create_comment',
      taskId,
      commentId: comment.id,
      userId,
    });

    res.status(201).json(comment);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to create task comment', {
      operation: 'todo_create_comment',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to create comment' });
  }
}

/**
 * PUT /api/todo/tasks/:id/comments/:commentId
 * Update a comment on a task
 */
export async function updateTaskComment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    const commentId = req.params.commentId;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    // Verify comment exists and belongs to user
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      include: {
        task: true,
      },
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.taskId !== taskId) {
      res.status(400).json({ error: 'Comment does not belong to this task' });
      return;
    }

    if (comment.userId !== userId) {
      res.status(403).json({ error: 'You can only edit your own comments' });
      return;
    }

    // Update comment
    const updatedComment = await prisma.taskComment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await logger.info('Task comment updated', {
      operation: 'todo_update_comment',
      taskId,
      commentId,
      userId,
    });

    res.json(updatedComment);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to update task comment', {
      operation: 'todo_update_comment',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to update comment' });
  }
}

/**
 * DELETE /api/todo/tasks/:id/comments/:commentId
 * Delete a comment on a task
 */
export async function deleteTaskComment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    const commentId = req.params.commentId;

    // Verify comment exists and belongs to user
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.taskId !== taskId) {
      res.status(400).json({ error: 'Comment does not belong to this task' });
      return;
    }

    if (comment.userId !== userId) {
      res.status(403).json({ error: 'You can only delete your own comments' });
      return;
    }

    // Delete comment
    await prisma.taskComment.delete({
      where: { id: commentId },
    });

    await logger.info('Task comment deleted', {
      operation: 'todo_delete_comment',
      taskId,
      commentId,
      userId,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to delete task comment', {
      operation: 'todo_delete_comment',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to delete comment' });
  }
}

/**
 * POST /api/todo/tasks/:id/subtasks
 * Create a subtask
 */
export async function createSubtask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const parentTaskId = req.params.id;
    const { title, description, priority, dueDate } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Subtask title is required' });
      return;
    }

    // Verify parent task exists and user has access
    const parentTask = await prisma.task.findFirst({
      where: {
        id: parentTaskId,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!parentTask) {
      res.status(404).json({ error: 'Parent task not found' });
      return;
    }

    // Create subtask
    const subtask = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'MEDIUM',
        status: 'TODO',
        dashboardId: parentTask.dashboardId,
        businessId: parentTask.businessId,
        householdId: parentTask.householdId,
        createdById: userId,
        assignedToId: parentTask.assignedToId,
        parentTaskId: parentTaskId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await logger.info('Subtask created', {
      operation: 'todo_create_subtask',
      parentTaskId,
      subtaskId: subtask.id,
      userId,
    });

    res.status(201).json(subtask);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to create subtask', {
      operation: 'todo_create_subtask',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to create subtask' });
  }
}

/**
 * PUT /api/todo/tasks/:id/subtasks/:subtaskId
 * Update a subtask
 */
export async function updateSubtask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const parentTaskId = req.params.id;
    const subtaskId = req.params.subtaskId;
    const updateData = req.body;

    // Verify subtask exists and belongs to parent task
    const subtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
        parentTaskId: parentTaskId,
        trashedAt: null,
      },
      include: {
        parentTask: true,
      },
    });

    if (!subtask) {
      res.status(404).json({ error: 'Subtask not found' });
      return;
    }

    // Verify user has access to parent task
    if (!subtask.parentTask) {
      res.status(404).json({ error: 'Parent task not found' });
      return;
    }
    const hasAccess = subtask.parentTask.createdById === userId || 
                      subtask.parentTask.assignedToId === userId;
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Prepare update data
    const data: Record<string, unknown> = {};
    if (updateData.title !== undefined) {
      if (typeof updateData.title !== 'string' || updateData.title.trim().length === 0) {
        res.status(400).json({ error: 'Subtask title cannot be empty' });
        return;
      }
      data.title = updateData.title.trim();
    }
    if (updateData.description !== undefined) {
      data.description = updateData.description?.trim() || null;
    }
    if (updateData.priority !== undefined) {
      data.priority = updateData.priority;
    }
    if (updateData.status !== undefined) {
      data.status = updateData.status;
      if (updateData.status === 'DONE') {
        data.completedAt = new Date();
      } else if (subtask.status === 'DONE' && updateData.status !== 'DONE') {
        data.completedAt = null;
      }
    }
    if (updateData.dueDate !== undefined) {
      data.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    }

    // Update subtask
    const updatedSubtask = await prisma.task.update({
      where: { id: subtaskId },
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await logger.info('Subtask updated', {
      operation: 'todo_update_subtask',
      parentTaskId,
      subtaskId,
      userId,
    });

    res.json(updatedSubtask);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to update subtask', {
      operation: 'todo_update_subtask',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to update subtask' });
  }
}

/**
 * DELETE /api/todo/tasks/:id/subtasks/:subtaskId
 * Delete a subtask
 */
export async function deleteSubtask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const parentTaskId = req.params.id;
    const subtaskId = req.params.subtaskId;

    // Verify subtask exists and belongs to parent task
    const subtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
        parentTaskId: parentTaskId,
        trashedAt: null,
      },
      include: {
        parentTask: true,
      },
    });

    if (!subtask) {
      res.status(404).json({ error: 'Subtask not found' });
      return;
    }

    // Verify user has access to parent task
    if (!subtask.parentTask) {
      res.status(404).json({ error: 'Parent task not found' });
      return;
    }
    const hasAccess = subtask.parentTask.createdById === userId || 
                      subtask.parentTask.assignedToId === userId;
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Soft delete subtask
    await prisma.task.update({
      where: { id: subtaskId },
      data: { trashedAt: new Date() },
    });

    await logger.info('Subtask deleted', {
      operation: 'todo_delete_subtask',
      parentTaskId,
      subtaskId,
      userId,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to delete subtask', {
      operation: 'todo_delete_subtask',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to delete subtask' });
  }
}

/**
 * POST /api/todo/tasks/:id/subtasks/:subtaskId/complete
 * Complete a subtask
 */
export async function completeSubtask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const parentTaskId = req.params.id;
    const subtaskId = req.params.subtaskId;

    // Verify subtask exists and belongs to parent task
    const subtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
        parentTaskId: parentTaskId,
        trashedAt: null,
      },
      include: {
        parentTask: true,
      },
    });

    if (!subtask) {
      res.status(404).json({ error: 'Subtask not found' });
      return;
    }

    // Verify user has access to parent task
    if (!subtask.parentTask) {
      res.status(404).json({ error: 'Parent task not found' });
      return;
    }
    const hasAccess = subtask.parentTask.createdById === userId || 
                      subtask.parentTask.assignedToId === userId;
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Complete subtask
    const updatedSubtask = await prisma.task.update({
      where: { id: subtaskId },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await logger.info('Subtask completed', {
      operation: 'todo_complete_subtask',
      parentTaskId,
      subtaskId,
      userId,
    });

    res.json(updatedSubtask);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to complete subtask', {
      operation: 'todo_complete_subtask',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to complete subtask' });
  }
}

/**
 * POST /api/todo/tasks/:id/attachments
 * Upload a file attachment to a task
 */
export async function uploadTaskAttachment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    
    // Verify task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Check if file was uploaded
    const file = (req as any).file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Import storage service
    const { storageService } = await import('../services/storageService');
    
    // Generate unique file path
    const path = require('path');
    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `task-attachments/${taskId}/${userId}-${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
    
    // Upload file using storage service
    const uploadResult = await storageService.uploadFile(file, uniqueFilename, {
      makePublic: true,
      metadata: {
        userId,
        taskId,
        originalName: file.originalname,
      },
    });

    // Create attachment record
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        name: file.originalname,
        url: uploadResult.url,
        size: file.size,
        mimeType: file.mimetype,
      },
    });

    await logger.info('Task attachment uploaded', {
      operation: 'todo_upload_attachment',
      taskId,
      attachmentId: attachment.id,
      userId,
    });

    res.status(201).json(attachment);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to upload task attachment', {
      operation: 'todo_upload_attachment',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
}

/**
 * DELETE /api/todo/tasks/:id/attachments/:attachmentId
 * Delete a task attachment
 */
export async function deleteTaskAttachment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const taskId = req.params.id;
    const attachmentId = req.params.attachmentId;

    // Verify attachment exists and belongs to task
    const attachment = await prisma.taskAttachment.findFirst({
      where: {
        id: attachmentId,
        taskId: taskId,
      },
      include: {
        task: true,
      },
    });

    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    // Verify user has access to task
    const hasAccess = attachment.task.createdById === userId || 
                      attachment.task.assignedToId === userId;
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Delete file from storage if URL exists
    if (attachment.url) {
      try {
        const { storageService } = await import('../services/storageService');
        // Extract path from URL for deletion
        const urlObj = new URL(attachment.url);
        const pathToDelete = urlObj.pathname.startsWith('/') 
          ? urlObj.pathname.substring(1) 
          : urlObj.pathname;
        await storageService.deleteFile(pathToDelete);
      } catch (storageError) {
        await logger.error('Failed to delete file from storage', {
          operation: 'todo_delete_attachment_storage',
          attachmentId,
          error: { message: storageError instanceof Error ? storageError.message : 'Unknown error' },
        });
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete attachment record
    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });

    await logger.info('Task attachment deleted', {
      operation: 'todo_delete_attachment',
      taskId,
      attachmentId,
      userId,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to delete task attachment', {
      operation: 'todo_delete_attachment',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
}

/**
 * Helper function to check for circular dependencies
 * Returns true if adding a dependency would create a cycle
 */
async function wouldCreateCircularDependency(
  taskId: string,
  dependsOnTaskId: string
): Promise<boolean> {
  // If task A depends on task B, we need to check if task B (or any of its dependencies) depends on task A
  const visited = new Set<string>();
  const queue: string[] = [dependsOnTaskId];

  while (queue.length > 0) {
    const currentTaskId = queue.shift();
    if (!currentTaskId) break;

    // If we've already visited this task, skip
    if (visited.has(currentTaskId)) continue;
    visited.add(currentTaskId);

    // If the current task is the original task, we have a cycle
    if (currentTaskId === taskId) {
      return true;
    }

    // Get all tasks that the current task depends on
    const dependencies = await prisma.taskDependency.findMany({
      where: { taskId: currentTaskId },
      select: { dependsOnTaskId: true },
    });

    // Add all dependencies to the queue
    for (const dep of dependencies) {
      queue.push(dep.dependsOnTaskId);
    }
  }

  return false;
}

/**
 * POST /api/todo/tasks/:id/dependencies
 * Add a dependency to a task
 */
export async function addTaskDependency(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id: taskId } = req.params;
    const { dependsOnTaskId } = req.body;

    if (!dependsOnTaskId || typeof dependsOnTaskId !== 'string') {
      res.status(400).json({ error: 'dependsOnTaskId is required' });
      return;
    }

    // Validate that both tasks exist and user has access
    const [task, dependsOnTask] = await Promise.all([
      prisma.task.findFirst({
        where: {
          id: taskId,
          trashedAt: null,
          OR: [
            { createdById: userId },
            { assignedToId: userId },
          ],
        },
      }),
      prisma.task.findFirst({
        where: {
          id: dependsOnTaskId,
          trashedAt: null,
          OR: [
            { createdById: userId },
            { assignedToId: userId },
          ],
        },
      }),
    ]);

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (!dependsOnTask) {
      res.status(404).json({ error: 'Dependency task not found' });
      return;
    }

    // Prevent self-dependency
    if (taskId === dependsOnTaskId) {
      res.status(400).json({ error: 'Task cannot depend on itself' });
      return;
    }

    // Check for circular dependencies
    const wouldCreateCycle = await wouldCreateCircularDependency(taskId, dependsOnTaskId);
    if (wouldCreateCycle) {
      res.status(400).json({ error: 'This dependency would create a circular dependency' });
      return;
    }

    // Check if dependency already exists
    const existing = await prisma.taskDependency.findUnique({
      where: {
        taskId_dependsOnTaskId: {
          taskId,
          dependsOnTaskId,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Dependency already exists' });
      return;
    }

    // Create the dependency
    const dependency = await prisma.taskDependency.create({
      data: {
        taskId,
        dependsOnTaskId,
      },
      include: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    await logger.info('Task dependency added', {
      operation: 'todo_add_dependency',
      taskId,
      dependsOnTaskId,
      userId,
    });

    res.json(dependency);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to add task dependency', {
      operation: 'todo_add_dependency',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to add dependency' });
  }
}

/**
 * DELETE /api/todo/tasks/:id/dependencies/:dependsOnTaskId
 * Remove a dependency from a task
 */
export async function removeTaskDependency(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id: taskId, dependsOnTaskId } = req.params;

    // Validate that task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Delete the dependency (try both directions since we might be removing from either side)
    let deleted = await prisma.taskDependency.deleteMany({
      where: {
        taskId,
        dependsOnTaskId,
      },
    });

    // If not found, try the reverse direction (in case we're removing a "blocked by" dependency)
    if (deleted.count === 0) {
      deleted = await prisma.taskDependency.deleteMany({
        where: {
          taskId: dependsOnTaskId,
          dependsOnTaskId: taskId,
        },
      });
    }

    if (deleted.count === 0) {
      res.status(404).json({ error: 'Dependency not found' });
      return;
    }

    await logger.info('Task dependency removed', {
      operation: 'todo_remove_dependency',
      taskId,
      dependsOnTaskId,
      userId,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to remove task dependency', {
      operation: 'todo_remove_dependency',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to remove dependency' });
  }
}

/**
 * GET /api/todo/tasks/:id/dependencies
 * Get all dependencies for a task (both depends on and blocked by)
 */
export async function getTaskDependencies(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id: taskId } = req.params;

    // Validate that task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Get all dependencies (tasks this task depends on)
    const dependsOn = await prisma.taskDependency.findMany({
      where: { taskId },
      include: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
        },
      },
    });

    // Get all blocking tasks (tasks that depend on this task)
    const blockedBy = await prisma.taskDependency.findMany({
      where: { dependsOnTaskId: taskId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
        },
      },
    });

    res.json({
      dependsOn: dependsOn.map(dep => ({
        id: dep.id,
        task: dep.dependsOn,
      })),
      blockedBy: blockedBy.map(dep => ({
        id: dep.id,
        task: dep.task,
      })),
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get task dependencies', {
      operation: 'todo_get_dependencies',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to fetch dependencies' });
  }
}

/**
 * GET /api/todo/projects
 * List all projects for a dashboard/business
 */
export async function getProjects(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { dashboardId, businessId } = req.query;

    if (!dashboardId || typeof dashboardId !== 'string') {
      res.status(400).json({ error: 'dashboardId is required' });
      return;
    }

    const where: Prisma.TaskProjectWhereInput = {
      dashboardId,
      ...(businessId && typeof businessId === 'string' ? { businessId } : { businessId: null }),
    };

    const projects = await prisma.taskProject.findMany({
      where,
      include: {
        _count: {
          select: {
            tasks: {
              where: {
                trashedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(projects);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get projects', {
      operation: 'todo_get_projects',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

/**
 * POST /api/todo/projects
 * Create a new project
 */
export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { name, description, dashboardId, businessId, color } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    if (!dashboardId || typeof dashboardId !== 'string') {
      res.status(400).json({ error: 'dashboardId is required' });
      return;
    }

    const project = await prisma.taskProject.create({
      data: {
        name,
        description: description || null,
        dashboardId,
        businessId: businessId || null,
        color: color || null,
      },
    });

    await logger.info('Project created', {
      operation: 'todo_create_project',
      projectId: project.id,
      userId,
    });

    res.json(project);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to create project', {
      operation: 'todo_create_project',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to create project' });
  }
}

/**
 * PUT /api/todo/projects/:id
 * Update a project
 */
export async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { name, description, color } = req.body;

    const project = await prisma.taskProject.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const updated = await prisma.taskProject.update({
      where: { id },
      data: {
        ...(name && typeof name === 'string' ? { name } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(color !== undefined ? { color: color || null } : {}),
      },
    });

    await logger.info('Project updated', {
      operation: 'todo_update_project',
      projectId: id,
      userId,
    });

    res.json(updated);
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to update project', {
      operation: 'todo_update_project',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to update project' });
  }
}

/**
 * DELETE /api/todo/projects/:id
 * Delete a project
 */
export async function deleteProject(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const project = await prisma.taskProject.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // If project has tasks, unassign them (set projectId to null)
    if (project._count.tasks > 0) {
      await prisma.task.updateMany({
        where: { projectId: id },
        data: { projectId: null },
      });
    }

    await prisma.taskProject.delete({
      where: { id },
    });

    await logger.info('Project deleted', {
      operation: 'todo_delete_project',
      projectId: id,
      userId,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to delete project', {
      operation: 'todo_delete_project',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to delete project' });
  }
}

/**
 * POST /api/todo/tasks/:id/generate-instances
 * Generate recurring task instances for a parent task
 */
export async function generateRecurringInstances(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { maxInstances } = req.body;

    // Verify task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (!task.recurrenceRule) {
      res.status(400).json({ error: 'Task is not a recurring task' });
      return;
    }

    // Import recurrence service
    const { createRecurringInstances } = await import('../services/todoRecurrenceService');
    const count = await createRecurringInstances(id, maxInstances || 100);

    await logger.info('Recurring instances generated', {
      operation: 'todo_generate_instances',
      taskId: id,
      count,
      userId,
    });

    res.json({ success: true, count });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to generate recurring instances', {
      operation: 'todo_generate_instances',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to generate instances' });
  }
}

/**
 * GET /api/todo/tasks/:id/recurrence-description
 * Get human-readable description of recurrence rule
 */
export async function getRecurrenceDescription(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Verify task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
      select: {
        recurrenceRule: true,
        dueDate: true,
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (!task.recurrenceRule) {
      res.json({ description: 'No recurrence' });
      return;
    }

    // Import recurrence service
    const { describeRRULE } = await import('../services/todoRecurrenceService');
    const description = describeRRULE(task.recurrenceRule, task.dueDate ? new Date(task.dueDate) : undefined);

    res.json({ description });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get recurrence description', {
      operation: 'todo_get_recurrence_description',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to get recurrence description' });
  }
}

// ============================================================================
// TIME TRACKING ENDPOINTS
// ============================================================================

/**
 * Start a timer for a task
 * POST /api/todo/tasks/:id/timer/start
 */
export async function startTimer(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Check if task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Check if user already has an active timer (any task)
    const activeTimer = await prisma.taskTimeLog.findFirst({
      where: {
        userId,
        isActive: true,
      },
    });

    if (activeTimer) {
      res.status(400).json({ 
        error: 'You already have an active timer. Please stop it first.',
        activeTimerId: activeTimer.id,
        activeTaskId: activeTimer.taskId,
      });
      return;
    }

    // Create new time log entry
    const timeLog = await prisma.taskTimeLog.create({
      data: {
        taskId: id,
        userId,
        startedAt: new Date(),
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await logger.info('Timer started', {
      operation: 'todo_start_timer',
      taskId: id,
      userId,
      timeLogId: timeLog.id,
    });

    res.json({ timeLog });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to start timer', {
      operation: 'todo_start_timer',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to start timer' });
  }
}

/**
 * Stop the active timer for a task
 * POST /api/todo/tasks/:id/timer/stop
 */
export async function stopTimer(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { description } = req.body;

    // Find active timer for this task and user
    const activeTimer = await prisma.taskTimeLog.findFirst({
      where: {
        taskId: id,
        userId,
        isActive: true,
      },
    });

    if (!activeTimer) {
      res.status(404).json({ error: 'No active timer found for this task' });
      return;
    }

    const stoppedAt = new Date();
    const duration = Math.floor((stoppedAt.getTime() - activeTimer.startedAt.getTime()) / (1000 * 60)); // minutes

    // Update time log
    const timeLog = await prisma.taskTimeLog.update({
      where: { id: activeTimer.id },
      data: {
        stoppedAt,
        duration,
        description: description || null,
        isActive: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Update task's actualTimeSpent
    const task = await prisma.task.findUnique({
      where: { id },
      select: { actualTimeSpent: true },
    });

    const newActualTime = (task?.actualTimeSpent || 0) + duration;

    await prisma.task.update({
      where: { id },
      data: { actualTimeSpent: newActualTime },
    });

    await logger.info('Timer stopped', {
      operation: 'todo_stop_timer',
      taskId: id,
      userId,
      timeLogId: timeLog.id,
      duration,
    });

    res.json({ timeLog, totalTimeSpent: newActualTime });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to stop timer', {
      operation: 'todo_stop_timer',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to stop timer' });
  }
}

/**
 * Get active timer for current user
 * GET /api/todo/timer/active
 */
export async function getActiveTimer(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const activeTimer = await prisma.taskTimeLog.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    res.json({ timeLog: activeTimer });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get active timer', {
      operation: 'todo_get_active_timer',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to get active timer' });
  }
}

/**
 * Log manual time entry
 * POST /api/todo/tasks/:id/time-logs
 */
export async function logTime(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { startedAt, duration, description } = req.body;

    // Validate input
    if (!startedAt || !duration || duration <= 0) {
      res.status(400).json({ error: 'startedAt and duration (in minutes) are required' });
      return;
    }

    // Check if task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const startedAtDate = new Date(startedAt);
    const stoppedAtDate = new Date(startedAtDate.getTime() + duration * 60 * 1000);

    // Create time log
    const timeLog = await prisma.taskTimeLog.create({
      data: {
        taskId: id,
        userId,
        startedAt: startedAtDate,
        stoppedAt: stoppedAtDate,
        duration,
        description: description || null,
        isActive: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Update task's actualTimeSpent
    const newActualTime = (task.actualTimeSpent || 0) + duration;

    await prisma.task.update({
      where: { id },
      data: { actualTimeSpent: newActualTime },
    });

    await logger.info('Time logged', {
      operation: 'todo_log_time',
      taskId: id,
      userId,
      timeLogId: timeLog.id,
      duration,
    });

    res.json({ timeLog, totalTimeSpent: newActualTime });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to log time', {
      operation: 'todo_log_time',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to log time' });
  }
}

/**
 * Get time logs for a task
 * GET /api/todo/tasks/:id/time-logs
 */
export async function getTimeLogs(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Check if task exists and user has access
    const task = await prisma.task.findFirst({
      where: {
        id,
        trashedAt: null,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const timeLogs = await prisma.taskTimeLog.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Calculate totals
    const totalTime = timeLogs
      .filter(log => log.duration !== null)
      .reduce((sum, log) => sum + (log.duration || 0), 0);

    res.json({ 
      timeLogs, 
      totalTime,
      task: {
        timeEstimate: task.timeEstimate,
        actualTimeSpent: task.actualTimeSpent,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get time logs', {
      operation: 'todo_get_time_logs',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to get time logs' });
  }
}

/**
 * Update a time log
 * PUT /api/todo/tasks/:id/time-logs/:logId
 */
export async function updateTimeLog(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id, logId } = req.params;
    const { startedAt, duration, description } = req.body;

    // Check if time log exists and belongs to user
    const existingLog = await prisma.taskTimeLog.findFirst({
      where: {
        id: logId,
        taskId: id,
        userId,
        isActive: false, // Can only update completed logs
      },
    });

    if (!existingLog) {
      res.status(404).json({ error: 'Time log not found' });
      return;
    }

    const oldDuration = existingLog.duration || 0;
    const newDuration = duration || oldDuration;
    const startedAtDate = startedAt ? new Date(startedAt) : existingLog.startedAt;
    const stoppedAtDate = new Date(startedAtDate.getTime() + newDuration * 60 * 1000);

    // Update time log
    const timeLog = await prisma.taskTimeLog.update({
      where: { id: logId },
      data: {
        startedAt: startedAtDate,
        stoppedAt: stoppedAtDate,
        duration: newDuration,
        description: description !== undefined ? description : existingLog.description,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Update task's actualTimeSpent
    const task = await prisma.task.findUnique({
      where: { id },
      select: { actualTimeSpent: true },
    });

    const newActualTime = (task?.actualTimeSpent || 0) - oldDuration + newDuration;

    await prisma.task.update({
      where: { id },
      data: { actualTimeSpent: newActualTime },
    });

    await logger.info('Time log updated', {
      operation: 'todo_update_time_log',
      taskId: id,
      userId,
      timeLogId: logId,
    });

    res.json({ timeLog, totalTimeSpent: newActualTime });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to update time log', {
      operation: 'todo_update_time_log',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to update time log' });
  }
}

/**
 * Delete a time log
 * DELETE /api/todo/tasks/:id/time-logs/:logId
 */
export async function deleteTimeLog(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id, logId } = req.params;

    // Check if time log exists and belongs to user
    const existingLog = await prisma.taskTimeLog.findFirst({
      where: {
        id: logId,
        taskId: id,
        userId,
        isActive: false, // Can only delete completed logs
      },
    });

    if (!existingLog) {
      res.status(404).json({ error: 'Time log not found' });
      return;
    }

    const duration = existingLog.duration || 0;

    // Delete time log
    await prisma.taskTimeLog.delete({
      where: { id: logId },
    });

    // Update task's actualTimeSpent
    const task = await prisma.task.findUnique({
      where: { id },
      select: { actualTimeSpent: true },
    });

    const newActualTime = Math.max(0, (task?.actualTimeSpent || 0) - duration);

    await prisma.task.update({
      where: { id },
      data: { actualTimeSpent: newActualTime },
    });

    await logger.info('Time log deleted', {
      operation: 'todo_delete_time_log',
      taskId: id,
      userId,
      timeLogId: logId,
    });

    res.json({ success: true, totalTimeSpent: newActualTime });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to delete time log', {
      operation: 'todo_delete_time_log',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to delete time log' });
  }
}

// ============================================================================
// AI PRIORITIZATION ENDPOINTS
// ============================================================================

const prioritizationService = new TodoAIPrioritizationService(prisma);

// ============================================================================
// SMART SCHEDULING ENDPOINTS
// ============================================================================

const schedulingService = new TodoSmartSchedulingService(prisma);

// ============================================================================
// CHAT INTEGRATION ENDPOINTS
// ============================================================================

const chatIntegrationService = new TodoChatIntegrationService(prisma);

/**
 * GET /api/todo/ai/prioritize/suggestions
 * Returns priority suggestions for current tasks
 */
export async function getPrioritySuggestions(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { dashboardId, businessId } = req.query;

    if (!dashboardId || typeof dashboardId !== 'string') {
      res.status(400).json({ error: 'dashboardId is required' });
      return;
    }

    const businessIdString = businessId && typeof businessId === 'string' ? businessId : undefined;

    const suggestions = await prioritizationService.generatePrioritySuggestions(
      userId,
      dashboardId,
      businessIdString
    );

    await logger.info('Priority suggestions generated', {
      operation: 'todo_ai_prioritize_suggestions',
      userId,
      dashboardId,
      businessId: businessIdString,
      suggestionCount: suggestions.length,
    });

    res.json({
      success: true,
      suggestions,
      count: suggestions.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to generate priority suggestions', {
      operation: 'todo_ai_prioritize_suggestions',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to generate priority suggestions' });
  }
}

/**
 * POST /api/todo/ai/prioritize/analyze
 * Analyzes specific tasks and returns priority recommendations
 */
export async function analyzeTaskPriorities(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { dashboardId, businessId, taskIds } = req.body;

    if (!dashboardId || typeof dashboardId !== 'string') {
      res.status(400).json({ error: 'dashboardId is required' });
      return;
    }

    const analysis = await prioritizationService.analyzeTaskPriorities(
      userId,
      Array.isArray(taskIds) ? taskIds : [],
      dashboardId,
      businessId && typeof businessId === 'string' ? businessId : null
    );

    await logger.info('Task priorities analyzed', {
      operation: 'todo_ai_prioritize_analyze',
      userId,
      dashboardId,
      businessId: businessId || null,
      taskCount: analysis.suggestions.length,
    });

    res.json({
      success: true,
      analysis,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to analyze task priorities', {
      operation: 'todo_ai_prioritize_analyze',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to analyze task priorities' });
  }
}

/**
 * POST /api/todo/ai/prioritize/execute
 * Executes priority changes (with autonomy check)
 */
export async function executePriorityChanges(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { suggestions } = req.body;

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      res.status(400).json({ error: 'suggestions array is required' });
      return;
    }

    // Validate suggestions format
    for (const suggestion of suggestions) {
      if (!suggestion.taskId || !suggestion.newPriority) {
        res.status(400).json({ 
          error: 'Each suggestion must have taskId and newPriority' 
        });
        return;
      }
    }

    // TODO: Check autonomy settings via AutonomyManager
    // For now, execute directly (will add autonomy check in Phase 4.1.4)

    // Update priorities
    const updatePromises = suggestions.map(async (suggestion: {
      taskId: string;
      newPriority: string;
    }) => {
      // Verify task belongs to user
      const task = await prisma.task.findFirst({
        where: {
          id: suggestion.taskId,
          createdById: userId,
          trashedAt: null,
        },
      });

      if (!task) {
        throw new Error(`Task ${suggestion.taskId} not found or access denied`);
      }

      return prisma.task.update({
        where: { id: suggestion.taskId },
        data: { priority: suggestion.newPriority as any },
      });
    });

    const results = await Promise.allSettled(updatePromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    await logger.info('Priority changes executed', {
      operation: 'todo_ai_prioritize_execute',
      userId,
      total: suggestions.length,
      successful,
      failed,
    });

    res.json({
      success: true,
      updated: successful,
      failed,
      total: suggestions.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to execute priority changes', {
      operation: 'todo_ai_prioritize_execute',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to execute priority changes' });
  }
}

/**
 * POST /api/todo/ai/prioritize/feedback
 * Records user feedback on suggestions
 */
export async function submitPriorityFeedback(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { suggestionId, accepted, actualPriority, taskId, category } = req.body;

    if (!suggestionId || typeof accepted !== 'boolean') {
      res.status(400).json({ 
        error: 'suggestionId and accepted (boolean) are required' 
      });
      return;
    }

    // Record feedback for learning
    await prioritizationService.learnFromUserCorrections(userId, [{
      suggestionId,
      accepted,
      actualPriority,
      taskId,
      category,
    }]);

    await logger.info('Priority feedback submitted', {
      operation: 'todo_ai_prioritize_feedback',
      userId,
      suggestionId,
      accepted,
    });

    res.json({
      success: true,
      message: 'Feedback recorded',
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to submit priority feedback', {
      operation: 'todo_ai_prioritize_feedback',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
}

/**
 * GET /api/todo/ai/schedule/suggestions
 * Returns scheduling suggestions for current tasks
 */
export async function getSchedulingSuggestions(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { dashboardId, businessId } = req.query;

    if (!dashboardId || typeof dashboardId !== 'string') {
      res.status(400).json({ error: 'dashboardId is required' });
      return;
    }

    const businessIdString = businessId && typeof businessId === 'string' ? businessId : undefined;

    const suggestions = await schedulingService.generateSchedulingSuggestions(
      userId,
      dashboardId,
      businessIdString || null
    );

    await logger.info('Scheduling suggestions generated', {
      operation: 'todo_ai_schedule_suggestions',
      userId,
      dashboardId,
      businessId: businessIdString,
      suggestionCount: suggestions.length,
    });

    res.json({
      success: true,
      suggestions,
      count: suggestions.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to generate scheduling suggestions', {
      operation: 'todo_ai_schedule_suggestions',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to generate scheduling suggestions' });
  }
}

/**
 * POST /api/todo/ai/schedule/analyze
 * Analyzes specific tasks and returns scheduling recommendations
 */
export async function analyzeTaskScheduling(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { dashboardId, businessId, taskIds } = req.body;

    if (!dashboardId || typeof dashboardId !== 'string') {
      res.status(400).json({ error: 'dashboardId is required' });
      return;
    }

    const businessIdString = businessId && typeof businessId === 'string' ? businessId : undefined;

    const analysis = await schedulingService.analyzeTaskScheduling(
      userId,
      Array.isArray(taskIds) ? taskIds : [],
      dashboardId,
      businessIdString || null
    );

    await logger.info('Task scheduling analyzed', {
      operation: 'todo_ai_schedule_analyze',
      userId,
      dashboardId,
      businessId: businessIdString,
      taskCount: analysis.suggestions.length,
    });

    res.json({
      success: true,
      analysis,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to analyze task scheduling', {
      operation: 'todo_ai_schedule_analyze',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to analyze task scheduling' });
  }
}

/**
 * POST /api/todo/ai/schedule/execute
 * Executes scheduling changes (updates task due dates)
 */
export async function executeSchedulingChanges(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { suggestions } = req.body;

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      res.status(400).json({ error: 'suggestions array is required' });
      return;
    }

    // Validate suggestions format
    for (const suggestion of suggestions) {
      if (!suggestion.taskId || !suggestion.suggestedDueDate) {
        res.status(400).json({ 
          error: 'Each suggestion must have taskId and suggestedDueDate' 
        });
        return;
      }
    }

    // Update task due dates
    const updatePromises = suggestions.map(async (suggestion: {
      taskId: string;
      suggestedDueDate: string;
      suggestedStartDate?: string;
    }) => {
      // Verify task belongs to user
      const task = await prisma.task.findFirst({
        where: {
          id: suggestion.taskId,
          createdById: userId,
          trashedAt: null,
        },
      });

      if (!task) {
        throw new Error(`Task ${suggestion.taskId} not found or access denied`);
      }

      const updateData: any = {
        dueDate: new Date(suggestion.suggestedDueDate),
      };

      if (suggestion.suggestedStartDate) {
        updateData.startDate = new Date(suggestion.suggestedStartDate);
      }

      return prisma.task.update({
        where: { id: suggestion.taskId },
        data: updateData,
      });
    });

    const results = await Promise.allSettled(updatePromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    await logger.info('Scheduling changes executed', {
      operation: 'todo_ai_schedule_execute',
      userId,
      total: suggestions.length,
      successful,
      failed,
    });

    res.json({
      success: true,
      updated: successful,
      failed,
      total: suggestions.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to execute scheduling changes', {
      operation: 'todo_ai_schedule_execute',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to execute scheduling changes' });
  }
}

/**
 * POST /api/todo/chat/create-task
 * Create a task from a chat message
 */
export async function createTaskFromMessage(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      messageId,
      conversationId,
      dashboardId,
      businessId,
      householdId,
      title,
      description,
      priority,
      dueDate,
      assignedToId,
    } = req.body;

    if (!messageId || !conversationId || !dashboardId) {
      res.status(400).json({ error: 'messageId, conversationId, and dashboardId are required' });
      return;
    }

    const result = await chatIntegrationService.createTaskFromMessage({
      messageId,
      conversationId,
      userId,
      dashboardId,
      businessId: businessId || null,
      householdId: householdId || null,
      title,
      description,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assignedToId,
    });

    await logger.info('Task created from chat message', {
      operation: 'todo_chat_create_task',
      taskId: result.task.id,
      messageId,
      conversationId,
      userId,
    });

    res.status(201).json({
      success: true,
      task: result.task,
      messageLink: result.messageLink,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to create task from message', {
      operation: 'todo_chat_create_task',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to create task from message' });
  }
}

/**
 * POST /api/todo/chat/parse-message
 * Parse a chat message to extract task details
 */
export async function parseMessageForTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const parsed = chatIntegrationService.parseTaskDetails(content);

    res.json({
      success: true,
      parsed,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to parse message for task', {
      operation: 'todo_chat_parse_message',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to parse message' });
  }
}

/**
 * GET /api/todo/chat/conversation/:conversationId/tasks
 * Get tasks linked to a conversation
 */
export async function getTasksForConversation(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { conversationId } = req.params;

    if (!conversationId) {
      res.status(400).json({ error: 'conversationId is required' });
      return;
    }

    const tasks = await chatIntegrationService.getTasksForConversation(conversationId);

    res.json({
      success: true,
      tasks,
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Failed to get tasks for conversation', {
      operation: 'todo_chat_get_tasks',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to get tasks for conversation' });
  }
}

