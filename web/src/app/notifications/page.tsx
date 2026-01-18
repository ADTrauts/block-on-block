'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Bell, 
  Settings, 
  Check, 
  Archive,
  MoreHorizontal,
  MessageSquare,
  Folder,
  Users,
  Building,
  AlertCircle,
  AtSign,
  Clock,
  Search,
  ChevronRight,
  UserCheck,
  List,
  Layers,
  Clock,
  Zap
} from 'lucide-react';
import { Avatar, Button, Badge } from 'shared/components';
import { useSafeSession } from '../../lib/useSafeSession';
import { useRouter } from 'next/navigation';
import { getNotifications, markAsRead, markAllAsRead, getModuleNotificationTypes, archiveNotification, archiveMultipleNotifications, deleteNotification, deleteMultipleNotifications, getGroupedNotifications, markGroupAsRead, type Notification, type NotificationGroup } from '../../api/notifications';
import { useNotificationSocket } from '../../lib/notificationSocket';
import type { ModuleNotificationMetadata, ModuleNotificationType } from '../../../shared/src/types/module-notifications';

interface NotificationCategory {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  count: number;
  unreadCount: number;
}

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  chat: MessageSquare,
  drive: Folder,
  members: Users,
  business: Building,
  hr: UserCheck,
  system: AlertCircle,
  mentions: AtSign,
  calendar: Clock,
  scheduling: Clock,
  todo: Check,
};

// Fallback category mapping for legacy notification types
const LEGACY_TYPE_MAPPING: Record<string, string> = {
  'chat_message': 'chat',
  'chat_reaction': 'chat',
  'chat_mention': 'mentions',
  'mentions': 'mentions',
  'drive_shared': 'drive',
  'drive_permission': 'drive',
  'business_invitation': 'business',
  'member_request': 'members',
  'system_alert': 'system',
  'calendar_reminder': 'calendar',
};

