/**
 * HR MODULE CONTROLLERS
 * 
 * FRAMEWORK IMPLEMENTATION - Returns stub data
 * Actual feature logic will be implemented later
 */

import { Request, Response } from 'express';
import {
  Prisma,
  EmployeeType as PrismaEmployeeType,
  AttendanceExceptionStatus,
  AttendanceMethod,
  AttendanceRecordStatus,
  EmploymentStatus,
  OnboardingTaskOwnerType,
  OnboardingTaskStatus,
  OnboardingTaskType,
  TimeOffStatus,
  TimeOffType
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { syncTimeOffRequestCalendar } from '../services/hrScheduleService';
import {
  getAttendanceOverview as getAttendanceOverviewService,
  listAttendancePolicies,
  listAttendanceExceptionsForManager,
  listEmployeeAttendanceRecords,
  recordPunchIn,
  recordPunchOut,
  resolveAttendanceException,
  ResolveAttendanceExceptionInput,
  upsertAttendancePolicy
} from '../services/hrAttendanceService';
import {
  archiveOnboardingTemplate,
  completeOnboardingTask as completeOnboardingTaskService,
  findEmployeeHrProfileByUser,
  listEmployeeJourneysForUser,
  listEmployeeJourneys as listEmployeeJourneysService,
  listOnboardingTemplates as listOnboardingTemplatesService,
  listOnboardingTasksForEmployeePositions,
  startOnboardingJourney as startOnboardingJourneyService,
  upsertOnboardingTemplate as upsertOnboardingTemplateService
} from '../services/hrOnboardingService';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const employeeTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY', 'SEASONAL']);

const jsonFieldInputSchema = z.union([z.record(z.unknown()), z.string(), z.null()]).optional();

const employeeUpdateSchema = z.object({
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Hire date must be in YYYY-MM-DD format').optional(),
  employeeType: employeeTypeEnum.optional(),
  workLocation: z.string().max(255, 'Work location must be 255 characters or less').optional(),
  emergencyContact: jsonFieldInputSchema,
  personalInfo: jsonFieldInputSchema
}).refine((data) => {
  // At least one field must be provided
  return Object.keys(data).some((key) => data[key as keyof typeof data] !== undefined);
}, { message: 'At least one field must be provided for update' });

const employeeCreateSchema = z.object({
  employeePositionId: z.string().uuid('Invalid employee position ID'),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Hire date must be in YYYY-MM-DD format').optional(),
  employeeType: employeeTypeEnum.optional(),
  workLocation: z.string().max(255, 'Work location must be 255 characters or less').optional(),
  emergencyContact: jsonFieldInputSchema,
  personalInfo: jsonFieldInputSchema
});

const employeeTerminationSchema = z.object({
  date: z.string().datetime({ offset: true }).optional(),
  reason: z.string().max(255, 'Reason must be 255 characters or less').optional(),
  notes: jsonFieldInputSchema
});

const attendancePolicySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  timezone: z.string().max(64).optional().nullable(),
  roundingIncrementMinutes: z.number().int().positive().max(240).optional().nullable(),
  gracePeriodMinutes: z.number().int().nonnegative().max(120).optional().nullable(),
  autoClockOutAfterMinutes: z.number().int().positive().max(1440).optional().nullable(),
  requireGeolocation: z.boolean().optional(),
  geofenceRadiusMeters: z.number().int().positive().max(50000).optional().nullable(),
  workingDays: z.array(z.string().min(2).max(16)).optional(),
  metadata: jsonFieldInputSchema,
  isDefault: z.boolean().optional(),
  effectiveFrom: z.string().datetime({ offset: true }).optional().nullable(),
  effectiveTo: z.string().datetime({ offset: true }).optional().nullable(),
  active: z.boolean().optional()
});

const attendancePunchSchema = z.object({
  employeePositionId: z.string().uuid().optional(),
  method: z.nativeEnum(AttendanceMethod).default(AttendanceMethod.WEB),
  source: z.string().max(120).optional(),
  location: jsonFieldInputSchema,
  metadata: jsonFieldInputSchema,
  recordId: z.string().uuid().optional()
});

const attendanceExceptionStatusEnum = z.nativeEnum(AttendanceExceptionStatus);

const attendanceExceptionFilterSchema = z.object({
  statuses: z
    .union([
      attendanceExceptionStatusEnum,
      z.array(attendanceExceptionStatusEnum)
    ])
    .optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

const attendanceExceptionResolutionSchema = z.object({
  status: attendanceExceptionStatusEnum,
  resolutionNote: z.string().max(1000).optional().nullable(),
  managerNote: z.string().max(1000).optional().nullable(),
  adjustments: z
    .object({
      clockInTime: z.string().datetime({ offset: true }).nullable().optional(),
      clockOutTime: z.string().datetime({ offset: true }).nullable().optional(),
      status: z.nativeEnum(AttendanceRecordStatus).optional(),
      varianceMinutes: z.number().int().min(-1440).max(1440).optional()
    })
    .optional()
});

const onboardingTaskTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  orderIndex: z.number().int().min(0).optional().nullable(),
  taskType: z.nativeEnum(OnboardingTaskType).optional(),
  ownerType: z.nativeEnum(OnboardingTaskOwnerType).optional(),
  ownerReference: z.string().max(255).optional().nullable(),
  dueOffsetDays: z.number().int().min(-365).max(365).optional().nullable(),
  requiresApproval: z.boolean().optional(),
  requiresDocument: z.boolean().optional(),
  metadata: jsonFieldInputSchema,
  isActive: z.boolean().optional()
});

const onboardingTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  ownerUserId: z.string().uuid().optional().nullable(),
  applicabilityRules: jsonFieldInputSchema,
  automationSettings: jsonFieldInputSchema,
  tasks: z.array(onboardingTaskTemplateSchema).optional()
});

const onboardingJourneyStartSchema = z.object({
  employeeHrProfileId: z.string().uuid(),
  onboardingTemplateId: z.string().uuid().optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  metadata: jsonFieldInputSchema
});

const onboardingTaskCompletionSchema = z.object({
  status: z.nativeEnum(OnboardingTaskStatus).optional(),
  notes: z.string().max(2000).optional().nullable(),
  metadata: jsonFieldInputSchema,
  approved: z.boolean().optional(),
  approvedByUserId: z.string().uuid().optional()
});

const resolveBusinessId = (req: Request): string | null => {
  const queryId = req.query.businessId;
  if (typeof queryId === 'string' && queryId.length > 0) {
    return queryId;
  }
  const bodyId = (req.body as Record<string, unknown>)?.businessId;
  if (typeof bodyId === 'string' && bodyId.length > 0) {
    return bodyId;
  }
  return null;
};

type FieldValidationErrorDetails = {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
};

class FieldValidationError extends Error {
  readonly field: string;
  readonly details?: FieldValidationErrorDetails;

  constructor(field: string, message: string, details?: FieldValidationErrorDetails) {
    super(message);
    this.name = 'FieldValidationError';
    this.field = field;
    this.details = details;
  }
}

const isJsonRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseJsonField = (value: unknown, fieldName: string): Prisma.InputJsonValue | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!isJsonRecord(parsed)) {
        throw new FieldValidationError(fieldName, 'Must be a JSON object');
      }
      return parsed as Prisma.InputJsonValue;
    } catch (error) {
      if (error instanceof FieldValidationError) {
        throw error;
      }
      throw new FieldValidationError(fieldName, 'Must be valid JSON');
    }
  }

  if (isJsonRecord(value)) {
    return value as Prisma.InputJsonValue;
  }

  throw new FieldValidationError(fieldName, 'Must be a JSON object');
};

type AuditChangeMap = Record<string, { before: unknown; after: unknown }>;

const toAuditValue = (input: unknown): unknown => {
  if (input === undefined) {
    return null;
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  return input;
};

const recordAuditChange = (changes: AuditChangeMap, field: string, previous: unknown, next: unknown) => {
  const beforeValue = toAuditValue(previous);
  const afterValue = toAuditValue(next);
  if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
    changes[field] = { before: beforeValue, after: afterValue };
  }
};

const normalizeWorkingDays = (days?: string[]): string[] => {
  if (!days || days.length === 0) {
    return [];
  }

  const unique = new Set<string>();
  days.forEach((day) => {
    const normalized = day.trim().toUpperCase();
    if (normalized.length > 0) {
      unique.add(normalized);
    }
  });
  return Array.from(unique);
};

const normalizeEmployeeTypeValue = (
  value?: string | null
): PrismaEmployeeType | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const validTypes = Object.values(PrismaEmployeeType) as PrismaEmployeeType[];

  if (validTypes.includes(normalized as PrismaEmployeeType)) {
    return normalized as PrismaEmployeeType;
  }

  return undefined;
};

const findActiveEmployeePositionId = async (businessId: string, userId: string): Promise<string | null> => {
  const position = await prisma.employeePosition.findFirst({
    where: { businessId, userId, active: true },
    select: { id: true }
  });
  return position?.id ?? null;
};

interface ManagerContext {
  managerPositionId: string | null;
  directReportPositionIds: string[];
  directReportEmployeePositionIds: string[];
}

const resolveManagerContext = async (
  businessId: string,
  managerUserId: string
): Promise<ManagerContext> => {
  const managerPosition = await prisma.employeePosition.findFirst({
    where: {
      businessId,
      userId: managerUserId,
      active: true
    },
    select: {
      id: true,
      positionId: true
    }
  });

  if (!managerPosition?.positionId) {
    return {
      managerPositionId: null,
      directReportPositionIds: [],
      directReportEmployeePositionIds: []
    };
  }

  const directReportPositions = await prisma.position.findMany({
    where: {
      businessId,
      reportsToId: managerPosition.positionId
    },
    select: {
      id: true
    }
  });

  const directReportPositionIds = directReportPositions.map((p) => p.id);

  if (directReportPositionIds.length === 0) {
    return {
      managerPositionId: managerPosition.id,
      directReportPositionIds,
      directReportEmployeePositionIds: []
    };
  }

  const employeePositions = await prisma.employeePosition.findMany({
    where: {
      businessId,
      active: true,
      positionId: { in: directReportPositionIds }
    },
    select: { id: true }
  });

  return {
    managerPositionId: managerPosition.id,
    directReportPositionIds,
    directReportEmployeePositionIds: employeePositions.map((ep) => ep.id)
  };
};

