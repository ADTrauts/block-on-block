/**
 * To-Do Module AI Context Controller
 * Provides context data about tasks to the AI system
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

/**
 * GET /api/todo/ai/context/overview
 * Returns task overview for AI context
 */
export async function getOverviewContext(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const { businessId, dashboardId } = req.query;

    const where: Record<string, unknown> = {
      createdById: userId,
      trashedAt: null,
    };

    if (dashboardId && typeof dashboardId === 'string') {
      where.dashboardId = dashboardId;
    }

    if (businessId && typeof businessId === 'string') {
      where.businessId = businessId;
    } else {
      where.businessId = null;
    }

    // Get task counts by status
    const [total, todo, inProgress, blocked, review, done] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.count({ where: { ...where, status: 'TODO' } }),
      prisma.task.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...where, status: 'BLOCKED' } }),
      prisma.task.count({ where: { ...where, status: 'REVIEW' } }),
      prisma.task.count({ where: { ...where, status: 'DONE' } }),
    ]);

    // Get task counts by priority
    const [urgent, high, medium, low] = await Promise.all([
      prisma.task.count({ where: { ...where, priority: 'URGENT', status: { not: 'DONE' } } }),
      prisma.task.count({ where: { ...where, priority: 'HIGH', status: { not: 'DONE' } } }),
      prisma.task.count({ where: { ...where, priority: 'MEDIUM', status: { not: 'DONE' } } }),
      prisma.task.count({ where: { ...where, priority: 'LOW', status: { not: 'DONE' } } }),
    ]);

    // Get overdue count
    const overdue = await prisma.task.count({
      where: {
        ...where,
        dueDate: { lt: new Date() },
        status: { not: 'DONE' },
      },
    });

    const context = {
      summary: {
        totalTasks: total,
        activeTasks: total - done,
        completedTasks: done,
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
      },
      byStatus: {
        todo,
        inProgress,
        blocked,
        review,
        done,
      },
      byPriority: {
        urgent,
        high,
        medium,
        low,
      },
      overdue,
      requiresAction: overdue > 0 || blocked > 0,
    };

    res.json({
      success: true,
      context,
      metadata: {
        provider: 'todo',
        endpoint: 'overview',
        businessId: businessId || null,
        dashboardId: dashboardId || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Error in getOverviewContext', {
      operation: 'todo_ai_context_overview',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch context',
      error: err.message,
    });
  }
}

/**
 * GET /api/todo/ai/context/upcoming
 * Returns upcoming tasks for AI context
 */
export async function getUpcomingContext(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const { businessId, dashboardId } = req.query;

    const where: Record<string, unknown> = {
      createdById: userId,
      trashedAt: null,
      status: { not: 'DONE' },
      dueDate: { gte: new Date() },
    };

    if (dashboardId && typeof dashboardId === 'string') {
      where.dashboardId = dashboardId;
    }

    if (businessId && typeof businessId === 'string') {
      where.businessId = businessId;
    } else {
      where.businessId = null;
    }

    // Get tasks due in next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    where.dueDate = {
      gte: new Date(),
      lte: sevenDaysFromNow,
    };

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        category: true,
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    const context = {
      summary: {
        upcomingCount: tasks.length,
        nextDueDate: tasks[0]?.dueDate?.toISOString() || null,
      },
      details: {
        tasks: tasks.map(task => ({
          id: task.id,
          title: task.title,
          dueDate: task.dueDate?.toISOString(),
          priority: task.priority,
          status: task.status,
          category: task.category,
        })),
      },
    };

    res.json({
      success: true,
      context,
      metadata: {
        provider: 'todo',
        endpoint: 'upcoming',
        businessId: businessId || null,
        dashboardId: dashboardId || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Error in getUpcomingContext', {
      operation: 'todo_ai_context_upcoming',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch context',
      error: err.message,
    });
  }
}

/**
 * GET /api/todo/ai/context/overdue
 * Returns overdue tasks for AI context
 */
