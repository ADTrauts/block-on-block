'use client';

import { useState, useEffect } from 'react';
import { useScheduling } from '@/hooks/useScheduling';
import { ScheduleShift } from '@/api/scheduling';
import { getBusiness } from '@/api/business';
import { useSession } from 'next-auth/react';
import { Button, Card } from 'shared/components';
import {
  Calendar,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import AvailabilityManagement from './AvailabilityManagement';
import OpenShiftsList from './OpenShiftsList';
import ScheduleCalendarGrid from './ScheduleCalendarGrid';

interface SchedulingEmployeeContentProps {
  businessId: string;
  view: string;
}

export default function SchedulingEmployeeContent({ 
  businessId, 
  view 
}: SchedulingEmployeeContentProps) {
  const { data: session } = useSession();
  const {
    schedules,
    swapRequests,
    loading,
    error,
    refresh,
    requestSwap,
    cancelSwap,
    fetchOpenShifts,
    claimShift,
  } = useScheduling({ businessId, scope: 'employee', autoFetch: true });

  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1); // Default to Monday
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; position?: string; userId?: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: string; name: string; title?: string }>>([]);
  const [currentUserEmployeePositionIds, setCurrentUserEmployeePositionIds] = useState<string[]>([]);

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
              // For employees, schedules are already filtered to PUBLISHED by getOwnSchedule
              if (schedules.length > 0) {
                // Sort by startDate descending to get most recent
                const sortedSchedules = [...schedules].sort((a, b) => {
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

          // Load employees and find current user's employee positions
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
            
            // Find current user's employee position IDs
            // Get user ID from session (NextAuth sets session.user.id)
            const userId = session?.user?.id;
            if (userId) {
              const userEmployeePositions = employeeList.filter(emp => emp.userId === userId);
              setCurrentUserEmployeePositionIds(userEmployeePositions.map(emp => emp.id));
              console.log('✅ Found user employee positions:', {
                userId,
                employeePositionIds: userEmployeePositions.map(emp => emp.id),
                employeeNames: userEmployeePositions.map(emp => emp.name)
              });
            } else {
              console.warn('⚠️ Could not find user ID in session:', { session });
            }
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

  // Get all shifts from all schedules
  const allShifts = schedules.flatMap(schedule => schedule.shifts || []);
  
  // Filter to only show user's shifts + open shifts for "My Schedule" view
  const myShifts = allShifts.filter(shift => {
    // Include open shifts
    if (shift.status === 'OPEN') return true;
    // Include shifts assigned to current user's employee positions
    if (shift.employeePositionId && currentUserEmployeePositionIds.includes(shift.employeePositionId)) return true;
    return false;
  });
  
  // Calculate upcoming shifts (from user's shifts only)
  const upcomingShifts = myShifts
    .filter(shift => shift.startTime && new Date(shift.startTime) > new Date() && shift.status !== 'OPEN')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  // Get open shifts
  const openShifts = allShifts.filter(shift => shift.status === 'OPEN');

  // Get pending swap requests
  const pendingSwaps = swapRequests.filter(sr => sr.status === 'PENDING');

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

  // Calculate total hours this week (from user's shifts only, excluding open shifts)
  const weekStart = startOfWeek(new Date(), { weekStartsOn });
  const weekEnd = addDays(weekStart, 7);
  const thisWeekShifts = myShifts.filter(shift => {
    if (!shift.startTime) return false;
    if (shift.status === 'OPEN') return false; // Don't count open shifts in hours
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

  if (loading && schedules.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600">Loading your schedule...</p>
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

  // My Schedule View
  if (view === 'my-schedule') {
    return (
      <div className="h-full overflow-y-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
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

          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Open Shifts</p>
                <p className="text-2xl font-semibold text-gray-900">{openShifts.length}</p>
              </div>
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Week Calendar View */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">My Schedule</h2>
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
                scheduleId={schedules.length > 0 ? schedules[0].id : ''}
                shifts={myShifts}
                startDate={currentWeekStart}
                endDate={addDays(currentWeekStart, 6)}
                layoutMode="employee"
                viewMode="week"
                employees={employees.filter(emp => currentUserEmployeePositionIds.includes(emp.id))}
                positions={positions}
                weekStartsOn={weekStartsOn}
              />
            </div>
          </div>
        </Card>

        {/* Upcoming Shifts */}
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

  // My Availability View
  if (view === 'availability') {
    return <AvailabilityManagement businessId={businessId} />;
  }

  // Shift Swaps View
  if (view === 'shift-swaps') {
    const myShifts = allShifts.filter(shift => 
      shift.employeePosition && 
      shift.startTime && 
      new Date(shift.startTime) > new Date()
    );

    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Shift Swaps</h2>
          <p className="text-sm text-gray-600">Request to swap your shifts with other employees</p>
        </div>

        <div className="space-y-6">
          {/* My Swap Requests */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">My Swap Requests</h3>
            {swapRequests.length === 0 ? (
              <Card className="p-6 text-center">
                <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No swap requests yet</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {swapRequests.map((swap) => (
                  <Card key={swap.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium text-gray-900">
                            {swap.originalShift?.schedule?.name || 'Shift Swap Request'}
                          </p>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            swap.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            swap.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                            swap.status === 'DENIED' ? 'bg-red-100 text-red-800' :
                            swap.status === 'CANCELLED' || swap.status === 'EXPIRED' ? 'bg-gray-100 text-gray-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {swap.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {safeFormatDate(swap.originalShift?.startTime, 'MMM d, yyyy HH:mm', '--')} - {safeFormatDate(swap.originalShift?.endTime, 'HH:mm', '--')}
                        </p>
                        {swap.requestedTo && (
                          <p className="text-sm text-gray-600 mt-1">
                            Requested to: {swap.requestedTo.name}
                          </p>
                        )}
                        {swap.requestNotes && (
                          <p className="text-sm text-gray-500 mt-2">{swap.requestNotes}</p>
                        )}
                      </div>
                      {swap.status === 'PENDING' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            if (confirm('Are you sure you want to cancel this swap request?')) {
                              await cancelSwap(swap.id);
                              await refresh();
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Request New Swap */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Request a Swap</h3>
            {myShifts.length === 0 ? (
              <Card className="p-6 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No upcoming shifts available to swap</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {myShifts.slice(0, 10).map((shift) => (
                  <Card key={shift.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {shift.schedule?.name || 'Shift'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {safeFormatDate(shift.startTime, 'MMM d, yyyy HH:mm', '--')} - {safeFormatDate(shift.endTime, 'HH:mm', '--')}
                        </p>
                        {getShiftPositionTitle(shift) && (
                          <p className="text-sm text-gray-500 mt-1">
                            Position: {getShiftPositionTitle(shift)}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          const notes = prompt('Enter reason for swap request (optional):');
                          if (notes !== null) {
                            await requestSwap(shift.id, {
                              requestNotes: notes || undefined
                            });
                            await refresh();
                          }
                        }}
                      >
                        Request Swap
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Open Shifts View
  if (view === 'open-shifts') {
    return <OpenShiftsList businessId={businessId} />;
  }

  // Fallback
  return null;
}
