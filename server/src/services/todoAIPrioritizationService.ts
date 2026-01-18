/**
 * To-Do AI Prioritization Service
 * Analyzes tasks and generates intelligent priority suggestions
 * Following our Service Architecture Standards
 */

import { PrismaClient, TaskPriority, TaskStatus } from '@prisma/client';
import { logger } from '../lib/logger';

export interface PrioritySuggestion {
  taskId: string;
  taskTitle: string;
  currentPriority: TaskPriority;
  suggestedPriority: TaskPriority;
  confidence: number; // 0-1
  reasoning: string;
  factors: PriorityFactor[];
}

export interface PriorityFactor {
  type: 'due_date' | 'dependency' | 'time_pressure' | 'project' | 'category' | 'historical';
  impact: number; // -1 to 1 (negative = lower priority, positive = higher priority)
  description: string;
}

export interface PriorityAnalysis {
  suggestions: PrioritySuggestion[];
  summary: {
    totalTasks: number;
    needsPrioritization: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
}

export interface TaskContext {
  task: {
    id: string;
    title: string;
    priority: TaskPriority;
    dueDate: Date | null;
    status: TaskStatus;
    category: string | null;
    timeEstimate: number | null;
    actualTimeSpent: number | null;
    projectId: string | null;
    project?: {
      id: string;
      name: string;
    } | null;
    createdAt: Date;
  };
  dependencies: {
    blocked: boolean;
    blockingCount: number;
    dependsOnCount: number;
  };
  historicalPattern?: {
    userPriorityPreference: number; // -1 to 1
    categoryWeight: number; // 0 to 1
  };
}

export class TodoAIPrioritizationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate priority suggestions for tasks
   */
  async generatePrioritySuggestions(
    userId: string,
    dashboardId: string,
    businessId?: string | null
  ): Promise<PrioritySuggestion[]> {
    try {
      // Get all active tasks
      const tasks = await this.getTasksForAnalysis(userId, dashboardId, businessId);

      // Analyze each task
      const suggestions: PrioritySuggestion[] = [];

      for (const task of tasks) {
        const context = await this.buildTaskContext(task);
        const suggestion = await this.analyzeTaskPriority(context);

        // Only include suggestions that differ from current priority
        if (suggestion.suggestedPriority !== task.priority) {
          suggestions.push(suggestion);
        }
      }

      // Sort by confidence (highest first)
      suggestions.sort((a, b) => b.confidence - a.confidence);

      await logger.info('Generated priority suggestions', {
        operation: 'todo_ai_prioritization',
        userId,
        dashboardId,
        businessId: businessId ?? undefined,
        suggestionCount: suggestions.length,
      });

      return suggestions;
    } catch (error: unknown) {
      const err = error as Error;
      await logger.error('Error generating priority suggestions', {
        operation: 'todo_ai_prioritization',
        error: { message: err.message, stack: err.stack },
        userId,
        dashboardId,
        businessId: businessId ?? undefined,
      });
      throw error;
    }
  }

  /**
   * Analyze specific tasks and return priority recommendations
   */
  async analyzeTaskPriorities(
    userId: string,
    taskIds: string[],
    dashboardId: string,
    businessId?: string | null
  ): Promise<PriorityAnalysis> {
    try {
      const tasks = await this.getTasksForAnalysis(userId, dashboardId, businessId, taskIds);
      const suggestions: PrioritySuggestion[] = [];

      for (const task of tasks) {
        const context = await this.buildTaskContext(task);
        const suggestion = await this.analyzeTaskPriority(context);
        suggestions.push(suggestion);
      }

      // Calculate summary
      const summary = {
        totalTasks: tasks.length,
        needsPrioritization: suggestions.filter(s => s.suggestedPriority !== s.currentPriority).length,
        highConfidence: suggestions.filter(s => s.confidence >= 0.7).length,
        mediumConfidence: suggestions.filter(s => s.confidence >= 0.4 && s.confidence < 0.7).length,
        lowConfidence: suggestions.filter(s => s.confidence < 0.4).length,
      };

      return { suggestions, summary };
    } catch (error: unknown) {
      const err = error as Error;
      await logger.error('Error analyzing task priorities', {
        operation: 'todo_ai_prioritization_analyze',
        error: { message: err.message, stack: err.stack },
        userId,
        taskIds,
      });
      throw error;
    }
  }

