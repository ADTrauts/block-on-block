'use client';

import React, { useState, type Dispatch, type SetStateAction } from 'react';
import { Card, Tabs } from 'shared/components';
import { ModuleConfig, ModuleSecurityConfig } from './types';
import OnboardingModuleSettings from '@/components/module-settings/hr/OnboardingModuleSettings';

interface ModuleSettingsEditorProps {
  moduleType: 'drive' | 'chat' | 'calendar' | 'analytics' | 'members' | 'admin' | 'hr';
  config: ModuleConfig;
  onConfigChange: Dispatch<SetStateAction<ModuleConfig>>;
  businessId?: string;
}

type ConfigValue = string | number | boolean | string[];

export default function ModuleSettingsEditor({
  moduleType,
  config,
  onConfigChange,
  businessId,
}: ModuleSettingsEditorProps) {
  const [activeTab, setActiveTab] = useState('general');

  const updateConfig = (path: string, value: ConfigValue) => {
    const nextConfig: ModuleConfig = { ...config };

    switch (path) {
      case 'storage.quota':
        nextConfig.storage = {
          quota: typeof value === 'number' ? value : Number(value),
          compression: nextConfig.storage?.compression ?? false,
          backup: nextConfig.storage?.backup ?? false,
        };
        break;
      case 'storage.compression':
        nextConfig.storage = {
          quota: nextConfig.storage?.quota ?? 10,
          compression: Boolean(value),
          backup: nextConfig.storage?.backup ?? false,
        };
        break;
      case 'storage.backup':
        nextConfig.storage = {
          quota: nextConfig.storage?.quota ?? 10,
          compression: nextConfig.storage?.compression ?? false,
          backup: Boolean(value),
        };
        break;
      case 'notifications.push':
        nextConfig.notifications = {
          email: nextConfig.notifications?.email ?? true,
          push: Boolean(value),
          frequency: nextConfig.notifications?.frequency ?? 'daily',
        };
        break;
      case 'notifications.email':
        nextConfig.notifications = {
          email: Boolean(value),
          push: nextConfig.notifications?.push ?? true,
          frequency: nextConfig.notifications?.frequency ?? 'daily',
        };
        break;
      case 'security.encryption':
        nextConfig.security = {
          encryption: Boolean(value),
          auditLog: nextConfig.security?.auditLog ?? false,
          accessControl: nextConfig.security?.accessControl ?? 'moderate',
        };
        break;
      case 'security.auditLog':
        nextConfig.security = {
          encryption: nextConfig.security?.encryption ?? false,
          auditLog: Boolean(value),
          accessControl: nextConfig.security?.accessControl ?? 'moderate',
        };
        break;
      case 'security.accessControl':
        nextConfig.security = {
          encryption: nextConfig.security?.encryption ?? false,
          auditLog: nextConfig.security?.auditLog ?? false,
          accessControl: (value as ModuleSecurityConfig['accessControl']) ?? 'moderate',
        };
        break;
      case 'integrations.webhooks':
        nextConfig.integrations = {
          externalServices: nextConfig.integrations?.externalServices ?? [],
          webhooks: Boolean(value),
          apiAccess: nextConfig.integrations?.apiAccess ?? false,
        };
        break;
      case 'integrations.apiAccess':
        nextConfig.integrations = {
          externalServices: nextConfig.integrations?.externalServices ?? [],
          webhooks: nextConfig.integrations?.webhooks ?? false,
          apiAccess: Boolean(value),
        };
        break;
      case 'integrations.externalServices':
        nextConfig.integrations = {
          externalServices: Array.isArray(value) ? value : [],
          webhooks: nextConfig.integrations?.webhooks ?? false,
          apiAccess: nextConfig.integrations?.apiAccess ?? false,
        };
        break;
      default:
        break;
    }

    onConfigChange(nextConfig);
  };

  const togglePermission = (permission: string, checked: boolean) => {
    const currentPermissions = config.permissions || [];
    const updatedPermissions = checked
      ? Array.from(new Set([...currentPermissions, permission]))
      : currentPermissions.filter((perm) => perm !== permission);

    onConfigChange({
      ...config,
      permissions: updatedPermissions,
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <Tabs.List>
        <Tabs.Trigger value="general">General</Tabs.Trigger>
        <Tabs.Trigger value="permissions">Permissions</Tabs.Trigger>
        <Tabs.Trigger value="security">Security</Tabs.Trigger>
        <Tabs.Trigger value="integrations">Integrations</Tabs.Trigger>
        {moduleType === 'hr' && <Tabs.Trigger value="onboarding">Onboarding</Tabs.Trigger>}
      </Tabs.List>

      <Tabs.Content value="general">
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">General Configuration</h3>

            {moduleType === 'drive' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Storage Quota (GB)
                  </label>
                  <input
                    type="number"
                    value={config.storage?.quota ?? 10}
                    onChange={(e) => updateConfig('storage.quota', parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={1}
                    max={1000}
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="compression"
                    checked={config.storage?.compression ?? false}
                    onChange={(e) => updateConfig('storage.compression', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="compression" className="text-sm text-gray-700">
                    Enable file compression
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="backup"
                    checked={config.storage?.backup ?? false}
                    onChange={(e) => updateConfig('storage.backup', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="backup" className="text-sm text-gray-700">
                    Enable automatic backups
                  </label>
                </div>
              </div>
            )}

            {moduleType === 'chat' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message Retention (days)
                  </label>
                  <input
                    type="number"
                    value={config.notifications?.frequency === 'daily' ? 30 : 14}
                    onChange={() => undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={1}
                    max={365}
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Custom retention policies will be configurable in an upcoming release.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="read-receipts"
                    checked={config.notifications?.push ?? true}
                    onChange={(e) => updateConfig('notifications.push', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="read-receipts" className="text-sm text-gray-700">
                    Enable read receipts
                  </label>
                </div>
              </div>
            )}

            {moduleType === 'calendar' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Event Duration (minutes)
                  </label>
                  <select
                    value={30}
                    onChange={() => undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Duration presets will be customizable soon; current default is 30 minutes.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="auto-reminders"
                    checked={config.notifications?.email ?? true}
                    onChange={(e) => updateConfig('notifications.email', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="auto-reminders" className="text-sm text-gray-700">
                    Enable automatic reminders
                  </label>
                </div>
              </div>
            )}
          </Card>
        </div>
      </Tabs.Content>

      <Tabs.Content value="permissions">
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Access Permissions</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Roles with Access
                </label>
                <div className="space-y-2">
                  {['admin', 'manager', 'employee', 'guest'].map((role) => {
                    const label = role.charAt(0).toUpperCase() + role.slice(1);
                    const hasPermission = config.permissions?.includes(role);
                    return (
                      <div key={role} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id={`role-${role}`}
                          checked={hasPermission}
                          onChange={(e) => togglePermission(role, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`role-${role}`} className="text-sm text-gray-700">
                          {label}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department Access
                </label>
                <select
                  value="all"
                  onChange={() => undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled
                >
                  <option value="all">All Departments</option>
                  <option value="specific">Specific Departments Only</option>
                  <option value="none">No Department Access</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Department-level controls align with the org chart and will surface automatically here.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </Tabs.Content>

      <Tabs.Content value="security">
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Security Configuration</h3>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="encryption"
                  checked={config.security?.encryption ?? false}
                  onChange={(e) => updateConfig('security.encryption', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="encryption" className="text-sm text-gray-700">
                  Enable end-to-end encryption
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="audit-log"
                  checked={config.security?.auditLog ?? false}
                  onChange={(e) => updateConfig('security.auditLog', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="audit-log" className="text-sm text-gray-700">
                  Enable audit logging
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Control Level
                </label>
                <select
                  value={config.security?.accessControl ?? 'moderate'}
                  onChange={(e) => updateConfig('security.accessControl', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="strict">Strict (Admin approval required)</option>
                  <option value="moderate">Moderate (Role-based access)</option>
                  <option value="open">Open (Self-service access)</option>
                </select>
              </div>
            </div>
          </Card>
        </div>
      </Tabs.Content>

      <Tabs.Content value="integrations">
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">External Integrations</h3>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="webhooks"
                  checked={config.integrations?.webhooks ?? false}
                  onChange={(e) => updateConfig('integrations.webhooks', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="webhooks" className="text-sm text-gray-700">
                  Enable webhook notifications
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="api-access"
                  checked={config.integrations?.apiAccess ?? false}
                  onChange={(e) => updateConfig('integrations.apiAccess', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="api-access" className="text-sm text-gray-700">
                  Enable API access
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Connected Services
                </label>
                <div className="space-y-2">
                  {['Slack', 'Microsoft Teams', 'Google Workspace', 'Zoom'].map((service) => (
                    <div key={service} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id={`service-${service.toLowerCase().replace(' ', '-')}`}
                        checked={config.integrations?.externalServices?.includes(service) ?? false}
                        onChange={(e) => {
                          const current = config.integrations?.externalServices ?? [];
                          const updated = e.target.checked
                            ? Array.from(new Set([...current, service]))
                            : current.filter((item) => item !== service);
                          updateConfig('integrations.externalServices', updated);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label
                        htmlFor={`service-${service.toLowerCase().replace(' ', '-')}`}
                        className="text-sm text-gray-700"
                      >
                        {service}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Tabs.Content>

      {moduleType === 'hr' && (
        <Tabs.Content value="onboarding">
          <OnboardingModuleSettings
            businessId={businessId}
            config={config}
            onConfigChange={onConfigChange}
          />
        </Tabs.Content>
      )}
    </Tabs>
  );
}