type EmployeeAuditInput = {
  userId: string;
  action: 'HR_EMPLOYEE_CREATED' | 'HR_EMPLOYEE_UPDATED' | 'HR_EMPLOYEE_TERMINATED';
  resourceId: string;
  businessId: string;
  employeeUserId: string;
  employeeName: string | null;
  changes: AuditChangeMap;
  metadata?: Record<string, unknown>;
  force?: boolean;
};

const logEmployeeAudit = async ({ force = false, changes, ...payload }: EmployeeAuditInput) => {
  if (!force && Object.keys(changes).length === 0) {
    return;
  }

  const details: Record<string, unknown> = {
    businessId: payload.businessId,
    employeeUserId: payload.employeeUserId,
    employeeName: payload.employeeName,
    changes
  };

  if (payload.metadata) {
    details.metadata = payload.metadata;
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: payload.action,
        resourceType: 'HR_EMPLOYEE',
        resourceId: payload.resourceId,
        details: JSON.stringify(details)
      }
    });
  } catch (error) {
    console.error('Error logging audit entry:', error);
  }
};

// ============================================================================
// ADMIN CONTROLLERS (Business Admin Dashboard)
// ============================================================================

/**
 * Get all employees (Admin view)
 * Framework: Returns basic employee list
 */
export const getAdminEmployees = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }
    
    const status = (req.query.status as string) || 'ACTIVE';
    const q = (req.query.q as string) || '';
    const departmentId = req.query.departmentId as string | undefined;
    const positionId = req.query.positionId as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const rawSortOrder = (req.query.sortOrder as string) || 'desc';
    const sortOrder: Prisma.SortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc';
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize || 20));
    const skip = (page - 1) * pageSize;
    
    // Build orderBy clauses for active and terminated datasets - Prisma supports nested relations for sorting
    let activeOrderBy: Prisma.EmployeePositionOrderByWithRelationInput = { createdAt: sortOrder };
    let terminatedOrderBy: Prisma.EmployeeHRProfileOrderByWithRelationInput = { updatedAt: sortOrder };

    switch (sortBy) {
      case 'name':
        activeOrderBy = { user: { name: sortOrder } };
        terminatedOrderBy = { employeePosition: { user: { name: sortOrder } } };
        break;
      case 'email':
        activeOrderBy = { user: { email: sortOrder } };
        terminatedOrderBy = { employeePosition: { user: { email: sortOrder } } };
        break;
      case 'title':
        activeOrderBy = { position: { title: sortOrder } };
        terminatedOrderBy = { employeePosition: { position: { title: sortOrder } } };
        break;
      case 'department':
        activeOrderBy = { position: { department: { name: sortOrder } } };
        terminatedOrderBy = { employeePosition: { position: { department: { name: sortOrder } } } };
        break;
      case 'hireDate':
        activeOrderBy = { hrProfile: { hireDate: sortOrder } };
        terminatedOrderBy = { hireDate: sortOrder };
        break;
      default:
        activeOrderBy = { [sortBy]: sortOrder } as Prisma.EmployeePositionOrderByWithRelationInput;
        terminatedOrderBy = { [sortBy]: sortOrder } as Prisma.EmployeeHRProfileOrderByWithRelationInput;
    }
    
    if (status === 'TERMINATED') {
      // Build where clause for terminated employees
      const where: Record<string, unknown> = {
        businessId,
        employmentStatus: 'TERMINATED'
      };

      const employeePositionFilter: Record<string, unknown> = { businessId };

      if (departmentId) {
        employeePositionFilter.position = {
          ...((employeePositionFilter.position as Record<string, unknown>) || {}),
          departmentId
        };
      }
      if (positionId) {
        employeePositionFilter.positionId = positionId;
      }
      if (q) {
        employeePositionFilter.OR = [
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { position: { title: { contains: q, mode: 'insensitive' } } }
        ];
      }

      if (Object.keys(employeePositionFilter).length > 1 || Object.keys(employeePositionFilter).some((key) => key !== 'businessId')) {
        where.employeePosition = employeePositionFilter;
      }

      const [hrProfiles, totalCount] = await Promise.all([
        prisma.employeeHRProfile.findMany({
          where,
          include: {
            employeePosition: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true }
                },
                position: { include: { department: true, tier: true } }
              }
            }
          },
          orderBy: terminatedOrderBy,
          skip,
          take: pageSize
        }),
        prisma.employeeHRProfile.count({ where })
      ]);

      return res.json({ 
        employees: hrProfiles,
        count: totalCount,
        page,
        pageSize,
        tier: req.hrTier,
        features: req.hrFeatures
      });
    }

    // ACTIVE employees
    const where: Record<string, unknown> = {
      businessId,
      active: true
    };
    
    // Add search query
    if (q) {
      where.OR = [
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { position: { title: { contains: q, mode: 'insensitive' } } }
      ];
    }
    
    // Add department filter
    if (departmentId) {
      where.position = {
        ...((where.position as Record<string, unknown>) || {}),
        departmentId
      };
    }
    
    // Add position/title filter
    if (positionId) {
      where.positionId = positionId;
    }

    const [employees, totalCount] = await Promise.all([
      prisma.employeePosition.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          position: { include: { department: true, tier: true } },
          hrProfile: true
        },
        orderBy: activeOrderBy,
        skip,
        take: pageSize
      }),
      prisma.employeePosition.count({ where })
    ]);

    return res.json({ 
      employees,
      count: totalCount,
      page,
      pageSize,
      tier: req.hrTier,
      features: req.hrFeatures
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch employees';
    res.status(500).json({ error: errorMessage });
  }
};

/**
 * Get filter options (departments and positions) for employee directory
 */
export const getEmployeeFilterOptions = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const [departments, positions] = await Promise.all([
      prisma.department.findMany({
        where: { businessId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      }),
      prisma.position.findMany({
        where: { 
          businessId,
          employeePositions: {
            some: {
              active: true,
              businessId
            }
          }
        },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
        distinct: ['title']
      })
    ]);

    return res.json({
      departments,
      positions
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch filter options';
    res.status(500).json({ error: errorMessage });
  }
};

/**
 * Get single employee details
 * Framework: Returns employee with HR profile
 */
export const getAdminEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.query.businessId as string;
    
    const employee = await prisma.employeePosition.findFirst({
      where: {
        id,
        businessId,
        active: true
      },
      include: {
        user: true,
        position: {
          include: {
            department: true,
            tier: true
          }
        }
      ,hrProfile: true
      }
    });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
};

/**
 * Create new employee
 * Framework: Stub - returns success message
 */
