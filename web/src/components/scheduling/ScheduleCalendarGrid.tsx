'use client';

import React, { useMemo, useRef, useCallback, useState } from 'react';
import { format, startOfWeek, addDays, parseISO, isSameDay, getDay, startOfDay, subWeeks } from 'date-fns';
import { ScheduleShift, EmployeeAvailability } from '@/api/scheduling';
import { DraggableShift } from './DraggableShift';
import { DroppableCell } from './DroppableCell';
import { HelpCircle, User, AlertCircle, ChevronDown } from 'lucide-react';
import { ContextMenu } from 'shared/components';
 
interface ScheduleCalendarGridProps {
  scheduleId: string;
  shifts: ScheduleShift[];
  startDate: Date;
  endDate: Date;
  layoutMode: 'employee' | 'position' | 'station';
  viewMode?: 'week' | 'day'; // View mode determines layout
  employees?: Array<{ id: string; name: string; position?: string; userId?: string }>;
  positions?: Array<{ id: string; name: string; title?: string }>;
  stations?: Array<{ id: string; name: string }>;
  memberShiftAssignments?: Map<string, string>; // shiftId -> memberUserId (for shifts with null employeePositionId)
  employeeAvailability?: Record<string, EmployeeAvailability[]>; // employeePositionId -> availability[]
  timeOffData?: Array<{ employeePositionId: string; startDate: string; endDate: string; type: string }>; // Time-off requests
  showAvailabilityIndicators?: boolean; // Toggle to show/hide availability overlays
  onShiftClick?: (shift: ScheduleShift) => void;
  onShiftDrag?: (shiftId: string, newDay: Date, newTime: Date) => void;
  onShiftCreate?: (day: Date, startTime: Date, employeeId?: string, stationId?: string, positionId?: string, options?: { endTime?: Date }) => void;
  onShiftResize?: (shiftId: string, newStart: Date, newEnd: Date) => void;
  timeRange?: { start: number; end: number }; // Hour range, e.g., { start: 6, end: 24 }
  interval?: number; // Minutes per grid cell (15, 30, 60)
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday (default: 1 for Monday)
}

const DEFAULT_TIME_RANGE = { start: 6, end: 24 }; // 6 AM to 12 AM
const DEFAULT_INTERVAL = 30; // 30-minute intervals

