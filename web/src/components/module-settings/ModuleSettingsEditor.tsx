'use client';

import React, { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert, Badge, Card, Spinner, Switch, Tabs } from 'shared/components';
import {
  ModuleConfig,
  ModuleSecurityConfig,
  HRFeatureToggleSettings,
  createDefaultHRFeatureToggleSettings,
} from './types';
import OnboardingModuleSettings from '@/components/module-settings/hr/OnboardingModuleSettings';
import { getHRFeatureAvailability, type HRFeatureAvailabilityResponse } from '@/api/hrOnboarding';

type HRFeatureTogglePath =
  | 'employees.enabled'
  | 'employees.customFields'
  | 'attendance.enabled'
  | 'attendance.clockInOut'
  | 'attendance.geolocation'
  | 'onboarding.enabled'
  | 'onboarding.automation'
  | 'payroll'
  | 'recruitment'
  | 'performance'
  | 'benefits';

type HRFeatureDefinition = {
  path: HRFeatureTogglePath;
  label: string;
  description: string;
  requiredTier: 'business_advanced' | 'enterprise';
};

type HRFeatureGroup = {
  title: string;
  description?: string;
  items: HRFeatureDefinition[];
};

const HR_FEATURE_GROUPS: HRFeatureGroup[] = [
  {
    title: 'Core HR Controls',
    description: 'Toggle foundational HR capabilities for your workspace.',
    items: [
      {
        path: 'employees.enabled',
        label: 'Employee Directory',
        description: 'Manage employee profiles, roles, and lifecycle information.',
        requiredTier: 'business_advanced'
      },
      {
        path: 'employees.customFields',
        label: 'Custom Employee Fields',
        description: 'Create custom data fields for employees (Enterprise required).',
        requiredTier: 'enterprise'
      },
      {
        path: 'attendance.enabled',
        label: 'Attendance Tracking',
        description: 'Capture working time, attendance exceptions, and policies.',
        requiredTier: 'business_advanced'
      },
      {
        path: 'attendance.clockInOut',
        label: 'Clock-In / Clock-Out',
        description: 'Allow employees to punch in/out via Vssyl (Enterprise required).',
        requiredTier: 'enterprise'
      },
      {
        path: 'attendance.geolocation',
        label: 'Geofenced Time Tracking',
        description: 'Require geolocation for punches and enforce geofences.',
        requiredTier: 'enterprise'
      },
      {
        path: 'onboarding.enabled',
        label: 'Employee Onboarding',
        description: 'Enable onboarding journeys, templates, and task assignments.',
        requiredTier: 'business_advanced'
      },
      {
        path: 'onboarding.automation',
        label: 'Onboarding Automation',
        description: 'Unlock automated task routing, reminders, and triggers.',
        requiredTier: 'enterprise'
      }
    ]
  },
  {
    title: 'Advanced HR Programs',
    description: 'Control premium HR functions that expand employee support.',
    items: [
      {
        path: 'payroll',
        label: 'Payroll',
        description: 'Run payroll processing and export payroll files.',
        requiredTier: 'enterprise'
      },
      {
        path: 'recruitment',
        label: 'Recruitment',
        description: 'Manage applicant tracking, job postings, and offer workflows.',
        requiredTier: 'enterprise'
      },
      {
        path: 'performance',
        label: 'Performance Reviews',
        description: 'Track goals, reviews, and performance improvement plans.',
        requiredTier: 'enterprise'
      },
      {
        path: 'benefits',
        label: 'Benefits Administration',
        description: 'Configure employee benefits, eligibility rules, and enrollments.',
        requiredTier: 'enterprise'
      }
    ]
  }
];

const ensureHRFeatureSettings = (settings?: HRFeatureToggleSettings | null): HRFeatureToggleSettings => {
  const defaults = createDefaultHRFeatureToggleSettings();
  if (!settings) {
    return defaults;
  }

  return {
    employees: {
      enabled: settings.employees?.enabled ?? defaults.employees.enabled,
      customFields: settings.employees?.customFields ?? defaults.employees.customFields
    },
    attendance: {
      enabled: settings.attendance?.enabled ?? defaults.attendance.enabled,
      clockInOut: settings.attendance?.clockInOut ?? defaults.attendance.clockInOut,
      geolocation: settings.attendance?.geolocation ?? defaults.attendance.geolocation
    },
    onboarding: {
      enabled: settings.onboarding?.enabled ?? defaults.onboarding.enabled,
      automation: settings.onboarding?.automation ?? defaults.onboarding.automation
    },
    payroll: settings.payroll ?? defaults.payroll,
    recruitment: settings.recruitment ?? defaults.recruitment,
    performance: settings.performance ?? defaults.performance,
    benefits: settings.benefits ?? defaults.benefits
  };
};

const availabilityToConfig = (features: HRFeatureAvailabilityResponse['features']): HRFeatureToggleSettings => ({
  employees: {
    enabled: features.employees.enabled,
    customFields: features.employees.customFields
  },
  attendance: {
    enabled: features.attendance.enabled,
    clockInOut: features.attendance.clockInOut,
    geolocation: features.attendance.geolocation
  },
  onboarding: {
    enabled: features.onboarding.enabled,
    automation: features.onboarding.automation
  },
  payroll: features.payroll,
  recruitment: features.recruitment,
  performance: features.performance,
  benefits: features.benefits
});