export const createEmployee = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    const userId = (req.user as { id: string })?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate input
    const validationResult = employeeCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.errors 
      });
    }

    const { employeePositionId, hireDate, employeeType, workLocation, emergencyContact, personalInfo } = validationResult.data;

    let emergencyContactJson: Prisma.InputJsonValue | null | undefined;
    let personalInfoJson: Prisma.InputJsonValue | null | undefined;

    try {
      emergencyContactJson = parseJsonField(emergencyContact, 'emergencyContact');
      personalInfoJson = parseJsonField(personalInfo, 'personalInfo');
    } catch (fieldError) {
      if (fieldError instanceof FieldValidationError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: [{ path: [fieldError.field], message: fieldError.message }]
        });
      }
      throw fieldError;
    }

    const hireDateValue = hireDate ? new Date(hireDate) : undefined;
    const employeeTypeValue = employeeType ? (employeeType as PrismaEmployeeType) : undefined;

    const position = await prisma.employeePosition.findFirst({
      where: { id: employeePositionId, businessId },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    if (!position) {
      return res.status(400).json({ error: 'Invalid employeePositionId for this business' });
    }

    // Get existing HR profile if any (for audit comparison)
    const existingProfile = await prisma.employeeHRProfile.findUnique({
      where: { employeePositionId }
    });

    // Create HR profile if not exists
    const hrProfile = await prisma.employeeHRProfile.upsert({
      where: { employeePositionId },
      create: {
        employeePositionId,
        businessId,
        employmentStatus: 'ACTIVE',
        ...(hireDateValue ? { hireDate: hireDateValue } : {}),
        ...(employeeTypeValue ? { employeeType: employeeTypeValue } : {}),
        ...(workLocation !== undefined ? { workLocation } : {}),
        ...(emergencyContactJson !== undefined ? {
          emergencyContact: emergencyContactJson === null ? Prisma.JsonNull : emergencyContactJson
        } : {}),
        ...(personalInfoJson !== undefined ? {
          personalInfo: personalInfoJson === null ? Prisma.JsonNull : personalInfoJson
        } : {})
      },
      update: {
        employmentStatus: 'ACTIVE',
        ...(hireDate !== undefined ? { hireDate: hireDateValue } : {}),
        ...(employeeType !== undefined ? { employeeType: employeeTypeValue } : {}),
        ...(workLocation !== undefined ? { workLocation } : {}),
        ...(emergencyContact !== undefined ? { emergencyContact: emergencyContactJson ?? Prisma.JsonNull } : {}),
        ...(personalInfo !== undefined ? { personalInfo: personalInfoJson ?? Prisma.JsonNull } : {})
      }
    });

    // Ensure position is active
    await prisma.employeePosition.update({
      where: { id: employeePositionId },
      data: {
        active: true,
        startDate: hireDate ? new Date(hireDate) : new Date(),
        endDate: null
      }
    });

    const auditChanges: AuditChangeMap = {};
    recordAuditChange(auditChanges, 'hireDate', existingProfile?.hireDate, hrProfile.hireDate);
    recordAuditChange(auditChanges, 'employeeType', existingProfile?.employeeType, hrProfile.employeeType);
    recordAuditChange(auditChanges, 'workLocation', existingProfile?.workLocation, hrProfile.workLocation);
    recordAuditChange(auditChanges, 'emergencyContact', existingProfile?.emergencyContact, hrProfile.emergencyContact);
    recordAuditChange(auditChanges, 'personalInfo', existingProfile?.personalInfo, hrProfile.personalInfo);

    await logEmployeeAudit({
      userId,
      action: existingProfile ? 'HR_EMPLOYEE_UPDATED' : 'HR_EMPLOYEE_CREATED',
      resourceId: employeePositionId,
      businessId,
      employeeUserId: position.userId,
      employeeName: position.user?.name || position.user?.email || null,
      changes: auditChanges,
      force: true
    });

    return res.json({ message: 'Employee profile created', hrProfile });
  } catch (error) {
    console.error('Error creating employee:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create employee';
    res.status(500).json({ error: errorMessage });
  }
};

/**
 * Update employee
 * Framework: Stub - returns success message
 */
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    const { id } = req.params; // employeePositionId
    const userId = (req.user as { id: string })?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate input
    const validationResult = employeeUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.errors 
      });
    }

    const { hireDate, employeeType, workLocation, emergencyContact, personalInfo } = validationResult.data;

    let emergencyContactJson: Prisma.InputJsonValue | null | undefined;
    let personalInfoJson: Prisma.InputJsonValue | null | undefined;

    try {
      emergencyContactJson = parseJsonField(emergencyContact, 'emergencyContact');
      personalInfoJson = parseJsonField(personalInfo, 'personalInfo');
    } catch (fieldError) {
      if (fieldError instanceof FieldValidationError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: [{ path: [fieldError.field], message: fieldError.message }]
        });
      }
      throw fieldError;
    }

    const position = await prisma.employeePosition.findFirst({ 
      where: { id, businessId },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    if (!position) {
      return res.status(404).json({ error: 'Employee position not found' });
    }

    // Get existing profile for audit comparison
    const existingProfile = await prisma.employeeHRProfile.findUnique({
      where: { employeePositionId: id }
    });

    if (!existingProfile) {
      return res.status(404).json({ error: 'HR profile not found for this employee' });
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    if (hireDate !== undefined) updateData.hireDate = new Date(hireDate);
    if (employeeType !== undefined) updateData.employeeType = employeeType as PrismaEmployeeType;
    if (workLocation !== undefined) updateData.workLocation = workLocation;
    if (emergencyContact !== undefined) {
      updateData.emergencyContact = emergencyContactJson ?? Prisma.JsonNull;
    }
    if (personalInfo !== undefined) {
      updateData.personalInfo = personalInfoJson ?? Prisma.JsonNull;
    }

    const updated = await prisma.employeeHRProfile.update({
      where: { employeePositionId: id },
      data: updateData
    });

    // Track field-level changes for audit
    const changes: AuditChangeMap = {};
    if (hireDate !== undefined) {
      recordAuditChange(changes, 'hireDate', existingProfile.hireDate, updated.hireDate);
    }
    if (employeeType !== undefined) {
      recordAuditChange(changes, 'employeeType', existingProfile.employeeType, updated.employeeType);
    }
    if (workLocation !== undefined) {
      recordAuditChange(changes, 'workLocation', existingProfile.workLocation, updated.workLocation);
    }
    if (emergencyContact !== undefined) {
      recordAuditChange(changes, 'emergencyContact', existingProfile.emergencyContact, updated.emergencyContact);
    }
    if (personalInfo !== undefined) {
      recordAuditChange(changes, 'personalInfo', existingProfile.personalInfo, updated.personalInfo);
    }

    await logEmployeeAudit({
      userId,
      action: 'HR_EMPLOYEE_UPDATED',
      resourceId: id,
      businessId,
      employeeUserId: position.userId,
      employeeName: position.user?.name || position.user?.email || null,
      changes
    });

    return res.json({ message: 'Employee profile updated', hrProfile: updated });
  } catch (error) {
    console.error('Error updating employee:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update employee';
    res.status(500).json({ error: errorMessage });
  }
};

/**
 * Delete employee (soft delete)
 * Framework: Stub - returns success message
 */
export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    const { id } = req.params; // employeePositionId
    const position = await prisma.employeePosition.findFirst({ where: { id, businessId } });
    if (!position) {
      return res.status(404).json({ error: 'Employee position not found' });
    }

    // Soft delete HR profile (retain data for audit)
    await prisma.employeeHRProfile.update({
      where: { employeePositionId: id },
      data: {
        deletedAt: new Date(),
        deletedBy: req.user?.id || null,
        deletedReason: 'admin_deleted'
      }
    });

    return res.json({ message: 'Employee HR profile soft-deleted' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};

// ============================================================================
// ONBOARDING (Phase 1-2)
// ============================================================================

export const getOnboardingTemplates = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const templates = await listOnboardingTemplatesService(businessId);
    return res.json({ templates });
  } catch (error) {
    console.error('Error fetching onboarding templates:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch onboarding templates';
    return res.status(500).json({ error: message });
  }
};

export const createOnboardingTemplate = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const payload = parseOnboardingTemplatePayload(req.body);
    const template = await upsertOnboardingTemplateService({
      ...payload,
      businessId
    });

    return res.status(201).json({ template });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({
        error: error.message,
        field: error.field,
        details: error.details
      });
    }

    console.error('Error creating onboarding template:', error);
    const message = error instanceof Error ? error.message : 'Failed to create onboarding template';
    return res.status(500).json({ error: message });
  }
};

export const updateOnboardingTemplate = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const { templateId } = req.params;
    const payload = parseOnboardingTemplatePayload(req.body, templateId);
    const template = await upsertOnboardingTemplateService({
      ...payload,
      businessId
    });

    return res.json({ template });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({
        error: error.message,
        field: error.field,
        details: error.details
      });
    }

    console.error('Error updating onboarding template:', error);
    const message = error instanceof Error ? error.message : 'Failed to update onboarding template';
    return res.status(500).json({ error: message });
  }
};

export const deleteOnboardingTemplate = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const { templateId } = req.params;
    await archiveOnboardingTemplate(businessId, templateId, req.user?.id ?? null);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error archiving onboarding template:', error);
    const message = error instanceof Error ? error.message : 'Failed to archive onboarding template';
    return res.status(500).json({ error: message });
  }
};

export const startOnboardingJourney = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const payload = parseOnboardingJourneyStart(req.body);
    const journey = await startOnboardingJourneyService({
      ...payload,
      businessId,
      initiatedByUserId: req.user?.id ?? null
    });

    return res.status(201).json({ journey });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({
        error: error.message,
        field: error.field,
        details: error.details
      });
    }

    console.error('Error starting onboarding journey:', error);
    const message = error instanceof Error ? error.message : 'Failed to start onboarding journey';
    return res.status(500).json({ error: message });
  }
};

export const getOnboardingJourneys = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const employeeHrProfileId = req.query.employeeHrProfileId as string | undefined;
    if (!employeeHrProfileId) {
      return res.status(400).json({ error: 'employeeHrProfileId is required' });
    }

    const journeys = await listEmployeeJourneysService(businessId, employeeHrProfileId);
    return res.json({ journeys });
  } catch (error) {
    console.error('Error fetching onboarding journeys:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch onboarding journeys';
    return res.status(500).json({ error: message });
  }
};

export const completeOnboardingTask = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const { taskId } = req.params;
    const completedByUserId = req.user?.id;
    if (!completedByUserId) {
      return res.status(401).json({ error: 'User context required to complete task' });
    }

    const payload = parseOnboardingTaskCompletion(req.body);

    const completedTask = await completeOnboardingTaskService({
      businessId,
      taskId,
      completedByUserId,
      status: payload.status,
      notes: payload.notes,
      metadata: payload.metadata,
      approved: payload.approved,
      approvedByUserId: payload.approvedByUserId ?? undefined
    });

    return res.json({ task: completedTask });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({
        error: error.message,
        field: error.field,
        details: error.details
      });
    }

    console.error('Error completing onboarding task:', error);
    const message = error instanceof Error ? error.message : 'Failed to complete onboarding task';
    return res.status(500).json({ error: message });
  }
};

// ============================================================================
// ONBOARDING - EMPLOYEE & MANAGER ROUTES
// ============================================================================

export const getMyOnboardingJourneys = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { profile, journeys } = await listEmployeeJourneysForUser(businessId, userId);
    return res.json({ profile, journeys });
  } catch (error) {
    console.error('Error fetching self onboarding journeys:', error);
    const message = error instanceof Error ? error.message : 'Failed to load onboarding journeys';
    return res.status(500).json({ error: message });
  }
};

export const completeMyOnboardingTask = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { taskId } = req.params;
    const profile = await findEmployeeHrProfileByUser(businessId, userId);
    if (!profile) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const task = await prisma.employeeOnboardingTask.findFirst({
      where: {
        id: taskId,
        businessId,
        onboardingJourney: {
          employeeHrProfileId: profile.id
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Onboarding task not found' });
    }

    const payload = parseOnboardingTaskCompletion(req.body);

    const completedTask = await completeOnboardingTaskService({
      businessId,
      taskId,
      completedByUserId: userId,
      status: payload.status ?? OnboardingTaskStatus.COMPLETED,
      notes: payload.notes,
      metadata: payload.metadata,
      approved: payload.approved,
      approvedByUserId: payload.approvedByUserId ?? undefined
    });

    return res.json({ task: completedTask });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({
        error: error.message,
        field: error.field,
        details: error.details
      });
    }

    console.error('Error completing self onboarding task:', error);
    const message = error instanceof Error ? error.message : 'Failed to complete onboarding task';
    return res.status(500).json({ error: message });
  }
};

export const getTeamOnboardingTasks = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const managerContext = await resolveManagerContext(businessId, userId);
    if (
      !managerContext.managerPositionId ||
      managerContext.directReportEmployeePositionIds.length === 0
    ) {
      return res.json({ tasks: [] });
    }

    const tasks = await listOnboardingTasksForEmployeePositions(
      businessId,
      managerContext.directReportEmployeePositionIds
    );

    return res.json({ tasks });
  } catch (error) {
    console.error('Error fetching team onboarding tasks:', error);
    const message = error instanceof Error ? error.message : 'Failed to load onboarding tasks';
    return res.status(500).json({ error: message });
  }
};

