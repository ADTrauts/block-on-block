'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { calendarAPI, EventItem } from '../../../api/calendar';
import { useDashboard } from '../../../contexts/DashboardContext';
import { CalendarProvider, useCalendarContext } from '../../../contexts/CalendarContext';
import CalendarListSidebar from '../../../components/calendar/CalendarListSidebar';
import EventDrawer from '../../../components/calendar/EventDrawer';
import { useSession } from 'next-auth/react';
import { chatSocket } from '../../../lib/chatSocket';

function DayInner() {
  const router = useRouter();
  const { currentDashboard, getDashboardType, getDashboardDisplayName } = useDashboard();
  const { visibleCalendarIds } = useCalendarContext();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [draftStart, setDraftStart] = useState<Date | undefined>();
  const [draftEnd, setDraftEnd] = useState<Date | undefined>();
  const { data: session } = useSession();
  const [showAvailability, setShowAvailability] = useState(false);
  const [busy, setBusy] = useState<{ startAt: string; endAt: string }[]>([]);
  const [myEventsOnly, setMyEventsOnly] = useState(false);

  // Backend expects dashboard IDs for contexts, not formatted strings
  // It will look up the dashboard and determine context type automatically
  // For personal dashboards, it resolves to PERSONAL:userId
  // For business/household, it resolves to BUSINESS:businessId or HOUSEHOLD:householdId
  const contextFilter = useMemo(() => {
    if (!currentDashboard) return [] as string[];
    const type = getDashboardType(currentDashboard).toUpperCase();
    if (type === 'PERSONAL') {
      // Pass dashboard ID - backend will resolve to PERSONAL:userId
      return [currentDashboard.id];
    } else {
      // For business/household, pass the businessId/householdId
      const id = (currentDashboard as any).business?.id || (currentDashboard as any).household?.id;
      return id ? [id] : [currentDashboard.id];
    }
  }, [currentDashboard, getDashboardType]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), 0, 0, 0);
        const end = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), 23, 59, 59);
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

  const hours = Array.from({ length: 24 }, (_, h) => h);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (key === 'd') router.push('/calendar/day');
      if (key === 'w') router.push('/calendar/week');
      if (key === 'm') router.push('/calendar/month');
      if (key === 'y') router.push('/calendar/year');
      if (key === 'n') {
        const start = new Date(viewDate);
        start.setHours(9,0,0,0);
        const end = new Date(start.getTime() + 60*60*1000);
        setEditingEvent(null);
        setDraftStart(start);
        setDraftEnd(end);
        setShowDrawer(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router, viewDate]);

  // Realtime updates
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
          const idx = prev.findIndex(e => e.id === incoming.id);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = { ...next[idx], ...incoming };
            return next;
          }
          return [incoming, ...prev];
        });
      };
      (chatSocket as any).on?.('calendar_event', handler as any);
      unsubscribe = () => { (chatSocket as any).off?.('calendar_event', handler as any); };
    })();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [session]);

  // Load availability when toggled
  useEffect(() => {
    (async () => {
      if (!showAvailability) { setBusy([]); return; }
      const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), 0, 0, 0);
      const end = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), 23, 59, 59);
      const selectedIds = Array.from(visibleCalendarIds);
      const calendarIds = selectedIds.length > 0 ? selectedIds : Array.from(new Set(events.map(e => e.calendarId)));
      if (calendarIds.length === 0) { setBusy([]); return; }
      try {
        const resp = await calendarAPI.freeBusy({ start: start.toISOString(), end: end.toISOString(), calendarIds });
        if ((resp as any)?.success) setBusy((resp as any).data);
      } catch {}
    })();
  }, [showAvailability, viewDate, visibleCalendarIds, events]);

  const handleUpdateEventTime = async (ev: EventItem, newStart: Date, newEnd: Date) => {
    try {
      const payload: any = { startAt: newStart.toISOString(), endAt: newEnd.toISOString() };
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
    } catch {}
  };

  return (
    <div className="flex h-full">
      <CalendarListSidebar />
      <div className="flex-1 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Calendar — Day</h1>
            <div className="ml-2 grid grid-cols-4 gap-2 text-xs">
              <a className="px-2 py-1 border rounded text-center bg-gray-100" href="/calendar/day">Day</a>
              <a className="px-2 py-1 border rounded text-center hover:bg-gray-50" href="/calendar/week">Week</a>
              <a className="px-2 py-1 border rounded text-center hover:bg-gray-50" href="/calendar/month">Month</a>
              <a className="px-2 py-1 border rounded text-center hover:bg-gray-50" href="/calendar/year">Year</a>
            </div>
            <div className="flex items-center gap-1 ml-3">
              <button className="px-2 py-1 border rounded" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()-1))}>{'<'}</button>
              <button className="px-2 py-1 border rounded" onClick={() => setViewDate(new Date())}>Today</button>
              <button className="px-2 py-1 border rounded" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()+1))}>{'>'}</button>
              <div className="ml-2 text-sm text-gray-600">{viewDate.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="px-3 py-1 border rounded"
              onClick={() => {
                const start = new Date(viewDate);
                start.setHours(9,0,0,0);
                const end = new Date(start.getTime() + 60*60*1000);
                setEditingEvent(null);
                setDraftStart(start);
                setDraftEnd(end);
                setShowDrawer(true);
              }}
            >
              New Event
            </button>
            <button
              className={`px-3 py-1 border rounded ${showAvailability ? 'bg-blue-50 border-blue-300' : ''}`}
              onClick={() => setShowAvailability(v => !v)}
              title="Toggle availability overlay"
            >
              Availability
            </button>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={myEventsOnly} onChange={(e) => setMyEventsOnly(e.target.checked)} />
              My events
            </label>
            <div className="text-sm text-gray-500">{currentDashboard ? getDashboardDisplayName(currentDashboard) : 'All Tabs'}</div>
          </div>
        </div>

        {loading && <div>Loading…</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && (
          <DayColumn
            date={viewDate}
            events={events}
            onCreate={(start, end) => { setEditingEvent(null); setDraftStart(start); setDraftEnd(end); setShowDrawer(true); }}
            onSelect={(ev) => { setEditingEvent(ev); setShowDrawer(true); }}
            onUpdateTime={handleUpdateEventTime}
            busy={showAvailability ? busy : []}
            myEventsOnly={myEventsOnly}
            currentUserId={(session as any)?.user?.id}
          />
        )}

        <EventDrawer
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          onCreated={() => setShowDrawer(false)}
          onUpdated={() => setShowDrawer(false)}
          contextType={currentDashboard ? (getDashboardType(currentDashboard).toUpperCase() as any) : undefined}
          contextId={(currentDashboard as any)?.business?.id || (currentDashboard as any)?.household?.id || currentDashboard?.id}
          eventToEdit={editingEvent || undefined}
          defaultStart={draftStart}
          defaultEnd={draftEnd}
        />
      </div>
    </div>
  );
}