const enforceFeatureAvailability = (
  config: HRFeatureToggleSettings,
  availability: HRFeatureAvailabilityResponse['features']
): HRFeatureToggleSettings => {
  const next: HRFeatureToggleSettings = {
    employees: {
      enabled: availability.employees.enabled && config.employees.enabled,
      customFields: availability.employees.customFields && config.employees.customFields
    },
    attendance: {
      enabled: availability.attendance.enabled && config.attendance.enabled,
      clockInOut: availability.attendance.clockInOut && config.attendance.clockInOut,
      geolocation: availability.attendance.geolocation && config.attendance.geolocation
    },
    onboarding: {
      enabled: availability.onboarding.enabled && config.onboarding.enabled,
      automation: availability.onboarding.automation && config.onboarding.automation
    },
    payroll: availability.payroll && config.payroll,
    recruitment: availability.recruitment && config.recruitment,
    performance: availability.performance && config.performance,
    benefits: availability.benefits && config.benefits
  };

  if (!next.attendance.enabled) {
    next.attendance.clockInOut = false;
    next.attendance.geolocation = false;
  }

  if (!next.onboarding.enabled) {
    next.onboarding.automation = false;
  }

  if (!next.employees.enabled) {
    next.employees.customFields = false;
  }

  return next;
};

const getFeatureValue = (config: HRFeatureToggleSettings, path: HRFeatureTogglePath): boolean => {
  switch (path) {
    case 'employees.enabled':
      return config.employees.enabled;
    case 'employees.customFields':
      return config.employees.customFields;
    case 'attendance.enabled':
      return config.attendance.enabled;
    case 'attendance.clockInOut':
      return config.attendance.clockInOut;
    case 'attendance.geolocation':
      return config.attendance.geolocation;
    case 'onboarding.enabled':
      return config.onboarding.enabled;
    case 'onboarding.automation':
      return config.onboarding.automation;
    case 'payroll':
      return config.payroll;
    case 'recruitment':
      return config.recruitment;
    case 'performance':
      return config.performance;
    case 'benefits':
      return config.benefits;
    default:
      return false;
  }
};