export const completeTeamOnboardingTask = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { taskId } = req.params;
    const managerContext = await resolveManagerContext(businessId, userId);
    if (
      !managerContext.managerPositionId ||
      managerContext.directReportEmployeePositionIds.length === 0
    ) {
      return res.status(403).json({ error: 'No onboarding tasks available for approval' });
    }

    const task = await prisma.employeeOnboardingTask.findFirst({
      where: { id: taskId, businessId },
      include: {
        onboardingJourney: {
          include: {
            employeeHrProfile: {
              select: {
                employeePositionId: true
              }
            }
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Onboarding task not found' });
    }

    if (
      !task.onboardingJourney.employeeHrProfile ||
      !managerContext.directReportEmployeePositionIds.includes(
        task.onboardingJourney.employeeHrProfile.employeePositionId
      )
    ) {
      return res.status(403).json({ error: 'Not authorized to update this onboarding task' });
    }

    const payload = parseOnboardingTaskCompletion(req.body);

    const completedTask = await completeOnboardingTaskService({
      businessId,
      taskId,
      completedByUserId: userId,
      status: payload.status ?? OnboardingTaskStatus.COMPLETED,
      notes: payload.notes,
      metadata: payload.metadata,
      approved: payload.approved ?? true,
      approvedByUserId: payload.approvedByUserId ?? userId
    });

    return res.json({ task: completedTask });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({
        error: error.message,
        field: error.field,
        details: error.details
      });
    }

    console.error('Error completing team onboarding task:', error);
    const message = error instanceof Error ? error.message : 'Failed to complete onboarding task';
    return res.status(500).json({ error: message });
  }
};

// ============================================================================
// ATTENDANCE (Phase 3)
// ============================================================================

/**
 * Get high-level attendance overview for admin dashboard.
 */
export const getAttendanceOverview = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const overview = await getAttendanceOverviewService(businessId);
    return res.json({ overview });
  } catch (error) {
    console.error('Error fetching attendance overview:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch attendance overview';
    return res.status(500).json({ error: message });
  }
};

/**
 * List attendance policies for a business.
 */
export const getAttendancePolicies = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const policies = await listAttendancePolicies(businessId);
    return res.json({ policies });
  } catch (error) {
    console.error('Error listing attendance policies:', error);
    const message = error instanceof Error ? error.message : 'Failed to list attendance policies';
    return res.status(500).json({ error: message });
  }
};

const parseAttendancePolicyBody = (body: unknown, id?: string) => {
  const result = attendancePolicySchema.safeParse(body);
  if (!result.success) {
    const issues = result.error.flatten();
    const details = {
      fieldErrors: issues.fieldErrors,
      formErrors: issues.formErrors
    };
    throw new FieldValidationError('attendancePolicy', 'Invalid attendance policy payload', details);
  }

  const payload = result.data;
  const metadata = parseJsonField(payload.metadata, 'metadata');

  return {
    id,
    name: payload.name,
    description: payload.description ?? null,
    timezone: payload.timezone ?? null,
    roundingIncrementMinutes: payload.roundingIncrementMinutes ?? null,
    gracePeriodMinutes: payload.gracePeriodMinutes ?? null,
    autoClockOutAfterMinutes: payload.autoClockOutAfterMinutes ?? null,
    requireGeolocation: payload.requireGeolocation ?? false,
    geofenceRadiusMeters: payload.geofenceRadiusMeters ?? null,
    workingDays: normalizeWorkingDays(payload.workingDays),
    metadata,
    isDefault: payload.isDefault ?? false,
    effectiveFrom: payload.effectiveFrom ? new Date(payload.effectiveFrom) : null,
    effectiveTo: payload.effectiveTo ? new Date(payload.effectiveTo) : null,
    active: payload.active ?? true
  };
};

const parseOnboardingTemplatePayload = (
  body: unknown,
  templateId?: string
) => {
  const result = onboardingTemplateSchema.safeParse(body);
  if (!result.success) {
    const issues = result.error.flatten();
    const details = {
      fieldErrors: issues.fieldErrors,
      formErrors: issues.formErrors
    };
    throw new FieldValidationError('onboardingTemplate', 'Invalid onboarding template payload', details);
  }

  const payload = result.data;
  const applicabilityRules = parseJsonField(payload.applicabilityRules, 'applicabilityRules');
  const automationSettings = parseJsonField(payload.automationSettings, 'automationSettings');

  const tasks = (payload.tasks ?? []).map((task) => {
    const metadata = parseJsonField(task.metadata, 'metadata');
    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      orderIndex: task.orderIndex ?? null,
      taskType: task.taskType ?? OnboardingTaskType.CUSTOM,
      ownerType: task.ownerType ?? OnboardingTaskOwnerType.EMPLOYEE,
      ownerReference: task.ownerReference ?? null,
      dueOffsetDays: task.dueOffsetDays ?? null,
      requiresApproval: task.requiresApproval ?? false,
      requiresDocument: task.requiresDocument ?? false,
      metadata,
      isActive: task.isActive ?? true
    };
  });

  return {
    id: templateId ?? payload.id,
    name: payload.name,
    description: payload.description ?? null,
    isDefault: payload.isDefault ?? false,
    isActive: payload.isActive ?? true,
    ownerUserId: payload.ownerUserId ?? null,
    applicabilityRules,
    automationSettings,
    tasks
  };
};

const parseOnboardingJourneyStart = (body: unknown) => {
  const result = onboardingJourneyStartSchema.safeParse(body);
  if (!result.success) {
    const issues = result.error.flatten();
    const details = {
      fieldErrors: issues.fieldErrors,
      formErrors: issues.formErrors
    };
    throw new FieldValidationError('onboardingJourney', 'Invalid onboarding journey payload', details);
  }

  const payload = result.data;
  const metadata = parseJsonField(payload.metadata, 'metadata');

  return {
    employeeHrProfileId: payload.employeeHrProfileId,
    onboardingTemplateId: payload.onboardingTemplateId,
    startDate: payload.startDate ? new Date(payload.startDate) : undefined,
    metadata
  };
};

const parseOnboardingTaskCompletion = (body: unknown) => {
  const result = onboardingTaskCompletionSchema.safeParse(body);
  if (!result.success) {
    const issues = result.error.flatten();
    const details = {
      fieldErrors: issues.fieldErrors,
      formErrors: issues.formErrors
    };
    throw new FieldValidationError('onboardingTask', 'Invalid onboarding task payload', details);
  }

  const payload = result.data;
  const metadata = parseJsonField(payload.metadata, 'metadata');

  return {
    status: payload.status,
    notes: payload.notes ?? null,
    metadata,
    approved: payload.approved ?? false,
    approvedByUserId: payload.approvedByUserId ?? null
  };
};

/**
 * Create a new attendance policy.
 */
export const createAttendancePolicy = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const payload = parseAttendancePolicyBody(req.body);

    const policy = await upsertAttendancePolicy({
      ...payload,
      businessId,
      metadata: payload.metadata === undefined ? undefined : payload.metadata
    });

    return res.status(201).json({ policy });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({ error: error.message, field: error.field, details: error.details });
    }

    console.error('Error creating attendance policy:', error);
    const message = error instanceof Error ? error.message : 'Failed to create attendance policy';
    return res.status(500).json({ error: message });
  }
};

/**
 * Update an existing attendance policy.
 */
export const updateAttendancePolicy = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Policy ID is required' });
    }

    const payload = parseAttendancePolicyBody(req.body, id);

    const policy = await upsertAttendancePolicy({
      ...payload,
      businessId,
      metadata: payload.metadata === undefined ? undefined : payload.metadata
    });

    return res.json({ policy });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({ error: error.message, field: error.field, details: error.details });
    }

    console.error('Error updating attendance policy:', error);
    const message = error instanceof Error ? error.message : 'Failed to update attendance policy';
    return res.status(500).json({ error: message });
  }
};

const parseAttendancePunchBody = (body: unknown) => {
  const result = attendancePunchSchema.safeParse(body);
  if (!result.success) {
    throw new FieldValidationError('attendancePunch', 'Invalid attendance punch payload');
  }

  const parsed = result.data;
  const location = parseJsonField(parsed.location, 'location');
  const metadata = parseJsonField(parsed.metadata, 'metadata');

  return {
    ...parsed,
    location,
    metadata
  };
};

/**
 * Employee self-service punch in.
 */
export const recordSelfAttendancePunchIn = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const { employeePositionId, method, source, location, metadata } = parseAttendancePunchBody(req.body);

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User session missing' });
    }

    const positionId =
      employeePositionId ??
      (await findActiveEmployeePositionId(businessId, userId));

    if (!positionId) {
      return res.status(404).json({ error: 'Active employee position not found for this user' });
    }

    const record = await recordPunchIn({
      businessId,
      employeePositionId: positionId,
      method,
      source: source ?? 'employee-self-service',
      location: location === undefined ? undefined : location,
      metadata: metadata === undefined ? undefined : metadata
    });

    return res.status(201).json({ record });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({ error: error.message, field: error.field });
    }

    if (error instanceof Error && error.message.includes('in-progress attendance record')) {
      return res.status(409).json({ error: error.message });
    }

    console.error('Error recording attendance punch-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to record attendance punch-in';
    return res.status(500).json({ error: message });
  }
};

/**
 * Employee self-service punch out.
 */
export const recordSelfAttendancePunchOut = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const { employeePositionId, recordId, method, source, location, metadata } = parseAttendancePunchBody(req.body);

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User session missing' });
    }

    const positionId =
      employeePositionId ??
      (await findActiveEmployeePositionId(businessId, userId));

    if (!positionId) {
      return res.status(404).json({ error: 'Active employee position not found for this user' });
    }

    const record = await recordPunchOut({
      businessId,
      employeePositionId: positionId,
      recordId,
      method,
      source: source ?? 'employee-self-service',
      location: location === undefined ? undefined : location,
      metadata: metadata === undefined ? undefined : metadata
    });

    return res.json({ record });
  } catch (error) {
    if (error instanceof FieldValidationError) {
      return res.status(400).json({ error: error.message, field: error.field });
    }

    if (error instanceof Error && error.message.includes('No in-progress attendance record')) {
      return res.status(404).json({ error: error.message });
    }

    console.error('Error recording attendance punch-out:', error);
    const message = error instanceof Error ? error.message : 'Failed to record attendance punch-out';
    return res.status(500).json({ error: message });
  }
};

/**
 * Get attendance history for the authenticated employee.
 */
export const getMyAttendanceRecords = async (req: Request, res: Response) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User session missing' });
    }

    const { limit } = req.query;
    let take = 30;
    if (typeof limit === 'string') {
      const parsed = Number.parseInt(limit, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        take = Math.min(parsed, 100);
      }
    }

    const employeePositionId = await findActiveEmployeePositionId(businessId, userId);
    if (!employeePositionId) {
      return res.status(404).json({ error: 'Active employee position not found for this user' });
    }

    const records = await listEmployeeAttendanceRecords(businessId, employeePositionId, take);
    return res.json({ records });
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch attendance records';
    return res.status(500).json({ error: message });
  }
};

