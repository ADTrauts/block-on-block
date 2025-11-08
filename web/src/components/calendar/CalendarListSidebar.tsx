'use client';
import { useEffect, useMemo, useState } from 'react';
import { calendarAPI, Calendar } from '../../api/calendar';
import { useDashboard } from '../../contexts/DashboardContext';
import { useCalendarContext } from '../../contexts/CalendarContext';
import { Dashboard } from 'shared/types/dashboard';
import { DashboardWidget } from 'shared/types/dashboard';
import { 
  CalendarIcon, 
  ClockIcon, 
  ShareIcon, 
  BellIcon,
  PlusIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

interface ExtendedDashboard extends Dashboard {
  business?: { id: string };
  household?: { id: string };
}

interface ContextQuery {
  contextType: 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD';
  contextId: string;
}

interface CalendarListSidebarProps {
  contextType?: 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD';
  contextId?: string;
}

export default function CalendarListSidebar({ contextType, contextId }: CalendarListSidebarProps = {}) {
  const { currentDashboard, getDashboardType, getDashboardDisplayName } = useDashboard();
  const { visibleCalendarIds, toggleCalendarVisibility, overlayMode, setOverlayMode, setCalendars: setCalCtx } = useCalendarContext();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [masterCalendarActive, setMasterCalendarActive] = useState(true);

  const contextQuery = useMemo(() => {
    if (contextType && contextId) {
      return { contextType, contextId } as ContextQuery;
    }

    if (!currentDashboard) return {} as ContextQuery;
    const type = getDashboardType(currentDashboard).toUpperCase() as 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD';
    const extendedDashboard = currentDashboard as ExtendedDashboard;
    const id = extendedDashboard.business?.id || extendedDashboard.household?.id || currentDashboard.id;
    return { contextType: type, contextId: id } as ContextQuery;
  }, [contextType, contextId, currentDashboard, getDashboardType]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // All Tabs mode: skip context filters to load all user calendars
        const shouldUseAllTabs = overlayMode === 'ALL_TABS';
        if (!shouldUseAllTabs && (!contextQuery.contextType || !contextQuery.contextId)) {
          setCalendars([]);
          setCalCtx([]);
          return;
        }

        const resp = shouldUseAllTabs
          ? await calendarAPI.listCalendars()
          : await calendarAPI.listCalendars(contextQuery);
        if (resp?.success) {
          if (resp.data.length === 0 && overlayMode === 'CURRENT_TAB' && currentDashboard) {
            // Attempt auto-provision only if calendar module is active on this dashboard
            const calendarActive = currentDashboard.widgets?.some((w: DashboardWidget) => w.type === 'calendar');
            if (calendarActive) {
              const name = getDashboardDisplayName(currentDashboard);
              try {
                await calendarAPI.autoProvision({
                  contextType: contextQuery.contextType || 'PERSONAL',
                  contextId: contextQuery.contextId || '',
                  name,
                  isPrimary: true
                });
              } catch {}
              const refetch = await calendarAPI.listCalendars(contextQuery);
              if (refetch?.success) {
                setCalCtx(refetch.data);
                setCalendars(refetch.data);
              }
            } else {
              setCalCtx([]);
              setCalendars([]);
            }
          } else {
            setCalCtx(resp.data);
            setCalendars(resp.data);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [overlayMode, contextQuery, currentDashboard, getDashboardDisplayName]);

  // Event counts will be added in future update
  const totalEvents = calendars.length;

  return (
    <aside className="w-[280px] shrink-0 border-r bg-gray-50 dark:bg-gray-900 p-4 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Vssyl</h2>
          <select
            value={overlayMode}
            onChange={e => setOverlayMode(e.target.value as 'ALL_TABS' | 'CURRENT_TAB')}
            className="text-xs border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          >
            <option value="ALL_TABS">All Tabs</option>
            <option value="CURRENT_TAB">Current Tab</option>
          </select>
        </div>

        {/* New Event Button - Chunky style like Drive */}
        <button
          onClick={() => {
            window.location.href = '/calendar/month';
          }}
          className="w-full h-12 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 transition-all hover:shadow-lg"
          style={{
            backgroundColor: 'var(--primary-green)',
            color: 'white'
          }}
        >
          <PlusIcon className="w-5 h-5" />
          <span>New Event</span>
        </button>
      </div>

      {/* Master Calendar Section */}
      <div className="mb-6">
        <button
          onClick={() => {
            setMasterCalendarActive(!masterCalendarActive);
            // Toggle all calendars
            calendars.forEach(cal => {
              if (masterCalendarActive && visibleCalendarIds.has(cal.id)) {
                toggleCalendarVisibility(cal.id);
              } else if (!masterCalendarActive && !visibleCalendarIds.has(cal.id)) {
                toggleCalendarVisibility(cal.id);
              }
            });
          }}
          className={`w-full p-4 rounded-xl transition-all duration-200 ${
            masterCalendarActive 
              ? 'bg-white dark:bg-gray-800 shadow-md ring-2' 
              : 'bg-white dark:bg-gray-800 hover:shadow-sm'
          }`}
          style={masterCalendarActive ? {
            '--tw-ring-color': 'var(--primary-green)'
          } as React.CSSProperties : undefined}
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-green)' }}
            >
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-gray-900 dark:text-gray-100">All Calendars</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{totalEvents} calendar{totalEvents !== 1 ? 's' : ''}</div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </div>
        </button>
      </div>

      {/* YOUR CALENDARS Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Your Calendars
          </h3>
          <button
            onClick={async () => {
              const name = prompt('Calendar name');
              if (!name) return;
              const extendedDashboard = currentDashboard as ExtendedDashboard;
              const body: { name: string; contextType: 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD'; contextId: string } = currentDashboard
                ? { name, contextType: getDashboardType(currentDashboard).toUpperCase() as 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD', contextId: extendedDashboard.business?.id || extendedDashboard.household?.id || currentDashboard.id }
                : { name, contextType: 'PERSONAL', contextId: '' };
              const resp = await calendarAPI.createCalendar(body);
              if (resp?.success) {
                setCalendars([resp.data, ...calendars]);
                setCalCtx([resp.data, ...calendars]);
              }
            }}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
          >
            + New
          </button>
        </div>

        {loading && (
          <div className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">Loading…</div>
        )}

        {!loading && calendars.length > 0 && (
          <div className="space-y-2">
            {calendars.map(cal => (
              <button
                key={cal.id}
                onClick={() => toggleCalendarVisibility(cal.id)}
                className={`w-full p-3 rounded-lg transition-all duration-200 group ${
                  visibleCalendarIds.has(cal.id)
                    ? 'bg-white dark:bg-gray-800 shadow-sm ring-1'
                    : 'bg-white dark:bg-gray-800 opacity-50 hover:opacity-100'
                }`}
                style={visibleCalendarIds.has(cal.id) ? {
                  '--tw-ring-color': cal.color || 'var(--info-blue)',
                  borderLeft: `4px solid ${cal.color || '#3b82f6'}`
                } as React.CSSProperties : {
                  borderLeft: `4px solid ${cal.color || '#3b82f6'}`
                } as React.CSSProperties}
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: cal.color || '#3b82f6' }}
                  >
                    {cal.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">
                      {cal.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {cal.isPrimary ? 'Primary' : 'Calendar'}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <input
                      type="color"
                      value={cal.color || '#3b82f6'}
                      onChange={async (e) => {
                        e.stopPropagation();
                        const newColor = e.target.value;
                        const updated = await calendarAPI.updateCalendar(cal.id, { color: newColor });
                        if (updated?.success) {
                          setCalendars(calendars.map(c => c.id === cal.id ? { ...c, color: newColor } : c));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer rounded"
                      title="Edit color"
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && calendars.length === 0 && overlayMode === 'CURRENT_TAB' && currentDashboard && !currentDashboard.widgets?.some((w: DashboardWidget) => w.type === 'calendar') && (
          <div className="text-xs text-gray-500 dark:text-gray-400 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
            Calendar module is not enabled for this tab.
            <div className="mt-2">
              <a href={`/dashboard/${currentDashboard.id}`} className="underline hover:text-gray-700 dark:hover:text-gray-200">
                Add module
              </a>
            </div>
          </div>
        )}
      </div>

      {/* QUICK ACCESS Section */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Quick Access
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => {
              const today = new Date();
              window.location.href = `/calendar/month?y=${today.getFullYear()}&m=${today.getMonth() + 1}`;
            }}
            className="w-full px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center space-x-3 text-sm"
          >
            <ClockIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Today's Events</span>
          </button>
          <button
            onClick={() => {
              window.location.href = '/calendar/month';
            }}
            className="w-full px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center space-x-3 text-sm"
          >
            <BellIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Upcoming</span>
          </button>
          <button
            onClick={() => {
              window.location.href = '/calendar/month';
            }}
            className="w-full px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center space-x-3 text-sm"
          >
            <ShareIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Shared Calendars</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
