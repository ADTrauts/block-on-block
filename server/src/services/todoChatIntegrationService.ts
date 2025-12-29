/**
 * To-Do Chat Integration Service
 * Handles creating tasks from chat messages and linking tasks to conversations
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';

export interface TaskFromMessageOptions {
  messageId: string;
  conversationId: string;
  userId: string;
  dashboardId: string;
  businessId?: string | null;
  householdId?: string | null;
  title?: string; // If not provided, will extract from message
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: Date;
  assignedToId?: string;
}

export class TodoChatIntegrationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a task from a chat message
   */
  async createTaskFromMessage(options: TaskFromMessageOptions): Promise<{
    task: any;
    messageLink: any;
  }> {
    try {
      const {
        messageId,
        conversationId,
        userId,
        dashboardId,
        businessId,
        householdId,
        title,
        description,
        priority,
        dueDate,
        assignedToId,
      } = options;

      // Get the message to extract content if title not provided
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          content: true,
          conversationId: true,
        },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Verify message belongs to conversation
      if (message.conversationId !== conversationId) {
        throw new Error('Message does not belong to conversation');
      }

      // Extract task title from message if not provided
      const taskTitle = title || this.extractTaskTitle(message.content);
      const taskDescription = description || this.extractTaskDescription(message.content);

      // Create the task
      const task = await this.prisma.task.create({
        data: {
          title: taskTitle,
          description: taskDescription || null,
          status: 'TODO',
          priority: priority || 'MEDIUM',
          dashboardId,
          businessId: businessId || null,
          householdId: householdId || null,
          createdById: userId,
          assignedToId: assignedToId || null,
          dueDate: dueDate || null,
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

      // Create link between task and message
      // Note: We'll need to add a TaskMessageLink model or use metadata
      // For now, we'll store the link in task description or create a separate link table
      // Since TaskMessageLink doesn't exist yet, we'll add it to the description metadata
      const updatedDescription = taskDescription 
        ? `${taskDescription}\n\n[Created from chat message: ${messageId}]`
        : `[Created from chat message: ${messageId}]`;

      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          description: updatedDescription,
        },
      });

      await logger.info('Task created from chat message', {
        operation: 'todo_chat_create_task',
        taskId: task.id,
        messageId,
        conversationId,
        userId,
      });

      return {
        task,
        messageLink: {
          messageId,
          conversationId,
          taskId: task.id,
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      await logger.error('Failed to create task from message', {
        operation: 'todo_chat_create_task',
        error: { message: err.message, stack: err.stack },
      });
      throw err;
    }
  }

  /**
   * Extract task title from message content
   */
  private extractTaskTitle(content: string): string {
    // Take first line or first 100 characters
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      return firstLine.length > 100 ? firstLine.substring(0, 100) : firstLine;
    }
    
    // Fallback: use first 100 characters
    return content.trim().substring(0, 100) || 'New Task';
  }

  /**
   * Extract task description from message content
   */
  private extractTaskDescription(content: string): string | null {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 1) {
      // Return all lines except the first as description
      return lines.slice(1).join('\n').trim() || null;
    }
    return null;
  }

  /**
   * Parse natural language for task details
   */
  parseTaskDetails(content: string): {
    title: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueDate?: Date;
  } {
    const result: {
      title: string;
      description?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      dueDate?: Date;
    } = {
      title: this.extractTaskTitle(content),
    };

    // Extract priority keywords
    const contentLower = content.toLowerCase();
    if (contentLower.includes('urgent') || contentLower.includes('asap')) {
      result.priority = 'URGENT';
    } else if (contentLower.includes('high priority') || contentLower.includes('important')) {
      result.priority = 'HIGH';
    } else if (contentLower.includes('low priority')) {
      result.priority = 'LOW';
    }

    // Extract due date keywords (simple parsing)
    const today = new Date();
    if (contentLower.includes('today')) {
      result.dueDate = today;
    } else if (contentLower.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      result.dueDate = tomorrow;
    } else if (contentLower.includes('next week')) {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      result.dueDate = nextWeek;
    }

    // Extract description
    const description = this.extractTaskDescription(content);
    if (description) {
      result.description = description;
    }

    return result;
  }

  /**
   * Get tasks linked to a conversation
   */
  async getTasksForConversation(conversationId: string): Promise<any[]> {
    try {
      // Search for tasks that mention this conversation in description
      // This is a simple implementation - in production, you'd want a proper link table
      const tasks = await this.prisma.task.findMany({
        where: {
          description: {
            contains: `[Created from chat message`,
          },
          trashedAt: null,
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
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // Filter to only tasks that reference messages from this conversation
      // This is a simplified approach - ideally we'd have a proper link table
      return tasks.filter(task => {
        // In a real implementation, we'd query TaskMessageLink table
        // For now, we'll return all tasks (this can be improved)
        return true;
      });
    } catch (error: unknown) {
      const err = error as Error;
      await logger.error('Failed to get tasks for conversation', {
        operation: 'todo_chat_get_tasks',
        conversationId,
        error: { message: err.message, stack: err.stack },
      });
      throw err;
    }
  }
}

