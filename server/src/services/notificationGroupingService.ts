import { prisma } from '../lib/prisma';
import { JsonValue } from '@prisma/client/runtime/library';

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  read: boolean;
  createdAt: Date;
  data?: JsonValue;
}

export interface NotificationGroup {
  id: string;
  type: string;
  title: string;
  count: number;
  latestNotification: NotificationData;
  notifications: NotificationData[];
  priority: 'high' | 'medium' | 'low';
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupingRule {
  type: string;
  timeWindow: number; // minutes
  maxGroupSize: number;
  priority: 'high' | 'medium' | 'low';
}

export class NotificationGroupingService {
  private static instance: NotificationGroupingService;
  private groupingRules: GroupingRule[] = [];

  private constructor() {
    this.initializeGroupingRules();
  }

  public static getInstance(): NotificationGroupingService {
    if (!NotificationGroupingService.instance) {
      NotificationGroupingService.instance = new NotificationGroupingService();
    }
    return NotificationGroupingService.instance;
  }

  private initializeGroupingRules() {
    this.groupingRules = [
      // Chat messages - group by conversation within 5 minutes
      {
        type: 'chat',
        timeWindow: 5,
        maxGroupSize: 10,
        priority: 'high'
      },
      // Mentions - group by conversation within 2 minutes
      {
        type: 'mentions',
        timeWindow: 2,
        maxGroupSize: 5,
        priority: 'high'
      },
      // File sharing - group by sender within 10 minutes
      {
        type: 'drive',
        timeWindow: 10,
        maxGroupSize: 8,
        priority: 'medium'
      },
      // Business invitations - no grouping (individual)
      {
        type: 'invitations',
        timeWindow: 0,
        maxGroupSize: 1,
        priority: 'high'
      },
      // HR notifications - group by type within 15 minutes
      {
        type: 'hr',
        timeWindow: 15,
        maxGroupSize: 5,
        priority: 'medium'
      },
      // Calendar notifications - group by type within 10 minutes
      {
        type: 'calendar',
        timeWindow: 10,
        maxGroupSize: 5,
        priority: 'medium'
      },
      // System notifications - group by type within 15 minutes
      {
        type: 'system',
        timeWindow: 15,
        maxGroupSize: 5,
        priority: 'low'
      }
    ];
  }

  /**
   * Get grouped notifications for a user
   */
  async getGroupedNotifications(userId: string, limit: number = 50): Promise<NotificationGroup[]> {
    try {
      const now = new Date();
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          deleted: false,
          // Filter out snoozed notifications (only show if snoozedUntil is null or in the past)
          OR: [
            { snoozedUntil: null },
            { snoozedUntil: { lt: now } }
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit * 2 // Get more to allow for grouping
      });

      return this.groupNotifications(notifications);
    } catch (error) {
      console.error('Error getting grouped notifications:', error);
      return [];
    }
  }

  /**
   * Group notifications based on rules
   */
  private groupNotifications(notifications: NotificationData[]): NotificationGroup[] {
    const groups: Map<string, NotificationGroup> = new Map();

    for (const notification of notifications) {
      const rule = this.getGroupingRule(notification.type);
      
      if (!rule || rule.timeWindow === 0) {
        // No grouping - create individual group
        const groupId = `individual_${notification.id}`;
        groups.set(groupId, this.createIndividualGroup(notification));
        continue;
      }

      const groupKey = this.getGroupKey(notification);
      const existingGroup = groups.get(groupKey);

      if (existingGroup && this.shouldAddToGroup(notification, existingGroup, rule)) {
        // Add to existing group
        existingGroup.notifications.push(notification);
        existingGroup.count++;
        existingGroup.updatedAt = notification.createdAt;
        existingGroup.isRead = existingGroup.isRead && notification.read;
        
        // Update latest notification if this one is newer
        if (notification.createdAt > existingGroup.latestNotification.createdAt) {
          existingGroup.latestNotification = notification;
        }
      } else {
        // Create new group
        groups.set(groupKey, this.createGroupFromNotification(notification, rule));
      }
    }

    // Convert to array and sort by latest notification
    return Array.from(groups.values())
      .sort((a, b) => b.latestNotification.createdAt.getTime() - a.latestNotification.createdAt.getTime());
  }

  /**
   * Get grouping rule for notification type
   */
  private getGroupingRule(type: string): GroupingRule | null {
    // Map notification types to grouping categories
    const typeMapping: Record<string, string> = {
      'chat_message': 'chat',
      'chat_mention': 'mentions',
      'chat_reaction': 'chat',
      'mentions': 'mentions',
      'drive_shared': 'drive',
      'drive_permission': 'drive',
      'business_invitation': 'invitations',
      'member_request': 'invitations',
      'system_alert': 'system',
      'hr_onboarding_task_approved': 'hr',
      'hr_time_off_request_submitted': 'hr',
      'calendar_reminder': 'calendar'
    };
    
    const category = typeMapping[type] || type.split('_')[0]; // Fallback to first part of type
    return this.groupingRules.find(rule => rule.type === category) || null;
  }

