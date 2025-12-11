import { authenticatedApiCall } from '../lib/apiUtils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Schedule {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  locationId?: string;
  startDate: string;
  endDate: string;
  timezone: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
  publishedById?: string;
  publishedBy?: {
    id: string;
    name: string;
    email: string;
  };
  templateId?: string;
  layoutMode?: 'employee' | 'position' | 'station';
  viewMode?: 'week' | 'day' | 'month' | 'coverage';
  metadata?: Record<string, unknown>;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  shifts?: ScheduleShift[];
}

export interface ScheduleShift {
  id: string;
  businessId: string;
  scheduleId: string;
  schedule?: {
    id: string;
    name: string;
  };
  employeePositionId?: string;
  employeePosition?: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
    position: {
      title: string;
    };
  };
  positionId?: string;
  position?: {
    id: string;
    title: string;
  };
  shiftTemplateId?: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes?: string;
  locationId?: string;
  location?: {
    id: string;
    name: string;
    address?: Record<string, unknown> | null;
    description?: string | null;
  };
  stationName?: string;
  jobFunction?: string;
  color?: string;
  status: 'ASSIGNED' | 'OPEN' | 'COVERED' | 'SWAPPED' | 'CANCELED' | 'FILLED';
  createdAt: string;
  updatedAt: string;
}

export interface ShiftTemplate {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  defaultDurationMinutes: number;
  defaultBreakMinutes: number;
  defaultPositionId?: string;
  daysOfWeek: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  position?: {
    id: string;
    title: string;
  };
}

export interface EmployeeAvailability {
  id: string;
  businessId: string;
  employeePositionId: string;
  employeePosition?: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
    position?: {
      id: string;
      title: string;
    };
  };
  dayOfWeek: string; // "MONDAY", "TUESDAY", etc.
  startTime: string; // "08:00" (HH:MM format)
  endTime: string; // "17:00" (HH:MM format)
  availabilityType: 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';
  recurring: boolean;
  notes?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftSwapRequest {
  id: string;
  businessId: string;
  originalShiftId: string;
  originalShift: ScheduleShift & {
    schedule?: {
      id: string;
      name: string;
    };
  };
  requestedById: string;
  requestedBy: {
    id: string;
    name: string;
    email: string;
  };
  requestedToId?: string;
  requestedTo?: {
    id: string;
    name: string;
    email: string;
  };
  coveredShiftId?: string;
  coveredShift?: ScheduleShift;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED' | 'EXPIRED';
  requestNotes?: string;
  approvedById?: string;
  approvedBy?: {
    id: string;
    name: string;
    email: string;
  };
  approvedAt?: string;
  managerNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleTemplate {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  scheduleType: string; // Format: "7_DAYS", "14_DAYS", "30_DAYS", etc. or legacy "WEEKLY", "BIWEEKLY", "MONTHLY"
  templateData: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function authHeaders(token: string, headers: Record<string, string> = {}) {
  return { ...headers, Authorization: `Bearer ${token}` };
}

// ============================================================================
// ADMIN API CALLS
// ============================================================================

export const getSchedules = async (businessId: string, token?: string): Promise<Schedule[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedules?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Failed to fetch schedules:', { status: res.status, error: errorData });
    throw new Error(errorData.message || 'Failed to fetch schedules');
  }
  const data = await res.json();
  return data.schedules || data;
};

export const getScheduleById = async (businessId: string, scheduleId: string, token?: string): Promise<Schedule> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedules/${scheduleId}?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch schedule');
  return res.json();
};