export default function ScheduleCalendarGrid({
  scheduleId,
  shifts,
  startDate,
  endDate,
  layoutMode,
  viewMode = 'week',
  employees = [],
  positions = [],
  stations = [],
  memberShiftAssignments = new Map(),
  employeeAvailability = {},
  timeOffData = [],
  showAvailabilityIndicators = true,
  onShiftClick,
  onShiftDrag,
  onShiftCreate,
  onShiftResize,
  timeRange = DEFAULT_TIME_RANGE,
  interval = DEFAULT_INTERVAL,
  weekStartsOn = 1, // Default to Monday if not specified
}: ScheduleCalendarGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Context menu state for employee rows
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    anchorPoint: { x: number; y: number };
    employeeId: string;
    employeeName: string;
  } | null>(null);

  // Handle copy previous week
  const handleCopyPreviousWeek = useCallback(async (employeeId: string, employeeName: string) => {
    if (!onShiftCreate) return;
    
    // Calculate previous week dates
    const previousWeekStart = subWeeks(startDate, 1);
    const previousWeekEnd = subWeeks(endDate, 1);
    
    // Find shifts for this employee from previous week
    const previousWeekShifts = shifts.filter(shift => {
      if (shift.employeePositionId !== employeeId) return false;
      const shiftDate = parseISO(shift.startTime);
      return shiftDate >= previousWeekStart && shiftDate <= previousWeekEnd;
    });
    
    // Copy each shift to the current week
    for (const shift of previousWeekShifts) {
      const shiftStart = parseISO(shift.startTime);
      const shiftEnd = parseISO(shift.endTime);
      
      // Calculate the day offset (how many days into the week)
      const weekStart = startOfWeek(previousWeekStart, { weekStartsOn });
      const daysOffset = Math.floor((shiftStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      
      // Apply the same offset to the current week
      const currentWeekStart = startOfWeek(startDate, { weekStartsOn });
      const newDay = addDays(currentWeekStart, daysOffset);
      
      // Create new shift with same times but on new day
      const newStartTime = new Date(newDay);
      newStartTime.setHours(shiftStart.getHours(), shiftStart.getMinutes(), 0, 0);
      
      const newEndTime = new Date(newDay);
      newEndTime.setHours(shiftEnd.getHours(), shiftEnd.getMinutes(), 0, 0);
      
      await onShiftCreate(newDay, newStartTime, employeeId, undefined, undefined, { endTime: newEndTime });
    }
    
    setContextMenu(null);
  }, [shifts, startDate, endDate, weekStartsOn, onShiftCreate]);

  // Generate days based on view mode
  const days: Date[] = [];
  if (viewMode === 'day') {
    // Day view: show only the selected day
    days.push(new Date(startDate));
  } else {
    // Week view: show Mon-Sun
    const weekStart = startOfWeek(startDate, { weekStartsOn });
    let currentDay = weekStart;
    while (currentDay <= endDate && days.length < 7) {
      days.push(new Date(currentDay));
      currentDay = addDays(currentDay, 1);
    }
  }

  // Generate time slots
  const timeSlots: Date[] = [];
  const startHour = timeRange.start;
  const endHour = timeRange.end;
  const slotsPerHour = 60 / interval;
  const totalSlots = (endHour - startHour) * slotsPerHour;

  for (let i = 0; i < totalSlots; i++) {
    const hours = Math.floor(i / slotsPerHour) + startHour;
    const minutes = (i % slotsPerHour) * interval;
    timeSlots.push(new Date(0, 0, 0, hours, minutes));
  }

  // Get rows based on layout mode
  // For employee mode, add "OpenShifts" row as the first row
  const rows = layoutMode === 'employee'
    ? [
        { id: 'open-shifts', name: 'Open Shifts', type: 'open-shifts' as const },
        ...employees.map(emp => ({ id: emp.id, name: emp.name, type: 'employee' as const }))
      ]
    : layoutMode === 'position'
    ? [
        ...positions.map(position => ({ id: position.id, name: position.title || position.name, type: 'position' as const })),
        ...stations.map(station => ({ id: station.id, name: station.name, type: 'station' as const }))
      ]
    : [
        ...positions.map(position => ({ id: position.id, name: position.title || position.name, type: 'position' as const })),
        ...stations.map(station => ({ id: station.id, name: station.name, type: 'station' as const }))
      ];

  const dayTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    if (viewMode === 'day') {
      totals[days[0].toISOString()] = shifts.reduce((acc, shift) => {
        const start = parseISO(shift.startTime);
        const end = parseISO(shift.endTime);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return acc + (isNaN(duration) ? 0 : duration);
      }, 0);
      return totals;
    }

    days.forEach(day => {
      const key = day.toISOString();
      totals[key] = shifts.reduce((acc, shift) => {
        const start = parseISO(shift.startTime);
        if (!isSameDay(start, day)) return acc;
        const end = parseISO(shift.endTime);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return acc + (isNaN(duration) ? 0 : duration);
      }, 0);
    });

    return totals;
  }, [days, shifts, viewMode]);

  // Calculate employee totals (hours per employee across all days)
  const employeeTotals = useMemo(() => {
    if (layoutMode !== 'employee') return {};
    
    const totals: Record<string, number> = {};
    
    rows.forEach(row => {
      if (row.type === 'employee' || row.type === 'open-shifts') {
        const rowShifts = shifts.filter(shift => {
          if (row.id === 'open-shifts') {
            return shift.employeePositionId === null || shift.status === 'OPEN';
          }
          return shift.employeePositionId === row.id;
        });
        
        const totalHours = rowShifts.reduce((acc, shift) => {
          const start = parseISO(shift.startTime);
          const end = parseISO(shift.endTime);
          const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          return acc + (isNaN(duration) ? 0 : duration);
        }, 0);
        
        totals[row.id] = totalHours;
      }
    });
    
    return totals;
  }, [rows, shifts, layoutMode]);

  // Helper: Convert day name to day of week (0 = Sunday, 1 = Monday, etc.)
  const getDayOfWeekName = (date: Date): string => {
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return dayNames[getDay(date)];
  };

  // Helper: Get availability for an employee on a specific day
  const getAvailabilityForDay = (employeePositionId: string, day: Date): EmployeeAvailability[] => {
    if (!employeeAvailability[employeePositionId]) {
      // Debug: Log when employee has no availability data
      if (showAvailabilityIndicators && layoutMode === 'employee') {
        // Only log once per employee to avoid spam
        const debugKey = `avail-debug-${employeePositionId}`;
        if (!(window as any)[debugKey]) {
          (window as any)[debugKey] = true;
          console.log('🔍 No availability data for employee:', employeePositionId, {
            availableEmployeeIds: Object.keys(employeeAvailability),
            day: format(day, 'EEEE, MMMM d')
          });
        }
      }
      return [];
    }
    
    const dayName = getDayOfWeekName(day);
    const dayDate = startOfDay(day);
    
    const matchingAvailability = employeeAvailability[employeePositionId].filter(av => {
      // Check if day of week matches
      if (av.dayOfWeek !== dayName) return false;
      
      // Check if within effective date range
      const effectiveFrom = new Date(av.effectiveFrom);
      const effectiveTo = av.effectiveTo ? new Date(av.effectiveTo) : null;
      
      if (dayDate < startOfDay(effectiveFrom)) return false;
      if (effectiveTo && dayDate > startOfDay(effectiveTo)) return false;
      
      // Check if recurring (if not recurring, must be within effective dates)
      if (!av.recurring) {
        // For non-recurring, only show if the day matches the effective date range exactly
        return dayDate >= startOfDay(effectiveFrom) && (!effectiveTo || dayDate <= startOfDay(effectiveTo));
      }
      
      return true;
    });
    
    // Debug: Log when availability is found
    if (matchingAvailability.length > 0 && showAvailabilityIndicators && layoutMode === 'employee') {
      console.log('✅ Found availability for', employeePositionId, 'on', format(day, 'EEEE'), {
        count: matchingAvailability.length,
        types: matchingAvailability.map(av => av.availabilityType)
      });
    }
    
    return matchingAvailability;
  };

  // Helper: Get time-off for an employee on a specific day
  const getTimeOffForDay = (employeePositionId: string, day: Date): Array<{ startDate: string; endDate: string; type: string }> => {
    const dayDate = startOfDay(day);
    return timeOffData.filter(to => {
      if (to.employeePositionId !== employeePositionId) return false;
      const toStart = startOfDay(parseISO(to.startDate));
      const toEnd = startOfDay(parseISO(to.endDate));
      return dayDate >= toStart && dayDate <= toEnd;
    });
  };

  // Helper: Check if a shift conflicts with availability or time-off
  const getShiftConflicts = (shift: ScheduleShift, employeePositionId: string | null): {
    hasConflict: boolean;
    conflictsWithAvailability: boolean;
    conflictsWithTimeOff: boolean;
    conflictReason?: string;
    isCantWorkDay?: boolean; // True if employee marked "can't work this day at all"
  } => {
    // Check conflicts for any shift that has an employee assigned, regardless of layout mode
    if (!employeePositionId) {
      return { hasConflict: false, conflictsWithAvailability: false, conflictsWithTimeOff: false };
    }

    const shiftStart = parseISO(shift.startTime);
    const shiftEnd = parseISO(shift.endTime);
    const shiftDay = startOfDay(shiftStart);
    
    // Check time-off conflicts
    const timeOffs = getTimeOffForDay(employeePositionId, shiftDay);
    if (timeOffs.length > 0) {
      return {
        hasConflict: true,
        conflictsWithAvailability: false,
        conflictsWithTimeOff: true,
        conflictReason: `Employee has ${timeOffs[0].type} time-off`
      };
    }

    // Check availability conflicts
    if (showAvailabilityIndicators) {
      const availabilities = getAvailabilityForDay(employeePositionId, shiftDay);
      
      // Check if shift time overlaps with any UNAVAILABLE periods
      for (const av of availabilities) {
        if (av.availabilityType === 'UNAVAILABLE') {
          const [avStartHour, avStartMin] = av.startTime.split(':').map(Number);
          const [avEndHour, avEndMin] = av.endTime.split(':').map(Number);
          
          // Check if this is "can't work this day" (00:00 to 23:59 or spans entire day)
          // This covers cases where employee marked "can't work this day at all"
          const isCantWorkDay = (avStartHour === 0 && avStartMin === 0) && 
                                (avEndHour === 23 && avEndMin >= 59);
          
          const avStart = new Date(shiftDay);
          avStart.setHours(avStartHour, avStartMin, 0, 0);
          const avEnd = new Date(shiftDay);
          avEnd.setHours(avEndHour, avEndMin, 0, 0);
          
          // Check if shift overlaps with unavailable period
          if (shiftStart < avEnd && shiftEnd > avStart) {
            return {
              hasConflict: true,
              conflictsWithAvailability: true,
              conflictsWithTimeOff: false,
              isCantWorkDay: isCantWorkDay,
              conflictReason: isCantWorkDay 
                ? 'Employee cannot work this day' 
                : 'Shift conflicts with unavailable period'
            };
          }
        }
      }
    }

    return { hasConflict: false, conflictsWithAvailability: false, conflictsWithTimeOff: false };
  };

  // Check for warnings in daily totals (e.g., low hours, conflicts)
  const dayWarnings = useMemo(() => {
    const warnings: Record<string, boolean> = {};
    
    days.forEach(day => {
      const key = day.toISOString();
      const totalHours = dayTotals[key] || 0;
      // Add warning if hours are very low (less than 4) or very high (more than 40)
      // This is a simple heuristic - can be enhanced with actual conflict detection
      warnings[key] = totalHours > 0 && (totalHours < 4 || totalHours > 40);
    });
    
    return warnings;
  }, [days, dayTotals]);

  // Check for employee-level warnings (conflicts, overtime, etc.)
  const employeeWarnings = useMemo(() => {
    if (layoutMode !== 'employee') return {};
    
    const warnings: Record<string, boolean> = {};
    
    rows.forEach(row => {
      if (row.type === 'employee') {
        const rowShifts = shifts.filter(shift => shift.employeePositionId === row.id);
        
        // Check for conflicts
        const hasConflict = rowShifts.some(shift => {
          const conflicts = getShiftConflicts(shift, shift.employeePositionId || null);
          return conflicts.hasConflict;
        });
        
        // Check for overtime (more than 40 hours)
        const totalHours = employeeTotals[row.id] || 0;
        const hasOvertime = totalHours > 40;
        
        warnings[row.id] = hasConflict || hasOvertime;
      }
    });
    
    return warnings;
  }, [rows, shifts, layoutMode, employeeTotals]);

  // Get shifts for a specific row and day
  const getShiftsForRowAndDay = (rowId: string, day: Date): ScheduleShift[] => {
    return shifts.filter(shift => {
      const shiftDate = parseISO(shift.startTime);
      if (!isSameDay(shiftDate, day)) return false;

      if (layoutMode === 'employee') {
        // OpenShifts row: show all unassigned shifts
        // Note: Shifts with memberShiftAssignments may also appear here, as they're still
        // technically unassigned (memberShiftAssignments is temporary/client-side only)
        if (rowId === 'open-shifts') {
          return shift.employeePositionId === null || shift.status === 'OPEN';
        }
        
        // Match by employeePositionId (for employees with positions)
        if (shift.employeePositionId === rowId) return true;
        
        // For member employees (users without positions), match by checking if
        // shift.employeePositionId is null AND the shift is assigned to this member
        if (rowId.startsWith('member-') && shift.employeePositionId === null) {
          // Extract userId from rowId (format: "member-{userId}")
          const memberUserId = rowId.replace('member-', '');
          // Check if this shift is assigned to this member employee via the mapping
          const assignedMemberUserId = memberShiftAssignments.get(shift.id);
          return assignedMemberUserId === memberUserId;
        }
        
        return false;
      } else if (layoutMode === 'position' || layoutMode === 'station') {
        // Position/Station combined view: check both position and station matches
        
        // First, check if this row is a position
        const positionRow = positions.find(p => p.id === rowId);
        if (positionRow) {
          // Check if shift has this position assigned
          if (shift.positionId === rowId) return true;
          
          const employeePositionId = (shift.employeePosition?.position as any)?.id;
          if (employeePositionId && employeePositionId === rowId) return true;
          
          const positionTitle = shift.employeePosition?.position?.title;
          if (positionTitle) {
            const targetName = positionRow.title || positionRow.name;
            if (positionTitle === targetName || positionTitle.toLowerCase() === targetName.toLowerCase()) {
              return true;
            }
          }
        }
        
        // Then, check if this row is a station
        const stationRow = stations.find(s => s.id === rowId);
        if (stationRow) {
          return shift.stationName === stationRow.name;
        }
        
        return false;
      } else {
        return false;
      }
    });
  };

  // Calculate position for a shift block
  const getShiftPosition = (shift: ScheduleShift, rowHeight: number = 40): { top: number; height: number; left: number; width: number } | null => {
    const shiftStart = parseISO(shift.startTime);
    const shiftEnd = parseISO(shift.endTime);

    // Find which day this shift is on
    const dayIndex = days.findIndex(day => isSameDay(shiftStart, day));
    if (dayIndex === -1) return null;

    if (viewMode === 'day') {
      // Day view: shifts span horizontally from start to end time
      const startMinutes = shiftStart.getHours() * 60 + shiftStart.getMinutes();
      const endMinutes = shiftEnd.getHours() * 60 + shiftEnd.getMinutes();
      const dayStartMinutes = startHour * 60;
      const dayEndMinutes = endHour * 60;
      const dayDuration = dayEndMinutes - dayStartMinutes;
      
      const left = ((startMinutes - dayStartMinutes) / dayDuration) * 100;
      const width = ((endMinutes - startMinutes) / dayDuration) * 100;
      
      return { top: 0, height: rowHeight, left, width };
    } else {
      // Week view: shifts are blocks in grid cells
      const startMinutes = shiftStart.getHours() * 60 + shiftStart.getMinutes();
      const endMinutes = shiftEnd.getHours() * 60 + shiftEnd.getMinutes();
      const slotHeight = rowHeight / totalSlots;
      const top = ((startMinutes - (startHour * 60)) / interval) * (slotHeight / slotsPerHour);
      const height = ((endMinutes - startMinutes) / interval) * (slotHeight / slotsPerHour);

      // Calculate day position
      const dayWidth = 100 / days.length;
      const left = dayIndex * dayWidth;
      const width = dayWidth;

      return { top, height, left, width };
    }
  };

  // Handle grid cell click (create new shift)
  const handleCellClick = useCallback((rowId: string, day: Date, hour: number, minutes: number) => {
    if (!onShiftCreate) return;
    
    const startTime = new Date(day);
    startTime.setHours(hour, minutes, 0, 0);
    
    // Pass appropriate ID based on layout mode
    const employeeId = layoutMode === 'employee' ? rowId : undefined;
    const stationId = layoutMode === 'station' ? rowId : undefined;
    const positionId = layoutMode === 'position' ? rowId : undefined;
    
    onShiftCreate(day, startTime, employeeId, stationId, positionId);
  }, [onShiftCreate, layoutMode]);

  const dayViewMinWidth = Math.max(960, (endHour - startHour) * 80); // ensure scrollable width in day view

  // Render different layouts based on view mode
  if (viewMode === 'day') {
    // Day view: Time slots at top (horizontal), users on left, shifts as horizontal bars
    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        <div className="flex-1 overflow-auto" ref={gridRef}>
          <div className="min-w-[960px]" style={{ minWidth: `${dayViewMinWidth}px` }}>
            {/* Header: Time slots at top */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="w-48 border-r border-gray-200 p-2 font-medium text-gray-700 bg-white">
                {layoutMode === 'employee' ? 'Employee' : layoutMode === 'position' ? 'Position' : 'Station'}
              </div>
              <div
                className="flex-1 relative"
                style={{ minHeight: '60px', minWidth: `${dayViewMinWidth - 192}px` }}
              >
                {timeSlots.map((slot, slotIdx) => {
                  if (slotIdx % slotsPerHour === 0) {
                    const position = (slotIdx / totalSlots) * 100;
                    return (
                      <div
                        key={slotIdx}
                        className="absolute border-l border-gray-200"
                        style={{ left: `${position}%`, height: '100%' }}
                      >
                        <span className="text-xs text-gray-600 absolute top-1 left-1 bg-white px-1 rounded">
                          {format(slot, 'h:mm a')}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })}
                {/* Day label */}
                <div className="absolute top-8 left-0 right-0 text-center text-sm font-medium text-gray-900 pointer-events-none">
                  {format(days[0], 'EEEE, MMMM d, yyyy')}
                </div>
              </div>
            </div>

            {/* Scrollable grid */}
            <div className="flex">
              {/* Sidebar: Row labels */}
              <div className="w-48 border-r border-gray-200 bg-gray-50 sticky left-0 z-10">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`h-20 border-b border-gray-200 p-2 flex items-center ${
                      row.type === 'open-shifts' 
                        ? 'bg-orange-50 border-orange-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className={`text-sm font-medium truncate flex items-center gap-2 ${
                      row.type === 'open-shifts' 
                        ? 'text-orange-900' 
                        : 'text-gray-900'
                    }`} title={row.name}>
                      {row.type === 'open-shifts' && (
                        <HelpCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                      )}
                      {row.name}
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid: Time slots and shifts */}
              <div
                className="flex-1 relative"
                style={{ minHeight: `${rows.length * 80}px`, minWidth: `${dayViewMinWidth - 192}px` }}
              >
                {rows.map((row, rowIdx) => {
                  const rowShifts = getShiftsForRowAndDay(row.id, days[0]);
                  return (
                    <div
                      key={row.id}
                      className="absolute w-full border-b border-gray-200"
                      style={{
                        top: `${rowIdx * 80}px`,
                        height: '80px',
                      }}
                    >
                      {/* Time slot grid lines */}
                      {timeSlots.map((slot, slotIdx) => {
                        if (slotIdx % slotsPerHour === 0) {
                          const position = (slotIdx / totalSlots) * 100;
                          return (
                            <div
                              key={slotIdx}
                              className="absolute border-l border-gray-100"
                              style={{ left: `${position}%`, height: '100%' }}
                            />
                          );
                        }
                        return null;
                      })}

                      {/* Droppable area for creating shifts */}
                      <DroppableCell
                        id={`cell-${row.id}-${days[0].toISOString()}`}
                        rowId={row.id}
                        day={days[0]}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const dayDuration = (endHour - startHour) * 60; // minutes
                          const clickedMinutes = (x / rect.width) * dayDuration;
                          const totalMinutes = startHour * 60 + clickedMinutes;
                          const hour = Math.floor(totalMinutes / 60);
                          const minutes = totalMinutes % 60;
                          handleCellClick(row.id, days[0], hour, minutes);
                        }}
                      >
                        {/* Availability and time-off indicators (only for employee rows) */}
                        {layoutMode === 'employee' && row.type === 'employee' && showAvailabilityIndicators && (
                          <>
                            {/* Time-off blocks */}
                            {getTimeOffForDay(row.id, days[0]).map((to, idx) => (
                              <div
                                key={`timeoff-${idx}`}
                                className="absolute inset-0 bg-gray-200 bg-opacity-60 border-2 border-red-300 border-dashed pointer-events-none z-0"
                                style={{ zIndex: 0 }}
                                title={`Time-off: ${to.type}`}
                              />
                            ))}
                            
                            {/* Availability overlays */}
                            {getAvailabilityForDay(row.id, days[0]).map((av, idx) => {
                              const [startHour, startMin] = av.startTime.split(':').map(Number);
                              const [endHour, endMin] = av.endTime.split(':').map(Number);
                              
                              // Check if this is a full-day unavailability (00:00 to 23:59)
                              const isFullDayUnavailable = av.availabilityType === 'UNAVAILABLE' && 
                                                           startHour === 0 && startMin === 0 && 
                                                           endHour === 23 && endMin >= 59;
                              
                              // Calculate position for day view (time-based)
                              const dayStartMinutes = startHour * 60;
                              const dayEndMinutes = endHour * 60;
                              const dayDuration = (endHour - startHour) * 60;
                              const left = ((dayStartMinutes - (timeRange.start * 60)) / ((timeRange.end - timeRange.start) * 60)) * 100;
                              const width = ((endHour - startHour) / (timeRange.end - timeRange.start)) * 100;
                              
                              // Make unavailable periods more visible, especially full-day
                              const colorClass = 
                                av.availabilityType === 'AVAILABLE' ? 'bg-green-100 bg-opacity-30 border-green-300' :
                                av.availabilityType === 'UNAVAILABLE' 
                                  ? isFullDayUnavailable 
                                    ? 'bg-red-200 bg-opacity-70 border-red-500 border-2' 
                                    : 'bg-red-100 bg-opacity-50 border-red-400'
                                : 'bg-blue-100 bg-opacity-30 border-blue-300';
                              
                              return (
                                <div
                                  key={`avail-${av.id}-${idx}`}
                                  className={`absolute ${colorClass} ${isFullDayUnavailable ? 'border-solid' : 'border-dashed'} pointer-events-none z-0`}
                                  style={{ 
                                    zIndex: 0,
                                    left: isFullDayUnavailable ? '0%' : `${Math.max(0, left)}%`,
                                    width: isFullDayUnavailable ? '100%' : `${Math.min(100, width)}%`,
                                    top: 0,
                                    height: '100%'
                                  }}
                                  title={`${av.availabilityType}: ${av.startTime} - ${av.endTime}${isFullDayUnavailable ? ' (Cannot work this day)' : ''}`}
                                />
                              );
                            })}
                            
                            {/* Unavailable badge for full-day unavailability in day view */}
                            {layoutMode === 'employee' && row.type === 'employee' && showAvailabilityIndicators && (() => {
                              const dayAvailabilities = getAvailabilityForDay(row.id, days[0]);
                              const fullDayUnavailable = dayAvailabilities.some(av => {
                                const [startHour, startMin] = av.startTime.split(':').map(Number);
                                const [endHour, endMin] = av.endTime.split(':').map(Number);
                                return av.availabilityType === 'UNAVAILABLE' && 
                                       startHour === 0 && startMin === 0 && 
                                       endHour === 23 && endMin >= 59;
                              });
                              
                              if (fullDayUnavailable) {
                                return (
                                  <div className="absolute top-0.5 right-0.5 pointer-events-none" style={{ zIndex: 20 }}>
                                    <div className="bg-red-600 text-white text-[10px] font-semibold px-1 py-0.5 rounded shadow flex items-center gap-0.5 border border-red-800">
                                      <AlertCircle className="w-2.5 h-2.5" />
                                      <span>UNAVAILABLE</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )}
                        
                        {/* Shifts as horizontal bars */}
                        {rowShifts.map((shift) => {
                          const position = getShiftPosition(shift, 80);
                          if (!position) return null;

                          // Check for conflicts
                          const conflicts = getShiftConflicts(shift, shift.employeePositionId || null);

                          return (
                            <DraggableShift
                              key={shift.id}
                              shift={shift}
                              hasConflict={conflicts.hasConflict}
                              layoutMode={layoutMode}
                              style={{
                                top: '0',
                                height: '100%',
                                left: `${position.left}%`,
                                width: `${position.width}%`,
                                minHeight: '80px',
                                zIndex: 10, // Above availability overlays
                              }}
                              onClick={onShiftClick}
                            />
                          );
                        })}
                      </DroppableCell>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Week view: Days at top, users on left, shift blocks in grid
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header: Days of week */}
      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="w-48 border-r border-gray-200 p-2 font-medium text-gray-700">
          {layoutMode === 'employee' ? 'Employee' : layoutMode === 'position' ? 'Position' : 'Station'}
        </div>
        <div className={`flex-1 grid gap-px bg-gray-200`} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((day, idx) => (
            <div
              key={idx}
              className="bg-white p-2 text-center text-sm font-medium text-gray-900"
            >
              <div>{format(day, 'EEE')}</div>
              <div className="text-xs text-gray-500">{format(day, 'MMM d')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <div className="flex">
          {/* Sidebar: Row labels */}
          <div className="w-48 border-r border-gray-200 bg-gray-50 sticky left-0 z-10">
            {rows.map((row) => {
              const employeeTotal = employeeTotals[row.id] || 0;
              const hasWarning = employeeWarnings[row.id] || false;
              
              return (
                <div
                  key={row.id}
                  className={`h-20 border-b border-gray-200 p-2 flex items-center justify-between ${
                    row.type === 'open-shifts' 
                      ? 'bg-green-50 border-green-200' 
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {row.type === 'open-shifts' ? (
                      <>
                        {/* Green circle icon for Open Shifts */}
                        <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-white flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                        <HelpCircle className="w-4 h-4 text-green-700 flex-shrink-0" />
                      </>
                    ) : row.type === 'employee' ? (
                      <>
                        {/* Profile icon */}
                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        {hasWarning && (
                          <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        )}
                      </>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${
                        row.type === 'open-shifts' 
                          ? 'text-green-900' 
                          : 'text-gray-900'
                      }`} title={row.name}>
                        {row.name}
                      </div>
                      {row.type === 'employee' && employeeTotal > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {employeeTotal.toFixed(1)}h
                        </div>
                      )}
                    </div>
                  </div>
                  {row.type === 'employee' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rowElement = e.currentTarget.closest('.h-20');
                        if (rowElement) {
                          const rect = rowElement.getBoundingClientRect();
                          // Position menu to the right of the sidebar, aligned with the row (overlapping first day column)
                          setContextMenu({
                            open: true,
                            anchorPoint: { x: rect.right + 4, y: rect.top },
                            employeeId: row.id,
                            employeeName: row.name,
                          });
                        }
                      }}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Employee options"
                    >
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grid: Days with shift blocks (no time slots column) */}
          <div className="flex-1 relative">
            {rows.map((row, rowIdx) => (
              <div key={row.id} className="relative h-20 border-b border-gray-200">
                {/* Day columns */}
                <div className="absolute inset-0 flex">
                  {days.map((day, dayIdx) => {
                    const cellId = `cell-${row.id}-${day.toISOString()}`;
                    const dayShifts = getShiftsForRowAndDay(row.id, day);
                    
                    return (
                      <DroppableCell
                        key={dayIdx}
                        id={cellId}
                        rowId={row.id}
                        day={day}
                        onClick={(e) => {
                          // Only create new shift if clicking on empty space (not on an existing shift)
                          // The shift blocks have pointer-events: auto, so clicks on them won't bubble
                          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.droppable-cell')) {
                            // Default to 9 AM when clicking in week view, or distribute times if multiple shifts exist
                            const existingShiftCount = dayShifts.length;
                            let hour = 9;
                            let minutes = 0;
                            
                            // If there are existing shifts, try to find a time slot that doesn't overlap
                            // For simplicity, we'll space them out: 9 AM, 1 PM, 5 PM, etc.
                            if (existingShiftCount > 0) {
                              hour = 9 + (existingShiftCount * 4); // Space shifts 4 hours apart
                              if (hour >= 24) hour = 9; // Wrap around if needed
                            }
                            
                            handleCellClick(row.id, day, hour, minutes);
                          }
                        }}
                        className="bg-white relative flex-1 border-r border-gray-200 h-full droppable-cell"
                        style={{ 
                          minWidth: 0,
                          ...(dayIdx === days.length - 1 ? { borderRight: 'none' } : {})
                        }}
                      >
                        {/* Availability and time-off indicators (only for employee rows) */}
                        {layoutMode === 'employee' && row.type === 'employee' && showAvailabilityIndicators && (
                          <>
                            {/* Debug: Show if availability check is running */}
                            {(() => {
                              const dayAvailabilities = getAvailabilityForDay(row.id, day);
                              if (dayAvailabilities.length > 0) {
                                console.log('🎨 Rendering availability for', row.name, 'on', format(day, 'EEEE'), {
                                  count: dayAvailabilities.length,
                                  types: dayAvailabilities.map(av => av.availabilityType)
                                });
                              }
                              return null;
                            })()}
                            
                            {/* Time-off blocks (gray/red stripes) */}
                            {getTimeOffForDay(row.id, day).map((to, idx) => (
                              <div
                                key={`timeoff-${idx}`}
                                className="absolute inset-0 bg-gray-200 bg-opacity-60 border-2 border-red-300 border-dashed pointer-events-none z-0"
                                style={{ zIndex: 0 }}
                                title={`Time-off: ${to.type}`}
                              />
                            ))}
                            
                            {/* Availability overlays */}
                            {getAvailabilityForDay(row.id, day).map((av, idx) => {
                              const [startHour, startMin] = av.startTime.split(':').map(Number);
                              const [endHour, endMin] = av.endTime.split(':').map(Number);
                              
                              // Check if this is a full-day unavailability (00:00 to 23:59)
                              const isFullDayUnavailable = av.availabilityType === 'UNAVAILABLE' && 
                                                           startHour === 0 && startMin === 0 && 
                                                           endHour === 23 && endMin >= 59;
                              
                              // Make unavailable periods more visible, especially full-day
                              const colorClass = 
                                av.availabilityType === 'AVAILABLE' ? 'bg-green-100 bg-opacity-30 border-green-300' :
                                av.availabilityType === 'UNAVAILABLE' 
                                  ? isFullDayUnavailable 
                                    ? 'bg-red-300 bg-opacity-80 border-red-600 border-2' 
                                    : 'bg-red-200 bg-opacity-60 border-red-500'
                                : 'bg-blue-100 bg-opacity-30 border-blue-300';
                              
                              return (
                                <div
                                  key={`avail-${av.id}-${idx}`}
                                  className={`absolute inset-0 ${colorClass} ${isFullDayUnavailable ? 'border-solid' : 'border-dashed'} pointer-events-none`}
                                  style={{ zIndex: 1 }}
                                  title={`${av.availabilityType}: ${av.startTime} - ${av.endTime}${isFullDayUnavailable ? ' (Cannot work this day)' : ''}`}
                                />
                              );
                            })}
                            
                            {/* Unavailable badge for full-day unavailability */}
                            {layoutMode === 'employee' && row.type === 'employee' && showAvailabilityIndicators && (() => {
                              const dayAvailabilities = getAvailabilityForDay(row.id, day);
                              const fullDayUnavailable = dayAvailabilities.some(av => {
                                const [startHour, startMin] = av.startTime.split(':').map(Number);
                                const [endHour, endMin] = av.endTime.split(':').map(Number);
                                return av.availabilityType === 'UNAVAILABLE' && 
                                       startHour === 0 && startMin === 0 && 
                                       endHour === 23 && endMin >= 59;
                              });
                              
                              if (fullDayUnavailable) {
                                return (
                                  <div className="absolute top-0.5 right-0.5 pointer-events-none" style={{ zIndex: 20 }}>
                                    <div className="bg-red-600 text-white text-[10px] font-semibold px-1 py-0.5 rounded shadow flex items-center gap-0.5 border border-red-800">
                                      <AlertCircle className="w-2.5 h-2.5" />
                                      <span>UNAVAILABLE</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )}
                        
                        {/* Shifts as blocks in grid cells - stack vertically if multiple */}
                        {dayShifts.length > 0 && (
                          <div className="absolute inset-0 p-0.5 flex flex-col gap-0.5 pointer-events-none" style={{ zIndex: 10 }}>
                            {dayShifts.map((shift, shiftIdx) => {
                              // Check for conflicts
                              const conflicts = getShiftConflicts(shift, shift.employeePositionId || null);
                              
                              // Calculate height for each shift (distribute evenly, or use flex)
                              const shiftHeight = dayShifts.length > 1 
                                ? `calc((100% - ${(dayShifts.length - 1) * 2}px) / ${dayShifts.length})`
                                : '100%';
                              
                              return (
                                <div key={shift.id} style={{ height: shiftHeight, minHeight: dayShifts.length > 1 ? '28px' : '36px', flexShrink: 0, pointerEvents: 'auto' }}>
                                  <DraggableShift
                                    shift={shift}
                                    hasConflict={conflicts.hasConflict}
                                    layoutMode={layoutMode}
                                    style={{
                                      height: '100%',
                                      width: '100%',
                                    }}
                                    onClick={onShiftClick}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Show indicator when there are multiple shifts */}
                        {dayShifts.length > 1 && (
                          <div className="absolute bottom-0.5 right-0.5 pointer-events-none" style={{ zIndex: 15 }}>
                            <div className="bg-blue-600 text-white text-[9px] font-semibold px-1 py-0.5 rounded shadow flex items-center gap-0.5">
                              <span>{dayShifts.length}x</span>
                            </div>
                          </div>
                        )}
                      </DroppableCell>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex border-t border-gray-200 bg-gray-50">
          <div className="w-48 border-r border-gray-200 p-2 text-sm font-semibold text-gray-800 flex items-center gap-2">
            Assigned Total
            {(() => {
              const totalHours = Object.values(dayTotals).reduce((sum, hours) => sum + hours, 0);
              return totalHours > 0 ? ` ${totalHours.toFixed(2)} hours` : '';
            })()}
            {Object.values(dayWarnings).some(w => w) && (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
          </div>
          <div className={`flex-1 grid gap-px`} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
            {days.map((day, idx) => {
              const key = day.toISOString();
              const totalHours = dayTotals[key] || 0;
              const hasWarning = dayWarnings[key] || false;
              const totalHoursText = totalHours > 0 ? `${totalHours.toFixed(1)}h` : '0h';
              
              return (
                <div key={idx} className="bg-white p-3 text-center text-sm font-semibold text-gray-900 flex items-center justify-center gap-1">
                  {hasWarning && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <span>{totalHoursText}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Employee Context Menu */}
      {contextMenu && (
        <ContextMenu
          open={contextMenu.open}
          onClose={() => setContextMenu(null)}
          anchorPoint={contextMenu.anchorPoint}
          items={[
            {
              label: `Copy ${contextMenu.employeeName.split(' ')[0]}'s Previous Week`,
              onClick: () => handleCopyPreviousWeek(contextMenu.employeeId, contextMenu.employeeName),
            },
          ]}
        />
      )}
    </div>
  );
}

