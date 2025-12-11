'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { ScheduleTemplate, ScheduleShift, updateScheduleTemplate } from '@/api/scheduling';
import ScheduleCalendarGrid from './ScheduleCalendarGrid';
import { Button, Card, Modal, Input, Spinner } from 'shared/components';
import { Calendar, Plus, Save, ArrowLeft, Users, Briefcase, MapPin, Edit, Trash2, Clock, User, ChevronDown } from 'lucide-react';
import { getBusinessEmployees, getPositions } from '@/api/orgChart';
import { getBusinessStations } from '@/api/scheduling';
import { useSession } from 'next-auth/react';
import ScheduleBuilderSidebar from './ScheduleBuilderSidebar';

interface TemplateBuilderVisualProps {
  template: ScheduleTemplate;
  businessId: string;
  onSave?: () => void;
  onCancel?: () => void;
}

interface TemplateShiftPattern {
  dayOfWeek: string; // "MONDAY", "TUESDAY", etc.
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  positionId?: string;
  positionTitle?: string;
  stationName?: string;
  employeePositionId?: string; // For employee view - which employee this pattern is for
  breakMinutes?: number;
  notes?: string;
  color?: string;
  minStaffing?: number;
  maxStaffing?: number;
  isOpenShift?: boolean;
}

