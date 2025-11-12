'use client';

import React, { useEffect, useMemo, useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Badge, Card, Button, Spinner, Alert } from 'shared/components';
import { ArrowLeft, Package, Settings as SettingsIcon, Shield, Layers } from 'lucide-react';
import { toast } from 'react-hot-toast';

import {
  getInstalledModules,
  getModuleDetails,
  type ModuleConfiguration,
  type Module,
} from '@/api/modules';
import ModuleSettingsEditor from '@/components/module-settings/ModuleSettingsEditor';
import type { ModuleConfig } from '@/components/module-settings/types';
import { useModuleSettings } from '@/contexts/ModuleSettingsContext';

type InstalledModule = Module & {
  status: 'installed' | 'available' | 'pending';
};

const MODULE_TYPE_MAP: Record<string, 'drive' | 'chat' | 'calendar' | 'analytics' | 'members' | 'admin' | 'hr'> = {
  drive: 'drive',
  chat: 'chat',
  calendar: 'calendar',
  analytics: 'analytics',
  members: 'members',
  hr: 'hr',
  'hr-onboarding': 'hr'
};

const getModuleType = (moduleId: string): 'drive' | 'chat' | 'calendar' | 'analytics' | 'members' | 'admin' | 'hr' => {
  const normalized = moduleId.toLowerCase();
  if (MODULE_TYPE_MAP[normalized]) {
    return MODULE_TYPE_MAP[normalized];
  }
  return 'admin';
};

const buildModuleConfig = (module: InstalledModule, fallbackConfig: ModuleConfig | undefined): ModuleConfig => {
  const configuredSettings = module.configured?.settings as Partial<ModuleConfig> | undefined;

  const permissions =
    fallbackConfig?.permissions ??
    module.configured?.permissions ??
    (Array.isArray(configuredSettings?.permissions) ? configuredSettings?.permissions : []);

  return {
    permissions,
    storage: configuredSettings?.storage,
    notifications: configuredSettings?.notifications,
    security: configuredSettings?.security,
    integrations: configuredSettings?.integrations,
    onboarding: configuredSettings?.onboarding
  };
};

export default function ModuleSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const businessId = params?.id as string;
  const moduleId = params?.moduleId as string;

  const {
    getModuleSettings,
    updateModuleSettings,
    resetModuleSettings,
  } = useModuleSettings();

  const [moduleData, setModuleData] = useState<InstalledModule | null>(null);
  const [config, setConfig] = useState<ModuleConfig | null>(null);
  const [initialConfig, setInitialConfig] = useState<ModuleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId || !moduleId || !session?.accessToken) {
      return;
    }

    const loadModule = async () => {
      try {
        setLoading(true);
        setError(null);

        const installedModules = await getInstalledModules({
          scope: 'business',
          businessId,
        });

        const installed = installedModules.find((mod) => mod.id === moduleId) as InstalledModule | undefined;

        let moduleDetails = installed;

        if (!moduleDetails) {
          // Fallback to module details endpoint (in case module not in installed list)
          try {
            moduleDetails = (await getModuleDetails(moduleId)) as InstalledModule;
          } catch {
            setError('Module not found or not installed for this business.');
            return;
          }
        }

        setModuleData(moduleDetails);

        const storedConfig = getModuleSettings(moduleId);
        const derivedConfig = buildModuleConfig(moduleDetails, storedConfig);

        setConfig(derivedConfig);
        setInitialConfig(derivedConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load module settings');
      } finally {
        setLoading(false);
      }
    };

    void loadModule();
  }, [businessId, moduleId, session?.accessToken, getModuleSettings]);

  const moduleType = useMemo(() => (moduleId ? getModuleType(moduleId) : 'admin'), [moduleId]);

  const handleConfigChange = useCallback<Dispatch<SetStateAction<ModuleConfig>>>(
    (updater) => {
      setConfig((prev) => {
        const current = prev ?? { permissions: [] };
        if (typeof updater === 'function') {
          return (updater as (previousState: ModuleConfig) => ModuleConfig)(current);
        }
        return updater;
      });
    },
    []
  );

  const handleSave = async () => {
    if (!moduleData || !config) {
      return;
    }

    try {
      setSaving(true);
      await updateModuleSettings(moduleData.id, {
        permissions: config.permissions,
        storage: config.storage,
        notifications: config.notifications,
        security: config.security,
        integrations: config.integrations,
        onboarding: config.onboarding
      });
      setInitialConfig(config);
    } catch (err) {
      // updateModuleSettings already surfaces toast feedback
      if (err instanceof Error) {
        console.error(err);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!moduleData || !initialConfig) {
      return;
    }

    setConfig(initialConfig);
    resetModuleSettings(moduleData.id);
    toast.success(`${moduleData.name} settings reset`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !moduleData || !config) {
    return (
      <div className="container mx-auto p-6">
        <Alert type="error" title="Unable to load module settings">
          {error || 'Module configuration could not be retrieved.'}
        </Alert>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => router.push(`/business/${businessId}/modules`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Modules
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push(`/business/${businessId}/modules`)}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Modules</span>
              </Button>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{moduleData.name} Settings</h1>
                <p className="text-sm text-gray-600">
                  Configure how {moduleData.name.toLowerCase()} operates across your business workspace.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge color="blue">{moduleData.version ?? 'v1.0.0'}</Badge>
              <Badge color={moduleData.status === 'installed' ? 'green' : 'gray'}>
                {moduleData.status === 'installed' ? 'Installed' : 'Not Installed'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-10 space-y-8">
        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{moduleData.name}</h2>
                <p className="text-sm text-gray-600">
                  {moduleData.description || 'This module powers key workflows inside your business workspace.'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge color="gray" className="flex items-center space-x-1">
                <Layers className="h-4 w-4" />
                <span>{moduleData.category ?? 'General'}</span>
              </Badge>
              <Badge color="gray" className="flex items-center space-x-1">
                <Shield className="h-4 w-4" />
                <span>{moduleType.charAt(0).toUpperCase() + moduleType.slice(1)} Module</span>
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-0">
          <ModuleSettingsEditor
            moduleType={moduleType}
            config={config}
            onConfigChange={handleConfigChange}
            businessId={businessId}
          />
        </Card>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={handleReset}
            className="sm:w-auto"
            disabled={saving}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            className="sm:w-auto"
            disabled={saving}
          >
            {saving ? (
              <div className="mr-2">
                <Spinner size={16} />
              </div>
            ) : (
              <SettingsIcon className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

