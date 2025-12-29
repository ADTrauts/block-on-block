'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, Button, Avatar, Badge, Spinner } from 'shared/components';
import { useDashboard } from '../../contexts/DashboardContext';
import { calendarAPI, Calendar, EventItem } from '../../api/calendar';
import { chatSocket } from '../../lib/chatSocket';
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
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CalendarModuleProps {
  businessId?: string;
  className?: string;
  refreshTrigger?: number;
  dashboardId?: string | null;
  contextType?: 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD';
}

export default function CalendarModule({ businessId, dashboardId, className = '', refreshTrigger, contextType: contextTypeOverride }: CalendarModuleProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { currentDashboard, getDashboardType } = useDashboard();
  
  // State
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Debug: Log when modal state changes
  useEffect(() => {
    if (showEventModal && selectedEvent) {
      console.log('📅 CalendarModule: Modal should be visible', { 
        showEventModal, 
        selectedEventId: selectedEvent.id,
        title: selectedEvent.title 
      });
      // Also check if modal element exists in DOM
      setTimeout(() => {
        const modal = document.querySelector('[data-calendar-modal="true"]');
        console.log('📅 CalendarModule: Modal in DOM?', { exists: !!modal, zIndex: modal ? window.getComputedStyle(modal as Element).zIndex : null });
      }, 100);
    }
  }, [showEventModal, selectedEvent]);

  // Get context information for filtering
  // Priority: explicit dashboardId > businessId > currentDashboard context
  const derivedContextType = currentDashboard ? getDashboardType(currentDashboard).toUpperCase() as 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD' : 'PERSONAL';
  const effectiveContextType = contextTypeOverride ?? derivedContextType;

  const contextId = (() => {
    if (effectiveContextType === 'BUSINESS') {
      return businessId || (currentDashboard as any)?.business?.id || (currentDashboard as any)?.businessId || dashboardId || currentDashboard?.id || '';
    }

    if (effectiveContextType === 'HOUSEHOLD') {
      return (currentDashboard as any)?.household?.id || (currentDashboard as any)?.householdId || dashboardId || currentDashboard?.id || '';
    }

    return dashboardId || currentDashboard?.id || '';
  })();
  
  console.log('📅 CalendarModule Context Resolution:', {
    dashboardId,
    businessId,
    currentDashboardId: currentDashboard?.id,
    resolvedContextId: contextId,
    contextType: effectiveContextType,
    contextTypeOverride
  });

  // Load calendars for the current context
  const loadCalendars = useCallback(async () => {
    if (!session?.accessToken) return;
    
    try {
      // For personal context, don't pass contextId - let backend find all personal calendars for user
      // For business/household, pass the businessId/householdId
      const calendarParams: { contextType?: string; contextId?: string } = {
        contextType: effectiveContextType,
      };
      
      if (effectiveContextType === 'BUSINESS' || effectiveContextType === 'HOUSEHOLD') {
        if (contextId) {
          calendarParams.contextId = contextId;
        }
      }
      // For PERSONAL, don't set contextId - backend will use userId from session
      
      const response = await calendarAPI.listCalendars(calendarParams);
      
      if (response?.success && response.data) {
        setCalendars(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load calendars:', err);
      setError('Failed to load calendars');
    }
  }, [session, effectiveContextType, contextId]);

  // Load events for the current view
  const loadEvents = useCallback(async () => {
    if (!session?.accessToken) return;
    
    try {
      setLoading(true);
      setError(null);
      
      if (!contextId) {
        setError('Workspace context not initialized. Please refresh the page.');
        setLoading(false);
        return;
      }
      
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
      
      // Backend expects dashboard IDs for contexts, not formatted strings
      // It will look up the dashboard and determine context type automatically
      // For personal dashboards, it resolves to PERSONAL:userId
      // For business/household, it resolves to BUSINESS:businessId or HOUSEHOLD:householdId
      const response = await calendarAPI.listEvents({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        contexts: contextId ? [contextId] : []
      });
      
      console.log('📅 CalendarModule: Loaded events', {
        success: response?.success,
        eventCount: response?.data?.length || 0,
        events: response?.data?.map(e => ({ id: e.id, title: e.title, startAt: e.startAt, calendarId: e.calendarId })),
        contextId,
        effectiveContextType,
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() }
      });
      
      if (response?.success && response.data) {
        setEvents(response.data);
      } else {
        console.warn('📅 CalendarModule: Failed to load events or no events returned', response);
      }
    } catch (err: any) {
      console.error('Failed to load events:', err);
      setError('Failed to load events');
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [session, currentDate, viewMode, effectiveContextType, contextId]);

  // Initial load
  useEffect(() => {
    loadCalendars();
    loadEvents();
  }, [loadCalendars, loadEvents]);

  // Refresh on trigger change
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadCalendars();
      loadEvents();
    }
  }, [refreshTrigger, loadCalendars, loadEvents]);

  // Listen for item restored events from trash
  useEffect(() => {
    const handleItemRestored = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const itemData = customEvent.detail;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/939a7e45-5358-479f-aafd-320e00e09c1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CalendarModule.tsx:184',message:'itemRestored event received',data:{moduleId:itemData?.moduleId,id:itemData?.id,isCalendar:itemData?.moduleId==='calendar'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (itemData?.moduleId === 'calendar' && itemData?.id) {
        // Reload calendars and events to show the restored item
        await loadCalendars();
        await loadEvents();
      }
    };

    window.addEventListener('itemRestored', handleItemRestored);
    return () => {
      window.removeEventListener('itemRestored', handleItemRestored);
    };
  }, [loadCalendars, loadEvents]);

  // Real-time socket updates
  useEffect(() => {
    if (!session?.accessToken) return;
    
    let unsubscribe: (() => void) | null = null;
    
    (async () => {
      try {
        await chatSocket.connect(session.accessToken as string);
        
        const handler = (payload: any) => {
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
        };
        
        (chatSocket as any).on?.('calendar_event', handler as any);
        unsubscribe = () => { (chatSocket as any).off?.('calendar_event', handler as any); };
      } catch (error) {
        console.error('Failed to connect to socket for calendar updates:', error);
      }
    })();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [session]);

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

  const getEventColor = (event: EventItem) => {
    const calendar = calendars.find(c => c.id === event.calendarId);
    return calendar?.color || '#3b82f6'; // Default to blue
  };

  const handlePreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handlePreviousPeriod = () => {
    if (viewMode === 'month') {
      handlePreviousMonth();
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
      handleNextMonth();
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

  const handleDateClick = (date: Date) => {
    // Navigate to full calendar page with this date
    router.push(`/calendar/day?date=${date.toISOString().split('T')[0]}`);
  };

  const handleEventClick = (event: EventItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
    }
    console.log('📅 CalendarModule: Event clicked, opening modal', { 
      eventId: event.id, 
      title: event.title,
      currentPath: window.location.pathname,
      component: 'CalendarModule'
    });
    // Double-check we're not on a calendar page that has EventDrawer
    if (window.location.pathname.startsWith('/calendar/')) {
      console.warn('⚠️ CalendarModule: On calendar page - EventDrawer might interfere');
    }
    setSelectedEvent(event);
    setShowEventModal(true);
    // Prevent any navigation or other handlers
    return false;
  };

  const handleCreateEvent = () => {
    // Navigate to calendar page with create event modal
    router.push('/calendar/month');
    toast.success('Opening calendar to create event');
  };

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Modern Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">Calendar</h2>
            <p className="text-blue-100">Manage your schedule and never miss an event</p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Modern View Switcher */}
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-1 flex space-x-1">
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'month'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'week'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'day'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Day
              </button>
            </div>
            {/* Modern Create Button */}
            <button
              onClick={handleCreateEvent}
              className="bg-white text-blue-600 px-5 py-2.5 rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center space-x-2"
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
          {/* Modern Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium"
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
            
            <div className="px-6 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
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
              className="ml-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Today
            </button>
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

      {/* Modern Calendar Grid */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Modern Calendar Header */}
          <div className="grid grid-cols-7 gap-px bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-white p-4 text-center">
                <span className="text-sm font-bold text-gray-700 tracking-wider uppercase">{day}</span>
              </div>
            ))}
          </div>

          {/* Modern Calendar Days */}
          <div className="grid grid-cols-7 gap-px bg-gray-100">
            {getDaysInMonth(currentDate).map((date, index) => {
              const isToday = date && 
                date.getDate() === new Date().getDate() &&
                date.getMonth() === new Date().getMonth() &&
                date.getFullYear() === new Date().getFullYear();
              
              return (
                <div
                  key={index}
                  className={`bg-white min-h-[130px] p-3 transition-all ${
                    date ? 'cursor-pointer hover:bg-blue-50 hover:shadow-md' : 'bg-gray-50'
                  } ${isToday ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}
                  onClick={() => date && handleDateClick(date)}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-semibold mb-2 ${
                        isToday 
                          ? 'bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center'
                          : 'text-gray-700'
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1.5">
                        {getEventsForDate(date).slice(0, 3).map(event => {
                          const eventColor = getEventColor(event);
                          return (
                            <div
                              key={event.id}
                              className="group relative text-xs px-2 py-1.5 rounded-lg cursor-pointer truncate flex items-center space-x-1 transform transition-all hover:scale-105 hover:shadow-md"
                              style={{ 
                                backgroundColor: `${eventColor}15`, 
                                color: eventColor,
                                borderLeft: `3px solid ${eventColor}`,
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                handleEventClick(event, e);
                              }}
                            >
                              {!event.allDay && (
                                <span className="text-[10px] font-bold opacity-75">
                                  {formatTime(event.occurrenceStartAt || event.startAt, event.timezone)}
                                </span>
                              )}
                              <span className="truncate font-medium">{event.title}</span>
                              {/* Hover tooltip */}
                              <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                {event.title}
                              </div>
                            </div>
                          );
                        })}
                        {getEventsForDate(date).length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-1 bg-gray-50 rounded-lg font-medium">
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

      {/* Modern Upcoming Events Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
            <span>Upcoming Events</span>
          </h3>
          <div className="text-sm font-medium text-gray-500">
            Next {filteredEvents.filter(event => new Date(event.occurrenceStartAt || event.startAt) > new Date()).slice(0, 5).length} events
          </div>
        </div>
        <div className="space-y-3">
          {filteredEvents
            .filter(event => new Date(event.occurrenceStartAt || event.startAt) > new Date())
            .sort((a, b) => new Date(a.occurrenceStartAt || a.startAt).getTime() - new Date(b.occurrenceStartAt || b.startAt).getTime())
            .slice(0, 5)
            .map(event => {
              const eventColor = getEventColor(event);
              return (
                <div
                  key={event.id}
                  className="group relative flex items-center space-x-4 p-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 rounded-xl cursor-pointer transition-all border border-transparent hover:border-blue-200 hover:shadow-md"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    handleEventClick(event, e);
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: `${eventColor}20` }}
                  >
                    <CalendarIcon className="w-6 h-6" style={{ color: eventColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {event.title}
                    </p>
                    <div className="flex items-center space-x-3 text-sm text-gray-600 mt-1.5">
                      <span className="flex items-center space-x-1 font-medium">
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(event.occurrenceStartAt || event.startAt, event.timezone)}</span>
                      </span>
                      {event.location && (
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate max-w-[150px]">{event.location}</span>
                        </span>
                      )}
                      {event.attendees && event.attendees.length > 0 && (
                        <span className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{event.attendees.length}</span>
                        </span>
                      )}
                      {event.recurrenceRule && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          Recurring
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>
              );
            })}
          {filteredEvents.filter(event => new Date(event.occurrenceStartAt || event.startAt) > new Date()).length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarIcon className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No upcoming events</p>
              <p className="text-gray-500 text-sm mt-1">Create your first event to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Modern Event Modal */}
      {showEventModal && selectedEvent && (
        <div 
          data-calendar-modal="true"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 99999, position: 'fixed' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowEventModal(false);
            setSelectedEvent(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modern Header with Gradient */}
            <div 
              className="px-6 py-5 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${getEventColor(selectedEvent)}15 0%, ${getEventColor(selectedEvent)}05 100%)`
              }}
            >
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-start space-x-4 flex-1">
                  <div 
                    className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: getEventColor(selectedEvent) }}
                  >
                    <CalendarIcon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {selectedEvent.title}
                    </h2>
                    <div className="flex items-center space-x-2">
                      {selectedEvent.recurrenceRule && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Recurring Event</span>
                        </span>
                      )}
                      {selectedEvent.allDay && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          All Day
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowEventModal(false);
                    setSelectedEvent(null);
                  }}
                  className="p-2 hover:bg-white/50 rounded-xl transition-all"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)]">
              {selectedEvent.description && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-gray-700 leading-relaxed">{selectedEvent.description}</p>
                </div>
              )}

              {/* Modern Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Time Card */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-bold text-blue-900">Time</h4>
                  </div>
                  {selectedEvent.allDay ? (
                    <p className="text-sm text-blue-800 font-medium">All day event</p>
                  ) : (
                    <p className="text-sm text-blue-800 font-medium">
                      {formatTime(selectedEvent.occurrenceStartAt || selectedEvent.startAt, selectedEvent.timezone)} - {formatTime(selectedEvent.occurrenceEndAt || selectedEvent.endAt, selectedEvent.timezone)}
                    </p>
                  )}
                </div>

                {/* Location Card */}
                {selectedEvent.location && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="w-5 h-5 text-purple-600" />
                      <h4 className="text-sm font-bold text-purple-900">Location</h4>
                    </div>
                    <p className="text-sm text-purple-800 font-medium">{selectedEvent.location}</p>
                  </div>
                )}
              </div>

              {/* Online Meeting Card */}
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

              {/* Attendees Section */}
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
                            {attendee.response}
                          </span>
                        )}
                      </div>
                    ))}
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

            {/* Modern Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowEventModal(false);
                  setSelectedEvent(null);
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  router.push(`/calendar/month`);
                  setShowEventModal(false);
                  setSelectedEvent(null);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                View in Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
