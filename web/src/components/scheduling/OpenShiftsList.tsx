'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useScheduling } from '@/hooks/useScheduling';
import { ScheduleShift } from '@/api/scheduling';
import { useSession } from 'next-auth/react';
import { Button, Card, Spinner, Alert, Modal, Badge } from 'shared/components';
import { Clock, MapPin, Briefcase, Calendar, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, isPast, isToday, isTomorrow, addDays, addMonths, subMonths, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay } from 'date-fns';

interface OpenShiftsListProps {
  businessId: string;
}

export default function OpenShiftsList({ businessId }: OpenShiftsListProps) {
  const { data: session } = useSession();
  const {
    openShifts,
    loading,
    error,
    fetchOpenShifts,
    claimShift,
    refresh,
  } = useScheduling({ businessId, scope: 'employee', autoFetch: false });

  const [claimingShiftId, setClaimingShiftId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ScheduleShift | null>(null);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');

  // Load open shifts on mount
  useEffect(() => {
    if (businessId && session?.accessToken) {
      fetchOpenShifts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, session?.accessToken]);

  // Filter shifts based on selected filter
  const filteredShifts = openShifts.filter(shift => {
    if (!shift.startTime) return false;
    const shiftDate = parseISO(shift.startTime);
    const now = new Date();

    switch (filter) {
      case 'today':
        return isToday(shiftDate);
      case 'week':
        const weekStart = startOfWeek(now);
        const weekEnd = addDays(weekStart, 7);
        return shiftDate >= weekStart && shiftDate < weekEnd;
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return shiftDate >= monthStart && shiftDate < monthEnd;
      default:
        return true;
    }
  }).sort((a, b) => {
    if (!a.startTime || !b.startTime) return 0;
    return parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime();
  });

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    return filteredShifts.reduce((acc, shift) => {
      if (!shift.startTime) return acc;
      const date = format(parseISO(shift.startTime), 'yyyy-MM-dd');
      if (!acc[date]) acc[date] = [];
      acc[date].push(shift);
      return acc;
    }, {} as Record<string, ScheduleShift[]>);
  }, [filteredShifts]);

  // Calendar grid calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const endDate = startOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: addDays(endDate, 6) });

  // Week view calculations
  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get shifts for a specific date
  const getShiftsForDate = (date: Date): ScheduleShift[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return shiftsByDate[dateKey] || [];
  };

  // Handle claim shift
  const handleClaimShift = (shift: ScheduleShift) => {
    setSelectedShift(shift);
    setShowConfirmModal(true);
  };

  const confirmClaim = async () => {
    if (!selectedShift) return;

    setClaimingShiftId(selectedShift.id);
    try {
      await claimShift(selectedShift.id);
      await fetchOpenShifts(); // Refresh the list
      setShowConfirmModal(false);
      setSelectedShift(null);
    } catch (err) {
      console.error('Failed to claim shift:', err);
      // Error will be shown via the error state in the hook
    } finally {
      setClaimingShiftId(null);
    }
  };

  // Helper to format dates
  const formatShiftDate = (dateString: string): string => {
    try {
      const date = parseISO(dateString);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      return format(date, 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatShiftTime = (dateString: string): string => {
    try {
      return format(parseISO(dateString), 'h:mm a');
    } catch {
      return dateString;
    }
  };

  // Get shift urgency (days until shift)
  const getShiftUrgency = (shift: ScheduleShift): { label: string; color: string } => {
    if (!shift.startTime) return { label: '', color: '' };
    const shiftDate = parseISO(shift.startTime);
    const daysUntil = Math.ceil((shiftDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { label: 'Past', color: 'bg-gray-100 text-gray-600' };
    if (daysUntil === 0) return { label: 'Today', color: 'bg-red-100 text-red-800' };
    if (daysUntil === 1) return { label: 'Tomorrow', color: 'bg-orange-100 text-orange-800' };
    if (daysUntil <= 7) return { label: `${daysUntil} days`, color: 'bg-yellow-100 text-yellow-800' };
    return { label: `${daysUntil} days`, color: 'bg-blue-100 text-blue-800' };
  };

  if (loading && openShifts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Open Shifts</h2>
            <p className="text-sm text-gray-600 mt-1">
              Claim available shifts that match your position
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'week' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              Week
            </Button>
            <Button
              variant={viewMode === 'month' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('month')}
            >
              Month
            </Button>
          </div>
        </div>
        
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentMonth(viewMode === 'week' 
                ? addDays(currentMonth, -7) 
                : subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentMonth(viewMode === 'week' 
                ? addDays(currentMonth, 7) 
                : addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-medium text-gray-900 ml-4">
              {viewMode === 'week' 
                ? `Week of ${format(weekStart, 'MMM d, yyyy')}`
                : format(currentMonth, 'MMMM yyyy')}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'today' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('today')}
            >
              Today
            </Button>
            <Button
              variant={filter === 'week' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('week')}
            >
              This Week
            </Button>
            <Button
              variant={filter === 'month' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('month')}
            >
              This Month
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert className="mb-4" type="error">
          {error}
        </Alert>
      )}

      {filteredShifts.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-2">No open shifts available</p>
          <p className="text-sm text-gray-500">
            {filter === 'all'
              ? 'There are currently no open shifts for you to claim.'
              : `No open shifts found for the selected time period.`}
          </p>
        </Card>
      ) : (
        <Card className="p-4">
          {viewMode === 'week' ? (
            // Week View
            <div className="grid grid-cols-7 gap-2">
              {/* Day Headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                <div key={day} className="text-center font-semibold text-gray-700 py-2 border-b">
                  <div className="text-sm">{day}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {format(weekDays[idx], 'd')}
                  </div>
                </div>
              ))}
              
              {/* Day Cells */}
              {weekDays.map((day) => {
                const dayShifts = getShiftsForDate(day);
                const isCurrentDay = isToday(day);
                
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[400px] border-r border-gray-200 p-2 ${
                      isCurrentDay ? 'bg-blue-50' : 'bg-white'
                    } ${!isSameMonth(day, currentMonth) ? 'opacity-50' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-2 ${isCurrentDay ? 'text-blue-600' : 'text-gray-900'}`}>
                      {isToday(day) ? 'Today' : format(day, 'd')}
                    </div>
                    <div className="space-y-2">
                      {dayShifts.map((shift) => {
                        const urgency = getShiftUrgency(shift);
                        const isClaiming = claimingShiftId === shift.id;
                        
                        return (
                          <div
                            key={shift.id}
                            className="bg-orange-50 border border-orange-200 rounded p-2 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleClaimShift(shift)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-orange-600" />
                                <span className="text-xs font-medium text-gray-900">
                                  {formatShiftTime(shift.startTime || '')} - {formatShiftTime(shift.endTime || '')}
                                </span>
                              </div>
                              {urgency.label && (
                                <Badge 
                                  color={urgency.color.includes('red') ? 'red' : urgency.color.includes('orange') ? 'red' : 'yellow'} 
                                  className="text-xs"
                                >
                                  {urgency.label}
                                </Badge>
                              )}
                            </div>
                            {shift.position && (
                              <div className="text-xs text-gray-600 truncate flex items-center gap-1 mb-1">
                                <Briefcase className="h-3 w-3" />
                                {shift.position.title}
                              </div>
                            )}
                            {shift.location && (
                              <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {shift.location.name}
                              </div>
                            )}
                            <div className="mt-2">
                              <Button
                                variant="primary"
                                size="sm"
                                className="w-full text-xs py-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClaimShift(shift);
                                }}
                                disabled={isClaiming || !!claimingShiftId || (shift.startTime ? isPast(parseISO(shift.startTime)) : false)}
                              >
                                {isClaiming ? (
                                  <span className="flex items-center gap-1 justify-center">
                                    <Spinner size={12} />
                                    Claiming...
                                  </span>
                                ) : (
                                  'Claim Shift'
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Month View
            <div className="grid grid-cols-7 gap-1">
              {/* Day Headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center font-semibold text-gray-700 py-2 border-b">
                  {day}
                </div>
              ))}
              
              {/* Calendar Days */}
              {calendarDays.map((day) => {
                const dayShifts = getShiftsForDate(day);
                const isCurrentDay = isToday(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[120px] border border-gray-200 p-2 ${
                      isCurrentDay ? 'bg-blue-50 border-blue-300' : 'bg-white'
                    } ${!isCurrentMonth ? 'opacity-40 bg-gray-50' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-blue-600' : 'text-gray-900'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayShifts.slice(0, 3).map((shift) => {
                        const urgency = getShiftUrgency(shift);
                        
                        return (
                          <div
                            key={shift.id}
                            className="bg-orange-100 border border-orange-300 rounded px-1.5 py-0.5 hover:shadow-sm transition-shadow cursor-pointer text-xs"
                            onClick={() => handleClaimShift(shift)}
                            title={`${formatShiftTime(shift.startTime || '')} - ${formatShiftTime(shift.endTime || '')}${shift.position ? ` • ${shift.position.title}` : ''}`}
                          >
                            <div className="flex items-center gap-1 truncate">
                              <Clock className="h-2.5 w-2.5 text-orange-600 flex-shrink-0" />
                              <span className="font-medium text-gray-900 truncate">
                                {formatShiftTime(shift.startTime || '')}
                              </span>
                            </div>
                            {shift.position && (
                              <div className="text-xs text-gray-600 truncate">
                                {shift.position.title}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {dayShifts.length > 3 && (
                        <div className="text-xs text-gray-500 text-center py-1">
                          +{dayShifts.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && selectedShift && (
        <Modal
          open={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setSelectedShift(null);
          }}
          title="Claim Shift"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to claim this shift?
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-gray-900">
                    {formatShiftDate(selectedShift.startTime || '')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">
                    {formatShiftTime(selectedShift.startTime || '')} - {formatShiftTime(selectedShift.endTime || '')}
                  </span>
                </div>
                {selectedShift.position && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700">{selectedShift.position.title}</span>
                  </div>
                )}
                {selectedShift.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700">{selectedShift.location.name}</span>
                  </div>
                )}
                {selectedShift.locationId && !selectedShift.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-400 italic">Location ID: {selectedShift.locationId}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedShift(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={confirmClaim}
                disabled={!!claimingShiftId}
              >
                {claimingShiftId ? 'Claiming...' : 'Confirm Claim'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

