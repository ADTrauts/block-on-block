'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { configureModule } from '../api/modules';
import { toast } from 'react-hot-toast';
import {
  ModuleConfig,
  ModuleIntegrationConfig,
  ModuleNotificationConfig,
  ModuleSecurityConfig,
  ModuleStorageConfig,
  OnboardingModuleConfig,
  HRFeatureToggleSettings,
  PartialHRFeatureToggleSettings,
  createDefaultHRFeatureToggleSettings,
} from '@/components/module-settings/types';

export interface ModuleSettings {
  [moduleId: string]: ModuleConfig;
}

export interface ModuleSettingsUpdate {
  permissions?: string[];
  storage?: Partial<ModuleStorageConfig>;
  notifications?: Partial<ModuleNotificationConfig>;
  security?: Partial<ModuleSecurityConfig>;
  integrations?: Partial<ModuleIntegrationConfig>;
  onboarding?: Partial<OnboardingModuleConfig> & {
    documentChecklist?: OnboardingModuleConfig['documentChecklist'];
    equipmentList?: OnboardingModuleConfig['equipmentList'];
    uniformOptions?: OnboardingModuleConfig['uniformOptions'];
    equipmentLibrary?: OnboardingModuleConfig['equipmentLibrary'];
    uniformLibrary?: OnboardingModuleConfig['uniformLibrary'];
    customActions?: OnboardingModuleConfig['customActions'];
  };
  hrFeatures?: PartialHRFeatureToggleSettings;
  [key: string]: unknown;
}

interface ModuleSettingsContextType {
  settings: ModuleSettings;
  loading: boolean;
  error: string | null;
  updateModuleSettings: (moduleId: string, settings: ModuleSettingsUpdate) => Promise<void>;
  getModuleSettings: (moduleId: string) => ModuleSettings[string] | undefined;
  resetModuleSettings: (moduleId: string) => void;
}

const ModuleSettingsContext = createContext<ModuleSettingsContextType | undefined>(undefined);

interface ModuleSettingsProviderProps {
  children: ReactNode;
  businessId?: string;
}

