import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getChatSocketService } from '../services/chatSocketService';
import { NotificationGroupingService } from '../services/notificationGroupingService';
import type { ModuleNotificationMetadata } from '../../../shared/src/types/module-notifications';

// Get all notifications for the current user
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      page = 1, 
      limit = 50, 
      type, 
      read, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Build where clause
    const now = new Date();
    const showArchived = req.query.showArchived === 'true';
    const where: any = {
      userId,
      deleted: showArchived ? undefined : false, // If showing archived, don't filter by deleted
      // Filter out snoozed notifications (only show if snoozedUntil is null or in the past)
      AND: [
        {
          OR: [
            { snoozedUntil: null },
            { snoozedUntil: { lt: now } }
          ]
        }
      ]
    };

    // If showing archived, only show deleted notifications
    if (showArchived) {
      where.deleted = true;
    }

    if (type) {
      where.type = type;
    }

    if (read !== undefined) {
      where.read = read === 'true';
    }

    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search as string, mode: 'insensitive' } },
          { body: { contains: search as string, mode: 'insensitive' } }
        ]
      });
    }

    // Get notifications with sender information
    const notifications = await prisma.notification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        [sortBy as string]: sortOrder
      },
      skip,
      take
    });

    // Get total count for pagination
    const total = await prisma.notification.count({ where });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        read: false,
        deleted: false
      }
    });

    res.json({
      notifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Get module notification types (for dynamic notification center)
export const getModuleNotificationTypes = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all approved modules
    const modules = await prisma.module.findMany({
      where: {
        status: 'APPROVED'
      },
      select: {
        id: true,
        name: true,
        manifest: true
      }
    });

    const moduleNotifications: ModuleNotificationMetadata[] = [];

    for (const module of modules) {
      const manifest = module.manifest as Record<string, unknown>;
      
      // Check if module has notification metadata in manifest
      if (manifest.notifications && Array.isArray(manifest.notifications)) {
        const notificationTypes = manifest.notifications as Array<Record<string, unknown>>;
        
        moduleNotifications.push({
          moduleId: module.id,
          moduleName: module.name,
          notificationTypes: notificationTypes.map(nt => ({
            type: nt.type as string,
            name: nt.name as string,
            description: nt.description as string,
            category: (nt.category as string) || 'system',
            defaultChannels: {
              inApp: (nt.defaultChannels as Record<string, unknown>)?.inApp !== false,
              email: (nt.defaultChannels as Record<string, unknown>)?.email === true,
              push: (nt.defaultChannels as Record<string, unknown>)?.push === true
            },
            priority: (nt.priority as 'low' | 'normal' | 'high' | 'urgent') || 'normal',
            requiresAction: nt.requiresAction === true
          })),
          categoryIcon: manifest.categoryIcon as string | undefined
        });
      }
    }

    res.json({ modules: moduleNotifications });
  } catch (error) {
    console.error('Error fetching module notification types:', error);
    res.status(500).json({ error: 'Failed to fetch module notification types' });
  }
};

