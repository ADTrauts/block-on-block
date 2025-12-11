import { TimeOffStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const SCHEDULE_CALENDAR_NAME = 'Schedule';

type CalendarRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'READER' | 'FREE_BUSY';

export async function initializeHrScheduleForBusiness(businessId: string): Promise<void> {
  const calendarId = await ensureScheduleCalendar(businessId);
  await ensureMembersForScheduleCalendar(businessId, calendarId);
}

export async function addUsersToScheduleCalendar(businessId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  const settings = await prisma.hRModuleSettings.findUnique({ where: { businessId } });
  const calendarId = settings?.scheduleCalendarId;
  if (!calendarId) return;

  await upsertCalendarMembership(calendarId, businessId, userIds);
}

export async function syncTimeOffRequestCalendar(requestId: string): Promise<void> {
  const request = await prisma.timeOffRequest.findUnique({
    where: { id: requestId },
    include: {
      employeePosition: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          position: { include: { department: { select: { name: true } } } }
        }
      },
      business: { select: { id: true, name: true } }
    }
  });

  if (!request) return;

  const employee = request.employeePosition.user;
  if (!employee) {
    logger.warn('Time-off request missing associated employee user', { requestId });
    return;
  }

  const scheduleCalendarId = await ensureScheduleCalendar(request.businessId);
  await ensureMembersForScheduleCalendar(request.businessId, scheduleCalendarId, [employee.id]);

  const personalCalendarId = await ensurePersonalCalendar(employee.id);

  const { scheduleEventId, personalEventId } = await syncScheduleAndPersonalEvents({
    status: request.status,
    type: request.type,
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    managerNote: request.managerNote,
    employeeName: employee.name,
    employeeEmail: employee.email,
    scheduleCalendarId,
    personalCalendarId,
    existingScheduleEventId: request.scheduleEventId,
    existingPersonalEventId: request.personalEventId
  });

  await prisma.timeOffRequest.update({
    where: { id: request.id },
    data: {
      scheduleEventId,
      personalEventId
    }
  });
}

async function ensureScheduleCalendar(businessId: string): Promise<string> {
  const settings = await prisma.hRModuleSettings.upsert({
    where: { businessId },
    update: {},
    create: { businessId }
  });

  let calendarId = settings.scheduleCalendarId || undefined;

  if (calendarId) {
    const existing = await prisma.calendar.findUnique({ where: { id: calendarId } });
    if (!existing) {
      calendarId = undefined;
    }
  }

  if (!calendarId) {
    const calendar = await prisma.calendar.create({
      data: {
        name: SCHEDULE_CALENDAR_NAME,
        contextType: 'BUSINESS',
        contextId: businessId,
        isSystem: true,
        isDeletable: false,
        defaultReminderMinutes: 0
      }
    });
    calendarId = calendar.id;
    await prisma.hRModuleSettings.update({
      where: { businessId },
      data: { scheduleCalendarId: calendarId }
    });
  }

  return calendarId;
}

async function ensureMembersForScheduleCalendar(businessId: string, calendarId: string, userIds?: string[]): Promise<void> {
  if (userIds && userIds.length === 0) return;

  const members = await prisma.businessMember.findMany({
    where: {
      businessId,
      isActive: true,
      ...(userIds ? { userId: { in: userIds } } : {})
    },
    select: { userId: true, role: true, canManage: true }
  });

  if (members.length === 0) return;

  const ids = members.map((member) => member.userId);
  await upsertCalendarMembership(calendarId, businessId, ids, members);
}

async function upsertCalendarMembership(
  calendarId: string,
  businessId: string,
  userIds: string[],
  memberDetails?: Array<{ userId: string; role: string; canManage: boolean }>
): Promise<void> {
  const detailsMap = new Map<string, { role: string; canManage: boolean }>();
  if (memberDetails) {
    memberDetails.forEach((detail) => detailsMap.set(detail.userId, detail));
  } else {
    const members = await prisma.businessMember.findMany({
      where: { businessId, userId: { in: userIds }, isActive: true },
      select: { userId: true, role: true, canManage: true }
    });
    members.forEach((detail) => detailsMap.set(detail.userId, detail));
  }

  await Promise.all(
    userIds.map(async (userId) => {
      const detail = detailsMap.get(userId);
      const calendarRole: CalendarRole = determineCalendarRole(detail);

      await prisma.calendarMember.upsert({
        where: { calendarId_userId: { calendarId, userId } },
        create: { calendarId, userId, role: calendarRole },
        update: calendarRole === 'READER' ? {} : { role: calendarRole }
      });
    })
  );
}