export default function CalendarDayPage() {
  return (
    <CalendarProvider>
      <DayInner />
    </CalendarProvider>
  );
}

function DayColumn({ date, events, onCreate, onSelect, onUpdateTime, busy, myEventsOnly, currentUserId }: { date: Date; events: EventItem[]; onCreate: (start: Date, end: Date) => void; onSelect: (ev: EventItem) => void; onUpdateTime: (ev: EventItem, start: Date, end: Date) => void; busy: { startAt: string; endAt: string }[]; myEventsOnly: boolean; currentUserId?: string; }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragEndY, setDragEndY] = useState<number | null>(null);
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'move'|'resize'|null>(null);
  const [dragOriginStart, setDragOriginStart] = useState<Date | null>(null);
  const [dragOriginEnd, setDragOriginEnd] = useState<Date | null>(null);
  const [previewStart, setPreviewStart] = useState<Date | null>(null);
  const [previewEnd, setPreviewEnd] = useState<Date | null>(null);

  const pxToTime = (y: number): Date => {
    const rect = ref.current?.getBoundingClientRect();
    const height = rect?.height || 24 * 40;
    const ratio = Math.max(0, Math.min(1, y / height));
    const minutesFromStart = Math.round(ratio * 24 * 60 / 15) * 15;
    const base = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    base.setMinutes(minutesFromStart);
    return base;
  };

  const timeToY = (d: Date): number => {
    const rect = ref.current?.getBoundingClientRect();
    const height = rect?.height || 24 * 40;
    const minutes = d.getHours() * 60 + d.getMinutes();
    return (minutes / (24 * 60)) * height;
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
        const deltaMinutes = (y - (dragStartY ?? 0)) / (rect.height || 1) * (24 * 60);
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
      const rect = ref.current?.getBoundingClientRect();
      const startY = dragStartY ?? 0;
      const endY = dragEndY;
      if (dragMode === 'move') {
        const deltaMinutes = (endY - startY) / (rect?.height || 1) * (24 * 60);
        const newStart = new Date(dragOriginStart);
        const newEnd = new Date(dragOriginEnd);
        newStart.setMinutes(newStart.getMinutes() + Math.round(deltaMinutes / 15) * 15);
        newEnd.setMinutes(newEnd.getMinutes() + Math.round(deltaMinutes / 15) * 15);
        const ev = events.find(e => e.id === dragEventId);
        if (ev) onUpdateTime(ev, newStart, newEnd);
      } else if (dragMode === 'resize') {
        const start = dragOriginStart;
        const end = pxToTime(endY);
        if (end > start) {
          const ev = events.find(e => e.id === dragEventId);
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

  const dayEvents = events
    .filter(ev => {
      if (!myEventsOnly || !currentUserId) return true;
      return ev.createdById === currentUserId;
    })
    .map(ev => ({ ev, start: new Date(ev.occurrenceStartAt || ev.startAt), end: new Date(ev.occurrenceEndAt || ev.endAt) }))
    .filter(({ start, end }) => start.toDateString() === date.toDateString() || end.toDateString() === date.toDateString());

  return (
    <div className="grid grid-cols-[60px_1fr] gap-2">
      <div>
        {hours.map(h => (
          <div key={h} className="h-12 text-xs text-gray-400">{`${h}:00`}</div>
        ))}
      </div>
      <div
        ref={ref}
        className="relative border rounded"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onMouseUp={handleMouseUp}
      >
        {hours.map(h => (
          <div key={h} className="h-12 border-b" />
        ))}
        {/* Busy overlay */}
        {busy.map((b, idx) => {
          const s = new Date(b.startAt);
          const e = new Date(b.endAt);
          if (s.toDateString() !== date.toDateString() && e.toDateString() !== date.toDateString()) return null;
          const top = timeToY(s);
          const height = Math.max(4, timeToY(e) - timeToY(s));
          return (
            <div key={idx} className="absolute left-1 right-1 bg-gray-300/30 rounded" style={{ top, height }} />
          );
        })}
        {dayEvents.map(({ ev, start, end }) => {
          const top = timeToY(start);
          const height = Math.max(10, timeToY(end) - timeToY(start));
          return (
            <div
              key={ev.id + (ev.occurrenceStartAt || '')}
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
            className="absolute left-1 right-1 bg-blue-500/20 border border-blue-500 rounded"
            style={{ top: timeToY(previewStart), height: Math.max(4, timeToY(previewEnd) - timeToY(previewStart)) }}
          />
        )}
      </div>
    </div>
  );
}
