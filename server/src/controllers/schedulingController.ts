import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/schedulingPermissions';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { Prisma, BusinessRole, SchedulingStrategy, JobFunction, StationType, ScheduleStatus, AttendanceRecordStatus } from '@prisma/client';
import { getRecommendedSchedulingConfig } from '../services/schedulingRecommendationService';
import { SchedulingPhilosophyService } from '../services/schedulingPhilosophyService';
import { getChatSocketService } from '../services/chatSocketService';

const TIME_FIELD_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ============================================================================
// ADMIN - Schedule Management
// ============================================================================

export async function getSchedules(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { businessId, status, startDate, endDate } = req.query;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    const where: Prisma.ScheduleWhereInput = {
      businessId
    };

    if (
      status &&
      typeof status === 'string' &&
      ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status.toUpperCase())
    ) {
      where.status = status.toUpperCase() as ScheduleStatus;
    }

    if (startDate || endDate) {
      const dateFilters: Prisma.ScheduleWhereInput[] = [];
      if (startDate && typeof startDate === 'string') {
        dateFilters.push({ startDate: { gte: new Date(startDate) } });
      }
      if (endDate && typeof endDate === 'string') {
        dateFilters.push({ endDate: { lte: new Date(endDate) } });
      }
      if (dateFilters.length > 0) {
        where.AND = dateFilters;
      }
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        shifts: {
          include: {
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                },
                position: {
                  select: {
                    title: true
                  }
                }
              }
            },
            position: {
              select: {
                id: true,
                title: true
              }
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    // Return schedules with shifts included
    const schedulesWithShifts = schedules.map(schedule => ({
      id: schedule.id,
      businessId: schedule.businessId,
      name: schedule.name,
      description: schedule.description,
      locationId: schedule.locationId,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      timezone: schedule.timezone,
      status: schedule.status,
      publishedAt: schedule.publishedAt,
      publishedById: schedule.publishedById,
      templateId: schedule.templateId,
      metadata: schedule.metadata,
      createdById: schedule.createdById,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
      shifts: schedule.shifts || []
    }));

    // Debug: Log shift counts
    const totalShifts = schedulesWithShifts.reduce((sum, s) => sum + (s.shifts?.length || 0), 0);
    logger.info('Schedules retrieved', {
      operation: 'list_schedules',
      userId: user.id,
      businessId,
      scheduleCount: schedulesWithShifts.length,
      totalShiftCount: totalShifts,
      schedulesWithShifts: schedulesWithShifts.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        shiftCount: s.shifts?.length || 0,
        firstShiftDate: s.shifts?.[0]?.startTime || null
      }))
    });

    res.json({ schedules: schedulesWithShifts });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    const businessIdParam = typeof req.query.businessId === 'string' ? req.query.businessId : undefined;
    
    logger.error('Failed to list schedules', {
      operation: 'list_schedules',
      userId: req.user?.id,
      businessId: businessIdParam,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });
    res.status(500).json({ 
      error: 'Failed to retrieve schedules',
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

export async function getScheduleById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        shifts: {
          include: {
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                },
                position: {
                  select: {
                    title: true
                  }
                }
              }
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        publishedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    logger.info('Schedule retrieved', {
      operation: 'get_schedule',
      userId: user.id,
      scheduleId: id
    });

    res.json({ schedule });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get schedule', {
      operation: 'get_schedule',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to retrieve schedule' });
  }
}

export async function createSchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { businessId, name, description, startDate, endDate, timezone, templateId } = req.body;

    if (!businessId || !name || !startDate || !endDate) {
      res.status(400).json({ error: 'Missing required fields: businessId, name, startDate, endDate' });
      return;
    }

    const schedule = await prisma.schedule.create({
      data: {
        businessId,
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        timezone: timezone || 'America/New_York',
        templateId,
        createdById: user.id,
        status: 'DRAFT'
      }
    });

    logger.info('Schedule created', {
      operation: 'create_schedule',
      userId: user.id,
      scheduleId: schedule.id,
      businessId
    });

    res.status(201).json({ schedule });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to create schedule', {
      operation: 'create_schedule',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to create schedule' });
  }
}

export async function updateSchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const { name, description, startDate, endDate, timezone } = req.body;

    // Check if schedule exists
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id }
    });

    if (!existingSchedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Allow admins/managers to edit published schedules (they can republish after making changes)
    // No restriction on editing published schedules

    const data: Prisma.ScheduleUpdateInput = {};
    if (name) data.name = name;
    if (description !== undefined) data.description = description;
    if (startDate) data.startDate = new Date(startDate);
    if (endDate) data.endDate = new Date(endDate);
    if (timezone) data.timezone = timezone;

    const schedule = await prisma.schedule.update({
      where: { id },
      data
    });

    logger.info('Schedule updated', {
      operation: 'update_schedule',
      userId: user.id,
      scheduleId: id
    });

    res.json({ schedule });
  } catch (error) {
    logger.error('Failed to update schedule', {
      operation: 'update_schedule',
      error: { message: (error as Error).message, stack: (error as Error).stack }
    });
    res.status(500).json({ error: 'Failed to update schedule' });
  }
}

export async function deleteSchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        shifts: {
          select: { id: true, metadata: true }
        }
      }
    });

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Clean up calendar events if schedule was published
    if (schedule.status === 'PUBLISHED' && schedule.shifts.length > 0) {
      try {
        const eventIdsToDelete = new Set<string>();
        
        // Collect all calendar event IDs from shift metadata
        for (const shift of schedule.shifts) {
          if (shift.metadata && typeof shift.metadata === 'object') {
            const meta = shift.metadata as Record<string, unknown>;
            const calendarEvents = meta.calendarEvents;
            if (calendarEvents && typeof calendarEvents === 'object') {
              const events = calendarEvents as Record<string, unknown>;
              if (events.scheduleEventId && typeof events.scheduleEventId === 'string') {
                eventIdsToDelete.add(events.scheduleEventId);
              }
              // Note: personalEventId is null now (we removed that), but handle if any exist
              if (events.personalEventId && typeof events.personalEventId === 'string') {
                eventIdsToDelete.add(events.personalEventId);
              }
            }
          }
        }

        // Delete calendar events
        if (eventIdsToDelete.size > 0) {
          await prisma.event.deleteMany({
            where: { id: { in: Array.from(eventIdsToDelete) } }
          });
          
          logger.info('Calendar events cleaned up for schedule deletion', {
            operation: 'delete_schedule',
            scheduleId: id,
            eventCount: eventIdsToDelete.size
          });
        }
      } catch (calendarError) {
        // Log but don't fail schedule deletion if calendar cleanup fails
        logger.warn('Failed to clean up calendar events during schedule deletion', {
          operation: 'delete_schedule_calendar_cleanup',
          scheduleId: id,
          error: {
            message: calendarError instanceof Error ? calendarError.message : 'Unknown error',
            stack: calendarError instanceof Error ? calendarError.stack : undefined
          }
        });
      }
    }

    // Delete the schedule (shifts will cascade delete)
    await prisma.schedule.delete({
      where: { id }
    });

    logger.info('Schedule deleted', {
      operation: 'delete_schedule',
      userId: user.id,
      scheduleId: id,
      wasPublished: schedule.status === 'PUBLISHED'
    });

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to delete schedule', {
      operation: 'delete_schedule',
      error: { message: errorMessage, stack: errorStack }
    });
    
    // Provide more detailed error message to client
    res.status(500).json({ 
      error: 'Failed to delete schedule',
      message: errorMessage
    });
  }
}

export async function publishSchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
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
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    if (schedule.shifts.length === 0) {
      res.status(400).json({ error: 'Cannot publish empty schedule' });
      return;
    }

    // Allow republishing - update publishedAt timestamp and publishedById
    // This enables admins/managers to make edits and republish
    const updatedSchedule = await prisma.schedule.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById: user.id
      }
    });

    // Check if HR module is installed and create expected attendance records
    try {
      const hrInstallation = await prisma.businessModuleInstallation.findFirst({
        where: {
          businessId: schedule.businessId,
          moduleId: 'hr',
          enabled: true
        }
      });

      if (hrInstallation) {
        // Create expected attendance records for assigned shifts
        const assignedShifts = schedule.shifts.filter(s => s.employeePositionId);
        
        for (const shift of assignedShifts) {
          if (!shift.employeePositionId) continue;
          
          const shiftStart = new Date(shift.startTime);
          const shiftEnd = new Date(shift.endTime);
          const workDate = new Date(shiftStart);
          workDate.setHours(0, 0, 0, 0);
          
          // Check if attendance record already exists for this shift
          // Query records for this employee/date and check metadata in code
          const existingRecords = await prisma.attendanceRecord.findMany({
            where: {
              businessId: schedule.businessId,
              employeePositionId: shift.employeePositionId,
              workDate: workDate
            }
          });

          // Check if any record has this shift ID in metadata
          const existingRecord = existingRecords.find(record => {
            if (!record.metadata || typeof record.metadata !== 'object') return false;
            const meta = record.metadata as Record<string, unknown>;
            return meta.scheduleShiftId === shift.id;
          });

          if (!existingRecord) {
            // Create expected attendance record (status = MISSED until employee clocks in)
            await prisma.attendanceRecord.create({
              data: {
                businessId: schedule.businessId,
                employeePositionId: shift.employeePositionId,
                workDate: workDate,
                status: AttendanceRecordStatus.MISSED, // Will be updated to IN_PROGRESS when employee clocks in
                metadata: {
                  scheduleShiftId: shift.id,
                  scheduleId: schedule.id,
                  expectedStartTime: shiftStart.toISOString(),
                  expectedEndTime: shiftEnd.toISOString(),
                  source: 'scheduling_module'
                }
              }
            });
          }
        }

        logger.info('Expected attendance records created', {
          operation: 'publish_schedule',
          scheduleId: id,
          recordsCreated: assignedShifts.length
        });

        // Sync shifts to calendar
        try {
          const { syncScheduleShiftsToCalendar } = await import('../services/hrScheduleService');
          await syncScheduleShiftsToCalendar(id, schedule.businessId);
          logger.info('Schedule shifts synced to calendar', {
            operation: 'publish_schedule',
            scheduleId: id,
            shiftCount: schedule.shifts.length
          });
        } catch (calendarError) {
          // Log but don't fail schedule publication if calendar sync fails
          logger.warn('Failed to sync schedule to calendar', {
            operation: 'publish_schedule',
            scheduleId: id,
            error: {
              message: calendarError instanceof Error ? calendarError.message : 'Unknown error',
              stack: calendarError instanceof Error ? calendarError.stack : undefined
            }
          });
        }
      }
    } catch (hrError) {
      // Log but don't fail schedule publication if HR sync fails
      logger.warn('Failed to sync expected attendance records', {
        operation: 'publish_schedule',
        scheduleId: id,
        error: {
          message: hrError instanceof Error ? hrError.message : 'Unknown error',
          stack: hrError instanceof Error ? hrError.stack : undefined
        }
      });
    }

    // TODO: Send notifications to employees about published schedule

    logger.info('Schedule published', {
      operation: 'publish_schedule',
      userId: user.id,
      scheduleId: id,
      shiftCount: schedule.shifts.length
    });

    // Broadcast schedule published event via WebSocket
    try {
      const socketService = getChatSocketService();
      socketService.broadcastSchedulePublished(
        schedule.businessId,
        id,
        updatedSchedule as unknown as Record<string, unknown>
      );
    } catch (socketError) {
      // Don't fail the request if WebSocket broadcast fails
      logger.warn('Failed to broadcast schedule published event', {
        operation: 'publish_schedule_broadcast',
        error: {
          message: socketError instanceof Error ? socketError.message : 'Unknown error',
          stack: socketError instanceof Error ? socketError.stack : undefined
        }
      });
    }

    res.json({ schedule: updatedSchedule, message: 'Schedule published successfully' });
  } catch (error) {
    logger.error('Failed to publish schedule', {
      operation: 'publish_schedule',
      error: { message: (error as Error).message, stack: (error as Error).stack }
    });
    res.status(500).json({ error: 'Failed to publish schedule' });
  }
}

export async function cloneSchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const { name, startDate, endDate } = req.body;

    if (!name || !startDate || !endDate) {
      res.status(400).json({ error: 'Missing required fields: name, startDate, endDate' });
      return;
    }

    const originalSchedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        shifts: true
      }
    });

    if (!originalSchedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Create new schedule with cloned data
    const newSchedule = await prisma.schedule.create({
      data: {
        businessId: originalSchedule.businessId,
        name,
        description: originalSchedule.description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        timezone: originalSchedule.timezone,
        createdById: user.id,
        status: 'DRAFT'
      }
    });

    // Clone shifts with adjusted dates
    const dateDiff = new Date(startDate).getTime() - originalSchedule.startDate.getTime();
    
    const shiftPromises = originalSchedule.shifts.map(shift => {
      const newStartTime = new Date(shift.startTime.getTime() + dateDiff);
      const newEndTime = new Date(shift.endTime.getTime() + dateDiff);

      return prisma.scheduleShift.create({
        data: {
          scheduleId: newSchedule.id,
          businessId: originalSchedule.businessId,
          employeePositionId: shift.employeePositionId,
          title: shift.title,
          startTime: newStartTime,
          endTime: newEndTime,
          breakMinutes: shift.breakMinutes,
          notes: shift.notes,
          color: shift.color,
          isOpenShift: shift.isOpenShift,
          requiresApproval: shift.requiresApproval,
          status: 'SCHEDULED'
        }
      });
    });

    await Promise.all(shiftPromises);

    logger.info('Schedule cloned', {
      operation: 'clone_schedule',
      userId: user.id,
      originalScheduleId: id,
      newScheduleId: newSchedule.id
    });

    res.status(201).json({ schedule: newSchedule, message: 'Schedule cloned successfully' });
  } catch (error) {
    logger.error('Failed to clone schedule', {
      operation: 'clone_schedule',
      error: { message: (error as Error).message, stack: (error as Error).stack }
    });
    res.status(500).json({ error: 'Failed to clone schedule' });
  }
}

