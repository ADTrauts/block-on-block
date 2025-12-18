'use client';

import React, { useState, useEffect } from 'react';
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
  Filter,
  Search,
  ChevronRight
} from 'lucide-react';
import { Avatar, Button, Badge } from 'shared/components';
import { useSafeSession } from '../../lib/useSafeSession';
import { useRouter } from 'next/navigation';
import { getNotifications, markAsRead, markAllAsRead, type Notification } from '../../api/notifications';
import { useNotificationSocket } from '../../lib/notificationSocket';



interface NotificationCategory {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  count: number;
  unreadCount: number;
}

export default function NotificationsPage() {
  const { session, status, mounted } = useSafeSession();
  const router = useRouter();
  const notificationSocket = useNotificationSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showRead, setShowRead] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  const getNormalizedType = (rawType: string): 'chat' | 'drive' | 'members' | 'business' | 'system' | 'mentions' => {
    switch (rawType) {
      case 'chat_message':
      case 'chat_reaction':
      case 'chat':
        return 'chat';
      case 'chat_mention':
      case 'mentions':
        return 'mentions';
      case 'drive_shared':
      case 'drive_permission':
      case 'drive':
        return 'drive';
      case 'business_invitation':
      case 'business':
        return 'business';
      case 'member_request':
      case 'members':
        return 'members';
      case 'system_alert':
      case 'system':
        return 'system';
      default:
        return 'system';
    }
  };

  // Load notifications from API
  useEffect(() => {
    if (!mounted || status === "loading") return;

    const loadNotifications = async () => {
      try {
        setLoading(true);
        const response = await getNotifications({
          page: 1,
          limit: 50,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        });
        setNotifications(response.notifications);
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
  }, [mounted, status]);

  // Listen for real-time notification updates
  useEffect(() => {
    notificationSocket.onNotification((newNotification) => {
      // Add new notification to the top of the list
      setNotifications(prev => [newNotification as Notification, ...prev]);
    });

    notificationSocket.onNotificationUpdate((data) => {
      // Update notification read status
      setNotifications(prev => 
        prev.map(n => 
          n.id === data.id ? { ...n, read: data.read } : n
        )
      );
    });

    notificationSocket.onNotificationDelete((data) => {
      // Remove deleted notification
      setNotifications(prev => 
        prev.filter(n => n.id !== data.id)
      );
    });
  }, [notificationSocket]);

  const categories: NotificationCategory[] = [
    { id: 'all', label: 'All', icon: Bell, count: notifications.length, unreadCount: notifications.filter(n => !n.read).length },
    { id: 'mentions', label: 'Mentions', icon: AtSign, count: notifications.filter(n => getNormalizedType(n.type) === 'mentions').length, unreadCount: notifications.filter(n => getNormalizedType(n.type) === 'mentions' && !n.read).length },
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: notifications.filter(n => getNormalizedType(n.type) === 'chat').length, unreadCount: notifications.filter(n => getNormalizedType(n.type) === 'chat' && !n.read).length },
    { id: 'drive', label: 'Drive', icon: Folder, count: notifications.filter(n => getNormalizedType(n.type) === 'drive').length, unreadCount: notifications.filter(n => getNormalizedType(n.type) === 'drive' && !n.read).length },
    { id: 'members', label: 'Members', icon: Users, count: notifications.filter(n => getNormalizedType(n.type) === 'members').length, unreadCount: notifications.filter(n => getNormalizedType(n.type) === 'members' && !n.read).length },
    { id: 'business', label: 'Business', icon: Building, count: notifications.filter(n => getNormalizedType(n.type) === 'business').length, unreadCount: notifications.filter(n => getNormalizedType(n.type) === 'business' && !n.read).length },
    { id: 'system', label: 'System', icon: AlertCircle, count: notifications.filter(n => getNormalizedType(n.type) === 'system').length, unreadCount: notifications.filter(n => getNormalizedType(n.type) === 'system' && !n.read).length },
  ];

  const filteredNotifications = notifications.filter(notification => {
    // Category filter
    if (selectedCategory !== 'all' && getNormalizedType(notification.type) !== selectedCategory) {
      return false;
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
    
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'chat': return MessageSquare;
      case 'drive': return Folder;
      case 'members': return Users;
      case 'business': return Building;
      case 'system': return AlertCircle;
      case 'mentions': return AtSign;
      default: return Bell;
    }
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

  const handleSelectNotification = (notificationId: string) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId) 
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const handleSelectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map(n => n.id));
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
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showRead}
                    onChange={(e) => setShowRead(e.target.checked)}
                    className="rounded"
                  />
                  <span>Show read</span>
                </label>
                <Button variant="secondary" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Bell className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No notifications</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => {
                  const Icon = getNotificationIcon(getNormalizedType(notification.type));
                  return (
                    <div
                      key={notification.id}
                      className={`bg-white border rounded-lg p-4 transition-all hover:shadow-md cursor-pointer ${
                        notification.read ? 'opacity-75' : 'border-blue-200 bg-blue-50'
                      }`}
                      onClick={() => {
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
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <Avatar
                            src={notification.user?.name ? undefined : undefined}
                            nameOrEmail={notification.user?.name || notification.user?.email || 'System'}
                            size={40}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              <Icon className="w-4 h-4 text-gray-500" />
                              <h3 className={`font-medium ${
                                notification.read ? 'text-gray-700' : 'text-gray-900'
                              }`}>
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">
                                {getTimeAgo(notification.createdAt)}
                              </span>
                              <button className="p-1 hover:bg-gray-100 rounded">
                                <MoreHorizontal className="w-4 h-4 text-gray-400" />
                              </button>
                            </div>
                          </div>
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
                            <Button variant="ghost" size="sm" className="text-xs">
                              <Archive className="w-3 h-3 mr-1" />
                              Archive
                            </Button>
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
          </div>
        </div>

        {/* Right Sidebar - Quick Actions */}
        <div className="w-80 bg-white border-l border-gray-200 p-4">
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={handleMarkAllAsRead}
                  disabled={notifications.filter(n => !n.read).length === 0}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark all as read
                </Button>
                <Button variant="secondary" className="w-full justify-start">
                  <Archive className="w-4 h-4 mr-2" />
                  Archive all read
                </Button>
                <Button variant="secondary" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Notification settings
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-3">Filters</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span>Show read notifications</span>
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span>Show system notifications</span>
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span>Show business notifications</span>
                </label>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-3">Time Range</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm">
                  <input type="radio" name="timeRange" className="rounded" defaultChecked />
                  <span>Today</span>
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input type="radio" name="timeRange" className="rounded" />
                  <span>This week</span>
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input type="radio" name="timeRange" className="rounded" />
                  <span>This month</span>
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input type="radio" name="timeRange" className="rounded" />
                  <span>All time</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 