// Create a new notification
export const createNotification = async (req: Request, res: Response) => {
  try {
    const { type, title, body, data, userId } = req.body;

    if (!type || !title || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notification = await prisma.notification.create({
      data: {
        type,
        title,
        body,
        data: data || {},
        userId
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

    res.status(201).json({ notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { read: true },
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

    // Broadcast notification update via WebSocket
    try {
      const chatSocketService = getChatSocketService();
      chatSocketService.broadcastNotificationUpdate(userId, id, { read: true });
    } catch (socketError) {
      console.error('Error broadcasting notification update via WebSocket:', socketError);
      // Don't fail the operation if WebSocket fails
    }

    res.json({ notification: updatedNotification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type } = req.query;

    const where: any = {
      userId,
      read: false,
      deleted: false
    };

    if (type) {
      where.type = type;
    }

    await prisma.notification.updateMany({
      where,
      data: { read: true }
    });

    // Broadcast notification updates via WebSocket
    try {
      const chatSocketService = getChatSocketService();
      chatSocketService.broadcastNotificationUpdate(userId, 'all', { read: true });
    } catch (socketError) {
      console.error('Error broadcasting notification updates via WebSocket:', socketError);
      // Don't fail the operation if WebSocket fails
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

// Archive notification
export const archiveNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { deleted: true },
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

    // Broadcast notification update via WebSocket
    try {
      const chatSocketService = getChatSocketService();
      chatSocketService.broadcastNotificationUpdate(userId, id, { deleted: true });
    } catch (socketError) {
      console.error('Error broadcasting notification update via WebSocket:', socketError);
    }

    res.json({ notification: updatedNotification });
  } catch (error) {
    console.error('Error archiving notification:', error);
    res.status(500).json({ error: 'Failed to archive notification' });
  }
};

// Archive multiple notifications
export const archiveMultipleNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid notification IDs' });
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId,
        deleted: false
      },
      data: { deleted: true }
    });

    // Broadcast notification updates via WebSocket
    try {
      const chatSocketService = getChatSocketService();
      chatSocketService.broadcastNotificationUpdate(userId, 'bulk', { deleted: true });
    } catch (socketError) {
      console.error('Error broadcasting notification updates via WebSocket:', socketError);
    }

    res.json({ success: true, message: `${ids.length} notifications archived` });
  } catch (error) {
    console.error('Error archiving notifications:', error);
    res.status(500).json({ error: 'Failed to archive notifications' });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id },
      data: { deleted: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// Delete multiple notifications
export const deleteMultipleNotifications = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid notification IDs' });
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId
      },
      data: { deleted: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting multiple notifications:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
};

// Get notification statistics
export const getNotificationStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [
      totalCount,
      unreadCount,
      typeStats
    ] = await Promise.all([
      // Total notifications
      prisma.notification.count({
        where: {
          userId,
          deleted: false
        }
      }),
      // Unread notifications
      prisma.notification.count({
        where: {
          userId,
          read: false,
          deleted: false
        }
      }),
      // Notifications by type
      prisma.notification.groupBy({
        by: ['type'],
        where: {
          userId,
          deleted: false
        },
        _count: {
          type: true
        }
      })
    ]);

    const stats = {
      total: totalCount,
      unread: unreadCount,
      byType: typeStats.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ error: 'Failed to fetch notification statistics' });
  }
};

// Create notification for another user (admin or system function)
export const createNotificationForUser = async (req: Request, res: Response) => {
  try {
    const { type, title, body, data, userId } = req.body;
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if current user is admin or has permission to create notifications for others
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true }
    });

    if (currentUser?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (!type || !title || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notification = await prisma.notification.create({
      data: {
        type,
        title,
        body,
        data: data || {},
        userId
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

    res.status(201).json({ notification });
  } catch (error) {
    console.error('Error creating notification for user:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

// Get user notification preferences
export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all notification preferences for this user
    const preferences = await prisma.userPreference.findMany({
      where: {
        userId,
        key: {
          startsWith: 'notification_'
        }
      }
    });

    // Convert to object format
    const prefs: Record<string, { inApp: boolean; email: boolean; push: boolean }> = {};
    
    for (const pref of preferences) {
      const keyParts = pref.key.split('_');
      if (keyParts.length >= 3) {
        const category = keyParts.slice(1, -1).join('_'); // Everything between 'notification' and channel
        const channel = keyParts[keyParts.length - 1]; // Last part is channel (inApp, email, push)
        
        if (!prefs[category]) {
          prefs[category] = { inApp: true, email: false, push: false };
        }
        
        prefs[category][channel as 'inApp' | 'email' | 'push'] = pref.value === 'true';
      }
    }

    res.json({ preferences: prefs });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
};

// Save user notification preferences
export const saveNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences data' });
    }

    // Save each preference
    const updates = [];
    for (const [category, channels] of Object.entries(preferences)) {
      const channelsObj = channels as { inApp?: boolean; email?: boolean; push?: boolean };
      
      for (const [channel, enabled] of Object.entries(channelsObj)) {
        if (channel === 'inApp' || channel === 'email' || channel === 'push') {
          const key = `notification_${category}_${channel}`;
          updates.push(
            prisma.userPreference.upsert({
              where: { userId_key: { userId, key } },
              update: { value: String(enabled) },
              create: { userId, key, value: String(enabled) }
            })
          );
        }
      }
    }

    await Promise.all(updates);

    res.json({ success: true, message: 'Notification preferences saved successfully' });
  } catch (error) {
    console.error('Error saving notification preferences:', error);
    res.status(500).json({ error: 'Failed to save notification preferences' });
  }
};

// Get quiet hours settings
export const getQuietHours = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get quiet hours preference
    const preference = await prisma.userPreference.findUnique({
      where: {
        userId_key: {
          userId,
          key: 'quiet_hours'
        }
      }
    });

    if (preference && preference.value) {
      try {
        const settings = JSON.parse(preference.value);
        return res.json({ settings });
      } catch (parseError) {
        console.error('Error parsing quiet hours settings:', parseError);
      }
    }

    // Return default settings
    const defaultSettings = {
      enabled: false,
      days: {
        monday: { enabled: false, startTime: '22:00', endTime: '08:00' },
        tuesday: { enabled: false, startTime: '22:00', endTime: '08:00' },
        wednesday: { enabled: false, startTime: '22:00', endTime: '08:00' },
        thursday: { enabled: false, startTime: '22:00', endTime: '08:00' },
        friday: { enabled: false, startTime: '22:00', endTime: '08:00' },
        saturday: { enabled: false, startTime: '22:00', endTime: '08:00' },
        sunday: { enabled: false, startTime: '22:00', endTime: '08:00' },
      }
    };

    res.json({ settings: defaultSettings });
  } catch (error) {
    console.error('Error fetching quiet hours:', error);
    res.status(500).json({ error: 'Failed to fetch quiet hours settings' });
  }
};

