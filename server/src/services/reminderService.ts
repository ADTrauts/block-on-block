import { prisma } from '../lib/prisma';
import { NotificationService } from './notificationService';
import { getLocalYmd, zonedTimeToUtc } from '../utils/timezone';

// Minimal reminder dispatcher: check reminders within next N minutes and send in-app notifications
export async function dispatchDueReminders(lookaheadMinutes: number = 5): Promise<void> {
  try {
    const now = new Date();
    const lookahead = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

    // Pull reminders whose scheduled trigger time falls in (now, lookahead], and not yet dispatched
    let reminders;
    try {
      reminders = await (prisma as any).reminder.findMany({
        where: { dispatchedAt: null },
        include: { event: { include: { attendees: true } } }
      });
    } catch (dbError) {
      // Check if it's a database connection error
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      if (errorMessage.includes("Can't reach database") || errorMessage.includes('localhost:5432')) {
        // Silently skip if database is not available - will retry on next cron run
        return;
      }
      // Re-throw if it's a different database error
      throw dbError;
    }

    for (const reminder of reminders) {
      const ev = reminder.event as any;
      // Compute trigger time
      // Timed events: trigger = startAt - minutesBefore
      // All-day events: schedule reminder at 9:00 AM local time on the event day
      let triggerTime: Date;
      if (ev.allDay && ev.timezone) {
        const ymd = getLocalYmd(new Date(ev.startAt), ev.timezone);
        const nineLocalUtc = zonedTimeToUtc(ymd.year, ymd.month, ymd.day, 9, 0, ev.timezone);
        triggerTime = nineLocalUtc;
      } else {
        triggerTime = new Date(new Date(ev.startAt).getTime() - reminder.minutesBefore * 60000);
      }
      if (triggerTime > now && triggerTime <= lookahead) {
        // Send to event creator and all attendees with userId
        const recipientIds = new Set<string>();
        if (ev as any && (ev as any).createdById) recipientIds.add((ev as any).createdById);
        for (const att of ev.attendees) if (att.userId) recipientIds.add(att.userId);
        for (const userId of recipientIds) {
          try {
            await NotificationService.createNotification({
              userId,
              type: 'calendar_reminder',
              title: `Reminder: ${ev.title}`,
              body: `Starts at ${new Date(ev.startAt).toLocaleString()}`,
              data: { eventId: ev.id, calendarId: ev.calendarId, reminderId: reminder.id }
            });
          } catch (e) {
            console.error('Failed to send reminder notification:', e);
          }
        }
        try {
          await (prisma as any).reminder.update({ where: { id: reminder.id }, data: { dispatchedAt: new Date() } });
        } catch (updateError) {
          // Log but don't fail if reminder update fails
          const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
          if (!errorMessage.includes("Can't reach database") && !errorMessage.includes('localhost:5432')) {
            console.error('Failed to update reminder dispatchedAt:', updateError);
          }
        }
      }
    }
  } catch (error) {
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes("Can't reach database") || errorMessage.includes('localhost:5432')) {
      // Silently skip if database is not available - will retry on next cron run
      return;
    }
    // Log other errors
    console.error('❌ Error in reminder dispatcher:', error);
  }
}