/**
 * Get audit logs for an employee
 */
export const getEmployeeAuditLogs = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    const { id } = req.params; // employeePositionId
    
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    // Verify employee belongs to business
    const position = await prisma.employeePosition.findFirst({
      where: { id, businessId },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    
    if (!position) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get audit logs for this employee
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        resourceType: 'HR_EMPLOYEE',
        resourceId: id,
        OR: [
          { action: 'HR_EMPLOYEE_CREATED' },
          { action: 'HR_EMPLOYEE_UPDATED' },
          { action: 'HR_EMPLOYEE_TERMINATED' }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    return res.json({ auditLogs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch audit logs';
    res.status(500).json({ error: errorMessage });
  }
};

/**
 * Terminate employee (archive record and vacate position)
 */
export const terminateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // employeePositionId
    const businessId = req.query.businessId as string;
    const userId = (req.user as { id: string })?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const terminationValidation = employeeTerminationSchema.safeParse(req.body);
    if (!terminationValidation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: terminationValidation.error.errors
      });
    }

    const { date, reason, notes } = terminationValidation.data;
    const terminationDate = date ? new Date(date) : new Date();

    let terminationNotes: Prisma.InputJsonValue | null | undefined;

    try {
      terminationNotes = parseJsonField(notes ?? undefined, 'notes');
    } catch (fieldError) {
      if (fieldError instanceof FieldValidationError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: [{ path: [fieldError.field], message: fieldError.message }]
        });
      }
      throw fieldError;
    }

    const employeePosition = await prisma.employeePosition.findFirst({
      where: { id, businessId, active: true },
      include: {
        hrProfile: true,
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!employeePosition) {
      return res.status(404).json({ error: 'Active employee position not found' });
    }

    // Ensure HR profile exists
    const hrProfile = employeePosition.hrProfile
      ? employeePosition.hrProfile
      : await prisma.employeeHRProfile.create({
          data: {
            employeePositionId: employeePosition.id,
            businessId,
            hireDate: undefined
          }
        });

    // Update HR profile status to TERMINATED
    const terminationUpdateData: Prisma.EmployeeHRProfileUpdateInput = {
      employmentStatus: 'TERMINATED',
      terminationDate,
      terminationReason: reason || null,
      terminatedBy: userId
    };

    if (notes !== undefined) {
      terminationUpdateData.terminationNotes = terminationNotes ?? Prisma.JsonNull;
    }

    const updatedProfile = await prisma.employeeHRProfile.update({
      where: { id: hrProfile.id },
      data: terminationUpdateData
    });

    // Vacate position: deactivate assignment and set end date
    await prisma.employeePosition.update({
      where: { id: employeePosition.id },
      data: {
        active: false,
        endDate: terminationDate
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    const terminationChanges: AuditChangeMap = {};
    recordAuditChange(terminationChanges, 'employmentStatus', hrProfile.employmentStatus, updatedProfile.employmentStatus);
    recordAuditChange(terminationChanges, 'terminationDate', hrProfile.terminationDate, updatedProfile.terminationDate);
    recordAuditChange(terminationChanges, 'terminationReason', hrProfile.terminationReason, updatedProfile.terminationReason);
    recordAuditChange(terminationChanges, 'terminationNotes', hrProfile.terminationNotes, updatedProfile.terminationNotes);
    recordAuditChange(terminationChanges, 'terminatedBy', hrProfile.terminatedBy, updatedProfile.terminatedBy);

    await logEmployeeAudit({
      userId,
      action: 'HR_EMPLOYEE_TERMINATED',
      resourceId: id,
      businessId,
      employeeUserId: employeePosition.userId,
      employeeName: employeePosition.user?.name || employeePosition.user?.email || null,
      changes: terminationChanges,
      metadata: {
        terminationDate: terminationDate.toISOString(),
        terminationReason: reason || null,
        terminationNotes: notes !== undefined ? (terminationNotes ?? null) : undefined
      }
    });

    return res.json({
      message: 'Employee terminated; position vacated',
      employeePositionId: employeePosition.id,
      terminationDate,
      positionVacant: true
    });
  } catch (error) {
    console.error('Error terminating employee:', error);
    return res.status(500).json({ error: 'Failed to terminate employee' });
  }
};

/**
 * Get HR settings for business
 * Framework: Returns default settings or stored settings
 */
export const getHRSettings = async (req: Request, res: Response) => {
  try {
    // TODO: Enable after migration
    // const settings = await prisma.hRModuleSettings.findUnique({
    //   where: { businessId }
    // });
    const settings = null;
    
    res.json({ 
      settings: settings || {
        message: 'No custom settings configured',
        defaults: {
          timeOffSettings: { defaultPTODays: 15 },
          workWeekSettings: { daysPerWeek: 5, hoursPerDay: 8 }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching HR settings:', error);
    res.status(500).json({ error: 'Failed to fetch HR settings' });
  }
};

/**
 * Update HR settings
 * Framework: Stub - returns success message
 */
export const updateHRSettings = async (req: Request, res: Response) => {
  try {
    // TODO: Implement HR settings update
    res.json({ 
      message: 'HR settings update - framework stub',
      note: 'Feature implementation pending'
    });
  } catch (error) {
    console.error('Error updating HR settings:', error);
    res.status(500).json({ error: 'Failed to update HR settings' });
  }
};

// ============================================================================
// MANAGER CONTROLLERS (Team Management)
// ============================================================================

/**
 * Get team employees (Manager view)
 * Framework: Returns employees that report to this manager
 */
export const getTeamEmployees = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const businessId = req.query.businessId as string;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const {
      managerPositionId,
      directReportPositionIds
    } = await resolveManagerContext(businessId, req.user.id);

    if (!managerPositionId || directReportPositionIds.length === 0) {
      return res.json({ employees: [], count: 0 });
    }

    const teamEmployees = await prisma.employeePosition.findMany({
      where: {
        businessId,
        active: true,
        positionId: { in: directReportPositionIds }
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        position: { include: { department: true, tier: true } },
        hrProfile: true
      }
    });
    
    res.json({ 
      employees: teamEmployees,
      count: teamEmployees.length
    });
  } catch (error) {
    console.error('Error fetching team employees:', error);
    res.status(500).json({ error: 'Failed to fetch team employees' });
  }
};

export const getTeamAttendanceExceptions = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const managerContext = await resolveManagerContext(businessId, req.user.id);

    if (
      !managerContext.managerPositionId ||
      managerContext.directReportEmployeePositionIds.length === 0
    ) {
      return res.json({
        exceptions: [],
        total: 0,
        page: 1,
        pageSize: 20
      });
    }

    const normalizedStatuses = (() => {
      const raw = req.query.status;
      if (!raw) {
        return undefined;
      }
      const rawArray = Array.isArray(raw) ? raw : [raw];
      const validValues = new Set(Object.values(AttendanceExceptionStatus));
      const filtered = rawArray
        .map((value) => value?.toString().trim().toUpperCase())
        .filter(
          (value): value is AttendanceExceptionStatus =>
            !!value && validValues.has(value as AttendanceExceptionStatus)
        ) as AttendanceExceptionStatus[];
      return filtered.length > 0 ? filtered : undefined;
    })();

    const filterParse = attendanceExceptionFilterSchema.safeParse({
      statuses: normalizedStatuses,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search,
      page: req.query.page,
      pageSize: req.query.pageSize
    });

    if (!filterParse.success) {
      return res.status(400).json({
        error: 'Invalid filter parameters',
        details: filterParse.error.flatten()
      });
    }

    const filterData = filterParse.data;

    const statusArray = Array.isArray(filterData.statuses)
      ? filterData.statuses.length > 0
        ? filterData.statuses
        : [AttendanceExceptionStatus.OPEN, AttendanceExceptionStatus.UNDER_REVIEW]
      : filterData.statuses
      ? [filterData.statuses]
      : [AttendanceExceptionStatus.OPEN, AttendanceExceptionStatus.UNDER_REVIEW];

    const startDate = filterData.startDate ? new Date(filterData.startDate) : undefined;
    const endDate = filterData.endDate ? new Date(filterData.endDate) : undefined;

    if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) {
      return res.status(400).json({ error: 'Invalid date range provided.' });
    }

    const result = await listAttendanceExceptionsForManager({
      businessId,
      employeePositionIds: managerContext.directReportEmployeePositionIds,
      statuses: statusArray,
      startDate,
      endDate,
      search: filterData.search,
      page: filterData.page,
      pageSize: filterData.pageSize
    });

    return res.json(result);
  } catch (error) {
    console.error('Error fetching attendance exceptions:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance exceptions' });
  }
};

export const resolveTeamAttendanceException = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const exceptionId = req.params?.id;
    if (!exceptionId) {
      return res.status(400).json({ error: 'Exception ID is required' });
    }

    const managerContext = await resolveManagerContext(businessId, req.user.id);
    if (
      !managerContext.managerPositionId ||
      managerContext.directReportEmployeePositionIds.length === 0
    ) {
      return res.status(403).json({ error: 'Not authorized to resolve this exception' });
    }

    const existingException = await prisma.attendanceException.findFirst({
      where: {
        id: exceptionId,
        businessId
      },
      select: {
        id: true,
        employeePositionId: true,
        status: true
      }
    });

    if (!existingException) {
      return res.status(404).json({ error: 'Attendance exception not found' });
    }

    if (
      !managerContext.directReportEmployeePositionIds.includes(
        existingException.employeePositionId
      )
    ) {
      return res.status(403).json({ error: 'Not authorized to resolve this exception' });
    }

    const payloadParse = attendanceExceptionResolutionSchema.safeParse(req.body);
    if (!payloadParse.success) {
      return res.status(400).json({
        error: 'Invalid resolution payload',
        details: payloadParse.error.flatten()
      });
    }

    const payload = payloadParse.data;

    const allowedStatuses: AttendanceExceptionStatus[] = [
      AttendanceExceptionStatus.UNDER_REVIEW,
      AttendanceExceptionStatus.RESOLVED,
      AttendanceExceptionStatus.DISMISSED
    ];

    if (!allowedStatuses.includes(payload.status)) {
      return res.status(400).json({
        error: 'Unsupported status. Use UNDER_REVIEW, RESOLVED, or DISMISSED.'
      });
    }

    let attendanceAdjustments: ResolveAttendanceExceptionInput['attendanceAdjustments'] | undefined;
    let resolutionPayload: Prisma.InputJsonValue | null = null;

    if (payload.adjustments) {
      const adjustmentsJson: Record<string, unknown> = {};
      const adjustments: ResolveAttendanceExceptionInput['attendanceAdjustments'] = {};

      if ('clockInTime' in payload.adjustments) {
        if (payload.adjustments.clockInTime === null || payload.adjustments.clockInTime === undefined) {
          adjustments.clockInTime = null;
        } else {
          const parsed = new Date(payload.adjustments.clockInTime);
          if (Number.isNaN(parsed.getTime())) {
            return res.status(400).json({ error: 'Invalid clockInTime value' });
          }
          adjustments.clockInTime = parsed;
        }
        adjustmentsJson.clockInTime = payload.adjustments.clockInTime ?? null;
      }

      if ('clockOutTime' in payload.adjustments) {
        if (payload.adjustments.clockOutTime === null || payload.adjustments.clockOutTime === undefined) {
          adjustments.clockOutTime = null;
        } else {
          const parsed = new Date(payload.adjustments.clockOutTime);
          if (Number.isNaN(parsed.getTime())) {
            return res.status(400).json({ error: 'Invalid clockOutTime value' });
          }
          adjustments.clockOutTime = parsed;
        }
        adjustmentsJson.clockOutTime = payload.adjustments.clockOutTime ?? null;
      }

      if (payload.adjustments.status) {
        adjustments.status = payload.adjustments.status;
        adjustmentsJson.status = payload.adjustments.status;
      }

      if ('varianceMinutes' in payload.adjustments) {
        adjustments.varianceMinutes = payload.adjustments.varianceMinutes ?? null;
        adjustmentsJson.varianceMinutes = payload.adjustments.varianceMinutes ?? null;
      }

      attendanceAdjustments = adjustments;
      resolutionPayload = adjustmentsJson as Prisma.InputJsonValue;
    }

    await resolveAttendanceException({
      businessId,
      exceptionId,
      managerUserId: req.user.id,
      status: payload.status,
      resolutionNote: payload.resolutionNote ?? null,
      managerNote: payload.managerNote ?? null,
      resolutionPayload,
      attendanceAdjustments
    });

    const refreshed = await prisma.attendanceException.findUnique({
      where: { id: exceptionId },
      include: {
        employeePosition: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
            position: {
              include: {
                department: { select: { id: true, name: true } },
                tier: { select: { id: true, name: true } }
              }
            }
          }
        },
        attendanceRecord: true,
        policy: { select: { id: true, name: true } }
      }
    });

    return res.json({ exception: refreshed });
  } catch (error) {
    console.error('Error resolving attendance exception:', error);
    return res.status(500).json({ error: 'Failed to resolve attendance exception' });
  }
};