// Save quiet hours settings
export const saveQuietHours = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid quiet hours settings' });
    }

    // Validate settings structure
    if (typeof settings.enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid settings: enabled must be boolean' });
    }

    if (!settings.days || typeof settings.days !== 'object') {
      return res.status(400).json({ error: 'Invalid settings: days must be an object' });
    }

    // Save quiet hours preference
    await prisma.userPreference.upsert({
      where: {
        userId_key: {
          userId,
          key: 'quiet_hours'
        }
      },
      update: {
        value: JSON.stringify(settings)
      },
      create: {
        userId,
        key: 'quiet_hours',
        value: JSON.stringify(settings)
      }
    });

    res.json({ success: true, message: 'Quiet hours settings saved successfully' });
  } catch (error) {
    console.error('Error saving quiet hours:', error);
    res.status(500).json({ error: 'Failed to save quiet hours settings' });
  }
};

// Get Do Not Disturb status
export const getDoNotDisturb = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const preference = await prisma.userPreference.findUnique({
      where: {
        userId_key: {
          userId,
          key: 'do_not_disturb'
        }
      }
    });

    const enabled = preference?.value === 'true';
    res.json({ enabled });
  } catch (error) {
    console.error('Error fetching do not disturb status:', error);
    res.status(500).json({ error: 'Failed to fetch do not disturb status' });
  }
};

// Save Do Not Disturb status
export const saveDoNotDisturb = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid enabled value' });
    }

    await prisma.userPreference.upsert({
      where: {
        userId_key: {
          userId,
          key: 'do_not_disturb'
        }
      },
      update: {
        value: String(enabled)
      },
      create: {
        userId,
        key: 'do_not_disturb',
        value: String(enabled)
      }
    });

    res.json({ success: true, message: 'Do not disturb status updated successfully' });
  } catch (error) {
    console.error('Error saving do not disturb status:', error);
    res.status(500).json({ error: 'Failed to save do not disturb status' });
  }
};

// Get grouped notifications
export const getGroupedNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = 50 } = req.query;
    const groupingService = NotificationGroupingService.getInstance();
    
    const groups = await groupingService.getGroupedNotifications(
      userId,
      Number(limit)
    );

    // Convert Date objects to ISO strings for JSON response
    const formattedGroups = groups.map(group => ({
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      latestNotification: {
        ...group.latestNotification,
        createdAt: group.latestNotification.createdAt.toISOString()
      },
      notifications: group.notifications.map(n => ({
        ...n,
        createdAt: n.createdAt.toISOString()
      }))
    }));

    res.json({ groups: formattedGroups });
  } catch (error) {
    console.error('Error fetching grouped notifications:', error);
    res.status(500).json({ error: 'Failed to fetch grouped notifications' });
  }
};

// Mark notification group as read
export const markGroupAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { groupId } = req.params;
    const groupingService = NotificationGroupingService.getInstance();
    
    const success = await groupingService.markGroupAsRead(groupId, userId);

    if (success) {
      // Broadcast notification updates via WebSocket
      try {
        const chatSocketService = getChatSocketService();
        chatSocketService.broadcastNotificationUpdate(userId, groupId, { read: true });
      } catch (socketError) {
        console.error('Error broadcasting notification updates via WebSocket:', socketError);
      }

      res.json({ success: true, message: 'Notification group marked as read' });
    } else {
      res.status(404).json({ error: 'Notification group not found' });
    }
  } catch (error) {
    console.error('Error marking group as read:', error);
    res.status(500).json({ error: 'Failed to mark group as read' });
  }
};

// Snooze notification
export const snoozeNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { duration } = req.body; // '1h', '1d', '1w', or ISO date string

    if (!duration) {
      return res.status(400).json({ error: 'Duration is required' });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Calculate snoozedUntil time
    let snoozedUntil: Date;
    const now = new Date();

    if (duration === '1h') {
      snoozedUntil = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (duration === '1d') {
      snoozedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (duration === '1w') {
      snoozedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      // Try to parse as ISO date string
      snoozedUntil = new Date(duration);
      if (isNaN(snoozedUntil.getTime())) {
        return res.status(400).json({ error: 'Invalid duration format' });
      }
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { snoozedUntil },
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

    // Broadcast notification update via WebSocket
    try {
      const chatSocketService = getChatSocketService();
      chatSocketService.broadcastNotificationUpdate(userId, id, { snoozedUntil: snoozedUntil.toISOString() });
    } catch (socketError) {
      console.error('Error broadcasting notification update via WebSocket:', socketError);
    }

    res.json({ notification: updatedNotification });
  } catch (error) {
    console.error('Error snoozing notification:', error);
    res.status(500).json({ error: 'Failed to snooze notification' });
  }
};

// Unsnooze notification
export const unsnoozeNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { snoozedUntil: null },
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

    // Broadcast notification update via WebSocket
    try {
      const chatSocketService = getChatSocketService();
      chatSocketService.broadcastNotificationUpdate(userId, id, { snoozedUntil: null });
    } catch (socketError) {
      console.error('Error broadcasting notification update via WebSocket:', socketError);
    }

    res.json({ notification: updatedNotification });
  } catch (error) {
    console.error('Error unsnoozing notification:', error);
    res.status(500).json({ error: 'Failed to unsnooze notification' });
  }
};