export const createSchedule = async (
  businessId: string,
  scheduleData: {
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    timezone?: string;
    locationId?: string;
    templateId?: string; // Optional: create schedule from template
  },
  token?: string
): Promise<Schedule> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedules?businessId=${businessId}`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ businessId, ...scheduleData }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create schedule');
  }
  return res.json();
};

export const updateSchedule = async (
  businessId: string,
  scheduleId: string,
  scheduleData: Partial<Schedule>,
  token?: string
): Promise<Schedule> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedules/${scheduleId}?businessId=${businessId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(scheduleData),
  });
  if (!res.ok) throw new Error('Failed to update schedule');
  return res.json();
};

export const deleteSchedule = async (businessId: string, scheduleId: string, token?: string): Promise<void> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedules/${scheduleId}?businessId=${businessId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete schedule');
};

export const publishSchedule = async (businessId: string, scheduleId: string, token?: string): Promise<Schedule> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedules/${scheduleId}/publish?businessId=${businessId}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Failed to publish schedule' }));
    throw new Error(errorData.error || errorData.message || 'Failed to publish schedule');
  }
  const data = await res.json();
  return data.schedule || data;
};

// Shifts
export const getShifts = async (businessId: string, scheduleId?: string, token?: string): Promise<ScheduleShift[]> => {
  if (!token) throw new Error('Authentication required');
  const url = scheduleId 
    ? `/api/scheduling/admin/shifts?businessId=${businessId}&scheduleId=${scheduleId}`
    : `/api/scheduling/admin/shifts?businessId=${businessId}`;
  const res = await fetch(url, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch shifts');
  const data = await res.json();
  return data.shifts || data;
};

export const createShift = async (
  businessId: string,
  shiftData: {
    scheduleId: string;
    title: string;
    employeePositionId?: string;
    positionId?: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    notes?: string;
    shiftTemplateId?: string;
    stationName?: string;
    jobFunction?: string;
    color?: string;
  },
  token?: string
): Promise<ScheduleShift> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/shifts?businessId=${businessId}`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ businessId, ...shiftData }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error || `Failed to create shift (${res.status})`;
    console.error('❌ Shift creation error:', errorMessage, errorData);
    const error: Error & { conflict?: { message?: string; employeeName?: string; type?: string } } = new Error(errorMessage);
    if (errorData.conflict) {
      error.conflict = errorData.conflict;
    }
    throw error;
  }
  const data = await res.json();
  return data.shift || data;
};

export const updateShift = async (
  businessId: string,
  shiftId: string,
  shiftData: Partial<ScheduleShift>,
  token?: string
): Promise<ScheduleShift> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/shifts/${shiftId}?businessId=${businessId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(shiftData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error || `Failed to update shift (${res.status})`;
    console.error('❌ Shift update error:', errorMessage, errorData);
    const error: Error & { conflict?: { message?: string; employeeName?: string; type?: string } } = new Error(errorMessage);
    if (errorData.conflict) {
      error.conflict = errorData.conflict;
    }
    throw error;
  }
  const data = await res.json();
  return data.shift || data;
};

export const deleteShift = async (businessId: string, shiftId: string, token?: string): Promise<void> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/shifts/${shiftId}?businessId=${businessId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete shift');
};

// Shift Templates
export const getShiftTemplates = async (businessId: string, token?: string): Promise<ShiftTemplate[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/templates?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Failed to fetch templates:', { status: res.status, error: errorData });
    throw new Error(errorData.message || 'Failed to fetch templates');
  }
  const data = await res.json();
  return data.templates || data;
};

