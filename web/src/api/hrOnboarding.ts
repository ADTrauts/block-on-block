import { authenticatedApiCall } from '@/lib/apiUtils';

export type OnboardingTaskType = 'DOCUMENT' | 'EQUIPMENT' | 'TRAINING' | 'MEETING' | 'FORM' | 'CUSTOM';
export type OnboardingTaskOwnerType = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'BUDDY' | 'IT' | 'OTHER';
export type OnboardingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type OnboardingJourneyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface OnboardingTaskTemplate {
  id: string;
  onboardingTemplateId: string;
  businessId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  taskType: OnboardingTaskType;
  ownerType: OnboardingTaskOwnerType;
  ownerReference: string | null;
  dueOffsetDays: number | null;
  requiresApproval: boolean;
  requiresDocument: boolean;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
}

export interface OnboardingTemplate {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  ownerUserId: string | null;
  applicabilityRules: Record<string, unknown> | null;
  automationSettings: Record<string, unknown> | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
  taskTemplates: OnboardingTaskTemplate[];
}

export interface UpsertOnboardingTaskTemplateInput {
  id?: string;
  title: string;
  description?: string | null;
  orderIndex?: number | null;
  taskType?: OnboardingTaskType;
  ownerType?: OnboardingTaskOwnerType;
  ownerReference?: string | null;
  dueOffsetDays?: number | null;
  requiresApproval?: boolean;
  requiresDocument?: boolean;
  metadata?: Record<string, unknown> | null;
  isActive?: boolean;
}

export interface UpsertOnboardingTemplateInput {
  id?: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  ownerUserId?: string | null;
  applicabilityRules?: Record<string, unknown> | null;
  automationSettings?: Record<string, unknown> | null;
  tasks?: UpsertOnboardingTaskTemplateInput[];
}

export interface EmployeeOnboardingTask {
  id: string;
  onboardingJourneyId: string;
  businessId: string;
  onboardingTaskTemplateId: string | null;
  title: string;
  description: string | null;
  taskType: OnboardingTaskType;
  ownerType: OnboardingTaskOwnerType;
  ownerReference: string | null;
  assignedToUserId: string | null;
  dueDate: string | null;
  status: OnboardingTaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  requiresApproval: boolean;
  approvedAt: string | null;
  approvedByUserId: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  orderIndex: number;
}

export interface EmployeeOnboardingJourney {
  id: string;
  businessId: string;
  employeeHrProfileId: string;
  onboardingTemplateId: string | null;
  status: OnboardingJourneyStatus;
  startDate: string;
  completionDate: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  metadata: Record<string, unknown> | null;
  onboardingTemplate?: OnboardingTemplate | null;
  tasks: EmployeeOnboardingTask[];
}

export interface EmployeeOnboardingProfile {
  id: string;
  businessId: string;
  employeePositionId: string;
  employeePosition?: {
    id: string;
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    position?: {
      id: string;
      title: string;
      department?: { id: string; name: string | null } | null;
    } | null;
  } | null;
}

export interface TeamOnboardingTask extends EmployeeOnboardingTask {
  onboardingJourney: EmployeeOnboardingJourney & {
    employeeHrProfile: EmployeeOnboardingProfile;
  };
}

export interface CompleteOnboardingTaskPayload {
  status?: OnboardingTaskStatus;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  approved?: boolean;
  approvedByUserId?: string | null;
}

export interface HRFeatureAvailabilityResponse {
  tier: 'business_advanced' | 'enterprise' | string;
  features: {
    employees: {
      enabled: boolean;
      limit: number | null;
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
  };
}

export interface OnboardingDocumentLibraryFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingDocumentLibraryResponse {
  folderId: string;
  dashboardId: string;
  files: OnboardingDocumentLibraryFile[];
}

const buildQuery = (businessId: string) => {
  const params = new URLSearchParams();
  params.append('businessId', businessId);
  return params.toString();
};

export async function listOnboardingTemplates(businessId: string): Promise<OnboardingTemplate[]> {
  const query = buildQuery(businessId);
  const response = await authenticatedApiCall<{ templates: OnboardingTemplate[] }>(
    `/api/hr/admin/onboarding/templates?${query}`,
    { method: 'GET' }
  );
  return response.templates;
}

export async function createOnboardingTemplate(
  businessId: string,
  payload: UpsertOnboardingTemplateInput
): Promise<OnboardingTemplate> {
  const query = buildQuery(businessId);
  const response = await authenticatedApiCall<{ template: OnboardingTemplate }>(
    `/api/hr/admin/onboarding/templates?${query}`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
  return response.template;
}

export async function updateOnboardingTemplate(
  businessId: string,
  templateId: string,
  payload: UpsertOnboardingTemplateInput
): Promise<OnboardingTemplate> {
  const query = buildQuery(businessId);
  const response = await authenticatedApiCall<{ template: OnboardingTemplate }>(
    `/api/hr/admin/onboarding/templates/${templateId}?${query}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload)
    }
  );
  return response.template;
}

export async function archiveOnboardingTemplate(
  businessId: string,
  templateId: string
): Promise<void> {
  const query = buildQuery(businessId);
  await authenticatedApiCall<{ success: boolean }>(
    `/api/hr/admin/onboarding/templates/${templateId}?${query}`,
    { method: 'DELETE' }
  );
}

export async function getMyOnboardingJourneys(
  businessId: string
): Promise<{ profile: EmployeeOnboardingProfile | null; journeys: EmployeeOnboardingJourney[] }> {
  const query = buildQuery(businessId);
  const response = await authenticatedApiCall<{
    profile: EmployeeOnboardingProfile | null;
    journeys: EmployeeOnboardingJourney[];
  }>(`/api/hr/me/onboarding/journeys?${query}`, { method: 'GET' });
  return response;
}

export async function completeMyOnboardingTask(
  businessId: string,
  taskId: string,
  payload: CompleteOnboardingTaskPayload
): Promise<EmployeeOnboardingTask> {
  const query = buildQuery(businessId);
  const response = await authenticatedApiCall<{ task: EmployeeOnboardingTask }>(
    `/api/hr/me/onboarding/tasks/${taskId}?${query}`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
  return response.task;
}

export async function getTeamOnboardingTasks(
  businessId: string
): Promise<{ tasks: TeamOnboardingTask[] }> {
  const query = buildQuery(businessId);
  return authenticatedApiCall<{ tasks: TeamOnboardingTask[] }>(
    `/api/hr/team/onboarding/tasks?${query}`,
    { method: 'GET' }
  );
}

export async function completeTeamOnboardingTask(
  businessId: string,
  taskId: string,
  payload: CompleteOnboardingTaskPayload
): Promise<EmployeeOnboardingTask> {
  const query = buildQuery(businessId);
  const response = await authenticatedApiCall<{ task: EmployeeOnboardingTask }>(
    `/api/hr/team/onboarding/tasks/${taskId}?${query}`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
  return response.task;
}

export async function getHRFeatureAvailability(businessId: string): Promise<HRFeatureAvailabilityResponse> {
  const query = buildQuery(businessId);
  return authenticatedApiCall<HRFeatureAvailabilityResponse>(
    `/api/hr/admin/features?${query}`,
    { method: 'GET' }
  );
}

export async function getOnboardingDocumentLibrary(
  businessId: string
): Promise<OnboardingDocumentLibraryResponse> {
  const query = buildQuery(businessId);
  return authenticatedApiCall<OnboardingDocumentLibraryResponse>(
    `/api/hr/admin/onboarding/documents/library?${query}`,
    { method: 'GET' }
  );
}