  /**
   * Generate group key for notification
   */
  private getGroupKey(notification: NotificationData): string {
    switch (notification.type) {
      case 'chat':
      case 'mentions':
        return `${notification.type}_${(notification.data as any)?.conversationId || 'general'}`;
      case 'drive':
        return `${notification.type}_${(notification.data as any)?.senderId || 'system'}`;
      case 'system':
        return `${notification.type}_${(notification.data as any)?.category || 'general'}`;
      default:
        return `${notification.type}_general`;
    }
  }

  /**
   * Check if notification should be added to existing group
   */
  private shouldAddToGroup(notification: NotificationData, group: NotificationGroup, rule: GroupingRule): boolean {
    const timeDiff = Math.abs(
      notification.createdAt.getTime() - group.latestNotification.createdAt.getTime()
    );
    const timeWindowMs = rule.timeWindow * 60 * 1000;

    return timeDiff <= timeWindowMs && group.count < rule.maxGroupSize;
  }

  /**
   * Create individual group for notification
   */
  private createIndividualGroup(notification: NotificationData): NotificationGroup {
    return {
      id: `individual_${notification.id}`,
      type: notification.type,
      title: notification.title,
      count: 1,
      latestNotification: notification,
      notifications: [notification],
      priority: this.getPriority(notification.type),
      isRead: notification.read,
      createdAt: notification.createdAt,
      updatedAt: notification.createdAt
    };
  }

  /**
   * Create group from notification
   */
  private createGroupFromNotification(notification: NotificationData, rule: GroupingRule): NotificationGroup {
    const groupKey = this.getGroupKey(notification);
    
    return {
      id: groupKey,
      type: notification.type,
      title: this.generateGroupTitle(notification, rule),
      count: 1,
      latestNotification: notification,
      notifications: [notification],
      priority: rule.priority,
      isRead: notification.read,
      createdAt: notification.createdAt,
      updatedAt: notification.createdAt
    };
  }

  /**
   * Generate title for grouped notifications
   */
  private generateGroupTitle(notification: NotificationData, rule: GroupingRule): string {
    // Map notification types to grouping categories
    const typeMapping: Record<string, string> = {
      'chat_message': 'chat',
      'chat_mention': 'mentions',
      'chat_reaction': 'chat',
      'mentions': 'mentions',
      'drive_shared': 'drive',
      'drive_permission': 'drive',
      'business_invitation': 'invitations',
      'member_request': 'invitations',
      'system_alert': 'system',
      'hr_onboarding_task_approved': 'hr',
      'hr_time_off_request_submitted': 'hr',
      'calendar_reminder': 'calendar'
    };
    
    const category = typeMapping[notification.type] || notification.type.split('_')[0];
    
    switch (category) {
      case 'chat':
        return `${(notification.data as any)?.senderName || 'Someone'} sent ${rule.maxGroupSize > 1 ? 'messages' : 'a message'}`;
      case 'mentions':
        return `${(notification.data as any)?.senderName || 'Someone'} mentioned you`;
      case 'drive':
        return `${(notification.data as any)?.senderName || 'Someone'} shared files with you`;
      case 'system':
        return 'System notifications';
      default:
        return notification.title;
    }
  }

  /**
   * Get priority for notification type
   */
  private getPriority(type: string): 'high' | 'medium' | 'low' {
    switch (type) {
      case 'mentions':
      case 'invitations':
        return 'high';
      case 'chat':
      case 'drive':
        return 'medium';
      case 'system':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Mark group as read
   */
  async markGroupAsRead(groupId: string, userId: string): Promise<boolean> {
    try {
      const group = await this.getGroupById(groupId, userId);
      if (!group) return false;

      const notificationIds = group.notifications.map(n => n.id);
      
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId
        },
        data: {
          read: true
        }
      });

      return true;
    } catch (error) {
      console.error('Error marking group as read:', error);
      return false;
    }
  }

  /**
   * Get group by ID
   */
  async getGroupById(groupId: string, userId: string): Promise<NotificationGroup | null> {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          deleted: false
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const groups = this.groupNotifications(notifications);
      return groups.find(group => group.id === groupId) || null;
    } catch (error) {
      console.error('Error getting group by ID:', error);
      return null;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    grouped: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          deleted: false
        }
      });

      const groups = this.groupNotifications(notifications);
      
      const byType: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      
      groups.forEach(group => {
        byType[group.type] = (byType[group.type] || 0) + group.count;
        byPriority[group.priority] = (byPriority[group.priority] || 0) + group.count;
      });

      return {
        total: notifications.length,
        unread: notifications.filter(n => !n.read).length,
        grouped: groups.length,
        byType,
        byPriority
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        total: 0,
        unread: 0,
        grouped: 0,
        byType: {},
        byPriority: {}
      };
    }
  }
} 