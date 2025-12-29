'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { calendarAPI, EventItem } from '../../../api/calendar';
import { chatSocket } from '../../../lib/chatSocket';
import { useSession } from 'next-auth/react';
import { useDashboard } from '../../../contexts/DashboardContext';
import { CalendarProvider, useCalendarContext } from '../../../contexts/CalendarContext';
import CalendarListSidebar from '../../../components/calendar/CalendarListSidebar';
import EventDrawer from '../../../components/calendar/EventDrawer';

function WeekInner() {
  const { currentDashboard, getDashboardType, getDashboardDisplayName } = useDashboard();
  const { visibleCalendarIds, overlayMode } = useCalendarContext();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const { data: session } = useSession();
  const [searchText, setSearchText] = useState('');
  const [myEventsOnly, setMyEventsOnly] = useState(false);

  const handleUpdateEventTime = async (ev: EventItem, newStart: Date, newEnd: Date) => {
    try {
      const payload: any = {
        startAt: newStart.toISOString(),
        endAt: newEnd.toISOString(),
      };
      if (ev.recurrenceRule) {
        const thisOnly = confirm('Update this occurrence only? Press Cancel to update the entire series.');
        if (thisOnly) {
          payload.editMode = 'THIS';
          payload.occurrenceStartAt = ev.occurrenceStartAt || ev.startAt;
        }
      }
      const resp = await calendarAPI.updateEvent(ev.id, payload);
      if ((resp as any)?.success) {
        const updated = (resp as any).data as EventItem;
        setEvents(prev => prev.map(e => (e.id === ev.id ? { ...e, ...updated } : e)));
      }
    } catch (e) {
      // noop; rely on server state
    }
  };

  // Backend expects dashboard IDs for contexts, not formatted strings
  // It will look up the dashboard and determine context type automatically
  // For personal dashboards, it resolves to PERSONAL:userId
  // For business/household, it resolves to BUSINESS:businessId or HOUSEHOLD:householdId
  const contextFilter = useMemo(() => {
    if (!currentDashboard || overlayMode === 'ALL_TABS') return [] as string[];
    const type = getDashboardType(currentDashboard).toUpperCase();
    if (type === 'PERSONAL') {
      // Pass dashboard ID - backend will resolve to PERSONAL:userId
      return [currentDashboard.id];
    } else {
      // For business/household, pass the businessId/householdId
      const id = (currentDashboard as any).business?.id || (currentDashboard as any).household?.id;
      return id ? [id] : [currentDashboard.id];
    }
  }, [currentDashboard, getDashboardType, overlayMode]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const day = viewDate.getDay();
        const start = new Date(viewDate);
        start.setDate(viewDate.getDate() - day);
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23,59,59,999);
        const selectedIds = Array.from(visibleCalendarIds);
        const resp = selectedIds.length > 0
          ? await calendarAPI.listEvents({ start: start.toISOString(), end: end.toISOString(), contexts: contextFilter, calendarIds: selectedIds })
          : await calendarAPI.listEvents({ start: start.toISOString(), end: end.toISOString(), contexts: contextFilter });
        if (resp?.success) setEvents(resp.data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    })();
  }, [contextFilter, visibleCalendarIds, viewDate]);

  // Realtime: subscribe to calendar_event messages
  useEffect(() => {
    const token = (session as any)?.accessToken as string | undefined;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      if (token) await chatSocket.connect(token);
      const handler = (payload: any) => {
        if (!payload || payload.type !== 'event') return;
        setEvents(prev => {
          if (payload.action === 'deleted') {
            return prev.filter(e => e.id !== payload.event.id);
          }
          const incoming = payload.event as EventItem;
          const exists = prev.findIndex(e => e.id === incoming.id);
          if (exists >= 0) {
            const next = prev.slice();
            next[exists] = { ...next[exists], ...incoming };
            return next;
          }
          return [incoming, ...prev];
        });
      };
      (chatSocket as any).on?.('calendar_event', handler as any);
      unsubscribe = () => {
        (chatSocket as any).off?.('calendar_event', handler as any);
      };
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [session]);

  return (
    <div className="flex h-full">
      <CalendarListSidebar />
      <div className="flex-1 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Calendar — Week</h1>
            <div className="ml-2 grid grid-cols-4 gap-2 text-xs">
              <a className="px-2 py-1 border rounded text-center hover:bg-gray-50" href="/calendar/day">Day</a>
              <a className="px-2 py-1 border rounded text-center bg-gray-100" href="/calendar/week">Week</a>
              <a className="px-2 py-1 border rounded text-center hover:bg-gray-50" href="/calendar/month">Month</a>
              <a className="px-2 py-1 border rounded text-center hover:bg-gray-50" href="/calendar/year">Year</a>
            </div>
            <div className="flex items-center gap-1 ml-3">
              <button className="px-2 py-1 border rounded" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()-7))}>{'<'}</button>
              <button className="px-2 py-1 border rounded" onClick={() => setViewDate(new Date())}>Today</button>
              <button className="px-2 py-1 border rounded" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()+7))}>{'>'}</button>
              <div className="ml-2 text-sm text-gray-600">Week of {viewDate.toLocaleDateString()}</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">{currentDashboard ? getDashboardDisplayName(currentDashboard) : 'All Tabs'}</div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <button className="px-2 py-1 border rounded" onClick={() => { setEditingEvent(null); setShowDrawer(true); }}>New Event</button>
          <input className="px-2 py-1 border rounded text-sm" placeholder="Search events" value={searchText} onChange={e => setSearchText(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && searchText.trim()) {
                const day = viewDate.getDay();
                const start = new Date(viewDate);
                start.setDate(viewDate.getDate() - day);
                start.setHours(0,0,0,0);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23,59,59,999);
                const resp = await calendarAPI.searchEvents({ text: searchText.trim(), start: start.toISOString(), end: end.toISOString(), contexts: contextFilter });
                if ((resp as any)?.success) setEvents((resp as any).data);
              }
            }}
          />
          <label className="text-xs flex items-center gap-1 ml-2">
            <input type="checkbox" checked={myEventsOnly} onChange={(e) => setMyEventsOnly(e.target.checked)} />
            My events
          </label>
        </div>
        {loading && <div>Loading…</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <DayColumn
                key={i}
                dayIndex={i}
                events={events}
                onCreate={(start, end) => {
                  setEditingEvent({
                    id: '',
                    calendarId: '',
                    title: '',
                    startAt: start.toISOString(),
                    endAt: end.toISOString(),
                    allDay: false,
                    timezone: 'UTC',
                  } as any);
                  setShowDrawer(true);
                }}
                onSelect={(ev) => { setEditingEvent(ev); setShowDrawer(true); }}
                onUpdateTime={handleUpdateEventTime}
                myEventsOnly={myEventsOnly}
                currentUserId={(session as any)?.user?.id}
              />
            ))}
          </div>
        )}

        <EventDrawer
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          onCreated={() => setShowDrawer(false)}
          onUpdated={() => setShowDrawer(false)}
          contextType={currentDashboard ? (getDashboardType(currentDashboard).toUpperCase() as any) : undefined}
          contextId={(currentDashboard as any)?.business?.id || (currentDashboard as any)?.household?.id || currentDashboard?.id}
          eventToEdit={editingEvent || undefined}
        />
      </div>
    </div>
  );
}