function determineCalendarRole(detail?: { role: string; canManage: boolean }): CalendarRole {
  if (!detail) return 'READER';
  if (detail.role === 'ADMIN' || detail.canManage) return 'EDITOR';
  if (detail.role === 'MANAGER') return 'EDITOR';
  return 'READER';
}

async function ensurePersonalCalendar(userId: string): Promise<string> {
  const existing = await prisma.calendar.findFirst({
    where: { contextType: 'PERSONAL', contextId: userId, isPrimary: true }
  });
  if (existing) return existing.id;

  const dashboard = await prisma.dashboard.findFirst({
    where: { userId, businessId: null, institutionId: null, householdId: null },
    orderBy: { createdAt: 'asc' }
  });

  const calendar = await prisma.calendar.create({
    data: {
      name: dashboard?.name || 'My Dashboard',
      contextType: 'PERSONAL',
      contextId: userId,
      isPrimary: true,
      isSystem: true,
      isDeletable: false,
      defaultReminderMinutes: 10,
      members: { create: { userId, role: 'OWNER' } }
    }
  });
  return calendar.id;
}

async function syncScheduleAndPersonalEvents(params: {
  status: TimeOffStatus;
  type: string;
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  managerNote?: string | null;
  employeeName?: string | null;
  employeeEmail: string | null;
  scheduleCalendarId: string;
  personalCalendarId: string;
  existingScheduleEventId?: string | null;
  existingPersonalEventId?: string | null;
}): Promise<{ scheduleEventId: string; personalEventId: string }> {
  const {
    status,
    type,
    startDate,
    endDate,
    reason,
    managerNote,
    employeeName,
    employeeEmail,
    scheduleCalendarId,
    personalCalendarId,
    existingScheduleEventId,
    existingPersonalEventId
  } = params;

  const endExclusive = addOneDay(endDate);
  const title = buildEventTitle(type, employeeName, employeeEmail);
  const description = buildEventDescription(status, type, startDate, endDate, reason, managerNote);
  const calendarStatus = mapStatus(status);

  // Get employee userId if available (for better attendee matching)
  let employeeUserId: string | null = null;
  if (employeeEmail) {
    const user = await prisma.user.findUnique({
      where: { email: employeeEmail },
      select: { id: true }
    });
    employeeUserId = user?.id || null;
  }

  const scheduleEventId = await createOrUpdateEvent({
    eventId: existingScheduleEventId || undefined,
    calendarId: scheduleCalendarId,
    title,
    description,
    startAt: startDate,
    endAt: endExclusive,
    status: calendarStatus,
    allDay: true,
    attendeeEmail: employeeEmail,
    attendeeUserId: employeeUserId
  });

  const personalEventId = await createOrUpdateEvent({
    eventId: existingPersonalEventId || undefined,
    calendarId: personalCalendarId,
    title,
    description,
    startAt: startDate,
    endAt: endExclusive,
    status: calendarStatus,
    allDay: true,
    attendeeEmail: employeeEmail,
    attendeeUserId: employeeUserId,
    isPersonal: true
  });

  return { scheduleEventId, personalEventId };
}