export default function TemplateBuilderVisual({
  template,
  businessId,
  onSave,
  onCancel,
}: TemplateBuilderVisualProps) {
  const { data: session } = useSession();
  const [shiftPatterns, setShiftPatterns] = useState<TemplateShiftPattern[]>([]);
  const [layoutMode, setLayoutMode] = useState<'employee' | 'position' | 'station'>('employee');
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; position?: string; userId?: string }>>([]);
  const [positionOptions, setPositionOptions] = useState<Array<{ id: string; name: string; title: string }>>([]);
  const [stations, setStations] = useState<Array<{ id: string; name: string; stationType?: string; defaultStartTime?: string | null; defaultEndTime?: string | null }>>([]);
  const [draggingResource, setDraggingResource] = useState<{ type: 'employee' | 'position' | 'station'; label: string; detail?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ScheduleShift | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState<string>('');
  const [selectedStationName, setSelectedStationName] = useState<string>('');
  const [shiftColor, setShiftColor] = useState<string>('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  // Parse template duration
  const getTemplateDuration = (): number => {
    if (template.scheduleType.includes('_DAYS')) {
      return parseInt(template.scheduleType.replace('_DAYS', ''), 10) || 7;
    }
    if (template.scheduleType === 'WEEKLY') return 7;
    if (template.scheduleType === 'BIWEEKLY') return 14;
    if (template.scheduleType === 'MONTHLY') return 30;
    return 7;
  };

  const templateDuration = getTemplateDuration();

  // Load template shift patterns
  useEffect(() => {
    if (template.templateData && typeof template.templateData === 'object' && 'shiftPatterns' in template.templateData) {
      const patterns = (template.templateData.shiftPatterns as TemplateShiftPattern[]) || [];
      setShiftPatterns(patterns);
    }
  }, [template]);

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

  // Load employees, positions, stations
  useEffect(() => {
    const loadData = async () => {
      if (!session?.accessToken) return;
      try {
        const [employeesResponse, positionsResponse, stationsResponse] = await Promise.all([
          getBusinessEmployees(businessId, session.accessToken),
          getPositions(businessId, session.accessToken),
          getBusinessStations(businessId, session.accessToken),
        ]);
        
        // Extract arrays from responses (matching ScheduleBuilderVisual pattern)
        if (employeesResponse.success && employeesResponse.data) {
          const employeeList = employeesResponse.data.map((ep: any) => ({
            id: ep.id, // This is the employeePositionId
            name: ep.user?.name || 'Unknown',
            position: ep.position?.title || ep.position?.name || undefined,
            userId: ep.user?.id,
          }));
          setEmployees(employeeList);
        }

        if (positionsResponse.success && positionsResponse.data) {
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
        }

        if (stationsResponse.stations) {
          const stationsList = stationsResponse.stations
            .filter((s: any) => s.isActive)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              stationType: s.stationType,
              defaultStartTime: s.defaultStartTime || null,
              defaultEndTime: s.defaultEndTime || null,
            }));
          setStations(stationsList);
        }
      } catch (err) {
        console.error('Failed to load template builder data:', err);
        // Ensure arrays are set even on error
        setEmployees([]);
        setPositionOptions([]);
        setStations([]);
      }
    };
    loadData();
  }, [businessId, session?.accessToken]);

  // Generate a week view for the template (using a reference week)
  const referenceWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: templateDuration }, (_, i) => addDays(referenceWeekStart, i));

  // Helper to get default times from resource
  const getResourceDefaultTimes = (
    resource: { defaultStartTime?: string | null; defaultEndTime?: string | null } | undefined,
    baseDay: Date
  ): { start?: Date; end?: Date } => {
    if (!resource) return {};
    const defaults: { start?: Date; end?: Date } = {};
    if (resource.defaultStartTime) {
      const [hours, minutes] = resource.defaultStartTime.split(':').map(Number);
      defaults.start = new Date(baseDay);
      defaults.start.setHours(hours, minutes, 0, 0);
    }
    if (resource.defaultEndTime) {
      const [hours, minutes] = resource.defaultEndTime.split(':').map(Number);
      defaults.end = new Date(baseDay);
      defaults.end.setHours(hours, minutes, 0, 0);
      if (defaults.start && defaults.end && defaults.end <= defaults.start) {
        defaults.end.setDate(defaults.end.getDate() + 1);
      }
    }
    return defaults;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current;
    if (activeData?.type === 'employee' && activeData.employee) {
      setDraggingResource({
        type: 'employee',
        label: activeData.employee.name || 'Employee',
        detail: activeData.employee.position,
      });
    } else if (activeData?.type === 'position' && activeData.position) {
      setDraggingResource({
        type: 'position',
        label: activeData.position.title || 'Position',
        detail: activeData.position.name,
      });
    } else if (activeData?.type === 'station' && activeData.station) {
      setDraggingResource({
        type: 'station',
        label: activeData.station.name || 'Station',
        detail: activeData.station.stationType,
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingResource(null);

    if (!over) return;

    const activeData = active.data.current;
    const overId = over.id as string;

    if (!overId.startsWith('cell-')) return;

    const cellData = over.data.current;
    if (!cellData || cellData.type !== 'cell') return;

    const { rowId, day } = cellData;
    const dropDay = new Date(day);
    const dayOfWeek = format(dropDay, 'EEEE').toUpperCase();

    // Create a new shift pattern based on what was dragged
    if (activeData?.type === 'employee' && activeData.employee) {
      // In employee view, dragging an employee creates a shift pattern for that employee's position
      const employee = employees.find(e => e.id === activeData.employee.id);
      const position = positionOptions.find(p => p.title === employee?.position || p.name === employee?.position);
      
      const newPattern: TemplateShiftPattern = {
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
        positionId: position?.id,
        positionTitle: position?.title || employee?.position,
        employeePositionId: activeData.employee.id, // Store which employee this is for
        breakMinutes: 30,
        minStaffing: 1,
        maxStaffing: 1,
      };
      setShiftPatterns([...shiftPatterns, newPattern]);
    } else if (activeData?.type === 'position' && activeData.position) {
      // Match schedule builder EXACTLY (line 709-716):
      // 1. Set employeePositionId from rowId when in employee mode
      // 2. Set positionId from the dragged position OR from rowId if in position/station mode
      const dropDay = new Date(day);
      const resourceDefaults = getResourceDefaultTimes(activeData.position, dropDay);
      
      // Determine position ID: use rowId if in position/station mode and rowId matches a position
      let finalPositionId = activeData.position.id;
      let finalPositionTitle = activeData.position.title;
      
      if (layoutMode === 'employee') {
        // In employee mode: assign to employee row or open-shifts
        // Check if rowId is 'open-shifts' or a valid employee ID
        const assignedEmployeeId: string | undefined = rowId === 'open-shifts' 
          ? undefined 
          : employees.find(e => e.id === rowId) 
            ? rowId 
            : undefined;
        
        const startTime = resourceDefaults.start || new Date(dropDay);
        if (!resourceDefaults.start) {
          startTime.setHours(9, 0, 0, 0);
        }
        const endTime = resourceDefaults.end || new Date(startTime);
        if (!resourceDefaults.end) {
          endTime.setHours(endTime.getHours() + 4);
        }
        
        const newPattern: TemplateShiftPattern = {
          dayOfWeek,
          startTime: format(startTime, 'HH:mm'),
          endTime: format(endTime, 'HH:mm'),
          positionId: finalPositionId,
          positionTitle: finalPositionTitle,
          employeePositionId: assignedEmployeeId, // Use rowId directly when in employee mode (matches schedule builder)
          breakMinutes: 30,
          minStaffing: 1,
          maxStaffing: 1,
        };
        setShiftPatterns([...shiftPatterns, newPattern]);
      } else if (layoutMode === 'position' || layoutMode === 'station') {
        // In position/station mode: only create if rowId matches a position
        const targetPosition = positionOptions.find(p => p.id === rowId);
        if (targetPosition) {
          // Row is a position - use it
          finalPositionId = targetPosition.id;
          finalPositionTitle = targetPosition.title;
        } else {
          // Row is not a position - don't create pattern (might be a station row)
          return;
        }
        
        const startTime = resourceDefaults.start || new Date(dropDay);
        if (!resourceDefaults.start) {
          startTime.setHours(9, 0, 0, 0);
        }
        const endTime = resourceDefaults.end || new Date(startTime);
        if (!resourceDefaults.end) {
          endTime.setHours(endTime.getHours() + 4);
        }
        
        const newPattern: TemplateShiftPattern = {
          dayOfWeek,
          startTime: format(startTime, 'HH:mm'),
          endTime: format(endTime, 'HH:mm'),
          positionId: finalPositionId,
          positionTitle: finalPositionTitle,
          employeePositionId: undefined, // No employee assignment in position/station mode
          breakMinutes: 30,
          minStaffing: 1,
          maxStaffing: 1,
        };
        setShiftPatterns([...shiftPatterns, newPattern]);
      }
    } else if (activeData?.type === 'station' && activeData.station) {
      // Match schedule builder pattern: when in station/position mode, check if rowId matches station
      const dropDay = new Date(day);
      const resourceDefaults = getResourceDefaultTimes(activeData.station, dropDay);
      
      if (layoutMode === 'employee') {
        // In employee mode: assign to employee row or open-shifts
        // Check if rowId is 'open-shifts' or a valid employee ID
        const assignedEmployeeId: string | undefined = rowId === 'open-shifts' 
          ? undefined 
          : employees.find(e => e.id === rowId) 
            ? rowId 
            : undefined;
        
        const startTime = resourceDefaults.start || new Date(dropDay);
        if (!resourceDefaults.start) {
          startTime.setHours(9, 0, 0, 0);
        }
        const endTime = resourceDefaults.end || new Date(startTime);
        if (!resourceDefaults.end) {
          endTime.setHours(endTime.getHours() + 4);
        }
        
        const newPattern: TemplateShiftPattern = {
          dayOfWeek,
          startTime: format(startTime, 'HH:mm'),
          endTime: format(endTime, 'HH:mm'),
          stationName: activeData.station.name,
          employeePositionId: assignedEmployeeId, // Assign to employee if dropped on employee row
          breakMinutes: 30,
          minStaffing: 1,
          maxStaffing: 1,
        };
        setShiftPatterns([...shiftPatterns, newPattern]);
      } else if (layoutMode === 'position' || layoutMode === 'station') {
        // In position/station mode: only create if rowId matches a station
        const targetStation = stations.find(s => s.id === rowId || s.name === rowId);
        if (!targetStation) {
          // Row is not a station - don't create pattern (might be a position row)
          return;
        }
        
        const startTime = resourceDefaults.start || new Date(dropDay);
        if (!resourceDefaults.start) {
          startTime.setHours(9, 0, 0, 0);
        }
        const endTime = resourceDefaults.end || new Date(startTime);
        if (!resourceDefaults.end) {
          endTime.setHours(endTime.getHours() + 4);
        }
        
        const newPattern: TemplateShiftPattern = {
          dayOfWeek,
          startTime: format(startTime, 'HH:mm'),
          endTime: format(endTime, 'HH:mm'),
          stationName: targetStation.name, // Use the station from the row
          breakMinutes: 30,
          minStaffing: 1,
          maxStaffing: 1,
        };
        setShiftPatterns([...shiftPatterns, newPattern]);
      }
    }
  };

  const handleSave = async () => {
    if (!session?.accessToken || saving) return;
    setSaving(true);
    try {
      await updateScheduleTemplate(
        businessId,
        template.id,
        {
          templateData: { shiftPatterns },
        },
        session.accessToken
      );
      if (onSave) onSave();
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Convert shift patterns to visual shifts for the grid
  const visualShifts: ScheduleShift[] = shiftPatterns.map((pattern, index) => {
    // Map day of week to the correct day in weekDays array
    // weekDays starts on Monday (index 0), so we need to adjust
    const dayOfWeekIndex = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].indexOf(pattern.dayOfWeek);
    // Convert to Monday-based index: MONDAY=0, TUESDAY=1, ..., SUNDAY=6
    const mondayBasedIndex = dayOfWeekIndex >= 0 
      ? (dayOfWeekIndex === 0 ? 6 : dayOfWeekIndex - 1) // Sunday becomes 6, Monday becomes 0, etc.
      : 0;
    // Use the index within the template duration (for templates longer than 7 days, repeat weekly pattern)
    const dayIndex = mondayBasedIndex % templateDuration;
    const day = weekDays[dayIndex] || weekDays[0];
    const [startHours, startMinutes] = pattern.startTime.split(':').map(Number);
    const [endHours, endMinutes] = pattern.endTime.split(':').map(Number);
    const startTime = new Date(day);
    startTime.setHours(startHours, startMinutes);
    const endTime = new Date(day);
    endTime.setHours(endHours, endMinutes);

    // Find employee info if employeePositionId is set
    const employee = pattern.employeePositionId ? employees.find(e => e.id === pattern.employeePositionId) : undefined;

    // CRITICAL: Preserve employeePositionId exactly as set (string or undefined)
    // Don't convert undefined to null - use the value directly
    const finalEmployeePositionId = pattern.employeePositionId || null;

    return {
      id: `pattern-${index}`,
      scheduleId: 'template',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      // CRITICAL: Use the employeePositionId directly - if it's a string, it must match rowId
      // If it's undefined/null, the shift will appear in open-shifts row
      employeePositionId: finalEmployeePositionId,
      employeePosition: employee ? {
        id: employee.id,
        user: { id: employee.userId || '', name: employee.name, email: '' },
        position: { title: employee.position || '' }
      } : undefined,
      positionId: pattern.positionId,
      position: pattern.positionId ? { id: pattern.positionId, title: pattern.positionTitle || '' } : undefined,
      stationName: pattern.stationName, // Ensure stationName matches station.name for row matching
      breakMinutes: pattern.breakMinutes || 0,
      notes: pattern.notes,
      color: pattern.color,
      // Status: SCHEDULED if assigned to employee, OPEN if unassigned
      status: pattern.employeePositionId ? ('SCHEDULED' as const) : ('OPEN' as const),
      businessId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as ScheduleShift;
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex">
        {/* Sidebar with positions and stations - Hidden by default in template builder */}
        <div className="w-64 bg-white border-r flex-shrink-0">
          <ScheduleBuilderSidebar
            scheduleId="template"
            businessId={businessId}
            scheduleShifts={visualShifts}
            onBack={onCancel || (() => {})}
            onPublish={undefined} // No publishing for templates
            employees={employees || []}
            positions={positionOptions || []}
            stations={stations || []}
            layoutMode={layoutMode}
            backButtonText="Back to Templates"
            defaultCollapsed={false}
          />
        </div>

        {/* Main builder area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with Layout Mode Selector */}
          <div className="flex-shrink-0 bg-white border-b p-4">
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
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <ScheduleCalendarGrid
              scheduleId="template"
              shifts={visualShifts}
              startDate={referenceWeekStart}
              endDate={addDays(referenceWeekStart, templateDuration - 1)}
              layoutMode={layoutMode}
              employees={employees || []}
              positions={positionOptions || []}
              stations={stations || []}
              onShiftClick={(shift) => {
                setSelectedShift(shift);
                setSelectedPositionId(shift.positionId || '');
                setSelectedStationName(shift.stationName || '');
                setShiftColor(shift.color || '');
                setShowColorPicker(false);
                setShowShiftModal(true);
              }}
            />
          </div>
        </div>
      </div>

      <DragOverlay>
        {draggingResource ? (
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

      {/* Shift Edit Modal */}
      <Modal
        open={showShiftModal}
        onClose={() => {
          setShowShiftModal(false);
          setSelectedShift(null);
          setSelectedPositionId('');
          setSelectedStationName('');
          setShiftColor('');
          setShowColorPicker(false);
        }}
        title={
          selectedShift
            ? `Edit Shift Pattern for ${selectedShift.startTime ? format(parseISO(selectedShift.startTime), 'EEE, MMM d') : 'Date'}`
            : 'Edit Shift Pattern'
        }
        size="xlarge"
      >
        {selectedShift && (
          <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 180px)' }}>
            {/* Main Fields Grid - 2 columns */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Time (Required) */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Time *
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type="text"
                      placeholder="9a - 5p"
                      value={
                        selectedShift.startTime && selectedShift.endTime
                          ? `${format(parseISO(selectedShift.startTime), 'h:mma')} - ${format(parseISO(selectedShift.endTime), 'h:mma')}`
                          : ''
                      }
                      readOnly
                      className="pl-10 cursor-not-allowed bg-gray-50 text-sm"
                    />
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500 whitespace-nowrap">Start:</label>
                    <Input
                      type="time"
                      value={selectedShift.startTime ? format(parseISO(selectedShift.startTime), 'HH:mm') : ''}
                      onChange={(e) => {
                        if (selectedShift) {
                          const patternIndex = parseInt(selectedShift.id.replace('pattern-', ''));
                          const pattern = shiftPatterns[patternIndex];
                          if (pattern) {
                            const updatedPatterns = [...shiftPatterns];
                            updatedPatterns[patternIndex] = {
                              ...pattern,
                              startTime: e.target.value,
                            };
                            setShiftPatterns(updatedPatterns);
                            // Update the visual shift
                            const [hours, minutes] = e.target.value.split(':').map(Number);
                            const day = weekDays.find(d => {
                              const dayName = format(d, 'EEEE').toUpperCase();
                              return dayName === pattern.dayOfWeek;
                            }) || weekDays[0];
                            const newStartTime = new Date(day);
                            newStartTime.setHours(hours, minutes);
                            setSelectedShift({
                              ...selectedShift,
                              startTime: newStartTime.toISOString(),
                            });
                          }
                        }
                      }}
                      className="text-sm w-32"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500 whitespace-nowrap">End:</label>
                    <Input
                      type="time"
                      value={selectedShift.endTime ? format(parseISO(selectedShift.endTime), 'HH:mm') : ''}
                      onChange={(e) => {
                        if (selectedShift) {
                          const patternIndex = parseInt(selectedShift.id.replace('pattern-', ''));
                          const pattern = shiftPatterns[patternIndex];
                          if (pattern) {
                            const updatedPatterns = [...shiftPatterns];
                            updatedPatterns[patternIndex] = {
                              ...pattern,
                              endTime: e.target.value,
                            };
                            setShiftPatterns(updatedPatterns);
                            // Update the visual shift
                            const [hours, minutes] = e.target.value.split(':').map(Number);
                            const day = weekDays.find(d => {
                              const dayName = format(d, 'EEEE').toUpperCase();
                              return dayName === pattern.dayOfWeek;
                            }) || weekDays[0];
                            const newEndTime = new Date(day);
                            newEndTime.setHours(hours, minutes);
                            setSelectedShift({
                              ...selectedShift,
                              endTime: newEndTime.toISOString(),
                            });
                          }
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
                        const patternIndex = parseInt(selectedShift.id.replace('pattern-', ''));
                        const pattern = shiftPatterns[patternIndex];
                        if (pattern) {
                          const updatedPatterns = [...shiftPatterns];
                          const position = positionOptions.find(p => p.id === e.target.value);
                          updatedPatterns[patternIndex] = {
                            ...pattern,
                            positionId: e.target.value || undefined,
                            positionTitle: position?.title || undefined,
                          };
                          setShiftPatterns(updatedPatterns);
                        }
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
                    value={selectedStationName || ''}
                    onChange={(e) => {
                      setSelectedStationName(e.target.value);
                      if (selectedShift) {
                        const patternIndex = parseInt(selectedShift.id.replace('pattern-', ''));
                        const pattern = shiftPatterns[patternIndex];
                        if (pattern) {
                          const updatedPatterns = [...shiftPatterns];
                          updatedPatterns[patternIndex] = {
                            ...pattern,
                            stationName: e.target.value || undefined,
                          };
                          setShiftPatterns(updatedPatterns);
                          setSelectedShift({
                            ...selectedShift,
                            stationName: e.target.value || undefined,
                          });
                        }
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

              {/* Shift Color */}
              <div className="col-span-2">
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
                        style={{ backgroundColor: shiftColor || selectedShift.color || '#d1d5db' }}
                      />
                      <span>{shiftColor || selectedShift.color ? 'Custom' : 'Default'}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showColorPicker ? 'transform rotate-180' : ''}`} />
                  </button>
                  
                  {showColorPicker && (
                    <div className="absolute z-50 mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg p-4" data-color-picker>
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
                              if (selectedShift) {
                                const patternIndex = parseInt(selectedShift.id.replace('pattern-', ''));
                                const pattern = shiftPatterns[patternIndex];
                                if (pattern) {
                                  const updatedPatterns = [...shiftPatterns];
                                  updatedPatterns[patternIndex] = {
                                    ...pattern,
                                    color,
                                  };
                                  setShiftPatterns(updatedPatterns);
                                }
                              }
                            }}
                            className="w-8 h-8 rounded border border-gray-200 hover:scale-110 hover:z-10 transition-transform cursor-pointer"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShiftColor('');
                          setShowColorPicker(false);
                          if (selectedShift) {
                            const patternIndex = parseInt(selectedShift.id.replace('pattern-', ''));
                            const pattern = shiftPatterns[patternIndex];
                            if (pattern) {
                              const updatedPatterns = [...shiftPatterns];
                              updatedPatterns[patternIndex] = {
                                ...pattern,
                                color: undefined,
                              };
                              setShiftPatterns(updatedPatterns);
                            }
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

              {/* Notes */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Notes
                </label>
                <Input
                  type="text"
                  value={selectedShift.notes || ''}
                  onChange={(e) => {
                    if (selectedShift) {
                      const patternIndex = parseInt(selectedShift.id.replace('pattern-', ''));
                      const pattern = shiftPatterns[patternIndex];
                      if (pattern) {
                        const updatedPatterns = [...shiftPatterns];
                        updatedPatterns[patternIndex] = {
                          ...pattern,
                          notes: e.target.value || undefined,
                        };
                        setShiftPatterns(updatedPatterns);
                        setSelectedShift({
                          ...selectedShift,
                          notes: e.target.value || undefined,
                        });
                      }
                    }
                  }}
                  placeholder="Add notes about this shift pattern..."
                  className="text-sm"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t mt-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (selectedShift && confirm('Are you sure you want to delete this shift pattern?')) {
                    const patternIndex = parseInt(selectedShift.id.replace('pattern-', ''));
                    const updatedPatterns = shiftPatterns.filter((_, idx) => idx !== patternIndex);
                    setShiftPatterns(updatedPatterns);
                    setShowShiftModal(false);
                    setSelectedShift(null);
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                DELETE
              </Button>
              <div className="flex space-x-2">
                <Button
                  onClick={() => {
                    setShowShiftModal(false);
                    setSelectedShift(null);
                  }}
                  variant="secondary"
                >
                  CANCEL
                </Button>
                <Button
                  onClick={async () => {
                    setShowShiftModal(false);
                    setSelectedShift(null);
                    await handleSave();
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  SAVE
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DndContext>
  );
}