export const createShiftTemplate = async (
  businessId: string,
  templateData: {
    name: string;
    description?: string;
    defaultDurationMinutes: number;
    defaultBreakMinutes?: number;
    defaultPositionId?: string;
    daysOfWeek?: string[];
    isActive?: boolean;
  },
  token?: string
): Promise<ShiftTemplate> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/templates?businessId=${businessId}`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ businessId, ...templateData }),
  });
  if (!res.ok) throw new Error('Failed to create template');
  return res.json();
};

// Schedule Templates
export const getScheduleTemplates = async (businessId: string, token?: string): Promise<ScheduleTemplate[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedule-templates?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Failed to fetch schedule templates:', { status: res.status, error: errorData });
    throw new Error(errorData.message || 'Failed to fetch schedule templates');
  }
  const data = await res.json();
  return data.templates || data;
};

export const getScheduleTemplateById = async (templateId: string, token?: string): Promise<ScheduleTemplate> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedule-templates/${templateId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch schedule template');
  }
  return res.json().then(data => data.template || data);
};

export const createScheduleTemplate = async (
  businessId: string,
  templateData: {
    name: string;
    description?: string;
    scheduleType: string; // Format: "7_DAYS", "14_DAYS", etc. or legacy "WEEKLY", "BIWEEKLY", "MONTHLY"
    templateData?: Record<string, unknown>;
    sourceScheduleId?: string;
  },
  token?: string
): Promise<ScheduleTemplate> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedule-templates?businessId=${businessId}`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ businessId, ...templateData }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create schedule template');
  }
  return res.json().then(data => data.template || data);
};

export const updateScheduleTemplate = async (
  businessId: string,
  templateId: string,
  templateData: {
    name?: string;
    description?: string;
    scheduleType?: string; // Format: "7_DAYS", "14_DAYS", etc. or legacy "WEEKLY", "BIWEEKLY", "MONTHLY"
    templateData?: Record<string, unknown>;
    isActive?: boolean;
  },
  token?: string
): Promise<ScheduleTemplate> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedule-templates/${templateId}?businessId=${businessId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(templateData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to update schedule template');
  }
  return res.json().then(data => data.template || data);
};

export const deleteScheduleTemplate = async (businessId: string, templateId: string, token?: string): Promise<void> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/schedule-templates/${templateId}?businessId=${businessId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to delete schedule template');
  }
};

// Employee Availability (Admin)
export const getAllEmployeeAvailability = async (businessId: string, token?: string): Promise<EmployeeAvailability[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/availability?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Failed to fetch availability:', { status: res.status, error: errorData });
    throw new Error(errorData.message || 'Failed to fetch availability');
  }
  const data = await res.json();
  return data.availability || data;
};

// Shift Swap Requests (Admin)
export const getAllShiftSwapRequests = async (businessId: string, token?: string): Promise<ShiftSwapRequest[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/swaps?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Failed to fetch swap requests:', { status: res.status, error: errorData });
    throw new Error(errorData.message || 'Failed to fetch swap requests');
  }
  const data = await res.json();
  return data.swaps || data;
};

export const approveShiftSwap = async (
  businessId: string,
  swapId: string,
  managerNotes?: string,
  token?: string,
  scope?: 'admin' | 'manager'
): Promise<void> => {
  if (!token) throw new Error('Authentication required');
  const endpoint = scope === 'manager' 
    ? `/api/scheduling/team/swaps/${swapId}/approve`
    : `/api/scheduling/admin/swaps/${swapId}/approve`;
  const res = await fetch(`${endpoint}?businessId=${businessId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ managerNotes }),
  });
  if (!res.ok) throw new Error('Failed to approve swap');
};

export const denyShiftSwap = async (
  businessId: string,
  swapId: string,
  managerNotes?: string,
  token?: string,
  scope?: 'admin' | 'manager'
): Promise<void> => {
  if (!token) throw new Error('Authentication required');
  const endpoint = scope === 'manager'
    ? `/api/scheduling/team/swaps/${swapId}/deny`
    : `/api/scheduling/admin/swaps/${swapId}/deny`;
  const res = await fetch(`${endpoint}?businessId=${businessId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ managerNotes }),
  });
  if (!res.ok) throw new Error('Failed to deny swap');
};

// ============================================================================
// MANAGER API CALLS
// ============================================================================

export const getTeamSchedules = async (businessId: string, token?: string): Promise<Schedule[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/team/schedules?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch team schedules');
  const data = await res.json();
  return data.schedules || data;
};

export const getOpenShiftsForTeam = async (businessId: string, token?: string): Promise<ScheduleShift[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/team/shifts/open?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch open shifts');
  const data = await res.json();
  return data.shifts || data;
};

