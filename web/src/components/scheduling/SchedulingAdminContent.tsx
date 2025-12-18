'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useScheduling } from '@/hooks/useScheduling';
import { Schedule, ScheduleShift, ScheduleTemplate, getScheduleTemplates, createScheduleTemplate, deleteScheduleTemplate } from '@/api/scheduling';
import { Button, Card, Modal, Input, Textarea } from 'shared/components';
import { getBusiness } from '@/api/business';
import { getSession } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import { useGlobalTrash } from '@/contexts/GlobalTrashContext';
import ScheduleBuilderVisual from './ScheduleBuilderVisual';
import ScheduleBuilderSidebar, { ScheduleFilters } from './ScheduleBuilderSidebar';
import TemplateBuilderVisual from './TemplateBuilderVisual';
import SchedulingConfiguration from '../business/SchedulingConfiguration';
import { getBusinessEmployees, getPositions } from '@/api/orgChart';
import { getBusinessStations } from '@/api/scheduling';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { Users, Briefcase, MapPin } from 'lucide-react';
import {
  Calendar,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  TrendingUp,
  Clock,
  X,
  Edit,
  Trash2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  BarChart3,
} from 'lucide-react';
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';

interface SchedulingAdminContentProps {
  businessId: string;
  view: string;
  onViewChange?: (view: string) => void;
  onEditingTemplateChange?: (isEditing: boolean) => void;
}