// ============================================================================
// ADMIN - Shift Management
// ============================================================================

export async function getScheduleShifts(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    const shifts = await prisma.scheduleShift.findMany({
      where: {
        scheduleId: id
      },
      include: {
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            position: {
              select: {
                title: true
              }
            }
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            description: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    res.json({ shifts });
  } catch (error) {
    logger.error('Failed to get schedule shifts', {
      operation: 'get_schedule_shifts',
      error: { message: (error as Error).message, stack: (error as Error).stack }
    });
    res.status(500).json({ error: 'Failed to retrieve shifts' });
  }
}

export async function createShift(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const {
      scheduleId,
      businessId,
      employeePositionId,
      positionId,
      title,
      startTime,
      endTime,
      breakMinutes,
      notes,
      color,
      isOpenShift,
      stationName,
      locationId
    } = req.body;

    if (!scheduleId || !businessId || !title || !startTime || !endTime) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check for time-off conflicts if employee is assigned
    if (employeePositionId) {
      const shiftStart = new Date(startTime);
      const shiftEnd = new Date(endTime);
      
      // Check if employee has approved or pending time-off that overlaps with this shift
      const timeOffConflict = await prisma.timeOffRequest.findFirst({
        where: {
          businessId,
          employeePositionId,
          status: { in: ['APPROVED', 'PENDING'] },
          OR: [
            {
              AND: [
                { startDate: { lte: shiftEnd } },
                { endDate: { gte: shiftStart } }
              ]
            }
          ]
        },
        include: {
          employeePosition: {
            include: {
              user: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (timeOffConflict) {
        const employeeName = timeOffConflict.employeePosition?.user?.name || 'Employee';
        const conflictType = timeOffConflict.type;
        const conflictStart = timeOffConflict.startDate.toISOString().split('T')[0];
        const conflictEnd = timeOffConflict.endDate.toISOString().split('T')[0];
        
        logger.warn('Shift creation blocked by time-off', {
          operation: 'create_shift',
          userId: user.id,
          employeePositionId,
          shiftStart: shiftStart.toISOString(),
          shiftEnd: shiftEnd.toISOString(),
          timeOffId: timeOffConflict.id,
          timeOffType: conflictType,
          timeOffDates: `${conflictStart} to ${conflictEnd}`
        });

        res.status(409).json({ 
          error: 'Cannot schedule shift during employee time-off',
          message: `${employeeName} has ${conflictType} time-off from ${conflictStart} to ${conflictEnd}`,
          conflict: {
            type: conflictType,
            startDate: conflictStart,
            endDate: conflictEnd,
            employeeName
          }
        });
        return;
      }
    }

    const shift = await prisma.scheduleShift.create({
      data: {
        scheduleId,
        businessId,
        employeePositionId,
        positionId,
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        breakMinutes,
        notes,
        color,
        // Set isOpenShift to true if no employee is assigned, or if explicitly provided
        isOpenShift: isOpenShift !== undefined ? isOpenShift : (!employeePositionId),
        status: employeePositionId ? 'SCHEDULED' : 'OPEN',
        stationName: stationName || undefined,
        locationId: locationId || undefined
      },
      include: {
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            position: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            description: true
          }
        }
      }
    });

    logger.info('Shift created', {
      operation: 'create_shift',
      userId: user.id,
      shiftId: shift.id,
      scheduleId
    });

    // Broadcast shift created event via WebSocket
    try {
      const socketService = getChatSocketService();
      socketService.broadcastShiftCreated(
        businessId,
        scheduleId,
        shift as unknown as Record<string, unknown>
      );
    } catch (socketError) {
      // Don't fail the request if WebSocket broadcast fails
      logger.warn('Failed to broadcast shift created event', {
        operation: 'create_shift_broadcast',
        error: {
          message: socketError instanceof Error ? socketError.message : 'Unknown error',
          stack: socketError instanceof Error ? socketError.stack : undefined
        }
      });
    }

    res.status(201).json({ shift });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to create shift', {
      operation: 'create_shift',
      error: { message: errorMessage, stack: errorStack },
      requestBody: req.body
    });
    
    console.error('❌ Create shift error:', error);
    console.error('Request body:', req.body);
    
    res.status(500).json({ 
      error: 'Failed to create shift',
      message: errorMessage
    });
  }
}

export async function updateShift(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const {
      title,
      startTime,
      endTime,
      breakMinutes,
      notes,
      color,
      positionId,
      employeePositionId,
      stationName,
      locationId
    } = req.body;

    const data: Prisma.ScheduleShiftUpdateInput = {};
    if (title) data.title = title;
    if (startTime) data.startTime = new Date(startTime);
    if (endTime) data.endTime = new Date(endTime);
    if (breakMinutes !== undefined) data.breakMinutes = breakMinutes;
    if (notes !== undefined) data.notes = notes;
    if (color) data.color = color;
    if (positionId !== undefined) {
      data.position =
        positionId === ''
          ? { disconnect: true }
          : { connect: { id: positionId } };
    }
    // Handle employeePositionId (can be set to null/undefined to unassign)
    if (employeePositionId !== undefined) {
      if (employeePositionId === null || employeePositionId === '' || typeof employeePositionId === 'string' && employeePositionId.startsWith('member-')) {
        // Disconnect employee position (set to null) - for unassigned or member employees without formal positions
        data.employeePosition = { disconnect: true };
        data.isOpenShift = true;
        data.status = 'OPEN'; // Set status to OPEN when unassigning
      } else {
        // Validate UUID format before connecting
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(employeePositionId)) {
          logger.error('Invalid employeePositionId format', {
            operation: 'update_shift',
            shiftId: id,
            employeePositionId
          });
          res.status(400).json({ error: 'Invalid employee position ID format' });
          return;
        }
        data.employeePosition = { connect: { id: employeePositionId } };
        data.isOpenShift = false;
        data.status = 'SCHEDULED'; // Set status to SCHEDULED when assigning
      }
    }
    // Handle stationName
    if (stationName !== undefined) {
      data.stationName = stationName === '' ? null : stationName;
    }
    // Handle locationId (can be set to null/undefined to remove location)
    if (locationId !== undefined) {
      if (locationId === null || locationId === '') {
        data.location = { disconnect: true };
      } else {
        data.location = { connect: { id: locationId } };
      }
    }

    // Get current shift to check for time-off conflicts
    const currentShift = await prisma.scheduleShift.findUnique({
      where: { id },
      select: { employeePositionId: true, startTime: true, endTime: true }
    });

    if (!currentShift) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    // Determine final employeePositionId and shift dates for conflict check
    const finalEmployeePositionId = employeePositionId !== undefined 
      ? (employeePositionId === null || employeePositionId === '' || (typeof employeePositionId === 'string' && employeePositionId.startsWith('member-')) ? null : employeePositionId)
      : currentShift.employeePositionId;
    
    const finalStartTime = startTime ? new Date(startTime) : currentShift.startTime;
    const finalEndTime = endTime ? new Date(endTime) : currentShift.endTime;

    // Check for time-off conflicts if employee is assigned (or being assigned)
    if (finalEmployeePositionId) {
      const timeOffConflict = await prisma.timeOffRequest.findFirst({
        where: {
          businessId: (() => {
            if (req.businessId) return req.businessId;
            const businessIdParam = req.query.businessId;
            if (businessIdParam && typeof businessIdParam === 'string') {
              return businessIdParam;
            }
            return undefined;
          })(),
          employeePositionId: finalEmployeePositionId,
          status: { in: ['APPROVED', 'PENDING'] },
          OR: [
            {
              AND: [
                { startDate: { lte: finalEndTime } },
                { endDate: { gte: finalStartTime } }
              ]
            }
          ]
        },
        include: {
          employeePosition: {
            include: {
              user: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (timeOffConflict) {
        const employeeName = timeOffConflict.employeePosition?.user?.name || 'Employee';
        const conflictType = timeOffConflict.type;
        const conflictStart = timeOffConflict.startDate.toISOString().split('T')[0];
        const conflictEnd = timeOffConflict.endDate.toISOString().split('T')[0];
        
        logger.warn('Shift update blocked by time-off', {
          operation: 'update_shift',
          userId: user.id,
          shiftId: id,
          employeePositionId: finalEmployeePositionId,
          shiftStart: finalStartTime.toISOString(),
          shiftEnd: finalEndTime.toISOString(),
          timeOffId: timeOffConflict.id,
          timeOffType: conflictType,
          timeOffDates: `${conflictStart} to ${conflictEnd}`
        });

        res.status(409).json({ 
          error: 'Cannot schedule shift during employee time-off',
          message: `${employeeName} has ${conflictType} time-off from ${conflictStart} to ${conflictEnd}`,
          conflict: {
            type: conflictType,
            startDate: conflictStart,
            endDate: conflictEnd,
            employeeName
          }
        });
        return;
      }
    }

    const shift = await prisma.scheduleShift.update({
      where: { id },
      data,
      include: {
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            position: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            description: true
          }
        }
      }
    });

    logger.info('Shift updated', {
      operation: 'update_shift',
      userId: user.id,
      shiftId: id
    });

    // Broadcast shift updated event via WebSocket
    try {
      const socketService = getChatSocketService();
      const schedule = await prisma.schedule.findUnique({
        where: { id: shift.scheduleId },
        select: { businessId: true, status: true }
      });
      if (schedule) {
        socketService.broadcastShiftUpdated(
          schedule.businessId,
          shift.scheduleId,
          shift as unknown as Record<string, unknown>
        );

        // Sync to calendar if schedule is published
        if (schedule.status === 'PUBLISHED') {
          try {
            const { syncSingleShiftToCalendar } = await import('../services/hrScheduleService');
            await syncSingleShiftToCalendar(id, schedule.businessId);
          } catch (calendarError) {
            // Log but don't fail the request if calendar sync fails
            logger.warn('Failed to sync shift update to calendar', {
              operation: 'update_shift_calendar_sync',
              shiftId: id,
              error: {
                message: calendarError instanceof Error ? calendarError.message : 'Unknown error',
                stack: calendarError instanceof Error ? calendarError.stack : undefined
              }
            });
          }
        }
      }
    } catch (socketError) {
      // Don't fail the request if WebSocket broadcast fails
      logger.warn('Failed to broadcast shift updated event', {
        operation: 'update_shift_broadcast',
        error: {
          message: socketError instanceof Error ? socketError.message : 'Unknown error',
          stack: socketError instanceof Error ? socketError.stack : undefined
        }
      });
    }

    res.json({ shift });
  } catch (error) {
    logger.error('Failed to update shift', {
      operation: 'update_shift',
      error: { message: (error as Error).message, stack: (error as Error).stack }
    });
    res.status(500).json({ error: 'Failed to update shift' });
  }
}

export async function deleteShift(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    // Get shift info before deleting for broadcast
    const shift = await prisma.scheduleShift.findUnique({
      where: { id },
      select: { scheduleId: true }
    });

    if (!shift) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: shift.scheduleId },
      select: { businessId: true }
    });

    await prisma.scheduleShift.delete({
      where: { id }
    });

    logger.info('Shift deleted', {
      operation: 'delete_shift',
      userId: user.id,
      shiftId: id
    });

    // Broadcast shift deleted event via WebSocket
    if (schedule) {
      try {
        const socketService = getChatSocketService();
        socketService.broadcastShiftDeleted(
          schedule.businessId,
          shift.scheduleId,
          id
        );
      } catch (socketError) {
        // Don't fail the request if WebSocket broadcast fails
        logger.warn('Failed to broadcast shift deleted event', {
          operation: 'delete_shift_broadcast',
          error: {
            message: socketError instanceof Error ? socketError.message : 'Unknown error',
            stack: socketError instanceof Error ? socketError.stack : undefined
          }
        });
      }
    }

    res.json({ message: 'Shift deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete shift', {
      operation: 'delete_shift',
      error: { message: (error as Error).message, stack: (error as Error).stack }
    });
    res.status(500).json({ error: 'Failed to delete shift' });
  }
}

