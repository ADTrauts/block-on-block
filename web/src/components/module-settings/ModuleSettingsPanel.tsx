'use client';

import React, { useState } from 'react';
import { Button } from 'shared/components';
import { Settings, Save, RotateCcw, Shield, Users, Database, Bell } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ModuleConfig,
  ModuleIntegrationConfig,
  ModuleNotificationConfig,
  ModuleSecurityConfig,
  ModuleStorageConfig,
} from './types';
import ModuleSettingsEditor from '@/components/module-settings/ModuleSettingsEditor';

export type {
  ModuleConfig,
  ModuleIntegrationConfig,
  ModuleNotificationConfig,
  ModuleSecurityConfig,
  ModuleStorageConfig,
};

interface ModuleSettingsPanelProps {
  moduleId: string;
  moduleName: string;
  moduleType: 'drive' | 'chat' | 'calendar' | 'analytics' | 'members' | 'admin' | 'hr';
  currentConfig: ModuleConfig;
  onSave: (config: ModuleConfig) => Promise<void>;
  onClose: () => void;
  businessId?: string;
}

export default function ModuleSettingsPanel({
  moduleId,
  moduleName,
  moduleType,
  currentConfig,
  onSave,
  onClose,
  businessId
}: ModuleSettingsPanelProps) {
  const defaultConfig: ModuleConfig = currentConfig ?? { permissions: [] };
  const [config, setConfig] = useState<ModuleConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(config);
      toast.success(`${moduleName} settings saved successfully`);
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    toast.success('Settings reset to previous values');
  };

  const getModuleIcon = () => {
    switch (moduleType) {
      case 'drive':
        return <Database className="w-5 h-5" />;
      case 'chat':
        return <Users className="w-5 h-5" />;
      case 'calendar':
        return <Bell className="w-5 h-5" />;
      case 'analytics':
        return <Database className="w-5 h-5" />;
      case 'members':
        return <Users className="w-5 h-5" />;
      case 'admin':
        return <Shield className="w-5 h-5" />;
      case 'hr':
        return <Users className="w-5 h-5" />;
      default:
        return <Settings className="w-5 h-5" />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-module-id={moduleId}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              {getModuleIcon()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {moduleName} Settings
              </h2>
              <p className="text-sm text-gray-600">
                Configure {moduleName.toLowerCase()} module settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <ModuleSettingsEditor
            moduleType={moduleType}
            config={config}
            onConfigChange={setConfig}
            businessId={businessId}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <Button variant="secondary" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <div className="flex space-x-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
