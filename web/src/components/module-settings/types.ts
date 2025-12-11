export interface ModuleStorageConfig {
  quota: number;
  compression: boolean;
  backup: boolean;
}

export interface ModuleNotificationConfig {
  email: boolean;
  push: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
}

export interface ModuleSecurityConfig {
  encryption: boolean;
  auditLog: boolean;
  accessControl: 'strict' | 'moderate' | 'open';
}

export interface ModuleIntegrationConfig {
  externalServices: string[];
  webhooks: boolean;
  apiAccess: boolean;
}

export interface HRFeatureToggleSettings {
  employees: {
    enabled: boolean;
    customFields: boolean;
  };
  attendance: {
    enabled: boolean;
    clockInOut: boolean;
    geolocation: boolean;
  };
  onboarding: {
    enabled: boolean;
    automation: boolean;
  };
  payroll: boolean;
  recruitment: boolean;
  performance: boolean;
  benefits: boolean;
}

export type OnboardingOwnerRole = 'HR_ADMIN' | 'BUSINESS_ADMIN' | 'MANAGER' | 'IT' | 'CUSTOM';

export interface OnboardingChecklistItem {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  driveFileId?: string;
  driveFileName?: string;
  driveFileType?: string;
  driveFileUrl?: string;
}

export interface OnboardingEquipmentItem {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  catalogItemId?: string;
  sku?: string;
  instructions?: string;
}

export interface OnboardingUniformOption {
  id: string;
  name: string;
  description?: string;
  sizes?: string[];
  color?: string;
  required: boolean;
  catalogItemId?: string;
}

export interface OnboardingCustomActionStep {
  id: string;
  label: string;
  description?: string;
}

export interface OnboardingCustomChecklistItem {
  id: string;
  name: string;
  description?: string;
  actions: OnboardingCustomActionStep[];
  required: boolean;
}

export interface OnboardingEquipmentLibraryItem {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  instructions?: string;
}

export interface OnboardingUniformCatalogItem {
  id: string;
  name: string;
  description?: string;
  sizes: string[];
  color?: string;
  notes?: string;
}

export interface OnboardingModuleConfig {
  ownerUserId?: string | null;
  ownerRole?: OnboardingOwnerRole;
  ownerNotes?: string | null;
  defaultTemplateId?: string | null;
  buddyProgramEnabled?: boolean;
  buddySelectionStrategy?: 'manager_recommended' | 'auto_assign' | 'manual';
  timeOffPresetDays?: number | null;
  documentChecklist: OnboardingChecklistItem[];
  equipmentList: OnboardingEquipmentItem[];
  uniformOptions: OnboardingUniformOption[];
  equipmentLibrary: OnboardingEquipmentLibraryItem[];
  uniformLibrary: OnboardingUniformCatalogItem[];
  customActions: OnboardingCustomChecklistItem[];
  metadata?: Record<string, unknown>;
}

export interface ModuleConfig {
  permissions: string[];
  storage?: ModuleStorageConfig;
  notifications?: ModuleNotificationConfig;
  security?: ModuleSecurityConfig;
  integrations?: ModuleIntegrationConfig;
  onboarding?: OnboardingModuleConfig;
  hrFeatures?: HRFeatureToggleSettings;
}

export type PartialHRFeatureToggleSettings = Partial<HRFeatureToggleSettings> & {
  employees?: Partial<HRFeatureToggleSettings['employees']>;
  attendance?: Partial<HRFeatureToggleSettings['attendance']>;
  onboarding?: Partial<HRFeatureToggleSettings['onboarding']>;
};

export const createDefaultHRFeatureToggleSettings = (): HRFeatureToggleSettings => ({
  employees: {
    enabled: true,
    customFields: false
  },
  attendance: {
    enabled: true,
    clockInOut: false,
    geolocation: false
  },
  onboarding: {
    enabled: true,
    automation: false
  },
  payroll: false,
  recruitment: false,
  performance: false,
  benefits: false
});

