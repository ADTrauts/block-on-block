'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { calendarAPI, Calendar, EventItem, Attendee, EventComment } from '../../api/calendar';
import { useCalendarContext } from '../../contexts/CalendarContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useGlobalTrash } from '../../contexts/GlobalTrashContext';
import { toast } from 'react-hot-toast';

interface EventPayload {
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  onlineMeetingLink?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  timezone: string;
  attendees: Attendee[];
  recurrenceRule?: string;
  recurrenceEndAt?: string;
  editMode?: 'THIS';
  occurrenceStartAt?: string;
}

interface ConflictData {
  success: boolean;
  data: Array<{ id: string; calendarId: string; title: string; startAt: string; endAt: string; }>;
}

interface EventDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: EventItem;
  onCreated?: (event: EventItem) => void;
  onUpdated?: (event: EventItem) => void;
  contextType?: 'PERSONAL' | 'BUSINESS' | 'HOUSEHOLD';
  contextId?: string;
  defaultStart?: Date;
  defaultEnd?: Date;
}

interface ICSEventData {
  title?: string;
  startAt?: string;
  endAt?: string;
  description?: string;
  location?: string;
  allDay?: boolean;
  timezone?: string;
}

export default function EventDrawer({ isOpen, onClose, onCreated, onUpdated, contextType, contextId, defaultStart, defaultEnd, eventToEdit }: EventDrawerProps) {
  const { trashItem } = useGlobalTrash();
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState<string>('');
  const [endAt, setEndAt] = useState<string>('');
  const [allDay, setAllDay] = useState(false);
  const [timezone, setTimezone] = useState('UTC');
  const [calendarId, setCalendarId] = useState<string>('');
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [saving, setSaving] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number>(10);
  const [reminderMethod, setReminderMethod] = useState<'APP' | 'EMAIL'>('APP');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [onlineLink, setOnlineLink] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [comments, setComments] = useState<EventComment[]>([]);
  const [newComment, setNewComment] = useState('');
  // Recurrence fields (MVP)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState(''); // e.g., FREQ=WEEKLY;BYDAY=MO
  const [recurrenceEnd, setRecurrenceEnd] = useState<string>('');
  const [editSeriesMode, setEditSeriesMode] = useState<'THIS'|'SERIES'>('SERIES');
  const [ruleError, setRuleError] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    if (eventToEdit) {
      setTitle(eventToEdit.title);
      setCalendarId(eventToEdit.calendarId);
      setAllDay(eventToEdit.allDay);
      setTimezone(eventToEdit.timezone || 'UTC');
      setStartAt(toLocalInput(new Date(eventToEdit.startAt)));
      setEndAt(toLocalInput(new Date(eventToEdit.endAt)));
      setDescription(eventToEdit.description || '');
      setLocation(eventToEdit.location || '');
      setOnlineLink(eventToEdit.onlineMeetingLink || '');
      setAttendees(eventToEdit.attendees || []);
      // Load recurrence when available in payload
      if (eventToEdit.recurrenceRule) {
        setIsRecurring(true);
        setRecurrenceRule(eventToEdit.recurrenceRule);
        setRecurrenceEnd(eventToEdit.recurrenceEndAt ? new Date(eventToEdit.recurrenceEndAt).toISOString().slice(0,16) : '');
      } else {
        setIsRecurring(false);
        setRecurrenceRule('');
        setRecurrenceEnd('');
      }
      (async () => {
        const resp = await calendarAPI.listComments(eventToEdit.id);
        if (resp?.success) setComments(resp.data);
      })();
    } else {
      const start = defaultStart || new Date();
      const end = defaultEnd || new Date(start.getTime() + 60 * 60 * 1000);
      setStartAt(toLocalInput(start));
      setEndAt(toLocalInput(end));
      setTitle('');
      setDescription('');
      setLocation('');
      setOnlineLink('');
      setAttendees([]);
      setComments([]);
      setIsRecurring(false);
      setRecurrenceRule('');
      setRecurrenceEnd('');
      setEditSeriesMode('SERIES');
    }
  }, [isOpen, defaultStart, defaultEnd, eventToEdit]);

  const listParams = useMemo(() => {
    if (contextType && contextId) {
      return { contextType, contextId } as const;
    }
    return undefined;
  }, [contextType, contextId]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const resp = await calendarAPI.listCalendars(listParams as any);
      if (resp?.success) {
        setCalendars(resp.data);
        if (resp.data.length > 0) {
          const primary = resp.data.find(c => c.isPrimary) || resp.data[0];
          setCalendarId(primary.id);
        }
      }
    })();
  }, [isOpen, listParams]);

  const handleSave = async () => {
    if (!title || !startAt || !endAt || !calendarId) return;
    setSaving(true);
    try {
      // Basic RRULE validation
      if (isRecurring) {
        const rule = (recurrenceRule || '').trim().toUpperCase();
        if (!rule || !/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.test(rule)) {
          setRuleError('Please provide a valid RRULE (e.g., FREQ=WEEKLY;BYDAY=MO)');
          setSaving(false);
          return;
        }
        setRuleError('');
      }
      // Check conflicts before save (best effort)
      try {
        const conflicts = await calendarAPI.checkConflicts({
          start: new Date(startAt).toISOString(),
          end: new Date(endAt).toISOString(),
          calendarIds: [calendarId]
        });
        if ((conflicts as ConflictData)?.success && (conflicts as ConflictData).data?.length > 0) {
          const proceed = confirm(`This time conflicts with ${((conflicts as ConflictData).data).length} event(s). Continue?`);
          if (!proceed) { setSaving(false); return; }
        }
      } catch {}
      const payload: EventPayload = {
        calendarId,
        title,
        description,
        location,
        onlineMeetingLink: onlineLink,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        allDay,
        timezone,
        attendees,
        recurrenceRule: isRecurring && recurrenceRule ? recurrenceRule : undefined,
        recurrenceEndAt: isRecurring && recurrenceEnd ? new Date(recurrenceEnd).toISOString() : undefined,
      };
      if (eventToEdit?.id) {
        // If editing a recurring event and user chose THIS, pass editMode and occurrenceStartAt
        if (eventToEdit.recurrenceRule && editSeriesMode === 'THIS') {
          payload.editMode = 'THIS';
          payload.occurrenceStartAt = eventToEdit.occurrenceStartAt || eventToEdit.startAt;
        }
        const resp = await calendarAPI.updateEvent(eventToEdit.id, payload);
        if (resp?.success) {
          onUpdated?.(resp.data);
          onClose();
        }
      } else {
        const resp = await calendarAPI.createEvent({ ...payload, reminders: [{ minutesBefore: reminderMinutes, method: reminderMethod }] });
        if (resp?.success) {
          onCreated?.(resp.data);
          onClose();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-40 ${isOpen ? '' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity ${isOpen ? 'opacity-30' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">{eventToEdit ? 'Edit Event' : 'New Event'}</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="Event title" />
          </div>
          <div>
            <label className="block text-sm mb-1">Calendar</label>
            <select value={calendarId} onChange={e => setCalendarId(e.target.value)} className="w-full border rounded px-2 py-1">
              {calendars.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Start</label>
              <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm mb-1">End</label>
              <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
          </div>
          
          {/* Find time button */}
          {attendees.length > 0 && (
            <div className="flex justify-center">
              <button
                onClick={async () => {
                  try {
                    // Get free-busy for attendees and visible calendars
                    const attendeeEmails = attendees.map(a => a.email).filter(Boolean);
                    const visibleCalendarIds = Array.from(useCalendarContext().visibleCalendarIds);
                    
                    if (attendeeEmails.length === 0 && visibleCalendarIds.length === 0) return;
                    
                    // Get free-busy for next 7 days
                    const now = new Date();
                    const weekStart = new Date(now);
                    weekStart.setHours(0, 0, 0, 0);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    
                    const freeBusyResp = await calendarAPI.freeBusy({
                      start: weekStart.toISOString(),
                      end: weekEnd.toISOString(),
                      calendarIds: visibleCalendarIds
                    });
                    
                    if (freeBusyResp?.success) {
                      // Find open slots (simplified: look for 1-hour gaps)
                      const openSlots = [];
                      const busyTimes = freeBusyResp.data || [];
                      
                      // Group busy times by day and find gaps
                      for (let day = 0; day < 7; day++) {
                        const currentDay = new Date(weekStart);
                        currentDay.setDate(currentDay.getDate() + day);
                        
                        // Check each hour from 9 AM to 6 PM
                        for (let hour = 9; hour < 18; hour++) {
                          const slotStart = new Date(currentDay);
                          slotStart.setHours(hour, 0, 0, 0);
                          const slotEnd = new Date(slotStart);
                          slotEnd.setHours(hour + 1, 0, 0, 0);
                          
                          // Check if this slot conflicts with any busy time
                          const hasConflict = busyTimes.some((busy: { startAt: string; endAt: string }) => {
                            const busyStart = new Date(busy.startAt);
                            const busyEnd = new Date(busy.endAt);
                            return slotStart < busyEnd && slotEnd > busyStart;
                          });
                          
                          if (!hasConflict) {
                            openSlots.push({ start: slotStart, end: slotEnd });
                          }
                        }
                      }
                      
                      // Show suggestions (limit to 5)
                      if (openSlots.length > 0) {
                        const suggestions = openSlots.slice(0, 5);
                        const selectedSlot = suggestions[0]; // Use first suggestion
                        
                        if (confirm(`Found ${openSlots.length} open slots this week. Use the first available slot (${selectedSlot.start.toLocaleString()} - ${selectedSlot.end.toLocaleString()})?`)) {
                          setStartAt(selectedSlot.start.toISOString().slice(0, 16));
                          setEndAt(selectedSlot.end.toISOString().slice(0, 16));
                        }
                      } else {
                        alert('No open slots found in the next week. Try a different time range.');
                      }
                    }
                  } catch (error) {
                    console.error('Error finding available time:', error);
                    alert('Unable to find available time. Please check your calendar settings.');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                title="Find available time slots for all attendees"
              >
                🕐 Find Time
              </button>
            </div>
          )}
          
          {/* ICS Import */}
          <div className="flex justify-center">
            <div className="text-center">
              <label className="block text-sm mb-2">Import ICS File</label>
              <input
                type="file"
                accept=".ics,.ical"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !calendarId) return;
                  
                  try {
                    const text = await file.text();
                    // Basic ICS parsing (simplified)
                    const lines = text.split('\n');
                    let eventData: ICSEventData = {};
                    let currentEvent = '';
                    
                    for (const line of lines) {
                      if (line.startsWith('BEGIN:VEVENT')) {
                        currentEvent = 'event';
                        eventData = {};
                      } else if (line.startsWith('END:VEVENT')) {
                        currentEvent = '';
                        // Create event if we have basic data
                        if (eventData.title && eventData.startAt && eventData.endAt) {
                          const newEvent = await calendarAPI.createEvent({
                            calendarId,
                            title: eventData.title,
                            startAt: eventData.startAt,
                            endAt: eventData.endAt,
                            description: eventData.description || '',
                            location: eventData.location || '',
                            allDay: eventData.allDay || false,
                            timezone: eventData.timezone || 'UTC'
                          });
                          
                          if (newEvent?.success) {
                            alert('Event imported successfully!');
                            onCreated?.(newEvent.data);
                          }
                        }
                      } else if (currentEvent === 'event') {
                        const [key, value] = line.split(':', 2);
                        if (key === 'SUMMARY') eventData.title = value;
                        else if (key === 'DTSTART') eventData.startAt = new Date(value).toISOString();
                        else if (key === 'DTEND') eventData.endAt = new Date(value).toISOString();
                        else if (key === 'DESCRIPTION') eventData.description = value;
                        else if (key === 'LOCATION') eventData.location = value;
                        else if (key === 'X-MICROSOFT-CDO-ALLDAYEVENT') eventData.allDay = value === 'TRUE';
                        else if (key === 'TZID') eventData.timezone = value;
                      }
                    }
                  } catch (error) {
                    console.error('Error importing ICS:', error);
                    alert('Error importing ICS file. Please check the file format.');
                  }
                  
                  // Reset file input
                  e.target.value = '';
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <div className="text-xs text-gray-500 mt-1">Drag & drop or click to select .ics file</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="Office, Cafe, ..." />
            </div>
            <div>
              <label className="block text-sm mb-1">Online meeting link</label>
              <input value={onlineLink} onChange={e => setOnlineLink(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded px-2 py-1" rows={3} placeholder="Details, agenda, notes..." />
          </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Reminder</label>
            <input type="number" min={0} value={reminderMinutes} onChange={e => setReminderMinutes(parseInt(e.target.value || '0', 10))} className="w-full border rounded px-2 py-1" />
            <div className="text-[11px] text-gray-500 mt-1">minutes before</div>
          </div>
          <div>
            <label className="block text-sm mb-1">Method</label>
            <select value={reminderMethod} onChange={e => setReminderMethod(e.target.value as any)} className="w-full border rounded px-2 py-1">
              <option value="APP">In App</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>
        </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
              All day
            </label>
            <div className="ml-auto" />
          </div>
          {/* Edit scope for recurring series */}
          {eventToEdit?.recurrenceRule && (
            <div className="flex items-center gap-3 text-sm">
              <span>Edit:</span>
              <label className="inline-flex items-center gap-1">
                <input type="radio" name="editScope" checked={editSeriesMode==='THIS'} onChange={() => setEditSeriesMode('THIS')} />
                This event only
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" name="editScope" checked={editSeriesMode==='SERIES'} onChange={() => setEditSeriesMode('SERIES')} />
                Entire series
              </label>
            </div>
          )}
          {/* Recurrence (MVP) */}
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
              Repeat
            </label>
            {isRecurring && (
              <div className="space-y-2">
                <div>
                  <label className="block text-sm mb-1">RRULE</label>
                  <input value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR" />
                  {ruleError && <div className="text-xs text-red-600 mt-1">{ruleError}</div>}
                </div>
                <div>
                  <label className="block text-sm mb-1">Repeat until (optional)</label>
                  <input type="datetime-local" value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>
              </div>
            )}
          </div>
          {/* Attendees */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm">Attendees</label>
              {eventToEdit?.id && (
                <div className="text-xs text-gray-500">
                  RSVP:
                  <button className="ml-2 px-2 py-0.5 border rounded" onClick={async () => { const r = await calendarAPI.rsvp(eventToEdit.id!, 'ACCEPTED'); if (r?.success) setAttendees(r.data.attendees || []); }}>Accept</button>
                  <button className="ml-2 px-2 py-0.5 border rounded" onClick={async () => { const r = await calendarAPI.rsvp(eventToEdit.id!, 'DECLINED'); if (r?.success) setAttendees(r.data.attendees || []); }}>Decline</button>
                  <button className="ml-2 px-2 py-0.5 border rounded" onClick={async () => { const r = await calendarAPI.rsvp(eventToEdit.id!, 'TENTATIVE'); if (r?.success) setAttendees(r.data.attendees || []); }}>Maybe</button>
                </div>
              )}
            </div>
            <div className="flex gap-2 mb-2">
              <input className="flex-1 border rounded px-2 py-1" placeholder="Invite by email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <button className="px-2 py-1 border rounded" onClick={() => {
                if (!inviteEmail) return;
                setAttendees(prev => [...prev, { email: inviteEmail, response: 'NEEDS_ACTION' }]);
                setInviteEmail('');
              }}>Add</button>
            </div>
            {attendees.length > 0 && (
              <ul className="space-y-1">
                {attendees.map((a, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-center justify-between">
                    <span>{a.email || a.userId}</span>
                    <span className="text-xs text-gray-500">{a.response || 'NEEDS_ACTION'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
             <div className="flex justify-end gap-2">
            {eventToEdit?.id && (
              <button
                onClick={async () => {
                  if (!eventToEdit?.id) return;
                  setSaving(true);
                  try {
                    if (eventToEdit.recurrenceRule) {
                      const thisOnly = confirm('Delete this occurrence only? Press Cancel to delete the entire series.');
                      if (thisOnly) {
                        // For single occurrence, use API (creates exception)
                        await calendarAPI.deleteEvent(eventToEdit.id, { editMode: 'THIS', occurrenceStartAt: eventToEdit.occurrenceStartAt || eventToEdit.startAt });
                        toast.success('Occurrence deleted');
                      } else {
                        // For entire series, use global trash
                        await trashItem({
                          id: eventToEdit.id,
                          name: eventToEdit.title,
                          type: 'event',
                          moduleId: 'calendar',
                          moduleName: 'Calendar',
                          metadata: {
                            calendarId: eventToEdit.calendarId,
                          },
                        });
                        toast.success(`${eventToEdit.title} moved to trash`);
                      }
                    } else {
                      // For non-recurring events, use global trash
                      await trashItem({
                        id: eventToEdit.id,
                        name: eventToEdit.title,
                        type: 'event',
                        moduleId: 'calendar',
                        moduleName: 'Calendar',
                        metadata: {
                          calendarId: eventToEdit.calendarId,
                        },
                      });
                      toast.success(`${eventToEdit.title} moved to trash`);
                    }
                    onUpdated?.(eventToEdit);
                    onClose();
                  } catch (error) {
                    console.error('Failed to delete event:', error);
                    toast.error('Failed to delete event');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-3 py-1 border rounded text-red-600 border-red-300"
              >
                Delete
              </button>
            )}
            {eventToEdit?.recurrenceRule && (
              <button
                onClick={async () => {
                  if (!eventToEdit?.id) return;
                  setSaving(true);
                  try {
                    // For skipping single occurrence, use API (creates exception)
                    await calendarAPI.deleteEvent(eventToEdit.id, { editMode: 'THIS', occurrenceStartAt: eventToEdit.occurrenceStartAt || eventToEdit.startAt });
                    toast.success('Occurrence skipped');
                    onUpdated?.(eventToEdit);
                    onClose();
                  } catch (error) {
                    console.error('Failed to skip occurrence:', error);
                    toast.error('Failed to skip occurrence');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-3 py-1 border rounded text-orange-700 border-orange-300"
                title="Skip only this occurrence"
              >
                Skip occurrence
              </button>
            )}
            <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
            <button onClick={handleSave} disabled={saving || !title} className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : (eventToEdit ? 'Save' : 'Create')}</button>
          </div>
          {/* Comments */}
          {eventToEdit?.id && (
            <div className="pt-2 border-t">
              <div className="text-sm font-medium mb-2">Comments</div>
              <div className="space-y-2 max-h-40 overflow-auto">
                {comments.map(c => (
                  <div key={c.id} className="text-sm">
                    <div className="text-gray-800">{c.content}</div>
                    <div className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input className="flex-1 border rounded px-2 py-1" placeholder="Add a comment" value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                <button className="px-3 py-1 bg-gray-900 text-white rounded" onClick={async () => {
                  if (!newComment.trim()) return;
                  const resp = await calendarAPI.addComment(eventToEdit.id!, newComment.trim());
                  if (resp?.success) {
                    setComments(prev => [...prev, resp.data]);
                    setNewComment('');
                  }
                }}>Post</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