export async function assignShift(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const { employeePositionId } = req.body;

    if (!employeePositionId) {
      res.status(400).json({ error: 'Employee position ID is required' });
      return;
    }

    // TODO: Check for scheduling conflicts
    // TODO: Check employee availability

    const shift = await prisma.scheduleShift.update({
      where: { id },
      data: {
        employeePositionId,
        status: 'SCHEDULED',
        isOpenShift: false
      },
      include: {
        schedule: {
          select: { businessId: true, status: true }
        },
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    logger.info('Shift assigned', {
      operation: 'assign_shift',
      userId: user.id,
      shiftId: id,
      assignedToPositionId: employeePositionId
    });

    // Sync to calendar if schedule is published
    if (shift.schedule?.status === 'PUBLISHED' && shift.schedule.businessId) {
      try {
        const { syncSingleShiftToCalendar } = await import('../services/hrScheduleService');
        await syncSingleShiftToCalendar(id, shift.schedule.businessId);
      } catch (calendarError) {
        // Log but don't fail the request if calendar sync fails
        logger.warn('Failed to sync shift assignment to calendar', {
          operation: 'assign_shift_calendar_sync',
          shiftId: id,
          error: {
            message: calendarError instanceof Error ? calendarError.message : 'Unknown error',
            stack: calendarError instanceof Error ? calendarError.stack : undefined
          }
        });
      }
    }

    res.json({ shift, message: 'Shift assigned successfully' });
  } catch (error) {
    logger.error('Failed to assign shift', {
      operation: 'assign_shift',
      error: { message: (error as Error).message, stack: (error as Error).stack }
    });
    res.status(500).json({ error: 'Failed to assign shift' });
  }
}

// ============================================================================
// ADMIN - Additional Shift Management
// ============================================================================

export async function getShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { businessId, scheduleId } = req.query;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    const where: Prisma.ScheduleShiftWhereInput = {
      businessId: businessId
    };

    if (scheduleId && typeof scheduleId === 'string') {
      where.scheduleId = scheduleId;
    }

    // Query shifts - start simple and add includes incrementally
    let shifts;
    try {
      // First try without nested includes to isolate the issue
      shifts = await prisma.scheduleShift.findMany({
        where,
        include: {
          employeePosition: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              position: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          },
          schedule: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true
            }
          },
          position: {
            select: {
              id: true,
              title: true
            }
          },
          location: {
            select: {
              id: true,
              name: true,
              address: true,
              description: true
            }
          }
        },
        orderBy: {
          startTime: 'asc'
        }
      });
    } catch (prismaError: unknown) {
      const prismaErr = prismaError as Error & { code?: string; meta?: Record<string, unknown> };
      logger.error('Prisma query error in getShifts', {
        operation: 'get_shifts',
        error: {
          message: prismaErr.message,
          stack: prismaErr.stack,
          code: prismaErr.code
        },
        query: { businessId, scheduleId },
        prismaMeta: prismaErr.meta // Log meta separately to avoid type error
      });
      throw prismaError;
    }

    logger.info('Shifts retrieved', {
      operation: 'get_shifts',
      userId: user.id,
      businessId,
      scheduleId: scheduleId || 'all',
      shiftCount: shifts.length
    });

    res.json({ shifts });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get shifts', {
      operation: 'get_shifts',
      userId: req.user?.id,
      businessId: typeof req.query.businessId === 'string' ? req.query.businessId : undefined,
      scheduleId: typeof req.query.scheduleId === 'string' ? req.query.scheduleId : undefined,
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      error: 'Failed to retrieve shifts',
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

export async function getShiftById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    const shift = await prisma.scheduleShift.findUnique({
      where: { id },
      include: {
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            position: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            description: true
          }
        }
      }
    });

    if (!shift) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    res.json({ shift });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to get shift', {
      operation: 'get_shift',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to retrieve shift' });
  }
}

// ============================================================================
// STUB IMPLEMENTATIONS - To be completed in future phases
// ============================================================================

// Templates
export async function getShiftTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ templates: [] });
}

export async function getShiftTemplateById(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Shift templates coming in Phase 2' });
}

export async function createShiftTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Shift templates coming in Phase 2' });
}

export async function updateShiftTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Shift templates coming in Phase 2' });
}

export async function deleteShiftTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Shift templates coming in Phase 2' });
}

export async function getScheduleTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { businessId } = req.query;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    // Verify user has access to this business
    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: user.id } },
    });

    if (!member || !member.isActive) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const templates = await prisma.scheduleTemplate.findMany({
      where: {
        businessId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    logger.info('Schedule templates retrieved', {
      operation: 'get_schedule_templates',
      userId: user.id,
      businessId,
      count: templates.length,
    });

    res.json({ templates });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get schedule templates', {
      operation: 'get_schedule_templates',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to retrieve schedule templates' });
  }
}

export async function getScheduleTemplateById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    const template = await prisma.scheduleTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Verify user has access to this business
    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: template.businessId, userId: user.id } },
    });

    if (!member || !member.isActive) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    logger.info('Schedule template retrieved', {
      operation: 'get_schedule_template',
      userId: user.id,
      templateId: id,
    });

    res.json({ template });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get schedule template', {
      operation: 'get_schedule_template',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to retrieve schedule template' });
  }
}

export async function createScheduleTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { businessId, name, description, scheduleType, templateData, sourceScheduleId } = req.body;

    if (!businessId || !name || !scheduleType) {
      res.status(400).json({ error: 'Missing required fields: businessId, name, scheduleType' });
      return;
    }

    // Verify user has access to this business
    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: user.id } },
    });

    if (!member || !member.isActive) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    let finalTemplateData: Prisma.InputJsonValue = templateData || {};

    // If creating from an existing schedule, extract the pattern
    if (sourceScheduleId) {
      const schedule = await prisma.schedule.findUnique({
        where: { id: sourceScheduleId },
        include: {
          shifts: {
            include: {
              position: {
                select: { id: true, title: true },
              },
            },
            orderBy: {
              startTime: 'asc',
            },
          },
        },
      });

      if (!schedule) {
        res.status(404).json({ error: 'Source schedule not found' });
        return;
      }

      if (schedule.businessId !== businessId) {
        res.status(403).json({ error: 'Schedule does not belong to this business' });
        return;
      }

      // Extract shift patterns from the schedule
      // Convert shifts to template patterns (day of week, time, position, station, etc.)
      const shiftPatterns = schedule.shifts.map((shift) => {
        const startTime = new Date(shift.startTime);
        const endTime = new Date(shift.endTime);
        const dayOfWeek = startTime.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        const startHour = startTime.getHours();
        const startMinute = startTime.getMinutes();
        const endHour = endTime.getHours();
        const endMinute = endTime.getMinutes();

        return {
          dayOfWeek,
          startTime: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
          endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
          positionId: shift.positionId || null,
          positionTitle: shift.position?.title || null,
          stationName: shift.stationName || null,
          breakMinutes: shift.breakMinutes || 0,
          notes: shift.notes || null,
          color: shift.color || null,
          minStaffing: shift.minStaffing || 1,
          maxStaffing: shift.maxStaffing || 1,
          isOpenShift: shift.isOpenShift || false,
        };
      });

      finalTemplateData = {
        shiftPatterns,
        sourceScheduleId,
        sourceScheduleName: schedule.name,
      };
    }

    // Check for duplicate name
    const existing = await prisma.scheduleTemplate.findUnique({
      where: { businessId_name: { businessId, name } },
    });

    if (existing) {
      res.status(409).json({ error: 'Template with this name already exists' });
      return;
    }

    const template = await prisma.scheduleTemplate.create({
      data: {
        businessId,
        name,
        description: description || null,
        scheduleType,
        templateData: finalTemplateData as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    logger.info('Schedule template created', {
      operation: 'create_schedule_template',
      userId: user.id,
      templateId: template.id,
      businessId,
      sourceScheduleId: sourceScheduleId || null,
    });

    res.status(201).json({ template });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to create schedule template', {
      operation: 'create_schedule_template',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to create schedule template' });
  }
}

export async function updateScheduleTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const { name, description, scheduleType, templateData, isActive } = req.body;

    const template = await prisma.scheduleTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Verify user has access to this business
    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: template.businessId, userId: user.id } },
    });

    if (!member || !member.isActive) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check for duplicate name if name is being changed
    if (name && name !== template.name) {
      const existing = await prisma.scheduleTemplate.findUnique({
        where: { businessId_name: { businessId: template.businessId, name } },
      });

      if (existing) {
        res.status(409).json({ error: 'Template with this name already exists' });
        return;
      }
    }

    const updatedTemplate = await prisma.scheduleTemplate.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(scheduleType && { scheduleType }),
        ...(templateData && { templateData: templateData as Prisma.InputJsonValue }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    logger.info('Schedule template updated', {
      operation: 'update_schedule_template',
      userId: user.id,
      templateId: id,
    });

    res.json({ template: updatedTemplate });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to update schedule template', {
      operation: 'update_schedule_template',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to update schedule template' });
  }
}

export async function deleteScheduleTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    const template = await prisma.scheduleTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Verify user has access to this business
    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: template.businessId, userId: user.id } },
    });

    if (!member || !member.isActive) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await prisma.scheduleTemplate.delete({
      where: { id },
    });

    logger.info('Schedule template deleted', {
      operation: 'delete_schedule_template',
      userId: user.id,
      templateId: id,
    });

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to delete schedule template', {
      operation: 'delete_schedule_template',
      error: { message: err.message, stack: err.stack },
    });
    res.status(500).json({ error: 'Failed to delete schedule template' });
  }
}

// Analytics
export async function getLaborCostAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Analytics coming in Phase 3' });
}

export async function getCoverageAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Analytics coming in Phase 3' });
}

export async function getComplianceReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Compliance reports coming in Phase 3' });
}

/**
 * GET /api/scheduling/admin/availability
 * Get all employee availability for a business (Admin)
 */
export async function getAllEmployeeAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }

    if (!user || !businessId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Verify user has access to this business
    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: user.id } },
    });

    if (!member || !member.isActive) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Query all availability records for this business
    const availability = await prisma.employeeAvailability.findMany({
      where: {
        businessId
      },
      orderBy: [
        { employeePositionId: 'asc' },
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ],
      include: {
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            position: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    });

    logger.info('Admin fetched all employee availability', {
      businessId,
      userId: user.id,
      count: availability.length
    });

    res.json({ availability });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to fetch all employee availability', {
      operation: 'get_all_employee_availability',
      error: { message: err.message, stack: err.stack },
      businessId: req.businessId || (typeof req.query.businessId === 'string' ? req.query.businessId : undefined)
    });
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
}

export async function updateEmployeeAvailabilityAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Availability management coming in Phase 2' });
}

export async function getAllShiftSwapRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ swaps: [] });
}

/**
 * PUT /api/scheduling/admin/swaps/:id/approve
 * Approve a shift swap request (Admin)
 */
export async function approveShiftSwapAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const swapId = req.params.id;
    const { managerNotes } = req.body;

    if (!user || !businessId || !swapId) {
      res.status(401).json({ error: 'User not authenticated or missing required parameters' });
      return;
    }

    // Get the swap request
    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapId },
      include: {
        originalShift: {
          include: {
            employeePosition: true
          }
        }
      }
    });

    if (!swapRequest || swapRequest.businessId !== businessId) {
      res.status(404).json({ error: 'Swap request not found' });
      return;
    }

    if (swapRequest.status !== 'PENDING') {
      res.status(400).json({ error: 'Swap request is not pending' });
      return;
    }

    // Update swap request status
    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        reason: managerNotes ? `${swapRequest.reason || ''}\n\nAdmin notes: ${managerNotes}` : swapRequest.reason
      },
      include: {
        originalShift: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true
              }
            },
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requestedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // If a specific employee was requested, assign them to the shift
    if (swapRequest.requestedToId && swapRequest.originalShift.employeePositionId) {
      // Find the employee position for the requested user
      const requestedEmployeePosition = await prisma.employeePosition.findFirst({
        where: {
          userId: swapRequest.requestedToId,
          businessId,
          active: true
        }
      });

      if (requestedEmployeePosition) {
        // Get schedule status before updating shift
        const schedule = await prisma.schedule.findUnique({
          where: { id: swapRequest.originalShift.scheduleId },
          select: { status: true }
        });

                                                                                                                                                                            await prisma.scheduleShift.update({
          where: { id: swapRequest.originalShiftId },
          data: {
            employeePositionId: requestedEmployeePosition.id,
            status: 'FILLED'
          }
        });

        // Sync to calendar if schedule is published
        if (schedule?.status === 'PUBLISHED') {
          try {
            const { syncSingleShiftToCalendar } = await import('../services/hrScheduleService');
            await syncSingleShiftToCalendar(swapRequest.originalShiftId, businessId);
          } catch (calendarError) {
            // Log but don't fail swap approval if calendar sync fails
            logger.warn('Failed to sync shift swap to calendar', {
              operation: 'approve_shift_swap_admin_calendar_sync',
              shiftId: swapRequest.originalShiftId,
              swapId,
              error: {
                message: calendarError instanceof Error ? calendarError.message : 'Unknown error',
                stack: calendarError instanceof Error ? calendarError.stack : undefined
              }
            });
          }
        }
      }
    }

    logger.info('Shift swap approved by admin', {
      operation: 'approve_shift_swap_admin',
      userId: user.id,
      businessId,
      swapId
    });

    res.json(updatedSwap);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to approve shift swap', {
      operation: 'approve_shift_swap_admin',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to approve shift swap' });
  }
}

/**
 * PUT /api/scheduling/admin/swaps/:id/deny
 * Deny a shift swap request (Admin)
 */
export async function denyShiftSwapAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const swapId = req.params.id;
    const { managerNotes } = req.body;

    if (!user || !businessId || !swapId) {
      res.status(401).json({ error: 'User not authenticated or missing required parameters' });
      return;
    }

    // Get the swap request
    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapId }
    });

    if (!swapRequest || swapRequest.businessId !== businessId) {
      res.status(404).json({ error: 'Swap request not found' });
      return;
    }

    if (swapRequest.status !== 'PENDING') {
      res.status(400).json({ error: 'Swap request is not pending' });
      return;
    }

    // Update swap request status
    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'DENIED',
        approvedById: user.id,
        approvedAt: new Date(),
        reason: managerNotes ? `${swapRequest.reason || ''}\n\nAdmin notes: ${managerNotes}` : swapRequest.reason
      },
      include: {
        originalShift: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true
              }
            },
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requestedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    logger.info('Shift swap denied by admin', {
      operation: 'deny_shift_swap_admin',
      userId: user.id,
      businessId,
      swapId
    });

    res.json(updatedSwap);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to deny shift swap', {
      operation: 'deny_shift_swap_admin',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to deny shift swap' });
  }
}

// Manager Functions
/**
 * GET /api/scheduling/team/schedules
 * Returns schedules for the manager's team
 * For ADMIN users: returns all schedules (same as admin endpoint)
 * For MANAGER users: returns schedules with shifts assigned to their direct reports
 */
