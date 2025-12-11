'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfWeek, addDays, parseISO, isSameDay, startOfDay } from 'date-fns';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Schedule, ScheduleShift, EmployeeAvailability, getAllEmployeeAvailability } from '@/api/scheduling';
import ScheduleCalendarGrid from './ScheduleCalendarGrid';
import ShiftBlock from './ShiftBlock';
import { Button, Card, Badge, Spinner, Alert, Modal, Input, Textarea } from 'shared/components';
import { Calendar, Plus, Save, Eye, EyeOff, RotateCcw, Users, Briefcase, MapPin, Edit, Trash2, Clock, User, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useScheduling } from '@/hooks/useScheduling';
import { getBusiness } from '@/api/business';
import { getSchedulingRecommendations } from '@/api/scheduling';
import { useSession } from 'next-auth/react';
import { ScheduleFilters } from './ScheduleBuilderSidebar';
import { useSchedulingWebSocket } from '@/hooks/useSchedulingWebSocket';

interface ScheduleBuilderVisualProps {
  scheduleId: string;
  businessId: string;
  onSave?: () => void;
  onCancel?: () => void;
  filters?: ScheduleFilters;
  registerDragHandlers?: (handlers: {
    onDragStart: (event: DragStartEvent) => void;
    onDragEnd: (event: DragEndEvent) => Promise<void>;
  }) => void;
}

type BuilderLayoutMode = 'employee' | 'position' | 'station';

