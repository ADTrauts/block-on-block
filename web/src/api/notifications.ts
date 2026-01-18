import { authenticatedApiCall } from '../lib/apiUtils';
import type { ModuleNotificationMetadata, ModuleNotificationType } from '../../../shared/src/types/module-notifications';

// Notification data interfaces
export interface NotificationData {
  [key: string]: unknown;
}

export interface NotificationUser {
  id: string;
  name: string;
  email: string;
}

export interface Notification {
  id: string;
  type: string; // Dynamic - can be any notification type from modules
  title: string;
  body?: string;
  read: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  snoozedUntil?: string;
  createdAt: string;
  deliveredAt?: string;
  deleted: boolean;
  data?: NotificationData;
  user?: NotificationUser;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

export interface NotificationResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  unreadCount: number;
}

export interface CreateNotificationData {
  type: string;
  title: string;
  body?: string;
  data?: NotificationData;
  userId: string;
}

// Get notifications with optional filters
export const getNotifications = async (
  params?: {
    page?: number;
    limit?: number;
    type?: string;
    read?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
): Promise<NotificationResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.type) queryParams.append('type', params.type);
  if (params?.read !== undefined) queryParams.append('read', params.read.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const url = `/api/notifications${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  return authenticatedApiCall(url, {
    method: 'GET'
  });
};

// Get notification statistics
export const getNotificationStats = async (): Promise<NotificationStats> => {
  return authenticatedApiCall('/api/notifications/stats', {
    method: 'GET'
  });
};

// Get module notification types (for dynamic notification center)
export const getModuleNotificationTypes = async (): Promise<{ modules: ModuleNotificationMetadata[] }> => {
  return authenticatedApiCall('/api/notifications/module-types', {
    method: 'GET'
  });
};

// Get user notification preferences
export const getNotificationPreferences = async (): Promise<{ preferences: Record<string, { inApp: boolean; email: boolean; push: boolean }> }> => {
  return authenticatedApiCall('/api/notifications/preferences', {
    method: 'GET'
  });
};

// Save user notification preferences
export const saveNotificationPreferences = async (preferences: Record<string, { inApp: boolean; email: boolean; push: boolean }>): Promise<{ success: boolean; message: string }> => {
  return authenticatedApiCall('/api/notifications/preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ preferences })
  });
};

// Create a notification
export const createNotification = async (data: CreateNotificationData): Promise<{ notification: Notification }> => {
  return authenticatedApiCall('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};

// Mark notification as read
export const markAsRead = async (id: string): Promise<{ notification: Notification }> => {
  return authenticatedApiCall(`/api/notifications/${id}/read`, {
    method: 'POST'
  });
};

// Mark all notifications as read
export const markAllAsRead = async (type?: string): Promise<{ success: boolean }> => {
  const url = type 
    ? `/api/notifications/mark-all-read?type=${type}`
    : '/api/notifications/mark-all-read';
    
  return authenticatedApiCall(url, {
    method: 'POST'
  });
};

// Archive notification
export const archiveNotification = async (id: string): Promise<{ notification: Notification }> => {
  return authenticatedApiCall(`/api/notifications/${id}/archive`, {
    method: 'POST'
  });
};

// Archive multiple notifications
export const archiveMultipleNotifications = async (ids: string[]): Promise<{ success: boolean; message: string }> => {
  return authenticatedApiCall('/api/notifications/archive/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids })
  });
};

// Delete notification
export const deleteNotification = async (id: string): Promise<{ success: boolean }> => {
  return authenticatedApiCall(`/api/notifications/${id}`, {
    method: 'DELETE'
  });
};

// Delete multiple notifications
export const deleteMultipleNotifications = async (ids: string[]): Promise<{ success: boolean }> => {
  return authenticatedApiCall('/api/notifications/bulk', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids })
  });
};

// Create notification for another user (admin only)
export const createNotificationForUser = async (data: CreateNotificationData): Promise<{ notification: Notification }> => {
  return authenticatedApiCall('/api/notifications/for-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};

// Quiet Hours
export interface QuietHoursSettings {
  enabled: boolean;
  days: {
    monday: { enabled: boolean; startTime: string; endTime: string };
    tuesday: { enabled: boolean; startTime: string; endTime: string };
    wednesday: { enabled: boolean; startTime: string; endTime: string };
    thursday: { enabled: boolean; startTime: string; endTime: string };
    friday: { enabled: boolean; startTime: string; endTime: string };
    saturday: { enabled: boolean; startTime: string; endTime: string };
    sunday: { enabled: boolean; startTime: string; endTime: string };
  };
}

export const getQuietHours = async (): Promise<{ settings: QuietHoursSettings }> => {
  return authenticatedApiCall('/api/notifications/quiet-hours', {
    method: 'GET'
  });
};

export const saveQuietHours = async (settings: QuietHoursSettings): Promise<{ success: boolean; message: string }> => {
  return authenticatedApiCall('/api/notifications/quiet-hours', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ settings })
  });
};

// Do Not Disturb
export const getDoNotDisturb = async (): Promise<{ enabled: boolean }> => {
  return authenticatedApiCall('/api/notifications/do-not-disturb', {
    method: 'GET'
  });
};

export const saveDoNotDisturb = async (enabled: boolean): Promise<{ success: boolean; message: string }> => {
  return authenticatedApiCall('/api/notifications/do-not-disturb', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ enabled })
  });
};

// Grouped Notifications
export interface NotificationGroup {
  id: string;
  type: string;
  title: string;
  count: number;
  latestNotification: {
    id: string;
    type: string;
    title: string;
    read: boolean;
    createdAt: string;
    data?: Record<string, unknown>;
  };
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    read: boolean;
    createdAt: string;
    data?: Record<string, unknown>;
  }>;
  priority: 'high' | 'medium' | 'low';
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getGroupedNotifications = async (limit?: number): Promise<{ groups: NotificationGroup[] }> => {
  const queryParams = new URLSearchParams();
  if (limit) queryParams.append('limit', limit.toString());
  
  const url = `/api/notifications/grouped${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return authenticatedApiCall(url, {
    method: 'GET'
  });
};

export const markGroupAsRead = async (groupId: string): Promise<{ success: boolean; message: string }> => {
  return authenticatedApiCall(`/api/notifications/grouped/${groupId}/read`, {
    method: 'POST'
  });
};

// Snooze notifications
export const snoozeNotification = async (id: string, duration: '1h' | '1d' | '1w' | string): Promise<{ notification: Notification }> => {
  return authenticatedApiCall(`/api/notifications/${id}/snooze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ duration })
  });
};

export const unsnoozeNotification = async (id: string): Promise<{ notification: Notification }> => {
  return authenticatedApiCall(`/api/notifications/${id}/unsnooze`, {
    method: 'POST'
  });
}; 