export const assignEmployeeToShift = async (
  businessId: string,
  shiftId: string,
  employeePositionId: string,
  token?: string
): Promise<ScheduleShift> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/team/shifts/${shiftId}/assign?businessId=${businessId}`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ employeePositionId }),
  });
  if (!res.ok) throw new Error('Failed to assign employee');
  return res.json();
};

export const getPendingShiftSwapRequestsForTeam = async (businessId: string, token?: string): Promise<ShiftSwapRequest[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/team/swaps/pending?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch pending swaps');
  const data = await res.json();
  return data.swaps || data;
};

// ============================================================================
// EMPLOYEE API CALLS
// ============================================================================

export const getOwnSchedule = async (businessId: string, token?: string): Promise<Schedule[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/me/schedule?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Failed to fetch own schedule:', { status: res.status, error: errorData, hasToken: !!token });
    throw new Error(errorData.message || 'Failed to fetch schedule');
  }
  const data = await res.json();
  return data.schedules || data;
};

export const getOwnAvailability = async (businessId: string, token?: string): Promise<EmployeeAvailability[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/me/availability?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch availability');
  }
  const data = await res.json();
  return data.availability || data;
};

export const setOwnAvailability = async (
  businessId: string,
  availabilityData: {
    dayOfWeek: string;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    availabilityType: 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';
    notes?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    recurring?: boolean;
  },
  token?: string
): Promise<EmployeeAvailability> => {
  // Use the same authenticatedApiCall helper as other working endpoints
  // This ensures the request goes through the Next.js proxy correctly
  const endpoint = `/api/scheduling/me/availability?businessId=${businessId}`;
  
  return authenticatedApiCall<EmployeeAvailability>(endpoint, {
    method: 'POST',
    body: JSON.stringify(availabilityData),
  }, token);
};

export const updateOwnAvailability = async (
  businessId: string,
  availabilityId: string,
  availabilityData: Partial<EmployeeAvailability>,
  token?: string
): Promise<EmployeeAvailability> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/me/availability/${availabilityId}?businessId=${businessId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(availabilityData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to update availability');
  }
  return res.json();
};

export const deleteOwnAvailability = async (businessId: string, availabilityId: string, token?: string): Promise<void> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/me/availability/${availabilityId}?businessId=${businessId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to delete availability');
  }
  return res.json();
};

export const requestShiftSwap = async (
  businessId: string,
  shiftId: string,
  requestData: {
    requestedToId?: string;
    coveredShiftId?: string;
    requestNotes?: string;
  },
  token?: string
): Promise<ShiftSwapRequest> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/me/shifts/${shiftId}/swap/request?businessId=${businessId}`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(requestData),
  });
  if (!res.ok) throw new Error('Failed to request swap');
  return res.json();
};

export const getOwnShiftSwapRequests = async (businessId: string, token?: string): Promise<ShiftSwapRequest[]> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/me/swaps?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Failed to fetch swap requests:', { status: res.status, error: errorData, hasToken: !!token });
    throw new Error(errorData.message || 'Failed to fetch swap requests');
  }
  const data = await res.json();
  return data.swaps || data;
};

export const cancelSwapRequest = async (businessId: string, swapId: string, token?: string): Promise<ShiftSwapRequest> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/me/swap-requests/${swapId}/cancel?businessId=${businessId}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to cancel swap request');
  }
  return res.json();
};