export default function NotificationsPage() {
  const { session, status, mounted } = useSafeSession();
  const router = useRouter();
  const notificationSocket = useNotificationSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showRead, setShowRead] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleNotificationTypes, setModuleNotificationTypes] = useState<Map<string, string>>(new Map());
  const [categoryLabels, setCategoryLabels] = useState<Map<string, string>>(new Map());
  const [allCategories, setAllCategories] = useState<Set<string>>(new Set());
  const [moduleMetadata, setModuleMetadata] = useState<ModuleNotificationMetadata[]>([]);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'urgent' | 'high' | 'normal' | 'low'>('all');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showArchived, setShowArchived] = useState(false);
  const limit = 50;

  // Load module notification types on mount
  useEffect(() => {
    if (!mounted || status === "loading") return;

    const loadModuleTypes = async () => {
      try {
        const response = await getModuleNotificationTypes();
        const typeToCategory = new Map<string, string>();
        const categoryToLabel = new Map<string, string>();

        // Build mapping from module notification metadata
        const categoriesSet = new Set<string>();
        for (const module of response.modules) {
          for (const notificationType of module.notificationTypes) {
            typeToCategory.set(notificationType.type, notificationType.category);
            categoriesSet.add(notificationType.category);
            // Store category label (use module name as label if not set)
            if (!categoryToLabel.has(notificationType.category)) {
              categoryToLabel.set(notificationType.category, module.moduleName);
            }
          }
        }

        setModuleNotificationTypes(typeToCategory);
        setCategoryLabels(categoryToLabel);
        setAllCategories(categoriesSet);
        setModuleMetadata(response.modules);
      } catch (error) {
        console.error('Failed to load module notification types:', error);
        // Continue with legacy mapping if API fails
      }
    };

    loadModuleTypes();
  }, [mounted, status]);

  const getNormalizedType = (rawType: string): string => {
    // First check module metadata
    if (moduleNotificationTypes.has(rawType)) {
      return moduleNotificationTypes.get(rawType)!;
    }
    
    // Fallback to legacy mapping
    if (LEGACY_TYPE_MAPPING[rawType]) {
      return LEGACY_TYPE_MAPPING[rawType];
    }
    
    // Try to infer from type prefix (e.g., "hr_*" -> "hr")
    const prefix = rawType.split('_')[0];
    if (moduleNotificationTypes.has(prefix)) {
      return moduleNotificationTypes.get(prefix)!;
    }
    
    // Default to system
    return 'system';
  };

  // Load notifications from API
  useEffect(() => {
    if (!mounted || status === "loading") return;

    const loadNotifications = async () => {
      try {
        setLoading(true);
        
        if (viewMode === 'grouped') {
          const response = await getGroupedNotifications(limit);
          setGroups(response.groups);
        } else {
          const response = await getNotifications({
            page: 1,
            limit: limit,
            sortBy: 'createdAt',
            sortOrder: 'desc',
            showArchived: showArchived
          });
          setNotifications(response.notifications);
          setHasMore(response.notifications.length === limit);
          setPage(1);
        }
      } catch (error) {
        console.error('Failed to load notifications:', error);
        // Fallback to mock data if API fails
        setNotifications([
          {
            id: '1',
            type: 'mentions',
            title: 'John Doe mentioned you in "Project Discussion"',
            body: 'Hey @andrew, can you review the latest design files?',
            read: false,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            deleted: false,
            data: {
              conversationId: 'conv1',
              action: 'mention'
            }
          },
          {
            id: '2',
            type: 'drive',
            title: 'Sarah shared a file with you',
            body: 'Project_Design_v2.fig has been shared with you',
            read: false,
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            deleted: false,
            data: {
              fileId: 'file1',
              action: 'shared'
            }
          },
          {
            id: '3',
            type: 'business',
            title: 'You\'ve been invited to join "TechCorp"',
            body: 'You have been invited to join TechCorp as a member',
            read: true,
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            deleted: false,
            data: {
              businessId: 'business1',
              action: 'invitation'
            }
          },
          {
            id: '4',
            type: 'chat',
            title: 'New message in "Team Chat"',
            body: 'Alice: Great work on the latest update!',
            read: false,
            createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            deleted: false,
            data: {
              conversationId: 'conv2',
              action: 'message'
            }
          },
          {
            id: '5',
            type: 'system',
            title: 'System maintenance scheduled',
            body: 'Scheduled maintenance on Sunday, 2:00 AM - 4:00 AM EST',
            read: true,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            deleted: false,
            data: {
              action: 'maintenance'
            }
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [mounted, status, viewMode, showArchived]);

  // Listen for real-time notification updates
  useEffect(() => {
    if (!mounted) return;

    const handleNewNotification = (newNotification: Notification) => {
      if (viewMode === 'grouped') {
        // Reload groups when new notification arrives
        getGroupedNotifications(limit).then(response => {
          setGroups(response.groups);
        }).catch(console.error);
      } else {
        // Add new notification to the top of the list
        setNotifications(prev => [newNotification, ...prev]);
      }
    };

    const handleNotificationUpdate = (data: { id: string; read?: boolean; deleted?: boolean }) => {
      if (viewMode === 'grouped') {
        // Reload groups when notification is updated
        getGroupedNotifications(limit).then(response => {
          setGroups(response.groups);
        }).catch(console.error);
      } else {
        // Update notification read status
        setNotifications(prev => 
          prev.map(n => 
            n.id === data.id ? { ...n, read: data.read ?? n.read } : n
          )
        );
      }
    };

    const handleNotificationDelete = (data: { id: string }) => {
      if (viewMode === 'grouped') {
        // Reload groups when notification is deleted
        getGroupedNotifications(limit).then(response => {
          setGroups(response.groups);
        }).catch(console.error);
      } else {
        // Remove deleted notification
        setNotifications(prev => 
          prev.filter(n => n.id !== data.id)
        );
      }
    };

    notificationSocket.onNotification(handleNewNotification);
    notificationSocket.onNotificationUpdate(handleNotificationUpdate);
    notificationSocket.onNotificationDelete(handleNotificationDelete);

    // Cleanup
    return () => {
      // Note: notificationSocket might not have cleanup methods
      // This is fine - the socket service handles cleanup internally
    };
  }, [notificationSocket, viewMode, mounted, limit]);

  // Build categories dynamically from module metadata (show all, even with 0 notifications)
  const categories: NotificationCategory[] = useMemo(() => {
    // Start with "All" category
    let allCount = 0;
    let allUnreadCount = 0;
    
    if (viewMode === 'grouped') {
      allCount = groups.reduce((sum, g) => sum + g.count, 0);
      allUnreadCount = groups.reduce((sum, g) => sum + (g.isRead ? 0 : g.count), 0);
    } else {
      allCount = notifications.length;
      allUnreadCount = notifications.filter(n => !n.read).length;
    }
    
    const categoryList: NotificationCategory[] = [
      { 
        id: 'all', 
        label: 'All', 
        icon: Bell, 
        count: allCount, 
        unreadCount: allUnreadCount 
      }
    ];

    // Get all categories from module metadata (not just ones with notifications)
    const categoriesToShow = allCategories.size > 0 
      ? Array.from(allCategories).sort()
      : // Fallback: get categories from existing notifications if metadata not loaded yet
        Array.from(new Set(
          viewMode === 'grouped' 
            ? groups.map(g => getNormalizedType(g.type))
            : notifications.map(n => getNormalizedType(n.type))
        )).sort();

    // Add all categories, even if they have 0 notifications
    for (const categoryId of categoriesToShow) {
      const label = categoryLabels.get(categoryId) || categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
      const Icon = CATEGORY_ICONS[categoryId] || Bell;

      let count = 0;
      let unreadCount = 0;
      
      if (viewMode === 'grouped') {
        const categoryGroups = groups.filter(g => getNormalizedType(g.type) === categoryId);
        count = categoryGroups.reduce((sum, g) => sum + g.count, 0);
        unreadCount = categoryGroups.reduce((sum, g) => sum + (g.isRead ? 0 : g.count), 0);
      } else {
        const categoryNotifications = notifications.filter(n => getNormalizedType(n.type) === categoryId);
        count = categoryNotifications.length;
        unreadCount = categoryNotifications.filter(n => !n.read).length;
      }

      categoryList.push({
        id: categoryId,
        label,
        icon: Icon,
        count,
        unreadCount
      });
    }

    // Always include system category if not already present
    if (!categoriesToShow.includes('system')) {
      let systemCount = 0;
      let systemUnreadCount = 0;
      
      if (viewMode === 'grouped') {
        const systemGroups = groups.filter(g => getNormalizedType(g.type) === 'system');
        systemCount = systemGroups.reduce((sum, g) => sum + g.count, 0);
        systemUnreadCount = systemGroups.reduce((sum, g) => sum + (g.isRead ? 0 : g.count), 0);
      } else {
        const systemNotifications = notifications.filter(n => getNormalizedType(n.type) === 'system');
        systemCount = systemNotifications.length;
        systemUnreadCount = systemNotifications.filter(n => !n.read).length;
      }
      
      categoryList.push({
        id: 'system',
        label: 'System',
        icon: AlertCircle,
        count: systemCount,
        unreadCount: systemUnreadCount
      });
    }

    return categoryList;
  }, [notifications, groups, viewMode, categoryLabels, allCategories]);

  // Handle quick actions
  const handleQuickAction = async (notification: Notification, action: string) => {
    try {
      switch (action) {
        case 'view':
          // Navigate based on notification data
          if ((notification.data as any)?.fileId) {
            router.push(`/drive/shared?file=${(notification.data as any)?.fileId}`);
          } else if ((notification.data as any)?.conversationId) {
            router.push(`/chat?conversation=${(notification.data as any)?.conversationId}`);
          } else if ((notification.data as any)?.businessId) {
            router.push(`/business/${(notification.data as any)?.businessId}`);
          }
          await handleMarkAsRead(notification.id);
          break;
        case 'approve':
          // Handle approval action
          if ((notification.data as any)?.approvalId) {
            // Call approval endpoint
            const response = await fetch(`/api/ai/approvals/${(notification.data as any)?.approvalId}/respond`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ response: 'approve' })
            });
            if (response.ok) {
              await handleMarkAsRead(notification.id);
              setNotifications(prev => prev.filter(n => n.id !== notification.id));
            }
          }
          break;
        case 'reject':
          // Handle rejection action
          if ((notification.data as any)?.approvalId) {
            const response = await fetch(`/api/ai/approvals/${(notification.data as any)?.approvalId}/respond`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ response: 'reject' })
            });
            if (response.ok) {
              await handleMarkAsRead(notification.id);
              setNotifications(prev => prev.filter(n => n.id !== notification.id));
            }
          }
          break;
        case 'reply':
          // Navigate to reply
          if ((notification.data as any)?.conversationId) {
            router.push(`/chat?conversation=${(notification.data as any)?.conversationId}&reply=true`);
          }
          break;
        default:
          console.log('Unknown action:', action);
      }
    } catch (error) {
      console.error('Error handling quick action:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // j/k navigation
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const items = viewMode === 'grouped' ? filteredGroups : filteredNotifications;
        if (items.length === 0) return;

        let newIndex = focusedIndex;
        if (e.key === 'j') {
          newIndex = focusedIndex < items.length - 1 ? focusedIndex + 1 : 0;
        } else {
          newIndex = focusedIndex > 0 ? focusedIndex - 1 : items.length - 1;
        }
        setFocusedIndex(newIndex);

        // Scroll into view
        const element = document.querySelector(`[data-notification-index="${newIndex}"]`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Space to mark as read
      if (e.key === ' ' && focusedIndex >= 0) {
        e.preventDefault();
        const items = viewMode === 'grouped' ? filteredGroups : filteredNotifications;
        if (items.length > focusedIndex) {
          const item = items[focusedIndex];
          if (viewMode === 'grouped') {
            markGroupAsRead((item as NotificationGroup).id);
          } else {
            handleMarkAsRead((item as Notification).id);
          }
        }
      }

      // Enter to open
      if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        const items = viewMode === 'grouped' ? filteredGroups : filteredNotifications;
        if (items.length > focusedIndex) {
          const item = items[focusedIndex];
          if (viewMode === 'list') {
            const notification = item as Notification;
            if ((notification.data as any)?.fileId) {
              router.push(`/drive/shared?file=${(notification.data as any)?.fileId}`);
            } else if ((notification.data as any)?.conversationId) {
              router.push(`/chat?conversation=${(notification.data as any)?.conversationId}`);
            }
          }
        }
      }

      // Escape to exit selection mode
      if (e.key === 'Escape' && selectionMode) {
        setSelectionMode(false);
        setSelectedNotifications(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, viewMode, filteredGroups, filteredNotifications, selectionMode]);

  // Calculate priority for notification based on module metadata
  const getNotificationPriority = (notification: Notification): 'low' | 'normal' | 'high' | 'urgent' => {
    // Use stored priority if available
    if (notification.priority) {
      return notification.priority;
    }
    
    // Get priority from module metadata
    for (const module of moduleMetadata) {
      for (const notificationType of module.notificationTypes) {
        if (notificationType.type === notification.type && notificationType.priority) {
          return notificationType.priority;
        }
      }
    }
    
    // Fallback to category-based priority
    const category = getNormalizedType(notification.type);
    if (category === 'mentions' || category === 'system') {
      return 'high';
    }
    if (category === 'chat' || category === 'drive') {
      return 'normal';
    }
    
    return 'normal';
  };

  const filteredNotifications = notifications.filter(notification => {
    // Category filter
    if (selectedCategory !== 'all' && getNormalizedType(notification.type) !== selectedCategory) {
      return false;
    }
    
    // Priority filter
    if (priorityFilter !== 'all') {
      const priority = getNotificationPriority(notification);
      if (priority !== priorityFilter) {
        return false;
      }
    }
    
    // Read/unread filter
    if (!showRead && notification.read) {
      return false;
    }
    
    // Search filter
    if (searchQuery && !notification.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !notification.body?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Time range filter
    if (timeRange !== 'all') {
      const notificationDate = new Date(notification.createdAt);
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (timeRange === 'today' && diffInDays > 0) {
        return false;
      }
      if (timeRange === 'week' && diffInDays > 7) {
        return false;
      }
      if (timeRange === 'month' && diffInDays > 30) {
        return false;
      }
    }
    
    // Filter out snoozed notifications
    if (notification.snoozedUntil) {
      const snoozeTime = new Date(notification.snoozedUntil);
      if (snoozeTime > new Date()) {
        return false;
      }
    }
    
    return true;
  });

  const filteredGroups = useMemo(() => {
    return groups.filter(group => {
      // Category filter
      if (selectedCategory !== 'all' && getNormalizedType(group.type) !== selectedCategory) {
        return false;
      }
      
      // Read/unread filter
      if (!showRead && group.isRead) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const matchesTitle = group.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLatest = group.latestNotification.title.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesTitle && !matchesLatest) {
          return false;
        }
      }
      
      // Time range filter
      if (timeRange !== 'all') {
        const groupDate = new Date(group.updatedAt);
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - groupDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (timeRange === 'today' && diffInDays > 0) {
          return false;
        }
        if (timeRange === 'week' && diffInDays > 7) {
          return false;
        }
        if (timeRange === 'month' && diffInDays > 30) {
          return false;
        }
      }
      
      return true;
    });
  }, [groups, selectedCategory, showRead, searchQuery, timeRange]);

  const getNotificationIcon = (type: string) => {
    const category = getNormalizedType(type);
    return CATEGORY_ICONS[category] || Bell;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleArchive = async (notificationId: string) => {
    try {
      await archiveNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to archive notification:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleSelectNotification = (id: string) => {
    setSelectedNotifications(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedNotifications.size === 0) return;
    try {
      await archiveMultipleNotifications(Array.from(selectedNotifications));
      setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)));
      setSelectedNotifications(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('Failed to archive notifications:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.size === 0) return;
    try {
      await deleteMultipleNotifications(Array.from(selectedNotifications));
      setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)));
      setSelectedNotifications(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('Failed to delete notifications:', error);
    }
  };

  const handleBulkMarkAsRead = async () => {
    if (selectedNotifications.size === 0) return;
    try {
      const ids = Array.from(selectedNotifications);
      await Promise.all(ids.map(id => markAsRead(id)));
      setNotifications(prev => 
        prev.map(n => selectedNotifications.has(n.id) ? { ...n, read: true } : n)
      );
      setSelectedNotifications(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  const loadMore = async () => {
    try {
      const response = await getNotifications({
        page: page + 1,
        limit: limit,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      setNotifications(prev => [...prev, ...response.notifications]);
      setHasMore(response.notifications.length === limit);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load more notifications:', error);
    }
  };


  if (!mounted || status === "loading") return null;
  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bell className="w-6 h-6 text-gray-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
              <p className="text-sm text-gray-500">
                {notifications.filter(n => !n.read).length} unread notifications
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1 border border-gray-300 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grouped'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Grouped View"
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
            
            {selectionMode ? (
              <>
                <span className="text-sm text-gray-600">
                  {selectedNotifications.size} selected
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkMarkAsRead}
                  disabled={selectedNotifications.size === 0}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark as read
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkArchive}
                  disabled={selectedNotifications.size === 0}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedNotifications.size === 0}
                >
                  Delete
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const selected = Array.from(selectedNotifications);
                    try {
                      await Promise.all(selected.map(id => snoozeNotification(id, '1d')));
                      setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)));
                      setSelectedNotifications(new Set());
                      setSelectionMode(false);
                    } catch (error) {
                      console.error('Failed to bulk snooze:', error);
                    }
                  }}
                  disabled={selectedNotifications.size === 0}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Snooze (1 day)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedNotifications(new Set());
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectionMode(true)}
                >
                  Select
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={notifications.filter(n => !n.read).length === 0}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark all as read
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => router.push('/notifications/settings')}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar - Categories */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <category.icon className="w-4 h-4" />
                  <span className="font-medium">{category.label}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {category.unreadCount > 0 && (
                    <Badge color="red" size="sm">
                      {category.unreadCount}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-500">({category.count})</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content - Notification List */}
        <div className="flex-1 flex flex-col">
          {/* Search and Filters */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex flex-col space-y-4">
              {/* Top row: Search and basic filters */}
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={showRead}
                      onChange={(e) => setShowRead(e.target.checked)}
                      className="rounded"
                    />
                    <span>Show read</span>
                  </label>
                </div>
              </div>
              
              {/* Bottom row: Time range and Priority filters */}
              <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">Time Range:</span>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                      <input 
                        type="radio" 
                        name="timeRange" 
                        value="today" 
                        checked={timeRange === 'today'}
                        onChange={(e) => setTimeRange(e.target.value as 'today' | 'week' | 'month' | 'all')}
                        className="rounded" 
                      />
                      <span>Today</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                      <input 
                        type="radio" 
                        name="timeRange" 
                        value="week" 
                        checked={timeRange === 'week'}
                        onChange={(e) => setTimeRange(e.target.value as 'today' | 'week' | 'month' | 'all')}
                        className="rounded" 
                      />
                      <span>This week</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                      <input 
                        type="radio" 
                        name="timeRange" 
                        value="month" 
                        checked={timeRange === 'month'}
                        onChange={(e) => setTimeRange(e.target.value as 'today' | 'week' | 'month' | 'all')}
                        className="rounded" 
                      />
                      <span>This month</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                      <input 
                        type="radio" 
                        name="timeRange" 
                        value="all" 
                        checked={timeRange === 'all'}
                        onChange={(e) => setTimeRange(e.target.value as 'today' | 'week' | 'month' | 'all')}
                        className="rounded" 
                      />
                      <span>All time</span>
                    </label>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">Priority:</span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as 'all' | 'urgent' | 'high' | 'normal' | 'low')}
                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Notification List or Groups */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : viewMode === 'grouped' ? (
              // Grouped View
              filteredGroups.length === 0 ? (
                <EmptyState 
                  category={selectedCategory}
                  hasFilters={selectedCategory !== 'all' || priorityFilter !== 'all' || searchQuery !== '' || timeRange !== 'all'}
                />
              ) : (
                <div className="space-y-3">
                  {filteredGroups.map((group) => {
                    const Icon = getNotificationIcon(getNormalizedType(group.type));
                    const isExpanded = expandedGroups.has(group.id);
                    const groupNotifications = isExpanded ? group.notifications : [group.latestNotification];
                    
                    return (
                      <div
                        key={group.id}
                        className={`bg-white border rounded-lg transition-all hover:shadow-md ${
                          group.isRead ? 'opacity-75' : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        {/* Group Header */}
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => {
                            setExpandedGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(group.id)) {
                                next.delete(group.id);
                              } else {
                                next.add(group.id);
                              }
                              return next;
                            });
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <Icon className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <h3 className={`font-medium ${
                                    group.isRead ? 'text-gray-700' : 'text-gray-900'
                                  }`}>
                                    {group.title}
                                  </h3>
                                  {!group.isRead && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  )}
                                  {group.count > 1 && (
                                    <Badge color="blue" size="sm">
                                      {group.count}
                                    </Badge>
                                  )}
                                  <Badge 
                                    color={group.priority === 'high' ? 'red' : group.priority === 'medium' ? 'yellow' : 'gray'}
                                    size="sm"
                                  >
                                    {group.priority}
                                  </Badge>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">
                                    {getTimeAgo(group.updatedAt)}
                                  </span>
                                  <ChevronRight 
                                    className={`w-4 h-4 text-gray-400 transition-transform ${
                                      isExpanded ? 'transform rotate-90' : ''
                                    }`}
                                  />
                                </div>
                              </div>
                              {group.latestNotification.title && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {group.latestNotification.title}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Group Actions */}
                        <div className="px-4 pb-3 flex items-center space-x-2 border-t border-gray-200 pt-3">
                          {!group.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await markGroupAsRead(group.id);
                                  setGroups(prev => prev.map(g => 
                                    g.id === group.id ? { ...g, isRead: true } : g
                                  ));
                                } catch (error) {
                                  console.error('Failed to mark group as read:', error);
                                }
                              }}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Mark as read
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ids = group.notifications.map(n => n.id);
                              try {
                                await archiveMultipleNotifications(ids);
                                setGroups(prev => prev.filter(g => g.id !== group.id));
                              } catch (error) {
                                console.error('Failed to archive group:', error);
                              }
                            }}
                          >
                            <Archive className="w-3 h-3 mr-1" />
                            Archive
                          </Button>
                        </div>
                        
                        {/* Expanded Notifications */}
                        {isExpanded && groupNotifications.length > 1 && (
                          <div className="border-t border-gray-200 bg-gray-50">
                            {groupNotifications.slice(1).map((notification) => (
                              <div
                                key={notification.id}
                                className="p-3 border-b border-gray-200 last:border-b-0"
                              >
                                <p className="text-sm text-gray-700">{notification.title}</p>
                                <span className="text-xs text-gray-500">
                                  {getTimeAgo(notification.createdAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : filteredNotifications.length === 0 ? (
              <EmptyState 
                category={selectedCategory}
                hasFilters={selectedCategory !== 'all' || priorityFilter !== 'all' || searchQuery !== '' || timeRange !== 'all'}
              />
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => {
                  const Icon = getNotificationIcon(getNormalizedType(notification.type));
                  const isSelected = selectedNotifications.has(notification.id);
                  return (
                    <div
                      key={notification.id}
                      className={`bg-white border rounded-lg px-4 pt-4 pb-2 transition-all hover:shadow-md ${
                        notification.read ? 'opacity-75' : 'border-blue-200 bg-blue-50'
                      } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${
                        selectionMode ? 'cursor-default' : 'cursor-pointer'
                      }`}
                      onClick={() => {
                        if (selectionMode) {
                          handleSelectNotification(notification.id);
                        } else {
                          // Auto-navigate to relevant resource if clickable
                          if ((notification.data as any)?.fileId) {
                            router.push(`/drive/shared?file=${(notification.data as any)?.fileId}`);
                            handleMarkAsRead(notification.id);
                          } else if ((notification.data as any)?.folderId) {
                            router.push(`/drive/shared?folder=${(notification.data as any)?.folderId}`);
                            handleMarkAsRead(notification.id);
                          } else if ((notification.data as any)?.conversationId) {
                            router.push(`/chat?conversation=${(notification.data as any)?.conversationId}`);
                            handleMarkAsRead(notification.id);
                          }
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        {selectionMode && (
                          <div className="flex-shrink-0 pt-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectNotification(notification.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded"
                            />
                          </div>
                        )}
                        <div className="flex-shrink-0">
                          <Avatar
                            src={notification.user?.name ? undefined : undefined}
                            nameOrEmail={notification.user?.name || notification.user?.email || 'System'}
                            size={40}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h3 className={`font-medium truncate ${
                                  notification.read ? 'text-gray-700' : 'text-gray-900'
                                }`}>
                                  {notification.title}
                                </h3>
                                {notification.body && (
                                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.body}</p>
                                )}
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                              )}
                              {notification.priority && (
                                <Badge 
                                  color={
                                    notification.priority === 'urgent' ? 'red' :
                                    notification.priority === 'high' ? 'orange' :
                                    notification.priority === 'normal' ? 'blue' : 'gray'
                                  }
                                  size="sm"
                                  className="flex-shrink-0"
                                >
                                  {notification.priority}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {getTimeAgo(notification.createdAt)}
                              </span>
                              {!selectionMode && (
                                <NotificationActionsMenu
                                  notification={notification}
                                  onArchive={() => handleArchive(notification.id)}
                                  onDelete={() => handleDelete(notification.id)}
                                  onMarkAsRead={() => handleMarkAsRead(notification.id)}
                                  onSnooze={async (duration) => {
                                    try {
                                      await snoozeNotification(notification.id, duration);
                                      setNotifications(prev => prev.filter(n => n.id !== notification.id));
                                    } catch (error) {
                                      console.error('Failed to snooze notification:', error);
                                    }
                                  }}
                                  onUnsnooze={async () => {
                                    try {
                                      await unsnoozeNotification(notification.id);
                                      // Reload notifications to show unsnoozed one
                                      const response = await getNotifications({
                                        page: 1,
                                        limit: limit,
                                        sortBy: 'createdAt',
                                        sortOrder: 'desc'
                                      });
                                      setNotifications(response.notifications);
                                    } catch (error) {
                                      console.error('Failed to unsnooze notification:', error);
                                    }
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          {/* Quick Actions */}
                          {!selectionMode && (
                            <NotificationQuickActions 
                              notification={notification}
                              moduleMetadata={moduleMetadata}
                              onAction={(action) => handleQuickAction(notification, action)}
                            />
                          )}
                          {notification.body && (
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.body}
                            </p>
                          )}
                          <div className="flex items-center space-x-2 mt-3">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="text-xs"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Mark as read
                              </Button>
                            )}
                            {Boolean((notification.data as any)?.conversationId) && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs"
                                onClick={() => {
                                  router.push(`/chat?conversation=${(notification.data as any)?.conversationId}`);
                                }}
                              >
                                <ChevronRight className="w-3 h-3 mr-1" />
                                Go to conversation
                              </Button>
                            )}
                            {Boolean((notification.data as any)?.fileId) && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs"
                                onClick={() => {
                                  router.push(`/drive/shared?file=${(notification.data as any)?.fileId}`);
                                  handleMarkAsRead(notification.id);
                                }}
                              >
                                <Folder className="w-3 h-3 mr-1" />
                                Open file
                              </Button>
                            )}
                            {Boolean((notification.data as any)?.folderId) && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs"
                                onClick={() => {
                                  router.push(`/drive/shared?folder=${(notification.data as any)?.folderId}`);
                                  handleMarkAsRead(notification.id);
                                }}
                              >
                                <Folder className="w-3 h-3 mr-1" />
                                Open folder
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Load More Button */}
            {!loading && hasMore && filteredNotifications.length > 0 && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="secondary"
                  onClick={loadMore}
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Notification Actions Menu Component
interface NotificationActionsMenuProps {
  notification: Notification;
  onArchive: () => void;
  onDelete: () => void;
  onMarkAsRead: () => void;
  onSnooze?: (duration: '1h' | '1d' | '1w') => void;
  onUnsnooze?: () => void;
}

function NotificationActionsMenu({ notification, onArchive, onDelete, onMarkAsRead, onSnooze, onUnsnooze }: NotificationActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  
  const isSnoozed = notification.snoozedUntil && new Date(notification.snoozedUntil) > new Date();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="p-1 hover:bg-gray-100 rounded"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <MoreHorizontal className="w-4 h-4 text-gray-400" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="py-1">
            {!notification.read && (
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead();
                  setIsOpen(false);
                }}
              >
                <Check className="w-4 h-4" />
                <span>Mark as read</span>
              </button>
            )}
            {isSnoozed ? (
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnsnooze?.();
                  setIsOpen(false);
                }}
              >
                <Clock className="w-4 h-4" />
                <span>Unsnooze</span>
              </button>
            ) : (
              <>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSnoozeOptions(!showSnoozeOptions);
                  }}
                >
                  <Clock className="w-4 h-4" />
                  <span>Snooze</span>
                  <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${showSnoozeOptions ? 'rotate-90' : ''}`} />
                </button>
                {showSnoozeOptions && (
                  <div className="pl-8 border-t border-gray-100">
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSnooze?.('1h');
                        setIsOpen(false);
                      }}
                    >
                      1 hour
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSnooze?.('1d');
                        setIsOpen(false);
                      }}
                    >
                      1 day
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSnooze?.('1w');
                        setIsOpen(false);
                      }}
                    >
                      1 week
                    </button>
                  </div>
                )}
              </>
            )}
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
                setIsOpen(false);
              }}
            >
              <Archive className="w-4 h-4" />
              <span>Archive</span>
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center space-x-2"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this notification?')) {
                  onDelete();
                }
                setIsOpen(false);
              }}
            >
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick Actions Component
interface NotificationQuickActionsProps {
  notification: Notification;
  moduleMetadata: ModuleNotificationMetadata[];
  onAction: (action: string) => void;
}

