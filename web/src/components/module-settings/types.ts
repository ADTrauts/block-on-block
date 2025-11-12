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

export type OnboardingOwnerRole = 'HR_ADMIN' | 'BUSINESS_ADMIN' | 'MANAGER' | 'IT' | 'CUSTOM';

export interface OnboardingChecklistItem {
  id: string;
  title: string;
  description?: string;
  required: boolean;
}

export interface OnboardingEquipmentItem {
  id: string;
  name: string;
  description?: string;
  required: boolean;
}

export interface OnboardingUniformOption {
  id: string;
  name: string;
  sizes?: string[];
  required: boolean;
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
  metadata?: Record<string, unknown>;
}

export interface ModuleConfig {
  permissions: string[];
  storage?: ModuleStorageConfig;
  notifications?: ModuleNotificationConfig;
  security?: ModuleSecurityConfig;
  integrations?: ModuleIntegrationConfig;
  onboarding?: OnboardingModuleConfig;
}