export async function getTeamSchedules(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const directReportIds = req.directReportIds || [];

    if (!user || !businessId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is ADMIN or has canManage permission
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
      select: { role: true, canManage: true },
    });

    const isAdmin = member?.role === BusinessRole.ADMIN || member?.canManage === true;

    const { status, startDate, endDate } = req.query;

    const where: Prisma.ScheduleWhereInput = {
      businessId
    };

    if (
      status &&
      typeof status === 'string' &&
      ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status.toUpperCase())
    ) {
      where.status = status.toUpperCase() as ScheduleStatus;
    }

    if (startDate || endDate) {
      const dateFilters: Prisma.ScheduleWhereInput[] = [];
      if (startDate && typeof startDate === 'string') {
        dateFilters.push({ startDate: { gte: new Date(startDate) } });
      }
      if (endDate && typeof endDate === 'string') {
        dateFilters.push({ endDate: { lte: new Date(endDate) } });
      }
      if (dateFilters.length > 0) {
        where.AND = dateFilters;
      }
    }

    // For ADMIN users: return all schedules (same as admin endpoint)
    // For MANAGER users: filter schedules that have shifts assigned to their direct reports
    if (!isAdmin && directReportIds.length > 0) {
      // Filter schedules that have at least one shift assigned to a direct report
      where.shifts = {
        some: {
          employeePositionId: {
            in: directReportIds
          }
        }
      };
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        shifts: {
          include: {
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                },
                position: {
                  select: {
                    title: true
                  }
                }
              }
            },
            position: {
              select: {
                id: true,
                title: true
              }
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    // Return schedules with shifts included
    const schedulesWithShifts = schedules.map(schedule => ({
      id: schedule.id,
      businessId: schedule.businessId,
      name: schedule.name,
      description: schedule.description,
      locationId: schedule.locationId,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      timezone: schedule.timezone,
      status: schedule.status,
      publishedAt: schedule.publishedAt,
      publishedById: schedule.publishedById,
      templateId: schedule.templateId,
      metadata: schedule.metadata,
      createdById: schedule.createdById,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
      shifts: schedule.shifts || []
    }));

    // Debug: Log shift counts
    const totalShifts = schedulesWithShifts.reduce((sum, s) => sum + (s.shifts?.length || 0), 0);
    logger.info('Team schedules retrieved', {
      operation: 'get_team_schedules',
      userId: user.id,
      businessId,
      directReportCount: directReportIds.length,
      scheduleCount: schedulesWithShifts.length,
      totalShiftCount: totalShifts,
      schedulesWithShifts: schedulesWithShifts.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        shiftCount: s.shifts?.length || 0,
        firstShiftDate: s.shifts?.[0]?.startTime || null
      }))
    });

    res.json({ schedules: schedulesWithShifts });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get team schedules', {
      operation: 'get_team_schedules',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to retrieve team schedules' });
  }
}

export async function publishTeamSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Manager features coming in Phase 2' });
}

export async function getOpenShiftsForTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Open shifts coming in Phase 2' });
}

export async function assignEmployeeToShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Manager features coming in Phase 2' });
}

export async function getTeamAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ error: 'Not yet implemented - Manager features coming in Phase 2' });
}

/**
 * GET /api/scheduling/team/swaps/pending
 * Get pending shift swap requests for manager's team
 */
export async function getPendingShiftSwapRequestsForTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const directReportIds = req.directReportIds || [];

    if (!user || !businessId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is ADMIN or has canManage permission
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
      select: { role: true, canManage: true },
    });

    const isAdmin = member?.role === BusinessRole.ADMIN || member?.canManage === true;

    // Build where clause
    const where: Prisma.ShiftSwapRequestWhereInput = {
      businessId,
      status: 'PENDING'
    };

    // If not admin, filter by direct reports
    if (!isAdmin && directReportIds.length > 0) {
      where.OR = [
        {
          originalShift: {
            employeePositionId: {
              in: directReportIds
            }
          }
        },
        {
          requestedToId: {
            in: directReportIds
          }
        }
      ];
    }

    const swaps = await prisma.shiftSwapRequest.findMany({
      where,
      include: {
        originalShift: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true
              }
            },
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requestedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    logger.info('Pending swap requests retrieved for team', {
      operation: 'get_pending_swap_requests_team',
      userId: user.id,
      businessId,
      swapCount: swaps.length
    });

    res.json({ swaps });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get pending swap requests for team', {
      operation: 'get_pending_swap_requests_team',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to retrieve pending swap requests' });
  }
}

/**
 * PUT /api/scheduling/team/swaps/:id/approve
 * Approve a shift swap request (Manager)
 */
export async function approveShiftSwapManager(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const swapId = req.params.id;
    const { managerNotes } = req.body;

    if (!user || !businessId || !swapId) {
      res.status(401).json({ error: 'User not authenticated or missing required parameters' });
      return;
    }

    // Get the swap request
    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapId },
      include: {
        originalShift: {
          include: {
            employeePosition: true
          }
        }
      }
    });

    if (!swapRequest || swapRequest.businessId !== businessId) {
      res.status(404).json({ error: 'Swap request not found' });
      return;
    }

    if (swapRequest.status !== 'PENDING') {
      res.status(400).json({ error: 'Swap request is not pending' });
      return;
    }

    // Update swap request status
    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        reason: managerNotes ? `${swapRequest.reason || ''}\n\nManager notes: ${managerNotes}` : swapRequest.reason
      },
      include: {
        originalShift: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true
              }
            },
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requestedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // If a specific employee was requested, assign them to the shift
    if (swapRequest.requestedToId && swapRequest.originalShift.employeePositionId) {
      // Find the employee position for the requested user
      const requestedEmployeePosition = await prisma.employeePosition.findFirst({
        where: {
          userId: swapRequest.requestedToId,
          businessId,
          active: true
        }
      });

      if (requestedEmployeePosition) {
        // Get schedule status before updating shift
        const schedule = await prisma.schedule.findUnique({
          where: { id: swapRequest.originalShift.scheduleId },
          select: { status: true }
        });

        await prisma.scheduleShift.update({
          where: { id: swapRequest.originalShiftId },
          data: {
            employeePositionId: requestedEmployeePosition.id,
            status: 'FILLED'
          }
        });

        // Sync to calendar if schedule is published
        if (schedule?.status === 'PUBLISHED') {
          try {
            const { syncSingleShiftToCalendar } = await import('../services/hrScheduleService');
            await syncSingleShiftToCalendar(swapRequest.originalShiftId, businessId);
          } catch (calendarError) {
            // Log but don't fail swap approval if calendar sync fails
            logger.warn('Failed to sync shift swap to calendar', {
              operation: 'approve_shift_swap_manager_calendar_sync',
              shiftId: swapRequest.originalShiftId,
              swapId,
              error: {
                message: calendarError instanceof Error ? calendarError.message : 'Unknown error',
                stack: calendarError instanceof Error ? calendarError.stack : undefined
              }
            });
          }
        }
      }
    }

    logger.info('Shift swap approved by manager', {
      operation: 'approve_shift_swap_manager',
      userId: user.id,
      businessId,
      swapId
    });

    res.json(updatedSwap);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to approve shift swap', {
      operation: 'approve_shift_swap_manager',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to approve shift swap' });
  }
}

/**
 * PUT /api/scheduling/team/swaps/:id/deny
 * Deny a shift swap request (Manager)
 */
export async function denyShiftSwapManager(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const swapId = req.params.id;
    const { managerNotes } = req.body;

    if (!user || !businessId || !swapId) {
      res.status(401).json({ error: 'User not authenticated or missing required parameters' });
      return;
    }

    // Get the swap request
    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapId }
    });

    if (!swapRequest || swapRequest.businessId !== businessId) {
      res.status(404).json({ error: 'Swap request not found' });
      return;
    }

    if (swapRequest.status !== 'PENDING') {
      res.status(400).json({ error: 'Swap request is not pending' });
      return;
    }

    // Update swap request status
    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'DENIED',
        approvedById: user.id,
        approvedAt: new Date(),
        reason: managerNotes ? `${swapRequest.reason || ''}\n\nManager notes: ${managerNotes}` : swapRequest.reason
      },
      include: {
        originalShift: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true
              }
            },
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requestedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    logger.info('Shift swap denied by manager', {
      operation: 'deny_shift_swap_manager',
      userId: user.id,
      businessId,
      swapId
    });

    res.json(updatedSwap);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to deny shift swap', {
      operation: 'deny_shift_swap_manager',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to deny shift swap' });
  }
}

// Employee Functions
/**
 * GET /api/scheduling/me/schedule
 * Get the current user's own schedule
 * 
 * NOTE: Employee data comes from HR module's EmployeePosition when available.
 * If employeePositionId is not set, we query by userId directly.
 */
export async function getOwnSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const employeePositionId = req.employeePositionId;

    if (!user || !businessId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Query shifts assigned to this employee
    // IMPORTANT: Only return shifts from PUBLISHED schedules
    // If employeePositionId exists, use it; otherwise query by userId via employeePosition relation
    const where: Prisma.ScheduleShiftWhereInput = {
      businessId,
      schedule: {
        status: 'PUBLISHED' // Only show shifts from published schedules
      },
      OR: employeePositionId
        ? [{ employeePositionId }]
        : [
            {
              employeePosition: {
                userId: user.id,
                active: true
              }
            }
          ]
    };

    const shifts = await prisma.scheduleShift.findMany({
      where,
      include: {
        schedule: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
            timezone: true
          }
        },
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            position: {
              select: {
                title: true
              }
            }
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // Group shifts by schedule to return in the expected format
    const scheduleMap = new Map<string, {
      id: string;
      businessId: string;
      name: string;
      startDate: Date;
      endDate: Date;
      timezone: string;
      status: string;
      shifts: typeof shifts;
    }>();

    for (const shift of shifts) {
      if (!shift.schedule) continue;
      
      const scheduleId = shift.schedule.id;
      if (!scheduleMap.has(scheduleId)) {
        scheduleMap.set(scheduleId, {
          id: scheduleId,
          businessId,
          name: shift.schedule.name,
          startDate: shift.schedule.startDate,
          endDate: shift.schedule.endDate,
          timezone: shift.schedule.timezone,
          status: shift.schedule.status,
          shifts: []
        });
      }
      scheduleMap.get(scheduleId)!.shifts.push(shift);
    }

    const schedules = Array.from(scheduleMap.values());

    logger.info('Own schedule retrieved', {
      operation: 'get_own_schedule',
      userId: user.id,
      businessId,
      scheduleCount: schedules.length,
      shiftCount: shifts.length
    });

    // Return in format expected by frontend (schedules array with shifts)
    res.json({ schedules });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get own schedule', {
      operation: 'get_own_schedule',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to retrieve schedule' });
  }
}

/**
 * POST /api/scheduling/me/availability
 * Set employee availability
 */
