'use client';

import { useState, useEffect } from 'react';
import { useScheduling } from '@/hooks/useScheduling';
import { ScheduleShift } from '@/api/scheduling';
import { getBusiness } from '@/api/business';
import { useSession } from 'next-auth/react';
import { Button, Card } from 'shared/components';
import {
  Calendar,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import ScheduleCalendarGrid from './ScheduleCalendarGrid';

interface SchedulingTeamContentProps {
  businessId: string;
  view: string;
}

export default function SchedulingTeamContent({ 
  businessId, 
  view 
}: SchedulingTeamContentProps) {
  const { data: session } = useSession();
  const {
    schedules,
    swapRequests,
    loading,
    error,
    approveSwap,
    denySwap,
    refresh,
  } = useScheduling({ businessId, scope: 'manager', autoFetch: true });

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

  // Get all shifts from PUBLISHED schedules only (managers see published schedules)
  const publishedSchedulesList = schedules.filter(s => s.status === 'PUBLISHED');
  const allShifts = publishedSchedulesList.flatMap(schedule => schedule.shifts || []);
  
  console.log('👥 SchedulingTeamContent:', {
    totalScheduleCount: schedules.length,
    publishedScheduleCount: publishedSchedulesList.length,
    allShiftsCount: allShifts.length
  });

  // Get pending swap requests
  const pendingSwaps = swapRequests.filter(sr => sr.status === 'PENDING');

  // Calculate team coverage
  const weekStart = startOfWeek(new Date(), { weekStartsOn });
  const weekEnd = addDays(weekStart, 7);
  const thisWeekShifts = allShifts.filter(shift => {
    if (!shift.startTime) return false;
    const shiftDate = new Date(shift.startTime);
    return shiftDate >= weekStart && shiftDate < weekEnd;
  });

  // Count unique employees scheduled this week
  const uniqueEmployees = new Set(
    thisWeekShifts
      .filter(s => s.employeePosition)
      .map(s => s.employeePosition!.id)
  );

  // Count open shifts this week
  const openShiftsThisWeek = thisWeekShifts.filter(s => s.status === 'OPEN').length;

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

  // Get current week dates
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Group shifts by date
  const shiftsByDate = allShifts.reduce((acc, shift) => {
    if (!shift.startTime) return acc;
    const date = safeFormatDate(shift.startTime, 'yyyy-MM-dd', '');
    if (!date) return acc;
    if (!acc[date]) acc[date] = [];
    acc[date].push(shift);
    return acc;
  }, {} as Record<string, ScheduleShift[]>);

  const handleApproveSwap = async (swapId: string) => {
    await approveSwap(swapId);
    await refresh();
  };

  const handleDenySwap = async (swapId: string) => {
    await denySwap(swapId);
    await refresh();
  };

  if (loading && schedules.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600">Loading team schedules...</p>
        </div>
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

  // Team Schedules View
  if (view === 'team') {
    return (
      <div className="h-full overflow-y-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Team Schedules</p>
                <p className="text-2xl font-semibold text-gray-900">{schedules.length}</p>
              </div>
              <div className="flex-shrink-0">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Scheduled This Week</p>
                <p className="text-2xl font-semibold text-gray-900">{uniqueEmployees.size}</p>
              </div>
              <div className="flex-shrink-0">
                <Users className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Open Shifts</p>
                <p className="text-2xl font-semibold text-gray-900">{openShiftsThisWeek}</p>
              </div>
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Pending Swaps</p>
                <p className="text-2xl font-semibold text-gray-900">{pendingSwaps.length}</p>
              </div>
              <div className="flex-shrink-0">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Week Calendar View */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Team Schedule</h2>
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
      </div>
    );
  }

  // Swap Approvals View
  if (view === 'swaps') {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="space-y-4">
          {pendingSwaps.length === 0 ? (
            <Card className="p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No pending swap requests</p>
            </Card>
          ) : (
            pendingSwaps.map((swap) => (
              <Card key={swap.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {swap.requestedBy.name} wants to swap with {swap.requestedTo?.name || 'TBD'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Shift: {safeFormatDate(swap.originalShift?.startTime, 'MMM d, yyyy HH:mm', '--')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleApproveSwap(swap.id)}
                      variant="secondary"
                      size="sm"
                      className="flex items-center"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleDenySwap(swap.id)}
                      variant="secondary"
                      size="sm"
                      className="flex items-center text-red-600 hover:text-red-700"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Deny
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