  /**
   * Calculate priority score for a task
   */
  async calculatePriorityScore(context: TaskContext): Promise<number> {
    const factors: PriorityFactor[] = [];
    let score = 0.5; // Start at neutral (MEDIUM priority)

    // 1. Due Date Urgency (30% weight)
    const dueDateScore = this.calculateDueDateUrgency(context.task.dueDate);
    score += dueDateScore * 0.30;
    factors.push({
      type: 'due_date',
      impact: dueDateScore,
      description: this.getDueDateDescription(context.task.dueDate, dueDateScore),
    });

    // 2. Dependency Status (20% weight)
    const dependencyScore = this.calculateDependencyScore(context.dependencies);
    score += dependencyScore * 0.20;
    factors.push({
      type: 'dependency',
      impact: dependencyScore,
      description: this.getDependencyDescription(context.dependencies, dependencyScore),
    });

    // 3. Time Pressure (20% weight)
    const timePressureScore = this.calculateTimePressure(
      context.task.timeEstimate,
      context.task.actualTimeSpent,
      context.task.dueDate
    );
    score += timePressureScore * 0.20;
    factors.push({
      type: 'time_pressure',
      impact: timePressureScore,
      description: this.getTimePressureDescription(context.task, timePressureScore),
    });

    // 4. Project Importance (15% weight)
    if (context.task.projectId && context.task.project) {
      const projectScore = 0.1; // Default project boost
      score += projectScore * 0.15;
      factors.push({
        type: 'project',
        impact: projectScore,
        description: `Part of project: ${context.task.project.name}`,
      });
    }

    // 5. Category Weight (10% weight)
    if (context.historicalPattern?.categoryWeight) {
      const categoryScore = (context.historicalPattern.categoryWeight - 0.5) * 2; // Normalize to -1 to 1
      score += categoryScore * 0.10;
      factors.push({
        type: 'category',
        impact: categoryScore,
        description: `Category: ${context.task.category || 'Uncategorized'}`,
      });
    }

    // 6. Historical Pattern (5% weight)
    if (context.historicalPattern?.userPriorityPreference) {
      score += context.historicalPattern.userPriorityPreference * 0.05;
      factors.push({
        type: 'historical',
        impact: context.historicalPattern.userPriorityPreference,
        description: 'Based on your past priority choices',
      });
    }

    // Clamp score to 0-1 range
    score = Math.max(0, Math.min(1, score));

    return score;
  }

  /**
   * Analyze a single task and generate priority suggestion
   */
  private async analyzeTaskPriority(context: TaskContext): Promise<PrioritySuggestion> {
    const score = await this.calculatePriorityScore(context);
    const factors: PriorityFactor[] = [];

    // Map score to priority
    let suggestedPriority: TaskPriority;
    if (score >= 0.8) {
      suggestedPriority = 'URGENT';
    } else if (score >= 0.6) {
      suggestedPriority = 'HIGH';
    } else if (score >= 0.4) {
      suggestedPriority = 'MEDIUM';
    } else {
      suggestedPriority = 'LOW';
    }

    // Calculate confidence based on score distance from thresholds
    const confidence = this.calculateConfidence(score, suggestedPriority);

    // Generate reasoning
    const reasoning = this.generateReasoning(context, suggestedPriority, score);

    return {
      taskId: context.task.id,
      taskTitle: context.task.title,
      currentPriority: context.task.priority,
      suggestedPriority,
      confidence,
      reasoning,
      factors: [], // Will be populated by calculatePriorityScore
    };
  }

  /**
   * Get tasks for analysis
   */
  private async getTasksForAnalysis(
    userId: string,
    dashboardId: string,
    businessId?: string | null,
    taskIds?: string[]
  ) {
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

    return await this.prisma.task.findMany({
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
    });
  }

  /**
   * Build task context for analysis
   */
  private async buildTaskContext(task: any): Promise<TaskContext> {
    // Check if task is blocked
    const blocked = task.dependsOnTasks.some(
      (dep: any) => dep.dependsOn.status !== 'DONE'
    );

    // Count blocking tasks
    const blockingCount = task.blockingTasks.length;

    // Count dependencies
    const dependsOnCount = task.dependsOnTasks.length;

    // Get historical patterns (simplified - would be enhanced with actual learning data)
    const historicalPattern = await this.getHistoricalPattern(task.createdById, task.category);

    return {
      task: {
        id: task.id,
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
        status: task.status,
        category: task.category,
        timeEstimate: task.timeEstimate,
        actualTimeSpent: task.actualTimeSpent,
        projectId: task.projectId,
        project: task.project,
        createdAt: task.createdAt,
      },
      dependencies: {
        blocked,
        blockingCount,
        dependsOnCount,
      },
      historicalPattern,
    };
  }