export async function setOwnAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
  console.log('🔍 setOwnAvailability controller called', {
    method: req.method,
    path: req.path,
    url: req.url,
    hasUser: !!req.user,
    userId: req.user?.id,
    businessId: req.businessId,
    queryBusinessId: req.query.businessId,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    body: req.body
  });
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const employeePositionId = req.employeePositionId;
    const { dayOfWeek, startTime, endTime, availabilityType, effectiveFrom, effectiveTo, recurring, notes } = req.body;

    if (!user || !businessId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate required fields
    if (!dayOfWeek || !startTime || !endTime || !availabilityType) {
      res.status(400).json({ error: 'Missing required fields: dayOfWeek, startTime, endTime, availabilityType' });
      return;
    }

    // Validate day of week
    const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    if (!validDays.includes(dayOfWeek.toUpperCase())) {
      res.status(400).json({ error: 'Invalid day of week. Must be one of: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY' });
      return;
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      res.status(400).json({ error: 'Invalid time format. Use HH:MM (24-hour format)' });
      return;
    }

    // Validate end time is after start time
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (endMinutes <= startMinutes) {
      res.status(400).json({ error: 'End time must be after start time' });
      return;
    }

    // Validate availability type
    const validTypes = ['AVAILABLE', 'UNAVAILABLE', 'PREFERRED'];
    if (!validTypes.includes(availabilityType.toUpperCase())) {
      res.status(400).json({ error: 'Invalid availability type. Must be one of: AVAILABLE, UNAVAILABLE, PREFERRED' });
      return;
    }

    // Find employee position if not provided
    // REQUIREMENT: User must have at least one active EmployeePosition record for this business
    // to set availability. This links the user to a Position in the org chart, which is required
    // for scheduling functionality. The EmployeePosition must have:
    // - userId: matches the authenticated user
    // - businessId: matches the request businessId  
    // - active: true
    // - positionId: references a Position record in the org chart
    // - assignedById: the user who assigned this position
    // - startDate: when the position assignment started
    // To create an EmployeePosition, use the org chart API: POST /api/org-chart/employees/assign
    let finalEmployeePositionId = employeePositionId;
    if (!finalEmployeePositionId) {
      const position = await prisma.employeePosition.findFirst({
        where: {
          businessId,
          userId: user.id,
          active: true
        },
        select: { id: true }
      });

      if (!position) {
        res.status(404).json({ 
          error: 'No active employee position found for this user',
          message: 'You must be assigned to a position in the org chart for this business before setting availability. Please contact your administrator to add you to the org chart, or use the org chart UI to assign yourself to a position.',
          helpUrl: '/api/org-chart/employees/assign'
        });
        return;
      }
      finalEmployeePositionId = position.id;
    } else {
      // Verify the position belongs to the user
      const position = await prisma.employeePosition.findFirst({
        where: {
          id: finalEmployeePositionId,
          businessId,
          userId: user.id,
          active: true
        }
      });

      if (!position) {
        res.status(403).json({ error: 'You can only set availability for your own position' });
        return;
      }
    }

    // Check for overlapping availability on the same day
    const overlapping = await prisma.employeeAvailability.findFirst({
      where: {
        businessId,
        employeePositionId: finalEmployeePositionId,
        dayOfWeek: dayOfWeek.toUpperCase(),
        OR: [
          {
            AND: [
              { effectiveFrom: { lte: effectiveTo ? new Date(effectiveTo) : new Date('2099-12-31') } },
              { effectiveTo: { gte: effectiveFrom ? new Date(effectiveFrom) : new Date('1970-01-01') } }
            ]
          },
          {
            AND: [
              { recurring: true },
              { effectiveTo: null }
            ]
          }
        ]
      }
    });

    if (overlapping) {
      res.status(409).json({ 
        error: 'Overlapping availability already exists for this day and time period',
        conflictId: overlapping.id
      });
      return;
    }

    // Create availability record
    const availability = await prisma.employeeAvailability.create({
      data: {
        businessId,
        employeePositionId: finalEmployeePositionId,
        dayOfWeek: dayOfWeek.toUpperCase(),
        startTime,
        endTime,
        availabilityType: availabilityType.toUpperCase() as 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED',
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        recurring: recurring !== undefined ? recurring : true,
        notes: notes || null
      },
      include: {
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    logger.info('Availability created', {
      operation: 'set_own_availability',
      userId: user.id,
      businessId,
      employeePositionId: finalEmployeePositionId,
      availabilityId: availability.id
    });

    res.status(201).json(availability);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to set availability', {
      operation: 'set_own_availability',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to set availability' });
  }
}

/**
 * PUT /api/scheduling/me/availability/:id
 * Update employee availability
 */
export async function updateOwnAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const availabilityId = req.params.id;
    const { dayOfWeek, startTime, endTime, availabilityType, effectiveFrom, effectiveTo, recurring, notes } = req.body;

    if (!user || !businessId || !availabilityId) {
      res.status(401).json({ error: 'User not authenticated or missing required parameters' });
      return;
    }

    // Find the availability record and verify ownership
    const existingAvailability = await prisma.employeeAvailability.findUnique({
      where: { id: availabilityId },
      include: {
        employeePosition: {
          include: {
            user: true
          }
        }
      }
    });

    if (!existingAvailability || existingAvailability.businessId !== businessId) {
      res.status(404).json({ error: 'Availability record not found' });
      return;
    }

    // Verify the availability belongs to the user
    if (existingAvailability.employeePosition.userId !== user.id) {
      res.status(403).json({ error: 'You can only update your own availability' });
      return;
    }

    // Build update data
    const updateData: Prisma.EmployeeAvailabilityUpdateInput = {};

    if (dayOfWeek) {
      const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
      if (!validDays.includes(dayOfWeek.toUpperCase())) {
        res.status(400).json({ error: 'Invalid day of week' });
        return;
      }
      updateData.dayOfWeek = dayOfWeek.toUpperCase();
    }

    if (startTime !== undefined) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime)) {
        res.status(400).json({ error: 'Invalid start time format. Use HH:MM' });
        return;
      }
      updateData.startTime = startTime;
    }

    if (endTime !== undefined) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(endTime)) {
        res.status(400).json({ error: 'Invalid end time format. Use HH:MM' });
        return;
      }
      updateData.endTime = endTime;
    }

    // Validate end time is after start time if both are provided
    if ((startTime !== undefined || endTime !== undefined) && updateData.startTime && updateData.endTime) {
      const finalStartTime = (updateData.startTime as string) || existingAvailability.startTime;
      const finalEndTime = (updateData.endTime as string) || existingAvailability.endTime;
      
      const [startHour, startMin] = finalStartTime.split(':').map(Number);
      const [endHour, endMin] = finalEndTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (endMinutes <= startMinutes) {
        res.status(400).json({ error: 'End time must be after start time' });
        return;
      }
    }

    if (availabilityType) {
      const validTypes = ['AVAILABLE', 'UNAVAILABLE', 'PREFERRED'];
      if (!validTypes.includes(availabilityType.toUpperCase())) {
        res.status(400).json({ error: 'Invalid availability type' });
        return;
      }
      updateData.availabilityType = availabilityType.toUpperCase() as 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';
    }

    if (effectiveFrom !== undefined) {
      updateData.effectiveFrom = new Date(effectiveFrom);
    }

    if (effectiveTo !== undefined) {
      updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    }

    if (recurring !== undefined) {
      updateData.recurring = recurring;
    }

    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    // Update the availability record
    const updatedAvailability = await prisma.employeeAvailability.update({
      where: { id: availabilityId },
      data: updateData,
      include: {
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    logger.info('Availability updated', {
      operation: 'update_own_availability',
      userId: user.id,
      businessId,
      availabilityId
    });

    res.json(updatedAvailability);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to update availability', {
      operation: 'update_own_availability',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to update availability' });
  }
}

/**
 * GET /api/scheduling/me/availability
 * Get employee's own availability
 */
export async function getOwnAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const employeePositionId = req.employeePositionId;

    if (!user || !businessId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Find employee position if not provided
    let finalEmployeePositionId = employeePositionId;
    if (!finalEmployeePositionId) {
      const position = await prisma.employeePosition.findFirst({
        where: {
          businessId,
          userId: user.id,
          active: true
        },
        select: { id: true }
      });

      if (!position) {
        // Return empty array if no position found (user might be a member without position)
        res.json({ availability: [] });
        return;
      }
      finalEmployeePositionId = position.id;
    } else {
      // Verify the position belongs to the user
      const position = await prisma.employeePosition.findFirst({
        where: {
          id: finalEmployeePositionId,
          businessId,
          userId: user.id,
          active: true
        }
      });

      if (!position) {
        res.status(403).json({ error: 'You can only view availability for your own position' });
        return;
      }
    }

    // Query availability records
    const availability = await prisma.employeeAvailability.findMany({
      where: {
        businessId,
        employeePositionId: finalEmployeePositionId
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ],
      include: {
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    logger.info('Own availability retrieved', {
      operation: 'get_own_availability',
      userId: user.id,
      businessId,
      availabilityCount: availability.length
    });

    res.json({ availability });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get own availability', {
      operation: 'get_own_availability',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to retrieve availability' });
  }
}

/**
 * DELETE /api/scheduling/me/availability/:id
 * Delete employee availability
 */
export async function deleteOwnAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const availabilityId = req.params.id;

    if (!user || !businessId || !availabilityId) {
      res.status(401).json({ error: 'User not authenticated or missing required parameters' });
      return;
    }

    // Find the availability record and verify ownership
    const existingAvailability = await prisma.employeeAvailability.findUnique({
      where: { id: availabilityId },
      include: {
        employeePosition: {
          include: {
            user: true
          }
        }
      }
    });

    if (!existingAvailability || existingAvailability.businessId !== businessId) {
      res.status(404).json({ error: 'Availability record not found' });
      return;
    }

    // Verify the availability belongs to the user
    if (existingAvailability.employeePosition.userId !== user.id) {
      res.status(403).json({ error: 'You can only delete your own availability' });
      return;
    }

    // Delete the availability record
    await prisma.employeeAvailability.delete({
      where: { id: availabilityId }
    });

    logger.info('Availability deleted', {
      operation: 'delete_own_availability',
      userId: user.id,
      businessId,
      availabilityId
    });

    res.json({ message: 'Availability deleted successfully' });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to delete availability', {
      operation: 'delete_own_availability',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to delete availability' });
  }
}

/**
 * POST /api/scheduling/me/shifts/:id/swap/request
 * Request a shift swap
 */
export async function requestShiftSwap(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const shiftId = req.params.id;
    const { requestedToId, coveredShiftId, requestNotes } = req.body;

    if (!user || !businessId || !shiftId) {
      res.status(401).json({ error: 'User not authenticated or missing required parameters' });
      return;
    }

    // Verify the shift exists and belongs to the user
    const shift = await prisma.scheduleShift.findUnique({
      where: { id: shiftId },
      include: {
        employeePosition: {
          include: {
            user: true
          }
        }
      }
    });

    if (!shift || shift.businessId !== businessId) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    // Verify the shift is assigned to the requesting user
    if (!shift.employeePosition || shift.employeePosition.userId !== user.id) {
      res.status(403).json({ error: 'You can only request swaps for your own shifts' });
      return;
    }

    // Check if shift is in the future
    if (new Date(shift.startTime) < new Date()) {
      res.status(400).json({ error: 'Cannot swap shifts that have already started' });
      return;
    }

    // Create the swap request
    const swapReason = requestNotes || (coveredShiftId ? `Willing to cover shift ${coveredShiftId}` : null);

    const swapRequest = await prisma.shiftSwapRequest.create({
      data: {
        businessId,
        originalShiftId: shiftId,
        requestedById: user.id,
        requestedToId: requestedToId || null,
        reason: swapReason,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
      include: {
        originalShift: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true
              }
            },
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requestedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    logger.info('Shift swap request created', {
      operation: 'request_shift_swap',
      userId: user.id,
      businessId,
      shiftId,
      swapRequestId: swapRequest.id
    });

    res.status(201).json(swapRequest);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to request shift swap', {
      operation: 'request_shift_swap',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to request shift swap' });
  }
}

/**
 * GET /api/scheduling/me/swaps
 * Get the current user's own shift swap requests
 * 
 * NOTE: Time-off requests should use HR module's TimeOffRequest model.
 * This endpoint is for shift swaps only (different from time-off).
 */
export async function getOwnShiftSwapRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const employeePositionId = req.employeePositionId;

    if (!user || !businessId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Query swap requests for this employee
    // ShiftSwapRequest uses requestedById (userId) not employeePositionId
    const orConditions: Prisma.ShiftSwapRequestWhereInput[] = [
      { requestedById: user.id },
      { requestedToId: user.id }
    ];

    if (employeePositionId) {
      orConditions.push({
        originalShift: {
          employeePositionId
        }
      });
    }

    const where: Prisma.ShiftSwapRequestWhereInput = {
      businessId,
      OR: orConditions
    };

    const swaps = await prisma.shiftSwapRequest.findMany({
      where,
      include: {
        originalShift: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true
              }
            },
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requestedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    logger.info('Own swap requests retrieved', {
      operation: 'get_own_swap_requests',
      userId: user.id,
      businessId,
      swapCount: swaps.length
    });

    res.json({ swaps });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get own swap requests', {
      operation: 'get_own_swap_requests',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to retrieve swap requests' });
  }
}

/**
 * POST /api/scheduling/me/swap-requests/:id/cancel
 * Cancel a pending shift swap request
 */
export async function cancelSwapRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const swapId = req.params.id;

    if (!user || !businessId || !swapId) {
      res.status(401).json({ error: 'User not authenticated or missing required parameters' });
      return;
    }

    // Find the swap request
    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapId },
      include: {
        originalShift: {
          include: {
            employeePosition: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (!swapRequest || swapRequest.businessId !== businessId) {
      res.status(404).json({ error: 'Swap request not found' });
      return;
    }

    // Verify the swap request belongs to the user
    if (swapRequest.requestedById !== user.id) {
      res.status(403).json({ error: 'You can only cancel your own swap requests' });
      return;
    }

    // Only allow cancellation of pending requests
    if (swapRequest.status !== 'PENDING') {
      res.status(400).json({ error: 'Can only cancel pending swap requests' });
      return;
    }

    // Update status to CANCELLED
    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'CANCELLED'
      },
      include: {
        originalShift: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true
              }
            },
            employeePosition: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        requestedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    logger.info('Swap request cancelled', {
      operation: 'cancel_swap_request',
      userId: user.id,
      businessId,
      swapRequestId: swapId
    });

    res.json(updatedSwap);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to cancel swap request', {
      operation: 'cancel_swap_request',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to cancel swap request' });
  }
}

/**
 * POST /api/scheduling/me/shifts/:id/claim
 * Claim an open shift
 */
