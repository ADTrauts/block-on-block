import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getChatSocketService } from './chatSocketService';
import { PushNotificationService } from './pushNotificationService';
import { EmailNotificationService } from './emailNotificationService';
import type { ModuleNotificationType } from '../../../shared/src/types/module-notifications';

interface QuietHoursDay {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
}

interface QuietHoursSettings {
  enabled: boolean;
  days: {
    monday: QuietHoursDay;
    tuesday: QuietHoursDay;
    wednesday: QuietHoursDay;
    thursday: QuietHoursDay;
    friday: QuietHoursDay;
    saturday: QuietHoursDay;
    sunday: QuietHoursDay;
  };
}

/**
 * Check if user has Do Not Disturb enabled
 */
async function isDoNotDisturbEnabled(userId: string): Promise<boolean> {
  try {
    const preference = await prisma.userPreference.findUnique({
      where: {
        userId_key: {
          userId,
          key: 'do_not_disturb'
        }
      }
    });
    return preference?.value === 'true';
  } catch (error) {
    console.error('Error checking do not disturb status:', error);
    return false; // Default to allowing notifications if check fails
  }
}

/**
 * Check if current time is within quiet hours for user
 */
async function isQuietHoursActive(userId: string): Promise<boolean> {
  try {
    const preference = await prisma.userPreference.findUnique({
      where: {
        userId_key: {
          userId,
          key: 'quiet_hours'
        }
      }
    });

    if (!preference || !preference.value) {
      return false; // No quiet hours configured
    }

    const settings: QuietHoursSettings = JSON.parse(preference.value);
    
    if (!settings.enabled) {
      return false; // Quiet hours disabled
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[dayOfWeek] as keyof typeof settings.days;
    
    const daySettings = settings.days[currentDay];
    
    if (!daySettings.enabled) {
      return false; // Quiet hours not enabled for this day
    }

    // Parse time strings (HH:mm format)
    const [startHour, startMinute] = daySettings.startTime.split(':').map(Number);
    const [endHour, endMinute] = daySettings.endTime.split(':').map(Number);
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    // Handle quiet hours that span midnight (e.g., 22:00 to 08:00)
    if (startTimeMinutes > endTimeMinutes) {
      // Quiet hours span midnight
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes;
    } else {
      // Quiet hours within same day
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error);
    return false; // Default to allowing notifications if check fails
  }
}

/**
 * Check if notifications should be silenced for a user
 */
async function shouldSilenceNotifications(userId: string): Promise<boolean> {
  // Check Do Not Disturb first (takes precedence)
  const dndEnabled = await isDoNotDisturbEnabled(userId);
  if (dndEnabled) {
    return true;
  }

  // Check Quiet Hours
  const quietHoursActive = await isQuietHoursActive(userId);
  if (quietHoursActive) {
    return true;
  }

  return false;
}

export interface CreateNotificationData {
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  userId: string;
}

export interface NotificationTrigger {
  type: 'chat_message' | 'chat_mention' | 'chat_reaction' | 'drive_shared' | 'drive_permission' | 'business_invitation' | 'member_request' | 'system_alert';
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  recipients: string[];
  senderId?: string;
}

export class NotificationService {
  /**
   * Create a notification for a single user
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      // Validate userId before proceeding
      if (!data.userId || typeof data.userId !== 'string' || data.userId.trim() === '') {
        console.error('Invalid userId provided to createNotification:', { userId: data.userId, type: data.type, title: data.title });
        throw new Error('Invalid userId: userId must be a non-empty string');
      }

      // Calculate priority from module metadata
      let priority: 'low' | 'normal' | 'high' | 'urgent' | null = null;
      try {
        const modules = await prisma.module.findMany({
          where: { status: 'APPROVED' },
          select: { id: true, manifest: true }
        });

        for (const module of modules) {
          const manifest = module.manifest as Record<string, unknown>;
          if (manifest.notifications && Array.isArray(manifest.notifications)) {
            const notificationTypes = manifest.notifications as ModuleNotificationType[];
            const matchingType = notificationTypes.find(nt => nt.type === data.type);
            if (matchingType && matchingType.priority) {
              priority = matchingType.priority;
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error calculating notification priority:', error);
        // Continue without priority if lookup fails
      }

      const notification = await prisma.notification.create({
        data: {
          type: data.type,
          title: data.title,
          body: data.body,
          priority: priority || null,
          data: (data.data || {}) as Prisma.InputJsonValue,
          userId: data.userId
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Broadcast notification via WebSocket
      try {
        const chatSocketService = getChatSocketService();
        chatSocketService.broadcastNotification(data.userId, {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body || undefined,
          data: notification.data as Record<string, unknown>, // Fix type mismatch
          createdAt: notification.createdAt.toISOString(),
          read: notification.read
        });
      } catch (socketError) {
        console.error('Error broadcasting notification via WebSocket:', socketError);
        // Don't fail notification creation if WebSocket fails
      }

      // Check if notifications should be silenced (Do Not Disturb or Quiet Hours)
      const shouldSilence = await shouldSilenceNotifications(data.userId);

      // Send push notification (only if not silenced)
      if (!shouldSilence) {
        try {
          const pushService = PushNotificationService.getInstance();
          const pushPayload = pushService.createPayloadFromNotification({
            ...notification,
            body: notification.body || undefined, // Fix null vs undefined
            data: notification.data as Record<string, unknown> // Fix type mismatch
          });
          await pushService.sendToUser(data.userId, pushPayload);
        } catch (pushError) {
          console.error('Error sending push notification:', pushError);
          // Don't fail notification creation if push notification fails
        }
      } else {
        console.log(`Push notification silenced for user ${data.userId} (Do Not Disturb or Quiet Hours active)`);
      }

      // Send email notification (only if not silenced)
      if (!shouldSilence) {
        try {
          const emailService = EmailNotificationService.getInstance();
          if (emailService.isAvailable()) {
            const user = await prisma.user.findUnique({
              where: { id: data.userId },
              select: { id: true, email: true, name: true }
            });
            
            if (user) {
              const emailTemplate = emailService.createTemplateFromNotification({
                ...notification,
                body: notification.body || undefined, // Fix null vs undefined
                data: notification.data as Record<string, unknown> // Fix type mismatch
              }, user);
              await emailService.sendToUser(data.userId, emailTemplate);
            }
          }
        } catch (emailError) {
          console.error('Error sending email notification:', emailError);
          // Don't fail notification creation if email notification fails
        }
      } else {
        console.log(`Email notification silenced for user ${data.userId} (Do Not Disturb or Quiet Hours active)`);
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notifications for multiple users
   */
  static async createNotificationsForUsers(notifications: CreateNotificationData[]) {
    try {
      const createdNotifications = await prisma.notification.createMany({
        data: notifications.map(n => ({
          type: n.type,
          title: n.title,
          body: n.body,
          data: (n.data || {}) as Prisma.InputJsonValue,
          userId: n.userId
        }))
      });

      // Broadcast notifications via WebSocket
      try {
        const chatSocketService = getChatSocketService();
        notifications.forEach(notification => {
          chatSocketService.broadcastNotification(notification.userId, {
            id: '', // We don't have individual IDs from createMany
            type: notification.type,
            title: notification.title,
            body: notification.body || undefined,
            data: notification.data as Record<string, unknown>, // Fix type mismatch
            createdAt: new Date().toISOString(),
            read: false
          });
        });
      } catch (socketError) {
        console.error('Error broadcasting notifications via WebSocket:', socketError);
        // Don't fail notification creation if WebSocket fails
      }

      return createdNotifications;
    } catch (error) {
      console.error('Error creating notifications for users:', error);
      throw error;
    }
  }

  /**
   * Handle chat-related notifications
   */
  static async handleChatNotification(trigger: NotificationTrigger) {
    const notifications: CreateNotificationData[] = [];

    for (const recipientId of trigger.recipients) {
      // Skip if sender is the same as recipient
      if (trigger.senderId && trigger.senderId === recipientId) {
        continue;
      }

      notifications.push({
        type: trigger.type,
        title: trigger.title,
        body: trigger.body,
        data: trigger.data,
        userId: recipientId
      });
    }

    if (notifications.length > 0) {
      return await this.createNotificationsForUsers(notifications);
    }

    return null;
  }

  /**
   * Handle drive-related notifications
   */
  static async handleDriveNotification(trigger: NotificationTrigger) {
    const notifications: CreateNotificationData[] = [];

    for (const recipientId of trigger.recipients) {
      // Skip if sender is the same as recipient
      if (trigger.senderId && trigger.senderId === recipientId) {
        continue;
      }

      notifications.push({
        type: trigger.type,
        title: trigger.title,
        body: trigger.body,
        data: trigger.data,
        userId: recipientId
      });
    }

    if (notifications.length > 0) {
      return await this.createNotificationsForUsers(notifications);
    }

    return null;
  }

  /**
   * Handle business-related notifications
   */
  static async handleBusinessNotification(trigger: NotificationTrigger) {
    const notifications: CreateNotificationData[] = [];

    for (const recipientId of trigger.recipients) {
      // Skip if sender is the same as recipient
      if (trigger.senderId && trigger.senderId === recipientId) {
        continue;
      }

      notifications.push({
        type: trigger.type,
        title: trigger.title,
        body: trigger.body,
        data: trigger.data,
        userId: recipientId
      });
    }

    if (notifications.length > 0) {
      return await this.createNotificationsForUsers(notifications);
    }

    return null;
  }

  /**
   * Handle system notifications
   */
  static async handleSystemNotification(trigger: NotificationTrigger) {
    const notifications: CreateNotificationData[] = [];

    for (const recipientId of trigger.recipients) {
      notifications.push({
        type: trigger.type,
        title: trigger.title,
        body: trigger.body,
        data: trigger.data,
        userId: recipientId
      });
    }

    if (notifications.length > 0) {
      return await this.createNotificationsForUsers(notifications);
    }

    return null;
  }

  /**
   * Generic notification handler
   */
  static async handleNotification(trigger: NotificationTrigger) {
    switch (trigger.type) {
      case 'chat_message':
      case 'chat_mention':
      case 'chat_reaction':
        return await this.handleChatNotification(trigger);
      
      case 'drive_shared':
      case 'drive_permission':
        return await this.handleDriveNotification(trigger);
      
      case 'business_invitation':
      case 'member_request':
        return await this.handleBusinessNotification(trigger);
      
      case 'system_alert':
        return await this.handleSystemNotification(trigger);
      
      default:
        throw new Error(`Unknown notification type: ${trigger.type}`);
    }
  }

  /**
   * Get unread count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.notification.count({
        where: {
          userId,
          read: false,
          deleted: false
        }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notifications as read
   */
  static async markAsRead(userId: string, notificationIds?: string[]) {
    try {
      const where: Record<string, unknown> = {
        userId,
        read: false,
        deleted: false
      };

      if (notificationIds && notificationIds.length > 0) {
        where.id = { in: notificationIds };
      }

      return await prisma.notification.updateMany({
        where,
        data: { read: true }
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }
} 