const formatTierLabel = (tier?: string | null): string => {
  if (!tier) {
    return 'Unknown';
  }
  return tier
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

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
  const [hrFeatureAvailability, setHrFeatureAvailability] = useState<HRFeatureAvailabilityResponse | null>(null);
  const [loadingHrFeatures, setLoadingHrFeatures] = useState(false);
  const [hrFeaturesError, setHrFeaturesError] = useState<string | null>(null);

  const hrFeaturesConfig = useMemo(
    () => ensureHRFeatureSettings(config.hrFeatures),
    [config.hrFeatures]
  );

  useEffect(() => {
    if (moduleType !== 'hr' || !businessId) {
      setHrFeatureAvailability(null);
      setHrFeaturesError(null);
      setLoadingHrFeatures(false);
      return;
    }

    let cancelled = false;
    const loadFeatures = async () => {
      try {
        setLoadingHrFeatures(true);
        setHrFeaturesError(null);
        const data = await getHRFeatureAvailability(businessId);
        if (!cancelled) {
          setHrFeatureAvailability(data);
        }
      } catch (error) {
        if (!cancelled) {
          setHrFeatureAvailability(null);
          setHrFeaturesError(error instanceof Error ? error.message : 'Unable to load HR feature availability');
        }
      } finally {
        if (!cancelled) {
          setLoadingHrFeatures(false);
        }
      }
    };

    void loadFeatures();

    return () => {
      cancelled = true;
    };
  }, [moduleType, businessId]);

  useEffect(() => {
    if (moduleType !== 'hr' || !hrFeatureAvailability || config.hrFeatures) {
      return;
    }

    onConfigChange((prev) => {
      if (prev.hrFeatures) {
        return prev;
      }

      return {
        ...prev,
        hrFeatures: availabilityToConfig(hrFeatureAvailability.features)
      };
    });
  }, [moduleType, hrFeatureAvailability, config.hrFeatures, onConfigChange]);

  useEffect(() => {
    if (moduleType !== 'hr' || !hrFeatureAvailability) {
      return;
    }

    const sanitized = enforceFeatureAvailability(hrFeaturesConfig, hrFeatureAvailability.features);
    if (JSON.stringify(hrFeaturesConfig) !== JSON.stringify(sanitized)) {
      onConfigChange((prev) => ({
        ...prev,
        hrFeatures: sanitized
      }));
    }
  }, [moduleType, hrFeatureAvailability, hrFeaturesConfig, onConfigChange]);

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

  const isFeatureAvailable = useCallback(
    (path: HRFeatureTogglePath): boolean => {
      if (!hrFeatureAvailability) {
        return true;
      }

      const availability = hrFeatureAvailability.features;
      switch (path) {
        case 'employees.enabled':
          return availability.employees.enabled;
        case 'employees.customFields':
          return availability.employees.customFields;
        case 'attendance.enabled':
          return availability.attendance.enabled;
        case 'attendance.clockInOut':
          return availability.attendance.clockInOut;
        case 'attendance.geolocation':
          return availability.attendance.geolocation;
        case 'onboarding.enabled':
          return availability.onboarding.enabled;
        case 'onboarding.automation':
          return availability.onboarding.automation;
        case 'payroll':
          return availability.payroll;
        case 'recruitment':
          return availability.recruitment;
        case 'performance':
          return availability.performance;
        case 'benefits':
          return availability.benefits;
        default:
          return true;
      }
    },
    [hrFeatureAvailability]
  );

  const getDisplayValue = useCallback(
    (path: HRFeatureTogglePath): boolean => {
      const value = getFeatureValue(hrFeaturesConfig, path);
      if (!isFeatureAvailable(path)) {
        return false;
      }
      return value;
    },
    [hrFeaturesConfig, isFeatureAvailable]
  );

  const handleHRFeatureToggle = useCallback(
    (path: HRFeatureTogglePath, nextValue: boolean) => {
      onConfigChange((prev) => {
        const current = ensureHRFeatureSettings(prev.hrFeatures);
        const updated: HRFeatureToggleSettings = {
          employees: { ...current.employees },
          attendance: { ...current.attendance },
          onboarding: { ...current.onboarding },
          payroll: current.payroll,
          recruitment: current.recruitment,
          performance: current.performance,
          benefits: current.benefits
        };

        switch (path) {
          case 'employees.enabled':
            updated.employees.enabled = nextValue;
            if (!nextValue) {
              updated.employees.customFields = false;
            }
            break;
          case 'employees.customFields':
            updated.employees.customFields = nextValue;
            break;
          case 'attendance.enabled':
            updated.attendance.enabled = nextValue;
            if (!nextValue) {
              updated.attendance.clockInOut = false;
              updated.attendance.geolocation = false;
            }
            break;
          case 'attendance.clockInOut':
            updated.attendance.clockInOut = nextValue;
            break;
          case 'attendance.geolocation':
            updated.attendance.geolocation = nextValue;
            break;
          case 'onboarding.enabled':
            updated.onboarding.enabled = nextValue;
            if (!nextValue) {
              updated.onboarding.automation = false;
            }
            break;
          case 'onboarding.automation':
            updated.onboarding.automation = nextValue;
            break;
          case 'payroll':
            updated.payroll = nextValue;
            break;
          case 'recruitment':
            updated.recruitment = nextValue;
            break;
          case 'performance':
            updated.performance = nextValue;
            break;
          case 'benefits':
            updated.benefits = nextValue;
            break;
        }

        const normalized = hrFeatureAvailability
          ? enforceFeatureAvailability(updated, hrFeatureAvailability.features)
          : updated;

        return {
          ...prev,
          hrFeatures: normalized
        };
      });
    },
    [onConfigChange, hrFeatureAvailability]
  );

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

            {moduleType === 'hr' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-gray-600">
                    Toggle which HR capabilities are active for your workspace. Availability depends on your subscription tier.
                  </p>
                  {hrFeatureAvailability?.tier && (
                    <Badge color={hrFeatureAvailability.tier === 'enterprise' ? 'yellow' : 'blue'} size="sm">
                      {formatTierLabel(hrFeatureAvailability.tier)}
                    </Badge>
                  )}
                </div>

                {hrFeaturesError && (
                  <Alert type="warning" title="Unable to confirm subscription capabilities">
                    {hrFeaturesError}
                  </Alert>
                )}

                {typeof hrFeatureAvailability?.features.employees.limit === 'number' && (
                  <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
                    Employee capacity: {hrFeatureAvailability.features.employees.limit} active employees.
                  </div>
                )}

                {loadingHrFeatures ? (
                  <div className="flex justify-center py-6">
                    <Spinner size={24} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {HR_FEATURE_GROUPS.map((group) => (
                      <div key={group.title} className="rounded-lg border border-gray-200 p-4 space-y-4">
                        <div>
                          <h4 className="text-md font-semibold text-gray-900">{group.title}</h4>
                          {group.description && <p className="text-sm text-gray-600 mt-1">{group.description}</p>}
                        </div>
                        <div className="space-y-4">
                          {group.items.map((item) => {
                            const available = isFeatureAvailable(item.path);
                            const value = getDisplayValue(item.path);
                            const tierBadgeColor = item.requiredTier === 'enterprise' ? 'yellow' : 'blue';

                            return (
                              <div key={item.path} className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                                    <Badge color={tierBadgeColor} size="sm">
                                      {formatTierLabel(item.requiredTier)}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                                  {!available && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Not available on your current tier. Upgrade to enable.
                                    </p>
                                  )}
                                </div>
                                <Switch
                                  checked={value}
                                  onChange={(checked) => handleHRFeatureToggle(item.path, checked)}
                                  disabled={!available}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