// ============================================================================
// EMPLOYEE CONTROLLERS (Self-Service)
// ============================================================================

/**
 * Get own HR data
 * Framework: Returns employee's own HR profile
 */
export const getOwnHRData = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const businessId = req.query.businessId as string;
    
    const employeePosition = await prisma.employeePosition.findFirst({
      where: {
        userId: user!.id,
        businessId,
        active: true
      },
      include: {
        position: {
          include: {
            department: true,
            tier: true
          }
        }
        // hrProfile will be included after migration
      }
    });
    
    if (!employeePosition) {
      return res.status(404).json({ error: 'Employee data not found' });
    }
    
    res.json({ employee: employeePosition });
  } catch (error) {
    console.error('Error fetching own HR data:', error);
    res.status(500).json({ error: 'Failed to fetch your HR data' });
  }
};

/**
 * Update own HR data (limited fields)
 * Framework: Stub - returns success message
 */
export const updateOwnHRData = async (req: Request, res: Response) => {
  try {
    // TODO: Implement employee self-update (emergency contact, etc.)
    res.json({ 
      message: 'Self-service update - framework stub',
      note: 'Feature implementation pending'
    });
  } catch (error) {
    console.error('Error updating own HR data:', error);
    res.status(500).json({ error: 'Failed to update your HR data' });
  }
};

// ============================================================================
// AI CONTEXT PROVIDERS (Required for AI integration)
// ============================================================================

/**
 * Get HR overview context for AI
 * Framework: Returns basic HR statistics
 */
export const getHROverviewContext = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    
    const employeeCount = await prisma.employeePosition.count({
      where: { businessId, active: true }
    });
    
    // TODO: Enable after migration
    // const hrProfileCount = await prisma.employeeHRProfile.count({
    //   where: { businessId, deletedAt: null }
    // });
    const hrProfileCount = 0;
    
    res.json({
      businessId,
      totalEmployees: employeeCount,
      hrProfilesCreated: hrProfileCount,
      modules: {
        employees: true,
        attendance: req.hrFeatures?.attendance || false,
        payroll: req.hrFeatures?.payroll || false
      },
      tier: req.hrTier
    });
  } catch (error) {
    console.error('Error fetching HR overview:', error);
    res.status(500).json({ error: 'Failed to fetch HR overview' });
  }
};

/**
 * Get headcount context for AI
 * Framework: Returns employee counts
 */
export const getHeadcountContext = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    
    // TODO: Add department and position breakdowns
    const totalCount = await prisma.employeePosition.count({
      where: { businessId, active: true }
    });
    
    res.json({
      total: totalCount,
      note: 'Detailed breakdown coming in feature implementation'
    });
  } catch (error) {
    console.error('Error fetching headcount:', error);
    res.status(500).json({ error: 'Failed to fetch headcount' });
  }
};

/**
 * Get time-off context for AI
 * Framework: Stub - will return time-off data when feature is implemented
 */
export const getTimeOffContext = async (req: Request, res: Response) => {
  try {
    // TODO: Implement when time-off feature is added
    res.json({
      message: 'Time-off feature not yet implemented',
      outToday: [],
      outThisWeek: []
    });
  } catch (error) {
    console.error('Error fetching time-off context:', error);
    res.status(500).json({ error: 'Failed to fetch time-off data' });
  }
};

// ============================================================================
// TIME-OFF IMPLEMENTATION (Phase 3)
// ==========================================================================

/**
 * Helper function to calculate time-off balance
 * Returns balance without sending HTTP response
 * Supports accrual rules and carryover
 */
async function calculateTimeOffBalance(
  userId: string,
  businessId: string,
  employeePositionId: string,
  type?: TimeOffType
): Promise<{ available: number; used: number; allotment: number; accrued: number; pending: number }> {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31);
  
  const hrProfile = await prisma.employeeHRProfile.findUnique({
    where: { employeePositionId },
    select: { hireDate: true }
  });
  
  // Calculate base allotment (defaults by type)
  const defaultAllotments: Record<string, number> = {
    PTO: 15,
    SICK: 10,
    PERSONAL: 5,
    UNPAID: 0
  };
  
  let allotment = type ? defaultAllotments[type] || 0 : 15;
  
  // If employee was hired mid-year, prorate allotment
  if (hrProfile?.hireDate && type === TimeOffType.PTO) {
    const hireDate = new Date(hrProfile.hireDate);
    if (hireDate > startOfYear) {
      const daysInYear = 365;
      const daysSinceHire = Math.floor((now.getTime() - hireDate.getTime()) / (24 * 60 * 60 * 1000));
      const prorated = Math.floor((allotment * daysSinceHire) / daysInYear);
      allotment = Math.max(0, prorated);
    }
  }
  
  // Get approved requests for this year
  const approved = await prisma.timeOffRequest.findMany({
    where: { 
      businessId, 
      employeePositionId, 
      status: TimeOffStatus.APPROVED,
      ...(type ? { type } : {}),
      startDate: { gte: startOfYear, lte: endOfYear }
    }
  });
  
  // Get pending requests (for display purposes)
  const pending = await prisma.timeOffRequest.findMany({
    where: { 
      businessId, 
      employeePositionId, 
      status: TimeOffStatus.PENDING,
      ...(type ? { type } : {}),
      startDate: { gte: startOfYear, lte: endOfYear }
    }
  });
  
  // Calculate used days from approved requests
  const usedDays = approved.reduce((acc: number, request) => {
    const one = 24 * 60 * 60 * 1000;
    const days = Math.max(
      1,
      Math.round((request.endDate.getTime() - request.startDate.getTime()) / one) + 1
    );
    return acc + days;
  }, 0);
  
  // Calculate pending days
  const pendingDays = pending.reduce((acc: number, request) => {
    const one = 24 * 60 * 60 * 1000;
    const days = Math.max(
      1,
      Math.round((request.endDate.getTime() - request.startDate.getTime()) / one) + 1
    );
    return acc + days;
  }, 0);
  
  // Calculate accrued (for accrual-based systems - monthly accrual)
  // For now, simple calculation: (months into year / 12) * allotment
  const monthsIntoYear = now.getMonth() + 1;
  const accrued = Math.floor((allotment * monthsIntoYear) / 12);
  
  // Available = accrued - used (or simple allotment - used for non-accrual)
  // For simplicity, using allotment - used, but accrued is available for future use
  const available = Math.max(0, allotment - usedDays);
  
  return { 
    available, 
    used: usedDays, 
    allotment,
    accrued,
    pending: pendingDays
  };
}

