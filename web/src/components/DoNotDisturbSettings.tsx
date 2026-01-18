'use client';

import React, { useState, useEffect } from 'react';
import { Moon, BellOff } from 'lucide-react';
import { Switch } from 'shared/components';
import { getDoNotDisturb, saveDoNotDisturb } from '../api/notifications';
import { toast } from 'react-hot-toast';

export default function DoNotDisturbSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await getDoNotDisturb();
      setEnabled(response.enabled);
    } catch (error) {
      console.error('Error loading do not disturb status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    try {
      setSaving(true);
      await saveDoNotDisturb(checked);
      setEnabled(checked);
      toast.success(
        checked 
          ? 'Do Not Disturb enabled - all notifications are silenced' 
          : 'Do Not Disturb disabled - notifications are active'
      );
    } catch (error) {
      console.error('Error saving do not disturb status:', error);
      toast.error('Failed to update Do Not Disturb status');
      // Revert on error
      setEnabled(!checked);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-3">
        {enabled ? (
          <BellOff className="w-5 h-5 text-red-500" />
        ) : (
          <Moon className="w-5 h-5 text-gray-600" />
        )}
        <div>
          <h3 className="text-base font-medium text-gray-900">Do Not Disturb</h3>
          <p className="text-sm text-gray-600">
            {enabled 
              ? 'All notifications are currently silenced' 
              : 'Temporarily silence all notifications'}
          </p>
        </div>
      </div>
      <Switch
        checked={enabled}
        onChange={handleToggle}
        disabled={saving}
      />
    </div>
  );
}