export default function ScheduleBuilderVisual({
  scheduleId,
  businessId,
  onSave,
  onCancel,
  filters,
  registerDragHandlers,
}: ScheduleBuilderVisualProps) {
  const { data: session } = useSession();
  const {
    schedules,
    shifts,
    loading,
    error,
    fetchShifts,
    createNewShift,
    updateExistingShift,
    removeShift,
    updateExistingSchedule,
    refresh,
  } = useScheduling({ businessId, scope: 'admin', autoFetch: false });

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleShifts, setScheduleShifts] = useState<ScheduleShift[]>([]);
const [layoutMode, setLayoutMode] = useState<'employee' | 'position' | 'station'>('employee');
const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
const [currentDayOffset, setCurrentDayOffset] = useState(0); // Offset from schedule start date for day view
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; position?: string; userId?: string }>>([]);
  const [positionOptions, setPositionOptions] = useState<Array<{ id: string; name: string; title: string; defaultStartTime?: string | null; defaultEndTime?: string | null }>>([]);
  const [stations, setStations] = useState<Array<{ id: string; name: string; stationType?: string; defaultStartTime?: string | null; defaultEndTime?: string | null }>>([]);
  const [draggingShift, setDraggingShift] = useState<ScheduleShift | null>(null);
  const [draggingResource, setDraggingResource] = useState<{ type: 'employee' | 'position' | 'station'; label: string; detail?: string } | null>(null);
  const formatTimeRange = (start?: string | null, end?: string | null): string | null => {
    if (start && end) {
      return `${start} - ${end}`;
    }
    if (start) {
      return `Starts ${start}`;
    }
    if (end) {
      return `Ends ${end}`;
    }
    return null;
  };

  const createDateFromTimeString = (timeString: string, day: Date): Date => {
    const [hours, minutes] = timeString.split(':').map((value) => Number(value));
    const result = new Date(day);
    result.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
    return result;
  };

  const getResourceDefaultTimes = (
    resource: { defaultStartTime?: string | null; defaultEndTime?: string | null } | undefined,
    baseDay: Date
  ): { start?: Date; end?: Date } => {
    if (!resource) return {};
    const defaults: { start?: Date; end?: Date } = {};
    if (resource.defaultStartTime) {
      defaults.start = createDateFromTimeString(resource.defaultStartTime, baseDay);
    }
    if (resource.defaultEndTime) {
      defaults.end = createDateFromTimeString(resource.defaultEndTime, baseDay);
      if (defaults.start && defaults.end && defaults.end <= defaults.start) {
        defaults.end.setDate(defaults.end.getDate() + 1);
      }
    }
    return defaults;
  };

  const getPositionDragDetail = (position: { defaultStartTime?: string | null; defaultEndTime?: string | null }): string | undefined => {
    const timeRange = formatTimeRange(position.defaultStartTime, position.defaultEndTime);
    return timeRange || undefined;
  };

  const getStationDragDetail = (station: { stationType?: string; defaultStartTime?: string | null; defaultEndTime?: string | null }): string | undefined => {
    const timeRange = formatTimeRange(station.defaultStartTime, station.defaultEndTime);
    const parts = [];
    if (station.stationType) {
      parts.push(station.stationType);
    }
    if (timeRange) {
      parts.push(timeRange);
    }
    if (parts.length === 0) {
      return undefined;
    }
    return parts.join(' • ');
  };

  // Helper function to format time in When I Work style (e.g., "9a", "5p", "12:30p")
  const formatWhenIWorkTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const isPM = hours >= 12;
    let displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12;
    
    if (minutes === 0) {
      return `${displayHours}${isPM ? 'p' : 'a'}`;
    } else {
      const minutesStr = minutes.toString().padStart(2, '0');
      return `${displayHours}:${minutesStr}${isPM ? 'p' : 'a'}`;
    }
  };
  const [selectedShift, setSelectedShift] = useState<ScheduleShift | null>(null);
  // Use a ref to track the original shift ID to prevent overwrites
  const originalShiftIdRef = useRef<string | null>(null);
  const [updatingShiftIds, setUpdatingShiftIds] = useState<Set<string>>(new Set());
  // Member shift assignments: shiftId -> memberUserId (for shifts with null employeePositionId)
  // Stored in localStorage key: `memberShiftAssignments_${businessId}_${scheduleId}`
  const [memberShiftAssignments, setMemberShiftAssignments] = useState<Map<string, string>>(() => {
    if (typeof window === 'undefined') return new Map();
    try {
      const key = `memberShiftAssignments_${businessId}_${scheduleId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(parsed);
      }
    } catch (err) {
      console.error('Failed to load member shift assignments from localStorage:', err);
    }
    return new Map();
  });
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timeRange, setTimeRange] = useState({ start: 6, end: 24 }); // Will be loaded from business config
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedLayoutRef = useRef<{ layoutMode: string; viewMode: string } | null>(null);
  const isSavingRef = useRef(false);
  const [shiftColor, setShiftColor] = useState<string>('#3b82f6');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState('');
  const [breakEndTime, setBreakEndTime] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedPositionId, setSelectedPositionId] = useState<string>('');
  const [isCreatingNewShift, setIsCreatingNewShift] = useState(false);

  const getShiftPositionTitle = useCallback((shift?: ScheduleShift | null) => {
    if (!shift) return undefined;
    if (shift.position?.title) return shift.position.title;
    if (shift.employeePosition?.position?.title) return shift.employeePosition.position.title;
    return undefined;
  }, []);
  const [businessConfig, setBusinessConfig] = useState<{
    mode?: string;
    strategy?: string;
    layout?: BuilderLayoutMode;
  } | null>(null);
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1); // Default to Monday
  
  // Availability and time-off data for visual indicators
  const [employeeAvailability, setEmployeeAvailability] = useState<Record<string, EmployeeAvailability[]>>({}); // employeePositionId -> availability[]
  const [timeOffData, setTimeOffData] = useState<Array<{
    employeePositionId: string;
    startDate: string;
    endDate: string;
    type: string;
  }>>([]);
  const [showAvailabilityIndicators, setShowAvailabilityIndicators] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastActionIdsRef = React.useRef<Set<string>>(new Set()); // Track recent actions to prevent duplicate updates
  const actionTimeoutsRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  // WebSocket integration for real-time updates
  useSchedulingWebSocket({
    businessId,
    scheduleId,
    enabled: !!session?.accessToken && !!scheduleId,
    events: {
      onShiftCreated: (data) => {
        // Only refresh if this wasn't our own action
        if (!lastActionIdsRef.current.has(data.shift.id)) {
          console.log('🔄 Refreshing shifts after remote shift created');
          fetchShifts(scheduleId);
        } else {
          console.log('⏭️ Skipping refresh for own shift creation:', data.shift.id);
          lastActionIdsRef.current.delete(data.shift.id);
          const timeout = actionTimeoutsRef.current.get(data.shift.id);
          if (timeout) {
            clearTimeout(timeout);
            actionTimeoutsRef.current.delete(data.shift.id);
          }
        }
      },
      onShiftUpdated: (data) => {
        // Only refresh if this wasn't our own action
        if (!lastActionIdsRef.current.has(data.shift.id)) {
          console.log('🔄 Refreshing shifts after remote shift updated');
          fetchShifts(scheduleId);
        } else {
          console.log('⏭️ Skipping refresh for own shift update:', data.shift.id);
          lastActionIdsRef.current.delete(data.shift.id);
          const timeout = actionTimeoutsRef.current.get(data.shift.id);
          if (timeout) {
            clearTimeout(timeout);
            actionTimeoutsRef.current.delete(data.shift.id);
          }
        }
      },
      onShiftDeleted: (data) => {
        // Only refresh if this wasn't our own action
        if (!lastActionIdsRef.current.has(data.shiftId)) {
          console.log('🔄 Refreshing shifts after remote shift deleted');
          fetchShifts(scheduleId);
        } else {
          console.log('⏭️ Skipping refresh for own shift deletion:', data.shiftId);
          lastActionIdsRef.current.delete(data.shiftId);
          const timeout = actionTimeoutsRef.current.get(data.shiftId);
          if (timeout) {
            clearTimeout(timeout);
            actionTimeoutsRef.current.delete(data.shiftId);
          }
        }
      },
      onSchedulePublished: (data) => {
        if (data.scheduleId === scheduleId) {
          console.log('🔄 Schedule published, refreshing data');
          refresh();
        }
      }
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts
      actionTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      actionTimeoutsRef.current.clear();
      lastActionIdsRef.current.clear();
    };
  }, []);

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-color-picker]')) {
        setShowColorPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  // Sync isCreatingNewShift with selectedShift to ensure button text is correct
  useEffect(() => {
    if (selectedShift) {
      const isTemp = selectedShift.id.startsWith('temp-');
      if (isCreatingNewShift !== isTemp) {
        console.log('🔄 Syncing isCreatingNewShift with selectedShift:', {
          shiftId: selectedShift.id,
          isTemp,
          currentIsCreatingNewShift: isCreatingNewShift,
          settingTo: isTemp
        });
        setIsCreatingNewShift(isTemp);
      }
    } else {
      // If selectedShift is cleared, reset isCreatingNewShift
      if (isCreatingNewShift) {
        setIsCreatingNewShift(false);
      }
    }
  }, [selectedShift?.id]); // Only depend on the ID, not the whole object

  // Load schedule and business configuration
  useEffect(() => {
    if (scheduleId && businessId && session?.accessToken) {
      loadScheduleData();
      loadBusinessData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId, businessId, session?.accessToken]);

  // Load business configuration to determine layout mode
  useEffect(() => {
    if (businessId && session?.accessToken) {
      loadBusinessConfiguration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, session?.accessToken]);

  const loadScheduleData = async () => {
    if (!session?.accessToken) {
      console.warn('⚠️ ScheduleBuilderVisual: No access token');
      return;
    }
    
    try {
      console.log('🔄 ScheduleBuilderVisual: Loading schedule data', { scheduleId, businessId });
      
      // Fetch schedule by ID directly since autoFetch is false and schedules array is empty
      const { getScheduleById } = await import('@/api/scheduling');
      const scheduleData = await getScheduleById(businessId, scheduleId, session.accessToken);
      
      // getScheduleById returns { schedule: Schedule } or Schedule directly
      const schedule = (scheduleData as any).schedule || scheduleData;
      
      if (schedule) {
        setSchedule(schedule);
        if (schedule.layoutMode) {
          const layoutValue = schedule.layoutMode as string;
          const normalizedLayout: BuilderLayoutMode =
            layoutValue === 'role'
              ? 'position'
              : (layoutValue as BuilderLayoutMode);
          setLayoutMode(normalizedLayout);
        }
        if (schedule.viewMode === 'week' || schedule.viewMode === 'day') {
          setViewMode(schedule.viewMode);
        } else {
          setViewMode('week');
        }
        console.log('✅ ScheduleBuilderVisual: Schedule loaded', { scheduleName: schedule.name });
      }
      
      // Fetch shifts for this schedule
      await fetchShifts(scheduleId);
      console.log('✅ ScheduleBuilderVisual: Shifts loaded', { shiftCount: shifts.length });
      
      // Load time-off data once schedule is loaded (so we have dates)
      await loadTimeOffData();
    } catch (err) {
      console.error('Failed to load schedule:', err);
    }
  };

  const loadBusinessData = async () => {
    if (!session?.accessToken) return;
    try {
      // Load employees from org chart
      const { getBusinessEmployees, getPositions } = await import('@/api/orgChart');
      const employeesResponse = await getBusinessEmployees(businessId, session.accessToken);
      
      if (employeesResponse.success && employeesResponse.data) {
        const employeeList = employeesResponse.data.map((ep: any) => ({
          id: ep.id, // This is the employeePositionId
          name: ep.user?.name || 'Unknown',
          position: ep.position?.title || ep.position?.name || undefined,
          email: ep.user?.email || undefined,
          userId: ep.user?.id, // Store user ID for filtering
        }));
        setEmployees(employeeList);
        console.log('✅ Employees loaded', { count: employeeList.length });
      }

      // Load positions (for position layout mode)
      const positionsResponse = await getPositions(businessId, session.accessToken);
      if (positionsResponse.success) {
        const positionList = positionsResponse.data.map((p: any) => {
          const title = p.title || p.name || 'Unknown Position';
          return {
            id: p.id,
            title,
            name: title,
            defaultStartTime: p.defaultStartTime || null,
            defaultEndTime: p.defaultEndTime || null,
          };
        });
        setPositionOptions(positionList);
        console.log('✅ Positions loaded', { count: positionList.length });
      }

      // Load stations (for station layout mode)
      const { getBusinessStations } = await import('@/api/scheduling');
      const stationsResponse = await getBusinessStations(businessId, session.accessToken);
      if (stationsResponse.stations) {
        const stationsList = stationsResponse.stations
          .filter((s: any) => s.isActive) // Only show active stations
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            stationType: s.stationType || s.stationCategory || undefined,
            defaultStartTime: s.defaultStartTime || null,
            defaultEndTime: s.defaultEndTime || null,
          }));
        setStations(stationsList);
        console.log('✅ Stations loaded', { count: stationsList.length });
      }

      // Load employee availability for visual indicators
      try {
        const availabilityList = await getAllEmployeeAvailability(businessId, session.accessToken);
        const availabilityByEmployee: Record<string, EmployeeAvailability[]> = {};
        availabilityList.forEach((av: EmployeeAvailability) => {
          if (!availabilityByEmployee[av.employeePositionId]) {
            availabilityByEmployee[av.employeePositionId] = [];
          }
          availabilityByEmployee[av.employeePositionId].push(av);
        });
        setEmployeeAvailability(availabilityByEmployee);
        console.log('✅ Availability loaded', { 
          count: availabilityList.length,
          byEmployee: Object.keys(availabilityByEmployee).length,
          employeeIds: Object.keys(availabilityByEmployee),
          sampleAvailability: availabilityList.slice(0, 3).map(av => ({
            employeePositionId: av.employeePositionId,
            dayOfWeek: av.dayOfWeek,
            type: av.availabilityType,
            time: `${av.startTime}-${av.endTime}`
          }))
        });
      } catch (err) {
        console.warn('Failed to load availability (may not have access):', err);
      }

    } catch (err) {
      console.error('Failed to load business data:', err);
    }
  };

  // Load time-off data from HR module (separate function to use schedule dates)
  const loadTimeOffData = async () => {
    if (!session?.accessToken || !schedule) return;
    
    try {
      const startDate = schedule.startDate ? parseISO(schedule.startDate).toISOString() : new Date().toISOString();
      const endDate = schedule.endDate ? parseISO(schedule.endDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const timeOffResponse = await fetch(`/api/hr/admin/time-off/calendar?businessId=${businessId}&startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (timeOffResponse.ok) {
        const timeOffJson = await timeOffResponse.json();
        const timeOffList = (timeOffJson.requests || []).map((req: any) => ({
          employeePositionId: req.employeePosition?.id,
          startDate: req.startDate,
          endDate: req.endDate,
          type: req.type
        })).filter((item: any) => item.employeePositionId); // Only include requests with employee positions
        setTimeOffData(timeOffList);
        console.log('✅ Time-off data loaded', { count: timeOffList.length });
      }
    } catch (err) {
      console.warn('Failed to load time-off data (HR module may not be installed):', err);
    }
  };

  const loadBusinessConfiguration = async () => {
    if (!session?.accessToken) return;
    try {
      // Load business to get schedulingConfig including weekStartDay and operating hours
      const businessResponse = await getBusiness(businessId, session.accessToken);
      if (businessResponse.success && businessResponse.data?.schedulingConfig) {
        const config = businessResponse.data.schedulingConfig as Record<string, unknown>;
        const weekStartDay = config.weekStartDay as 'monday' | 'sunday' | undefined;
        if (weekStartDay) {
          setWeekStartsOn(weekStartDay === 'sunday' ? 0 : 1); // Convert to date-fns format
        }
        
        // Load operating hours for shift coverage
        const operatingHoursStart = (config.operatingHoursStart as number) || 6;
        const operatingHoursEnd = (config.operatingHoursEnd as number) || 24;
        setTimeRange({ start: operatingHoursStart, end: operatingHoursEnd });
      }

      const response = await getSchedulingRecommendations(businessId, undefined, session.accessToken);
      if (response.success && response.recommendation) {
        const layoutValue = response.recommendation.layout as string;
        const recommendedLayout: BuilderLayoutMode | undefined =
          layoutValue === 'role'
            ? 'position'
            : (layoutValue as BuilderLayoutMode);
        setBusinessConfig({
          mode: response.currentConfig?.mode || response.recommendation.mode,
          strategy: response.currentConfig?.strategy || response.recommendation.strategy,
          layout: recommendedLayout,
        });
        // Set default layout mode based on business configuration
        if (!schedule?.layoutMode && recommendedLayout) {
          setLayoutMode(recommendedLayout);
        }
      }
    } catch (err) {
      console.error('Failed to load business configuration:', err);
    }
  };

  // Persist member shift assignments to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = `memberShiftAssignments_${businessId}_${scheduleId}`;
      const entries = Array.from(memberShiftAssignments.entries());
      localStorage.setItem(key, JSON.stringify(entries));
    } catch (err) {
      console.error('Failed to save member shift assignments to localStorage:', err);
    }
  }, [memberShiftAssignments, businessId, scheduleId]);

  // Update shifts when they change and apply filters
  useEffect(() => {
    // Always update scheduleShifts, even if shifts array is empty (to clear display)
    // Only filter by scheduleId if it's defined (required prop, but handle gracefully)
    if (!scheduleId) {
      console.warn('⚠️ ScheduleBuilderVisual: scheduleId prop is undefined - this should not happen');
      setScheduleShifts([]);
      return;
    }
    
    let filtered = (shifts || []).filter(s => s.scheduleId === scheduleId);
    
    // Apply job location filter if set (filter by locationId, not stationName)
    if (filters && filters.jobLocations.length > 0) {
      filtered = filtered.filter(shift => {
        // Match if shift's locationId matches any selected job location
        return shift.locationId && filters.jobLocations.includes(shift.locationId);
      });
    }
    
    setScheduleShifts(filtered);
    console.log('🔄 ScheduleBuilderVisual: Filtered shifts updated', { 
      totalShifts: shifts?.length || 0, 
      filteredCount: filtered.length,
      scheduleId,
      hasScheduleId: !!scheduleId
    });
      
      // Restore and clean up member shift assignments
      setMemberShiftAssignments(prev => {
        const next = new Map(prev);
        let changed = false;
        
        // First, clean up assignments for shifts that no longer exist or have been assigned to an employee
        Array.from(prev.entries()).forEach(([shiftId, memberUserId]) => {
          const shift = filtered.find(s => s.id === shiftId);
          // Remove assignment if shift no longer exists or has been assigned to an employee
          if (!shift || shift.employeePositionId !== null) {
            next.delete(shiftId);
            changed = true;
          }
        });
        
        // Then, restore assignments from localStorage for shifts with null employeePositionId
        // This ensures assignments persist across page refreshes
        if (typeof window !== 'undefined') {
          try {
            const key = `memberShiftAssignments_${businessId}_${scheduleId}`;
            const stored = localStorage.getItem(key);
            if (stored) {
              const storedAssignments = new Map(JSON.parse(stored));
              // Only restore assignments for shifts that currently exist and have null employeePositionId
              filtered.forEach(shift => {
                if (shift.employeePositionId === null && storedAssignments.has(shift.id)) {
                  const storedMemberUserId = storedAssignments.get(shift.id);
                  if (storedMemberUserId && typeof storedMemberUserId === 'string' && (!next.has(shift.id) || next.get(shift.id) !== storedMemberUserId)) {
                    next.set(shift.id, storedMemberUserId);
                    changed = true;
                  }
                }
              });
            }
          } catch (err) {
            console.error('Failed to restore member shift assignments from localStorage:', err);
          }
        }
        
        return changed ? next : prev;
      });
  }, [shifts, scheduleId, filters, stations, businessId]);

  // Apply filters to data arrays
  const filteredEmployees = React.useMemo(() => {
    if (!filters || filters.users.length === 0) return employees;
    return employees.filter(emp => {
      // Filter by user ID - match if employee's userId is in the filter
      return emp.userId && filters.users.includes(emp.userId);
    });
  }, [employees, filters]);

  const filteredPositions = React.useMemo(() => {
    if (!filters || filters.positions.length === 0) return positionOptions;
    return positionOptions.filter(pos => filters.positions.includes(pos.id));
  }, [positionOptions, filters]);

  const filteredStations = React.useMemo(() => {
    if (!filters || filters.stations.length === 0) return stations;
    return stations.filter(station => filters.stations.includes(station.id));
  }, [stations, filters]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current;
    
    if (activeData?.type === 'shift') {
      const shift = activeData.shift || scheduleShifts.find(s => {
        const activeId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id);
        return activeId === `shift-${s.id}`;
      });
      if (shift) {
        setDraggingShift(shift);
      }
      return;
    }

    if (activeData?.type === 'employee' && activeData.employee) {
      setDraggingResource({
        type: 'employee',
        label: activeData.employee.name,
        detail: activeData.employee.position,
      });
    } else if (activeData?.type === 'position' && activeData.position) {
      setDraggingResource({
        type: 'position',
        label: activeData.position.title || activeData.position.name || 'Position',
        detail: getPositionDragDetail(activeData.position),
      });
    } else if (activeData?.type === 'station' && activeData.station) {
      setDraggingResource({
        type: 'station',
        label: activeData.station.name,
        detail: getStationDragDetail(activeData.station),
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setDraggingShift(null);
    setDraggingResource(null);

    if (!over) return;

    const activeId = typeof active.id === 'string' ? active.id : String(active.id);
    const activeData = active.data.current;

    if (
      (activeData?.type === 'employee' && activeData.employee) ||
      (activeData?.type === 'position' && activeData.position) ||
      (activeData?.type === 'station' && activeData.station)
    ) {
      const overId = over.id as string;
      if (!overId.startsWith('cell-')) {
        return;
      }

      const cellData = over.data.current;
      if (!cellData || cellData.type !== 'cell') {
        return;
      }

      const { rowId, day } = cellData;
      const dropDay = new Date(day);
      const resourceDefaults =
        activeData.type === 'position'
          ? getResourceDefaultTimes(activeData.position, dropDay)
          : activeData.type === 'station'
          ? getResourceDefaultTimes(activeData.station, dropDay)
          : {};

      const startTime = resourceDefaults.start ? new Date(resourceDefaults.start) : new Date(day);
      if (!resourceDefaults.start) {
        startTime.setHours(9, 0, 0, 0);
      }
      const endTimeOverride = resourceDefaults.end ? new Date(resourceDefaults.end) : undefined;

      let targetEmployeePositionId: string | undefined = layoutMode === 'employee' ? rowId : undefined;
      let targetStationId: string | undefined = layoutMode === 'station' ? rowId : undefined;
      let targetPositionId: string | undefined = layoutMode === 'position' ? rowId : undefined;

      if (activeData.type === 'employee' && activeData.employee) {
        targetEmployeePositionId = activeData.employee.id;
      } else if (activeData.type === 'position' && activeData.position) {
        targetPositionId = activeData.position.id;
      } else if (activeData.type === 'station' && activeData.station) {
        targetStationId = activeData.station.id;
      }

      try {
        await handleShiftCreate(dropDay, startTime, targetEmployeePositionId, targetStationId, targetPositionId, {
          endTime: endTimeOverride,
        });
        console.log('✅ Created shift via resource drag', {
          resourceType: activeData.type,
          day: dropDay.toISOString(),
          startTime: startTime.toISOString(),
          employeePositionId: targetEmployeePositionId,
          positionId: targetPositionId,
          stationId: targetStationId
        });
      } catch (err) {
        console.error('Failed to create shift from resource drag:', err);
      }
      return;
    }

    // Handle existing shift drag
    // Extract shift ID from active ID (format: "shift-{shiftId}")
    const shiftId = activeId.replace('shift-', '');
    if (!shiftId || activeId === shiftId) return; // Not a shift drag

    // Try to get shift from activeData first (set by DraggableShift), then fallback to finding it
    const shift = activeData?.shift || scheduleShifts.find(s => s.id === shiftId);
    if (!shift || !schedule) {
      console.warn('⚠️ Shift not found for drag:', { shiftId, activeId, hasActiveData: !!activeData });
      return;
    }

    // Prevent concurrent updates for the same shift
    if (updatingShiftIds.has(shiftId)) {
      console.log('⏸️ Shift update already in progress - skipping duplicate drag', { shiftId });
      return;
    }

    // Extract cell data from over (format: "cell-{rowId}-{dateISO}")
    const overId = over.id as string;
    if (!overId.startsWith('cell-')) {
      // Dropped outside a valid cell
      return;
    }

    const cellData = over.data.current;
    if (!cellData || cellData.type !== 'cell') {
      return;
    }

    const { rowId, day } = cellData;

    // Calculate new time based on drop position
    // For now, keep the same time but update the day and row
    const shiftStart = parseISO(shift.startTime);
    const shiftEnd = parseISO(shift.endTime);
    const duration = shiftEnd.getTime() - shiftStart.getTime();

    const newStartTime = new Date(day);
    newStartTime.setHours(shiftStart.getHours(), shiftStart.getMinutes(), 0, 0);
    const newEndTime = new Date(newStartTime.getTime() + duration);

    // Check if the shift actually moved (same day and same time = no movement)
    const oldDay = new Date(shiftStart);
    oldDay.setHours(0, 0, 0, 0);
    const newDay = new Date(day);
    newDay.setHours(0, 0, 0, 0);
    
    const isSameDay = oldDay.getTime() === newDay.getTime();
    const isSameTime = shiftStart.getHours() === newStartTime.getHours() && 
                       shiftStart.getMinutes() === newStartTime.getMinutes();
    const isSameEmployee = layoutMode === 'employee' && rowId === shift.employeePositionId;
    const isOpenShiftsRow = layoutMode === 'employee' && rowId === 'open-shifts';
    const isSameOpenShifts = isOpenShiftsRow && shift.employeePositionId === null;
    const isSamePosition = layoutMode === 'position' && rowId === shift.positionId;
    const isSameStation = layoutMode === 'station' && rowId === (shift.stationName ? stations.find(s => s.name === shift.stationName)?.id : null);

    // If nothing changed, don't update
    if (isSameDay && isSameTime && (isSameEmployee || isSameOpenShifts || isSamePosition || isSameStation)) {
      console.log('📍 Shift not moved - skipping update', { 
        isSameDay, 
        isSameTime, 
        isSameEmployee, 
        isSameOpenShifts,
        isSamePosition, 
        isSameStation 
      });
      return;
    }

    // Determine what to update based on layout mode
    const updates: Partial<ScheduleShift> & { employeePositionId?: string | null } = {
      startTime: newStartTime.toISOString(),
      endTime: newEndTime.toISOString(),
    };

    if (layoutMode === 'employee') {
      // Handle OpenShifts row: make shift unassigned
      if (rowId === 'open-shifts') {
        if (shift.employeePositionId !== null) {
          (updates as { employeePositionId?: string | null }).employeePositionId = null;
          // Remove from member shift assignments if it exists
          setMemberShiftAssignments(prev => {
            const next = new Map(prev);
            next.delete(shiftId);
            return next;
          });
          console.log('🔓 Moving shift to OpenShifts (unassigning)', {
            shiftId,
            from: shift.employeePositionId,
            employeeName: employees.find(e => e.id === shift.employeePositionId)?.name || 'Unknown'
          });
        }
      }
      // Only update employeePositionId if it actually changed
      else if (rowId && !rowId.startsWith('member-')) {
        // Valid employee position ID - only update if it's different
        if (rowId !== shift.employeePositionId) {
          updates.employeePositionId = rowId;
          // Remove from member shift assignments if it exists (since it's now assigned to a position)
          setMemberShiftAssignments(prev => {
            const next = new Map(prev);
            next.delete(shiftId);
            return next;
          });
          console.log('👤 Updating employee assignment', {
            shiftId,
            from: shift.employeePositionId,
            to: rowId,
            employeeName: employees.find(e => e.id === rowId)?.name || 'Unknown'
          });
        } else {
          console.log('⚠️ Employee assignment unchanged - same rowId', {
            shiftId,
            employeePositionId: shift.employeePositionId,
            rowId
          });
        }
      } else if (rowId && rowId.startsWith('member-')) {
        // For employees without positions, only remove if currently assigned
        // Use null instead of undefined so it's included in JSON
        if (shift.employeePositionId !== undefined && shift.employeePositionId !== null) {
          (updates as { employeePositionId?: string | null }).employeePositionId = null;
          // Extract userId from member rowId (format: "member-{userId}")
          const memberUserId = rowId.replace('member-', '');
          // Track this assignment in state so we can display it correctly
          setMemberShiftAssignments(prev => new Map(prev).set(shiftId, memberUserId));
          console.log('👤 Removing employee assignment (member- employee)', {
            shiftId,
            from: shift.employeePositionId,
            rowId,
            memberUserId
          });
        } else if (shift.employeePositionId === null) {
          // Already an open shift - update the member assignment
          // We still need to update employeePositionId to null (explicitly) so backend knows it's still unassigned
          // This is important because we're also updating startTime/endTime, and we want to ensure
          // the employeePositionId remains null (not accidentally cleared)
          (updates as { employeePositionId?: string | null }).employeePositionId = null;
          const memberUserId = rowId.replace('member-', '');
          setMemberShiftAssignments(prev => new Map(prev).set(shiftId, memberUserId));
          console.log('👤 Updating member assignment (shift already unassigned)', {
            shiftId,
            rowId,
            memberUserId
          });
        }
      }
      // If employeePositionId matches current value, we only update time (handled above)
    } else if (layoutMode === 'station') {
      // Find station by rowId (assuming rowId matches station ID or name)
      const station = stations.find(s => s.id === rowId || s.name === rowId);
      if (station) {
        updates.stationName = station.name;
      }
    } else if (layoutMode === 'position') {
      if (rowId) {
        updates.positionId = rowId;
      }
    }

    console.log('🔄 Moving shift to new location', { 
      shiftId, 
      from: { 
        day: oldDay, 
        time: format(shiftStart, 'HH:mm'), 
        employee: shift.employeePositionId,
        employeeName: employees.find(e => e.id === shift.employeePositionId)?.name || 'Unknown'
      },
      to: { 
        day: newDay, 
        time: format(newStartTime, 'HH:mm'), 
        rowId,
        rowEmployeeName: employees.find(e => e.id === rowId)?.name || (rowId?.startsWith('member-') ? 'Member (no position)' : 'Unknown')
      },
      currentShiftEmployee: shift.employeePositionId,
      targetRowId: rowId,
      updates,
      allEmployees: employees.map(e => ({ id: e.id, name: e.name }))
    });

    // Mark shift as updating to prevent duplicate updates
    setUpdatingShiftIds(prev => new Set(prev).add(shiftId));

    try {
      await handleShiftUpdate(shiftId, updates);
      // Remove shift from updating set after update completes and state has refreshed
      // Use a small delay to ensure state has updated from fetchShifts
      setTimeout(() => {
        setUpdatingShiftIds(prev => {
          const next = new Set(prev);
          next.delete(shiftId);
          return next;
        });
      }, 300);
    } catch (err) {
      console.error('Failed to update shift position:', err);
      // Remove from updating set even on error so the user can retry
      setUpdatingShiftIds(prev => {
        const next = new Set(prev);
        next.delete(shiftId);
        return next;
      });
    }
  };

  // Register drag handlers with parent if provided
  useEffect(() => {
    if (registerDragHandlers) {
      registerDragHandlers({
        onDragStart: handleDragStart,
        onDragEnd: handleDragEnd,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerDragHandlers, handleDragStart, handleDragEnd]);

  const handleShiftCreate = (
    day: Date,
    startTime: Date,
    employeePositionId?: string,
    stationId?: string,
    positionId?: string,
    options?: { endTime?: Date }
  ) => {
    if (!schedule) return;

    const shiftStart = new Date(startTime);
    const endTime = options?.endTime ? new Date(options.endTime) : new Date(startTime);
    if (!options?.endTime) {
      endTime.setHours(endTime.getHours() + 4); // Default 4-hour shift
    }

    let shiftTitle = 'New Shift';
    let finalEmployeePositionId: string | null | undefined = null;
    let finalPositionId: string | undefined;
    let finalStationName: string | undefined;

    if (employeePositionId) {
      if (employeePositionId === 'open-shifts') {
        shiftTitle = 'Open Shift';
        finalEmployeePositionId = null;
      } else if (employeePositionId.startsWith('member-')) {
        shiftTitle = 'New Shift';
        finalEmployeePositionId = null;
      } else {
        const employee = employees.find(e => e.id === employeePositionId);
        shiftTitle = employee ? `${employee.name} - Shift` : 'New Shift';
        finalEmployeePositionId = employeePositionId;
        
        if (!positionId && employee?.position) {
          const matchingPosition = positionOptions.find(
            pos => pos.title === employee.position || pos.name === employee.position
          );
          if (matchingPosition) {
            finalPositionId = matchingPosition.id;
          }
        }
      }
    } else if (layoutMode === 'employee') {
      finalEmployeePositionId = null;
    }

    if (positionId) {
      finalPositionId = positionId;
      const position = positionOptions.find(pos => pos.id === positionId);
      if (!employeePositionId && position) {
        shiftTitle = `${position.title || position.name} - Shift`;
      }
    }

    if (stationId) {
      const station = stations.find(s => s.id === stationId);
      finalStationName = station?.name;
      if (!employeePositionId && !positionId && station) {
        shiftTitle = `${station.name} - Shift`;
      }
    }

    if (!finalEmployeePositionId && employeePositionId === undefined && layoutMode === 'employee') {
      finalEmployeePositionId = null;
    }

    const tempShift = {
      id: `temp-${Date.now()}`,
      businessId: businessId,
      scheduleId: schedule.id,
      startTime: shiftStart.toISOString(),
      endTime: endTime.toISOString(),
      positionId: finalPositionId,
      employeePositionId: finalEmployeePositionId ?? null,
      stationName: finalStationName,
      breakMinutes: 0,
      status: (finalEmployeePositionId ? 'ASSIGNED' : 'OPEN') as ScheduleShift['status'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as ScheduleShift;

    setSelectedShift(tempShift);
    setSelectedPositionId(finalPositionId || '');
    setSelectedEmployeeId(finalEmployeePositionId || '');
    setIsCreatingNewShift(true);
    setShowShiftModal(true);
  };

  const handleShiftUpdate = async (shiftId: string, updates: Partial<ScheduleShift> & { employeePositionId?: string | null | undefined }) => {
    // If this is a temporary shift (being created), only update local state - don't call API
    if (shiftId.startsWith('temp-')) {
      if (selectedShift && selectedShift.id === shiftId) {
        setSelectedShift({
          ...selectedShift,
          ...updates,
        } as ScheduleShift);
      }
      return;
    }
    
    // If we have an originalShiftIdRef that matches the shiftId, allow the update
    // even if selectedShift has been overwritten with a temp shift
    // This handles the case where form field changes overwrite selectedShift
    if (originalShiftIdRef.current === shiftId) {
      // This is a valid update to an existing shift - proceed even if selectedShift is temp
      console.log('✅ Updating existing shift with originalShiftIdRef match:', {
        originalShiftIdRef: originalShiftIdRef.current,
        updateShiftId: shiftId,
        selectedShiftId: selectedShift?.id
      });
      // Continue to the API call below
    } else if (selectedShift && selectedShift.id.startsWith('temp-') && !shiftId.startsWith('temp-')) {
      // Only block if we don't have a matching originalShiftIdRef
      console.warn('⚠️ Attempted to update real shift but selectedShift is temp and no originalShiftIdRef match. Ignoring update.', {
        selectedShiftId: selectedShift.id,
        updateShiftId: shiftId,
        originalShiftIdRef: originalShiftIdRef.current
      });
      return;
    }
    
    // Prevent overwriting an existing shift with a temp shift
    if (originalShiftIdRef.current && !originalShiftIdRef.current.startsWith('temp-') && shiftId.startsWith('temp-')) {
      console.warn('⚠️ Attempted to overwrite existing shift with temp shift. Ignoring update.', {
        originalShiftId: originalShiftIdRef.current,
        tempShiftId: shiftId
      });
      return;
    }

    try {
      console.log('🔄 Updating shift:', { shiftId, updates });
      const updated = await updateExistingShift(shiftId, updates);
      if (!updated) {
        console.error('❌ Shift update returned null');
        return;
      }
      
      // Track this action to prevent duplicate WebSocket updates
      const updatedShiftId = updated.id;
      lastActionIdsRef.current.add(updatedShiftId);
      
      // Clear action tracking after 5 seconds (in case WebSocket event is delayed)
      const timeout = setTimeout(() => {
        lastActionIdsRef.current.delete(updatedShiftId);
        actionTimeoutsRef.current.delete(updatedShiftId);
      }, 5000);
      actionTimeoutsRef.current.set(updatedShiftId, timeout);

      // Update selected shift if it's the one being updated
      if (selectedShift && selectedShift.id === shiftId) {
        setSelectedShift(updated);
      }

      console.log('✅ Shift updated successfully:', { 
        shiftId: updated.id,
        employeePositionId: updated.employeePositionId,
        employeeName: updated.employeePosition?.user?.name,
        startTime: updated.startTime,
        endTime: updated.endTime,
        fullShift: updated
      });
      
      // Immediately update the local shifts array for instant UI update
      // This ensures the UI reflects changes immediately without waiting for fetchShifts
      // The updated shift from the API should include all necessary relations
      setScheduleShifts(prev => {
        const hasShift = prev.some(s => s.id === shiftId);
        if (!hasShift) {
          // If shift not in current list (e.g., moved to different schedule), add it
          console.log('➕ Adding updated shift to local state:', { 
            shiftId: updated.id,
            employeePositionId: updated.employeePositionId,
            employeeName: updated.employeePosition?.user?.name,
            scheduleId: updated.scheduleId
          });
          return [...prev, updated];
        }
        
        const updatedArray = prev.map(s => {
          if (s.id === shiftId) {
            // Replace with the updated shift which includes all relations from the API
            // Create a new object reference to ensure React re-renders
            console.log('🔄 Updating shift in local state:', { 
              oldShift: { 
                id: s.id, 
                employeePositionId: s.employeePositionId, 
                employeeName: s.employeePosition?.user?.name,
                startTime: s.startTime,
                endTime: s.endTime
              },
              newShift: { 
                id: updated.id, 
                employeePositionId: updated.employeePositionId, 
                employeeName: updated.employeePosition?.user?.name,
                startTime: updated.startTime,
                endTime: updated.endTime,
                hasEmployeePosition: !!updated.employeePosition,
                hasUser: !!updated.employeePosition?.user
              }
            });
            // Return a new object to ensure React detects the change
            return { ...updated };
          }
          return s;
        });
        return updatedArray;
      });
      
      // Then refresh from server to ensure we have the latest data with all relations
      // Use a small delay to let the server fully process the update
      setTimeout(async () => {
        console.log('🔄 Refreshing shifts from server after update');
        await fetchShifts(scheduleId);
      }, 300);
      
      setErrorMessage(null);
    } catch (err: unknown) {
      console.error('❌ Failed to update shift:', err);
      const error = err as { message?: string; conflict?: { message?: string; employeeName?: string; type?: string } };
      if (error.conflict) {
        setErrorMessage(error.conflict.message || `Cannot schedule: ${error.conflict.employeeName} has ${error.conflict.type} time-off`);
      } else {
        setErrorMessage(error.message || 'Failed to update shift');
      }
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleShiftDelete = async (shiftId: string) => {
    try {
      // Track this action to prevent duplicate WebSocket updates
      lastActionIdsRef.current.add(shiftId);
      
      // Clear action tracking after 5 seconds (in case WebSocket event is delayed)
      const timeout = setTimeout(() => {
        lastActionIdsRef.current.delete(shiftId);
        actionTimeoutsRef.current.delete(shiftId);
      }, 5000);
      actionTimeoutsRef.current.set(shiftId, timeout);
      
      await removeShift(shiftId);
      // Refresh shifts for the current schedule (not just general refresh)
      await fetchShifts(scheduleId);
    } catch (err) {
      console.error('Failed to delete shift:', err);
      // Clear tracking on error
      lastActionIdsRef.current.delete(shiftId);
      const timeout = actionTimeoutsRef.current.get(shiftId);
      if (timeout) {
        clearTimeout(timeout);
        actionTimeoutsRef.current.delete(shiftId);
      }
    }
  };

  const handleSaveLayout = useCallback(async () => {
    if (!schedule || !session?.accessToken || isSavingRef.current) return;

    // Check if values have actually changed
    const currentLayout = { layoutMode, viewMode };
    if (lastSavedLayoutRef.current && 
        lastSavedLayoutRef.current.layoutMode === currentLayout.layoutMode &&
        lastSavedLayoutRef.current.viewMode === currentLayout.viewMode) {
      return; // No changes, skip save
    }

    try {
      isSavingRef.current = true;
      setSaving(true);
      await updateExistingSchedule(schedule.id, {
        layoutMode,
        viewMode,
      } as any);
      
      // Update last saved values
      lastSavedLayoutRef.current = { layoutMode, viewMode };
      
      if (onSave) {
        onSave();
      }
    } catch (err) {
      console.error('Failed to save layout:', err);
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  }, [schedule, session?.accessToken, layoutMode, viewMode, onSave, updateExistingSchedule]);

  // Store handleSaveLayout in a ref to avoid recreating the effect
  const handleSaveLayoutRef = useRef(handleSaveLayout);
  useEffect(() => {
    handleSaveLayoutRef.current = handleSaveLayout;
  }, [handleSaveLayout]);

  // Auto-save layout changes with debouncing (saves 1 second after last change)
  // Only trigger when layoutMode or viewMode changes, not when schedule changes
  useEffect(() => {
    if (!schedule || !session?.accessToken) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout to save after 1 second of no changes
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveLayoutRef.current();
    }, 1000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode, viewMode]); // Only depend on layoutMode and viewMode, not schedule or handleSaveLayout

  // Set up 5-minute interval auto-save
  useEffect(() => {
    if (!schedule || !session?.accessToken) return;

    // Initial save after 5 minutes
    autoSaveIntervalRef.current = setInterval(() => {
      if (schedule && session?.accessToken) {
        handleSaveLayoutRef.current();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule?.id, session?.accessToken]); // Only depend on schedule ID and session, not the full schedule object or handleSaveLayout

  if (loading || !schedule) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <Alert type="error" title="Error">
        {error}
      </Alert>
    );
  }

  const content = (
    <div className="flex flex-col h-full bg-gray-50">
        {/* Error Message */}
        {errorMessage && (
          <div className="flex-shrink-0 p-3 bg-red-50 border-b border-red-200">
            <Alert type="error" onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          </div>
        )}
        
        {/* Toolbar */}
        <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              {viewMode === 'week' && schedule ? (() => {
                // Calculate visible week dates (same logic as calendar grid)
                const scheduleStartDate = parseISO(schedule.startDate);
                const visibleWeekStart = startOfWeek(scheduleStartDate, { weekStartsOn });
                const visibleWeekEnd = addDays(visibleWeekStart, 6);
                return (
                  <h2 className="text-xl font-semibold text-gray-900">
                    {format(visibleWeekStart, 'MMM d')} - {format(visibleWeekEnd, 'MMM d, yyyy')}
                  </h2>
                );
              })() : viewMode === 'day' && schedule ? (
                <h2 className="text-xl font-semibold text-gray-900">
                  {format(addDays(parseISO(schedule.startDate), currentDayOffset), 'EEEE, MMMM d, yyyy')}
                </h2>
              ) : (
                <h2 className="text-xl font-semibold text-gray-900">{schedule.name}</h2>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Badge>
                {schedule.status}
              </Badge>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Layout Mode Toggle */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Layout:</label>
                <div className="flex rounded-lg border border-gray-300 p-1">
                  <button
                    onClick={() => setLayoutMode('employee')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      layoutMode === 'employee'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Users className="w-4 h-4 inline mr-1" />
                    Employee
                  </button>
                  <button
                    onClick={() => setLayoutMode('position')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      layoutMode === 'position' || layoutMode === 'station'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Position/Station
                  </button>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">View:</label>
                <div className="flex rounded-lg border border-gray-300 p-1">
                  <button
                    onClick={() => setViewMode('week')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      viewMode === 'week'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setViewMode('day')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      viewMode === 'day'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Day
                  </button>
                </div>
                
                {/* Day Navigation (only show in day view) */}
                {viewMode === 'day' && schedule && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => setCurrentDayOffset(Math.max(0, currentDayOffset - 1))}
                      disabled={currentDayOffset === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Previous day"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
                      {format(addDays(parseISO(schedule.startDate), currentDayOffset), 'EEE MMM d')}
                    </span>
                    <button
                      onClick={() => {
                        const scheduleLength = Math.ceil(
                          (parseISO(schedule.endDate).getTime() - parseISO(schedule.startDate).getTime()) / 
                          (1000 * 60 * 60 * 24)
                        );
                        setCurrentDayOffset(Math.min(scheduleLength - 1, currentDayOffset + 1));
                      }}
                      disabled={currentDayOffset >= Math.ceil(
                        (parseISO(schedule.endDate).getTime() - parseISO(schedule.startDate).getTime()) / 
                        (1000 * 60 * 60 * 24)
                      ) - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Next day"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Availability Indicators Toggle */}
              {layoutMode === 'employee' && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowAvailabilityIndicators(!showAvailabilityIndicators)}
                    className={`flex items-center gap-2 px-3 py-1 text-sm rounded border transition-colors ${
                      showAvailabilityIndicators
                        ? 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-gray-100 border-gray-300 text-gray-700'
                    }`}
                    title="Toggle availability and time-off indicators"
                  >
                    {showAvailabilityIndicators ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span>Availability</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
            <ScheduleCalendarGrid
              scheduleId={schedule.id}
              shifts={scheduleShifts}
              startDate={
                viewMode === 'day'
                  ? addDays(parseISO(schedule.startDate), currentDayOffset)
                  : parseISO(schedule.startDate)
              }
              endDate={
                viewMode === 'day'
                  ? addDays(parseISO(schedule.startDate), currentDayOffset)
                  : parseISO(schedule.endDate)
              }
              layoutMode={layoutMode}
              viewMode={viewMode}
              employees={filteredEmployees}
              positions={filteredPositions}
              stations={filteredStations}
              memberShiftAssignments={memberShiftAssignments}
              employeeAvailability={employeeAvailability}
              timeOffData={timeOffData}
              showAvailabilityIndicators={showAvailabilityIndicators}
              onShiftClick={(shift) => {
                console.log('🔍 Shift clicked - BEFORE state update:', { 
                  shiftId: shift.id, 
                  isTempShift: shift.id.startsWith('temp-'),
                  currentSelectedShiftId: selectedShift?.id,
                  currentIsCreatingNewShift: isCreatingNewShift
                });
                
                // Set all state synchronously to prevent race conditions
                const isTempShift = shift.id.startsWith('temp-');
                
                // Store the original shift ID in a ref to prevent overwrites
                originalShiftIdRef.current = shift.id;
                
                setSelectedPositionId(shift.positionId || '');
                setSelectedEmployeeId(shift.employeePositionId || '');
                setShiftColor(shift.color || ''); // Initialize color picker with shift's color or empty for default
                setShowColorPicker(false); // Close color picker when opening modal
                setIsCreatingNewShift(isTempShift);
                
                // Set selectedShift LAST to ensure all other state is set first
                setSelectedShift(shift);
                
                console.log('🔍 Shift clicked - AFTER state update:', { 
                  shiftId: shift.id, 
                  isTempShift,
                  settingIsCreatingNewShiftTo: isTempShift,
                  originalShiftIdRef: originalShiftIdRef.current
                });
                
                setShowShiftModal(true);
              }}
              onShiftCreate={handleShiftCreate}
              timeRange={timeRange}
              weekStartsOn={weekStartsOn}
            />
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggingShift ? (
            <div className="bg-blue-500 text-white rounded-lg p-2 shadow-lg">
              {getShiftPositionTitle(draggingShift) || draggingShift.employeePosition?.user.name || 'Shift'}
            </div>
          ) : draggingResource ? (
            <div className="bg-green-500 text-white rounded-lg p-3 shadow-lg flex items-center space-x-2">
              {draggingResource.type === 'employee' && <Users className="w-4 h-4" />}
              {draggingResource.type === 'position' && <Briefcase className="w-4 h-4" />}
              {draggingResource.type === 'station' && <MapPin className="w-4 h-4" />}
              <div className="flex flex-col">
                <span className="font-medium">{draggingResource.label}</span>
                {draggingResource.detail && (
                  <span className="text-xs opacity-90">{draggingResource.detail}</span>
                )}
              </div>
            </div>
          ) : null}
        </DragOverlay>

        {/* Shift Edit Modal - WhenIWork Style */}
        <Modal
          open={showShiftModal}
          onClose={() => {
            setShowShiftModal(false);
            setSelectedShift(null);
            originalShiftIdRef.current = null;
            setSelectedPositionId('');
            setSelectedEmployeeId('');
            setShowMoreDetails(false);
            setHasBreak(false);
            setShowColorPicker(false);
            setShiftColor(''); // Reset to empty (default)
            setIsCreatingNewShift(false);
          }}
          title={
            selectedShift
              ? ((isCreatingNewShift || selectedShift.id.startsWith('temp-'))
                  ? `Create Shift for ${selectedShift.startTime ? format(parseISO(selectedShift.startTime), 'EEE, MMM d') : 'Date'}`
                  : `Edit Shift for ${selectedShift.employeePosition?.user?.name || 'Unassigned'} on ${selectedShift.startTime ? format(parseISO(selectedShift.startTime), 'EEE, MMM d') : 'Date'}`)
              : 'Create Shift'
          }
          size="xlarge"
          headerActions={
            <div className="flex items-center space-x-2">
              {selectedShift && !isCreatingNewShift && !selectedShift.id.startsWith('temp-') && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      // TODO: Implement send reminder
                      alert('Send reminder functionality coming soon');
                    }}
                  >
                    SEND REMINDER
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      // TODO: Implement history view
                      alert('History functionality coming soon');
                    }}
                  >
                    HISTORY
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // TODO: Implement time off
                  alert('Time off functionality coming soon');
                }}
              >
                TIME OFF
              </Button>
            </div>
          }
        >
          {selectedShift && (
            <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {/* Main Fields Grid - 2 columns */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Assign to */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Assign to
                  </label>
                <div className="relative">
                  <select
                    value={selectedEmployeeId || (selectedShift.employeePositionId ? selectedShift.employeePositionId : (memberShiftAssignments.get(selectedShift.id) ? `member-${memberShiftAssignments.get(selectedShift.id)}` : '')) || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedEmployeeId(value);
                      
                      // Handle member employees (member-* IDs) and unassigned (empty string)
                      if (!value || value.startsWith('member-')) {
                        // Set to null for unassigned or member employees (who don't have employeePositionId)
                        handleShiftUpdate(selectedShift.id, {
                          employeePositionId: null,
                        } as Partial<ScheduleShift> & { employeePositionId?: string | null });
                        // If it's a member employee, track the assignment
                        if (value.startsWith('member-')) {
                          const memberUserId = value.replace('member-', '');
                          setMemberShiftAssignments(prev => new Map(prev).set(selectedShift.id, memberUserId));
                        } else {
                          // Unassigned - remove from member assignments
                          setMemberShiftAssignments(prev => {
                            const next = new Map(prev);
                            next.delete(selectedShift.id);
                            return next;
                          });
                        }
                      } else {
                        // Valid employeePositionId
                        handleShiftUpdate(selectedShift.id, {
                          employeePositionId: value,
                        });
                        // Remove from member assignments if it was there
                        setMemberShiftAssignments(prev => {
                          const next = new Map(prev);
                          next.delete(selectedShift.id);
                          return next;
                        });
                      }
                    }}
                    className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {employees.map(emp => {
                      return (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      );
                    })}
                  </select>
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

                {/* Shift Color - Dropdown with Color Grid */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Shift Color
                  </label>
                <div className="relative" data-color-picker>
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="w-full px-3 py-2 pl-10 pr-10 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: selectedShift?.color || shiftColor || '#d1d5db' }}
                      />
                      <span>{selectedShift?.color || shiftColor ? 'Custom' : 'Default'}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showColorPicker ? 'transform rotate-180' : ''}`} />
                  </button>
                  
                  {/* Color Picker Dropdown */}
                  {showColorPicker && (
                    <div className="absolute z-50 mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg p-4" data-color-picker>
                      {/* Color Grid */}
                      <div className="grid grid-cols-10 gap-2 mb-3">
                        {[
                          '#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8', '#fce7f3', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b',
                          '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1',
                          '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981',
                          '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7', '#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04',
                          '#84cc16', '#a3e635', '#bef264', '#d9f99d', '#ecfccb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b',
                          '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626',
                          '#b91c1c', '#991b1b', '#7f1d1d', '#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb',
                        ].map((color, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setShiftColor(color);
                              setShowColorPicker(false);
                              if (selectedShift && !isCreatingNewShift && !selectedShift.id.startsWith('temp-')) {
                                handleShiftUpdate(selectedShift.id, {
                                  color: color,
                                });
                              }
                            }}
                            className="w-8 h-8 rounded border border-gray-200 hover:scale-110 hover:z-10 transition-transform cursor-pointer"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                      
                      {/* Clear Color Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setShiftColor('');
                          setShowColorPicker(false);
                          if (selectedShift && !isCreatingNewShift && !selectedShift.id.startsWith('temp-')) {
                            handleShiftUpdate(selectedShift.id, {
                              color: undefined,
                            });
                          }
                        }}
                        className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded border border-gray-300"
                      >
                        CLEAR COLOR
                      </button>
                    </div>
                  )}
                </div>
              </div>

                {/* Time (Required) - Single line with inline inputs */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Time *
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Display time in When I Work format */}
                    <div className="flex-1 relative">
                      <Input
                        type="text"
                        placeholder="9a - 5p"
                        value={
                          selectedShift.startTime && selectedShift.endTime
                            ? `${formatWhenIWorkTime(parseISO(selectedShift.startTime))} - ${formatWhenIWorkTime(parseISO(selectedShift.endTime))}`
                            : ''
                        }
                        readOnly
                        className="pl-10 cursor-not-allowed bg-gray-50 text-sm"
                      />
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                    {/* Start time input - inline */}
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500 whitespace-nowrap">Start:</label>
                      <Input
                        type="time"
                        value={selectedShift.startTime ? format(parseISO(selectedShift.startTime), 'HH:mm') : ''}
                        onChange={(e) => {
                          if (selectedShift) {
                            const startDate = parseISO(selectedShift.startTime);
                            const [hours, minutes] = e.target.value.split(':');
                            startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                            handleShiftUpdate(selectedShift.id, {
                              startTime: startDate.toISOString(),
                            });
                          }
                        }}
                        className="text-sm w-32"
                      />
                    </div>
                    {/* End time input - inline */}
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500 whitespace-nowrap">End:</label>
                      <Input
                        type="time"
                        value={selectedShift.endTime ? format(parseISO(selectedShift.endTime), 'HH:mm') : ''}
                        onChange={(e) => {
                          if (selectedShift) {
                            const endDate = parseISO(selectedShift.endTime);
                            const [hours, minutes] = e.target.value.split(':');
                            endDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                            handleShiftUpdate(selectedShift.id, {
                              endTime: endDate.toISOString(),
                            });
                          }
                        }}
                        className="text-sm w-32"
                      />
                    </div>
                  </div>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Position
                  </label>
                <div className="relative">
                  <select
                    value={selectedPositionId || ''}
                    onChange={(e) => {
                      setSelectedPositionId(e.target.value);
                      if (selectedShift) {
                        handleShiftUpdate(selectedShift.id, {
                        positionId: e.target.value || undefined,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No Position</option>
                    {positionOptions.map(pos => (
                      <option key={pos.id} value={pos.id}>
                        {pos.title}
                      </option>
                    ))}
                  </select>
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

                {/* Station */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Station
                  </label>
                <div className="relative">
                  <select
                    value={selectedShift.stationName || ''}
                    onChange={(e) => {
                      if (selectedShift) {
                        handleShiftUpdate(selectedShift.id, {
                          stationName: e.target.value || undefined,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No Station</option>
                    {stations.map(station => (
                      <option key={station.id} value={station.name}>
                        {station.name}
                      </option>
                    ))}
                  </select>
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

                {/* Add a break */}
                <div className="col-span-2">
                  {!hasBreak ? (
                    <Button
                      variant="secondary"
                      onClick={() => setHasBreak(true)}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add a break
                    </Button>
                  ) : (
                    <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-900">Break</label>
                        <button
                          onClick={() => {
                            setHasBreak(false);
                            setBreakStartTime('');
                            setBreakEndTime('');
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-700 mb-1">Start</label>
                          <Input
                            type="time"
                            value={breakStartTime}
                            onChange={(e) => setBreakStartTime(e.target.value)}
                            placeholder="Start"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-700 mb-1">End</label>
                          <Input
                            type="time"
                            value={breakEndTime}
                            onChange={(e) => setBreakEndTime(e.target.value)}
                            placeholder="End"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes - Compact single line input */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Notes
                  </label>
                  <Input
                    type="text"
                    value={selectedShift.notes || ''}
                    onChange={(e) => {
                      if (selectedShift) {
                        handleShiftUpdate(selectedShift.id, {
                          notes: e.target.value,
                        });
                      }
                    }}
                    placeholder="Add notes about this shift..."
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Footer Actions - Always visible at bottom */}
              <div className="flex items-center justify-between pt-3 border-t mt-3">
                {(() => {
                  // Use originalShiftIdRef to determine if this is an existing shift
                  const shiftIdToCheck = originalShiftIdRef.current || selectedShift?.id;
                  const isExistingShift = shiftIdToCheck && !shiftIdToCheck.startsWith('temp-');
                  
                  if (isExistingShift && selectedShift) {
                    return (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          const shiftIdToDelete = originalShiftIdRef.current || selectedShift.id;
                          if (confirm('Are you sure you want to delete this shift?')) {
                            await handleShiftDelete(shiftIdToDelete);
                            setShowShiftModal(false);
                            setSelectedShift(null);
                            originalShiftIdRef.current = null;
                            setSelectedPositionId('');
                            setSelectedEmployeeId('');
                            setIsCreatingNewShift(false);
                          }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        DELETE
                      </Button>
                    );
                  }
                  return <div />;
                })()}
                <div className="flex space-x-2">
                  {selectedShift && !isCreatingNewShift && !selectedShift.id.startsWith('temp-') && (
                    <Button
                      onClick={async () => {
                        if (selectedShift) {
                          // TODO: Save and publish schedule
                          setShowShiftModal(false);
                          setSelectedShift(null);
                          originalShiftIdRef.current = null;
                          setSelectedPositionId('');
                          setSelectedEmployeeId('');
                          setIsCreatingNewShift(false);
                          if (onSave) {
                            onSave();
                          }
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      SAVE & PUBLISH
                    </Button>
                  )}
                  <Button
                    onClick={async () => {
                      if (selectedShift) {
                        // Use the same logic as button text - check originalShiftIdRef first
                        const shiftIdToCheck = originalShiftIdRef.current || selectedShift.id;
                        const isTempShift = shiftIdToCheck.startsWith('temp-');
                        // Only create if it's actually a temp shift (not just if isCreatingNewShift is true)
                        const shouldCreate = isTempShift;
                        
                        console.log('💾 Save button clicked:', { 
                          selectedShiftId: selectedShift.id,
                          originalShiftIdRef: originalShiftIdRef.current,
                          shiftIdToCheck,
                          isTempShift, 
                          isCreatingNewShift, 
                          shouldCreate,
                          buttonText: shouldCreate ? 'CREATE SHIFT' : 'SAVE'
                        });
                        
                        if (shouldCreate) {
                          // Create the shift
                          try {
                            const newShift = await createNewShift({
                              scheduleId: schedule.id,
                              title: 'New Shift', // Title is required by API but not stored in ScheduleShift
                              startTime: selectedShift.startTime,
                              endTime: selectedShift.endTime,
                              positionId: selectedShift.positionId || selectedPositionId || undefined,
                              employeePositionId: selectedShift.employeePositionId || selectedEmployeeId || undefined,
                              stationName: selectedShift.stationName || undefined,
                              notes: selectedShift.notes || undefined,
                              color: selectedShift.color || shiftColor || undefined,
                            });

                            if (newShift) {
                              console.log('✅ Shift created successfully:', { 
                                shiftId: newShift.id, 
                                scheduleId: schedule.id,
                                employeePositionId: newShift.employeePositionId,
                                positionId: newShift.positionId,
                                startTime: newShift.startTime,
                                newShiftScheduleId: newShift.scheduleId
                              });
                              
                              // Close modal
                              setShowShiftModal(false);
                              setSelectedShift(null);
                              setSelectedPositionId('');
                              setSelectedEmployeeId('');
                              setIsCreatingNewShift(false);
                              
                              // The shift is already added to state optimistically by createNewShift
                              // Don't immediately refetch - let the WebSocket event handle updates
                              // If needed, we can do a delayed refresh after a short delay
                              // This prevents race conditions where fetchShifts returns before the DB is updated
                              setTimeout(async () => {
                                console.log('🔄 Refreshing shifts after creation delay');
                                await fetchShifts(schedule.id);
                              }, 500);
                            } else {
                              console.error('❌ Shift creation returned null');
                              setErrorMessage('Failed to create shift. Please try again.');
                              setTimeout(() => setErrorMessage(null), 5000);
                            }
                          } catch (err) {
                            console.error('Failed to create shift:', err);
                            const error = err as { message?: string; conflict?: { message?: string; employeeName?: string; type?: string } };
                            if (error.conflict) {
                              setErrorMessage(error.conflict.message || `Cannot schedule: ${error.conflict.employeeName} has ${error.conflict.type} time-off`);
                            } else {
                              setErrorMessage(error.message || 'Failed to create shift');
                            }
                            setTimeout(() => setErrorMessage(null), 5000);
                          }
                        } else {
                          // Update existing shift - ensure all current form values are saved
                          try {
                            // Use the original shift ID from the ref, or fall back to selectedShift.id
                            const shiftIdToUpdate = originalShiftIdRef.current || selectedShift.id;
                            
                            const updates: Partial<ScheduleShift> & { employeePositionId?: string | null } = {
                              startTime: selectedShift.startTime,
                              endTime: selectedShift.endTime,
                              positionId: selectedPositionId || selectedShift.positionId || undefined,
                              employeePositionId: selectedEmployeeId || selectedShift.employeePositionId || undefined,
                              stationName: selectedShift.stationName || undefined,
                              notes: selectedShift.notes || undefined,
                              color: shiftColor || selectedShift.color || undefined,
                            };
                            
                            console.log('🔄 Updating existing shift:', { 
                              shiftIdToUpdate, 
                              originalShiftIdRef: originalShiftIdRef.current,
                              selectedShiftId: selectedShift.id,
                              updates 
                            });
                            
                            await handleShiftUpdate(shiftIdToUpdate, updates);
                            
                // Close modal after successful update
                setShowShiftModal(false);
                setSelectedShift(null);
                originalShiftIdRef.current = null; // Clear the ref
                setSelectedPositionId('');
                setSelectedEmployeeId('');
                setIsCreatingNewShift(false);
                            if (onSave) {
                              onSave();
                            }
                          } catch (err) {
                            console.error('Failed to update shift:', err);
                            const error = err as { message?: string; conflict?: { message?: string; employeeName?: string; type?: string } };
                            if (error.conflict) {
                              setErrorMessage(error.conflict.message || `Cannot update: ${error.conflict.employeeName} has ${error.conflict.type} time-off`);
                            } else {
                              setErrorMessage(error.message || 'Failed to update shift');
                            }
                            setTimeout(() => setErrorMessage(null), 5000);
                          }
                        }
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {(() => {
                      if (!selectedShift) return 'SAVE';
                      // Always check the actual shift ID, not just the state
                      // Also check originalShiftIdRef as a fallback to prevent overwrites
                      const shiftIdToCheck = originalShiftIdRef.current || selectedShift.id;
                      const isTemp = shiftIdToCheck.startsWith('temp-');
                      // Use the actual shift ID check as the source of truth
                      const shouldCreate = isTemp;
                      console.log('🔘 Button text computed:', { 
                        selectedShiftId: selectedShift.id,
                        originalShiftIdRef: originalShiftIdRef.current,
                        shiftIdToCheck,
                        isTemp, 
                        isCreatingNewShift, 
                        shouldCreate,
                        buttonText: shouldCreate ? 'CREATE SHIFT' : 'SAVE'
                      });
                      return shouldCreate ? 'CREATE SHIFT' : 'SAVE';
                    })()}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>

      </div>
  );

  // If parent provides DndContext handlers, don't create another DndContext
  if (registerDragHandlers) {
    return content;
  }

  // Otherwise, wrap in own DndContext
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {content}
    </DndContext>
  );
}

