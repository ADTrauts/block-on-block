import { authenticatedApiCall } from '@/lib/apiUtils';

// Types for the org chart system

// Permission and module data structures
export interface PermissionData {
  id: string;
  name: string;
  description: string;
  moduleId: string;
  category: 'basic' | 'advanced' | 'admin';
  action: string;
  resource: string;
  dependencies?: string[];
}

export interface ModuleData {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface PermissionCheckDetails {
  source: 'position' | 'tier' | 'department' | 'custom' | 'inherited';
  level: string;
  grantedAt: string;
  expiresAt?: string;
}

export interface OrganizationalTier {
  id: string;
  businessId: string;
  name: string;
  level: number;
  description?: string;
  defaultPermissions: PermissionData[];
  defaultModules: ModuleData[];
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  parentDepartmentId?: string;
  parentDepartment?: Department;
  childDepartments?: Department[];
  headPositionId?: string;
  headPosition?: Position;
  departmentModules: ModuleData[];
  departmentPermissions: PermissionData[];
  positions?: Position[];
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  tierId: string;
  tier: OrganizationalTier;
  departmentId?: string;
  department?: Department;
  capacity: number;
  currentEmployees: number;
  permissions: PermissionData[];
  permissionSets: PermissionSet[];
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  businessId: string;
  name: string;
  description: string;
  moduleId: string;
  category: 'basic' | 'advanced' | 'admin';
  action: string;
  resource: string;
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionSet {
  id: string;
  businessId: string;
  name: string;
  description: string;
  permissions: PermissionData[];
  isTemplate: boolean;
  templateType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeePosition {
  id: string;
  businessId: string;
  userId: string;
  positionId: string;
  position: Position;
  assignedById?: string;
  assignedBy: UserData;
  effectiveDate: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrgChartStructure {
  tiers: OrganizationalTier[];
  departments: Department[];
  positions: Position[];
  hierarchy: {
    departments: Department[];
    positions: Position[];
  };
}

export interface CreateOrganizationalTierData {
  businessId: string;
  name: string;
  level: number;
  description?: string;
  defaultPermissions: PermissionData[];
  defaultModules: ModuleData[];
}

export interface CreateDepartmentData {
  businessId: string;
  name: string;
  description?: string;
  parentDepartmentId?: string;
  headPositionId?: string;
  departmentModules: ModuleData[];
  departmentPermissions: PermissionData[];
}

export interface CreatePositionData {
  businessId: string;
  title: string;
  description?: string;
  tierId: string;
  departmentId?: string;
  reportsToId?: string;
  maxOccupants?: number;
  permissions?: PermissionData[];
  assignedModules?: any;
  customPermissions?: any;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

export interface CreatePermissionData {
  businessId: string;
  name: string;
  description: string;
  moduleId: string;
  category: 'basic' | 'advanced' | 'admin';
  action: string;
  resource: string;
  dependencies?: string[];
}

export interface CreatePermissionSetData {
  businessId: string;
  name: string;
  description: string;
  permissions: PermissionData[];
  isTemplate?: boolean;
  templateType?: string;
}

export interface AssignEmployeeData {
  businessId: string;
  userId: string;
  positionId: string;
  assignedById: string;
  effectiveDate?: string;
}

export interface PermissionCheckResult {
  hasPermission: boolean;
  source: 'position' | 'tier' | 'department' | 'custom' | 'inherited';
  level: string;
  details: PermissionCheckDetails;
}

export interface UserPermissions {
  userId: string;
  businessId: string;
  permissions: PermissionData[];
  positionPermissions: PermissionData[];
  customPermissions: PermissionData[];
  inheritedPermissions: PermissionData[];
}

// Helper function to make authenticated API calls
async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}, 
  token?: string
): Promise<T> {
  return authenticatedApiCall<T>(`/api/org-chart${endpoint}`, options, token);
}

// Organizational Tier API functions
export const createOrganizationalTier = async (
  data: CreateOrganizationalTierData,
  token: string
): Promise<{ success: boolean; data: OrganizationalTier }> => {
  return apiCall('/tiers', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
};

export const getOrganizationalTiers = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: OrganizationalTier[] }> => {
  return apiCall(`/tiers/${businessId}`, { method: 'GET' }, token);
};

export const updateOrganizationalTier = async (
  tierId: string,
  data: Partial<CreateOrganizationalTierData>,
  token: string
): Promise<{ success: boolean; data: OrganizationalTier }> => {
  return apiCall(`/tiers/${tierId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
};

export const deleteOrganizationalTier = async (
  tierId: string,
  token: string
): Promise<{ success: boolean }> => {
  return apiCall(`/tiers/${tierId}`, { method: 'DELETE' }, token);
};

// Department API functions
export const createDepartment = async (
  data: CreateDepartmentData,
  token: string
): Promise<{ success: boolean; data: Department }> => {
  return apiCall('/departments', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
};

export const getDepartments = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: Department[] }> => {
  return apiCall(`/departments/${businessId}`, { method: 'GET' }, token);
};

export const getDepartmentHierarchy = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: Department[] }> => {
  return apiCall(`/departments/${businessId}/hierarchy`, { method: 'GET' }, token);
};

export const updateDepartment = async (
  departmentId: string,
  data: Partial<CreateDepartmentData>,
  token: string
): Promise<{ success: boolean; data: Department }> => {
  return apiCall(`/departments/${departmentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
};

export const deleteDepartment = async (
  departmentId: string,
  token: string
): Promise<{ success: boolean }> => {
  return apiCall(`/departments/${departmentId}`, { method: 'DELETE' }, token);
};

// Position API functions
export const createPosition = async (
  data: CreatePositionData,
  token: string
): Promise<{ success: boolean; data: Position }> => {
  return apiCall('/positions', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
};

export const getPositions = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: Position[] }> => {
  return apiCall(`/positions/${businessId}`, { method: 'GET' }, token);
};

export const updatePosition = async (
  positionId: string,
  data: Partial<CreatePositionData>,
  token: string
): Promise<{ success: boolean; data: Position }> => {
  return apiCall(`/positions/${positionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
};

export const deletePosition = async (
  positionId: string,
  token: string
): Promise<{ success: boolean }> => {
  return apiCall(`/positions/${positionId}`, { method: 'DELETE' }, token);
};

// Permission API functions
export const createPermission = async (
  data: CreatePermissionData,
  token: string
): Promise<{ success: boolean; data: Permission }> => {
  return apiCall('/permissions', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
};

export const getPermissions = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: Permission[] }> => {
  return apiCall(`/permissions/${businessId}`, { method: 'GET' }, token);
};

export const getPermissionsByModule = async (
  businessId: string,
  moduleId: string,
  token: string
): Promise<{ success: boolean; data: Permission[] }> => {
  return apiCall(`/permissions/${businessId}/module/${moduleId}`, { method: 'GET' }, token);
};

export const getPermissionsByCategory = async (
  businessId: string,
  category: string,
  token: string
): Promise<{ success: boolean; data: Permission[] }> => {
  return apiCall(`/permissions/${businessId}/category/${category}`, { method: 'GET' }, token);
};

export const updatePermission = async (
  permissionId: string,
  data: Partial<CreatePermissionData>,
  token: string
): Promise<{ success: boolean; data: Permission }> => {
  return apiCall(`/permissions/${permissionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
};

export const deletePermission = async (
  permissionId: string,
  token: string
): Promise<{ success: boolean }> => {
  return apiCall(`/permissions/${permissionId}`, { method: 'DELETE' }, token);
};

// Permission Set API functions
export const createPermissionSet = async (
  data: CreatePermissionSetData,
  token: string
): Promise<{ success: boolean; data: PermissionSet }> => {
  return apiCall('/permission-sets', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
};

export const getPermissionSets = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: PermissionSet[] }> => {
  return apiCall(`/permission-sets/${businessId}`, { method: 'GET' }, token);
};

export const getTemplatePermissionSets = async (
  token: string
): Promise<{ success: boolean; data: PermissionSet[] }> => {
  return apiCall('/permission-sets/templates', { method: 'GET' }, token);
};

export const copyPermissionSet = async (
  permissionSetId: string,
  newName: string,
  businessId: string,
  token: string
): Promise<{ success: boolean; data: PermissionSet }> => {
  return apiCall(`/permission-sets/${permissionSetId}/copy`, {
    method: 'POST',
    body: JSON.stringify({ newName, businessId }),
  }, token);
};

export const updatePermissionSet = async (
  permissionSetId: string,
  data: Partial<CreatePermissionSetData>,
  token: string
): Promise<{ success: boolean; data: PermissionSet }> => {
  return apiCall(`/permission-sets/${permissionSetId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
};

export const deletePermissionSet = async (
  permissionSetId: string,
  token: string
): Promise<{ success: boolean }> => {
  return apiCall(`/permission-sets/${permissionSetId}`, { method: 'DELETE' }, token);
};

// Employee Management API functions
export const assignEmployeeToPosition = async (
  data: AssignEmployeeData,
  token: string
): Promise<{ success: boolean; data: EmployeePosition }> => {
  return apiCall('/employees/assign', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
};

export const removeEmployeeFromPosition = async (
  userId: string,
  positionId: string,
  businessId: string,
  token: string
): Promise<{ success: boolean }> => {
  return apiCall('/employees/remove', {
    method: 'POST',
    body: JSON.stringify({ userId, positionId, businessId }),
  }, token);
};

export const transferEmployee = async (
  userId: string,
  fromPositionId: string,
  toPositionId: string,
  businessId: string,
  transferredById: string,
  token: string,
  effectiveDate?: string
): Promise<{ success: boolean; data: EmployeePosition }> => {
  return apiCall('/employees/transfer', {
    method: 'POST',
    body: JSON.stringify({ 
      userId, 
      fromPositionId, 
      toPositionId, 
      businessId, 
      transferredById, 
      effectiveDate 
    }),
  }, token);
};

export const getBusinessEmployees = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: EmployeePosition[] }> => {
  return apiCall(`/employees/${businessId}`, { method: 'GET' }, token);
};

export const getVacantPositions = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: Position[] }> => {
  return apiCall(`/employees/${businessId}/vacant`, { method: 'GET' }, token);
};

// Org Chart Structure API functions
export const getOrgChartStructure = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: OrgChartStructure }> => {
  return apiCall(`/structure/${businessId}`, { method: 'GET' }, token);
};

export const createDefaultOrgChart = async (
  businessId: string,
  token: string,
  industry?: string
): Promise<{ success: boolean }> => {
  return apiCall(`/structure/${businessId}/default`, {
    method: 'POST',
    body: JSON.stringify({ industry }),
  }, token);
};

export const validateOrgChartStructure = async (
  businessId: string,
  token: string
): Promise<{ success: boolean; data: { isValid: boolean; errors: string[]; warnings: string[] } }> => {
  return apiCall(`/structure/${businessId}/validate`, { method: 'GET' }, token);
};

// Permission Check API functions
export const checkUserPermission = async (
  userId: string,
  businessId: string,
  moduleId: string,
  featureId: string,
  action: string,
  token: string
): Promise<{ success: boolean; data: PermissionCheckResult }> => {
  return apiCall(`/permissions/check`, {
    method: 'POST',
    body: JSON.stringify({ userId, businessId, moduleId, featureId, action }),
  }, token);
};

export const getUserPermissions = async (
  userId: string,
  businessId: string,
  token: string
): Promise<{ success: boolean; data: UserPermissions }> => {
  return apiCall(`/permissions/user/${userId}/${businessId}`, { method: 'GET' }, token);
};
