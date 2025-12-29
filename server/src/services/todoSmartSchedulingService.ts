/**
 * To-Do Smart Scheduling Service
 * Analyzes calendar availability and suggests optimal due dates for tasks
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';

export interface SchedulingSuggestion {
  taskId: string;
  taskTitle: string;
  currentDueDate: Date | null;
  suggestedDueDate: Date;
  suggestedStartDate?: Date;
  confidence: number; // 0-1
  reasoning: string;
  factors: Array<{
    type: 'availability' | 'dependency' | 'priority' | 'time_estimate' | 'workload';
    impact: number;
    description: string;
  }>;
  conflicts?: Array<{
    eventId: string;
    eventTitle: string;
    startAt: Date;
    endAt: Date;
  }>;
}

export interface SchedulingAnalysis {
  suggestions: SchedulingSuggestion[];
  summary: {
    totalTasks: number;
    needsScheduling: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    conflicts: number;
  };
}

export class TodoSmartSchedulingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate scheduling suggestions for tasks
   */
  async generateSchedulingSuggestions(
    userId: string,
    dashboardId: string,
    businessId: string | null = null,
    taskIds?: string[]
  ): Promise<SchedulingSuggestion[]> {
    try {
      // Get tasks that need scheduling
      const where: Record<string, unknown> = {
        createdById: userId,
        dashboardId,
        trashedAt: null,
        status: { not: 'DONE' },
      };

      if (businessId) {
        where.businessId = businessId;
      } else {
        where.businessId = null;
      }

      if (taskIds && taskIds.length > 0) {
        where.id = { in: taskIds };
      }

      const tasks = await this.prisma.task.findMany({
        where,
        include: {
          dependsOnTasks: {
            include: {
              dependsOn: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  dueDate: true,
                  completedAt: true,
                },
              },
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
        ],
        take: 50, // Limit to recent tasks
      });

      // Get user's calendars for availability checking
      // First, get calendar memberships for the user
      const calendarMemberships = await this.prisma.calendarMember.findMany({
        where: {
          userId,
          role: { in: ['OWNER', 'ADMIN', 'EDITOR', 'READER'] },
          calendar: {
            contextType: businessId ? 'BUSINESS' : 'PERSONAL',
            contextId: businessId || userId,
          },
        },
        select: { calendarId: true },
      });

      const calendarIds = calendarMemberships.map(m => m.calendarId);

      if (calendarIds.length === 0) {
        // No calendars available - return basic suggestions without availability checks
        return this.generateBasicSuggestions(tasks);
      }

      // Get upcoming events for availability analysis
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // Look 30 days ahead

      const events = await this.prisma.event.findMany({
        where: {
          calendarId: { in: calendarIds },
          startAt: {
            gte: now,
            lte: futureDate,
          },
          status: { not: 'CANCELED' },
        },
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          allDay: true,
        },
        orderBy: { startAt: 'asc' },
      });

      // Generate suggestions for each task
      const suggestions: SchedulingSuggestion[] = [];

      for (const task of tasks) {
        const suggestion = await this.analyzeTaskScheduling(
          task,
          events,
          tasks,
          userId
        );
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }

      return suggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error: unknown) {
      const err = error as Error;
      await logger.error('Failed to generate scheduling suggestions', {
        operation: 'todo_smart_scheduling_generate',
        error: { message: err.message, stack: err.stack },
      });
      throw err;
    }
  }

  /**
   * Analyze scheduling for a single task
   */
  private async analyzeTaskScheduling(
    task: any,
    events: Array<{ id: string; title: string; startAt: Date; endAt: Date; allDay: boolean }>,
    allTasks: any[],
    userId: string
  ): Promise<SchedulingSuggestion | null> {
    const factors: SchedulingSuggestion['factors'] = [];
    let confidence = 0.5; // Base confidence
    let suggestedDate = new Date();
    suggestedDate.setDate(suggestedDate.getDate() + 7); // Default: 7 days from now
    let suggestedStartDate: Date | undefined;

    // Factor 1: Priority (urgent tasks get earlier dates)
    if (task.priority === 'URGENT') {
      suggestedDate = new Date();
      suggestedDate.setDate(suggestedDate.getDate() + 1); // Tomorrow for urgent
      factors.push({
        type: 'priority',
        impact: 0.3,
        description: 'Urgent priority requires immediate attention',
      });
      confidence += 0.2;
    } else if (task.priority === 'HIGH') {
      suggestedDate = new Date();
      suggestedDate.setDate(suggestedDate.getDate() + 3); // 3 days for high
      factors.push({
        type: 'priority',
        impact: 0.2,
        description: 'High priority task',
      });
      confidence += 0.1;
    } else if (task.priority === 'MEDIUM') {
      suggestedDate = new Date();
      suggestedDate.setDate(suggestedDate.getDate() + 7); // 7 days for medium
      factors.push({
        type: 'priority',
        impact: 0.1,
        description: 'Medium priority task',
      });
    } else {
      suggestedDate = new Date();
      suggestedDate.setDate(suggestedDate.getDate() + 14); // 14 days for low
      factors.push({
        type: 'priority',
        impact: 0.05,
        description: 'Low priority task',
      });
    }

    // Factor 2: Dependencies (can't schedule before dependencies are done)
    if (task.dependsOnTasks && task.dependsOnTasks.length > 0) {
      const latestDependency = task.dependsOnTasks.reduce((latest: any, dep: any) => {
        const depTask = dep.dependsOn;
        if (!depTask) return latest;
        
        if (depTask.status === 'DONE' && depTask.completedAt) {
          const completedDate = new Date(depTask.completedAt);
          return !latest || completedDate > latest ? completedDate : latest;
        }
        
        if (depTask.dueDate) {
          const dueDate = new Date(depTask.dueDate);
          return !latest || dueDate > latest ? dueDate : latest;
        }
        
        return latest;
      }, null);

      if (latestDependency) {
        suggestedDate = new Date(latestDependency);
        suggestedDate.setDate(suggestedDate.getDate() + 1); // At least 1 day after dependency
        factors.push({
          type: 'dependency',
          impact: 0.3,
          description: `Depends on ${task.dependsOnTasks.length} task(s)`,
        });
        confidence += 0.15;
      }
    }

    // Factor 3: Time estimate (schedule tasks with estimates)
    if (task.timeEstimate) {
      const estimateMinutes = task.timeEstimate;
      const estimateHours = estimateMinutes / 60;
      
      // Find available time slot
      const availableSlot = this.findAvailableTimeSlot(
        suggestedDate,
        estimateMinutes,
        events
      );

      if (availableSlot) {
        suggestedDate = availableSlot.start;
        suggestedStartDate = availableSlot.start;
        factors.push({
          type: 'time_estimate',
          impact: 0.2,
          description: `Requires ${estimateHours.toFixed(1)} hours`,
        });
        confidence += 0.1;
      } else {
        factors.push({
          type: 'time_estimate',
          impact: 0.1,
          description: `Requires ${estimateHours.toFixed(1)} hours (no ideal slot found)`,
        });
      }
    }

    // Factor 4: Current due date (if exists, consider it)
    if (task.dueDate) {
      const currentDue = new Date(task.dueDate);
      const daysUntilDue = Math.ceil((currentDue.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue > 0 && daysUntilDue < 30) {
        // If current due date is reasonable, use it
        if (daysUntilDue <= 7 || task.priority === 'URGENT') {
          suggestedDate = currentDue;
          factors.push({
            type: 'availability',
            impact: 0.15,
            description: 'Current due date is appropriate',
          });
          confidence += 0.1;
        }
      }
    }

    // Factor 5: Workload (avoid scheduling too many tasks on same day)
    const sameDayTasks = allTasks.filter(t => {
      if (!t.dueDate || t.id === task.id) return false;
      const taskDue = new Date(t.dueDate);
      const suggested = new Date(suggestedDate);
      return taskDue.toDateString() === suggested.toDateString();
    });

    if (sameDayTasks.length > 3) {
      // Too many tasks on this day, suggest next available day
      suggestedDate.setDate(suggestedDate.getDate() + 1);
      factors.push({
        type: 'workload',
        impact: 0.1,
        description: `Avoiding overload (${sameDayTasks.length} tasks already scheduled)`,
      });
    }

    // Check for conflicts
    const conflicts = this.checkConflicts(suggestedDate, task.timeEstimate || 60, events);

    // Build reasoning
    const reasoning = this.buildReasoning(factors, conflicts, task);

    // Adjust confidence based on conflicts
    if (conflicts.length > 0) {
      confidence -= 0.2;
    }

    // Ensure confidence is between 0 and 1
    confidence = Math.max(0, Math.min(1, confidence));

    return {
      taskId: task.id,
      taskTitle: task.title,
      currentDueDate: task.dueDate ? new Date(task.dueDate) : null,
      suggestedDueDate: suggestedDate,
      suggestedStartDate,
      confidence,
      reasoning,
      factors,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  /**
   * Find available time slot for a task
   */
  private findAvailableTimeSlot(
    startDate: Date,
    durationMinutes: number,
    events: Array<{ startAt: Date; endAt: Date; allDay: boolean }>
  ): { start: Date; end: Date } | null {
    // Start from the suggested date
    let currentDate = new Date(startDate);
    currentDate.setHours(9, 0, 0, 0); // Start at 9 AM

    // Look for available slot in next 7 days
    for (let day = 0; day < 7; day++) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() + day);

      // Try different times of day (9 AM, 1 PM, 3 PM)
      const timeSlots = [9, 13, 15];
      
      for (const hour of timeSlots) {
        const slotStart = new Date(checkDate);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

        // Check if this slot conflicts with any events
        const hasConflict = events.some(event => {
          if (event.allDay) {
            const eventDate = new Date(event.startAt);
            return eventDate.toDateString() === slotStart.toDateString();
          }
          
          return (
            (slotStart >= event.startAt && slotStart < event.endAt) ||
            (slotEnd > event.startAt && slotEnd <= event.endAt) ||
            (slotStart <= event.startAt && slotEnd >= event.endAt)
          );
        });

        if (!hasConflict) {
          return { start: slotStart, end: slotEnd };
        }
      }
    }

    return null; // No available slot found
  }

  /**
   * Check for conflicts with calendar events
   */
  private checkConflicts(
    date: Date,
    durationMinutes: number,
    events: Array<{ id: string; title: string; startAt: Date; endAt: Date; allDay: boolean }>
  ): Array<{ eventId: string; eventTitle: string; startAt: Date; endAt: Date }> {
    const taskStart = new Date(date);
    taskStart.setHours(9, 0, 0, 0);
    
    const taskEnd = new Date(taskStart);
    taskEnd.setMinutes(taskEnd.getMinutes() + durationMinutes);

    const conflicts: Array<{ eventId: string; eventTitle: string; startAt: Date; endAt: Date }> = [];

    for (const event of events) {
      if (event.allDay) {
        const eventDate = new Date(event.startAt);
        if (eventDate.toDateString() === taskStart.toDateString()) {
          conflicts.push({
            eventId: event.id,
            eventTitle: event.title,
            startAt: event.startAt,
            endAt: event.endAt,
          });
        }
      } else {
        if (
          (taskStart >= event.startAt && taskStart < event.endAt) ||
          (taskEnd > event.startAt && taskEnd <= event.endAt) ||
          (taskStart <= event.startAt && taskEnd >= event.endAt)
        ) {
          conflicts.push({
            eventId: event.id,
            eventTitle: event.title,
            startAt: event.startAt,
            endAt: event.endAt,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Build human-readable reasoning for suggestion
   */
  private buildReasoning(
    factors: SchedulingSuggestion['factors'],
    conflicts: Array<{ eventId: string; eventTitle: string; startAt: Date; endAt: Date }>,
    task: any
  ): string {
    const parts: string[] = [];

    if (factors.some(f => f.type === 'priority')) {
      const priorityFactor = factors.find(f => f.type === 'priority');
      parts.push(priorityFactor?.description || '');
    }

    if (factors.some(f => f.type === 'dependency')) {
      const depFactor = factors.find(f => f.type === 'dependency');
      parts.push(depFactor?.description || '');
    }

    if (factors.some(f => f.type === 'time_estimate')) {
      const timeFactor = factors.find(f => f.type === 'time_estimate');
      parts.push(timeFactor?.description || '');
    }

    if (conflicts.length > 0) {
      parts.push(`Warning: ${conflicts.length} potential conflict(s) with calendar events`);
    }

    if (parts.length === 0) {
      return 'Suggested based on general scheduling best practices';
    }

    return parts.join('. ');
  }

  /**
   * Generate basic suggestions without calendar availability (fallback)
   */
  private generateBasicSuggestions(tasks: any[]): SchedulingSuggestion[] {
    return tasks.map(task => {
      let suggestedDate = new Date();
      
      if (task.priority === 'URGENT') {
        suggestedDate.setDate(suggestedDate.getDate() + 1);
      } else if (task.priority === 'HIGH') {
        suggestedDate.setDate(suggestedDate.getDate() + 3);
      } else if (task.priority === 'MEDIUM') {
        suggestedDate.setDate(suggestedDate.getDate() + 7);
      } else {
        suggestedDate.setDate(suggestedDate.getDate() + 14);
      }

      return {
        taskId: task.id,
        taskTitle: task.title,
        currentDueDate: task.dueDate ? new Date(task.dueDate) : null,
        suggestedDueDate: suggestedDate,
        confidence: 0.5,
        reasoning: `Suggested based on priority (${task.priority})`,
        factors: [{
          type: 'priority',
          impact: 0.3,
          description: `${task.priority} priority task`,
        }],
      };
    });
  }

  /**
   * Analyze multiple tasks and return comprehensive analysis
   */
  async analyzeTaskScheduling(
    userId: string,
    taskIds: string[],
    dashboardId: string,
    businessId: string | null = null
  ): Promise<SchedulingAnalysis> {
    const suggestions = await this.generateSchedulingSuggestions(
      userId,
      dashboardId,
      businessId,
      taskIds
    );

    const highConfidence = suggestions.filter(s => s.confidence >= 0.7).length;
    const mediumConfidence = suggestions.filter(s => s.confidence >= 0.4 && s.confidence < 0.7).length;
    const lowConfidence = suggestions.filter(s => s.confidence < 0.4).length;
    const conflicts = suggestions.filter(s => s.conflicts && s.conflicts.length > 0).length;

    return {
      suggestions,
      summary: {
        totalTasks: taskIds?.length || 0,
        needsScheduling: suggestions.length,
        highConfidence,
        mediumConfidence,
        lowConfidence,
        conflicts,
      },
    };
  }
}

