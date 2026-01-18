'use client';

import React, { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Alert } from 'shared/components';
import { Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { calendarAPI } from '@/api/calendar';
import { useModuleIntegration } from '@/hooks/useModuleIntegration';
import { toast } from 'react-hot-toast';
import type { EmployeeOnboardingTask } from '@/api/hrOnboarding';

interface OnboardingCalendarIntegrationProps {
  businessId: string;
  task: EmployeeOnboardingTask;
  employeeName?: string;
  onEventCreated?: (eventId: string) => void;
}

export default function OnboardingCalendarIntegration({
  businessId,
  task,
  employeeName,
  onEventCreated,
}: OnboardingCalendarIntegrationProps) {
  const { data: session } = useSession();
  const { hasCalendar, loading: moduleLoading } = useModuleIntegration(businessId);
  const [creating, setCreating] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);

  const createCalendarEvent = useCallback(async () => {
    if (!session?.accessToken || !task.dueDate || task.taskType !== 'MEETING' && task.taskType !== 'TRAINING') {
      return;
    }

    try {
      setCreating(true);

      // Get or create business calendar
      const calendarsResponse = await calendarAPI.listCalendars({
        contextType: 'BUSINESS',
        contextId: businessId,
      });

      let calendarId: string;
      if (calendarsResponse.success && calendarsResponse.data.length > 0) {
        calendarId = calendarsResponse.data[0].id;
      } else {
        // Auto-provision calendar
        const provisionResponse = await calendarAPI.autoProvision({
          contextType: 'BUSINESS',
          contextId: businessId,
          name: 'Business Calendar',
        });
        if (!provisionResponse.success) {
          throw new Error('Failed to create calendar');
        }
        calendarId = provisionResponse.data.id;
      }

      // Create event
      const dueDate = new Date(task.dueDate);
      const startDate = new Date(dueDate);
      startDate.setHours(9, 0, 0, 0); // Default to 9 AM
      const endDate = new Date(startDate);
      endDate.setHours(10, 0, 0, 0); // Default 1 hour duration

      const eventResponse = await calendarAPI.createEvent({
        calendarId,
        title: `${task.title}${employeeName ? ` - ${employeeName}` : ''}`,
        description: task.description || undefined,
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        allDay: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (eventResponse.success && eventResponse.data) {
        setEventId(eventResponse.data.id);
        onEventCreated?.(eventResponse.data.id);
        toast.success('Event added to calendar');
      } else {
        throw new Error('Failed to create event');
      }
    } catch (err) {
      console.error('Failed to create calendar event:', err);
      toast.error('Failed to add event to calendar');
    } finally {
      setCreating(false);
    }
  }, [session?.accessToken, businessId, task, employeeName, onEventCreated]);

  if (moduleLoading) {
    return null;
  }

  if (!hasCalendar) {
    return (
      <Alert type="info" title="Calendar module not installed">
        <p className="text-sm text-gray-600">
          Install the Calendar module to sync onboarding meetings and training to your calendar.
        </p>
      </Alert>
    );
  }

  // Only show for MEETING or TRAINING tasks
  if (task.taskType !== 'MEETING' && task.taskType !== 'TRAINING') {
    return null;
  }

  if (eventId) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-900">Event added to calendar</span>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={createCalendarEvent}
      disabled={creating || !task.dueDate}
    >
      <CalendarIcon className="w-4 h-4 mr-2" />
      {creating ? 'Adding to Calendar...' : 'Add to Calendar'}
    </Button>
  );
}

