/**
 * HR Analytics Service
 * 
 * Provides analytics and statistics for HR module
 * Used by admin dashboard to display metrics and trends
 */

import { prisma } from '../lib/prisma';
import { OnboardingJourneyStatus, OnboardingTaskStatus, TimeOffStatus, AttendanceExceptionStatus } from '@prisma/client';

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

/**
 * Get onboarding analytics for a business
 */
export async function getOnboardingAnalytics(
  businessId: string,
  startDate?: Date,
  endDate?: Date
): Promise<OnboardingAnalytics> {
  const now = new Date();
  const defaultStartDate = startDate || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // Last 90 days
  const defaultEndDate = endDate || now;

  // Get all journeys in date range
  const journeys = await prisma.employeeOnboardingJourney.findMany({
    where: {
      businessId,
      startDate: { gte: defaultStartDate, lte: defaultEndDate }
    },
    include: {
      tasks: true,
      employeeHrProfile: {
        include: {
          employeePosition: {
            include: {
              position: {
                include: {
                  department: true
                }
              }
            }
          }
        }
      }
    }
  });

  const totalJourneys = journeys.length;
  const activeJourneys = journeys.filter(j => j.status === OnboardingJourneyStatus.IN_PROGRESS).length;
  const completedJourneys = journeys.filter(j => j.status === OnboardingJourneyStatus.COMPLETED).length;

  // Calculate average completion time
  const completedWithDates = journeys.filter(
    j => j.status === OnboardingJourneyStatus.COMPLETED && j.completionDate
  );
  const averageCompletionDays = completedWithDates.length > 0
    ? completedWithDates.reduce((sum, j) => {
        const days = Math.floor(
          (new Date(j.completionDate!).getTime() - new Date(j.startDate).getTime()) / (24 * 60 * 60 * 1000)
        );
        return sum + days;
      }, 0) / completedWithDates.length
    : null;

  // Task breakdown by status
  const allTasks = journeys.flatMap(j => j.tasks);
  const taskByStatus = allTasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const taskByType = allTasks.reduce((acc, task) => {
    acc[task.taskType] = (acc[task.taskType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Completion rates by department
  const departmentStats = new Map<string, { total: number; completed: number }>();
  journeys.forEach(journey => {
    const dept = journey.employeeHrProfile?.employeePosition?.position?.department?.name || 'Unknown';
    const stats = departmentStats.get(dept) || { total: 0, completed: 0 };
    stats.total++;
    if (journey.status === OnboardingJourneyStatus.COMPLETED) {
      stats.completed++;
    }
    departmentStats.set(dept, stats);
  });

  // Completion rates by position
  const positionStats = new Map<string, { total: number; completed: number }>();
  journeys.forEach(journey => {
    const pos = journey.employeeHrProfile?.employeePosition?.position?.title || 'Unknown';
    const stats = positionStats.get(pos) || { total: 0, completed: 0 };
    stats.total++;
    if (journey.status === OnboardingJourneyStatus.COMPLETED) {
      stats.completed++;
    }
    positionStats.set(pos, stats);
  });

  // Trends - journeys started/completed by date
  const journeysStarted = new Map<string, number>();
  const journeysCompleted = new Map<string, number>();
  
  journeys.forEach(journey => {
    const startKey = new Date(journey.startDate).toISOString().split('T')[0];
    journeysStarted.set(startKey, (journeysStarted.get(startKey) || 0) + 1);
    
    if (journey.completionDate) {
      const completeKey = new Date(journey.completionDate).toISOString().split('T')[0];
      journeysCompleted.set(completeKey, (journeysCompleted.get(completeKey) || 0) + 1);
    }
  });

  const overallCompletionRate = totalJourneys > 0
    ? (completedJourneys / totalJourneys) * 100
    : 0;

  return {
    overview: {
      totalJourneys,
      activeJourneys,
      completedJourneys,
      averageCompletionDays: averageCompletionDays ? Math.round(averageCompletionDays) : null
    },
    completionRates: {
      overall: Math.round(overallCompletionRate * 100) / 100,
      byDepartment: Array.from(departmentStats.entries()).map(([dept, stats]) => ({
        department: dept,
        rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100 * 100) / 100 : 0,
        count: stats.total
      })),
      byPosition: Array.from(positionStats.entries()).map(([pos, stats]) => ({
        position: pos,
        rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100 * 100) / 100 : 0,
        count: stats.total
      }))
    },
    taskBreakdown: {
      byStatus: Object.entries(taskByStatus).map(([status, count]) => ({ status, count })),
      byType: Object.entries(taskByType).map(([type, count]) => ({ type, count }))
    },
    trends: {
      journeysStarted: Array.from(journeysStarted.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      journeysCompleted: Array.from(journeysCompleted.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }
  };
}

/**
 * Get attendance analytics for a business
 */
export async function getAttendanceAnalytics(
  businessId: string,
  startDate?: Date,
  endDate?: Date
): Promise<AttendanceAnalytics> {
  const now = new Date();
  const defaultStartDate = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
  const defaultEndDate = endDate || now;

  // Get overview stats
  const [totalEmployees, activeToday, clockedInNow, openExceptions] = await Promise.all([
    prisma.employeePosition.count({
      where: { businessId, active: true }
    }),
    prisma.attendanceRecord.count({
      where: {
        businessId,
        workDate: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        }
      }
    }),
    prisma.attendanceRecord.count({
      where: {
        businessId,
        status: 'IN_PROGRESS'
      }
    }),
    prisma.attendanceException.count({
      where: {
        businessId,
        status: { in: [AttendanceExceptionStatus.OPEN, AttendanceExceptionStatus.UNDER_REVIEW] }
      }
    })
  ]);

  // Get records for trend analysis
  const records = await prisma.attendanceRecord.findMany({
    where: {
      businessId,
      workDate: { gte: defaultStartDate, lte: defaultEndDate }
    },
    include: {
      exceptions: true
    }
  });

  // Daily trends
  const dailyTrends = new Map<string, { clockedIn: number; clockedOut: number; exceptions: number }>();
  records.forEach(record => {
    const dateKey = new Date(record.workDate).toISOString().split('T')[0];
    const trend = dailyTrends.get(dateKey) || { clockedIn: 0, clockedOut: 0, exceptions: 0 };
    if (record.clockInTime) trend.clockedIn++;
    if (record.clockOutTime) trend.clockedOut++;
    trend.exceptions += record.exceptions.length;
    dailyTrends.set(dateKey, trend);
  });

  // Exception breakdown
  const exceptions = await prisma.attendanceException.findMany({
    where: {
      businessId,
      detectedAt: { gte: defaultStartDate, lte: defaultEndDate }
    }
  });

  const exceptionsByType = exceptions.reduce((acc, exc) => {
    acc[exc.type] = (acc[exc.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const exceptionsByStatus = exceptions.reduce((acc, exc) => {
    acc[exc.status] = (acc[exc.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate compliance (simplified - would need policy data for full calculation)
  const totalRecords = records.length;
  const recordsWithExceptions = records.filter(r => r.exceptions.length > 0).length;
  const policyComplianceRate = totalRecords > 0
    ? Math.round(((totalRecords - recordsWithExceptions) / totalRecords) * 100 * 100) / 100
    : 100;

  return {
    overview: {
      totalEmployees,
      activeToday,
      clockedInNow,
      openExceptions
    },
    trends: {
      daily: Array.from(dailyTrends.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      weekly: [], // TODO: Implement weekly aggregation
      monthly: [] // TODO: Implement monthly aggregation
    },
    exceptions: {
      byType: Object.entries(exceptionsByType).map(([type, count]) => ({ type, count })),
      byStatus: Object.entries(exceptionsByStatus).map(([status, count]) => ({ status, count })),
      trends: [] // TODO: Implement exception trends
    },
    compliance: {
      policyComplianceRate,
      averageAttendanceScore: 0, // TODO: Calculate from employee scores
      topPerformers: [] // TODO: Calculate top performers
    }
  };
}

/**
 * Get time-off analytics for a business
 */
export async function getTimeOffAnalytics(
  businessId: string,
  startDate?: Date,
  endDate?: Date
): Promise<TimeOffAnalytics> {
  const now = new Date();
  const defaultStartDate = startDate || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // Last year
  const defaultEndDate = endDate || now;

  // Get all time-off requests
  const requests = await prisma.timeOffRequest.findMany({
    where: {
      businessId,
      requestedAt: { gte: defaultStartDate, lte: defaultEndDate }
    },
    include: {
      employeePosition: {
        include: {
          position: {
            include: {
              department: true
            }
          }
        }
      }
    }
  });

  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === TimeOffStatus.PENDING).length;
  const approvedRequests = requests.filter(r => r.status === TimeOffStatus.APPROVED).length;
  const deniedRequests = requests.filter(r => r.status === TimeOffStatus.DENIED).length;

  // Usage by type
  const usageByType = new Map<string, { daysUsed: number; requests: number }>();
  requests.forEach(req => {
    if (req.status === TimeOffStatus.APPROVED) {
      const days = Math.ceil(
        (new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (24 * 60 * 60 * 1000)
      ) + 1;
      const existing = usageByType.get(req.type) || { daysUsed: 0, requests: 0 };
      existing.daysUsed += days;
      existing.requests++;
      usageByType.set(req.type, existing);
    }
  });

  // Usage by department
  const usageByDepartment = new Map<string, { daysUsed: number; employees: Set<string> }>();
  requests.forEach(req => {
    if (req.status === TimeOffStatus.APPROVED) {
      const dept = req.employeePosition?.position?.department?.name || 'Unknown';
      const existing = usageByDepartment.get(dept) || { daysUsed: 0, employees: new Set<string>() };
      const days = Math.ceil(
        (new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (24 * 60 * 60 * 1000)
      ) + 1;
      existing.daysUsed += days;
      existing.employees.add(req.employeePositionId);
      usageByDepartment.set(dept, existing);
    }
  });

  // Approval time metrics
  const approvedWithApproval = requests.filter(
    r => r.status === TimeOffStatus.APPROVED && r.approvedAt && r.requestedAt
  );
  const totalApprovalTime = approvedWithApproval.reduce((sum, req) => {
    const hours = (new Date(req.approvedAt!).getTime() - new Date(req.requestedAt).getTime()) / (1000 * 60 * 60);
    return sum + hours;
  }, 0);
  const averageApprovalTimeHours = approvedWithApproval.length > 0
    ? Math.round((totalApprovalTime / approvedWithApproval.length) * 100) / 100
    : 0;

  // Pending overdue (requests pending for more than 3 days)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const pendingOverdue = requests.filter(
    r => r.status === TimeOffStatus.PENDING && new Date(r.requestedAt) < threeDaysAgo
  ).length;

  return {
    overview: {
      totalRequests,
      pendingRequests,
      approvedRequests,
      deniedRequests
    },
    usage: {
      byType: Array.from(usageByType.entries()).map(([type, data]) => ({
        type,
        daysUsed: data.daysUsed,
        requests: data.requests
      })),
      byDepartment: Array.from(usageByDepartment.entries()).map(([dept, data]) => ({
        department: dept,
        daysUsed: data.daysUsed,
        employees: data.employees.size
      })),
      balanceTrends: [] // TODO: Implement balance trends
    },
    approval: {
      averageApprovalTimeHours,
      approvalTimeByType: [], // TODO: Calculate by type
      pendingOverdue
    },
    utilization: {
      departmentUtilization: [], // TODO: Calculate utilization rates
      peakPeriods: [] // TODO: Identify peak periods
    }
  };
}