export const getOwnOpenShifts = async (
  businessId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    positionId?: string;
  },
  token?: string
): Promise<ScheduleShift[]> => {
  if (!token) throw new Error('Authentication required');
  const params = new URLSearchParams({ businessId });
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  if (options?.positionId) params.append('positionId', options.positionId);
  
  const res = await fetch(`/api/scheduling/me/open-shifts?${params.toString()}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch open shifts');
  }
  const data = await res.json();
  return data.shifts || data;
};

export const claimOpenShift = async (businessId: string, shiftId: string, token?: string): Promise<ScheduleShift> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/me/shifts/${shiftId}/claim?businessId=${businessId}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to claim shift');
  }
  return res.json();
};

// ============================================================================
// SCHEDULING RECOMMENDATIONS
// ============================================================================

export interface SchedulingRecommendation {
  mode: 'RESTAURANT' | 'HEALTHCARE' | 'RETAIL' | 'MANUFACTURING' | 'OFFICE' | 'COFFEE_SHOP' | 'OTHER';
  strategy: 'AVAILABILITY_FIRST' | 'BUDGET_FIRST' | 'COMPLIANCE_FIRST' | 'TEMPLATE_BASED' | 'AUTO_GENERATE';
  layout: 'employee' | 'position' | 'station';
  defaultStations?: Array<{
    name: string;
    jobFunction: string;
    stationType: string;
    required: boolean;
    description?: string;
  }>;
  shiftPatterns?: {
    typicalShifts: Array<{ start: string; end: string; name: string; description?: string }>;
    peakHours?: Array<{ day: string; hours: string[]; description?: string }>;
  };
  description: string;
  rationale: string[];
}

export interface SchedulingRecommendationsResponse {
  success: boolean;
  recommendation: SchedulingRecommendation;
  currentConfig?: {
    mode: string;
    strategy: string;
  } | null;
  businessIndustry?: string | null;
}

export const getSchedulingRecommendations = async (
  businessId: string,
  industry?: string,
  token?: string
): Promise<SchedulingRecommendationsResponse> => {
  if (!token) throw new Error('Authentication required');
  const params = new URLSearchParams({ businessId });
  if (industry) params.append('industry', industry);
  const res = await fetch(`/api/scheduling/recommendations?${params.toString()}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to get recommendations');
  return res.json();
};

// ============================================================================
// AI-POWERED SCHEDULE GENERATION
// ============================================================================

export interface GenerateAIScheduleRequest {
  businessId: string;
  scheduleId: string;
  strategy?: 'AVAILABILITY_FIRST' | 'BUDGET_FIRST' | 'COMPLIANCE_FIRST' | 'TEMPLATE_BASED' | 'AUTO_GENERATE';
  constraints?: {
    budgetLimit?: number;
    maxHoursPerEmployee?: number;
    minHoursBetweenShifts?: number;
    complianceRules?: string[];
  };
}

export interface GenerateAIScheduleResponse {
  success: boolean;
  message: string;
  shifts: ScheduleShift[];
  recommendations: number;
  created: number;
}

export const generateAISchedule = async (
  request: GenerateAIScheduleRequest,
  token?: string
): Promise<GenerateAIScheduleResponse> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch('/api/scheduling/ai/generate-schedule', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to generate schedule' }));
    throw new Error(error.message || error.error || 'Failed to generate schedule');
  }
  return res.json();
};

export interface SuggestAssignmentsRequest {
  businessId: string;
  scheduleId: string;
  shiftId: string;
}

export interface SuggestAssignmentsResponse {
  success: boolean;
  suggestions: Array<{
    employeePositionId: string;
    employee: {
      id: string;
      name: string;
      position: string;
    };
    confidence: number;
    reason: string;
  }>;
  count: number;
}

export const suggestShiftAssignments = async (
  request: SuggestAssignmentsRequest,
  token?: string
): Promise<SuggestAssignmentsResponse> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch('/api/scheduling/ai/suggest-assignments', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to get suggestions' }));
    throw new Error(error.message || error.error || 'Failed to get suggestions');
  }
  return res.json();
};

// ============================================================================
// BUSINESS STATIONS MANAGEMENT
// ============================================================================