function NotificationQuickActions({ notification, moduleMetadata, onAction }: NotificationQuickActionsProps) {
  // Find notification type metadata
  let notificationType: ModuleNotificationType | null = null;
  for (const module of moduleMetadata) {
    const found = module.notificationTypes.find(nt => nt.type === notification.type);
    if (found) {
      notificationType = found;
      break;
    }
  }

  // Determine actions based on notification type and data
  const getActions = () => {
    const actions: Array<{ id: string; label: string; icon: React.ComponentType<any>; variant?: 'primary' | 'secondary' }> = [];
    const data = notification.data as any;

    // Check if notification requires action
    if (notificationType?.requiresAction) {
      if (data?.approvalId) {
        actions.push(
          { id: 'approve', label: 'Approve', icon: Check, variant: 'primary' },
          { id: 'reject', label: 'Reject', icon: AlertCircle, variant: 'secondary' }
        );
      }
    }

    // Add view action for navigable notifications
    if (data?.fileId || data?.conversationId || data?.businessId) {
      actions.push({ id: 'view', label: 'View', icon: ChevronRight });
    }

    // Add reply action for chat notifications
    if (notification.type.startsWith('chat_') && data?.conversationId) {
      actions.push({ id: 'reply', label: 'Reply', icon: MessageSquare });
    }

    return actions;
  };

  const actions = getActions();
  if (actions.length === 0) return null;

  return (
    <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-100">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={(e) => {
              e.stopPropagation();
              onAction(action.id);
            }}
            className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
              action.variant === 'primary'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : action.variant === 'secondary'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-3 h-3" />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Empty State Component