async function createOrUpdateEvent(options: {
  eventId?: string;
  calendarId: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELED';
  allDay?: boolean;
  attendeeEmail: string | null;
  attendeeUserId?: string | null;
  isPersonal?: boolean;
  timezone?: string;
}): Promise<string> {
  const { eventId, calendarId, title, description, startAt, endAt, status, allDay, attendeeEmail, attendeeUserId, isPersonal, timezone } = options;
  
  // Use provided timezone or default to UTC
  const eventTimezone = timezone || 'UTC';

  if (eventId) {
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        title,
        description,
        startAt,
        endAt,
        status,
        allDay: allDay ?? false,
        timezone: eventTimezone,
        attendees: attendeeEmail
          ? {
              deleteMany: {},
              create: [{ 
                email: attendeeEmail, 
                userId: attendeeUserId || null,
                response: status === 'CANCELED' ? 'DECLINED' : isPersonal ? 'ACCEPTED' : 'NEEDS_ACTION' 
              }]
            }
          : { deleteMany: {} }
      }
    });
    return updated.id;
  }

  const created = await prisma.event.create({
    data: {
      calendarId,
      title,
      description,
      startAt,
      endAt,
      status,
      allDay: allDay ?? false,
      timezone: eventTimezone,
      attendees: attendeeEmail
        ? {
            create: [{ 
              email: attendeeEmail, 
              userId: attendeeUserId || null,
              response: isPersonal ? 'ACCEPTED' : 'NEEDS_ACTION' 
            }]
          }
        : undefined
    }
  });
  return created.id;
}

function buildEventTitle(type: string, employeeName?: string | null, email?: string | null): string {
  const label = employeeName && employeeName.trim().length > 0 ? employeeName : email || 'Employee';
  return `${label} – ${type}`;
}

function buildEventDescription(
  status: TimeOffStatus,
  type: string,
  startDate: Date,
  endDate: Date,
  reason?: string | null,
  managerNote?: string | null
): string {
  const lines = [
    `Status: ${status}`,
    `Type: ${type}`,
    `From: ${startDate.toDateString()}`,
    `To: ${endDate.toDateString()}`
  ];

  if (reason) {
    lines.push(`Reason: ${reason}`);
  }
  if (managerNote) {
    lines.push(`Manager Note: ${managerNote}`);
  }

  return lines.join('\n');
}

function mapStatus(status: TimeOffStatus): 'CONFIRMED' | 'TENTATIVE' | 'CANCELED' {
  switch (status) {
    case 'APPROVED':
      return 'CONFIRMED';
    case 'DENIED':
    case 'CANCELED':
      return 'CANCELED';
    case 'PENDING':
    default:
      return 'TENTATIVE';
  }
}

function addOneDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

/**
 * Sync all shifts from a published schedule to calendars
 * Creates events in both the business "Schedule" calendar AND employee personal calendars
 * This ensures events appear correctly in both the work calendar and personal calendars
 */