export const requestTimeOff = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const businessId = req.query.businessId as string;
    const { type, startDate, endDate, reason } = req.body as { type: string; startDate: string; endDate: string; reason?: string };

    // Validate input
    if (!type || !startDate || !endDate) {
      return res.status(400).json({ error: 'Type, start date, and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start > end) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' });
    }

    if (start < new Date()) {
      return res.status(400).json({ error: 'Cannot request time off in the past' });
    }

    // Find the employee's active position in this business
    const employeePosition = await prisma.employeePosition.findFirst({
      where: { userId: user.id, businessId, active: true }
    });
    if (!employeePosition) {
      return res.status(400).json({ error: 'No active employee position found for user' });
    }

    // Normalize and validate time-off type
    const normalizedType = type.toUpperCase() as TimeOffType;
    if (!Object.values(TimeOffType).includes(normalizedType)) {
      return res.status(400).json({ error: 'Invalid time-off type requested' });
    }

    // Check for overlapping requests (excluding canceled)
    const overlapping = await prisma.timeOffRequest.findFirst({
      where: {
        businessId,
        employeePositionId: employeePosition.id,
        status: { not: TimeOffStatus.CANCELED },
        OR: [
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: start } }
            ]
          }
        ]
      }
    });

    if (overlapping) {
      return res.status(400).json({ 
        error: 'You already have a time-off request for this period',
        conflictingRequest: {
          id: overlapping.id,
          startDate: overlapping.startDate,
          endDate: overlapping.endDate,
          status: overlapping.status
        }
      });
    }

    // Check balance for PTO requests
    if (normalizedType === TimeOffType.PTO) {
      const balance = await calculateTimeOffBalance(user.id, businessId, employeePosition.id, TimeOffType.PTO);
      
      // Calculate requested days
      const one = 24 * 60 * 60 * 1000;
      const requestedDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / one) + 1);
      
      if (requestedDays > balance.available) {
        return res.status(400).json({ 
          error: `Insufficient PTO balance. Requested: ${requestedDays} days, Available: ${balance.available} days`,
          balance: { available: balance.available, requested: requestedDays, used: balance.used, allotment: balance.allotment }
        });
      }
    }

    // Create the time-off request
    const request = await prisma.timeOffRequest.create({
      data: {
        businessId,
        employeePositionId: employeePosition.id,
        type: normalizedType,
        startDate: start,
        endDate: end,
        reason: reason || null,
        status: TimeOffStatus.PENDING,
        requestedById: user.id
      }
    });

    try {
      await syncTimeOffRequestCalendar(request.id);
    } catch (syncError) {
      console.error('Error syncing time-off calendar:', syncError);
    }

    return res.json({ message: 'Time-off request submitted', request });
  } catch (error) {
    console.error('Error creating time-off request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit time-off request';
    return res.status(500).json({ error: errorMessage });
  }
};

export const getPendingTeamTimeOff = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const businessId = req.query.businessId as string;

    // Determine manager's position
    const managerPosition = await prisma.employeePosition.findFirst({ where: { userId: user.id, businessId, active: true } });
    if (!managerPosition) return res.json({ requests: [] });

    // Direct reports positions
    const directReportPositions = await prisma.position.findMany({ where: { businessId, reportsToId: managerPosition.positionId } });
    const reportPositionIds = directReportPositions.map((p) => p.id);

    // Pending requests for those positions
    const requests = await prisma.timeOffRequest.findMany({
      where: {
        businessId,
        status: TimeOffStatus.PENDING,
        employeePosition: { positionId: { in: reportPositionIds } }
      },
      include: {
        employeePosition: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            position: { include: { department: true, tier: true } }
          }
        }
      },
      orderBy: { requestedAt: 'desc' }
    });

    return res.json({ requests });
  } catch (error) {
    console.error('Error fetching pending time-off:', error);
    return res.status(500).json({ error: 'Failed to fetch pending time-off' });
  }
};

export const approveTeamTimeOff = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const businessId = req.query.businessId as string;
    const { id } = req.params; // timeOffRequestId
    const { decision, note } = req.body as { decision: 'APPROVE' | 'DENY'; note?: string };

    // Load request
    const tor = await prisma.timeOffRequest.findFirst({ where: { id, businessId } });
    if (!tor) return res.status(404).json({ error: 'Request not found' });

    // Confirm manager has authority (direct reports of this manager)
    const managerPosition = await prisma.employeePosition.findFirst({ where: { userId: user.id, businessId, active: true } });
    if (!managerPosition) return res.status(403).json({ error: 'Not a manager in this business' });
    const directReportPositions = await prisma.position.findMany({ where: { businessId, reportsToId: managerPosition.positionId } });
    const reportPositionIds = directReportPositions.map((p) => p.id);
    const targetEP = await prisma.employeePosition.findFirst({ where: { id: tor.employeePositionId, businessId }, select: { positionId: true } });
    if (!targetEP || !reportPositionIds.includes(targetEP.positionId)) {
      return res.status(403).json({ error: 'Not authorized to approve this request' });
    }

    // Update status
    const status = decision === 'APPROVE' ? TimeOffStatus.APPROVED : TimeOffStatus.DENIED;
    await prisma.timeOffRequest.update({
      where: { id },
      data: { status, approvedById: user.id, approvedAt: new Date(), managerNote: note || null }
    });

    try {
      await syncTimeOffRequestCalendar(id);
    } catch (syncError) {
      console.error('Error syncing time-off calendar:', syncError);
    }

    return res.json({ message: `Request ${status.toLowerCase()}` });
  } catch (error) {
    console.error('Error approving time-off:', error);
    return res.status(500).json({ error: 'Failed to process approval' });
  }
};

export const getTimeOffBalance = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const businessId = req.query.businessId as string;

    const ep = await prisma.employeePosition.findFirst({ where: { userId: user.id, businessId, active: true } });
    if (!ep) return res.json({ balance: { pto: 0, sick: 0, personal: 0 }, used: { pto: 0, sick: 0, personal: 0 } });

    // Calculate balances for each type
    const [ptoBalance, sickBalance, personalBalance] = await Promise.all([
      calculateTimeOffBalance(user.id, businessId, ep.id, TimeOffType.PTO),
      calculateTimeOffBalance(user.id, businessId, ep.id, TimeOffType.SICK),
      calculateTimeOffBalance(user.id, businessId, ep.id, TimeOffType.PERSONAL)
    ]);

    return res.json({ 
      balance: { 
        pto: ptoBalance.available, 
        sick: sickBalance.available, 
        personal: personalBalance.available 
      }, 
      used: { 
        pto: ptoBalance.used, 
        sick: sickBalance.used, 
        personal: personalBalance.used 
      },
      allotment: {
        pto: ptoBalance.allotment,
        sick: sickBalance.allotment,
        personal: personalBalance.allotment
      },
      pending: {
        pto: ptoBalance.pending,
        sick: sickBalance.pending,
        personal: personalBalance.pending
      },
      accrued: {
        pto: ptoBalance.accrued,
        sick: sickBalance.accrued,
        personal: personalBalance.accrued
      }
    });
  } catch (error) {
    console.error('Error fetching time-off balance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch time-off balance';
    return res.status(500).json({ error: errorMessage });
  }
};

export const getMyTimeOffRequests = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const businessId = req.query.businessId as string;
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const employeePosition = await prisma.employeePosition.findFirst({ where: { userId: user.id, businessId } });
    if (!employeePosition) return res.json({ requests: [], count: 0, page, pageSize });

    const requests = await prisma.timeOffRequest.findMany({
      where: { businessId, employeePositionId: employeePosition.id },
      orderBy: { requestedAt: 'desc' },
      skip,
      take: pageSize
    });
    const total = await prisma.timeOffRequest.count({
      where: { businessId, employeePositionId: employeePosition.id }
    });

    return res.json({ requests, count: total, page, pageSize });
  } catch (error) {
    console.error('Error fetching my time-off requests:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch your time-off requests';
    return res.status(500).json({ error: errorMessage });
  }
};

/**
 * Cancel a time-off request (employee can cancel their own pending requests)
 */