export async function claimOpenShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const shiftId = req.params.id;
    const employeePositionId = req.employeePositionId;

    if (!user || !businessId || !shiftId) {
      res.status(401).json({ error: 'User not authenticated or missing required parameters' });
      return;
    }

    // Find the shift
    const shift = await prisma.scheduleShift.findUnique({
      where: { id: shiftId },
      include: {
        schedule: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!shift || shift.businessId !== businessId) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    // Verify the shift is open
    if (!shift.isOpenShift || shift.status !== 'OPEN') {
      res.status(400).json({ error: 'Shift is not available for claiming. It may already be assigned or not marked as open.' });
      return;
    }

    // Check if shift is in the future
    if (new Date(shift.startTime) < new Date()) {
      res.status(400).json({ error: 'Cannot claim shifts that have already started' });
      return;
    }

    // Find employee position if not provided
    let finalEmployeePositionId = employeePositionId;
    if (!finalEmployeePositionId) {
      const position = await prisma.employeePosition.findFirst({
        where: {
          businessId,
          userId: user.id,
          active: true
        },
        select: { id: true }
      });

      if (!position) {
        res.status(404).json({ error: 'No active employee position found for this user' });
        return;
      }
      finalEmployeePositionId = position.id;
    } else {
      // Verify the position belongs to the user
      const position = await prisma.employeePosition.findFirst({
        where: {
          id: finalEmployeePositionId,
          businessId,
          userId: user.id,
          active: true
        }
      });

      if (!position) {
        res.status(403).json({ error: 'You can only claim shifts for your own position' });
        return;
      }
    }

    // Check if position matches shift requirements (if specified)
    if (shift.positionId && shift.positionId !== shift.employeePosition?.positionId) {
      // Verify the employee position matches the required position
      const employeePosition = await prisma.employeePosition.findUnique({
        where: { id: finalEmployeePositionId },
        select: { positionId: true }
      });

      if (employeePosition?.positionId !== shift.positionId) {
        res.status(403).json({ 
          error: 'You do not have the required position to claim this shift',
          requiredPositionId: shift.positionId
        });
        return;
      }
    }

    // Check for overlapping shifts (employee already scheduled during this time)
    const overlappingShift = await prisma.scheduleShift.findFirst({
      where: {
        businessId,
        employeePositionId: finalEmployeePositionId,
        id: { not: shiftId },
        status: { not: 'CANCELLED' },
        OR: [
          {
            AND: [
              { startTime: { lte: shift.startTime } },
              { endTime: { gt: shift.startTime } }
            ]
          },
          {
            AND: [
              { startTime: { lt: shift.endTime } },
              { endTime: { gte: shift.endTime } }
            ]
          },
          {
            AND: [
              { startTime: { gte: shift.startTime } },
              { endTime: { lte: shift.endTime } }
            ]
          }
        ]
      }
    });

    if (overlappingShift) {
      res.status(409).json({ 
        error: 'You are already scheduled for a shift during this time period',
        conflictingShiftId: overlappingShift.id
      });
      return;
    }

    // Assign the shift to the employee
    const updatedShift = await prisma.scheduleShift.update({
      where: { id: shiftId },
      data: {
        employeePosition: { connect: { id: finalEmployeePositionId } },
        isOpenShift: false,
        status: 'SCHEDULED'
      },
      include: {
        schedule: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        employeePosition: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            position: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    logger.info('Open shift claimed', {
      operation: 'claim_open_shift',
      userId: user.id,
      businessId,
      shiftId,
      employeePositionId: finalEmployeePositionId
    });

    // Sync to calendar if schedule is published
    if (updatedShift.schedule.status === 'PUBLISHED') {
      try {
        const { syncSingleShiftToCalendar } = await import('../services/hrScheduleService');
        await syncSingleShiftToCalendar(shiftId, businessId);
        logger.info('Open shift claim synced to calendar', {
          operation: 'claim_open_shift_calendar_sync',
          shiftId,
          businessId
        });
      } catch (calendarError) {
        // Log but don't fail the request if calendar sync fails
        logger.warn('Failed to sync open shift claim to calendar', {
          operation: 'claim_open_shift_calendar_sync',
          shiftId,
          businessId,
          error: {
            message: calendarError instanceof Error ? calendarError.message : 'Unknown error',
            stack: calendarError instanceof Error ? calendarError.stack : undefined
          }
        });
      }
    }

    res.json(updatedShift);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to claim open shift', {
      operation: 'claim_open_shift',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to claim shift' });
  }
}

/**
 * GET /api/scheduling/me/open-shifts
 * Get available open shifts for the current user
 */
export async function getOwnOpenShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    // Get businessId from middleware or validate from query
    let businessId: string | undefined = req.businessId;
    if (!businessId) {
      const businessIdParam = req.query.businessId;
      if (businessIdParam && typeof businessIdParam === 'string') {
        businessId = businessIdParam;
      } else if (businessIdParam) {
        res.status(400).json({ error: 'businessId must be a string' });
        return;
      }
    }
    const employeePositionId = req.employeePositionId;
    const { startDate, endDate, positionId } = req.query;

    if (!user || !businessId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Find employee position to check position requirements
    let finalEmployeePositionId = employeePositionId;
    let userPositionId: string | null = null;

    if (!finalEmployeePositionId) {
      const position = await prisma.employeePosition.findFirst({
        where: {
          businessId,
          userId: user.id,
          active: true
        },
        include: {
          position: {
            select: { id: true }
          }
        }
      });

      if (position) {
        finalEmployeePositionId = position.id;
        userPositionId = position.positionId;
      }
    } else {
      const position = await prisma.employeePosition.findUnique({
        where: { id: finalEmployeePositionId },
        include: {
          position: {
            select: { id: true }
          }
        }
      });

      if (position && position.businessId === businessId && position.userId === user.id) {
        userPositionId = position.positionId;
      }
    }

    // Build query for open shifts
    // Only show open shifts from PUBLISHED schedules (employees shouldn't see draft schedules)
    const where: Prisma.ScheduleShiftWhereInput = {
      businessId,
      isOpenShift: true,
      status: 'OPEN',
      startTime: { gte: new Date() }, // Only future shifts
      schedule: {
        status: 'PUBLISHED' // Only show shifts from published schedules
      }
    };

    // Filter by date range if provided
    if (startDate && typeof startDate === 'string') {
      where.startTime = { ...where.startTime as Prisma.DateTimeFilter, gte: new Date(startDate) };
    }
    if (endDate && typeof endDate === 'string') {
      where.endTime = { lte: new Date(endDate) };
    }

    // Filter by position if specified or match user's position
    if (positionId && typeof positionId === 'string') {
      where.positionId = positionId;
    } else if (userPositionId) {
      // Show shifts that match user's position OR shifts with no position requirement
      where.OR = [
        { positionId: userPositionId },
        { positionId: null }
      ];
    } else {
      // If user has no position, only show shifts with no position requirement
      where.positionId = null;
    }

    // Exclude shifts the user is already assigned to or has conflicts with
    if (finalEmployeePositionId) {
      const conflictingShifts = await prisma.scheduleShift.findMany({
        where: {
          businessId,
          employeePositionId: finalEmployeePositionId,
          status: { not: 'CANCELLED' },
          startTime: { gte: new Date() }
        },
        select: {
          startTime: true,
          endTime: true
        }
      });

      // Build OR condition to exclude overlapping times
      if (conflictingShifts.length > 0) {
        where.NOT = conflictingShifts.map(conflict => ({
          OR: [
            {
              AND: [
                { startTime: { lte: conflict.startTime } },
                { endTime: { gt: conflict.startTime } }
              ]
            },
            {
              AND: [
                { startTime: { lt: conflict.endTime } },
                { endTime: { gte: conflict.endTime } }
              ]
            },
            {
              AND: [
                { startTime: { gte: conflict.startTime } },
                { endTime: { lte: conflict.endTime } }
              ]
            }
          ]
        }));
      }
    }

    const openShifts = await prisma.scheduleShift.findMany({
      where,
      include: {
        schedule: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true
          }
        },
        position: {
          select: {
            id: true,
            title: true
          }
        },
        location: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    logger.info('Open shifts retrieved', {
      operation: 'get_own_open_shifts',
      userId: user.id,
      businessId,
      shiftCount: openShifts.length
    });

    res.json({ shifts: openShifts });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to get open shifts', {
      operation: 'get_own_open_shifts',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ error: 'Failed to retrieve open shifts' });
  }
}

// ============================================================================
// AI CONTEXT PROVIDERS
// ============================================================================

/**
 * GET /api/scheduling/ai/context/overview
 * 
 * Returns scheduling system overview and statistics
 * Used by AI to understand overall scheduling metrics and status
 */
export async function getSchedulingOverviewForAI(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { businessId } = req.query;
    
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ success: false, message: 'businessId is required' });
      return;
    }

    // Verify access
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
    });

    if (!member || !member.isActive) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Get date ranges
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    // Get schedule stats
    const [
      totalSchedules,
      publishedSchedules,
      draftSchedules,
      upcomingSchedules,
      totalShifts,
      openShifts,
      pendingSwaps
    ] = await Promise.all([
      prisma.schedule.count({
        where: { businessId }
      }),
      prisma.schedule.count({
        where: { 
          businessId,
          status: 'PUBLISHED'
        }
      }),
      prisma.schedule.count({
        where: { 
          businessId,
          status: 'DRAFT'
        }
      }),
      prisma.schedule.findMany({
        where: {
          businessId,
          status: 'PUBLISHED',
          startDate: { lte: sevenDaysFromNow },
          endDate: { gte: today }
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          _count: {
            select: {
              shifts: true
            }
          }
        },
        take: 5
      }),
      prisma.scheduleShift.count({
        where: {
          businessId,
          startTime: { gte: today }
        }
      }),
      prisma.scheduleShift.count({
        where: {
          businessId,
          status: 'OPEN',
          startTime: { gte: today }
        }
      }),
      prisma.shiftSwapRequest.count({
        where: {
          businessId,
          status: 'PENDING'
        }
      })
    ]);

    const context = {
      schedules: {
        total: totalSchedules,
        published: publishedSchedules,
        draft: draftSchedules,
        upcoming: upcomingSchedules.map(s => ({
          id: s.id,
          name: s.name,
          startDate: s.startDate.toISOString().split('T')[0],
          endDate: s.endDate.toISOString().split('T')[0],
          shiftCount: s._count.shifts
        }))
      },
      shifts: {
        totalUpcoming: totalShifts,
        open: openShifts,
        assigned: totalShifts - openShifts,
        fillRate: totalShifts > 0 ? Math.round((totalShifts - openShifts) / totalShifts * 100) : 100
      },
      swaps: {
        pending: pendingSwaps
      },
      summary: {
        activeSchedules: publishedSchedules,
        needsAttention: draftSchedules > 0 || openShifts > 0 || pendingSwaps > 0,
        status: openShifts === 0 && pendingSwaps === 0 ? 'good' : 
                openShifts > 10 || pendingSwaps > 5 ? 'needs-attention' : 'normal'
      }
    };

    res.json({
      success: true,
      context,
      metadata: {
        provider: 'scheduling',
        endpoint: 'overview',
        businessId,
        timestamp: now.toISOString()
      }
    });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to get scheduling overview for AI', {
      operation: 'get_scheduling_overview_ai',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch scheduling overview',
      error: err.message
    });
  }
}

/**
 * GET /api/scheduling/ai/context/coverage
 * 
 * Returns current and upcoming coverage status
 * Used by AI to answer "coverage" and "who's working" questions
 */
export async function getCoverageStatusForAI(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { businessId } = req.query;
    
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ success: false, message: 'businessId is required' });
      return;
    }

    // Verify access
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
    });

    if (!member || !member.isActive) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Get date ranges
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // Get shifts for today and upcoming week
    const [
      todayShifts,
      tomorrowShifts,
      weekShifts
    ] = await Promise.all([
      prisma.scheduleShift.findMany({
        where: {
          businessId,
          startTime: { gte: today, lt: tomorrow }
        },
        include: {
          employeePosition: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true
                }
              },
              position: {
                select: {
                  title: true
                }
              }
            }
          }
        }
      }),
      prisma.scheduleShift.findMany({
        where: {
          businessId,
          startTime: { gte: tomorrow, lt: new Date(tomorrow.getTime() + 86400000) }
        },
        include: {
          employeePosition: {
            include: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.scheduleShift.findMany({
        where: {
          businessId,
          startTime: { gte: today, lt: nextWeek }
        },
        select: {
          startTime: true,
          status: true
        }
      })
    ]);

    // Group week shifts by day
    const shiftsByDay = new Map<string, { total: number; open: number }>();
    weekShifts.forEach(shift => {
      const dateStr = shift.startTime.toISOString().split('T')[0];
      if (!shiftsByDay.has(dateStr)) {
        shiftsByDay.set(dateStr, { total: 0, open: 0 });
      }
      const day = shiftsByDay.get(dateStr)!;
      day.total++;
      if (shift.status === 'OPEN') day.open++;
    });

    const context = {
      today: {
        date: today.toISOString().split('T')[0],
        totalShifts: todayShifts.length,
        openShifts: todayShifts.filter(s => s.status === 'OPEN').length,
        assignedShifts: todayShifts.filter(s => s.status !== 'OPEN').length,
        workingEmployees: todayShifts
          .filter(s => s.employeePosition)
          .map(s => ({
            name: s.employeePosition?.user?.name || 'Unknown',
            position: s.employeePosition?.position?.title || 'Unknown',
            startTime: s.startTime.toISOString(),
            endTime: s.endTime.toISOString()
          })),
        coverageRate: todayShifts.length > 0 ? 
          Math.round((todayShifts.filter(s => s.status !== 'OPEN').length / todayShifts.length) * 100) : 100
      },
      tomorrow: {
        date: tomorrow.toISOString().split('T')[0],
        totalShifts: tomorrowShifts.length,
        openShifts: tomorrowShifts.filter(s => s.status === 'OPEN').length,
        assignedShifts: tomorrowShifts.filter(s => s.status !== 'OPEN').length,
        coverageRate: tomorrowShifts.length > 0 ? 
          Math.round((tomorrowShifts.filter(s => s.status !== 'OPEN').length / tomorrowShifts.length) * 100) : 100
      },
      thisWeek: {
        startDate: today.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0],
        totalShifts: weekShifts.length,
        openShifts: weekShifts.filter(s => s.status === 'OPEN').length,
        byDay: Array.from(shiftsByDay.entries()).map(([date, stats]) => ({
          date,
          totalShifts: stats.total,
          openShifts: stats.open,
          coverageRate: stats.total > 0 ? Math.round(((stats.total - stats.open) / stats.total) * 100) : 100
        }))
      },
      summary: {
        currentCoverage: todayShifts.length > 0 ? 
          Math.round((todayShifts.filter(s => s.status !== 'OPEN').length / todayShifts.length) * 100) : 100,
        status: todayShifts.filter(s => s.status === 'OPEN').length === 0 ? 'fully-covered' : 
                todayShifts.filter(s => s.status === 'OPEN').length > 5 ? 'critical' : 'some-gaps'
      }
    };

    res.json({
      success: true,
      context,
      metadata: {
        provider: 'scheduling',
        endpoint: 'coverage',
        businessId,
        timestamp: now.toISOString()
      }
    });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to get coverage status for AI', {
      operation: 'get_coverage_status_ai',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch coverage status',
      error: err.message
    });
  }
}

/**
 * GET /api/scheduling/ai/context/conflicts
 * 
 * Returns scheduling conflicts and gaps
 * Used by AI to identify problems and suggest solutions
 */
