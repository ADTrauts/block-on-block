'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { businessAPI } from '../../../../../api/business';
import { Card, Button, Spinner, Alert } from 'shared/components';
import DashboardBuildOutModal from '../../../../../components/DashboardBuildOutModal';
import ModuleSettingsPanel from '../../../../../components/module-settings/ModuleSettingsPanel';
import { useBusinessConfiguration } from '../../../../../contexts/BusinessConfigurationContext';
import { 
  Package, 
  Settings,
  ToggleLeft,
  ToggleRight,
  Plus,
  Search
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { configureModule } from '../../../../../api/modules';
import type { ModuleConfig } from '../../../../../components/module-settings/types';
import type { BusinessModule } from '../../../../../contexts/BusinessConfigurationContext';

interface Business {
  id: string;
  name: string;
  logo?: string;
}

type ModuleTypeKey = 'drive' | 'chat' | 'calendar' | 'analytics' | 'members' | 'admin' | 'hr';

interface ModuleSelection {
  id: string;
  name?: string;
  moduleType: ModuleTypeKey;
  config: ModuleConfig;
}

type ModuleDataLike = BusinessModule & {
  configured?: {
    settings?: unknown;
    permissions?: string[];
  };
};

export default function BusinessModulesPage() {
  const params = useParams();
  const { data: session } = useSession();
  const { 
    configuration, 
    loading: configLoading, 
    error: configError,
    updateModuleStatus,
    updateModulePermissions
  } = useBusinessConfiguration();
  const businessId = params?.id as string;

  const mapModuleType = (moduleId: string): ModuleTypeKey => {
    const normalized = moduleId.toLowerCase();
    switch (normalized) {
      case 'drive':
        return 'drive';
      case 'chat':
        return 'chat';
      case 'calendar':
        return 'calendar';
      case 'analytics':
        return 'analytics';
      case 'members':
        return 'members';
      case 'hr':
      case 'hr-onboarding':
        return 'hr';
      default:
        return 'admin';
    }
  };

  const deriveModuleConfig = (moduleData: ModuleDataLike): ModuleConfig => {
    const configured = moduleData.configured as Record<string, unknown> | undefined;
    const configuredSettings = configured?.settings as Partial<ModuleConfig> | undefined;
    const configuredPermissionsRaw = configured?.permissions;
    const directPermissionsRaw = moduleData.permissions;

    const normalizePermissions = (value: unknown): string[] => (
      Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : []
    );

    const permissions = normalizePermissions(configuredPermissionsRaw).length > 0
      ? normalizePermissions(configuredPermissionsRaw)
      : normalizePermissions(directPermissionsRaw);

    return {
      permissions,
      storage: configuredSettings?.storage,
      notifications: configuredSettings?.notifications,
      security: configuredSettings?.security,
      integrations: configuredSettings?.integrations,
      onboarding: configuredSettings?.onboarding
    };
  };

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Module selection state
  const [showModuleSelection, setShowModuleSelection] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Module settings state
  const [showModuleSettings, setShowModuleSettings] = useState(false);
  const [selectedModuleForSettings, setSelectedModuleForSettings] = useState<ModuleSelection | null>(null);

  const loadBusinessData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const businessResponse = await businessAPI.getBusiness(businessId);
      if (businessResponse.success) {
        setBusiness(businessResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business data');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId && session?.accessToken) {
      void loadBusinessData();
    }
  }, [businessId, session?.accessToken, loadBusinessData]);

  const openModuleSettings = (module: ModuleDataLike) => {
    const moduleId = typeof module.id === 'string' ? module.id : null;
    if (!moduleId) {
      toast.error('Unable to open settings for module without an identifier');
      return;
    }

    const moduleName = typeof module.name === 'string' ? module.name : undefined;
    const moduleConfig = deriveModuleConfig(module);

    setSelectedModuleForSettings({
      id: moduleId,
      name: moduleName,
      moduleType: mapModuleType(moduleId),
      config: moduleConfig
    });
    setShowModuleSettings(true);
  };

  const handleModuleSettingsSave = async (config: ModuleConfig) => {
    if (!selectedModuleForSettings) {
      toast.error('No module selected');
      return;
    }

    try {
      await updateModulePermissions(selectedModuleForSettings.id, config.permissions || []);
      await configureModule(selectedModuleForSettings.id, {
        enabled: true,
        permissions: config.permissions || [],
        settings: { ...config } as Record<string, unknown>,
      });
      setSelectedModuleForSettings(prev =>
        prev ? { ...prev, config } : prev
      );
      toast.success('Module settings updated successfully');
      setShowModuleSettings(false);
    } catch {
      toast.error('Failed to update module settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="container mx-auto p-6">
        <Alert type="error" title="Error Loading Business">
          {error || 'Business not found'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enterprise Modules</h1>
              <p className="text-gray-600 mt-1">
                Manage enterprise modules for your business workspace
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {installing && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <Spinner size={16} />
                  <span className="text-sm">Installing modules...</span>
                </div>
              )}
              <Button onClick={() => setShowModuleSelection(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Modules
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="space-y-6">
          
          {/* Module Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Modules</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {configuration?.enabledModules?.length || 0}
                  </p>
                </div>
                <Package className="w-6 h-6 text-gray-400" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Modules</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {configuration?.enabledModules?.filter(m => m.status === 'enabled').length || 0}
                  </p>
                </div>
                <ToggleRight className="w-6 h-6 text-green-400" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Enterprise Tier</p>
                  <p className="text-2xl font-bold text-gray-900">✓</p>
                </div>
                <Settings className="w-6 h-6 text-purple-400" />
              </div>
            </Card>
          </div>

          {/* Installed Modules */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Installed Modules</h2>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search modules..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setShowModuleSelection(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Modules
                </Button>
              </div>
            </div>

            {configLoading ? (
              <div className="flex items-center justify-center p-8">
                <Spinner size={32} />
              </div>
            ) : configError ? (
              <Alert type="error" title="Error Loading Modules">
                {configError}
              </Alert>
            ) : configuration?.enabledModules && configuration.enabledModules.length > 0 ? (
              <div className="space-y-4">
                {configuration.enabledModules.map((module) => (
                  <div key={module.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-lg ${
                        module.status === 'enabled' 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {module.name || module.id}
                        </h3>
                        <p className="text-xs text-gray-600">
                          {module.description || 'Enterprise Module'}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            module.status === 'enabled'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {module.status === 'enabled' ? 'Active' : 'Inactive'}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Enterprise
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateModuleStatus(
                          module.id,
                          module.status === 'enabled' ? 'disabled' : 'enabled'
                        )}
                        className="flex items-center space-x-1"
                      >
                        {module.status === 'enabled' ? (
                          <>
                            <ToggleLeft className="w-3 h-3" />
                            <span>Disable</span>
                          </>
                        ) : (
                          <>
                            <ToggleRight className="w-3 h-3" />
                            <span>Enable</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openModuleSettings(module)}
                        className="flex items-center space-x-1"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Settings</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Modules Installed</h3>
                <p className="text-gray-600 mb-6">
                  Get started by browsing and installing enterprise modules for your business.
                </p>
                <Button onClick={() => setShowModuleSelection(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Browse Enterprise Modules
                </Button>
              </div>
            )}
          </Card>

          {/* Module Categories */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Module Categories</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Analytics', icon: '📊', count: 3, color: 'bg-blue-50 text-blue-600' },
                { name: 'Communication', icon: '💬', count: 2, color: 'bg-green-50 text-green-600' },
                { name: 'Productivity', icon: '⚡', count: 4, color: 'bg-purple-50 text-purple-600' },
                { name: 'Finance', icon: '💰', count: 2, color: 'bg-yellow-50 text-yellow-600' }
              ].map((category) => (
                <div key={category.name} className={`p-4 rounded-lg ${category.color}`}>
                  <div className="text-2xl mb-2">{category.icon}</div>
                  <h3 className="font-medium text-sm">{category.name}</h3>
                  <p className="text-xs opacity-75">{category.count} modules available</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Module Selection Modal for Enterprise Modules */}
      <DashboardBuildOutModal
        isOpen={showModuleSelection}
        onClose={() => setShowModuleSelection(false)}
        onComplete={async (selectedModuleIds: string[]) => {
          setShowModuleSelection(false);
          if (selectedModuleIds.length === 0) return;
          try {
            setInstalling(true);
            for (const id of selectedModuleIds) {
              await updateModuleStatus(id, 'enabled');
            }
            toast.success('Selected enterprise modules installed');
          } catch {
            toast.error('Failed to install one or more modules');
          } finally {
            setInstalling(false);
          }
        }}
        dashboardName={`${business.name} Enterprise Workspace`}
        businessId={businessId}
        scope="business"
      />

      {/* Module Settings Modal */}
      {showModuleSettings && selectedModuleForSettings && (
        <ModuleSettingsPanel
          moduleId={selectedModuleForSettings.id}
          moduleName={selectedModuleForSettings.name || selectedModuleForSettings.id}
          moduleType={selectedModuleForSettings.moduleType}
          currentConfig={selectedModuleForSettings.config}
          onSave={handleModuleSettingsSave}
          onClose={() => setShowModuleSettings(false)}
          businessId={businessId}
        />
      )}
    </div>
  );
}
