'use client';

import React, { useState, useEffect } from 'react';
import { useScheduling } from '@/hooks/useScheduling';
import { ScheduleShift } from '@/api/scheduling';
import { getBusiness } from '@/api/business';
import { useSession } from 'next-auth/react';
import { Card, Button, Spinner } from 'shared/components';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import ScheduleCalendarGrid from './ScheduleCalendarGrid';

interface SchedulingDashboardProps {
  businessId: string;
  userRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  onCreateSchedule?: () => void;
  onRequestSwap?: () => void;
  onSetAvailability?: () => void;
}

export default function SchedulingDashboard({
  businessId,
  userRole,
  onCreateSchedule,
  onRequestSwap,
  onSetAvailability,
}: SchedulingDashboardProps) {
  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';
  const isEmployee = userRole === 'EMPLOYEE';

  // Determine scope based on role
  const scope = isAdmin ? 'admin' : isManager ? 'manager' : 'employee';

  const { data: session } = useSession();
  const {
    schedules,
    shifts,
    swapRequests,
    loading,
    error,
  } = useScheduling({ businessId, scope, autoFetch: true });

  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1); // Default to Monday
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; position?: string; userId?: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: string; name: string; title?: string }>>([]);

  // Load business config, employees, and positions
  useEffect(() => {
    if (businessId && session?.accessToken) {
      const loadData = async () => {
        try {
          // Load business config for week start day
          const response = await getBusiness(businessId, session.accessToken as string);
          if (response.success && response.data?.schedulingConfig) {
            const config = response.data.schedulingConfig as Record<string, unknown>;
            const weekStartDay = config.weekStartDay as 'monday' | 'sunday' | undefined;
            if (weekStartDay) {
              const weekStartsOnValue = weekStartDay === 'sunday' ? 0 : 1;
              setWeekStartsOn(weekStartsOnValue);
              
              // Find the most recent published schedule and default to its week
              const publishedSchedules = schedules.filter(s => s.status === 'PUBLISHED');
              if (publishedSchedules.length > 0) {
                // Sort by startDate descending to get most recent
                const sortedSchedules = [...publishedSchedules].sort((a, b) => {
                  if (!a.startDate || !b.startDate) return 0;
                  return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
                });
                const mostRecentSchedule = sortedSchedules[0];
                if (mostRecentSchedule.startDate) {
                  const scheduleStartDate = parseISO(mostRecentSchedule.startDate);
                  const scheduleWeekStart = startOfWeek(scheduleStartDate, { weekStartsOn: weekStartsOnValue });
                  setCurrentWeekStart(scheduleWeekStart);
                }
              } else {
                // Fallback to current week if no published schedules
                setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: weekStartsOnValue }));
              }
            }
          }

          // Load employees
          const { getBusinessEmployees } = await import('@/api/orgChart');
          const employeesResponse = await getBusinessEmployees(businessId, session.accessToken);
          if (employeesResponse.success && employeesResponse.data) {
            const employeeList = employeesResponse.data.map((ep: any) => ({
              id: ep.id, // employeePositionId
              name: ep.user?.name || 'Unknown',
              position: ep.position?.title || ep.position?.name || undefined,
              userId: ep.user?.id,
            }));
            setEmployees(employeeList);
          }

          // Load positions
          const { getPositions } = await import('@/api/orgChart');
          const positionsResponse = await getPositions(businessId, session.accessToken);
          if (positionsResponse.success) {
            const positionList = positionsResponse.data.map((p: any) => ({
              id: p.id,
              name: p.name || p.title || 'Unknown Position',
              title: p.title || p.name || 'Unknown Position',
            }));
            setPositions(positionList);
          }
        } catch (err) {
          console.error('Failed to load data:', err);
        }
      };
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, session?.accessToken, schedules]);

  // Helper function to safely format dates
  const safeFormatDate = (dateString: string | null | undefined, formatStr: string, fallback: string = 'Invalid date'): string => {
    if (!dateString) return fallback;
    try {
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) return fallback;
      return format(date, formatStr);
    } catch {
      return fallback;
    }
  };

  const getShiftPositionTitle = (shift: ScheduleShift): string | undefined => {
    return shift.position?.title || shift.employeePosition?.position?.title || undefined;
  };

  // Filter schedules: For employees, only show PUBLISHED schedules in calendar view
  // For admins/managers, show all schedules for stats but filter calendar to published only
  const visibleSchedules = isEmployee 
    ? schedules.filter(s => s.status === 'PUBLISHED')
    : schedules;
  
  // Get published schedules for calendar view
  const publishedSchedulesList = schedules.filter(s => s.status === 'PUBLISHED');
  
  // Get all shifts from visible schedules (published only for employees, all for admins/managers)
  const allShifts = visibleSchedules.flatMap(schedule => schedule.shifts || []);
  
  // Debug logging
  console.log('📊 SchedulingDashboard:', {
    role: userRole,
    totalScheduleCount: schedules.length,
    visibleScheduleCount: visibleSchedules.length,
    publishedCount: schedules.filter(s => s.status === 'PUBLISHED').length,
    schedules: schedules.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      shiftCount: s.shifts?.length || 0
    })),
    allShiftsCount: allShifts.length,
    shifts: allShifts.slice(0, 5).map(s => ({
      id: s.id,
      startTime: s.startTime,
      employeePositionId: s.employeePositionId
    }))
  });

  // Calculate stats based on role
  const totalSchedules = schedules.length;
  const publishedSchedules = schedules.filter(s => s.status === 'PUBLISHED').length;
  const draftSchedules = schedules.filter(s => s.status === 'DRAFT').length;
  const openShifts = allShifts.filter(s => s.status === 'OPEN').length;
  const pendingSwaps = swapRequests.filter(sr => sr.status === 'PENDING').length;

  // Calculate upcoming shifts for employees
  const upcomingShifts = allShifts
    .filter(shift => shift.startTime && new Date(shift.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  // Calculate hours this week for employees
  const weekStart = startOfWeek(new Date(), { weekStartsOn });
  const weekEnd = addDays(weekStart, 7);
  const thisWeekShifts = allShifts.filter(shift => {
    if (!shift.startTime) return false;
    const shiftDate = new Date(shift.startTime);
    return shiftDate >= weekStart && shiftDate < weekEnd;
  });
  const totalHoursThisWeek = thisWeekShifts.reduce((total, shift) => {
    if (!shift.startTime || !shift.endTime) return total;
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return total + hours - ((shift.breakMinutes || 0) / 60);
  }, 0);

  // Get current week dates
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Group shifts by date for calendar view
  const shiftsByDate = allShifts.reduce((acc, shift) => {
    if (!shift.startTime) return acc;
    const date = safeFormatDate(shift.startTime, 'yyyy-MM-dd', '');
    if (!date) return acc;
    if (!acc[date]) acc[date] = [];
    acc[date].push(shift);
    return acc;
  }, {} as Record<string, ScheduleShift[]>);

  if (loading && schedules.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Scheduling Dashboard</h1>
        <p className="text-gray-600 mt-1">
          {isAdmin && 'Overview of all schedules and workforce planning'}
          {isManager && 'Overview of your team schedules and coverage'}
          {isEmployee && 'Your schedule overview and upcoming shifts'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {isAdmin && (
          <>
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Schedules</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalSchedules}</p>
                </div>
                <div className="flex-shrink-0">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </Card>

            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Published</p>
                  <p className="text-2xl font-semibold text-gray-900">{publishedSchedules}</p>
                </div>
                <div className="flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </Card>

            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Draft</p>
                  <p className="text-2xl font-semibold text-gray-900">{draftSchedules}</p>
                </div>
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                </div>
              </div>
            </Card>
          </>
        )}

        {(isAdmin || isManager) && (
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Pending Swaps</p>
                <p className="text-2xl font-semibold text-gray-900">{pendingSwaps}</p>
              </div>
              <div className="flex-shrink-0">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </Card>
        )}

        {isEmployee && (
          <>
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Hours This Week</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalHoursThisWeek.toFixed(1)}</p>
                </div>
                <div className="flex-shrink-0">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </Card>

            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Upcoming Shifts</p>
                  <p className="text-2xl font-semibold text-gray-900">{upcomingShifts.length}</p>
                </div>
                <div className="flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </Card>
          </>
        )}

        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Open Shifts</p>
              <p className="text-2xl font-semibold text-gray-900">{openShifts}</p>
            </div>
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button
              onClick={onCreateSchedule}
              className="flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          )}
          {/* Personal actions available to all roles */}
          <Button
            onClick={onRequestSwap}
            variant="secondary"
            className="flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Request Swap
          </Button>
          <Button
            onClick={onSetAvailability}
            variant="secondary"
            className="flex items-center"
          >
            <Clock className="h-4 w-4 mr-2" />
            Set Availability
          </Button>
        </div>
      </div>

      {/* Current Schedule Calendar View */}
      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Current Schedule</h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn }))}
              >
                Today
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <ScheduleCalendarGrid
              scheduleId={publishedSchedulesList.length > 0 ? publishedSchedulesList[0].id : ''}
              shifts={allShifts}
              startDate={currentWeekStart}
              endDate={addDays(currentWeekStart, 6)}
              layoutMode="employee"
              viewMode="week"
              employees={employees}
              positions={positions}
              weekStartsOn={weekStartsOn}
            />
          </div>
        </div>
      </Card>

      {/* Upcoming Shifts (for all roles) */}
      {upcomingShifts.length > 0 && (
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Shifts</h2>
            <div className="space-y-3">
              {upcomingShifts.map((shift) => (
                <div key={shift.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {safeFormatDate(shift.startTime, 'MMM d, yyyy', 'Invalid date')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {safeFormatDate(shift.startTime, 'HH:mm', '--')} - {safeFormatDate(shift.endTime, 'HH:mm', '--')}
                      </p>
                    </div>
                    {getShiftPositionTitle(shift) && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                        {getShiftPositionTitle(shift)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