export async function getSchedulingConflictsForAI(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { businessId } = req.query;
    
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ success: false, message: 'businessId is required' });
      return;
    }

    // Verify access
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
    });

    if (!member || !member.isActive) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Get upcoming shifts (next 14 days)
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);

    const [
      openShifts,
      pendingSwaps,
      upcomingShifts
    ] = await Promise.all([
      prisma.scheduleShift.findMany({
        where: {
          businessId,
          status: 'OPEN',
          startTime: { gte: today, lt: twoWeeksFromNow }
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          schedule: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          startTime: 'asc'
        },
        take: 20
      }),
      prisma.shiftSwapRequest.findMany({
        where: {
          businessId,
          status: 'PENDING'
        },
        include: {
          originalShift: {
            select: {
              startTime: true,
              endTime: true
            }
          },
          requestedBy: {
            select: {
              name: true
            }
          }
        },
        take: 10
      }),
      prisma.scheduleShift.findMany({
        where: {
          businessId,
          startTime: { gte: today, lt: twoWeeksFromNow }
        },
        select: {
          employeePositionId: true,
          startTime: true,
          endTime: true
        }
      })
    ]);

    // Detect overlapping shifts (same employee, overlapping times)
    const shiftsByEmployee = new Map<string, typeof upcomingShifts>();
    upcomingShifts.forEach(shift => {
      if (shift.employeePositionId) {
        if (!shiftsByEmployee.has(shift.employeePositionId)) {
          shiftsByEmployee.set(shift.employeePositionId, []);
        }
        shiftsByEmployee.get(shift.employeePositionId)!.push(shift);
      }
    });

    interface OverlappingShift {
      employeePositionId: string;
      shift1: { startTime: string; endTime: string };
      shift2: { startTime: string; endTime: string };
    }

    const overlappingShifts: OverlappingShift[] = [];
    shiftsByEmployee.forEach((shifts, employeeId) => {
      for (let i = 0; i < shifts.length; i++) {
        for (let j = i + 1; j < shifts.length; j++) {
          const shift1 = shifts[i];
          const shift2 = shifts[j];
          
          if (shift1.startTime < shift2.endTime && shift2.startTime < shift1.endTime) {
            overlappingShifts.push({
              employeePositionId: employeeId,
              shift1: {
                startTime: shift1.startTime.toISOString(),
                endTime: shift1.endTime.toISOString()
              },
              shift2: {
                startTime: shift2.startTime.toISOString(),
                endTime: shift2.endTime.toISOString()
              }
            });
          }
        }
      }
    });

    const context = {
      openShifts: {
        count: openShifts.length,
        shifts: openShifts.map(shift => ({
          id: shift.id,
          scheduleName: shift.schedule?.name || 'Unknown',
          startTime: shift.startTime.toISOString(),
          endTime: shift.endTime.toISOString(),
          daysUntil: Math.floor((shift.startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        }))
      },
      pendingSwaps: {
        count: pendingSwaps.length,
        requests: pendingSwaps.map(swap => ({
          requestedBy: swap.requestedBy?.name || 'Unknown',
          shiftDate: swap.originalShift.startTime.toISOString().split('T')[0],
          shiftTime: `${swap.originalShift.startTime.toISOString().split('T')[1].substring(0, 5)} - ${swap.originalShift.endTime.toISOString().split('T')[1].substring(0, 5)}`,
          status: swap.status
        }))
      },
      conflicts: {
        overlappingShifts: {
          count: overlappingShifts.length,
          details: overlappingShifts.slice(0, 5) // Top 5 conflicts
        }
      },
      summary: {
        totalIssues: openShifts.length + pendingSwaps.length + overlappingShifts.length,
        criticalIssues: overlappingShifts.length,
        requiresAction: openShifts.length > 0 || pendingSwaps.length > 0,
        status: overlappingShifts.length > 0 ? 'has-conflicts' : 
                openShifts.length > 10 ? 'many-gaps' :
                openShifts.length > 0 ? 'some-gaps' : 'all-good'
      }
    };

    res.json({
      success: true,
      context,
      metadata: {
        provider: 'scheduling',
        endpoint: 'conflicts',
        businessId,
        timestamp: now.toISOString()
      }
    });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to get scheduling conflicts for AI', {
      operation: 'get_scheduling_conflicts_ai',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch scheduling conflicts',
      error: err.message
    });
  }
}

/**
 * GET /api/scheduling/recommendations
 * Get scheduling recommendations based on business industry
 */
export async function getSchedulingRecommendations(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    const { businessId, industry } = req.query;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    // Get business to check industry
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { industry: true, schedulingMode: true, schedulingStrategy: true }
    });

    if (!business) {
      res.status(404).json({ error: 'Business not found' });
      return;
    }

    // Use provided industry or business industry
    const industryToUse = (industry && typeof industry === 'string') 
      ? industry 
      : business.industry || null;

    // Get recommended configuration
    const recommendation = getRecommendedSchedulingConfig(industryToUse);

    // Include current configuration if set
    const currentConfig = business.schedulingMode 
      ? {
          mode: business.schedulingMode,
          strategy: business.schedulingStrategy,
        }
      : null;

    res.json({
      success: true,
      recommendation,
      currentConfig,
      businessIndustry: business.industry,
    });

    logger.info('Scheduling recommendations retrieved', {
      operation: 'get_scheduling_recommendations',
      userId: user.id,
      businessId,
      industry: industryToUse,
      recommendedMode: recommendation.mode,
    });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to get scheduling recommendations', {
      operation: 'get_scheduling_recommendations',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch scheduling recommendations',
      error: err.message
    });
  }
}

/**
 * POST /api/scheduling/ai/generate-schedule
 * Generate a schedule using AI/philosophy engine
 */
export async function generateAISchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    const { businessId, scheduleId, strategy, constraints } = req.body;

    if (!user) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ success: false, error: 'Business ID is required' });
      return;
    }

    if (!scheduleId || typeof scheduleId !== 'string') {
      res.status(400).json({ success: false, error: 'Schedule ID is required' });
      return;
    }

    // Get business configuration
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { schedulingMode: true, schedulingStrategy: true }
    });

    if (!business) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    // Get schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        shifts: {
          include: {
            employeePosition: {
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                },
                position: {
                  select: { 
                    title: true,
                    jobFunction: true,
                    stationName: true,
                    stationType: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!schedule) {
      res.status(404).json({ success: false, error: 'Schedule not found' });
      return;
    }

    // Get employees with availability
    const employeePositions = await prisma.employeePosition.findMany({
      where: { businessId, active: true },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        position: {
          select: {
            title: true,
            jobFunction: true,
            stationName: true,
            stationType: true
          }
        },
        availability: {
          where: {
            effectiveFrom: { lte: new Date(schedule.endDate) },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: new Date(schedule.startDate) } }
            ]
          }
        }
      }
    });

    // Prepare philosophy context
    const selectedStrategy = strategy || business.schedulingStrategy || 'AVAILABILITY_FIRST';
    const selectedMode = business.schedulingMode || 'OTHER';

    // Convert to philosophy service format
    const employees = employeePositions.map(ep => {
      const availability = ep.availability.map((av: { dayOfWeek: string; startTime: string; endTime: string; availabilityType: string }) => {
        // Convert time strings to minutes
        const startMinutes = av.startTime ? (parseInt(av.startTime.split(':')[0]) * 60 + parseInt(av.startTime.split(':')[1])) : undefined;
        const endMinutes = av.endTime ? (parseInt(av.endTime.split(':')[0]) * 60 + parseInt(av.endTime.split(':')[1])) : undefined;
        
        return {
          day: av.dayOfWeek,
          startTime: startMinutes,
          endTime: endMinutes,
          isAvailable: av.availabilityType === 'AVAILABLE',
        };
      });

      // Calculate current hours for the week
      const weekShifts = schedule.shifts.filter(s => 
        s.employeePositionId === ep.id
      );
      const currentHours = weekShifts.reduce((total, shift) => {
        const start = new Date(shift.startTime);
        const end = new Date(shift.endTime);
        return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);

      return {
        employeePositionId: ep.id,
        userId: ep.user.id,
        userName: ep.user.name || 'Unknown',
        positionTitle: ep.position.title,
        jobFunction: ep.position.jobFunction || undefined,
        stationName: ep.position.stationName || undefined,
        availability,
        currentHoursThisWeek: currentHours,
      };
    });

    // Generate shift requirements from existing shifts or create default
    const requirements = schedule.shifts.map(shift => {
      const startDate = new Date(shift.startTime);
      const endDate = new Date(shift.endTime);
      const dayOfWeek = startDate.toLocaleDateString('en-US', { weekday: 'long' });
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

      return {
        day: dayOfWeek,
        startTime: startMinutes,
        endTime: endMinutes,
        requiredRole: undefined, // ScheduleShift doesn't have role field directly
        requiredJobFunction: shift.jobFunction as JobFunction | undefined,
        requiredStation: shift.stationName || undefined,
        minStaffing: shift.minStaffing || 1,
        maxStaffing: shift.maxStaffing || 1,
        priority: shift.priority || 5,
      };
    });

    // Generate recommendations
    const recommendations = await SchedulingPhilosophyService.generateRecommendations({
      businessId,
      mode: selectedMode,
      strategy: selectedStrategy as SchedulingStrategy,
      employees,
      requirements,
      constraints: constraints || {},
    });

    // Create shifts from recommendations
    const createdShifts = [];
    for (const rec of recommendations) {
      // Find day date within schedule range
      const scheduleStart = new Date(schedule.startDate);
      const scheduleEnd = new Date(schedule.endDate);
      const targetDate = new Date(scheduleStart);

      // Find the matching day of week
      const targetDayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(rec.day);
      const startDayIndex = scheduleStart.getDay();
      const daysOffset = (targetDayIndex - startDayIndex + 7) % 7;
      targetDate.setDate(scheduleStart.getDate() + daysOffset);

      // Ensure date is within schedule range
      if (targetDate < scheduleStart || targetDate > scheduleEnd) {
        continue; // Skip if outside range
      }

      const startTime = new Date(targetDate);
      startTime.setHours(Math.floor(rec.startTime / 60), rec.startTime % 60, 0, 0);

      const endTime = new Date(targetDate);
      endTime.setHours(Math.floor(rec.endTime / 60), rec.endTime % 60, 0, 0);

      try {
        const shift = await prisma.scheduleShift.create({
          data: {
            businessId,
            scheduleId: schedule.id,
            employeePositionId: rec.employeePositionId,
            startTime,
            endTime,
            breakMinutes: 0,
            title: 'AI Generated Shift',
            status: 'SCHEDULED',
            priority: Math.round(rec.confidence * 10),
          },
          include: {
            employeePosition: {
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                },
                position: {
                  select: { title: true }
                }
              }
            }
          }
        });

        createdShifts.push(shift);
      } catch (err) {
        logger.error('Failed to create shift from recommendation', {
          operation: 'generate_ai_schedule',
          error: { 
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined
          },
          recommendation: rec,
        });
      }
    }

    res.json({
      success: true,
      message: `Generated ${createdShifts.length} shifts using ${selectedStrategy} strategy`,
      shifts: createdShifts,
      recommendations: recommendations.length,
      created: createdShifts.length,
    });

    logger.info('AI schedule generated', {
      operation: 'generate_ai_schedule',
      userId: user.id,
      businessId,
      scheduleId,
      strategy: selectedStrategy,
      shiftsCreated: createdShifts.length,
    });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to generate AI schedule', {
      operation: 'generate_ai_schedule',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate schedule',
      error: err.message
    });
  }
}

/**
 * POST /api/scheduling/ai/suggest-assignments
 * Get AI suggestions for shift assignments
 */
export async function suggestShiftAssignments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    const { businessId, scheduleId, shiftId } = req.body;

    if (!user) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ success: false, error: 'Business ID is required' });
      return;
    }

    // Get shift to suggest for
    const shift = await prisma.scheduleShift.findUnique({
      where: { id: shiftId },
      include: {
        schedule: true,
        employeePosition: {
          include: {
            user: true,
            position: true
          }
        }
      }
    });

    if (!shift) {
      res.status(404).json({ success: false, error: 'Shift not found' });
      return;
    }

    if (scheduleId && typeof scheduleId === 'string' && shift.scheduleId !== scheduleId) {
      res.status(400).json({ success: false, error: 'Shift does not belong to the specified schedule' });
      return;
    }

    // Get business configuration
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { schedulingStrategy: true }
    });

    const strategy = business?.schedulingStrategy || 'AVAILABILITY_FIRST';

    // Get available employees
    const startDate = new Date(shift.startTime);
    const dayOfWeek = startDate.toLocaleDateString('en-US', { weekday: 'long' });
    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
    const endMinutes = new Date(shift.endTime).getHours() * 60 + new Date(shift.endTime).getMinutes();

    const employeePositions = await prisma.employeePosition.findMany({
      where: { businessId, active: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
        position: {
          select: {
            title: true,
            jobFunction: true,
            stationName: true
          }
        },
        availability: {
          where: {
            dayOfWeek,
            availabilityType: 'AVAILABLE',
            effectiveFrom: { lte: startDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: startDate } }
            ]
          }
        }
      }
    });

    // Filter employees who are available
    const availableEmployees = employeePositions.filter(ep => {
      const dayAvail = ep.availability.find((a: { dayOfWeek: string; startTime: string; endTime: string; availabilityType: string }) => a.dayOfWeek === dayOfWeek);
      if (!dayAvail || dayAvail.availabilityType !== 'AVAILABLE') return false;

      // Check time slot availability - convert time strings to minutes
      if (dayAvail.startTime && dayAvail.endTime) {
        const availStartMinutes = parseInt(dayAvail.startTime.split(':')[0]) * 60 + parseInt(dayAvail.startTime.split(':')[1]);
        const availEndMinutes = parseInt(dayAvail.endTime.split(':')[0]) * 60 + parseInt(dayAvail.endTime.split(':')[1]);
        if (startMinutes < availStartMinutes || endMinutes > availEndMinutes) {
          return false;
        }
      }

      // Check role/function match if specified
      if (shift.jobFunction && ep.position.jobFunction !== shift.jobFunction) return false;
      if (shift.stationName && ep.position.stationName !== shift.stationName) return false;

      return true;
    });

    // Sort by strategy
    const suggestions = availableEmployees.map(ep => ({
      employeePositionId: ep.id,
      employee: {
        id: ep.user.id,
        name: ep.user.name,
        position: ep.position.title,
      },
      confidence: 0.8, // Default confidence
      reason: 'Available for this shift',
    }));

    logger.info('Shift assignment suggestions generated', {
      operation: 'suggest_shift_assignments',
      userId: user.id,
      businessId,
      shiftId,
      scheduleId: shift.scheduleId,
      strategy
    });

    res.json({
      success: true,
      suggestions,
      count: suggestions.length,
      strategy
    });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to suggest shift assignments', {
      operation: 'suggest_shift_assignments',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get suggestions',
      error: err.message
    });
  }
}