export async function getOverdueContext(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const { businessId, dashboardId } = req.query;

    const where: Record<string, unknown> = {
      createdById: userId,
      trashedAt: null,
      status: { not: 'DONE' },
      dueDate: { lt: new Date() },
    };

    if (dashboardId && typeof dashboardId === 'string') {
      where.dashboardId = dashboardId;
    }

    if (businessId && typeof businessId === 'string') {
      where.businessId = businessId;
    } else {
      where.businessId = null;
    }

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        category: true,
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    const context = {
      summary: {
        overdueCount: tasks.length,
        oldestOverdue: tasks[0]?.dueDate?.toISOString() || null,
      },
      details: {
        tasks: tasks.map(task => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - (task.dueDate?.getTime() || 0)) / (1000 * 60 * 60 * 24)
          );
          return {
            id: task.id,
            title: task.title,
            dueDate: task.dueDate?.toISOString(),
            daysOverdue,
            priority: task.priority,
            status: task.status,
            category: task.category,
          };
        }),
      },
    };

    res.json({
      success: true,
      context,
      metadata: {
        provider: 'todo',
        endpoint: 'overdue',
        businessId: businessId || null,
        dashboardId: dashboardId || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Error in getOverdueContext', {
      operation: 'todo_ai_context_overdue',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch context',
      error: err.message,
    });
  }
}

/**
 * GET /api/todo/ai/context/priority
 * Returns high priority tasks for AI context
 */
export async function getPriorityContext(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const { businessId, dashboardId } = req.query;

    const where: Record<string, unknown> = {
      createdById: userId,
      trashedAt: null,
      status: { not: 'DONE' },
      priority: { in: ['URGENT', 'HIGH'] },
    };

    if (dashboardId && typeof dashboardId === 'string') {
      where.dashboardId = dashboardId;
    }

    if (businessId && typeof businessId === 'string') {
      where.businessId = businessId;
    } else {
      where.businessId = null;
    }

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        category: true,
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
      take: 20,
    });

    const context = {
      summary: {
        highPriorityCount: tasks.length,
        urgentCount: tasks.filter(t => t.priority === 'URGENT').length,
        highCount: tasks.filter(t => t.priority === 'HIGH').length,
      },
      details: {
        tasks: tasks.map(task => ({
          id: task.id,
          title: task.title,
          dueDate: task.dueDate?.toISOString(),
          priority: task.priority,
          status: task.status,
          category: task.category,
        })),
      },
    };

    res.json({
      success: true,
      context,
      metadata: {
        provider: 'todo',
        endpoint: 'priority',
        businessId: businessId || null,
        dashboardId: dashboardId || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Error in getPriorityContext', {
      operation: 'todo_ai_context_priority',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch context',
      error: err.message,
    });
  }
}

/**
 * GET /api/todo/ai/context/priority-analysis
 * Returns task data formatted for AI prioritization analysis
 */
export async function getPriorityAnalysisContext(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const { businessId, dashboardId } = req.query;

    if (!dashboardId || typeof dashboardId !== 'string') {
      res.status(400).json({ 
        success: false, 
        message: 'dashboardId is required' 
      });
      return;
    }

    const where: Record<string, unknown> = {
      createdById: userId,
      dashboardId,
      trashedAt: null,
      status: { not: 'DONE' },
    };

    if (businessId && typeof businessId === 'string') {
      where.businessId = businessId;
    } else {
      where.businessId = null;
    }

    // Get tasks with all relevant data for prioritization
    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        dependsOnTasks: {
          include: {
            dependsOn: {
              select: {
                id: true,
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
                status: true,
              },
            },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
      take: 50, // Limit to 50 tasks for analysis
    });

    // Format tasks for AI consumption
    const formattedTasks = tasks.map(task => {
      const blocked = task.dependsOnTasks.some(
        dep => dep.dependsOn.status !== 'DONE'
      );
      const blockingCount = task.blockingTasks.length;

      return {
        id: task.id,
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString() || null,
        status: task.status,
        category: task.category,
        timeEstimate: task.timeEstimate,
        actualTimeSpent: task.actualTimeSpent,
        project: task.project ? {
          id: task.project.id,
          name: task.project.name,
        } : null,
        dependencies: {
          blocked,
          blocking: blockingCount,
          dependsOn: task.dependsOnTasks.length,
        },
        createdAt: task.createdAt.toISOString(),
      };
    });

    // Calculate summary
    const blockedCount = formattedTasks.filter(t => t.dependencies.blocked).length;
    const overdueCount = formattedTasks.filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    }).length;

    const context = {
      summary: {
        totalTasks: tasks.length,
        needsPrioritization: formattedTasks.filter(
          t => t.priority === 'MEDIUM' || !t.priority
        ).length,
        overdueCount,
        blockedCount,
      },
      details: {
        tasks: formattedTasks,
      },
    };

    res.json({
      success: true,
      context,
      metadata: {
        provider: 'todo',
        endpoint: 'priority-analysis',
        businessId: businessId || null,
        dashboardId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    await logger.error('Error in getPriorityAnalysisContext', {
      operation: 'todo_ai_context_priority_analysis',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch context',
      error: err.message,
    });
  }
}