export function ModuleSettingsProvider({ children, businessId }: ModuleSettingsProviderProps) {
  const [settings, setSettings] = useState<ModuleSettings>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update module settings
  const updateModuleSettings = useCallback(async (moduleId: string, newSettings: ModuleSettingsUpdate) => {
    if (!businessId) {
      toast.error('No business selected');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Update local state immediately (optimistic update)
      setSettings(prev => {
        const currentModule: ModuleConfig = prev[moduleId] || {
          permissions: [],
          storage: undefined,
          notifications: undefined,
          security: undefined,
          integrations: undefined,
          onboarding: undefined,
          hrFeatures: undefined
        };

        const mergeOnboardingConfig = (
          existing: OnboardingModuleConfig | undefined,
          updates: ModuleSettingsUpdate['onboarding']
        ): OnboardingModuleConfig | undefined => {
          if (!updates) {
            return existing;
          }

          const base: OnboardingModuleConfig = {
            ownerUserId: existing?.ownerUserId ?? null,
            ownerRole: existing?.ownerRole ?? 'HR_ADMIN',
            ownerNotes: existing?.ownerNotes ?? null,
            defaultTemplateId: existing?.defaultTemplateId ?? null,
            buddyProgramEnabled: existing?.buddyProgramEnabled ?? false,
            buddySelectionStrategy: existing?.buddySelectionStrategy ?? 'manager_recommended',
            timeOffPresetDays: existing?.timeOffPresetDays ?? null,
            documentChecklist: existing?.documentChecklist ?? [],
            equipmentList: existing?.equipmentList ?? [],
            uniformOptions: existing?.uniformOptions ?? [],
            equipmentLibrary: existing?.equipmentLibrary ?? [],
            uniformLibrary: existing?.uniformLibrary ?? [],
            customActions: existing?.customActions ?? [],
            metadata: existing?.metadata ?? {}
          };

          return {
            ...base,
            ...updates,
            documentChecklist: updates.documentChecklist ?? base.documentChecklist,
            equipmentList: updates.equipmentList ?? base.equipmentList,
            uniformOptions: updates.uniformOptions ?? base.uniformOptions,
            equipmentLibrary: updates.equipmentLibrary ?? base.equipmentLibrary,
            uniformLibrary: updates.uniformLibrary ?? base.uniformLibrary,
            customActions: updates.customActions ?? base.customActions
          };
        };

        const mergeHRFeatures = (
          existing: HRFeatureToggleSettings | undefined,
          updates: PartialHRFeatureToggleSettings | undefined
        ): HRFeatureToggleSettings | undefined => {
          if (!updates) {
            return existing;
          }

          const base = existing
            ? {
                employees: { ...existing.employees },
                attendance: { ...existing.attendance },
                onboarding: { ...existing.onboarding },
                payroll: existing.payroll,
                recruitment: existing.recruitment,
                performance: existing.performance,
                benefits: existing.benefits
              }
            : createDefaultHRFeatureToggleSettings();

          const next: HRFeatureToggleSettings = {
            employees: {
              ...base.employees,
              ...(updates.employees ?? {})
            },
            attendance: {
              ...base.attendance,
              ...(updates.attendance ?? {})
            },
            onboarding: {
              ...base.onboarding,
              ...(updates.onboarding ?? {})
            },
            payroll: typeof updates.payroll === 'boolean' ? updates.payroll : base.payroll,
            recruitment: typeof updates.recruitment === 'boolean' ? updates.recruitment : base.recruitment,
            performance: typeof updates.performance === 'boolean' ? updates.performance : base.performance,
            benefits: typeof updates.benefits === 'boolean' ? updates.benefits : base.benefits
          };

          return next;
        };

        return {
          ...prev,
          [moduleId]: {
            permissions: newSettings.permissions ?? currentModule.permissions ?? [],
            storage: newSettings.storage
              ? {
                  quota: newSettings.storage.quota ?? currentModule.storage?.quota ?? 1000,
                  compression: newSettings.storage.compression ?? currentModule.storage?.compression ?? false,
                  backup: newSettings.storage.backup ?? currentModule.storage?.backup ?? false
                }
              : currentModule.storage,
            notifications: newSettings.notifications
              ? {
                  email: newSettings.notifications.email ?? currentModule.notifications?.email ?? false,
                  push: newSettings.notifications.push ?? currentModule.notifications?.push ?? false,
                  frequency: newSettings.notifications.frequency ?? currentModule.notifications?.frequency ?? 'immediate'
                }
              : currentModule.notifications,
            security: newSettings.security
              ? {
                  encryption: newSettings.security.encryption ?? currentModule.security?.encryption ?? false,
                  auditLog: newSettings.security.auditLog ?? currentModule.security?.auditLog ?? false,
                  accessControl: newSettings.security.accessControl ?? currentModule.security?.accessControl ?? 'moderate'
                }
              : currentModule.security,
            integrations: newSettings.integrations
              ? {
                  externalServices:
                    newSettings.integrations.externalServices ??
                    currentModule.integrations?.externalServices ??
                    [],
                  webhooks: newSettings.integrations.webhooks ?? currentModule.integrations?.webhooks ?? false,
                  apiAccess: newSettings.integrations.apiAccess ?? currentModule.integrations?.apiAccess ?? false
                }
              : currentModule.integrations,
            onboarding: mergeOnboardingConfig(currentModule.onboarding, newSettings.onboarding),
            hrFeatures: mergeHRFeatures(currentModule.hrFeatures, newSettings.hrFeatures)
          }
        };
      });

      // Save to backend
      await configureModule(
        moduleId,
        {
          enabled: true,
          settings: newSettings as Record<string, unknown>,
          permissions: newSettings.permissions || []
        },
        businessId
          ? {
              scope: 'business',
              businessId
            }
          : undefined
      );

      toast.success('Module settings updated successfully');
    } catch (err) {
      // Rollback on error
      setSettings(prev => ({
        ...prev,
        [moduleId]: prev[moduleId] || {}
      }));
      
      setError(err instanceof Error ? err.message : 'Failed to update module settings');
      toast.error('Failed to update module settings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // Get module settings
  const getModuleSettings = useCallback((moduleId: string) => {
    return settings[moduleId];
  }, [settings]);

  // Reset module settings
  const resetModuleSettings = useCallback((moduleId: string) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      delete newSettings[moduleId];
      return newSettings;
    });
    toast.success('Module settings reset');
  }, []);

  const value: ModuleSettingsContextType = {
    settings,
    loading,
    error,
    updateModuleSettings,
    getModuleSettings,
    resetModuleSettings
  };

  return (
    <ModuleSettingsContext.Provider value={value}>
      {children}
    </ModuleSettingsContext.Provider>
  );
}

export function useModuleSettings() {
  const context = useContext(ModuleSettingsContext);
  if (context === undefined) {
    throw new Error('useModuleSettings must be used within a ModuleSettingsProvider');
  }
  return context;
}
