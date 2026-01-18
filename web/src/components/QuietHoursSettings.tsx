'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Moon, Sun } from 'lucide-react';
import { Switch, Button } from 'shared/components';
import { authenticatedApiCall } from '../lib/apiUtils';
import { toast } from 'react-hot-toast';

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

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

const DEFAULT_START_TIME = '22:00'; // 10:00 PM
const DEFAULT_END_TIME = '08:00'; // 8:00 AM

export default function QuietHoursSettings() {
  const [settings, setSettings] = useState<QuietHoursSettings>({
    enabled: false,
    days: {
      monday: { enabled: false, startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME },
      tuesday: { enabled: false, startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME },
      wednesday: { enabled: false, startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME },
      thursday: { enabled: false, startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME },
      friday: { enabled: false, startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME },
      saturday: { enabled: false, startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME },
      sunday: { enabled: false, startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME },
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await authenticatedApiCall('/api/notifications/quiet-hours', {
        method: 'GET'
      }) as { settings?: QuietHoursSettings };

      if (response.settings) {
        setSettings(response.settings);
      }
    } catch (error) {
      console.error('Error loading quiet hours settings:', error);
      // Use defaults if loading fails
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await authenticatedApiCall('/api/notifications/quiet-hours', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });

      toast.success('Quiet hours settings saved successfully');
    } catch (error) {
      console.error('Error saving quiet hours settings:', error);
      toast.error('Failed to save quiet hours settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = (dayKey: keyof typeof settings.days) => {
    setSettings(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [dayKey]: {
          ...prev.days[dayKey],
          enabled: !prev.days[dayKey].enabled
        }
      }
    }));
  };

  const handleTimeChange = (
    dayKey: keyof typeof settings.days,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setSettings(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [dayKey]: {
          ...prev.days[dayKey],
          [field]: value
        }
      }
    }));
  };

  const handleEnableAll = () => {
    setSettings(prev => ({
      ...prev,
      enabled: true,
      days: Object.keys(prev.days).reduce((acc, key) => {
        acc[key as keyof typeof prev.days] = {
          ...prev.days[key as keyof typeof prev.days],
          enabled: true
        };
        return acc;
      }, {} as typeof prev.days)
    }));
  };

  const handleDisableAll = () => {
    setSettings(prev => ({
      ...prev,
      enabled: false,
      days: Object.keys(prev.days).reduce((acc, key) => {
        acc[key as keyof typeof prev.days] = {
          ...prev.days[key as keyof typeof prev.days],
          enabled: false
        };
        return acc;
      }, {} as typeof prev.days)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <Moon className="w-5 h-5 text-gray-600" />
          <div>
            <h3 className="text-base font-medium text-gray-900">Quiet Hours</h3>
            <p className="text-sm text-gray-600">
              Automatically silence notifications during specific hours
            </p>
          </div>
        </div>
        <Switch
          checked={settings.enabled}
          onChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
        />
      </div>

      {settings.enabled && (
        <>
          {/* Quick Actions */}
          <div className="flex items-center justify-end space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEnableAll}
            >
              Enable All Days
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDisableAll}
            >
              Disable All Days
            </Button>
          </div>

          {/* Day Settings */}
          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const daySettings = settings.days[day.key];
              return (
                <div
                  key={day.key}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Switch
                        checked={daySettings.enabled}
                        onChange={() => handleToggleEnabled(day.key)}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {day.label}
                      </span>
                    </div>
                  </div>

                  {daySettings.enabled && (
                    <div className="ml-10 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Start Time
                        </label>
                        <div className="flex items-center space-x-2">
                          <Sun className="w-4 h-4 text-gray-400" />
                          <input
                            type="time"
                            value={daySettings.startTime}
                            onChange={(e) => handleTimeChange(day.key, 'startTime', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          End Time
                        </label>
                        <div className="flex items-center space-x-2">
                          <Sun className="w-4 h-4 text-gray-400" />
                          <input
                            type="time"
                            value={daySettings.endTime}
                            onChange={(e) => handleTimeChange(day.key, 'endTime', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end pt-4 border-t border-gray-200">
            <Button
              onClick={saveSettings}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Save Quiet Hours
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
