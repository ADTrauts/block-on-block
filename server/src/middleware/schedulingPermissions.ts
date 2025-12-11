import { Response, NextFunction } from 'express';
import { AuthenticatedRequest as BaseAuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { BusinessRole, ModuleInstallation } from '@prisma/client';

// Extend AuthenticatedRequest to include scheduling-specific properties
export interface AuthenticatedRequest extends BaseAuthenticatedRequest {
  businessId?: string;
  employeePositionId?: string;
  directReportIds?: string[];
  moduleInstallation?: ModuleInstallation;
}

/**
 * Check if user is an admin for the business (owner or ADMIN role)
 */
export const checkSchedulingAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user;
  const businessId = (req.query.businessId as string) || (req.body.businessId as string);

  if (!user || !businessId) {
    logger.warn('Unauthorized access attempt: Missing user or businessId in request for checkSchedulingAdmin');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Attach businessId to request for downstream use
  req.businessId = businessId;

  try {
    // Check if user has ADMIN or MANAGER role or management permissions
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
      select: { role: true, isActive: true, canManage: true },
    });

    logger.info(`Scheduling admin check for user ${user.id} in business ${businessId}`, {
      operation: 'scheduling_admin_check',
      userId: user.id,
      businessId,
      memberExists: !!member,
      memberRole: member?.role,
      isActive: member?.isActive,
      canManage: member?.canManage
    });

    if (!member) {
      logger.warn(`Permission denied: User ${user.id} is not a member of business ${businessId}`);
      res.status(403).json({ 
        message: 'Forbidden: Not a member of this business',
        userId: user.id,
        businessId,
        memberExists: false
      });
      return;
    }

    if (!member.isActive) {
      logger.warn(`Permission denied: User ${user.id} is not an active member of business ${businessId}`);
      res.status(403).json({ 
        message: 'Forbidden: Not an active business member',
        userId: user.id,
        businessId,
        role: member.role,
        isActive: false
      });
      return;
    }

    // Allow ADMIN, MANAGER, or users with canManage permission
    if (member.role === BusinessRole.ADMIN || member.role === BusinessRole.MANAGER || member.canManage) {
      logger.info(`Scheduling admin access granted for user ${user.id}`, {
        operation: 'scheduling_admin_granted',
        userId: user.id,
        businessId,
        role: member.role,
        canManage: member.canManage
      });
      next();
      return;
    }

    logger.warn(`Permission denied: User ${user.id} (role: ${member.role}) does not have scheduling:admin for business ${businessId}`);
    res.status(403).json({ 
      message: 'Forbidden: Requires Scheduling Admin access',
      userId: user.id,
      businessId,
      userRole: member.role,
      canManage: member.canManage,
      requiredRoles: ['ADMIN', 'MANAGER'],
      requiredPermission: 'canManage'
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error in checkSchedulingAdmin for user ${user.id}, business ${businessId}`, {
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
    res.status(500).json({ message: 'Internal server error during permission check' });
  }
};

/**
 * Check if user has manager access for scheduling (can view/manage team schedules)
 */
export const checkSchedulingManagerAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user;
  const businessId = (req.query.businessId as string) || (req.body.businessId as string);

  if (!user || !businessId) {
    logger.warn('Unauthorized access attempt: Missing user or businessId in request for checkSchedulingManagerAccess');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Attach businessId to request for downstream use
  req.businessId = businessId;

  try {
    // Check if user has MANAGER or ADMIN role
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
      select: { role: true, isActive: true, canManage: true },
    });

    if (!member?.isActive) {
      logger.warn(`Permission denied: User ${user.id} is not an active member of business ${businessId}`);
      res.status(403).json({ message: 'Forbidden: Not an active business member' });
      return;
    }

    if (member.role !== BusinessRole.MANAGER && member.role !== BusinessRole.ADMIN && !member.canManage) {
      logger.warn(`Permission denied: User ${user.id} does not have MANAGER or ADMIN role in business ${businessId}`);
      res.status(403).json({ message: 'Forbidden: Requires Manager or Admin access' });
      return;
    }

    // If user is admin or has canManage, give them access to all employees
    // Note: ADMIN users don't require an employee position - they have full access
    if (member.role === BusinessRole.ADMIN || member.canManage) {
      const allEmployees = await prisma.employeePosition.findMany({
        where: {
          businessId,
          active: true,
        },
        select: { id: true },
      });
      
      // Try to get employee position if it exists (for consistency), but don't require it
      const employeePosition = await prisma.employeePosition.findFirst({
        where: {
          userId: user.id,
          businessId,
          active: true,
        },
      });
      
      if (employeePosition) {
        req.employeePositionId = employeePosition.id;
      }
      req.directReportIds = allEmployees.map((e) => e.id);
      
      logger.info(`Admin/Manager access granted to user ${user.id} for business ${businessId}`, {
        operation: 'scheduling_manager_access',
        userId: user.id,
        businessId,
        hasEmployeePosition: !!employeePosition,
        directReportCount: allEmployees.length
      });
      
      next();
      return;
    }

    // For regular managers, require an employee position
    const employeePosition = await prisma.employeePosition.findFirst({
      where: {
        userId: user.id,
        businessId,
        active: true,
      },
    });

    if (!employeePosition) {
      logger.warn(`Permission denied: User ${user.id} has manager role but no employee position in business ${businessId}`);
      res.status(403).json({ message: 'Forbidden: No employee position found for manager access' });
      return;
    }

    // For regular managers, get their direct reports
    // Note: This requires org chart structure with supervisor relationships
    // For now, we'll allow managers to see their own team based on org chart
    // TODO: Implement proper org chart hierarchy lookup
    const directReports = await prisma.employeePosition.findMany({
      where: {
        businessId,
        active: true,
        // Add org chart hierarchy filtering here when implemented
      },
      select: { id: true },
    });

    if (directReports.length === 0) {
      logger.warn(`Permission denied: User ${user.id} has manager role but no direct reports in business ${businessId}`);
      res.status(403).json({ message: 'Forbidden: No direct reports found for manager access' });
      return;
    }

    req.employeePositionId = employeePosition.id;
    req.directReportIds = directReports.map((dr) => dr.id);
    next();
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error in checkSchedulingManagerAccess for user ${user.id}, business ${businessId}`, {
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
    res.status(500).json({ message: 'Internal server error during permission check' });
  }
};

/**
 * Check if user has general employee access for scheduling (can view own schedule, set availability)
 * Note: This allows any active business member, not just those with employee positions.
 * Employee positions are optional and used when available for better integration with HR module.
 */
export const checkSchedulingEmployeeAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user;
  const businessId = (req.query.businessId as string) || (req.body.businessId as string);

  console.log('🔍 checkSchedulingEmployeeAccess called', {
    method: req.method,
    path: req.path,
    url: req.url,
    hasUser: !!user,
    userId: user?.id,
    businessId,
    queryBusinessId: req.query.businessId,
    bodyBusinessId: req.body?.businessId
  });

  if (!user || !businessId) {
    logger.warn('Unauthorized access attempt: Missing user or businessId in request for checkSchedulingEmployeeAccess');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Attach businessId to request for downstream use
  req.businessId = businessId;

  try {
    // Check if user is an active business member
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
      select: { isActive: true },
    });

    if (!member?.isActive) {
      logger.warn(`Permission denied: User ${user.id} is not an active member of business ${businessId}`);
      res.status(403).json({ message: 'Forbidden: Not an active business member' });
      return;
    }

    // Try to get employee position if it exists (for HR module integration)
    // This is optional - employees can access scheduling even without a position
    const employeePosition = await prisma.employeePosition.findFirst({
      where: {
        userId: user.id,
        businessId,
        active: true,
      },
    });

    // Set employeePositionId if found, but don't require it
    if (employeePosition) {
      req.employeePositionId = employeePosition.id;
      logger.info(`Employee position found for user ${user.id} in business ${businessId}`, {
        operation: 'scheduling_employee_access',
        userId: user.id,
        businessId,
        employeePositionId: employeePosition.id
      });
    } else {
      logger.info(`No employee position found for user ${user.id} in business ${businessId}, but allowing access as active business member`, {
        operation: 'scheduling_employee_access',
        userId: user.id,
        businessId,
        note: 'Access granted based on active business membership only'
      });
    }

    next();
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error in checkSchedulingEmployeeAccess for user ${user.id}, business ${businessId}`, {
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
    res.status(500).json({ message: 'Internal server error during permission check' });
  }
};

/**
 * Check if an employee is only accessing/modifying their own data
 * Note: employeePositionId is optional - users without employee positions can still access their own data
 * This is a placeholder for future granular self-access checks
 */
export const checkSchedulingSelfAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { user, employeePositionId } = req;

  if (!user) {
    logger.warn('Unauthorized access attempt: Missing user for checkSchedulingSelfAccess');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // employeePositionId is optional - if it exists, we'll use it in controllers
  // If it doesn't exist, controllers will query by userId directly
  // This allows users without employee positions to still access their own scheduling data
  logger.info('Self-access check passed', {
    operation: 'scheduling_self_access',
    userId: user.id,
    hasEmployeePosition: !!employeePositionId
  });

  next();
};