interface EmptyStateProps {
  category: string;
  hasFilters: boolean;
}

function EmptyState({ category, hasFilters }: EmptyStateProps) {
  const categoryMessages: Record<string, { icon: React.ComponentType<any>; title: string; message: string }> = {
    chat: {
      icon: MessageSquare,
      title: 'No chat notifications',
      message: 'You have no new messages or mentions. Start a conversation to see notifications here!'
    },
    drive: {
      icon: Folder,
      title: 'No file notifications',
      message: 'No files have been shared with you recently. Share files to receive notifications!'
    },
    mentions: {
      icon: AtSign,
      title: 'No mentions',
      message: 'No one has mentioned you recently. You\'ll see notifications here when someone tags you!'
    },
    business: {
      icon: Building,
      title: 'No business notifications',
      message: 'No business-related notifications. Invitations and updates will appear here!'
    },
    hr: {
      icon: UserCheck,
      title: 'No HR notifications',
      message: 'No HR updates or tasks. Onboarding tasks and time-off requests will appear here!'
    },
    calendar: {
      icon: Clock,
      title: 'No calendar notifications',
      message: 'No upcoming events or reminders. Create events to receive notifications!'
    },
    system: {
      icon: AlertCircle,
      title: 'No system notifications',
      message: 'No system updates or alerts. Important announcements will appear here!'
    },
    all: {
      icon: Bell,
      title: 'No notifications',
      message: 'You\'re all caught up!'
    }
  };

  const config = categoryMessages[category] || categoryMessages.all;
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
      <Icon className="w-12 h-12 mb-4 opacity-50" />
      <p className="text-lg font-medium text-gray-700">{config.title}</p>
      <p className="text-sm text-gray-600 mt-1">{config.message}</p>
      {hasFilters && (
        <p className="text-xs text-gray-500 mt-2">Try adjusting your filters to see more notifications</p>
      )}
    </div>
  );
} 