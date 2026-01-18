import { authenticatedApiCall } from '@/lib/apiUtils';

export interface OnboardingAnalytics {
  overview: {
    totalJourneys: number;
    activeJourneys: number;
    completedJourneys: number;
    averageCompletionDays: number | null;
  };
  completionRates: {
    overall: number;
    byDepartment: Array<{ department: string; rate: number; count: number }>;
    byPosition: Array<{ position: string; rate: number; count: number }>;
  };
  taskBreakdown: {
    byStatus: Array<{ status: string; count: number }>;
    byType: Array<{ type: string; count: number }>;
  };
  trends: {
    journeysStarted: Array<{ date: string; count: number }>;
    journeysCompleted: Array<{ date: string; count: number }>;
  };
}

export interface AttendanceAnalytics {
  overview: {
    totalEmployees: number;
    activeToday: number;
    clockedInNow: number;
    openExceptions: number;
  };
  trends: {
    daily: Array<{ date: string; clockedIn: number; clockedOut: number; exceptions: number }>;
    weekly: Array<{ week: string; averageAttendance: number; exceptions: number }>;
    monthly: Array<{ month: string; averageAttendance: number; exceptions: number }>;
  };
  exceptions: {
    byType: Array<{ type: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    trends: Array<{ date: string; count: number }>;
  };
  compliance: {
    policyComplianceRate: number;
    averageAttendanceScore: number;
    topPerformers: Array<{ employeeId: string; employeeName: string; score: number }>;
  };
}

export interface TimeOffAnalytics {
  overview: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    deniedRequests: number;
  };
  usage: {
    byType: Array<{ type: string; daysUsed: number; requests: number }>;
    byDepartment: Array<{ department: string; daysUsed: number; employees: number }>;
    balanceTrends: Array<{ date: string; averageBalance: number }>;
  };
  approval: {
    averageApprovalTimeHours: number;
    approvalTimeByType: Array<{ type: string; averageHours: number }>;
    pendingOverdue: number;
  };
  utilization: {
    departmentUtilization: Array<{ department: string; utilizationRate: number }>;
    peakPeriods: Array<{ period: string; requests: number }>;
  };
}

const buildQuery = (businessId: string, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  params.append('businessId', businessId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  return params.toString();
};

export async function getOnboardingAnalytics(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<OnboardingAnalytics> {
  const query = buildQuery(businessId, startDate, endDate);
  return authenticatedApiCall<OnboardingAnalytics>(
    `/api/hr/admin/analytics/onboarding?${query}`,
    { method: 'GET' }
  );
}

export async function getAttendanceAnalytics(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<AttendanceAnalytics> {
  const query = buildQuery(businessId, startDate, endDate);
  return authenticatedApiCall<AttendanceAnalytics>(
    `/api/hr/admin/analytics/attendance?${query}`,
    { method: 'GET' }
  );
}

export async function getTimeOffAnalytics(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<TimeOffAnalytics> {
  const query = buildQuery(businessId, startDate, endDate);
  return authenticatedApiCall<TimeOffAnalytics>(
    `/api/hr/admin/analytics/time-off?${query}`,
    { method: 'GET' }
  );
}