export default function SchedulingAdminContent({ 
  businessId, 
  view,
  onViewChange,
  onEditingTemplateChange
}: SchedulingAdminContentProps) {
  const { data: session } = useSession();
  const { trashItem } = useGlobalTrash();
  const {
    schedules,
    shifts,
    loading,
    error,
    fetchShifts,
    createNewSchedule,
    updateExistingSchedule,
    removeSchedule,
    publishExistingSchedule,
    createNewShift,
    updateExistingShift,
    removeShift,
    refresh,
  } = useScheduling({ businessId, scope: 'admin', autoFetch: true });

  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null);
  
  // Template state
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showApplyTemplateModal, setShowApplyTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null);

  // Notify parent when editing template state changes
  useEffect(() => {
    if (onEditingTemplateChange) {
      onEditingTemplateChange(!!editingTemplate);
    }
  }, [editingTemplate, onEditingTemplateChange]);
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);
  const [templateSourceSchedule, setTemplateSourceSchedule] = useState<Schedule | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    description: '',
    scheduleDuration: 7, // days - will be set from business config
    sourceType: 'blank' as 'blank' | 'schedule' | 'template',
    sourceTemplateId: '',
  });
  const [applyTemplateFormData, setApplyTemplateFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    timezone: 'America/New_York',
  });
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    timezone: 'America/New_York',
    specialNotes: '',
  });

  // Business config state
  const [businessConfig, setBusinessConfig] = useState<{
    defaultTimezone?: string;
    defaultScheduleDuration?: number;
    viewPreference?: 'weekly' | 'two_weeks' | 'monthly';
  } | null>(null);

  // Business data for settings
  const [business, setBusiness] = useState<{
    industry?: string;
    schedulingMode?: string;
    schedulingStrategy?: string;
  } | null>(null);
  
  const [shiftFormData, setShiftFormData] = useState({
    startTime: '',
    endTime: '',
    breakMinutes: 0,
    positionId: '',
    notes: '',
    employeePositionId: '',
  });

  // Filter state for schedule builder
  const [filters, setFilters] = useState<ScheduleFilters>({
    positions: [],
    users: [],
    stations: [],
    jobLocations: [],
  });

  // Build tools data
  const [buildEmployees, setBuildEmployees] = useState<Array<{ id: string; name: string; position?: string }>>([]);
  const [buildPositions, setBuildPositions] = useState<Array<{ id: string; title?: string; name?: string; defaultStartTime?: string | null; defaultEndTime?: string | null }>>([]);
  const [buildStations, setBuildStations] = useState<Array<{ id: string; name: string; stationType?: string; defaultStartTime?: string | null; defaultEndTime?: string | null }>>([]);
  const [layoutMode, setLayoutMode] = useState<'employee' | 'position' | 'station'>('employee');

  // Analytics time range filter
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Drag and drop state for DndContext
  const [draggingResource, setDraggingResource] = useState<{ type: 'employee' | 'position' | 'station'; label: string; detail?: string } | null>(null);
  const childDragHandlersRef = useRef<{
    onDragStart?: (event: DragStartEvent) => void;
    onDragEnd?: (event: DragEndEvent) => Promise<void>;
  }>({});
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current;
    // Let child handle its own drag logic first
    childDragHandlersRef.current.onDragStart?.(event);

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
      });
    } else if (activeData?.type === 'station' && activeData.station) {
      setDraggingResource({
        type: 'station',
        label: activeData.station.name,
        detail: activeData.station.stationType,
      });
    } else {
      setDraggingResource(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (childDragHandlersRef.current.onDragEnd) {
      await childDragHandlersRef.current.onDragEnd(event);
    }
    setDraggingResource(null);
  };

  // Load build tools data
  useEffect(() => {
    if (businessId && session?.accessToken && selectedSchedule) {
      loadBuildToolsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, session?.accessToken, selectedSchedule]);

  const loadBuildToolsData = async () => {
    if (!session?.accessToken) return;
    
    try {
      // Load employees
      const employeesResponse = await getBusinessEmployees(businessId, session.accessToken);
      if (employeesResponse.success) {
        setBuildEmployees(employeesResponse.data.map((ep: any) => ({
          id: ep.id,
          name: ep.user?.name || 'Unknown',
          position: ep.position?.title || ep.position?.name,
        })));
      }

      // Load positions
      const positionsResponse = await getPositions(businessId, session.accessToken);
      if (positionsResponse.success) {
        setBuildPositions(positionsResponse.data.map((p: any) => ({
          id: p.id,
          title: p.title || p.name,
          name: p.name,
          defaultStartTime: p.defaultStartTime || null,
          defaultEndTime: p.defaultEndTime || null,
        })));
      }

      // Load stations
      const stationsResponse = await getBusinessStations(businessId, session.accessToken);
      if (stationsResponse.stations) {
        setBuildStations(stationsResponse.stations
          .filter((s: any) => s.isActive)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            stationType: s.stationType,
            defaultStartTime: s.defaultStartTime || null,
            defaultEndTime: s.defaultEndTime || null,
          })));
      }
    } catch (err) {
      console.error('Failed to load build tools data:', err);
    }
  };

  const handleDeleteSchedule = useCallback(async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return;
    }
    const success = await removeSchedule(scheduleId);
    if (success && selectedSchedule?.id === scheduleId) {
      setSelectedSchedule(null);
    }
    await refresh();
  }, [removeSchedule, selectedSchedule, refresh]);

  // Listen for schedule trash drops from GlobalTrashBin
  useEffect(() => {
    const handleScheduleTrash = async (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string; scheduleId?: string; metadata?: { scheduleId?: string } }>;
      const itemData = customEvent.detail;
      if (!itemData) return;
      
      const scheduleId = itemData.scheduleId || itemData.metadata?.scheduleId || itemData.id;
      if (!scheduleId) return;
      
      // Verify this is a schedule from our business
      const schedule = schedules.find(s => s.id === scheduleId);
      if (schedule) {
        try {
          // Call the delete handler which includes confirmation
          if (confirm(`Are you sure you want to delete "${schedule.name}"? This action cannot be undone.`)) {
            await handleDeleteSchedule(scheduleId);
          }
        } catch (error) {
          console.error('Failed to delete schedule:', error);
        }
      }
    };

    window.addEventListener('scheduleTrashed', handleScheduleTrash);
    return () => {
      window.removeEventListener('scheduleTrashed', handleScheduleTrash);
    };
  }, [schedules, handleDeleteSchedule]);

  // Calculate stats
  const draftSchedules = schedules.filter(s => s.status === 'DRAFT').length;
  const publishedSchedules = schedules.filter(s => s.status === 'PUBLISHED').length;
  const openShifts = shifts.filter(s => s.status === 'OPEN').length;

  // Load business config on mount
  useEffect(() => {
    const loadBusinessConfig = async () => {
      try {
        const session = await getSession();
        if (!session?.accessToken) return;
        
        const response = await getBusiness(businessId, session.accessToken as string);
        if (response.success && response.data) {
          // Set business data
          setBusiness({
            industry: response.data.industry,
            schedulingMode: response.data.schedulingMode,
            schedulingStrategy: response.data.schedulingStrategy,
          });

          // Set business config
          if (response.data.schedulingConfig) {
            const config = response.data.schedulingConfig as Record<string, unknown>;
            setBusinessConfig({
              defaultTimezone: (config.defaultTimezone as string) || 'America/New_York',
              defaultScheduleDuration: (config.defaultScheduleDuration as number) || 7,
              viewPreference: (config.viewPreference as 'weekly' | 'two_weeks' | 'monthly') || 'weekly',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load business config:', err);
      }
    };

    if (businessId) {
      loadBusinessConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Load templates when templates view is active
  useEffect(() => {
    const loadTemplates = async () => {
      if (view !== 'templates' || !session?.accessToken) return;
      try {
        const templatesData = await getScheduleTemplates(businessId, session.accessToken);
        setTemplates(templatesData);
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    };
    loadTemplates();
  }, [view, businessId, session?.accessToken]);

  // Template handlers
  const handleCreateTemplate = async () => {
    if (!templateFormData.name || !session?.accessToken) {
      alert('Please fill in template name');
      return;
    }

    try {
      let sourceScheduleId: string | undefined;
      let templateData: Record<string, unknown> = { shiftPatterns: [] };

      if (templateFormData.sourceType === 'schedule' && templateSourceSchedule) {
        sourceScheduleId = templateSourceSchedule.id;
      } else if (templateFormData.sourceType === 'template' && templateFormData.sourceTemplateId) {
        // Clone from existing template
        const sourceTemplate = templates.find(t => t.id === templateFormData.sourceTemplateId);
        if (sourceTemplate) {
          templateData = sourceTemplate.templateData as Record<string, unknown>;
        }
      }

      // Convert duration to scheduleType string (store as days)
      const scheduleType = `${templateFormData.scheduleDuration}_DAYS`;

      await createScheduleTemplate(
        businessId,
        {
          name: templateFormData.name,
          description: templateFormData.description,
          scheduleType,
          sourceScheduleId,
          templateData: templateFormData.sourceType === 'blank' ? { shiftPatterns: [] } : undefined,
        },
        session.accessToken
      );
      setShowTemplateModal(false);
      setTemplateSourceSchedule(null);
      const defaultDuration = businessConfig?.defaultScheduleDuration || 7;
      setTemplateFormData({ 
        name: '', 
        description: '', 
        scheduleDuration: defaultDuration,
        sourceType: 'blank',
        sourceTemplateId: '',
      });
      // Reload templates
      const templatesData = await getScheduleTemplates(businessId, session.accessToken);
      setTemplates(templatesData);
    } catch (err) {
      console.error('Failed to create template:', err);
      alert(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    if (!session?.accessToken) return;

    try {
      await deleteScheduleTemplate(businessId, templateId, session.accessToken);
      // Reload templates
      const templatesData = await getScheduleTemplates(businessId, session.accessToken);
      setTemplates(templatesData);
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !applyTemplateFormData.name || !applyTemplateFormData.startDate || !applyTemplateFormData.endDate) {
      alert('Please fill in all required fields');
      return;
    }
    if (!session?.accessToken) return;

    try {
      await createNewSchedule({
        name: applyTemplateFormData.name,
        description: applyTemplateFormData.description,
        startDate: new Date(applyTemplateFormData.startDate).toISOString(),
        endDate: new Date(applyTemplateFormData.endDate).toISOString(),
        timezone: applyTemplateFormData.timezone,
        templateId: selectedTemplate.id,
      });
      setShowApplyTemplateModal(false);
      setSelectedTemplate(null);
      setApplyTemplateFormData({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        timezone: businessConfig?.defaultTimezone || 'America/New_York',
      });
      await refresh();
      // Switch to builder view to see the new schedule
      if (onViewChange) {
        onViewChange('builder');
      }
    } catch (err) {
      console.error('Failed to apply template:', err);
      alert(err instanceof Error ? err.message : 'Failed to create schedule from template');
    }
  };

  const handleOpenApplyTemplate = (template: ScheduleTemplate) => {
    setSelectedTemplate(template);
    
    // Parse schedule duration from template
    let durationDays = 7;
    if (template.scheduleType.includes('_DAYS')) {
      durationDays = parseInt(template.scheduleType.replace('_DAYS', ''), 10) || 7;
    } else if (template.scheduleType === 'WEEKLY') {
      durationDays = 7;
    } else if (template.scheduleType === 'BIWEEKLY') {
      durationDays = 14;
    } else if (template.scheduleType === 'MONTHLY') {
      durationDays = 30;
    }
    
    // Set default dates based on template duration
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + durationDays - 1);
    
    setApplyTemplateFormData({
      name: `${template.name} Schedule`,
      description: template.description || '',
      startDate: format(today, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      timezone: businessConfig?.defaultTimezone || 'America/New_York',
    });
    setShowApplyTemplateModal(true);
  };

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

  const handlePublishSchedule = async (scheduleId: string) => {
    await publishExistingSchedule(scheduleId);
    await refresh();
  };

  const handleSelectSchedule = async (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    await fetchShifts(schedule.id);
    
    // Dispatch event for GlobalHeaderTabs to pick up scheduleId
    window.dispatchEvent(new CustomEvent('scheduleSelected', {
      detail: { scheduleId: schedule.id }
    }));
  };

  // Map viewPreference to duration in days
  const getDurationFromViewPreference = (): number => {
    if (!businessConfig?.viewPreference) {
      return businessConfig?.defaultScheduleDuration || 7;
    }
    
    switch (businessConfig.viewPreference) {
      case 'weekly':
        return 7;
      case 'two_weeks':
        return 14;
      case 'monthly':
        return 30;
      default:
        return businessConfig.defaultScheduleDuration || 7;
    }
  };

  // Calculate the next schedule start date based on existing schedules
  const calculateNextScheduleDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (schedules.length === 0) {
      // No schedules exist, start from today
      return today;
    }
    
    // Find the latest schedule end date
    let latestEndDate = today;
    schedules.forEach(schedule => {
      if (schedule.endDate) {
        const endDate = parseISO(schedule.endDate);
        endDate.setHours(0, 0, 0, 0);
        if (endDate > latestEndDate) {
          latestEndDate = endDate;
        }
      }
    });
    
    // Next schedule starts the day after the latest end date
    const nextStartDate = new Date(latestEndDate);
    nextStartDate.setDate(latestEndDate.getDate() + 1);
    
    // If the next start date is in the past or today, use today
    return nextStartDate >= today ? nextStartDate : today;
  };

  // Get the schedule index for navigation
  const getScheduleIndex = () => {
    if (!selectedSchedule) return -1;
    return schedules.findIndex(s => s.id === selectedSchedule.id);
  };

  // Navigate to previous schedule
  const handlePreviousSchedule = async () => {
    const currentIndex = getScheduleIndex();
    if (currentIndex > 0) {
      const prevSchedule = schedules[currentIndex - 1];
      await handleSelectSchedule(prevSchedule);
    }
  };

  // Navigate to next schedule
  const handleNextSchedule = async () => {
    const currentIndex = getScheduleIndex();
    if (currentIndex < schedules.length - 1) {
      const nextSchedule = schedules[currentIndex + 1];
      await handleSelectSchedule(nextSchedule);
    }
  };

  // Build next schedule immediately (no modal)
  const handleBuildNextSchedule = async () => {
    const defaultTimezone = businessConfig?.defaultTimezone || 'America/New_York';
    const defaultDuration = getDurationFromViewPreference();
    const nextStartDate = calculateNextScheduleDate();
    
    const endDate = new Date(nextStartDate);
    endDate.setDate(nextStartDate.getDate() + defaultDuration - 1);
    
    // Generate schedule name based on dates
    const scheduleName = `Schedule - ${format(nextStartDate, 'MMM d')} to ${format(endDate, 'MMM d, yyyy')}`;
    
    try {
      const schedule = await createNewSchedule({
        name: scheduleName,
        description: '',
        startDate: nextStartDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: defaultTimezone,
      });
      
      if (schedule) {
        await handleSelectSchedule(schedule);
        await refresh();
      }
    } catch (err) {
      console.error('Failed to build next schedule:', err);
      alert(err instanceof Error ? err.message : 'Failed to create schedule');
    }
  };

  // Auto-select the most relevant schedule on load
  useEffect(() => {
    if (schedules.length > 0 && !selectedSchedule && !loading) {
      // Sort schedules by start date (most recent first)
      const sortedSchedules = [...schedules].sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        const dateA = parseISO(a.startDate).getTime();
        const dateB = parseISO(b.startDate).getTime();
        return dateB - dateA; // Most recent first
      });
      
      // Find the first schedule that hasn't ended yet, or use the most recent
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const activeSchedule = sortedSchedules.find(schedule => {
        if (!schedule.endDate) return false;
        const endDate = parseISO(schedule.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= today;
      });
      
      const scheduleToSelect = activeSchedule || sortedSchedules[0];
      handleSelectSchedule(scheduleToSelect);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules.length, loading]);

  const handleCreateSchedule = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      alert('Please fill in all required fields');
      return;
    }

    // Note: metadata will be handled by the API when we update it to support it
    // For now, we'll save the schedule and then update it with metadata if needed
    const schedule = await createNewSchedule({
      name: formData.name,
      description: formData.description,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      timezone: formData.timezone,
    });

    // Update schedule with metadata if special notes exist
    if (schedule && formData.specialNotes.trim()) {
      const metadata = { specialNotes: formData.specialNotes.trim() };
      await updateExistingSchedule(schedule.id, { metadata });
    }
    setShowCreateModal(false);
    setFormData({ 
      name: '', 
      description: '', 
      startDate: '', 
      endDate: '', 
      timezone: businessConfig?.defaultTimezone || 'America/New_York',
      specialNotes: '',
    });
    await refresh();
  };

  const handleOpenCreateModal = () => {
    // Set defaults from business config
    const defaultTimezone = businessConfig?.defaultTimezone || 'America/New_York';
    const defaultDuration = getDurationFromViewPreference();
    
    // Auto-calculate end date based on default duration
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + defaultDuration - 1);
    
    setFormData({
      name: '',
      description: '',
      startDate: format(today, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      timezone: defaultTimezone,
      specialNotes: '',
    });
    setShowCreateModal(true);
  };

  const handleEditSchedule = async () => {
    if (!selectedSchedule || !formData.name || !formData.startDate || !formData.endDate) {
      alert('Please fill in all required fields');
      return;
    }

    // Build metadata for special notes
    const metadata: Record<string, unknown> = {};
    if (formData.specialNotes.trim()) {
      metadata.specialNotes = formData.specialNotes.trim();
    }

    await updateExistingSchedule(selectedSchedule.id, {
      name: formData.name,
      description: formData.description,
      startDate: formData.startDate,
      endDate: formData.endDate,
      timezone: formData.timezone,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
    setShowEditModal(false);
    await refresh();
  };

  const handleOpenEditModal = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    // Extract special notes from metadata
    const specialNotes = schedule.metadata && typeof schedule.metadata === 'object' && 'specialNotes' in schedule.metadata
      ? String(schedule.metadata.specialNotes || '')
      : '';

    setFormData({
      name: schedule.name,
      description: schedule.description || '',
      startDate: format(parseISO(schedule.startDate), 'yyyy-MM-dd'),
      endDate: format(parseISO(schedule.endDate), 'yyyy-MM-dd'),
      timezone: schedule.timezone,
      specialNotes,
    });
    setShowEditModal(true);
  };

  const handleOpenShiftModal = (shift?: ScheduleShift) => {
    if (shift) {
      setEditingShift(shift);
      setShiftFormData({
        startTime: format(parseISO(shift.startTime), "yyyy-MM-dd'T'HH:mm"),
        endTime: format(parseISO(shift.endTime), "yyyy-MM-dd'T'HH:mm"),
        breakMinutes: shift.breakMinutes || 0,
        positionId: shift.positionId || '',
        notes: shift.notes || '',
        employeePositionId: shift.employeePositionId || '',
      });
    } else {
      setEditingShift(null);
      setShiftFormData({
        startTime: '',
        endTime: '',
        breakMinutes: 0,
        positionId: '',
        notes: '',
        employeePositionId: '',
      });
    }
    setShowShiftModal(true);
  };

  const handleSaveShift = async () => {
    if (!selectedSchedule || !shiftFormData.startTime || !shiftFormData.endTime) {
      alert('Please fill in start and end times');
      return;
    }
    if (editingShift) {
      await updateExistingShift(editingShift.id, {
        startTime: new Date(shiftFormData.startTime).toISOString(),
        endTime: new Date(shiftFormData.endTime).toISOString(),
        breakMinutes: shiftFormData.breakMinutes,
        positionId: shiftFormData.positionId || undefined,
        notes: shiftFormData.notes,
        employeePositionId: shiftFormData.employeePositionId || undefined,
      });
    } else {
      await createNewShift({
        scheduleId: selectedSchedule.id,
        title: shiftFormData.positionId ? `Shift - ${shiftFormData.positionId}` : 'Shift',
        startTime: new Date(shiftFormData.startTime).toISOString(),
        endTime: new Date(shiftFormData.endTime).toISOString(),
        breakMinutes: shiftFormData.breakMinutes,
        positionId: shiftFormData.positionId || undefined,
        notes: shiftFormData.notes,
        employeePositionId: shiftFormData.employeePositionId || undefined,
      });
    }
    setShowShiftModal(false);
    await fetchShifts(selectedSchedule.id);
    await refresh();
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) {
      return;
    }
    await removeShift(shiftId);
    if (selectedSchedule) {
      await fetchShifts(selectedSchedule.id);
    }
    await refresh();
  };

  // Helper function to render modals
  const renderModals = () => (
    <>
      {/* Create Schedule Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Schedule"
        size="large"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Schedule Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Week of Jan 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Start Date *
              </label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                End Date *
              </label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Timezone
            </label>
            <Input
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              placeholder={businessConfig?.defaultTimezone || 'America/New_York'}
            />
            <p className="text-xs text-gray-600 mt-1">
              Default: {businessConfig?.defaultTimezone || 'America/New_York'}. You can override for multi-location businesses.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Special Notes / Events (Week Schedule)
            </label>
            <Textarea
              value={formData.specialNotes}
              onChange={(e) => setFormData({ ...formData, specialNotes: e.target.value })}
              placeholder="e.g., Holiday schedule, special events, important reminders for this week"
              rows={3}
            />
            <p className="text-xs text-gray-600 mt-1">
              Notes about holidays, events, or special information for this schedule period
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSchedule}>
              Create Schedule
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Schedule Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Schedule"
        size="large"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Schedule Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Week of Jan 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Start Date *
              </label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                End Date *
              </label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Timezone
            </label>
            <Input
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              placeholder={businessConfig?.defaultTimezone || 'America/New_York'}
            />
            <p className="text-xs text-gray-600 mt-1">
              Default: {businessConfig?.defaultTimezone || 'America/New_York'}. You can override for multi-location businesses.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Special Notes / Events (Week Schedule)
            </label>
            <Textarea
              value={formData.specialNotes}
              onChange={(e) => setFormData({ ...formData, specialNotes: e.target.value })}
              placeholder="e.g., Holiday schedule, special events, important reminders for this week"
              rows={3}
            />
            <p className="text-xs text-gray-600 mt-1">
              Notes about holidays, events, or special information for this schedule period
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSchedule}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit Shift Modal */}
      <Modal
        open={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        title={editingShift ? 'Edit Shift' : 'Add Shift'}
        size="large"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Start Time *
              </label>
              <Input
                type="datetime-local"
                value={shiftFormData.startTime}
                onChange={(e) => setShiftFormData({ ...shiftFormData, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                End Time *
              </label>
              <Input
                type="datetime-local"
                value={shiftFormData.endTime}
                onChange={(e) => setShiftFormData({ ...shiftFormData, endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Break Minutes
              </label>
              <Input
                type="number"
                value={shiftFormData.breakMinutes}
                onChange={(e) => setShiftFormData({ ...shiftFormData, breakMinutes: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Position ID
              </label>
              <Input
                value={shiftFormData.positionId}
                onChange={(e) => setShiftFormData({ ...shiftFormData, positionId: e.target.value })}
                placeholder="Optional position identifier"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Notes
            </label>
            <Textarea
              value={shiftFormData.notes}
              onChange={(e) => setShiftFormData({ ...shiftFormData, notes: e.target.value })}
              placeholder="Optional notes"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowShiftModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveShift}>
              {editingShift ? 'Save Changes' : 'Add Shift'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Template Modal */}
      <Modal
        open={showTemplateModal}
        onClose={() => {
          setShowTemplateModal(false);
          setTemplateSourceSchedule(null);
          const defaultDuration = businessConfig?.defaultScheduleDuration || 7;
          setTemplateFormData({ 
            name: '', 
            description: '', 
            scheduleDuration: defaultDuration,
            sourceType: 'blank',
            sourceTemplateId: '',
          });
        }}
        title="Create Template"
        size="large"
      >
        <div className="space-y-6">
          {/* Source Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Template Source *
            </label>
            <div className="space-y-3">
              {/* Blank Template Option */}
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="templateSource"
                  value="blank"
                  checked={templateFormData.sourceType === 'blank'}
                  onChange={(e) => {
                    setTemplateFormData({ 
                      ...templateFormData, 
                      sourceType: 'blank',
                      sourceTemplateId: '',
                    });
                    setTemplateSourceSchedule(null);
                  }}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Blank Template</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Start with an empty template and build shift patterns using positions and stations
                  </div>
                </div>
              </label>

              {/* Existing Templates Option */}
              {templates.length > 0 && (
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="templateSource"
                    value="template"
                    checked={templateFormData.sourceType === 'template'}
                    onChange={(e) => {
                      setTemplateFormData({ 
                        ...templateFormData, 
                        sourceType: 'template',
                      });
                      setTemplateSourceSchedule(null);
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Copy from Existing Template</div>
                    <div className="text-sm text-gray-600 mt-1 mb-2">
                      Select an existing template to copy
                    </div>
                    {templateFormData.sourceType === 'template' && (
                      <select
                        value={templateFormData.sourceTemplateId}
                        onChange={(e) => setTemplateFormData({ 
                          ...templateFormData, 
                          sourceTemplateId: e.target.value 
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">Select a template...</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.scheduleType})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              )}

              {/* Published Schedule Option */}
              {schedules.filter((s: Schedule) => s.status === 'PUBLISHED').length > 0 && (
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="templateSource"
                    value="schedule"
                    checked={templateFormData.sourceType === 'schedule'}
                    onChange={(e) => {
                      setTemplateFormData({ 
                        ...templateFormData, 
                        sourceType: 'schedule',
                        sourceTemplateId: '',
                      });
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">From Published Schedule</div>
                    <div className="text-sm text-gray-600 mt-1 mb-2">
                      Create a template from a published schedule
                    </div>
                    {templateFormData.sourceType === 'schedule' && (
                      <select
                        value={templateSourceSchedule?.id || ''}
                        onChange={(e) => {
                          const schedule = schedules.find((s: Schedule) => s.id === e.target.value && s.status === 'PUBLISHED');
                          setTemplateSourceSchedule(schedule || null);
                          if (schedule) {
                            setTemplateFormData({ 
                              ...templateFormData, 
                              name: schedule.name ? `${schedule.name} Template` : '',
                              description: schedule.description || '',
                            });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">Select a published schedule...</option>
                        {schedules.filter((s: Schedule) => s.status === 'PUBLISHED').map((schedule: Schedule) => (
                          <option key={schedule.id} value={schedule.id}>
                            {schedule.name} ({schedule.shifts?.length || 0} shifts)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Template Details */}
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Template Name *
              </label>
              <Input
                value={templateFormData.name}
                onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                placeholder="e.g., Weekly Schedule Template"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Description
              </label>
              <Textarea
                value={templateFormData.description}
                onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Schedule Duration (days) *
              </label>
              <Input
                type="number"
                min="1"
                max="90"
                value={templateFormData.scheduleDuration.toString()}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 90) {
                    setTemplateFormData({ ...templateFormData, scheduleDuration: val });
                  }
                }}
                placeholder="7"
              />
              <p className="text-xs text-gray-600 mt-1">
                Number of days for this schedule cycle. Default: {businessConfig?.defaultScheduleDuration || 7} days (from your settings)
                {businessConfig?.viewPreference && (
                  <span className="ml-1">
                    • View preference: {businessConfig.viewPreference === 'weekly' ? 'Weekly' : businessConfig.viewPreference === 'two_weeks' ? 'Bi-weekly' : 'Monthly'}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowTemplateModal(false);
                setTemplateSourceSchedule(null);
                const defaultDuration = businessConfig?.defaultScheduleDuration || 7;
                setTemplateFormData({ 
                  name: '', 
                  description: '', 
                  scheduleDuration: defaultDuration,
                  sourceType: 'blank',
                  sourceTemplateId: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTemplate}
              disabled={
                !templateFormData.name || 
                (templateFormData.sourceType === 'template' && !templateFormData.sourceTemplateId) ||
                (templateFormData.sourceType === 'schedule' && !templateSourceSchedule)
              }
            >
              Create Template
            </Button>
          </div>
        </div>
      </Modal>

      {/* Apply Template Modal */}
      <Modal
        open={showApplyTemplateModal}
        onClose={() => {
          setShowApplyTemplateModal(false);
          setSelectedTemplate(null);
          setApplyTemplateFormData({
            name: '',
            description: '',
            startDate: '',
            endDate: '',
            timezone: businessConfig?.defaultTimezone || 'America/New_York',
          });
        }}
        title="Create Schedule from Template"
        size="large"
      >
        <div className="space-y-4">
          {selectedTemplate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-blue-900">Template:</p>
              <p className="text-sm text-blue-700">{selectedTemplate.name}</p>
              {selectedTemplate.description && (
                <p className="text-xs text-blue-600 mt-1">{selectedTemplate.description}</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Schedule Name *
            </label>
            <Input
              value={applyTemplateFormData.name}
              onChange={(e) => setApplyTemplateFormData({ ...applyTemplateFormData, name: e.target.value })}
              placeholder="e.g., Week of January 1st"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Description
            </label>
            <Textarea
              value={applyTemplateFormData.description}
              onChange={(e) => setApplyTemplateFormData({ ...applyTemplateFormData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Start Date *
              </label>
              <Input
                type="date"
                value={applyTemplateFormData.startDate}
                onChange={(e) => {
                  const startDate = e.target.value;
                  if (startDate && selectedTemplate) {
                    // Calculate end date based on template duration
                    let durationDays = 7;
                    if (selectedTemplate.scheduleType.includes('_DAYS')) {
                      durationDays = parseInt(selectedTemplate.scheduleType.replace('_DAYS', ''), 10) || 7;
                    } else if (selectedTemplate.scheduleType === 'WEEKLY') {
                      durationDays = 7;
                    } else if (selectedTemplate.scheduleType === 'BIWEEKLY') {
                      durationDays = 14;
                    } else if (selectedTemplate.scheduleType === 'MONTHLY') {
                      durationDays = 30;
                    }
                    const endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + durationDays - 1);
                    setApplyTemplateFormData({
                      ...applyTemplateFormData,
                      startDate,
                      endDate: format(endDate, 'yyyy-MM-dd'),
                    });
                  } else {
                    setApplyTemplateFormData({ ...applyTemplateFormData, startDate });
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                End Date *
              </label>
              <Input
                type="date"
                value={applyTemplateFormData.endDate}
                onChange={(e) => setApplyTemplateFormData({ ...applyTemplateFormData, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Timezone
            </label>
            <select
              value={applyTemplateFormData.timezone}
              onChange={(e) => setApplyTemplateFormData({ ...applyTemplateFormData, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowApplyTemplateModal(false);
                setSelectedTemplate(null);
                setApplyTemplateFormData({
                  name: '',
                  description: '',
                  startDate: '',
                  endDate: '',
                  timezone: businessConfig?.defaultTimezone || 'America/New_York',
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={!applyTemplateFormData.name || !applyTemplateFormData.startDate || !applyTemplateFormData.endDate}
            >
              Create Schedule
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );

  if (loading && schedules.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600">Loading schedules...</p>
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

  // Schedule Builder View
  if (view === 'builder') {
    const scheduleIndex = getScheduleIndex();
    const canNavigatePrevious = scheduleIndex > 0;
    const canNavigateNext = scheduleIndex >= 0 && scheduleIndex < schedules.length - 1;
    
    // If a schedule is selected, show visual builder with builder sidebar
    if (selectedSchedule && selectedSchedule.id) {
      const scheduleShiftsForSidebar = shifts.filter(s => s.scheduleId === selectedSchedule.id);
      
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="h-full flex">
            {/* Schedule Builder Sidebar */}
            <ScheduleBuilderSidebar
              scheduleId={selectedSchedule.id}
              businessId={businessId}
              scheduleShifts={scheduleShiftsForSidebar}
              onBack={() => {
                setSelectedSchedule(null);
                if (onViewChange) {
                  onViewChange('dashboard');
                }
              }}
              onPublish={async () => {
                await refresh();
              }}
              onFiltersChange={setFilters}
              employees={buildEmployees}
              positions={buildPositions}
              stations={buildStations}
              layoutMode={layoutMode}
              onBuildToolsRefresh={loadBuildToolsData}
            />

            {/* Main Builder Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header with Navigation and Build Next Button */}
            <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Schedule Builder</h2>
                
                {/* Navigation Controls */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePreviousSchedule}
                    disabled={!canNavigatePrevious}
                    className={`p-2 rounded-lg border ${
                      canNavigatePrevious
                        ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Previous schedule"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="px-3 py-1 text-sm text-gray-700 min-w-[200px] text-center">
                    {selectedSchedule.name}
                  </div>
                  
                  <button
                    onClick={handleNextSchedule}
                    disabled={!canNavigateNext}
                    className={`p-2 rounded-lg border ${
                      canNavigateNext
                        ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Next schedule"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  
                  {/* Delete Schedule Button */}
                  <button
                    onClick={() => handleDeleteSchedule(selectedSchedule.id)}
                    className="p-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors"
                    title="Delete schedule"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  
                  {/* Schedule selector dropdown */}
                  {schedules.length > 1 && (
                    <select
                      value={selectedSchedule.id}
                      onChange={(e) => {
                        const schedule = schedules.find(s => s.id === e.target.value);
                        if (schedule) {
                          handleSelectSchedule(schedule);
                        }
                      }}
                      className="ml-4 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      {schedules.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              
              {/* Build Next Schedule Button */}
              <Button 
                onClick={handleBuildNextSchedule}
                className="flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Build Next Schedule
              </Button>
            </div>

            <ScheduleBuilderVisual
              scheduleId={selectedSchedule.id}
              businessId={businessId}
              filters={filters}
              onSave={async () => {
                await refresh();
              }}
              onCancel={() => setSelectedSchedule(null)}
              registerDragHandlers={(handlers) => {
                childDragHandlersRef.current = handlers;
              }}
            />
            {/* Modals */}
            {renderModals()}
          </div>
        </div>

        {/* Drag Overlay for sidebar resources */}
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
      </DndContext>
      );
    }

    // Enhanced builder view - show visual builder with schedule selection/creation
    return (
      <div className="h-full flex flex-col">
        {/* Header with Schedule Selection and Create Button */}
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Schedule Builder</h2>
            {schedules.length > 0 && (
              <select
                value={(selectedSchedule as Schedule | null)?.id || ''}
                onChange={(e) => {
                  const schedule = schedules.find(s => s.id === e.target.value);
                  if (schedule) {
                    handleSelectSchedule(schedule);
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option key="empty" value="">Select a schedule...</option>
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            )}
          </div>
          <Button 
            onClick={() => {
              const today = new Date();
              const nextWeek = new Date(today);
              nextWeek.setDate(nextWeek.getDate() + 7);
              // handleOpenCreateModal will set the form data correctly
              handleBuildNextSchedule();
            }} 
            className="flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Build Next Schedule
          </Button>
        </div>

        {/* Visual Builder Area - Show empty state or builder */}
        {schedules.length === 0 ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
            <Card className="p-8 max-w-md text-center">
              <Calendar className="w-16 h-16 text-blue-500 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Schedule Builder</h3>
              <p className="text-gray-600 mb-6">
                Create your first schedule to start using the visual drag-and-drop builder with AI-powered scheduling assistance.
              </p>
              <Button 
                onClick={() => {
                  const today = new Date();
                  const nextWeek = new Date(today);
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  // handleOpenCreateModal will set the form data correctly
                  handleBuildNextSchedule();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Build Next Schedule
              </Button>
            </Card>
          </div>
        ) : (
          <div className="flex-1 bg-gray-50 p-6">
            <Card className="h-full p-6">
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Schedule</h3>
                <p className="text-gray-600 mb-4">
                  Choose a schedule from the dropdown above to start building with the visual drag-and-drop interface.
                </p>
                <p className="text-sm text-gray-500">
                  Features: Drag-and-drop shifts, station/job function assignments, AI-powered scheduling suggestions
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Modals */}
        {renderModals()}
      </div>
    );
  }

  // Templates View
  if (view === 'templates') {
    // Get published schedules that can be used as templates
    const publishedSchedulesForTemplates = schedules.filter(s => s.status === 'PUBLISHED');

    // If editing a template, show the template builder
    if (editingTemplate) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Template Builder: {editingTemplate.name}</h2>
              <p className="text-sm text-gray-600">Build shift patterns using positions and stations</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  // Save is handled by TemplateBuilderVisual's onSave
                  setEditingTemplate(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <TemplateBuilderVisual
              template={editingTemplate}
              businessId={businessId}
              onSave={async () => {
                // Reload templates
                if (session?.accessToken) {
                  const templatesData = await getScheduleTemplates(businessId, session.accessToken);
                  setTemplates(templatesData);
                  // Update editingTemplate with latest data
                  const updated = templatesData.find(t => t.id === editingTemplate.id);
                  if (updated) setEditingTemplate(updated);
                }
              }}
              onCancel={() => setEditingTemplate(null)}
            />
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="h-full overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Schedule Templates</h2>
            <p className="text-gray-600 mt-1">Create reusable templates from schedules or build from scratch using positions and stations</p>
          </div>
          <Button
            onClick={() => {
              setShowTemplateModal(true);
              const defaultDuration = businessConfig?.defaultScheduleDuration || 7;
              setTemplateFormData({ 
                name: '', 
                description: '', 
                scheduleDuration: defaultDuration,
                sourceType: 'blank',
                sourceTemplateId: '',
              });
              setTemplateSourceSchedule(null);
            }}
            className="flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Existing Templates */}
        {templates.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Existing Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-gray-900">{template.name}</h4>
                      {template.description && (
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          {(() => {
                            // Parse scheduleType - could be "7_DAYS", "14_DAYS" or legacy "WEEKLY", "BIWEEKLY", "MONTHLY"
                            if (template.scheduleType.includes('_DAYS')) {
                              const days = template.scheduleType.replace('_DAYS', '');
                              return `${days} day${days !== '1' ? 's' : ''}`;
                            }
                            // Legacy format
                            return template.scheduleType === 'WEEKLY' ? '7 days' : 
                                   template.scheduleType === 'BIWEEKLY' ? '14 days' : 
                                   template.scheduleType === 'MONTHLY' ? '30 days' : 
                                   template.scheduleType;
                          })()}
                        </span>
                        {!template.isActive && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {template.templateData && typeof template.templateData === 'object' && 'shiftPatterns' in template.templateData && Array.isArray(template.templateData.shiftPatterns) && (
                        <p className="text-xs text-gray-500 mt-2">
                          {template.templateData.shiftPatterns.length} shift pattern{template.templateData.shiftPatterns.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingTemplate(template)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        Build
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenApplyTemplate(template)}
                        className="flex items-center gap-1"
                      >
                        <Calendar className="h-3 w-3" />
                        Apply
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Published Schedules Section */}
        {publishedSchedulesForTemplates.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Template from Published Schedule</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select a published schedule to create a reusable template
            </p>
          </div>
        )}

        {publishedSchedulesForTemplates.length === 0 && templates.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Templates Yet</h3>
            <p className="text-gray-600 mb-4">
              Create templates from published schedules or build from scratch using positions and stations
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowTemplateModal(true);
                  const defaultDuration = businessConfig?.defaultScheduleDuration || 7;
                  setTemplateFormData({ 
                    name: '', 
                    description: '', 
                    scheduleDuration: defaultDuration,
                    sourceType: 'blank',
                    sourceTemplateId: '',
                  });
                }}
              >
                Create Template
              </Button>
            </div>
            {publishedSchedulesForTemplates.length === 0 && (
              <p className="text-sm text-gray-500 mt-4">
                Publish a schedule first to create a template from it
              </p>
            )}
          </Card>
        ) : publishedSchedulesForTemplates.length > 0 ? (
          <div className="space-y-4">
            {publishedSchedulesForTemplates.map((schedule) => (
              <div
                key={schedule.id}
                draggable
                onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    id: schedule.id,
                    name: schedule.name,
                    type: 'module',
                    moduleId: 'scheduling',
                    moduleName: 'Scheduling',
                    metadata: {
                      scheduleId: schedule.id,
                      businessId: businessId,
                      status: schedule.status,
                    },
                  }));
                  e.currentTarget.style.opacity = '0.5';
                }}
                onDragEnd={(e: React.DragEvent<HTMLDivElement>) => {
                  e.currentTarget.style.opacity = '1';
                }}
                className="cursor-move"
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{schedule.name}</h3>
                      {schedule.description && (
                        <p className="text-sm text-gray-600 mt-1">{schedule.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-xs text-gray-500">
                          {safeFormatDate(schedule.startDate, 'MMM d', '--')} - {safeFormatDate(schedule.endDate, 'MMM d, yyyy', '--')}
                        </p>
                        {schedule.shifts && schedule.shifts.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {schedule.shifts.length} shift{schedule.shifts.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setShowTemplateModal(true);
                          setTemplateSourceSchedule(schedule);
                          const defaultDuration = businessConfig?.defaultScheduleDuration || 7;
                          setTemplateFormData({ 
                            name: `${schedule.name} Template`, 
                            description: schedule.description || '', 
                            scheduleDuration: defaultDuration,
                            sourceType: 'schedule',
                            sourceTemplateId: '',
                          });
                        }}
                      >
                        Create Template
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSchedule(schedule.id);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        ) : null}
        </div>
        {/* Modals */}
        {renderModals()}
      </>
    );
  }

  // Settings View
  if (view === 'settings') {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Scheduling Settings</h2>
          <p className="text-gray-600 mt-1">Configure scheduling preferences, stations, and positions</p>
        </div>
        {session?.accessToken && (
          <SchedulingConfiguration
            businessId={businessId}
            businessIndustry={business?.industry}
            currentMode={business?.schedulingMode as string | undefined}
            currentStrategy={business?.schedulingStrategy as string | undefined}
            token={session.accessToken}
            canManage={true}
            onSave={async () => {
              // Reload business data after saving
              const updatedSession = await getSession();
              if (updatedSession?.accessToken) {
                const response = await getBusiness(businessId, updatedSession.accessToken as string);
                if (response.success && response.data) {
                  setBusiness({
                    industry: response.data.industry,
                    schedulingMode: response.data.schedulingMode,
                    schedulingStrategy: response.data.schedulingStrategy,
                  });
                  if (response.data.schedulingConfig) {
                    const config = response.data.schedulingConfig as Record<string, unknown>;
                    setBusinessConfig({
                      defaultTimezone: (config.defaultTimezone as string) || 'America/New_York',
                      defaultScheduleDuration: (config.defaultScheduleDuration as number) || 7,
                      viewPreference: (config.viewPreference as 'weekly' | 'two_weeks' | 'monthly') || 'weekly',
                    });
                  }
                }
              }
              await refresh();
            }}
          />
        )}
      </div>
    );
  }

  // Analytics View
  if (view === 'analytics') {
    // Calculate date range based on filter
    const now = new Date();
    let dateRangeStart: Date | null = null;
    let dateRangeEnd: Date = endOfDay(now);
    
    switch (analyticsTimeRange) {
      case '7d':
        dateRangeStart = startOfDay(subDays(now, 7));
        break;
      case '30d':
        dateRangeStart = startOfDay(subDays(now, 30));
        break;
      case '90d':
        dateRangeStart = startOfDay(subDays(now, 90));
        break;
      case 'all':
        dateRangeStart = null; // No filter
        break;
    }

    // Filter shifts by date range
    let allShifts = schedules.flatMap(s => s.shifts || []);
    if (dateRangeStart) {
      allShifts = allShifts.filter(shift => {
        if (!shift.startTime) return false;
        const shiftDate = new Date(shift.startTime);
        return shiftDate >= dateRangeStart! && shiftDate <= dateRangeEnd;
      });
    }

    // Filter schedules by date range
    let filteredSchedules = schedules;
    if (dateRangeStart) {
      filteredSchedules = schedules.filter(schedule => {
        const scheduleStart = new Date(schedule.startDate);
        const scheduleEnd = new Date(schedule.endDate);
        return (scheduleStart <= dateRangeEnd && scheduleEnd >= dateRangeStart!);
      });
    }

    // Assigned shifts: have an employeePositionId (regardless of status)
    // The database uses SCHEDULED status for assigned shifts, but we check employeePositionId for accuracy
    const assignedShifts = allShifts.filter(s => s.employeePositionId != null);
    // Covered/Swapped: shifts that are FILLED, COVERED, or SWAPPED
    const coveredShifts = allShifts.filter(s => s.status === 'FILLED' || s.status === 'COVERED' || s.status === 'SWAPPED');
    // Open shifts: no employee assigned (employeePositionId is null) or explicitly marked as OPEN
    const openShifts = allShifts.filter(s => s.employeePositionId == null || s.status === 'OPEN').length;
    const publishedSchedules = filteredSchedules.filter(s => s.status === 'PUBLISHED').length;
    const draftSchedules = filteredSchedules.filter(s => s.status === 'DRAFT').length;
    
    // Calculate total hours
    const totalHours = allShifts.reduce((total, shift) => {
      if (!shift.startTime || !shift.endTime) return total;
      const start = new Date(shift.startTime);
      const end = new Date(shift.endTime);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return total + hours - ((shift.breakMinutes || 0) / 60);
    }, 0);

    // Calculate coverage (shifts with employees assigned)
    const coverageRate = allShifts.length > 0 
      ? (assignedShifts.length / allShifts.length) * 100 
      : 0;

    // Calculate average hours per employee
    const uniqueEmployees = new Set(
      assignedShifts
        .filter(s => s.employeePosition)
        .map(s => s.employeePosition!.id)
    );
    const avgHoursPerEmployee = uniqueEmployees.size > 0 
      ? totalHours / uniqueEmployees.size 
      : 0;

    // This week's metrics
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const thisWeekShifts = allShifts.filter(shift => {
      if (!shift.startTime) return false;
      const shiftDate = new Date(shift.startTime);
      return shiftDate >= weekStart && shiftDate < weekEnd;
    });
    const thisWeekHours = thisWeekShifts.reduce((total, shift) => {
      if (!shift.startTime || !shift.endTime) return total;
      const start = new Date(shift.startTime);
      const end = new Date(shift.endTime);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return total + hours - ((shift.breakMinutes || 0) / 60);
    }, 0);

    // Export functionality
    const handleExportAnalytics = () => {
      const analyticsData = {
        timeRange: analyticsTimeRange,
        dateRange: dateRangeStart ? `${format(dateRangeStart, 'yyyy-MM-dd')} to ${format(dateRangeEnd, 'yyyy-MM-dd')}` : 'All time',
        metrics: {
          totalHours: totalHours.toFixed(2),
          thisWeekHours: thisWeekHours.toFixed(2),
          coverageRate: coverageRate.toFixed(1),
          avgHoursPerEmployee: avgHoursPerEmployee.toFixed(1),
        },
        shifts: {
          total: allShifts.length,
          assigned: assignedShifts.length,
          open: openShifts,
          covered: coveredShifts.length,
        },
        schedules: {
          total: filteredSchedules.length,
          published: publishedSchedules,
          draft: draftSchedules,
        },
        employees: {
          uniqueCount: uniqueEmployees.size,
        },
        generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      };

      const csv = [
        ['Scheduling Analytics Report'],
        ['Time Range', analyticsData.dateRange],
        ['Generated At', analyticsData.generatedAt],
        [],
        ['Metrics'],
        ['Total Hours', analyticsData.metrics.totalHours],
        ['This Week Hours', analyticsData.metrics.thisWeekHours],
        ['Coverage Rate (%)', analyticsData.metrics.coverageRate],
        ['Avg Hours/Employee', analyticsData.metrics.avgHoursPerEmployee],
        [],
        ['Shifts'],
        ['Total', analyticsData.shifts.total],
        ['Assigned', analyticsData.shifts.assigned],
        ['Open', analyticsData.shifts.open],
        ['Covered', analyticsData.shifts.covered],
        [],
        ['Schedules'],
        ['Total', analyticsData.schedules.total],
        ['Published', analyticsData.schedules.published],
        ['Draft', analyticsData.schedules.draft],
        [],
        ['Employees'],
        ['Unique Count', analyticsData.employees.uniqueCount],
      ]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scheduling-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    };

    return (
      <>
        <div className="h-full overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
            <h2 className="text-2xl font-semibold text-gray-900">Labor Analytics</h2>
            <p className="text-gray-600 mt-1">Workforce planning insights and metrics</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Time Range Filter */}
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={analyticsTimeRange}
                  onChange={(e) => setAnalyticsTimeRange(e.target.value as '7d' | '30d' | '90d' | 'all')}
                  className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              {/* Export Button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportAnalytics}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Hours</p>
                <p className="text-2xl font-semibold text-gray-900">{totalHours.toFixed(1)}</p>
                <p className="text-xs text-gray-500 mt-1">All time</p>
              </div>
              <div className="flex-shrink-0">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">This Week</p>
                <p className="text-2xl font-semibold text-gray-900">{thisWeekHours.toFixed(1)}</p>
                <p className="text-xs text-gray-500 mt-1">Hours scheduled</p>
              </div>
              <div className="flex-shrink-0">
                <Calendar className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Coverage Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{coverageRate.toFixed(0)}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {assignedShifts.length} / {allShifts.length} shifts
                </p>
              </div>
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Avg Hours/Employee</p>
                <p className="text-2xl font-semibold text-gray-900">{avgHoursPerEmployee.toFixed(1)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {uniqueEmployees.size} employee{uniqueEmployees.size !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Additional Metrics */}
        {loading && (
          <div className="mb-6">
            <Card className="p-6">
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Loading analytics...</span>
              </div>
            </Card>
          </div>
        )}

        {error && (
          <div className="mb-6">
            <Card className="p-4 border-red-200 bg-red-50">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Error loading analytics: {error}</span>
              </div>
            </Card>
          </div>
        )}

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Shift Status Breakdown
            </h3>
            <div className="space-y-4">
              {allShifts.length > 0 ? (
                <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-700">Assigned</span>
                </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(assignedShifts.length / allShifts.length) * 100}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold text-gray-900 w-12 text-right">{assignedShifts.length}</span>
                      </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-gray-700">Open</span>
                </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-yellow-500 h-2 rounded-full"
                            style={{ width: `${(openShifts / allShifts.length) * 100}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold text-gray-900 w-12 text-right">{openShifts}</span>
                      </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-700">Covered/Swapped</span>
                </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${(coveredShifts.length / allShifts.length) * 100}%` }}
                          ></div>
              </div>
                        <span className="font-semibold text-gray-900 w-12 text-right">{coveredShifts.length}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                        <span className="text-sm font-medium text-gray-900">Total</span>
                </div>
                <span className="font-semibold text-gray-900">{allShifts.length}</span>
              </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>No shifts found for selected time range</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Schedule Overview
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Total Schedules</span>
                <span className="font-semibold text-gray-900">{filteredSchedules.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Published</span>
                <span className="font-semibold text-green-600">{publishedSchedules}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Draft</span>
                <span className="font-semibold text-yellow-600">{draftSchedules}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-900">Total Shifts</span>
                <span className="font-semibold text-gray-900">{allShifts.length}</span>
              </div>
            </div>
          </Card>
        </div>
        </div>
        {/* Modals */}
        {renderModals()}
      </>
    );
  }

  // Fallback
  return (
    <>
      <div className="p-6 text-center text-gray-500">
        View not implemented
      </div>
      {renderModals()}
    </>
  );
}