  /**
   * Calculate due date urgency score (-1 to 1)
   */
  private calculateDueDateUrgency(dueDate: Date | null): number {
    if (!dueDate) return 0; // No due date = neutral

    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      // Overdue - high urgency
      return 1.0;
    } else if (diffDays === 0) {
      // Due today
      return 0.9;
    } else if (diffDays === 1) {
      // Due tomorrow
      return 0.8;
    } else if (diffDays <= 3) {
      // Due in 2-3 days
      return 0.6;
    } else if (diffDays <= 7) {
      // Due in 4-7 days
      return 0.4;
    } else if (diffDays <= 14) {
      // Due in 8-14 days
      return 0.2;
    } else {
      // Due in >14 days
      return 0.0;
    }
  }

  /**
   * Calculate dependency score (-1 to 1)
   */
  private calculateDependencyScore(dependencies: {
    blocked: boolean;
    blockingCount: number;
    dependsOnCount: number;
  }): number {
    if (dependencies.blocked) {
      // Blocked tasks should be lower priority
      return -0.3;
    }

    if (dependencies.blockingCount > 0) {
      // Tasks that block others should be higher priority
      return 0.2 + Math.min(0.3, dependencies.blockingCount * 0.1);
    }

    return 0; // Neutral
  }

  /**
   * Calculate time pressure score (-1 to 1)
   */
  private calculateTimePressure(
    timeEstimate: number | null,
    actualTimeSpent: number | null,
    dueDate: Date | null
  ): number {
    if (!timeEstimate || !dueDate) return 0;

    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const estimateHours = timeEstimate / 60;

    if (diffHours < estimateHours) {
      // Not enough time - high pressure
      return 0.5;
    } else if (diffHours < estimateHours * 1.5) {
      // Tight but manageable
      return 0.3;
    } else {
      // Plenty of time
      return 0.0;
    }
  }

  /**
   * Calculate confidence score (0-1)
   */
  private calculateConfidence(score: number, priority: TaskPriority): number {
    // Higher confidence when score is far from thresholds
    const thresholds = {
      URGENT: 0.8,
      HIGH: 0.6,
      MEDIUM: 0.4,
      LOW: 0.0,
    };

    const threshold = thresholds[priority];
    const distance = Math.abs(score - threshold);

    // Confidence increases with distance from threshold
    return Math.min(1.0, 0.5 + distance * 2);
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    context: TaskContext,
    suggestedPriority: TaskPriority,
    score: number
  ): string {
    const reasons: string[] = [];

    // Due date reasoning
    if (context.task.dueDate) {
      const now = new Date();
      const due = new Date(context.task.dueDate);
      const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        reasons.push(`Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`);
      } else if (diffDays === 0) {
        reasons.push('Due today');
      } else if (diffDays === 1) {
        reasons.push('Due tomorrow');
      } else if (diffDays <= 7) {
        reasons.push(`Due in ${diffDays} days`);
      }
    }

    // Dependency reasoning
    if (context.dependencies.blocked) {
      reasons.push('Blocked by incomplete dependencies');
    } else if (context.dependencies.blockingCount > 0) {
      reasons.push(`Blocking ${context.dependencies.blockingCount} other task${context.dependencies.blockingCount !== 1 ? 's' : ''}`);
    }

    // Time estimate reasoning
    if (context.task.timeEstimate) {
      const hours = Math.round(context.task.timeEstimate / 60);
      reasons.push(`Estimated ${hours} hour${hours !== 1 ? 's' : ''}`);
    }

    // Project reasoning
    if (context.task.project) {
      reasons.push(`Part of project: ${context.task.project.name}`);
    }

    if (reasons.length === 0) {
      return `Suggested ${suggestedPriority} priority based on task analysis`;
    }

    return `Suggested ${suggestedPriority} priority: ${reasons.join(', ')}`;
  }

  /**
   * Get historical priority patterns (simplified - would be enhanced with learning data)
   */
  private async getHistoricalPattern(
    userId: string,
    category: string | null
  ): Promise<{ userPriorityPreference: number; categoryWeight: number } | undefined> {
    // TODO: Implement actual learning from AILearningEvent table
    // For now, return neutral values
    return {
      userPriorityPreference: 0,
      categoryWeight: 0.5,
    };
  }

  /**
   * Helper methods for factor descriptions
   */
  private getDueDateDescription(dueDate: Date | null, score: number): string {
    if (!dueDate) return 'No due date';
    if (score >= 0.8) return 'Urgent due date';
    if (score >= 0.5) return 'Approaching due date';
    return 'Due date in future';
  }

  private getDependencyDescription(
    dependencies: { blocked: boolean; blockingCount: number },
    score: number
  ): string {
    if (dependencies.blocked) return 'Blocked by dependencies';
    if (dependencies.blockingCount > 0) return `Blocking ${dependencies.blockingCount} task(s)`;
    return 'No dependency impact';
  }

  private getTimePressureDescription(task: any, score: number): string {
    if (!task.timeEstimate) return 'No time estimate';
    if (score >= 0.4) return 'Time pressure detected';
    return 'Adequate time available';
  }

  /**
   * Learn from user corrections
   */
  async learnFromUserCorrections(
    userId: string,
    corrections: Array<{
      suggestionId: string;
      accepted: boolean;
      actualPriority?: TaskPriority;
      taskId: string;
      category?: string | null;
    }>
  ): Promise<void> {
    try {
      // TODO: Store learning events in AILearningEvent table
      // This would update user-specific priority patterns
      await logger.info('Learning from user corrections', {
        operation: 'todo_ai_prioritization_learning',
        userId,
        correctionCount: corrections.length,
      });
    } catch (error: unknown) {
      const err = error as Error;
      await logger.error('Error learning from corrections', {
        operation: 'todo_ai_prioritization_learning',
        error: { message: err.message, stack: err.stack },
        userId,
      });
    }
  }
}