// ============================================================================
// BUSINESS STATIONS MANAGEMENT
// ============================================================================

/**
 * GET /api/scheduling/admin/stations
 * Get all stations for a business
 */
export async function getBusinessStations(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { businessId } = req.query;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    const stations = await prisma.businessStation.findMany({
      where: {
        businessId: businessId
      },
      orderBy: [
        { priority: 'desc' },
        { name: 'asc' }
      ]
    });

    logger.info('Business stations retrieved', {
      operation: 'list_stations',
      userId: user.id,
      businessId,
      count: stations.length
    });

    res.json({ stations });
  } catch (error: unknown) {
    const err = error as Error;
    const businessIdParam = typeof req.query.businessId === 'string' ? req.query.businessId : undefined;
    
    logger.error('Failed to list stations', {
      operation: 'list_stations',
      userId: req.user?.id,
      businessId: businessIdParam,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });

    res.status(500).json({ 
      error: 'Failed to retrieve stations',
      message: err.message
    });
  }
}

/**
 * POST /api/scheduling/admin/stations
 * Create a new business station
 */
export async function createBusinessStation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { businessId, name, stationType, jobFunction, description, color, isRequired, priority, defaultStartTime, defaultEndTime } = req.body;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Station name is required' });
      return;
    }

    if (!stationType || typeof stationType !== 'string') {
      res.status(400).json({ error: 'Station type is required' });
      return;
    }

    // Check if station name already exists for this business
    const existing = await prisma.businessStation.findUnique({
      where: {
        businessId_name: {
          businessId,
          name: name.trim()
        }
      }
    });

    if (existing) {
      res.status(409).json({ error: 'Station with this name already exists' });
      return;
    }

    const normalizedStartTime =
      typeof defaultStartTime === 'string' && defaultStartTime.trim() !== ''
        ? defaultStartTime.trim()
        : null;
    if (normalizedStartTime && !TIME_FIELD_REGEX.test(normalizedStartTime)) {
      res.status(400).json({ error: 'Invalid default start time. Use HH:mm (24-hour format).' });
      return;
    }

    const normalizedEndTime =
      typeof defaultEndTime === 'string' && defaultEndTime.trim() !== ''
        ? defaultEndTime.trim()
        : null;
    if (normalizedEndTime && !TIME_FIELD_REGEX.test(normalizedEndTime)) {
      res.status(400).json({ error: 'Invalid default end time. Use HH:mm (24-hour format).' });
      return;
    }

    const station = await prisma.businessStation.create({
      data: {
        businessId,
        name: name.trim(),
        stationType: stationType as StationType,
        jobFunction: jobFunction ? (jobFunction as JobFunction) : null,
        description: description || null,
        color: color || null,
        isRequired: isRequired === true,
        priority: priority ? parseInt(String(priority), 10) : null,
        isActive: true,
        defaultStartTime: normalizedStartTime ?? undefined,
        defaultEndTime: normalizedEndTime ?? undefined
      } as Prisma.BusinessStationUncheckedCreateInput
    });

    logger.info('Business station created', {
      operation: 'create_station',
      userId: user.id,
      businessId,
      stationId: station.id
    });

    res.status(201).json({ station });
  } catch (error: unknown) {
    const err = error as Error;
    
    logger.error('Failed to create station', {
      operation: 'create_station',
      userId: req.user?.id,
      businessId: req.body.businessId,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });

    res.status(500).json({ 
      error: 'Failed to create station',
      message: err.message
    });
  }
}

/**
 * GET /api/scheduling/admin/stations/:id
 * Get a specific station by ID
 */
export async function getBusinessStationById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const { businessId } = req.query;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    const station = await prisma.businessStation.findUnique({
      where: { id }
    });

    if (!station) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    if (station.businessId !== businessId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ station });
  } catch (error: unknown) {
    const err = error as Error;
    
    logger.error('Failed to get station', {
      operation: 'get_station',
      userId: req.user?.id,
      stationId: req.params.id,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });

    res.status(500).json({ 
      error: 'Failed to retrieve station',
      message: err.message
    });
  }
}

/**
 * PUT /api/scheduling/admin/stations/:id
 * Update a business station
 */
export async function updateBusinessStation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const { businessId, name, stationType, jobFunction, description, color, isRequired, priority, isActive, defaultStartTime, defaultEndTime } = req.body;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    // Verify station exists and belongs to business
    const existing = await prisma.businessStation.findUnique({
      where: { id }
    });

    if (!existing) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    if (existing.businessId !== businessId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // If name is changing, check for duplicates
    if (name && name !== existing.name) {
      const duplicate = await prisma.businessStation.findUnique({
        where: {
          businessId_name: {
            businessId,
            name: name.trim()
          }
        }
      });

      if (duplicate) {
        res.status(409).json({ error: 'Station with this name already exists' });
        return;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (name !== undefined) updateData.name = name.trim();
    if (stationType !== undefined) updateData.stationType = stationType as StationType;
    if (jobFunction !== undefined) updateData.jobFunction = jobFunction ? (jobFunction as JobFunction) : null;
    if (description !== undefined) updateData.description = description || null;
    if (color !== undefined) updateData.color = color || null;
    if (isRequired !== undefined) updateData.isRequired = isRequired === true;
    if (priority !== undefined) updateData.priority = priority ? parseInt(String(priority), 10) : null;
    if (isActive !== undefined) updateData.isActive = isActive === true;

    if (defaultStartTime !== undefined) {
      if (defaultStartTime === null || (typeof defaultStartTime === 'string' && defaultStartTime.trim() === '')) {
        updateData.defaultStartTime = null;
      } else if (typeof defaultStartTime === 'string' && TIME_FIELD_REGEX.test(defaultStartTime.trim())) {
        updateData.defaultStartTime = defaultStartTime.trim();
      } else {
        res.status(400).json({ error: 'Invalid default start time. Use HH:mm (24-hour format).' });
        return;
      }
    }

    if (defaultEndTime !== undefined) {
      if (defaultEndTime === null || (typeof defaultEndTime === 'string' && defaultEndTime.trim() === '')) {
        updateData.defaultEndTime = null;
      } else if (typeof defaultEndTime === 'string' && TIME_FIELD_REGEX.test(defaultEndTime.trim())) {
        updateData.defaultEndTime = defaultEndTime.trim();
      } else {
        res.status(400).json({ error: 'Invalid default end time. Use HH:mm (24-hour format).' });
        return;
      }
    }

    const station = await prisma.businessStation.update({
      where: { id },
      data: updateData
    });

    logger.info('Business station updated', {
      operation: 'update_station',
      userId: user.id,
      businessId,
      stationId: station.id
    });

    res.json({ station });
  } catch (error: unknown) {
    const err = error as Error;
    
    logger.error('Failed to update station', {
      operation: 'update_station',
      userId: req.user?.id,
      stationId: req.params.id,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });

    res.status(500).json({ 
      error: 'Failed to update station',
      message: err.message
    });
  }
}

/**
 * DELETE /api/scheduling/admin/stations/:id
 * Delete a business station
 */
export async function deleteBusinessStation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const { businessId } = req.query;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    // Verify station exists and belongs to business
    const existing = await prisma.businessStation.findUnique({
      where: { id }
    });

    if (!existing) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    if (existing.businessId !== businessId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if station is being used in any shifts
    const shiftsUsingStation = await prisma.scheduleShift.count({
      where: {
        businessId,
        stationName: existing.name
      }
    });

    if (shiftsUsingStation > 0) {
      res.status(409).json({ 
        error: 'Cannot delete station that is assigned to shifts',
        message: `This station is currently assigned to ${shiftsUsingStation} shift(s). Please remove assignments before deleting.`
      });
      return;
    }

    await prisma.businessStation.delete({
      where: { id }
    });

    logger.info('Business station deleted', {
      operation: 'delete_station',
      userId: user.id,
      businessId,
      stationId: id
    });

    res.json({ success: true, message: 'Station deleted successfully' });
  } catch (error: unknown) {
    const err = error as Error;
    
    logger.error('Failed to delete station', {
      operation: 'delete_station',
      userId: req.user?.id,
      stationId: req.params.id,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });

    res.status(500).json({ 
      error: 'Failed to delete station',
      message: err.message
    });
  }
}

// ============================================================================
// JOB LOCATIONS
// ============================================================================

/**
 * GET /api/scheduling/admin/job-locations
 * Get all job locations for a business
 */
export async function getBusinessJobLocations(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { businessId } = req.query;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    // Verify user has access to business
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: { businessId, userId: user.id }
      }
    });

    if (!member || !member.isActive) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const locations = await prisma.jobLocation.findMany({
      where: {
        businessId,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({ jobLocations: locations });
  } catch (error: unknown) {
    const err = error as Error;
    
    logger.error('Failed to get job locations', {
      operation: 'get_job_locations',
      userId: req.user?.id,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });

    res.status(500).json({ 
      error: 'Failed to fetch job locations',
      message: err.message
    });
  }
}

/**
 * POST /api/scheduling/admin/job-locations
 * Create a new job location
 */
export async function createBusinessJobLocation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { businessId, name, address, description, phone, email, notes } = req.body;

    if (!businessId || typeof businessId !== 'string') {
      res.status(400).json({ error: 'Business ID is required' });
      return;
    }

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Location name is required' });
      return;
    }

    // Verify user has admin access
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: { businessId, userId: user.id }
      }
    });

    if (!member || !member.isActive || member.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Check if location name already exists for this business
    const existing = await prisma.jobLocation.findUnique({
      where: {
        businessId_name: {
          businessId,
          name: name.trim()
        }
      }
    });

    if (existing) {
      res.status(409).json({ error: 'Job location with this name already exists' });
      return;
    }

    const location = await prisma.jobLocation.create({
      data: {
        businessId,
        name: name.trim(),
        address: address || null,
        description: description || null,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        isActive: true
      }
    });

    logger.info('Job location created', {
      operation: 'create_job_location',
      userId: user.id,
      businessId,
      locationId: location.id
    });

    res.status(201).json({ location });
  } catch (error: unknown) {
    const err = error as Error;
    
    logger.error('Failed to create job location', {
      operation: 'create_job_location',
      userId: req.user?.id,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });

    res.status(500).json({ 
      error: 'Failed to create job location',
      message: err.message
    });
  }
}

/**
 * PUT /api/scheduling/admin/job-locations/:id
 * Update a job location
 */
export async function updateBusinessJobLocation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const { name, address, description, phone, email, notes, isActive } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Location ID is required' });
      return;
    }

    // Get existing location
    const existing = await prisma.jobLocation.findUnique({
      where: { id }
    });

    if (!existing) {
      res.status(404).json({ error: 'Job location not found' });
      return;
    }

    // Verify user has admin access to business
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: { businessId: existing.businessId, userId: user.id }
      }
    });

    if (!member || !member.isActive || member.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.jobLocation.findUnique({
        where: {
          businessId_name: {
            businessId: existing.businessId,
            name: name.trim()
          }
        }
      });

      if (duplicate) {
        res.status(409).json({ error: 'Job location with this name already exists' });
        return;
      }
    }

    const location = await prisma.jobLocation.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(address !== undefined && { address: address || null }),
        ...(description !== undefined && { description: description || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(isActive !== undefined && { isActive })
      }
    });

    logger.info('Job location updated', {
      operation: 'update_job_location',
      userId: user.id,
      businessId: existing.businessId,
      locationId: id
    });

    res.json({ location });
  } catch (error: unknown) {
    const err = error as Error;
    
    logger.error('Failed to update job location', {
      operation: 'update_job_location',
      userId: req.user?.id,
      locationId: req.params.id,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });

    res.status(500).json({ 
      error: 'Failed to update job location',
      message: err.message
    });
  }
}

/**
 * DELETE /api/scheduling/admin/job-locations/:id
 * Delete a job location
 */
export async function deleteBusinessJobLocation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Location ID is required' });
      return;
    }

    // Get existing location
    const existing = await prisma.jobLocation.findUnique({
      where: { id }
    });

    if (!existing) {
      res.status(404).json({ error: 'Job location not found' });
      return;
    }

    // Verify user has admin access
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: { businessId: existing.businessId, userId: user.id }
      }
    });

    if (!member || !member.isActive || member.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Check if location is used in schedules or shifts
    const schedulesUsingLocation = await prisma.schedule.count({
      where: { locationId: id }
    });

    const shiftsUsingLocation = await prisma.scheduleShift.count({
      where: { locationId: id }
    });

    if (schedulesUsingLocation > 0 || shiftsUsingLocation > 0) {
      res.status(409).json({ 
        error: 'Cannot delete job location that is assigned to schedules or shifts',
        message: `This location is currently assigned to ${schedulesUsingLocation} schedule(s) and ${shiftsUsingLocation} shift(s). Please remove assignments before deleting.`
      });
      return;
    }

    await prisma.jobLocation.delete({
      where: { id }
    });

    logger.info('Job location deleted', {
      operation: 'delete_job_location',
      userId: user.id,
      businessId: existing.businessId,
      locationId: id
    });

    res.json({ success: true, message: 'Job location deleted successfully' });
  } catch (error: unknown) {
    const err = error as Error;
    
    logger.error('Failed to delete job location', {
      operation: 'delete_job_location',
      userId: req.user?.id,
      locationId: req.params.id,
      error: { 
        message: err.message, 
        stack: err.stack
      }
    });

    res.status(500).json({ 
      error: 'Failed to delete job location',
      message: err.message
    });
  }
}

