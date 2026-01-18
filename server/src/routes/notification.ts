import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import {
  getNotifications,
  getModuleNotificationTypes,
  getNotificationPreferences,
  saveNotificationPreferences,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
  getNotificationStats,
  createNotificationForUser,
  getQuietHours,
  saveQuietHours,
  getDoNotDisturb,
  saveDoNotDisturb,
  archiveNotification,
  archiveMultipleNotifications,
  getGroupedNotifications,
  markGroupAsRead,
  snoozeNotification,
  unsnoozeNotification
} from '../controllers/notificationController';

const router: express.Router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Get notifications for current user
router.get('/', getNotifications);

// Get module notification types (for dynamic notification center)
router.get('/module-types', getModuleNotificationTypes);

// Get notification statistics
router.get('/stats', getNotificationStats);

// Get user notification preferences
router.get('/preferences', getNotificationPreferences);

// Save user notification preferences
router.put('/preferences', saveNotificationPreferences);

// Create notification for current user
router.post('/', createNotification);

// Mark notification as read
router.post('/:id/read', markAsRead);

// Mark all notifications as read
router.post('/mark-all-read', markAllAsRead);

// Archive notification
router.post('/:id/archive', archiveNotification);

// Archive multiple notifications
router.post('/archive/bulk', archiveMultipleNotifications);

// Delete notification
router.delete('/:id', deleteNotification);

// Delete multiple notifications
router.delete('/bulk', deleteMultipleNotifications);

// Create notification for another user (admin only)
router.post('/for-user', createNotificationForUser);

// Quiet Hours settings
router.get('/quiet-hours', getQuietHours);
router.put('/quiet-hours', saveQuietHours);

// Do Not Disturb
router.get('/do-not-disturb', getDoNotDisturb);
router.put('/do-not-disturb', saveDoNotDisturb);

// Grouped notifications
router.get('/grouped', getGroupedNotifications);
router.post('/grouped/:groupId/read', markGroupAsRead);

// Snooze notifications
router.post('/:id/snooze', snoozeNotification);
router.post('/:id/unsnooze', unsnoozeNotification);

export default router; 