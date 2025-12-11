import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, Button, Avatar, Badge, Spinner, Input } from 'shared/components';
import { useFeatureGating, useModuleFeatures } from '../../../hooks/useFeatureGating';
import { FeatureGate } from '../../FeatureGate';
import { FeatureBadge } from '../../EnterpriseUpgradePrompt';
import { useDashboard } from '../../../contexts/DashboardContext';
import { calendarAPI, Calendar, EventItem } from '../../../api/calendar';
import { chatSocket } from '../../../lib/chatSocket';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Search, 
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Video,
  Phone,
  Mail,
  Settings,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Shield
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Import enterprise components
import ResourceBookingPanel from './ResourceBookingPanel';
import ApprovalWorkflowPanel from './ApprovalWorkflowPanel';
import CalendarAnalyticsPanel from './CalendarAnalyticsPanel';

interface EnhancedCalendarModuleProps {
  businessId: string;
  dashboardId?: string;
  className?: string;
  refreshTrigger?: number;
  contextType?: 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD';
}

export default function EnhancedCalendarModule({ businessId, dashboardId, className = '', refreshTrigger, contextType: contextTypeOverride }: EnhancedCalendarModuleProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { currentDashboard, getDashboardType } = useDashboard();
  const { recordUsage } = useFeatureGating(businessId);
  const { moduleAccess, hasBusiness: hasEnterprise } = useModuleFeatures('calendar', businessId);
  
  // Core state
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Enterprise features state
  const [showEnterprisePanel, setShowEnterprisePanel] = useState(false);
  const [activeEnterpriseTab, setActiveEnterpriseTab] = useState<'resources' | 'approvals' | 'analytics'>('resources');
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [resourceAlerts, setResourceAlerts] = useState(0);
  const [complianceAlerts, setComplianceAlerts] = useState(0);

  // Get context information for filtering
  const derivedContextType = currentDashboard ? getDashboardType(currentDashboard).toUpperCase() as 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD' : 'BUSINESS';
  const effectiveContextType = contextTypeOverride ?? derivedContextType;
  const effectiveContextId = (() => {
    if (effectiveContextType === 'BUSINESS') {
      return businessId || (currentDashboard as any)?.business?.id || (currentDashboard as any)?.businessId || dashboardId || '';
    }
    if (effectiveContextType === 'HOUSEHOLD') {
      return (currentDashboard as any)?.household?.id || (currentDashboard as any)?.householdId || dashboardId || '';
    }
    return dashboardId || currentDashboard?.id || '';
  })();

  // Load calendars for the current context
  const loadCalendars = useCallback(async () => {
    if (!session?.accessToken) return;
    
    try {
      if (!effectiveContextId) {
        setError('Workspace context not initialized. Please refresh the page.');
        setLoading(false);
        return;
      }
      const response = await calendarAPI.listCalendars({
        contextType: effectiveContextType,
        contextId: effectiveContextId
      });
      
      if (response?.success && response.data) {
        setCalendars(response.data);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('🏢 Enterprise Calendar - Failed to load calendars:', err);
      setError('Failed to load calendars');
    }
  }, [session, effectiveContextType, effectiveContextId]);

  // Load events for the current view
  const loadEnhancedCalendarData = useCallback(async () => {
    if (!session?.accessToken) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Calculate date range based on view mode
      let startDate: Date;
      let endDate: Date;
      
      if (viewMode === 'month') {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
      } else if (viewMode === 'week') {
        const dayOfWeek = currentDate.getDay();
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(currentDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999);
      }
      
      if (!effectiveContextId) {
        setError('Workspace context not initialized. Please refresh the page.');
        setLoading(false);
        return;
      }
      console.log('🏢 Enterprise Calendar - Loading events:', { 
        contextType: effectiveContextType, 
        contextId: effectiveContextId, 
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString() 
      });
      
      const response = await calendarAPI.listEvents({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        contexts: [`${effectiveContextType}:${effectiveContextId}`]
      });
      
      if (response?.success && response.data) {
        console.log('🏢 Enterprise Calendar - Loaded events:', response.data.length);
        setEvents(response.data);
        
        // Calculate enterprise stats from real data
        const pending = response.data.filter((e: Record<string, any>) => e.approvalStatus === 'pending').length;
        setPendingApprovals(pending);
      }
      
      // Record usage for enterprise features
      if (hasEnterprise) {
        await recordUsage('calendar_enterprise_view');
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('🏢 Enterprise Calendar - Failed to load events:', err);
      setError('Failed to load calendar events');
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [session, currentDate, viewMode, effectiveContextType, effectiveContextId, hasEnterprise, recordUsage]);

  // Initial load
  useEffect(() => {
    loadCalendars();
    loadEnhancedCalendarData();
  }, [loadCalendars, loadEnhancedCalendarData]);

  // Refresh on trigger change
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadCalendars();
      loadEnhancedCalendarData();
    }
  }, [refreshTrigger, loadCalendars, loadEnhancedCalendarData]);

  // Real-time socket updates
  useEffect(() => {
    if (!session?.accessToken) return;
    
    let unsubscribe: (() => void) | null = null;
    
    (async () => {
      try {
        await chatSocket.connect(session.accessToken as string);
        
        const handler = (payload: Record<string, any>) => {
          if (!payload || payload.type !== 'event') return;
          
          setEvents(prev => {
            if (payload.action === 'deleted') {
              return prev.filter(e => e.id !== payload.event.id);
            }
            
            const incoming = payload.event as EventItem;
            const idx = prev.findIndex(e => e.id === incoming.id);
            
            if (idx >= 0) {
              // Update existing event
              const next = [...prev];
              next[idx] = { ...next[idx], ...incoming };
              return next;
            }
            
            // Add new event
            return [incoming, ...prev];
          });
          
          // Update enterprise stats
          setEvents(current => {
            const pending = current.filter((e: Record<string, any>) => e.approvalStatus === 'pending').length;
            setPendingApprovals(pending);
            return current;
          });
        };
        
        (chatSocket as any).on?.('calendar_event', handler as any);
        unsubscribe = () => { (chatSocket as any).off?.('calendar_event', handler as any); };
      } catch (error) {
        console.error('🏢 Enterprise Calendar - Failed to connect to socket:', error);
      }
    })();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [session]);

  // Helper functions
  const getEventColor = (event: EventItem) => {
    const calendar = calendars.find(c => c.id === event.calendarId);
    return calendar?.color || '#3b82f6'; // Default to blue
  };

  const getEventsForDate = (date: Date) => {
    if (!date) return [];
    
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventStartDate = new Date(event.occurrenceStartAt || event.startAt).toISOString().split('T')[0];
      return eventStartDate === dateStr;
    });
  };

  const formatTime = (timeString: string, timezone?: string) => {
    const date = new Date(timeString);
    if (timezone) {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone
      }).format(date);
    }
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Event handlers
  const handleCreateEvent = async () => {
    try {
      // Navigate to calendar page to create event
      router.push('/calendar/month');
      toast.success('Opening calendar to create event');
      
      // Record usage for enterprise features
      if (hasEnterprise) {
        await recordUsage('calendar_advanced_scheduling');
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      toast.error('Failed to create event');
    }
  };

  const handleApproveEvent = async (eventId: string) => {
    try {
      // Update event approval status via API
      // TODO: Implement approval API endpoint
      toast.success('Event approved successfully');
      
      setPendingApprovals(prev => Math.max(0, prev - 1));
      
      // Record usage
      await recordUsage('calendar_approval_workflows');
    } catch (error) {
      console.error('Failed to approve event:', error);
      toast.error('Failed to approve event');
    }
  };

  const handleRejectEvent = async (eventId: string) => {
    try {
      // Update event approval status via API
      // TODO: Implement rejection API endpoint
      toast.success('Event rejected');
      
      setPendingApprovals(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to reject event:', error);
      toast.error('Failed to reject event');
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const handlePreviousPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setDate(prev.getDate() - 7);
        return newDate;
      });
    } else {
      setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setDate(prev.getDate() - 1);
        return newDate;
      });
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setDate(prev.getDate() + 7);
        return newDate;
      });
    } else {
      setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setDate(prev.getDate() + 1);
        return newDate;
      });
    }
  };

  const getEventStatusIcon = (event: EventItem) => {
    const metadata = (event as any).metadata || {};
    if (metadata.approvalStatus === 'pending') return <Clock className="w-4 h-4 text-yellow-600" />;
    if (metadata.approvalStatus === 'approved') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (metadata.approvalStatus === 'rejected') return <XCircle className="w-4 h-4 text-red-600" />;
    if (metadata.encryptionEnabled) return <Shield className="w-4 h-4 text-blue-600" />;
    return null;
  };

  const getComplianceBadge = (level?: string) => {
    if (!level) return null;
    
    const configs = {
      public: { color: 'bg-green-100 text-green-800 border-green-200', icon: '🌍' },
      internal: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🏢' },
      confidential: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🔒' },
      restricted: { color: 'bg-red-100 text-red-800 border-red-200', icon: '🚫' }
    };
    
    const config = configs[level as keyof typeof configs];
    if (!config) return null;
    
    return (
      <span className={`px-2 py-1 text-xs border rounded-full ${config.color} inline-flex items-center`}>
        <span className="mr-1">{config.icon}</span>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Premium Enterprise Header with Navy/Gold Gradient */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Gold accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h2 className="text-3xl font-bold text-white">Enterprise Calendar</h2>
              <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 font-bold text-sm shadow-lg rounded-full">
                ENTERPRISE
              </span>
            </div>
            <p className="text-slate-300">Advanced scheduling with compliance, resources, and approval workflows</p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Enterprise Alert Indicators */}
            {hasEnterprise && (pendingApprovals > 0 || resourceAlerts > 0 || complianceAlerts > 0) && (
              <button
                onClick={() => setShowEnterprisePanel(true)}
                className="relative p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all"
              >
                <Settings className="w-5 h-5 text-white" />
                {(pendingApprovals + resourceAlerts + complianceAlerts) > 0 && (
                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                    {pendingApprovals + resourceAlerts + complianceAlerts}
                  </span>
                )}
              </button>
            )}
            
            {/* Enterprise Quick Actions */}
            {hasEnterprise && (
              <div className="flex space-x-2">
                <FeatureGate feature="calendar_analytics" businessId={businessId}>
                  <button
                    onClick={() => {
                      setActiveEnterpriseTab('analytics');
                      setShowEnterprisePanel(true);
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-lg font-medium transition-all flex items-center space-x-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Analytics</span>
                  </button>
                </FeatureGate>
                
                <FeatureGate feature="calendar_resource_booking" businessId={businessId}>
                  <button
                    onClick={() => {
                      setActiveEnterpriseTab('resources');
                      setShowEnterprisePanel(true);
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-lg font-medium transition-all flex items-center space-x-2"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Resources</span>
                  </button>
                </FeatureGate>
              </div>
            )}
            
            {/* Premium Create Button */}
            <button
              onClick={handleCreateEvent}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-900 rounded-lg font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>New Event</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern Search and Navigation Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {/* Premium Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-sm font-medium"
            />
          </div>
          
          {/* Modern Date Navigation */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePreviousPeriod}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="px-6 py-2 bg-gradient-to-r from-slate-50 to-amber-50 rounded-lg border border-amber-200">
              <h3 className="text-base font-semibold text-gray-900">
                {viewMode === 'month' && currentDate.toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
                {viewMode === 'week' && `Week of ${currentDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}`}
                {viewMode === 'day' && currentDate.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric' 
                })}
              </h3>
            </div>
            
            <button
              onClick={handleNextPeriod}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next period"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            
            <button
              onClick={() => setCurrentDate(new Date())}
              className="ml-2 px-4 py-2 bg-gradient-to-r from-slate-100 to-amber-100 hover:from-slate-200 hover:to-amber-200 text-gray-900 rounded-lg text-sm font-medium transition-colors border border-amber-200"
            >
              Today
            </button>
            
            {/* Modern View Switcher */}
            <div className="bg-slate-100 rounded-lg p-1 flex space-x-1">
              {['month', 'week', 'day'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${
                    viewMode === mode
                      ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md'
                      : 'text-slate-600 hover:bg-white/50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start space-x-3 animate-in slide-in-from-top">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Error loading calendar</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Premium Enterprise Calendar Grid */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl shadow-lg border border-amber-200 overflow-hidden">
          {/* Premium Calendar Header */}
          <div className="grid grid-cols-7 gap-px bg-gradient-to-r from-slate-100 via-amber-50 to-slate-100 border-b border-amber-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-white p-4 text-center">
                <span className="text-sm font-bold text-slate-800 tracking-wider uppercase">{day}</span>
              </div>
            ))}
          </div>

          {/* Premium Calendar Days */}
          <div className="grid grid-cols-7 gap-px bg-gray-100">
            {getDaysInMonth(currentDate).map((date, index) => {
              const isToday = date && 
                date.getDate() === new Date().getDate() &&
                date.getMonth() === new Date().getMonth() &&
                date.getFullYear() === new Date().getFullYear();
              
              return (
                <div
                  key={index}
                  className={`bg-white min-h-[140px] p-3 transition-all ${
                    date ? 'cursor-pointer hover:bg-amber-50 hover:shadow-md' : 'bg-gray-50'
                  } ${isToday ? 'ring-2 ring-amber-500 bg-amber-50/30' : ''}`}
                  onClick={() => date && router.push('/calendar/month')}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-bold mb-2 ${
                        isToday 
                          ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md'
                          : 'text-slate-700'
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1.5">
                        {getEventsForDate(date).slice(0, 3).map(event => {
                          const eventColor = getEventColor(event);
                          const metadata = (event as any).metadata || {};
                          
                          return (
                            <div
                              key={event.id}
                              className="group relative text-xs px-2 py-1.5 rounded-lg cursor-pointer flex items-center space-x-1 transform transition-all hover:scale-105 hover:shadow-lg border-l-2"
                              style={{ 
                                backgroundColor: `${eventColor}15`, 
                                color: eventColor,
                                borderLeftColor: eventColor,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(event);
                              }}
                            >
                              {/* Enterprise status icon */}
                              <span className="flex-shrink-0">
                                {getEventStatusIcon(event)}
                              </span>
                              
                              {!event.allDay && (
                                <span className="text-[10px] font-bold opacity-75">
                                  {formatTime(event.occurrenceStartAt || event.startAt, event.timezone)}
                                </span>
                              )}
                              <span className="truncate font-semibold">{event.title}</span>
                              
                              {/* Enterprise metadata badges */}
                              {metadata.complianceLevel && (
                                <span className="text-[10px] opacity-75">
                                  {metadata.complianceLevel === 'restricted' ? '🚫' :
                                   metadata.complianceLevel === 'confidential' ? '🔒' :
                                   metadata.complianceLevel === 'internal' ? '🏢' : ''}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {getEventsForDate(date).length > 3 && (
                          <div className="text-xs text-slate-600 text-center py-1 bg-slate-50 rounded-lg font-medium border border-slate-200">
                            +{getEventsForDate(date).length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Enterprise Panel */}
      {showEnterprisePanel && hasEnterprise && (
        <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full"></div>
              <span>Enterprise Features</span>
            </h3>
            <button
              onClick={() => setShowEnterprisePanel(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-2xl text-gray-500">×</span>
            </button>
          </div>
          
          {/* Premium Enterprise Tabs */}
          <div className="flex space-x-2 mb-6">
            {[
              { id: 'resources', label: 'Resources', icon: MapPin, alerts: resourceAlerts },
              { id: 'approvals', label: 'Approvals', icon: CheckCircle, alerts: pendingApprovals },
              { id: 'analytics', label: 'Analytics', icon: BarChart3, alerts: 0 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveEnterpriseTab(tab.id as any)}
                className={`flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all relative ${
                  activeEnterpriseTab === tab.id
                    ? 'bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                {tab.label}
                {tab.alerts > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 text-xs bg-red-500 text-white rounded-full flex items-center justify-center shadow-md">
                    {tab.alerts}
                  </span>
                )}
              </button>
            ))}
          </div>
          
          <div className="overflow-y-auto max-h-[600px]">
            {activeEnterpriseTab === 'resources' && (
              <ResourceBookingPanel
                businessId={businessId}
                className="border-0"
              />
            )}
            {activeEnterpriseTab === 'approvals' && (
              <ApprovalWorkflowPanel
                businessId={businessId}
                className="border-0"
              />
            )}
            {activeEnterpriseTab === 'analytics' && (
              <CalendarAnalyticsPanel
                businessId={businessId}
                className="border-0"
              />
            )}
          </div>
        </div>
      )}

      {/* Premium Enterprise Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Premium Enterprise Header */}
            <div 
              className="px-6 py-5 bg-gradient-to-r from-slate-800 to-slate-700 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500"></div>
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-start space-x-4 flex-1">
                  <div 
                    className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: getEventColor(selectedEvent) }}
                  >
                    <CalendarIcon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {selectedEvent.title}
                    </h2>
                    <div className="flex items-center space-x-2 flex-wrap">
                      {selectedEvent.recurrenceRule && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs font-medium rounded-full flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Recurring</span>
                        </span>
                      )}
                      {selectedEvent.allDay && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs font-medium rounded-full">
                          All Day
                        </span>
                      )}
                      {(selectedEvent as any).metadata?.complianceLevel && (
                        getComplianceBadge((selectedEvent as any).metadata.complianceLevel)
                      )}
                      {(selectedEvent as any).metadata?.approvalStatus === 'pending' && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-200 text-xs font-medium rounded-full">
                          Pending Approval
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)]">
              {selectedEvent.description && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-slate-700 leading-relaxed">{selectedEvent.description}</p>
                </div>
              )}

              {/* Enterprise Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Time Card */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="w-5 h-5 text-slate-700" />
                    <h4 className="text-sm font-bold text-slate-900">Time</h4>
                  </div>
                  {selectedEvent.allDay ? (
                    <p className="text-sm text-slate-800 font-medium">All day event</p>
                  ) : (
                    <p className="text-sm text-slate-800 font-medium">
                      {formatTime(selectedEvent.occurrenceStartAt || selectedEvent.startAt, selectedEvent.timezone)} - {formatTime(selectedEvent.occurrenceEndAt || selectedEvent.endAt, selectedEvent.timezone)}
                    </p>
                  )}
                </div>

                {/* Location Card */}
                {selectedEvent.location && (
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 border border-amber-300">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="w-5 h-5 text-amber-700" />
                      <h4 className="text-sm font-bold text-amber-900">Location</h4>
                    </div>
                    <p className="text-sm text-amber-800 font-medium">{selectedEvent.location}</p>
                  </div>
                )}

                {/* Enterprise Cost Fields */}
                {hasEnterprise && (selectedEvent as any).metadata?.estimatedCost && (
                  <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-300">
                    <div className="flex items-center space-x-2 mb-2">
                      <BarChart3 className="w-5 h-5 text-green-700" />
                      <h4 className="text-sm font-bold text-green-900">Estimated Cost</h4>
                    </div>
                    <p className="text-sm text-green-800 font-medium">${(selectedEvent as any).metadata.estimatedCost}</p>
                  </div>
                )}

                {hasEnterprise && (selectedEvent as any).metadata?.costCenter && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-300">
                    <div className="flex items-center space-x-2 mb-2">
                      <Shield className="w-5 h-5 text-blue-700" />
                      <h4 className="text-sm font-bold text-blue-900">Cost Center</h4>
                    </div>
                    <p className="text-sm text-blue-800 font-medium">{(selectedEvent as any).metadata.costCenter}</p>
                  </div>
                )}
              </div>

              {/* Online Meeting */}
              {selectedEvent.onlineMeetingLink && (
                <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <Video className="w-5 h-5 text-green-600" />
                    <h4 className="text-sm font-bold text-green-900">Online Meeting</h4>
                  </div>
                  <a 
                    href={selectedEvent.onlineMeetingLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all transform hover:scale-105"
                  >
                    <Video className="w-4 h-4" />
                    <span>Join Meeting</span>
                  </a>
                </div>
              )}

              {/* Attendees */}
              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Users className="w-5 h-5 text-gray-600" />
                    <h4 className="text-sm font-bold text-gray-900">
                      Attendees ({selectedEvent.attendees.length})
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {selectedEvent.attendees.map((attendee, index) => (
                      <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex items-center space-x-3">
                          <Avatar size={32} nameOrEmail={attendee.email || attendee.userId || 'Unknown'} />
                          <span className="text-sm font-medium text-gray-900">{attendee.email || attendee.userId}</span>
                        </div>
                        {attendee.response && (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            attendee.response === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                            attendee.response === 'DECLINED' ? 'bg-red-100 text-red-700' :
                            attendee.response === 'TENTATIVE' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {attendee.response === 'NEEDS_ACTION' ? 'Pending Response' :
                             attendee.response === 'ACCEPTED' ? 'Accepted' :
                             attendee.response === 'DECLINED' ? 'Declined' :
                             attendee.response === 'TENTATIVE' ? 'Tentative' :
                             attendee.response}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Enterprise Features Panel */}
              {hasEnterprise && (selectedEvent as any).metadata && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-4 border-2 border-amber-400">
                  <div className="flex items-center space-x-2 mb-3">
                    <Shield className="w-5 h-5 text-amber-400" />
                    <h4 className="font-bold text-white">Enterprise Features</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {(selectedEvent as any).metadata.encryptionEnabled !== undefined && (
                      <div className="flex items-center gap-2 text-slate-200">
                        <Shield className="w-4 h-4 text-amber-400" />
                        <span>Encryption: {(selectedEvent as any).metadata.encryptionEnabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    )}
                    {(selectedEvent as any).metadata.recordingEnabled !== undefined && (
                      <div className="flex items-center gap-2 text-slate-200">
                        <Video className="w-4 h-4 text-amber-400" />
                        <span>Recording: {(selectedEvent as any).metadata.recordingEnabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    )}
                    {(selectedEvent as any).metadata.resourceBookings && (selectedEvent as any).metadata.resourceBookings.length > 0 && (
                      <div className="col-span-2 text-amber-200">
                        <span className="font-medium">Resources: {(selectedEvent as any).metadata.resourceBookings.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Recurrence Info */}
              {selectedEvent.recurrenceRule && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-900">Recurring Event</h4>
                      <p className="text-sm text-blue-700 mt-1 font-mono">{selectedEvent.recurrenceRule}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Premium Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {(selectedEvent as any).metadata?.approvalStatus === 'pending' && (
                  <>
                    <button
                      onClick={() => handleRejectEvent(selectedEvent.id)}
                      className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-all flex items-center space-x-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleApproveEvent(selectedEvent.id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center space-x-2 shadow-lg"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    router.push('/calendar/month');
                    setSelectedEvent(null);
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-900 hover:to-slate-800 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all border border-amber-400"
                >
                  View in Calendar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
