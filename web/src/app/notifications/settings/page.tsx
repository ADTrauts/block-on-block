'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Bell, 
  Settings, 
  MessageSquare,
  Folder,
  Users,
  Building,
  AlertCircle,
  AtSign,
  Save,
  ArrowLeft,
  Mail,
  Clock,
  UserCheck,
  Check
} from 'lucide-react';
import { Button, Switch } from 'shared/components';
import { useSafeSession } from '../../../lib/useSafeSession';
import { useRouter } from 'next/navigation';
import { getModuleNotificationTypes, getNotificationPreferences, saveNotificationPreferences } from '../../../api/notifications';
import PushNotificationSettings from '../../../components/PushNotificationSettings';
import EmailNotificationSettings from '../../../components/EmailNotificationSettings';
import DoNotDisturbSettings from '../../../components/DoNotDisturbSettings';
import QuietHoursSettings from '../../../components/QuietHoursSettings';
import type { ModuleNotificationMetadata } from 'shared/types/module-notifications';
import { toast } from 'react-hot-toast';

interface NotificationPreference {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  inApp: boolean;
  email: boolean;
  push: boolean;
  moduleId?: string;
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

export default function NotificationSettingsPage() {
  const { session, status, mounted } = useSafeSession();
  const router = useRouter();
  const [moduleMetadata, setModuleMetadata] = useState<ModuleNotificationMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [saving, setSaving] = useState(false);

  // Load notification preferences from module metadata and user preferences
  useEffect(() => {
    if (!mounted || status === "loading") return;

    const loadPreferences = async () => {
      try {
        setLoading(true);
        
        // Load module types and user preferences in parallel
        const [moduleTypesResponse, userPreferencesResponse] = await Promise.all([
          getModuleNotificationTypes(),
          getNotificationPreferences().catch(() => ({ preferences: {} })) // Fallback to empty if fails
        ]);
        
        setModuleMetadata(moduleTypesResponse.modules);
        const userPrefs: Record<string, any> = userPreferencesResponse.preferences || {};
        
        // Build preferences from module metadata
        const categoryMap = new Map<string, NotificationPreference>();
        
        for (const module of moduleTypesResponse.modules) {
          for (const notificationType of module.notificationTypes) {
            const categoryId = notificationType.category;
            
            if (!categoryMap.has(categoryId)) {
              const Icon = CATEGORY_ICONS[categoryId] || Bell;
              const userCategoryPrefs = userPrefs[categoryId];
              const defaultChannels = notificationType.defaultChannels;
              
              categoryMap.set(categoryId, {
                id: categoryId,
                label: module.moduleName,
                description: `Notifications from ${module.moduleName}`,
                icon: Icon,
                inApp: userCategoryPrefs?.inApp ?? defaultChannels.inApp,
                email: userCategoryPrefs?.email ?? defaultChannels.email,
                push: userCategoryPrefs?.push ?? defaultChannels.push,
                moduleId: module.moduleId
              });
            } else {
              // Update defaults if any notification type in category has channel enabled
              const existing = categoryMap.get(categoryId)!;
              const defaultChannels = notificationType.defaultChannels;
              existing.inApp = existing.inApp || defaultChannels.inApp;
              existing.email = existing.email || defaultChannels.email;
              existing.push = existing.push || defaultChannels.push;
            }
          }
        }

        // Add system category if not present
        if (!categoryMap.has('system')) {
          const systemPrefs = userPrefs.system || {};
          categoryMap.set('system', {
            id: 'system',
            label: 'System Notifications',
            description: 'Platform updates, maintenance, and security alerts',
            icon: AlertCircle,
            inApp: systemPrefs.inApp ?? true,
            email: systemPrefs.email ?? true,
            push: systemPrefs.push ?? true
          });
        }

        setPreferences(Array.from(categoryMap.values()));
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
        // Fallback to default preferences
        setPreferences([
          {
            id: 'system',
            label: 'System Notifications',
            description: 'Platform updates, maintenance, and security alerts',
            icon: AlertCircle,
            inApp: true,
            email: true,
            push: true
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [mounted, status]);

  const handleTogglePreference = (id: string, channel: 'inApp' | 'email' | 'push') => {
    setPreferences(prev => 
      prev.map(pref => 
        pref.id === id 
          ? { ...pref, [channel]: !pref[channel] }
          : pref
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Convert preferences to format expected by API
      const preferencesToSave: Record<string, { inApp: boolean; email: boolean; push: boolean }> = {};
      for (const pref of preferences) {
        preferencesToSave[pref.id] = {
          inApp: pref.inApp,
          email: pref.email,
          push: pref.push
        };
      }
      
      await saveNotificationPreferences(preferencesToSave);
      toast.success('Notification preferences saved successfully');
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Notification Settings</h1>
              <p className="text-sm text-gray-500">
                Configure how you receive notifications
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-2">Notification Channels</h2>
            <p className="text-sm text-gray-600">
              Choose how you want to receive notifications for each type of activity.
            </p>
          </div>

          {preferences.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>No notification preferences available. Install modules to configure notifications.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {preferences.map((preference) => {
              const Icon = preference.icon;
              return (
                <div key={preference.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Icon className="w-6 h-6 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-medium text-gray-900">
                          {preference.label}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {preference.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">In-app</span>
                        <Switch
                          checked={preference.inApp}
                          onChange={() => handleTogglePreference(preference.id, 'inApp')}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Email</span>
                        <Switch
                          checked={preference.email}
                          onChange={() => handleTogglePreference(preference.id, 'email')}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Push</span>
                        <Switch
                          checked={preference.push}
                          onChange={() => handleTogglePreference(preference.id, 'push')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}

          {/* Do Not Disturb Section */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <DoNotDisturbSettings />
          </div>

          {/* Quiet Hours Section */}
          <div className="p-6 border-t border-gray-200">
            <QuietHoursSettings />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3">
          <Button
            variant="secondary"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Push Notification Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Bell className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Push Notifications</h2>
            <p className="text-sm text-gray-600">
              Receive notifications even when the app is closed
            </p>
          </div>
        </div>
        
        <PushNotificationSettings />
      </div>

      {/* Email Notification Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Mail className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Email Notifications</h2>
            <p className="text-sm text-gray-600">
              Receive notifications via email for important events
            </p>
          </div>
        </div>
        
        <EmailNotificationSettings />
      </div>
    </div>
  );
} 