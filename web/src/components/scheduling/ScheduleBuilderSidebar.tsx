'use client';

import React, { useState, useEffect } from 'react';
import { Button, Switch } from 'shared/components';
import { useDraggable } from '@dnd-kit/core';
import { 
  ArrowLeft, 
  Send, 
  Briefcase, 
  MapPin,
  Building2,
  User, 
  BarChart3,
  Settings,
  List,
  ChevronDown,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { 
  publishSchedule, 
  getBusinessStations, 
  getBusinessJobLocations,
  createBusinessStation,
  createBusinessJobLocation 
} from '@/api/scheduling';
import { useSession } from 'next-auth/react';
import { getBusinessEmployees, getPositions, createPosition, getOrganizationalTiers } from '@/api/orgChart';
import { Card, Modal, Input, Textarea, Alert } from 'shared/components';
import { Plus } from 'lucide-react';

export interface ScheduleFilters {
  positions: string[];
  users: string[];
  stations: string[];
  jobLocations: string[];
}

interface Employee {
  id: string;
  name: string;
  position?: string;
  email?: string;
}

interface Position {
  id: string;
  title?: string;
  name?: string;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
}

interface Station {
  id: string;
  name: string;
  stationType?: string;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
}

type LayoutMode = 'employee' | 'position' | 'station';

interface ScheduleBuilderSidebarProps {
  scheduleId: string;
  businessId: string;
  scheduleShifts: any[];
  onBack: () => void;
  onPublish?: () => void;
  onFiltersChange?: (filters: ScheduleFilters) => void;
  employees?: Employee[];
  positions?: Position[];
  stations?: Station[];
  layoutMode?: LayoutMode;
  onBuildToolsRefresh?: () => void;
  backButtonText?: string; // Custom back button text
  defaultCollapsed?: boolean; // Start collapsed by default
}

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

const getPositionSubLabel = (position: Position): string | undefined => {
  const timeRange = formatTimeRange(position.defaultStartTime, position.defaultEndTime);
  if (timeRange) {
    return timeRange;
  }
  if (position.name && position.title && position.title !== position.name) {
    return position.name;
  }
  return undefined;
};

const getStationSubLabel = (station: Station): string | undefined => {
  const timeRange = formatTimeRange(station.defaultStartTime, station.defaultEndTime);
  if (station.stationType && timeRange) {
    return `${station.stationType} • ${timeRange}`;
  }
  return timeRange || station.stationType || undefined;
};

interface DraggableResourceCardProps {
  id: string;
  label: string;
  subLabel?: string;
  type: 'employee' | 'position' | 'station';
  data: Employee | Position | Station;
}

function DraggableResourceCard({ id, label, subLabel, type, data }: DraggableResourceCardProps) {
  const dragPayload =
    type === 'employee'
      ? { type: 'employee' as const, employee: data as Employee }
      : type === 'position'
      ? { type: 'position' as const, position: data as Position }
      : { type: 'station' as const, station: data as Station };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: dragPayload,
  });

  const Icon = type === 'employee' ? User : type === 'position' ? Briefcase : MapPin;

  // Don't apply transform when dragging (DragOverlay handles it)
  const style = transform && !isDragging
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        p-2 rounded-lg border border-gray-200 bg-white cursor-grab active:cursor-grabbing
        hover:border-blue-400 hover:shadow-md transition-opacity
        ${isDragging ? 'opacity-30' : 'opacity-100'}
      `}
    >
      <div className="flex items-center space-x-2">
        <div className={`flex-shrink-0 w-6 h-6 rounded-full ${type === 'station' ? 'bg-purple-100' : type === 'position' ? 'bg-amber-100' : 'bg-blue-100'} flex items-center justify-center`}>
          <Icon className={`w-3 h-3 ${type === 'station' ? 'text-purple-600' : type === 'position' ? 'text-amber-600' : 'text-blue-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 truncate">{label}</p>
          {subLabel && (
            <p className="text-xs text-gray-500 truncate">
              {subLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScheduleBuilderSidebar({
  scheduleId,
  businessId,
  scheduleShifts,
  onBack,
  onPublish,
  onFiltersChange,
  employees = [],
  positions: buildPositions = [],
  stations: buildStations = [],
  layoutMode = 'employee',
  onBuildToolsRefresh,
  backButtonText = 'Back to Scheduling',
  defaultCollapsed = false
}: ScheduleBuilderSidebarProps) {
  const { data: session } = useSession();
  const [publishing, setPublishing] = useState(false);
  const [forecastToolsEnabled, setForecastToolsEnabled] = useState(false);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const [showTaskLists, setShowTaskLists] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  
  // Build tools dropdown states
  const [showEmployeesBuildTools, setShowEmployeesBuildTools] = useState(false);
  const [showPositionsBuildTools, setShowPositionsBuildTools] = useState(false);
  const [showStationsBuildTools, setShowStationsBuildTools] = useState(false);
  
  // Filter dropdown states (for job locations - keeping this for now)
  const [showJobLocationsDropdown, setShowJobLocationsDropdown] = useState(false);
  
  // Filter states
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [selectedJobLocations, setSelectedJobLocations] = useState<string[]>([]);
  
  // Data for filters
  const [positions, setPositions] = useState<Array<{ id: string; title: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [stations, setStations] = useState<Array<{ id: string; name: string }>>([]);
  const [jobLocations, setJobLocations] = useState<Array<{ id: string; name: string }>>([]);

  // Modal states
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showAddStationModal, setShowAddStationModal] = useState(false);
  const [showAddJobLocationModal, setShowAddJobLocationModal] = useState(false);
  
  // Form states
  const [positionFormData, setPositionFormData] = useState({ title: '', description: '', tierId: '', departmentId: '', maxOccupants: '', defaultStartTime: '', defaultEndTime: '' });
  const [stationFormData, setStationFormData] = useState({ name: '', stationType: 'BOH' as 'BOH' | 'FOH' | 'MANAGEMENT' | 'HEALTHCARE' | 'MANUFACTURING' | 'OTHER', jobFunction: '', description: '', color: '', defaultStartTime: '', defaultEndTime: '' });
  const [jobLocationFormData, setJobLocationFormData] = useState({ name: '', description: '', phone: '', email: '', notes: '' });
  const [tiers, setTiers] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate unpublished shifts count
  const unpublishedShiftsCount = scheduleShifts.filter(s => s.status === 'ASSIGNED' || s.status === 'OPEN').length;

  // Load filter data
  useEffect(() => {
    if (businessId && session?.accessToken) {
      loadFilterData();
      loadTiers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, session?.accessToken]);

  const loadTiers = async () => {
    if (!session?.accessToken) return;
    try {
      const response = await getOrganizationalTiers(businessId, session.accessToken);
      if (response.success) {
        setTiers(response.data.map((t: any) => ({ id: t.id, name: t.name })));
      }
    } catch (err) {
      console.error('Failed to load tiers:', err);
    }
  };

  const loadFilterData = async () => {
    if (!session?.accessToken) return;
    
    try {
      // Load positions
      const positionsResponse = await getPositions(businessId, session.accessToken);
      if (positionsResponse.success) {
        setPositions(positionsResponse.data.map((p: any) => ({ id: p.id, title: p.name || p.title })));
      }

      // Load employees/users
      const employeesResponse = await getBusinessEmployees(businessId, session.accessToken);
      if (employeesResponse.success) {
        const uniqueUsers = new Map<string, { id: string; name: string }>();
        employeesResponse.data.forEach((ep: any) => {
          if (ep.user && !uniqueUsers.has(ep.user.id)) {
            uniqueUsers.set(ep.user.id, { id: ep.user.id, name: ep.user.name });
          }
        });
        setUsers(Array.from(uniqueUsers.values()));
      }

      // Load stations (for stations filter) - these are work roles/positions
      const stationsResponse = await getBusinessStations(businessId, session.accessToken);
      if (stationsResponse.stations) {
        const stationsList = stationsResponse.stations
          .filter((s: any) => s.isActive)
          .map((s: any) => ({ id: s.id, name: s.name }));
        setStations(stationsList);
      }

      // Load job locations (for job locations filter) - these are physical work sites
      const locationsResponse = await getBusinessJobLocations(businessId, session.accessToken);
      if (locationsResponse.jobLocations) {
        const locationsList = locationsResponse.jobLocations
          .filter((l: any) => l.isActive)
          .map((l: any) => ({ id: l.id, name: l.name }));
        setJobLocations(locationsList);
      }
    } catch (err) {
      console.error('Failed to load filter data:', err);
    }
  };

  // Notify parent when filters change
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange({
        positions: selectedPositions,
        users: selectedUsers,
        stations: selectedStations,
        jobLocations: selectedJobLocations,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPositions, selectedUsers, selectedStations, selectedJobLocations]);

  const togglePosition = (positionId: string) => {
    setSelectedPositions(prev =>
      prev.includes(positionId)
        ? prev.filter(id => id !== positionId)
        : [...prev, positionId]
    );
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleStation = (stationId: string) => {
    setSelectedStations(prev =>
      prev.includes(stationId)
        ? prev.filter(id => id !== stationId)
        : [...prev, stationId]
    );
  };

  const toggleJobLocation = (locationId: string) => {
    setSelectedJobLocations(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  const handleCreatePosition = async () => {
    if (!positionFormData.title.trim()) {
      setError('Position title is required');
      return;
    }

    if (!positionFormData.tierId) {
      setError('Organizational tier is required');
      return;
    }

    if (!session?.accessToken) return;

    try {
      setSaving(true);
      setError(null);

      const positionPayload: any = {
        businessId,
        title: positionFormData.title.trim(),
        description: positionFormData.description || undefined,
        tierId: positionFormData.tierId,
        departmentId: positionFormData.departmentId || undefined,
        maxOccupants: positionFormData.maxOccupants ? parseInt(positionFormData.maxOccupants, 10) : undefined,
        defaultStartTime: positionFormData.defaultStartTime || undefined,
        defaultEndTime: positionFormData.defaultEndTime || undefined,
      };

      await createPosition(positionPayload, session.accessToken);

      setShowAddPositionModal(false);
      setPositionFormData({ title: '', description: '', tierId: '', departmentId: '', maxOccupants: '', defaultStartTime: '', defaultEndTime: '' });
      await loadFilterData();
      // Refresh build tools data in parent
      if (onBuildToolsRefresh) {
        onBuildToolsRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create position');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStation = async () => {
    if (!stationFormData.name.trim()) {
      setError('Station name is required');
      return;
    }

    if (!session?.accessToken) return;

    try {
      setSaving(true);
      setError(null);

      await createBusinessStation(
        businessId,
        {
          name: stationFormData.name.trim(),
          stationType: stationFormData.stationType,
          jobFunction: stationFormData.jobFunction || undefined,
          description: stationFormData.description || undefined,
          color: stationFormData.color || undefined,
          defaultStartTime: stationFormData.defaultStartTime || undefined,
          defaultEndTime: stationFormData.defaultEndTime || undefined,
        },
        session.accessToken
      );

      setShowAddStationModal(false);
      setStationFormData({ name: '', stationType: 'BOH', jobFunction: '', description: '', color: '', defaultStartTime: '', defaultEndTime: '' });
      await loadFilterData();
      // Refresh build tools data in parent
      if (onBuildToolsRefresh) {
        onBuildToolsRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create station');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateJobLocation = async () => {
    if (!jobLocationFormData.name.trim()) {
      setError('Location name is required');
      return;
    }

    if (!session?.accessToken) return;

    try {
      setSaving(true);
      setError(null);

      await createBusinessJobLocation(
        businessId,
        {
          name: jobLocationFormData.name.trim(),
          description: jobLocationFormData.description || undefined,
          phone: jobLocationFormData.phone || undefined,
          email: jobLocationFormData.email || undefined,
          notes: jobLocationFormData.notes || undefined,
        },
        session.accessToken
      );

      setShowAddJobLocationModal(false);
      setJobLocationFormData({ name: '', description: '', phone: '', email: '', notes: '' });
      await loadFilterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job location');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!session?.accessToken) return;
    
    try {
      setPublishing(true);
      await publishSchedule(businessId, scheduleId, session.accessToken);
      if (onPublish) {
        onPublish();
      }
    } catch (err) {
      console.error('Failed to publish schedule:', err);
      alert(err instanceof Error ? err.message : 'Failed to publish schedule');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <aside className={`relative bg-gray-50 border-r border-gray-200 flex flex-col h-full transition-all duration-300 ease-in-out ${
      isCollapsed ? 'w-12' : 'w-64'
    }`}>
      {/* Collapse/Expand Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-1/2 -right-3 transform -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 border-2 border-white shadow-md flex items-center justify-center transition-all duration-200"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-white" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-white" />
        )}
      </button>

      {/* Back Button */}
      <div className={`p-4 border-b border-gray-200 bg-white transition-opacity duration-200 ${
        isCollapsed ? 'p-2' : ''
      }`}>
        {isCollapsed ? (
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center text-gray-700 hover:text-gray-900 transition-colors p-2 rounded hover:bg-gray-100"
            title={backButtonText}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onBack}
            className="flex items-center text-gray-700 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium whitespace-nowrap">{backButtonText}</span>
          </button>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto p-4 space-y-4 transition-opacity duration-200 ${
        isCollapsed ? 'opacity-0 overflow-hidden pointer-events-none' : 'opacity-100'
      }`}>
        {/* Publish & Notify Button */}
        <Button
          onClick={handlePublish}
          disabled={publishing}
          className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center py-3"
        >
          <Send className="w-4 h-4 mr-2" />
          {publishing ? 'Publishing...' : 'Publish & Notify'}
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
        {unpublishedShiftsCount > 0 && (
          <p className="text-xs text-gray-600 text-center -mt-2">
            {unpublishedShiftsCount} shift{unpublishedShiftsCount !== 1 ? 's' : ''}
          </p>
        )}

        {/* Build Tools Section */}
        <div>
          <div className="bg-gray-100 px-4 py-2 mb-2">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Build tools</h3>
          </div>
          <div className="space-y-0 bg-white rounded-lg border border-gray-200">
            {/* Employees Build Tools */}
            <div className="border-b border-gray-200 last:border-b-0">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowEmployeesBuildTools(!showEmployeesBuildTools)}
              >
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Employees</span>
                </div>
                {showEmployeesBuildTools ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {showEmployeesBuildTools && (
                <div className="border-t border-gray-100 px-4 pb-3">
                  <div className="space-y-2 pt-2 max-h-64 overflow-y-auto">
                    {employees.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">No employees yet</p>
                    ) : (
                      employees.map((employee) => (
                        <DraggableResourceCard
                          key={employee.id}
                          id={`employee-${employee.id}`}
                          label={employee.name}
                          subLabel={employee.position}
                          type="employee"
                          data={employee}
                        />
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => {/* TODO: Add employee functionality */}}
                    className="w-full mt-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 border border-gray-200 rounded flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              )}
            </div>

            {/* Positions Build Tools */}
            <div className="border-b border-gray-200 last:border-b-0">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowPositionsBuildTools(!showPositionsBuildTools)}
              >
                <div className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Positions</span>
                </div>
                {showPositionsBuildTools ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {showPositionsBuildTools && (
                <div className="border-t border-gray-100 px-4 pb-3">
                  <div className="space-y-2 pt-2 max-h-64 overflow-y-auto">
                    {buildPositions.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">No positions yet</p>
                    ) : (
                      buildPositions.map((position) => (
                        <DraggableResourceCard
                          key={position.id}
                          id={`position-${position.id}`}
                          label={position.title || position.name || 'Untitled position'}
                          subLabel={getPositionSubLabel(position)}
                          type="position"
                          data={position}
                        />
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => {/* TODO: Add employee functionality */}}
                    className="w-full mt-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 border border-gray-200 rounded flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              )}
            </div>

            {/* Stations Build Tools */}
            <div className="border-b border-gray-200 last:border-b-0">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowStationsBuildTools(!showStationsBuildTools)}
              >
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Stations</span>
                </div>
                {showStationsBuildTools ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {showStationsBuildTools && (
                <div className="border-t border-gray-100 px-4 pb-3">
                  <div className="space-y-2 pt-2 max-h-64 overflow-y-auto">
                    {buildStations.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">No stations yet</p>
                    ) : (
                      buildStations.map((station) => (
                        <DraggableResourceCard
                          key={station.id}
                          id={`station-${station.id}`}
                          label={station.name}
                          subLabel={getStationSubLabel(station)}
                          type="station"
                          data={station}
                        />
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddStationModal(true)}
                    className="w-full mt-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 border border-gray-200 rounded flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* More Tools Section */}
        <div>
          <div className="bg-gray-100 px-4 py-2 mb-2">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">More tools</h3>
          </div>
          <div className="space-y-0 bg-white rounded-lg border border-gray-200">
            {/* Forecast Tools */}
            <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-sm text-gray-700">Forecast tools</span>
              </div>
              <Switch
                checked={forecastToolsEnabled}
                onChange={setForecastToolsEnabled}
              />
            </div>

            {/* Display Options */}
            <div className="border-b border-gray-200 last:border-b-0">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowDisplayOptions(!showDisplayOptions)}
              >
                <div className="flex items-center">
                  <Settings className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Display options</span>
                </div>
                {showDisplayOptions ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>

            {/* Task Lists */}
            <div className="border-b border-gray-200 last:border-b-0">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowTaskLists(!showTaskLists)}
              >
                <div className="flex items-center">
                  <List className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Task lists</span>
                </div>
                {showTaskLists ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Position Modal */}
      <Modal
        open={showAddPositionModal}
        onClose={() => {
          setShowAddPositionModal(false);
          setError(null);
          setPositionFormData({ title: '', description: '', tierId: '', departmentId: '', maxOccupants: '', defaultStartTime: '', defaultEndTime: '' });
        }}
        title="Add Position"
      >
        <div className="space-y-4">
          {error && (
            <Alert type="error" title="Error">
              {error}
            </Alert>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Title *</label>
            <Input
              value={positionFormData.title}
              onChange={(e) => setPositionFormData({ ...positionFormData, title: e.target.value })}
              placeholder="e.g., Server, Cook, Manager"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
            <Textarea
              value={positionFormData.description}
              onChange={(e) => setPositionFormData({ ...positionFormData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Organizational Tier *</label>
            <select
              value={positionFormData.tierId}
              onChange={(e) => setPositionFormData({ ...positionFormData, tierId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              <option value="">Select a tier</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>{tier.name}</option>
              ))}
            </select>
            {tiers.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No organizational tiers available. Create tiers in the settings first.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Max Occupants</label>
            <Input
              type="number"
              value={positionFormData.maxOccupants}
              onChange={(e) => setPositionFormData({ ...positionFormData, maxOccupants: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Default Start Time</label>
              <Input
                type="time"
                value={positionFormData.defaultStartTime}
                onChange={(e) => setPositionFormData({ ...positionFormData, defaultStartTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Default End Time</label>
              <Input
                type="time"
                value={positionFormData.defaultEndTime}
                onChange={(e) => setPositionFormData({ ...positionFormData, defaultEndTime: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddPositionModal(false);
                setError(null);
                setPositionFormData({ title: '', description: '', tierId: '', departmentId: '', maxOccupants: '', defaultStartTime: '', defaultEndTime: '' });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePosition} disabled={saving || !positionFormData.title.trim() || !positionFormData.tierId}>
              {saving ? 'Creating...' : 'Create Position'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Station Modal */}
      <Modal
        open={showAddStationModal}
        onClose={() => {
          setShowAddStationModal(false);
          setError(null);
      setStationFormData({ name: '', stationType: 'BOH', jobFunction: '', description: '', color: '', defaultStartTime: '', defaultEndTime: '' });
        }}
        title="Add Station"
      >
        <div className="space-y-4">
          {error && (
            <Alert type="error" title="Error">
              {error}
            </Alert>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Name *</label>
            <Input
              value={stationFormData.name}
              onChange={(e) => setStationFormData({ ...stationFormData, name: e.target.value })}
              placeholder="e.g., Grill 1, Front Counter"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Station Type *</label>
            <select
              value={stationFormData.stationType}
              onChange={(e) => setStationFormData({ ...stationFormData, stationType: e.target.value as typeof stationFormData.stationType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              <option value="BOH">Back of House</option>
              <option value="FOH">Front of House</option>
              <option value="MANAGEMENT">Management</option>
              <option value="HEALTHCARE">Healthcare</option>
              <option value="MANUFACTURING">Manufacturing</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
            <Textarea
              value={stationFormData.description}
              onChange={(e) => setStationFormData({ ...stationFormData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Color</label>
            <Input
              type="color"
              value={stationFormData.color || '#3b82f6'}
              onChange={(e) => setStationFormData({ ...stationFormData, color: e.target.value })}
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Default Start Time</label>
              <Input
                type="time"
                value={stationFormData.defaultStartTime}
                onChange={(e) => setStationFormData({ ...stationFormData, defaultStartTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Default End Time</label>
              <Input
                type="time"
                value={stationFormData.defaultEndTime}
                onChange={(e) => setStationFormData({ ...stationFormData, defaultEndTime: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddStationModal(false);
                setError(null);
                setStationFormData({ name: '', stationType: 'BOH', jobFunction: '', description: '', color: '', defaultStartTime: '', defaultEndTime: '' });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateStation} disabled={saving || !stationFormData.name.trim()}>
              {saving ? 'Creating...' : 'Create Station'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Job Location Modal */}
      <Modal
        open={showAddJobLocationModal}
        onClose={() => {
          setShowAddJobLocationModal(false);
          setError(null);
          setJobLocationFormData({ name: '', description: '', phone: '', email: '', notes: '' });
        }}
        title="Add Job Location"
      >
        <div className="space-y-4">
          {error && (
            <Alert type="error" title="Error">
              {error}
            </Alert>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Name *</label>
            <Input
              value={jobLocationFormData.name}
              onChange={(e) => setJobLocationFormData({ ...jobLocationFormData, name: e.target.value })}
              placeholder="e.g., Downtown Office, Construction Site A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
            <Textarea
              value={jobLocationFormData.description}
              onChange={(e) => setJobLocationFormData({ ...jobLocationFormData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Phone</label>
            <Input
              value={jobLocationFormData.phone}
              onChange={(e) => setJobLocationFormData({ ...jobLocationFormData, phone: e.target.value })}
              placeholder="Optional phone number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Email</label>
            <Input
              type="email"
              value={jobLocationFormData.email}
              onChange={(e) => setJobLocationFormData({ ...jobLocationFormData, email: e.target.value })}
              placeholder="Optional email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Notes</label>
            <Textarea
              value={jobLocationFormData.notes}
              onChange={(e) => setJobLocationFormData({ ...jobLocationFormData, notes: e.target.value })}
              placeholder="Additional notes"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddJobLocationModal(false);
                setError(null);
                setJobLocationFormData({ name: '', description: '', phone: '', email: '', notes: '' });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateJobLocation} disabled={saving || !jobLocationFormData.name.trim()}>
              {saving ? 'Creating...' : 'Create Location'}
            </Button>
          </div>
        </div>
      </Modal>
    </aside>
  );
}