export default function CalendarWeekPage() {
  return (
    <CalendarProvider>
      <WeekInner />
    </CalendarProvider>
  );
}

function DayColumn({ dayIndex, events, onCreate, onSelect, onUpdateTime, myEventsOnly, currentUserId }: { dayIndex: number; events: EventItem[]; onCreate: (start: Date, end: Date) => void; onSelect: (ev: EventItem) => void; onUpdateTime: (ev: EventItem, start: Date, end: Date) => void; myEventsOnly: boolean; currentUserId?: string; }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragEndY, setDragEndY] = useState<number | null>(null);
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'move'|'resize'|null>(null);
  const [dragOriginStart, setDragOriginStart] = useState<Date | null>(null);
  const [dragOriginEnd, setDragOriginEnd] = useState<Date | null>(null);
  const [previewStart, setPreviewStart] = useState<Date | null>(null);
  const [previewEnd, setPreviewEnd] = useState<Date | null>(null);

  const pxToTime = (y: number): Date => {
    // Simple mapping: 200px column height -> 10 hours window starting 8am; adjust as needed
    const startHour = 8;
    const hoursVisible = 10;
    const rect = ref.current?.getBoundingClientRect();
    const height = rect?.height || 200;
    const ratio = Math.max(0, Math.min(1, y / height));
    const minutesFromStart = Math.round(ratio * hoursVisible * 60 / 15) * 15; // snap to 15 min
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const base = new Date(today);
    base.setDate(today.getDate() - today.getDay() + dayIndex); // go to this column's day
    base.setHours(startHour, 0, 0, 0);
    base.setMinutes(base.getMinutes() + minutesFromStart);
    return base;
  };

  const timeToY = (date: Date): number => {
    const startHour = 8;
    const hoursVisible = 10;
    const rect = ref.current?.getBoundingClientRect();
    const height = rect?.height || 200;
    const d = new Date(date);
    const minutes = (d.getHours() - startHour) * 60 + d.getMinutes();
    const clamped = Math.max(0, Math.min(hoursVisible * 60, minutes));
    return (clamped / (hoursVisible * 60)) * height;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setDragStartY(e.clientY - rect.top);
    setDragEndY(null);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStartY == null) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    setDragEndY(y);
    if (dragEventId && dragOriginStart && dragOriginEnd && dragMode) {
      if (dragMode === 'move') {
        const deltaMinutes = (y - (dragStartY ?? 0)) / (ref.current?.getBoundingClientRect().height || 200) * (10 * 60);
        const newStart = new Date(dragOriginStart);
        const newEnd = new Date(dragOriginEnd);
        newStart.setMinutes(newStart.getMinutes() + Math.round(deltaMinutes / 15) * 15);
        newEnd.setMinutes(newEnd.getMinutes() + Math.round(deltaMinutes / 15) * 15);
        setPreviewStart(newStart);
        setPreviewEnd(newEnd);
      } else if (dragMode === 'resize') {
        setPreviewStart(dragOriginStart);
        setPreviewEnd(pxToTime(y));
      }
    } else if (dragStartY != null) {
      const y1 = Math.min(dragStartY, y);
      const y2 = Math.max(dragStartY, y);
      setPreviewStart(pxToTime(y1));
      setPreviewEnd(pxToTime(y2));
    }
  };
  const handleMouseUp = () => {
    if (dragEventId && dragOriginStart && dragOriginEnd && dragEndY != null && dragMode) {
      const startY = dragStartY ?? 0;
      const endY = dragEndY;
      if (dragMode === 'move') {
        const deltaMinutes = (endY - startY) / (ref.current?.getBoundingClientRect().height || 200) * (10 * 60);
        const newStart = new Date(dragOriginStart);
        const newEnd = new Date(dragOriginEnd);
        newStart.setMinutes(newStart.getMinutes() + Math.round(deltaMinutes / 15) * 15);
        newEnd.setMinutes(newEnd.getMinutes() + Math.round(deltaMinutes / 15) * 15);
        const ev = dayEvents.find(e => e.id === dragEventId);
        if (ev) onUpdateTime(ev, newStart, newEnd);
      } else if (dragMode === 'resize') {
        const start = dragOriginStart;
        const end = pxToTime(endY);
        if (end > start) {
          const ev = dayEvents.find(e => e.id === dragEventId);
          if (ev) onUpdateTime(ev, start, end);
        }
      }
    } else if (dragStartY != null && dragEndY != null) {
      const y1 = Math.min(dragStartY, dragEndY);
      const y2 = Math.max(dragStartY, dragEndY);
      const start = pxToTime(y1);
      const end = pxToTime(y2);
      if (end > start) onCreate(start, end);
    }
    setDragStartY(null);
    setDragEndY(null);
    setDragEventId(null);
    setDragMode(null);
    setDragOriginStart(null);
    setDragOriginEnd(null);
    setPreviewStart(null);
    setPreviewEnd(null);
  };

  const dayEvents = events.filter(ev => {
    const d = new Date(ev.occurrenceStartAt || ev.startAt).getDay();
    if (d !== dayIndex) return false;
    if (myEventsOnly && currentUserId) {
      return ev.createdById === currentUserId;
    }
    return true;
  });

  const hasConflict = (start: Date, end: Date, excludeId?: string) => {
    return dayEvents.some(ev => {
      if (excludeId && ev.id === excludeId) return false;
      const s = new Date(ev.occurrenceStartAt || ev.startAt);
      const e = new Date(ev.occurrenceEndAt || ev.endAt);
      return s < end && e > start; // overlap
    });
  };

  return (
    <div
      ref={ref}
      className="border rounded p-2 min-h-[200px] relative select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
      onMouseUp={handleMouseUp}
    >
      {dayEvents.slice(0, 20).map(ev => {
        const start = new Date(ev.occurrenceStartAt || ev.startAt);
        const end = new Date(ev.occurrenceEndAt || ev.endAt);
        const top = timeToY(start);
        const height = Math.max(10, timeToY(end) - timeToY(start));
        return (
          <div
            key={ev.id}
            className="absolute left-1 right-1 bg-blue-100 border border-blue-300 rounded text-xs overflow-hidden"
            style={{ top, height }}
            onMouseDown={(e) => {
              e.stopPropagation();
              const rect = ref.current?.getBoundingClientRect();
              if (!rect) return;
              const yInBlock = e.clientY - (rect.top + top);
              const isResize = yInBlock > height - 8;
              setDragEventId(ev.id);
              setDragMode(isResize ? 'resize' : 'move');
              setDragStartY(e.clientY - rect.top);
              setDragOriginStart(start);
              setDragOriginEnd(end);
            }}
            onDoubleClick={(e) => { e.stopPropagation(); onSelect(ev); }}
          >
            <div className="px-1 py-0.5 truncate">{ev.title}</div>
            <div className="absolute left-0 right-0 bottom-0 h-1 bg-blue-400 cursor-ns-resize" />
          </div>
        );
      })}
      {previewStart && previewEnd && (
        <div
          className={
            `absolute left-1 right-1 rounded ${hasConflict(previewStart, previewEnd, dragEventId || undefined) ? 'bg-red-500/20 border border-red-500' : 'bg-blue-500/20 border border-blue-500'}`
          }
          style={{ top: timeToY(previewStart), height: Math.max(4, timeToY(previewEnd) - timeToY(previewStart)) }}
        />
      )}
    </div>
  );
}