export const cancelTimeOffRequest = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const businessId = req.query.businessId as string;
    const { id } = req.params; // timeOffRequestId

    // Find the request
    const request = await prisma.timeOffRequest.findFirst({
      where: { id, businessId },
      include: {
        employeePosition: {
          select: { userId: true }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Time-off request not found' });
    }

    // Verify user owns this request
    if (request.employeePosition.userId !== user.id) {
      return res.status(403).json({ error: 'You can only cancel your own time-off requests' });
    }

    // Only allow canceling pending requests
    if (request.status !== TimeOffStatus.PENDING) {
      return res.status(400).json({ error: 'Only pending requests can be canceled' });
    }

    // Update status to CANCELED
    await prisma.timeOffRequest.update({
      where: { id },
      data: { status: TimeOffStatus.CANCELED }
    });

    try {
      await syncTimeOffRequestCalendar(id);
    } catch (syncError) {
      console.error('Error syncing time-off calendar:', syncError);
    }

    return res.json({ message: 'Time-off request canceled' });
  } catch (error) {
    console.error('Error canceling time-off request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel time-off request';
    return res.status(500).json({ error: errorMessage });
  }
};

/**
 * Get time-off calendar (all approved/pending requests for a business)
 * Available to admins and managers
 */
export const getTimeOffCalendar = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const departmentId = req.query.departmentId as string | undefined;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    // Build date filter
    const dateFilter: Record<string, unknown> = {};
    if (startDate || endDate) {
      if (startDate && endDate) {
        dateFilter.OR = [{
          AND: [
            { startDate: { lte: new Date(endDate) } },
            { endDate: { gte: new Date(startDate) } }
          ]
        }];
      } else if (startDate) {
        dateFilter.endDate = { gte: new Date(startDate) };
      } else if (endDate) {
        dateFilter.startDate = { lte: new Date(endDate) };
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {
      businessId,
      status: { in: [TimeOffStatus.PENDING, TimeOffStatus.APPROVED] },
      ...dateFilter
    };

    // Filter by department if specified
    if (departmentId) {
      where.employeePosition = {
        position: {
          departmentId
        }
      };
    }

    const requests = await prisma.timeOffRequest.findMany({
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
              include: {
                department: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    return res.json({ requests });
  } catch (error) {
    console.error('Error fetching time-off calendar:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch time-off calendar';
    return res.status(500).json({ error: errorMessage });
  }
};

/**
 * Get time-off reports (usage by department, trends, etc.)
 */
export const getTimeOffReports = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), 11, 31);

    // Get all time-off requests in date range
    const requests = await prisma.timeOffRequest.findMany({
      where: {
        businessId,
        startDate: { gte: start, lte: end },
        status: { in: [TimeOffStatus.APPROVED, TimeOffStatus.PENDING] }
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
              include: {
                department: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Calculate usage by department
    const departmentUsage: Record<string, { name: string; totalDays: number; requestCount: number; employees: Set<string> }> = {};
    const typeUsage: Record<string, number> = {};
    let totalDays = 0;
    const totalRequests = requests.length;

    requests.forEach((request) => {
      const employeePosition = request.employeePosition;
      const deptName = employeePosition.position?.department?.name ?? 'Unassigned';
      const deptId = employeePosition.position?.department?.id ?? 'unassigned';
      
      if (!departmentUsage[deptId]) {
        departmentUsage[deptId] = {
          name: deptName,
          totalDays: 0,
          requestCount: 0,
          employees: new Set()
        };
      }
      
      const one = 24 * 60 * 60 * 1000;
      const days = Math.max(
        1,
        Math.round((request.endDate.getTime() - request.startDate.getTime()) / one) + 1
      );
      
      departmentUsage[deptId].totalDays += days;
      departmentUsage[deptId].requestCount += 1;
      departmentUsage[deptId].employees.add(employeePosition.userId);
      
      typeUsage[request.type] = (typeUsage[request.type] || 0) + days;
      totalDays += days;
    });

    // Convert department usage to array
    const departmentStats = Object.entries(departmentUsage).map(([id, data]) => ({
      departmentId: id,
      departmentName: data.name,
      totalDays: data.totalDays,
      requestCount: data.requestCount,
      employeeCount: data.employees.size,
      averageDaysPerEmployee: data.employees.size > 0 ? (data.totalDays / data.employees.size).toFixed(1) : '0'
    }));

    return res.json({
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      summary: {
        totalRequests,
        totalDays,
        averageDaysPerRequest: totalRequests > 0 ? (totalDays / totalRequests).toFixed(1) : '0'
      },
      byDepartment: departmentStats.sort((a, b) => b.totalDays - a.totalDays),
      byType: Object.entries(typeUsage).map(([type, days]) => ({
        type,
        days,
        percentage: totalDays > 0 ? ((days / totalDays) * 100).toFixed(1) : '0'
      }))
    });
  } catch (error) {
    console.error('Error generating time-off reports:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate reports';
    return res.status(500).json({ error: errorMessage });
  }
};

// ============================================================================
// CSV IMPORT/EXPORT CONTROLLERS
// ============================================================================

/**
 * Import employees from CSV
 * Expects CSV file with columns: name, email, title, department, managerEmail, employeeType, hireDate, workLocation
 */
export const importEmployeesCSV = async (req: Request & { file?: Express.Multer.File }, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    const userId = req.user?.id;
    
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }
    
    // Parse CSV content
    const csvContent = req.file.buffer?.toString('utf-8');
    if (!csvContent) {
      return res.status(400).json({ error: 'Unable to read CSV file contents' });
    }
    
    const lines = csvContent.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have at least a header row and one data row' });
    }
    
    // Parse header
    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    const requiredFields = ['name', 'email'];
    const missingFields = requiredFields.filter((field: string) => !headers.includes(field));
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingFields.join(', ')}` 
      });
    }
    
    // Get default tier for positions
    const defaultTier = await prisma.organizationalTier.findFirst({
      where: { businessId },
      orderBy: { level: 'asc' }
    });
    
    if (!defaultTier) {
      return res.status(400).json({ error: 'Business must have at least one organizational tier' });
    }
    
    // Parse data rows
    const results: Array<{
      row: number;
      success: boolean;
      email: string;
      name: string;
      error?: string;
      action?: 'created' | 'updated' | 'skipped';
    }> = [];
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    // Generate random password for imported users
    const generateRandomPassword = () => {
      return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    };
    
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      const values = row.split(',').map((v: string) => v.trim());
      
      if (values.length !== headers.length) {
        results.push({
          row: i + 1,
          success: false,
          email: values[headers.indexOf('email')] || 'unknown',
          name: values[headers.indexOf('name')] || 'unknown',
          error: 'Column count mismatch'
        });
        skipped++;
        continue;
      }
      
      const rowData: Record<string, string> = {};
      headers.forEach((header: string, index: number) => {
        rowData[header] = values[index] || '';
      });
      
      const email = rowData.email;
      const name = rowData.name;
      
      if (!email || !name) {
        results.push({
          row: i + 1,
          success: false,
          email: email || 'unknown',
          name: name || 'unknown',
          error: 'Missing required fields (name or email)'
        });
        skipped++;
        continue;
      }
      
      try {
        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          // Generate temporary password for imported users
          const tempPassword = generateRandomPassword();
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          
          user = await prisma.user.create({
            data: {
              email,
              name,
              password: hashedPassword,
              emailVerified: null
            }
          });
        } else if (user.name !== name) {
          // Update name if different
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name }
          });
        }
        
        // Find or create position
        // For import, we'll need department and position title
        const title = rowData.title || 'Employee';
        const departmentName = rowData.department || 'General';
        
        // Find or create department
        let department = await prisma.department.findFirst({
          where: {
            businessId,
            name: { equals: departmentName, mode: 'insensitive' }
          }
        });
        
        if (!department) {
          department = await prisma.department.create({
            data: {
              businessId,
              name: departmentName
            }
          });
        }
        
        // Find or create position (requires tierId)
        let position = await prisma.position.findFirst({
          where: {
            businessId,
            departmentId: department.id,
            title: { equals: title, mode: 'insensitive' }
          }
        });
        
        if (!position) {
          position = await prisma.position.create({
            data: {
              businessId,
              departmentId: department.id,
              tierId: defaultTier.id,
              title
            }
          });
        }
        
        // Find or create employee position
        const hireDate = rowData.hiredate ? new Date(rowData.hiredate) : new Date();
        const existingPosition = await prisma.employeePosition.findFirst({
          where: {
            businessId,
            userId: user.id,
            positionId: position.id,
            active: true
          }
        });
        
        let action: 'created' | 'updated' = 'created';
        const assignedById = userId || user.id; // Use importing user or employee user as fallback
        
        if (existingPosition) {
          // Update existing
          await prisma.employeePosition.update({
            where: { id: existingPosition.id },
            data: {
              startDate: hireDate,
              active: true,
              endDate: null
            }
          });
          action = 'updated';
          updated++;
        } else {
          // Create new (requires assignedById)
          await prisma.employeePosition.create({
            data: {
              businessId,
              userId: user.id,
              positionId: position.id,
              assignedById,
              startDate: hireDate,
              active: true
            }
          });
          created++;
        }
        
        // Create or update HR profile
        const employeePosition = await prisma.employeePosition.findFirst({
          where: {
            businessId,
            userId: user.id,
            positionId: position.id
          }
        });
        
        if (employeePosition) {
          await prisma.employeeHRProfile.upsert({
            where: { employeePositionId: employeePosition.id },
            create: {
              employeePositionId: employeePosition.id,
              businessId,
              hireDate,
              employeeType:
                normalizeEmployeeTypeValue(rowData.employeetype) ??
                PrismaEmployeeType.FULL_TIME,
              workLocation: rowData.worklocation || null,
              employmentStatus: 'ACTIVE'
            },
            update: {
              hireDate,
              employeeType: normalizeEmployeeTypeValue(rowData.employeetype),
              workLocation: rowData.worklocation || undefined,
              employmentStatus: 'ACTIVE'
            }
          });
        }
        
        results.push({
          row: i + 1,
          success: true,
          email,
          name,
          action
        });
      } catch (error) {
        results.push({
          row: i + 1,
          success: false,
          email,
          name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        skipped++;
      }
    }
    
    return res.json({
      success: true,
      summary: {
        total: lines.length - 1,
        created,
        updated,
        skipped,
        errors: skipped
      },
      results
    });
  } catch (error) {
    console.error('Error importing employees:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to import employees' 
    });
  }
};

/**
 * Export employees to CSV
 * Supports filtering via query params (same as getAdminEmployees)
 */
export const exportEmployeesCSV = async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }
    
    const status = (req.query.status as string) || 'ACTIVE';
    const q = (req.query.q as string) || '';
    const departmentId = req.query.departmentId as string | undefined;
    const positionId = req.query.positionId as string | undefined;
    
    // Build where clause (same logic as getAdminEmployees)
    let employees: Array<{
      name: string;
      email: string;
      title: string;
      department: string;
      tier: string;
      hireDate: string | null;
      employeeType: string | null;
      workLocation: string | null;
    }> = [];
    
    if (status === 'TERMINATED') {
      const hrProfiles = await prisma.employeeHRProfile.findMany({
        where: {
          businessId,
          employmentStatus: EmploymentStatus.TERMINATED
        },
        include: {
          employeePosition: {
            include: {
              user: true,
              position: {
                include: {
                  department: true,
                  tier: true
                }
              }
            }
          }
        }
      });
      
      employees = hrProfiles.map((profile) => ({
        name: profile.employeePosition?.user?.name ?? '',
        email: profile.employeePosition?.user?.email ?? '',
        title: profile.employeePosition?.position?.title ?? '',
        department: profile.employeePosition?.position?.department?.name ?? '',
        tier: profile.employeePosition?.position?.tier?.name ?? '',
        hireDate: profile.hireDate ? profile.hireDate.toISOString().split('T')[0] : null,
        employeeType: profile.employeeType ?? null,
        workLocation: profile.workLocation ?? null
      }));
    } else {
      const where: Record<string, unknown> = {
        businessId,
        active: true
      };
      
      if (q) {
        where.OR = [
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { position: { title: { contains: q, mode: 'insensitive' } } }
        ];
      }
      
      // Add department filter
      if (departmentId) {
        where.position = {
          ...((where.position as Record<string, unknown>) || {}),
          departmentId
        };
      }
      
      // Add position/title filter
      if (positionId) {
        where.positionId = positionId;
      }
      
      const employeePositions = await prisma.employeePosition.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          position: { include: { department: true, tier: true } },
          hrProfile: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      employees = employeePositions.map(ep => ({
        name: ep.user?.name || '',
        email: ep.user?.email || '',
        title: ep.position?.title || '',
        department: ep.position?.department?.name || '',
        tier: ep.position?.tier?.name || '',
      hireDate: ep.hrProfile?.hireDate
        ? ep.hrProfile.hireDate.toISOString().split('T')[0]
        : null,
      employeeType: ep.hrProfile?.employeeType ?? null,
      workLocation: ep.hrProfile?.workLocation ?? null
      }));
    }
    
    // Generate CSV
    const headers = ['Name', 'Email', 'Title', 'Department', 'Tier', 'Hire Date', 'Employee Type', 'Work Location'];
    const csvRows = [
      headers.join(','),
      ...employees.map(emp => [
        `"${emp.name}"`,
        `"${emp.email}"`,
        `"${emp.title}"`,
        `"${emp.department}"`,
        `"${emp.tier}"`,
        emp.hireDate || '',
        emp.employeeType || '',
        emp.workLocation || ''
      ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="employees-${status.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting employees:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to export employees' 
    });
  }
};