export interface BusinessStation {
  id: string;
  businessId: string;
  name: string;
  stationType: 'BOH' | 'FOH' | 'MANAGEMENT' | 'HEALTHCARE' | 'MANUFACTURING' | 'OTHER';
  jobFunction?: 'GRILL' | 'FRY' | 'PREP' | 'PIZZA' | 'PANTRY' | 'DISH' | 'LINE_COOK' | 'EXPO' | 'COOK' | 'CHEF' | 'SERVER' | 'HOST' | 'RUNNER' | 'BARTENDER' | 'CASHIER' | 'BARISTA' | 'MANAGER_ON_DUTY' | 'SHIFT_LEAD' | 'SUPERVISOR' | 'NURSE' | 'CNA' | 'TECH' | 'DOCTOR' | 'CUSTOM';
  description?: string;
  color?: string;
  isRequired: boolean;
  priority?: number;
  isActive: boolean;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessStationsResponse {
  stations: BusinessStation[];
}

export const getBusinessStations = async (
  businessId: string,
  token?: string
): Promise<BusinessStationsResponse> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/stations?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to fetch stations');
  }
  return res.json();
};

export const createBusinessStation = async (
  businessId: string,
  stationData: {
    name: string;
    stationType: 'BOH' | 'FOH' | 'MANAGEMENT' | 'HEALTHCARE' | 'MANUFACTURING' | 'OTHER';
    jobFunction?: string;
    description?: string;
    color?: string;
    isRequired?: boolean;
    priority?: number;
    defaultStartTime?: string;
    defaultEndTime?: string;
  },
  token?: string
): Promise<{ station: BusinessStation }> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch('/api/scheduling/admin/stations', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...stationData, businessId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to create station');
  }
  return res.json();
};

export const updateBusinessStation = async (
  stationId: string,
  businessId: string,
  stationData: {
    name?: string;
    stationType?: 'BOH' | 'FOH' | 'MANAGEMENT' | 'HEALTHCARE' | 'MANUFACTURING' | 'OTHER';
    jobFunction?: string | null;
    description?: string | null;
    color?: string | null;
    isRequired?: boolean;
    priority?: number | null;
    isActive?: boolean;
    defaultStartTime?: string | null;
    defaultEndTime?: string | null;
  },
  token?: string
): Promise<{ station: BusinessStation }> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/stations/${stationId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...stationData, businessId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to update station');
  }
  return res.json();
};

export const deleteBusinessStation = async (
  stationId: string,
  businessId: string,
  token?: string
): Promise<{ success: boolean; message: string }> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/stations/${stationId}?businessId=${businessId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to delete station');
  }
  return res.json();
};

// ============================================================================
// JOB LOCATIONS
// ============================================================================

export interface JobLocation {
  id: string;
  businessId: string;
  name: string;
  address?: Record<string, unknown> | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobLocationsResponse {
  jobLocations: JobLocation[];
}

export const getBusinessJobLocations = async (
  businessId: string,
  token?: string
): Promise<JobLocationsResponse> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/job-locations?businessId=${businessId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to fetch job locations');
  }
  return res.json();
};

export const createBusinessJobLocation = async (
  businessId: string,
  locationData: {
    name: string;
    address?: Record<string, unknown>;
    description?: string;
    phone?: string;
    email?: string;
    notes?: string;
  },
  token?: string
): Promise<{ location: JobLocation }> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch('/api/scheduling/admin/job-locations', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...locationData, businessId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to create job location');
  }
  return res.json();
};

export const updateBusinessJobLocation = async (
  locationId: string,
  locationData: {
    name?: string;
    address?: Record<string, unknown>;
    description?: string;
    phone?: string;
    email?: string;
    notes?: string;
    isActive?: boolean;
  },
  token?: string
): Promise<{ location: JobLocation }> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/job-locations/${locationId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(locationData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to update job location');
  }
  return res.json();
};

export const deleteBusinessJobLocation = async (
  locationId: string,
  token?: string
): Promise<{ success: boolean; message: string }> => {
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`/api/scheduling/admin/job-locations/${locationId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to delete job location');
  }
  return res.json();
};
