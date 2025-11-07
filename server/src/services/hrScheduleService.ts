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

  const scheduleEventId = await createOrUpdateEvent({
    eventId: existingScheduleEventId || undefined,
    calendarId: scheduleCalendarId,
    title,
    description,
    startAt: startDate,
    endAt: endExclusive,
    status: calendarStatus,
    allDay: true,
    attendeeEmail: employeeEmail
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
  isPersonal?: boolean;
}): Promise<string> {
  const { eventId, calendarId, title, description, startAt, endAt, status, allDay, attendeeEmail, isPersonal } = options;

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
        timezone: 'UTC',
        attendees: attendeeEmail
          ? {
              deleteMany: {},
              create: [{ email: attendeeEmail, response: status === 'CANCELED' ? 'DECLINED' : isPersonal ? 'ACCEPTED' : 'NEEDS_ACTION' }]
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
      timezone: 'UTC',
      attendees: attendeeEmail
        ? {
            create: [{ email: attendeeEmail, response: isPersonal ? 'ACCEPTED' : 'NEEDS_ACTION' }]
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