export async function syncScheduleShiftsToCalendar(scheduleId: string, businessId: string): Promise<void> {
  try {
    // Get schedule with all shift details including employee info
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        shifts: {
          include: {
            employeePosition: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                position: { select: { id: true, title: true } }
              }
            },
            position: { select: { id: true, title: true } },
            location: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!schedule) {
      logger.warn('Schedule not found for calendar sync', { scheduleId });
      return;
    }

    // Ensure "Schedule" calendar exists
    const scheduleCalendarId = await ensureScheduleCalendar(businessId);

    // Process each shift
    for (const shift of schedule.shifts) {
      try {
        const existingEventIds = getEventIdsFromShiftMetadata(shift.metadata);
        
        // Handle employee removal: if shift is now unassigned but had a previous employee, delete their personal calendar event
        if (!shift.employeePositionId && existingEventIds.personalEventId) {
          try {
            // Delete the old employee's personal calendar event
            await prisma.event.delete({
              where: { id: existingEventIds.personalEventId }
            });
            logger.info('Removed old employee personal calendar event during republish', {
              operation: 'sync_schedule_shifts_to_calendar',
              shiftId: shift.id,
              deletedEventId: existingEventIds.personalEventId
            });
          } catch (deleteError) {
            // Log but continue - event might already be deleted
            logger.warn('Failed to delete old personal calendar event during republish', {
              operation: 'sync_schedule_shifts_to_calendar',
              shiftId: shift.id,
              eventId: existingEventIds.personalEventId,
              error: {
                message: deleteError instanceof Error ? deleteError.message : 'Unknown error'
              }
            });
          }

          // Update Schedule calendar event to remove attendee (or update title for open shift)
          if (existingEventIds.scheduleEventId) {
            try {
              const startTime = new Date(shift.startTime);
              const endTime = new Date(shift.endTime);
              const timeRange = formatTimeRange(startTime, endTime);
              const positionTitle = shift.position?.title || 'Open Shift';
              
              await prisma.event.update({
                where: { id: existingEventIds.scheduleEventId },
                data: {
                  attendees: { deleteMany: {} },
                  title: `Open Shift - ${positionTitle} - ${timeRange}`,
                  description: buildShiftEventDescription(schedule, shift)
                }
              });
            } catch (updateError) {
              logger.warn('Failed to update schedule calendar event for unassigned shift', {
                operation: 'sync_schedule_shifts_to_calendar',
                shiftId: shift.id,
                error: {
                  message: updateError instanceof Error ? updateError.message : 'Unknown error'
                }
              });
            }
          }

          // Update metadata to clear personal event ID
          await prisma.scheduleShift.update({
            where: { id: shift.id },
            data: {
              metadata: {
                ...(shift.metadata as Record<string, unknown> || {}),
                calendarEvents: {
                  scheduleEventId: existingEventIds.scheduleEventId,
                  personalEventId: null
                }
              }
            }
          });
          continue; // Move to next shift
        }

        if (shift.employeePositionId && shift.employeePosition?.user) {
          // Assigned shift - create events in both Schedule calendar AND personal calendar
          const employee = shift.employeePosition.user;
          const employeeName = employee.name || employee.email || 'Employee';
          
          // Ensure employee has access to schedule calendar
          await ensureMembersForScheduleCalendar(businessId, scheduleCalendarId, [employee.id]);
          
          // Ensure employee has a personal calendar
          const personalCalendarId = await ensurePersonalCalendar(employee.id);
          
          // Check if employee changed: if we have a personalEventId but it's for a different employee, delete the old one
          if (existingEventIds.personalEventId) {
            const oldEvent = await prisma.event.findUnique({
              where: { id: existingEventIds.personalEventId },
              include: { attendees: true }
            });
            
            // If old event exists and is for a different employee, delete it
            if (oldEvent) {
              const oldEventAttendee = oldEvent.attendees.find(a => a.userId);
              if (oldEventAttendee && oldEventAttendee.userId !== employee.id) {
                try {
                  await prisma.event.delete({
                    where: { id: existingEventIds.personalEventId }
                  });
                  logger.info('Deleted old employee personal calendar event (employee changed during republish)', {
                    operation: 'sync_schedule_shifts_to_calendar',
                    shiftId: shift.id,
                    oldEmployeeId: oldEventAttendee.userId,
                    newEmployeeId: employee.id
                  });
                  // Clear the old event ID so we create a new one
                  existingEventIds.personalEventId = undefined;
                } catch (deleteError) {
                  logger.warn('Failed to delete old personal calendar event during republish', {
                    operation: 'sync_schedule_shifts_to_calendar',
                    shiftId: shift.id,
                    error: {
                      message: deleteError instanceof Error ? deleteError.message : 'Unknown error'
                    }
                  });
                }
              }
            }
          }
          
          // Build event details
          const positionTitle = shift.position?.title || shift.employeePosition?.position?.title || 'Shift';
          const startTime = new Date(shift.startTime);
          const endTime = new Date(shift.endTime);
          const timeRange = formatTimeRange(startTime, endTime);
          
          const title = `${employeeName} - ${positionTitle} - ${timeRange}`;
          const description = buildShiftEventDescription(schedule, shift);
          
          // Create/update event in "Schedule" calendar
          const scheduleEventId = await createOrUpdateEvent({
            eventId: existingEventIds.scheduleEventId || undefined,
            calendarId: scheduleCalendarId,
            title,
            description,
            startAt: startTime,
            endAt: endTime,
            status: 'CONFIRMED',
            allDay: false,
            attendeeEmail: employee.email,
            attendeeUserId: employee.id,
            timezone: schedule.timezone || 'UTC'
          });
          
          // Create/update event in employee's personal calendar
          const personalEventId = await createOrUpdateEvent({
            eventId: existingEventIds.personalEventId || undefined,
            calendarId: personalCalendarId,
            title,
            description,
            startAt: startTime,
            endAt: endTime,
            status: 'CONFIRMED',
            allDay: false,
            attendeeEmail: employee.email,
            attendeeUserId: employee.id,
            isPersonal: true,
            timezone: schedule.timezone || 'UTC'
          });
          
          // Store both event IDs in shift metadata
          await prisma.scheduleShift.update({
            where: { id: shift.id },
            data: {
              metadata: {
                ...(shift.metadata as Record<string, unknown> || {}),
                calendarEvents: {
                  scheduleEventId,
                  personalEventId
                }
              }
            }
          });
        } else {
          // Open shift - create event in "Schedule" calendar only
          const startTime = new Date(shift.startTime);
          const endTime = new Date(shift.endTime);
          const timeRange = formatTimeRange(startTime, endTime);
          const positionTitle = shift.position?.title || 'Open Shift';
          
          const title = `Open Shift - ${positionTitle} - ${timeRange}`;
          const description = buildShiftEventDescription(schedule, shift);
          
          // Get existing event ID from shift metadata
          const existingEventIds = getEventIdsFromShiftMetadata(shift.metadata);
          
          // Create/update event in "Schedule" calendar only
          const scheduleEventId = await createOrUpdateEvent({
            eventId: existingEventIds.scheduleEventId || undefined,
            calendarId: scheduleCalendarId,
            title,
            description,
            startAt: startTime,
            endAt: endTime,
            status: 'CONFIRMED',
            allDay: false,
            attendeeEmail: null,
            timezone: schedule.timezone || 'UTC'
          });
          
          // Store event ID in shift metadata
          await prisma.scheduleShift.update({
            where: { id: shift.id },
            data: {
              metadata: {
                ...(shift.metadata as Record<string, unknown> || {}),
                calendarEvents: {
                  scheduleEventId,
                  personalEventId: null
                }
              }
            }
          });
        }
      } catch (shiftError) {
        // Log but continue with other shifts
        logger.warn('Failed to sync shift to calendar', {
          operation: 'sync_schedule_shifts_to_calendar',
          shiftId: shift.id,
          error: {
            message: shiftError instanceof Error ? shiftError.message : 'Unknown error',
            stack: shiftError instanceof Error ? shiftError.stack : undefined
          }
        });
      }
    }

    logger.info('Schedule shifts synced to calendar', {
      operation: 'sync_schedule_shifts_to_calendar',
      scheduleId,
      businessId,
      shiftCount: schedule.shifts.length
    });
  } catch (error) {
    logger.error('Failed to sync schedule shifts to calendar', {
      operation: 'sync_schedule_shifts_to_calendar',
      scheduleId,
      businessId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    throw error;
  }
}

/**
 * Sync a single shift to calendar (for updates)
 */
export async function syncSingleShiftToCalendar(shiftId: string, businessId: string): Promise<void> {
  try {
    const shift = await prisma.scheduleShift.findUnique({
      where: { id: shiftId },
      include: {
        schedule: {
          select: { id: true, name: true, businessId: true }
        },
        employeePosition: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            position: { select: { id: true, title: true } }
          }
        },
        position: { select: { id: true, title: true } },
        location: { select: { id: true, name: true } }
      }
    });

    if (!shift) {
      logger.warn('Shift not found for calendar sync', { shiftId });
      return;
    }

    // Only sync if schedule is published
    const schedule = await prisma.schedule.findUnique({
      where: { id: shift.scheduleId },
      select: { status: true }
    });

    if (!schedule || schedule.status !== 'PUBLISHED') {
      return; // Don't sync unpublished schedules
    }

    const scheduleCalendarId = await ensureScheduleCalendar(businessId);
    const existingEventIds = getEventIdsFromShiftMetadata(shift.metadata);

    // Handle employee removal: if shift is now unassigned but had a previous employee, delete their personal calendar event
    if (!shift.employeePositionId && existingEventIds.personalEventId) {
      try {
        // Delete the old employee's personal calendar event
        await prisma.event.delete({
          where: { id: existingEventIds.personalEventId }
        });
        logger.info('Removed old employee personal calendar event', {
          operation: 'sync_single_shift_to_calendar',
          shiftId,
          deletedEventId: existingEventIds.personalEventId
        });
      } catch (deleteError) {
        // Log but continue - event might already be deleted
        logger.warn('Failed to delete old personal calendar event', {
          operation: 'sync_single_shift_to_calendar',
          shiftId,
          eventId: existingEventIds.personalEventId,
          error: {
            message: deleteError instanceof Error ? deleteError.message : 'Unknown error'
          }
        });
      }

      // Update Schedule calendar event to remove attendee (or delete if it was employee-specific)
      if (existingEventIds.scheduleEventId) {
        try {
          await prisma.event.update({
            where: { id: existingEventIds.scheduleEventId },
            data: {
              attendees: { deleteMany: {} },
              title: `Open Shift - ${shift.position?.title || 'Shift'} - ${formatTimeRange(new Date(shift.startTime), new Date(shift.endTime))}`
            }
          });
        } catch (updateError) {
          logger.warn('Failed to update schedule calendar event for unassigned shift', {
            operation: 'sync_single_shift_to_calendar',
            shiftId,
            error: {
              message: updateError instanceof Error ? updateError.message : 'Unknown error'
            }
          });
        }
      }

      // Update metadata to clear personal event ID
      await prisma.scheduleShift.update({
        where: { id: shiftId },
        data: {
          metadata: {
            ...(shift.metadata as Record<string, unknown> || {}),
            calendarEvents: {
              scheduleEventId: existingEventIds.scheduleEventId,
              personalEventId: null
            }
          }
        }
      });
      return; // Done handling unassigned shift
    }

    if (shift.employeePositionId && shift.employeePosition?.user) {
      // Assigned shift - create/update events in both Schedule calendar AND personal calendar
      const employee = shift.employeePosition.user;
      const employeeName = employee.name || employee.email || 'Employee';
      const positionTitle = shift.position?.title || shift.employeePosition?.position?.title || 'Shift';
      const startTime = new Date(shift.startTime);
      const endTime = new Date(shift.endTime);
      const timeRange = formatTimeRange(startTime, endTime);
      
      const title = `${employeeName} - ${positionTitle} - ${timeRange}`;
      const description = buildShiftEventDescription(shift.schedule, shift);
      
      // Check if employee changed: if we have a personalEventId but it's for a different employee, delete the old one
      if (existingEventIds.personalEventId) {
        const oldEvent = await prisma.event.findUnique({
          where: { id: existingEventIds.personalEventId },
          include: { attendees: true }
        });
        
        // If old event exists and is for a different employee, delete it
        if (oldEvent) {
          const oldEventAttendee = oldEvent.attendees.find(a => a.userId);
          if (oldEventAttendee && oldEventAttendee.userId !== employee.id) {
            try {
              await prisma.event.delete({
                where: { id: existingEventIds.personalEventId }
              });
              logger.info('Deleted old employee personal calendar event (employee changed)', {
                operation: 'sync_single_shift_to_calendar',
                shiftId,
                oldEmployeeId: oldEventAttendee.userId,
                newEmployeeId: employee.id
              });
              // Clear the old event ID so we create a new one
              existingEventIds.personalEventId = undefined;
            } catch (deleteError) {
              logger.warn('Failed to delete old personal calendar event', {
                operation: 'sync_single_shift_to_calendar',
                shiftId,
                error: {
                  message: deleteError instanceof Error ? deleteError.message : 'Unknown error'
                }
              });
            }
          }
        }
      }
      
      // Ensure employee has access to schedule calendar
      await ensureMembersForScheduleCalendar(businessId, scheduleCalendarId, [employee.id]);
      
      // Ensure employee has a personal calendar
      const personalCalendarId = await ensurePersonalCalendar(employee.id);
      
      // Get schedule to access timezone
      const scheduleForTimezone = await prisma.schedule.findUnique({
        where: { id: shift.scheduleId },
        select: { timezone: true }
      });
      const eventTimezone = scheduleForTimezone?.timezone || 'UTC';
      
      // Update/create event in Schedule calendar
      const scheduleEventId = await createOrUpdateEvent({
        eventId: existingEventIds.scheduleEventId || undefined,
        calendarId: scheduleCalendarId,
        title,
        description,
        startAt: startTime,
        endAt: endTime,
        status: 'CONFIRMED',
        allDay: false,
        attendeeEmail: employee.email,
        attendeeUserId: employee.id,
        timezone: eventTimezone
      });
      
      // Update/create event in employee's personal calendar
      const personalEventId = await createOrUpdateEvent({
        eventId: existingEventIds.personalEventId || undefined,
        calendarId: personalCalendarId,
        title,
        description,
        startAt: startTime,
        endAt: endTime,
        status: 'CONFIRMED',
        allDay: false,
        attendeeEmail: employee.email,
        attendeeUserId: employee.id,
        isPersonal: true,
        timezone: eventTimezone
      });
      
      // Update metadata with both event IDs
      await prisma.scheduleShift.update({
        where: { id: shiftId },
        data: {
          metadata: {
            ...(shift.metadata as Record<string, unknown> || {}),
            calendarEvents: {
              scheduleEventId,
              personalEventId
            }
          }
        }
      });
    } else {
      // Open shift - schedule calendar only
      const startTime = new Date(shift.startTime);
      const endTime = new Date(shift.endTime);
      const timeRange = formatTimeRange(startTime, endTime);
      const positionTitle = shift.position?.title || 'Open Shift';
      
      const title = `Open Shift - ${positionTitle} - ${timeRange}`;
      const description = buildShiftEventDescription(shift.schedule, shift);
      
      // Get schedule to access timezone
      const scheduleForTimezone = await prisma.schedule.findUnique({
        where: { id: shift.scheduleId },
        select: { timezone: true }
      });
      const eventTimezone = scheduleForTimezone?.timezone || 'UTC';
      
      const scheduleEventId = await createOrUpdateEvent({
        eventId: existingEventIds.scheduleEventId || undefined,
        calendarId: scheduleCalendarId,
        title,
        description,
        startAt: startTime,
        endAt: endTime,
        status: 'CONFIRMED',
        allDay: false,
        attendeeEmail: null,
        timezone: eventTimezone
      });
      
      await prisma.scheduleShift.update({
        where: { id: shiftId },
        data: {
          metadata: {
            ...(shift.metadata as Record<string, unknown> || {}),
            calendarEvents: {
              scheduleEventId,
              personalEventId: null
            }
          }
        }
      });
    }

    logger.info('Shift synced to calendar', {
      operation: 'sync_single_shift_to_calendar',
      shiftId,
      businessId
    });
  } catch (error) {
    logger.error('Failed to sync shift to calendar', {
      operation: 'sync_single_shift_to_calendar',
      shiftId,
      businessId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    throw error;
  }
}

/**
 * Helper: Extract event IDs from shift metadata
 */
function getEventIdsFromShiftMetadata(metadata: unknown): { scheduleEventId?: string; personalEventId?: string } {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  
  const meta = metadata as Record<string, unknown>;
  const calendarEvents = meta.calendarEvents;
  
  if (!calendarEvents || typeof calendarEvents !== 'object') {
    return {};
  }
  
  const events = calendarEvents as Record<string, unknown>;
  return {
    scheduleEventId: events.scheduleEventId as string | undefined,
    personalEventId: events.personalEventId as string | undefined
  };
}

/**
 * Helper: Format time range for event title
 */
function formatTimeRange(start: Date, end: Date): string {
  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };
  
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Helper: Build event description for shift
 */
function buildShiftEventDescription(
  schedule: { id: string; name: string },
  shift: {
    title?: string;
    notes?: string | null;
    breakMinutes?: number | null;
    location?: { name: string } | null;
    position?: { title: string } | null;
  }
): string {
  const lines: string[] = [
    `Schedule: ${schedule.name}`,
    `Shift: ${shift.title || 'Work Shift'}`
  ];
  
  if (shift.position?.title) {
    lines.push(`Position: ${shift.position.title}`);
  }
  
  if (shift.location?.name) {
    lines.push(`Location: ${shift.location.name}`);
  }
  
  if (shift.breakMinutes && shift.breakMinutes > 0) {
    const breakHours = Math.floor(shift.breakMinutes / 60);
    const breakMins = shift.breakMinutes % 60;
    const breakText = breakHours > 0 
      ? `${breakHours}h ${breakMins}m`
      : `${breakMins}m`;
    lines.push(`Break: ${breakText}`);
  }
  
  if (shift.notes) {
    lines.push(`Notes: ${shift.notes}`);
  }
  
  return lines.join('\n');
}

