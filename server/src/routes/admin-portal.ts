import express, { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth';
import { AdminService } from '../services/adminService';
import { logger } from '../lib/logger';
import adminSecurityRoutes from './adminSecurityRoutes';

const router: express.Router = express.Router();

// Middleware to require admin role
const requireAdmin = (req: Request, res: Response, next: () => void) => {
  const user = req.user;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Test endpoint to verify authentication
router.get('/test', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    res.json({ 
      message: 'Admin authentication working!',
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    await logger.error('Admin test endpoint failed', {
      operation: 'admin_test',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Test endpoint failed' });
  }
});

// ============================================================================
// DASHBOARD ANALYTICS
// ============================================================================

// Get dashboard overview statistics
router.get('/dashboard/stats', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      usersLast30Days,
      usersPrevious30Days,
      totalBusinesses,
      businessesLast30Days,
      businessesPrevious30Days,
      monthlyRevenue,
      revenueLast30Days,
      revenuePrevious30Days
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          }
        }
      }),
      prisma.business.count(),
      prisma.business.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.business.count({
        where: {
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          }
        }
      }),
      prisma.moduleSubscription.aggregate({
        _sum: { amount: true },
        where: { status: 'active' }
      }),
      prisma.moduleSubscription.aggregate({
        _sum: { amount: true },
        where: {
          status: 'active',
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.moduleSubscription.aggregate({
        _sum: { amount: true },
        where: {
          status: 'active',
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          }
        }
      })
    ]);

    // Calculate growth trends (percentage change)
    const calculateTrend = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const userGrowthTrend = calculateTrend(usersLast30Days, usersPrevious30Days);
    const businessGrowthTrend = calculateTrend(businessesLast30Days, businessesPrevious30Days);
    const revenueGrowthTrend = calculateTrend(
      revenueLast30Days._sum.amount || 0,
      revenuePrevious30Days._sum.amount || 0
    );

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers,
        activeUsers: totalUsers, // Since we don't have status field, assume all are active
        totalBusinesses: totalBusinesses,
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        systemHealth: 99.9, // Mock value for now
        userGrowthTrend: userGrowthTrend,
        businessGrowthTrend: businessGrowthTrend,
        revenueGrowthTrend: revenueGrowthTrend
      }
    });
  } catch (error) {
    await logger.error('Failed to fetch dashboard statistics', {
      operation: 'admin_dashboard_stats',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activity
router.get('/dashboard/activity', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const recentActivity = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: recentActivity
    });
  } catch (error) {
    await logger.error('Failed to fetch recent activity', {
      operation: 'admin_recent_activity',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// ============================================================================
// USER IMPERSONATION
// ============================================================================

// Start impersonating a user
router.post('/users/:userId/impersonate', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason, businessId, context, expiresInMinutes } = req.body as {
      reason?: string;
      businessId?: string | null;
      context?: string | null;
      expiresInMinutes?: number;
    };
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if admin is already impersonating someone
    const existingImpersonation = await prisma.adminImpersonation.findFirst({
      where: {
        adminId: adminUser.id,
        endedAt: null
      }
    });

    if (existingImpersonation) {
      return res.status(400).json({ error: 'Admin is already impersonating a user' });
    }

    const impersonationToken = crypto.randomBytes(32).toString('hex');
    const impersonationTokenHash = crypto.createHash('sha256').update(impersonationToken).digest('hex');
    const expiresAt = typeof expiresInMinutes === 'number' && expiresInMinutes > 0
      ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
      : new Date(Date.now() + 60 * 60 * 1000); // default 1 hour

    const { impersonation, targetUser: verifiedTarget } = await AdminService.startImpersonation(
      adminUser.id,
      userId,
      {
        reason,
        businessId: businessId ?? null,
        context: context ?? null,
        sessionTokenHash: impersonationTokenHash,
        expiresAt
      }
    );

    let businessSummary: { id: string; name: string } | null = null;
    if (impersonation.businessId) {
      const business = await prisma.business.findUnique({
        where: { id: impersonation.businessId },
        select: { id: true, name: true }
      });
      if (business) {
        businessSummary = business;
      }
    }

    // Log the impersonation action
    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'USER_IMPERSONATION_START',
        resourceType: 'user',
        resourceId: userId,
        details: JSON.stringify({
          adminEmail: adminUser.email,
          targetUserEmail: targetUser.email,
          reason: reason || 'Admin impersonation for debugging/support',
          businessId: businessId ?? null,
          context: context ?? null,
          expiresAt: expiresAt.toISOString()
        }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Impersonation started successfully',
      impersonation: {
        id: impersonation.id,
        targetUser: {
          id: verifiedTarget.id,
          email: verifiedTarget.email,
          name: verifiedTarget.name
        },
        startedAt: impersonation.startedAt,
        reason: impersonation.reason,
        businessId: impersonation.businessId,
        business: businessSummary,
        context: impersonation.context,
        expiresAt
      },
      token: impersonationToken
    });
  } catch (error) {
    await logger.error('Failed to start user impersonation', {
      operation: 'admin_impersonate_start',
      userId: req.params.userId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to start impersonation' });
  }
});

// End impersonation session
router.post('/impersonation/end', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Find active impersonation session
    const impersonation = await prisma.adminImpersonation.findFirst({
      where: {
        adminId: adminUser.id,
        endedAt: null
      },
      include: {
        targetUser: {
          select: { id: true, email: true, name: true }
        },
        business: {
          select: { id: true, name: true }
        }
      }
    });

    if (!impersonation) {
      return res.status(404).json({ error: 'No active impersonation session found' });
    }

    // End the impersonation session
    await prisma.adminImpersonation.update({
      where: { id: impersonation.id },
      data: { endedAt: new Date() }
    });

    // Log the end of impersonation
    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'USER_IMPERSONATION_END',
        resourceType: 'user',
        resourceId: impersonation.targetUserId,
        details: JSON.stringify({
          adminEmail: adminUser.email,
          targetUserEmail: impersonation.targetUser.email,
          duration: Date.now() - impersonation.startedAt.getTime()
        }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Impersonation ended successfully',
      impersonation: {
        id: impersonation.id,
        targetUser: impersonation.targetUser,
        startedAt: impersonation.startedAt,
        endedAt: new Date(),
        duration: Date.now() - impersonation.startedAt.getTime()
      }
    });
  } catch (error) {
    await logger.error('Failed to end user impersonation', {
      operation: 'admin_impersonate_end',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to end impersonation' });
  }
});

// Get current impersonation session
router.get('/impersonation/current', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const impersonation = await prisma.adminImpersonation.findFirst({
      where: {
        adminId: adminUser.id,
        endedAt: null
      },
      include: {
        targetUser: {
          select: { id: true, email: true, name: true }
        },
        business: {
          select: { id: true, name: true }
        }
      }
    });

    if (!impersonation) {
      return res.json({ active: false });
    }

    res.json({
      active: true,
      impersonation: {
        id: impersonation.id,
        targetUser: impersonation.targetUser,
        startedAt: impersonation.startedAt,
        reason: impersonation.reason,
        businessId: impersonation.businessId,
        business: impersonation.business,
        context: impersonation.context,
        expiresAt: impersonation.expiresAt,
        duration: Date.now() - impersonation.startedAt.getTime()
      }
    });
  } catch (error) {
    await logger.error('Failed to get current impersonation session', {
      operation: 'admin_impersonate_get_current',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get current impersonation' });
  }
});

router.get('/impersonation/businesses', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 12, search } = req.query;
    const take = Math.min(Number(limit) || 12, 50);
    const skip = (Number(page) - 1) * take;

    const where: Record<string, unknown> = {};
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { size: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          tier: true,
          industry: true,
          size: true,
          createdAt: true,
          hrModuleSettings: {
            select: { enabledFeatures: true }
          },
          _count: {
            select: {
              members: true,
              employeePositions: true,
              businessModuleInstallations: true
            }
          }
        }
      }),
      prisma.business.count({ where })
    ]);

    const payload = businesses.map((business) => ({
      id: business.id,
      name: business.name,
      tier: business.tier,
      industry: business.industry,
      size: business.size,
      createdAt: business.createdAt,
      memberCount: business._count.members,
      employeePositionCount: business._count.employeePositions,
      moduleCount: business._count.businessModuleInstallations,
      hrEnabledFeatures: business.hrModuleSettings?.enabledFeatures ?? null
    }));

    res.json({
      businesses: payload,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / take)
    });
  } catch (error) {
    await logger.error('Failed to fetch impersonation business list', {
      operation: 'admin_impersonate_list_businesses',
      filters: req.query,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to load businesses' });
  }
});

router.get('/impersonation/businesses/:businessId/members', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        tier: true,
        industry: true,
        size: true,
        createdAt: true,
        hrModuleSettings: {
          select: { enabledFeatures: true }
        }
      }
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const [members, moduleInstallations] = await Promise.all([
      prisma.businessMember.findMany({
        where: { businessId },
        orderBy: { joinedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          job: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }),
      prisma.businessModuleInstallation.findMany({
        where: { businessId },
        orderBy: { installedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          moduleId: true,
          installedAt: true,
          enabled: true,
          module: {
            select: {
              id: true,
              name: true,
              category: true
            }
          }
        }
      })
    ]);

    const membersPayload = members.map((member) => ({
      id: member.id,
      role: member.role,
      title: member.title ?? member.job?.title ?? null,
      department: member.department,
      joinedAt: member.joinedAt,
      canManage: member.canManage,
      canInvite: member.canInvite,
      canBilling: member.canBilling,
      user: member.user
    }));

    const modulesPayload = moduleInstallations.map((installation) => ({
      id: installation.id,
      moduleId: installation.moduleId,
      moduleName: installation.module?.name ?? 'Unknown Module',
      category: installation.module?.category ?? null,
      installedAt: installation.installedAt,
      enabled: installation.enabled
    }));

    res.json({
      business,
      members: membersPayload,
      modules: modulesPayload,
      totalMembers: members.length
    });
  } catch (error) {
    await logger.error('Failed to fetch impersonation business members', {
      operation: 'admin_impersonate_business_members',
      businessId: req.params.businessId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to load business members' });
  }
});

router.post('/impersonation/businesses/:businessId/seed', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    const adminUser = req.user;
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true }
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const IMPERSONATION_DEPARTMENT = 'Impersonation Lab Personas';
    const managerTier = await prisma.organizationalTier.upsert({
      where: {
        businessId_name: {
          businessId,
          name: 'Impersonation Lab - Management'
        }
      },
      update: {
        description: 'Management tier generated for Impersonation Lab personas',
        level: 2
      },
      create: {
        businessId,
        name: 'Impersonation Lab - Management',
        level: 2,
        description: 'Management tier generated for Impersonation Lab personas'
      }
    });

    const staffTier = await prisma.organizationalTier.upsert({
      where: {
        businessId_name: {
          businessId,
          name: 'Impersonation Lab - Staff'
        }
      },
      update: {
        description: 'Staff tier generated for Impersonation Lab personas',
        level: 3
      },
      create: {
        businessId,
        name: 'Impersonation Lab - Staff',
        level: 3,
        description: 'Staff tier generated for Impersonation Lab personas'
      }
    });

    const managerPosition = await prisma.position.upsert({
      where: {
        businessId_title: {
          businessId,
          title: 'Impersonation Lab - Manager'
        }
      },
      update: {
        tierId: managerTier.id,
        reportsToId: null,
        maxOccupants: 5
      },
      create: {
        businessId,
        title: 'Impersonation Lab - Manager',
        tierId: managerTier.id,
        reportsToId: null,
        maxOccupants: 5,
        departmentId: null
      }
    });

    const staffPosition = await prisma.position.upsert({
      where: {
        businessId_title: {
          businessId,
          title: 'Impersonation Lab - Specialist'
        }
      },
      update: {
        tierId: staffTier.id,
        reportsToId: managerPosition.id,
        maxOccupants: 10
      },
      create: {
        businessId,
        title: 'Impersonation Lab - Specialist',
        tierId: staffTier.id,
        reportsToId: managerPosition.id,
        maxOccupants: 10,
        departmentId: null
      }
    });

    const existingMembers = await prisma.businessMember.findMany({
      where: {
        businessId,
        department: IMPERSONATION_DEPARTMENT
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    const ensureAssignment = async (userId: string, positionId: string) => {
      let assignment = await prisma.employeePosition.findFirst({
        where: {
          userId,
          positionId,
          businessId
        }
      });

      if (!assignment) {
        assignment = await prisma.employeePosition.create({
          data: {
            userId,
            positionId,
            businessId,
            assignedById: adminUser.id,
            startDate: new Date(),
            active: true
          }
        });
      } else if (!assignment.active) {
        assignment = await prisma.employeePosition.update({
          where: { id: assignment.id },
          data: {
            active: true,
            endDate: null
          }
        });
      }

      return assignment;
    };

    const ensureHrProfile = async (employeePositionId: string, employmentStatus: 'ACTIVE' | 'TERMINATED' = 'ACTIVE') => {
      return prisma.employeeHRProfile.upsert({
        where: { employeePositionId },
        create: {
          employeePositionId,
          businessId,
          hireDate: new Date(),
          employmentStatus,
          employeeType: 'FULL_TIME'
        },
        update: {
          employmentStatus,
          terminationDate: null,
          terminationReason: null,
          terminatedBy: null,
          deletedAt: null,
          deletedBy: null,
          deletedReason: null
        }
      });
    };

    const createPersonaUser = async (label: string, displayName: string) => {
      const email = `${label}-${businessId.slice(0, 8)}-${crypto.randomBytes(3).toString('hex')}@impersonation.vssyl`;
      const temporaryPassword = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      const user = await prisma.user.create({
        data: {
          email,
          name: displayName,
          password: hashedPassword,
          role: 'USER'
        },
        select: {
          id: true,
          email: true,
          name: true
        }
      });

      return { user, temporaryPassword };
    };

    const personas: Array<{
      role: 'MANAGER' | 'EMPLOYEE';
      userId: string;
      email: string;
      name: string | null;
      businessMemberId: string;
      employeePositionId: string | null;
      hrProfileId: string | null;
      temporaryPassword?: string;
    }> = [];

    const managerMemberExisting = existingMembers.find((member) => member.role === 'MANAGER');

    let managerMember = managerMemberExisting ?? null;
    let managerUser = managerMemberExisting?.user ?? null;
    let managerTempPassword: string | undefined;

    if (!managerMember) {
      const managerDisplayName = `Impersonation Manager (${business.name})`;
      const { user, temporaryPassword } = await createPersonaUser('manager', managerDisplayName);
      managerTempPassword = temporaryPassword;
      managerUser = user;

      managerMember = await prisma.businessMember.create({
        data: {
          businessId,
          userId: user.id,
          role: 'MANAGER',
          title: 'Impersonation Lab Manager',
          department: IMPERSONATION_DEPARTMENT,
          canManage: true,
          canInvite: true,
          canBilling: false
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
    }

    const managerAssignment = await ensureAssignment(managerUser!.id, managerPosition.id);
    const managerHrProfile = await ensureHrProfile(managerAssignment.id);

    personas.push({
      role: 'MANAGER',
      userId: managerUser!.id,
      email: managerUser!.email,
      name: managerUser!.name,
      businessMemberId: managerMember!.id,
      employeePositionId: managerAssignment.id,
      hrProfileId: managerHrProfile.id,
      temporaryPassword: managerTempPassword
    });

    const employeeMemberExisting = existingMembers.find((member) => member.role === 'EMPLOYEE');

    let employeeMember = employeeMemberExisting ?? null;
    let employeeUser = employeeMemberExisting?.user ?? null;
    let employeeTempPassword: string | undefined;

    if (!employeeMember) {
      const employeeDisplayName = `Impersonation Specialist (${business.name})`;
      const { user, temporaryPassword } = await createPersonaUser('specialist', employeeDisplayName);
      employeeTempPassword = temporaryPassword;
      employeeUser = user;

      employeeMember = await prisma.businessMember.create({
        data: {
          businessId,
          userId: user.id,
          role: 'EMPLOYEE',
          title: 'Impersonation Lab Specialist',
          department: IMPERSONATION_DEPARTMENT,
          canManage: false,
          canInvite: false,
          canBilling: false
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
    }

    const employeeAssignment = await ensureAssignment(employeeUser!.id, staffPosition.id);
    const employeeHrProfile = await ensureHrProfile(employeeAssignment.id);

    const existingApproval = await prisma.managerApprovalHierarchy.findFirst({
      where: {
        businessId,
        employeePositionId: employeeAssignment.id,
        managerPositionId: managerAssignment.id
      }
    });

    if (!existingApproval) {
      await prisma.managerApprovalHierarchy.create({
        data: {
          businessId,
          employeePositionId: employeeAssignment.id,
          managerPositionId: managerAssignment.id,
          approvalTypes: ['time_off'],
          approvalLevel: 1,
          isPrimary: true
        }
      });
    } else if (!existingApproval.approvalTypes.includes('time_off')) {
      await prisma.managerApprovalHierarchy.update({
        where: { id: existingApproval.id },
        data: {
          approvalTypes: [...new Set([...existingApproval.approvalTypes, 'time_off'])]
        }
      });
    }

    personas.push({
      role: 'EMPLOYEE',
      userId: employeeUser!.id,
      email: employeeUser!.email,
      name: employeeUser!.name,
      businessMemberId: employeeMember!.id,
      employeePositionId: employeeAssignment.id,
      hrProfileId: employeeHrProfile.id,
      temporaryPassword: employeeTempPassword
    });

    res.json({
      message: 'Impersonation lab personas are ready.',
      personas
    });
  } catch (error) {
    await logger.error('Failed to seed impersonation personas', {
      operation: 'admin_impersonate_seed_personas',
      businessId: req.params.businessId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to seed impersonation personas' });
  }
});

// Get impersonation history for admin
router.get('/impersonation/history', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [impersonations, total] = await Promise.all([
      prisma.adminImpersonation.findMany({
        where: { adminId: adminUser.id },
        skip,
        take: Number(limit),
        orderBy: { startedAt: 'desc' },
        include: {
          targetUser: {
            select: { id: true, email: true, name: true }
          },
          business: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.adminImpersonation.count({ where: { adminId: adminUser.id } })
    ]);

    res.json({
      impersonations,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    await logger.error('Failed to get impersonation history', {
      operation: 'admin_impersonate_history',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get impersonation history' });
  }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

// Get all users with pagination and filtering
router.get('/users', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
        { userNumber: { contains: search as string } }
      ];
    }
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          userNumber: true,
          role: true,
          createdAt: true,
          emailVerified: true,
          _count: {
            select: {
              businesses: true,
              files: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    await logger.error('Failed to fetch users list', {
      operation: 'admin_get_users',
      filters: req.query,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
router.get('/users/:userId', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        businesses: true,
        files: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    await logger.error('Failed to fetch user details', {
      operation: 'admin_get_user_details',
      userId: req.params.userId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user status (ban, suspend, activate)
router.patch('/users/:userId/status', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Note: User model doesn't have a status field, so we'll just log the action
    await logger.info('Admin attempted to update user status', {
      operation: 'admin_update_user_status',
      adminId: adminUser.id,
      userId,
      status,
      reason: reason || 'No reason provided'
    });

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    await logger.error('Failed to update user status', {
      operation: 'admin_update_user_status',
      userId: req.params.userId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Reset user password
router.post('/users/:userId/reset-password', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // In a real implementation, you would hash the password and send it via email
    // For now, we'll just log the action
    await logger.logSecurityEvent('password_reset_initiated', 'medium', {
      operation: 'admin_reset_user_password',
      adminId: adminUser.id,
      userId
    });

    res.json({ message: 'Password reset initiated' });
  } catch (error) {
    await logger.error('Failed to reset user password', {
      operation: 'admin_reset_user_password',
      userId: req.params.userId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to reset user password' });
  }
});

// ============================================================================
// CONTENT MODERATION
// ============================================================================

// Get reported content
router.get('/moderation/reported', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.contentType = type;

    const [reports, total] = await Promise.all([
      prisma.contentReport.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: { email: true, name: true }
          }
        }
      }),
      prisma.contentReport.count({ where })
    ]);

    res.json({
      reports,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    await logger.error('Failed to fetch reported content', {
      operation: 'admin_get_reported_content_paginated',
      filters: req.query,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch reported content' });
  }
});

// Update report status
router.patch('/moderation/reports/:reportId', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { status, action, reason } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const report = await prisma.contentReport.update({
      where: { id: reportId },
      data: {
        status,
        action,
        reviewedBy: adminUser.id,
        reviewedAt: new Date()
      }
    });

    await logger.info('Admin updated content report', {
      operation: 'admin_update_report',
      adminId: adminUser.id,
      reportId,
      status,
      action,
      reason: reason || 'No reason provided'
    });

    res.json(report);
  } catch (error) {
    await logger.error('Failed to update content report', {
      operation: 'admin_update_report',
      reportId: req.params.reportId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// ============================================================================
// PLATFORM ANALYTICS
// ============================================================================

// Get system metrics
router.get('/analytics/system', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    const metrics = await prisma.systemMetrics.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - (timeRange === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000))
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    res.json(metrics);
  } catch (error) {
    await logger.error('Failed to fetch system metrics', {
      operation: 'admin_get_system_metrics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch system metrics' });
  }
});

// Get user analytics
router.get('/analytics/users', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { timeRange = '30d' } = req.query;
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    
    const userStats = await prisma.user.groupBy({
      by: ['createdAt'],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      }
    });

    res.json(userStats);
  } catch (error) {
    await logger.error('Failed to fetch user analytics', {
      operation: 'admin_get_user_analytics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

// Analytics routes
router.get('/analytics', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const analyticsData = await AdminService.getAnalytics(filters);
    res.json(analyticsData);
  } catch (error) {
    await logger.error('Failed to fetch analytics', {
      operation: 'admin_get_analytics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

router.post('/analytics/export', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { format } = req.query;
    const filters = req.body;
    const exportData = await AdminService.exportAnalytics(filters, format as string);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.json"`);
    }
    
    res.send(exportData);
  } catch (error) {
    await logger.error('Failed to export analytics', {
      operation: 'admin_export_analytics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to export analytics data' });
  }
});

router.get('/analytics/realtime', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const realtimeData = await AdminService.getRealTimeMetrics();
    res.json(realtimeData);
  } catch (error) {
    await logger.error('Failed to fetch real-time metrics', {
      operation: 'admin_get_realtime_metrics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch real-time metrics' });
  }
});

router.post('/analytics/custom-report', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const reportConfig = req.body;
    const customReport = await AdminService.generateCustomReport(reportConfig);
    res.json(customReport);
  } catch (error) {
    await logger.error('Failed to generate custom report', {
      operation: 'admin_generate_custom_report',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to generate custom report' });
  }
});

// ============================================================================
// FINANCIAL MANAGEMENT
// ============================================================================

// Get subscription data
router.get('/billing/subscriptions', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { email: true, name: true }
          }
        }
      }),
      prisma.subscription.count({ where })
    ]);

    res.json({
      subscriptions,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    await logger.error('Failed to fetch subscriptions', {
      operation: 'admin_get_subscriptions',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Get payment data
router.get('/billing/payments', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const result = await AdminService.getPayments({
      page: Number(page),
      limit: Number(limit),
      status: status as string
    });
    res.json(result);
  } catch (error) {
    await logger.error('Failed to fetch payments', {
      operation: 'admin_get_payments',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get developer payouts
router.get('/billing/payouts', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.payoutStatus = status;

    const [payouts, total] = await Promise.all([
      prisma.developerRevenue.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          developer: {
            select: { email: true, name: true }
          },
          module: {
            select: { name: true }
          }
        }
      }),
      prisma.developerRevenue.count({ where })
    ]);

    res.json({
      payouts: payouts.map(payout => ({
        id: payout.id,
        developerId: payout.developerId,
        developerName: payout.developer.name || payout.developer.email,
        amount: payout.developerRevenue,
        status: payout.payoutStatus,
        requestedAt: payout.createdAt,
        paidAt: payout.payoutDate
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    await logger.error('Failed to fetch developer payouts', {
      operation: 'admin_get_developer_payouts',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch developer payouts' });
  }
});

// ============================================================================
// SECURITY & COMPLIANCE
// ============================================================================

// Get security events
router.get('/security/events', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, severity, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (severity) where.severity = severity;
    if (type) where.eventType = type;

    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { timestamp: 'desc' }
      }),
      prisma.securityEvent.count({ where })
    ]);

    res.json({
      events,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    await logger.error('Failed to fetch security events', {
      operation: 'admin_get_security_events',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// Get audit logs
router.get('/security/audit-logs', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, adminId, action } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (adminId) where.adminId = adminId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { timestamp: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      logs,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    await logger.error('Failed to fetch audit logs', {
      operation: 'admin_get_audit_logs',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Security routes
router.get('/security/events', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const securityEvents = await AdminService.getSecurityEvents(filters);
    res.json(securityEvents);
  } catch (error) {
    await logger.error('Failed to fetch security events', {
      operation: 'admin_get_security_events',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

router.get('/security/metrics', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const securityMetrics = await AdminService.getSecurityMetrics();
    res.json(securityMetrics);
  } catch (error) {
    await logger.error('Failed to fetch security metrics', {
      operation: 'admin_get_security_metrics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch security metrics' });
  }
});

router.get('/security/compliance', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const complianceStatus = await AdminService.getComplianceStatus();
    res.json(complianceStatus);
  } catch (error) {
    await logger.error('Failed to fetch compliance status', {
      operation: 'admin_get_compliance_status',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch compliance status' });
  }
});

router.post('/security/events/:eventId/resolve', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const result = await AdminService.resolveSecurityEvent(eventId, adminUser.id);
    res.json(result);
  } catch (error) {
    await logger.error('Failed to resolve security event', {
      operation: 'admin_resolve_security_event',
      eventId: req.params.eventId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to resolve security event' });
  }
});

router.post('/security/export', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { format } = req.query;
    const filters = req.body;
    const exportData = await AdminService.exportSecurityReport(filters, format as string);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="security-report-${new Date().toISOString().split('T')[0]}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="security-report-${new Date().toISOString().split('T')[0]}.json"`);
    }
    
    res.send(exportData);
  } catch (error) {
    await logger.error('Failed to export security report', {
      operation: 'admin_export_security_report',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to export security report' });
  }
});

// ============================================================================
// SYSTEM ADMINISTRATION
// ============================================================================

// Get system health
router.get('/system/health', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    // In a real implementation, you would collect actual system metrics
    // For now, we'll return mock data
    const systemHealth = {
      cpu: Math.floor(Math.random() * 30) + 20, // 20-50%
      memory: Math.floor(Math.random() * 40) + 40, // 40-80%
      disk: Math.floor(Math.random() * 30) + 50, // 50-80%
      network: Math.floor(Math.random() * 50) + 10, // 10-60 Mbps
      uptime: '99.9%',
      responseTime: Math.floor(Math.random() * 50) + 100, // 100-150ms
      errorRate: (Math.random() * 0.1).toFixed(3) // 0-0.1%
    };

    res.json(systemHealth);
  } catch (error) {
    await logger.error('Failed to fetch system health', {
      operation: 'admin_get_system_health',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

// Get system configuration
router.get('/system/config', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const configs = await prisma.systemConfig.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    res.json(configs);
  } catch (error) {
    await logger.error('Failed to fetch system configuration', {
      operation: 'admin_get_system_config',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch system configuration' });
  }
});

// Update system configuration
router.patch('/system/config/:configKey', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { configKey } = req.params;
    const { configValue, description } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const config = await prisma.systemConfig.upsert({
      where: { configKey },
      update: {
        configValue,
        description,
        updatedBy: adminUser.id,
        updatedAt: new Date()
      },
      create: {
        configKey,
        configValue,
        description,
        updatedBy: adminUser.id
      }
    });

    await logger.info('Admin updated system configuration', {
      operation: 'admin_update_system_config',
      adminId: adminUser.id,
      configKey
    });

    res.json(config);
  } catch (error) {
    await logger.error('Failed to update system configuration', {
      operation: 'admin_update_system_config',
      configKey: req.params.configKey,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update system configuration' });
  }
});

// Moderation routes
router.get('/moderation/stats', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await AdminService.getModerationStats();
    res.json(stats);
  } catch (error) {
    await logger.error('Failed to fetch moderation statistics', {
      operation: 'admin_get_moderation_stats',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch moderation stats' });
  }
});

router.get('/moderation/rules', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const rules = await AdminService.getModerationRules();
    res.json(rules);
  } catch (error) {
    await logger.error('Failed to fetch moderation rules', {
      operation: 'admin_get_moderation_rules',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch moderation rules' });
  }
});

router.post('/moderation/bulk-action', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportIds, action } = req.body;
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(500).json({ error: 'User not authenticated' });
    }
    
    const result = await AdminService.bulkModerationAction(reportIds, action, adminUser.id);
    res.json(result);
  } catch (error) {
    await logger.error('Failed to perform bulk moderation action', {
      operation: 'admin_bulk_moderate',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to perform bulk moderation action' });
  }
});

router.post('/moderation/reports', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const filters = req.body;
    const reports = await AdminService.getReportedContent(filters);
    res.json(reports);
  } catch (error) {
    await logger.error('Failed to fetch reported content', {
      operation: 'admin_get_reported_content',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch reported content' });
  }
});

router.put('/moderation/reports/:reportId', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { status, action, reason } = req.body;
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(500).json({ error: 'User not authenticated' });
    }
    
    const result = await AdminService.updateReportStatus(reportId, status, action, reason, adminUser.id);
    res.json(result);
  } catch (error) {
    await logger.error('Failed to update report status', {
      operation: 'admin_update_report_status',
      reportId: req.params.reportId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

// System administration routes
router.get('/system/backup', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const backupStatus = await AdminService.getBackupStatus();
    res.json(backupStatus);
  } catch (error) {
    await logger.error('Failed to fetch backup status', {
      operation: 'admin_get_backup_status',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch backup status' });
  }
});

router.post('/system/backup', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(500).json({ error: 'User not authenticated' });
    }
    
    const result = await AdminService.createBackup(adminUser.id);
    res.json(result);
  } catch (error) {
    await logger.error('Failed to create backup', {
      operation: 'admin_create_backup',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

router.get('/system/maintenance', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const maintenanceMode = await AdminService.getMaintenanceMode();
    res.json(maintenanceMode);
  } catch (error) {
    await logger.error('Failed to fetch maintenance mode', {
      operation: 'admin_get_maintenance_mode',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to fetch maintenance mode' });
  }
});

router.post('/system/maintenance', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { enabled, message } = req.body;
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(500).json({ error: 'User not authenticated' });
    }
    
    const result = await AdminService.setMaintenanceMode(enabled, message, adminUser.id);
    res.json(result);
  } catch (error) {
    await logger.error('Failed to set maintenance mode', {
      operation: 'admin_set_maintenance_mode',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to set maintenance mode' });
  }
});

// Module Management Routes
router.get('/modules/submissions', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, category, developer, dateRange } = req.query;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const submissions = await AdminService.getModuleSubmissions({
      status: status as string,
      category: category as string,
      developerId: developer as string,
      dateRange: dateRange as string
    });

    await logger.info('Admin retrieved module submissions', {
      operation: 'admin_get_module_submissions',
      adminId: adminUser.id,
      filters: req.query
    });

    res.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    await logger.error('Failed to get module submissions', {
      operation: 'admin_get_module_submissions',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get module submissions' });
  }
});

router.get('/modules/stats', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const stats = await AdminService.getModuleStats();

    await logger.info('Admin retrieved module statistics', {
      operation: 'admin_get_module_stats',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    await logger.error('Failed to get module statistics', {
      operation: 'admin_get_module_stats',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get module stats' });
  }
});

router.post('/modules/submissions/:submissionId/review', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { action, reviewNotes } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.reviewModuleSubmission(
      submissionId,
      action,
      reviewNotes,
      adminUser.id
    );

    await logger.info('Admin reviewed module submission', {
      operation: 'admin_review_module_submission',
      adminId: adminUser.id,
      submissionId,
      action
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to review module submission', {
      operation: 'admin_review_module_submission',
      submissionId: req.params.submissionId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to review module submission' });
  }
});

router.post('/modules/bulk-action', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { submissionIds, action } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.bulkModuleAction(
      submissionIds,
      action,
      adminUser.id
    );

    await logger.info('Admin performed bulk action on module submissions', {
      operation: 'admin_bulk_module_action',
      adminId: adminUser.id,
      submissionCount: submissionIds.length,
      action
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to perform bulk module action', {
      operation: 'admin_bulk_module_action',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to perform bulk module action' });
  }
});

router.get('/modules/analytics', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const analytics = await AdminService.getModuleAnalytics();

    await logger.info('Admin retrieved module analytics', {
      operation: 'admin_get_module_analytics',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    await logger.error('Failed to get module analytics', {
      operation: 'admin_get_module_analytics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get module analytics' });
  }
});

router.get('/modules/developers/stats', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const stats = await AdminService.getDeveloperStats();

    await logger.info('Admin retrieved developer statistics', {
      operation: 'admin_get_developer_stats',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    await logger.error('Failed to get developer statistics', {
      operation: 'admin_get_developer_stats',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get developer stats' });
  }
});

router.patch('/modules/:moduleId/status', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    const { status } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.updateModuleStatus(moduleId, status, adminUser.id);

    await logger.info('Admin updated module status', {
      operation: 'admin_update_module_status',
      adminId: adminUser.id,
      moduleId,
      status
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to update module status', {
      operation: 'admin_update_module_status',
      moduleId: req.params.moduleId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update module status' });
  }
});

router.get('/modules/:moduleId/revenue', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const revenue = await AdminService.getModuleRevenue(moduleId);

    await logger.info('Admin retrieved module revenue', {
      operation: 'admin_get_module_revenue',
      adminId: adminUser.id,
      moduleId
    });

    res.json({
      success: true,
      data: revenue
    });
  } catch (error) {
    await logger.error('Failed to get module revenue', {
      operation: 'admin_get_module_revenue',
      moduleId: req.params.moduleId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get module revenue' });
  }
});

router.get('/modules/export', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, category, developer, dateRange } = req.query;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const csvData = await AdminService.exportModuleData({
      status: status as string,
      category: category as string,
      developerId: developer as string,
      dateRange: dateRange as string
    });

    await logger.info('Admin exported module data', {
      operation: 'admin_export_module_data',
      adminId: adminUser.id
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="module-data.csv"');
    res.send(csvData);
  } catch (error) {
    await logger.error('Failed to export module data', {
      operation: 'admin_export_module_data',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to export module data' });
  }
});

// Business Intelligence Routes
router.get('/business-intelligence', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dateRange, userType } = req.query;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const data = await AdminService.getBusinessIntelligence({
      dateRange: dateRange as string,
      userType: userType as string
    });

    await logger.info('Admin retrieved business intelligence data', {
      operation: 'admin_get_business_intelligence',
      adminId: adminUser.id,
      filters: req.query
    });

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    await logger.error('Failed to get business intelligence data', {
      operation: 'admin_get_business_intelligence',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get business intelligence data' });
  }
});

router.get('/business-intelligence/export', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dateRange, userType, format } = req.query;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const exportData = await AdminService.exportBusinessIntelligence({
      dateRange: dateRange as string,
      userType: userType as string
    });

    await logger.info('Admin exported business intelligence data', {
      operation: 'admin_export_business_intelligence',
      adminId: adminUser.id
    });

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="business-intelligence-report.pdf"');
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="business-intelligence-report.csv"');
    }
    
    res.send(exportData);
  } catch (error) {
    await logger.error('Failed to export business intelligence data', {
      operation: 'admin_export_business_intelligence',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to export business intelligence data' });
  }
});

router.post('/business-intelligence/ab-tests', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const testData = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.createABTest(testData, adminUser.id);

    await logger.info('Admin created A/B test', {
      operation: 'admin_create_ab_test',
      adminId: adminUser.id,
      testName: testData.name
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to create A/B test', {
      operation: 'admin_create_ab_test',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to create A/B test' });
  }
});

router.get('/business-intelligence/ab-tests/:testId/results', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const results = await AdminService.getABTestResults(testId);

    await logger.info('Admin retrieved A/B test results', {
      operation: 'admin_get_ab_test_results',
      adminId: adminUser.id,
      testId
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    await logger.error('Failed to get A/B test results', {
      operation: 'admin_get_ab_test_results',
      testId: req.params.testId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get A/B test results' });
  }
});

router.patch('/business-intelligence/ab-tests/:testId', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const updates = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.updateABTest(testId, updates, adminUser.id);

    await logger.info('Admin updated A/B test', {
      operation: 'admin_update_ab_test',
      adminId: adminUser.id,
      testId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to update A/B test', {
      operation: 'admin_update_ab_test',
      testId: req.params.testId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update A/B test' });
  }
});

router.get('/business-intelligence/user-segments', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const segments = await AdminService.getUserSegments();

    await logger.info('Admin retrieved user segments', {
      operation: 'admin_get_user_segments',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: segments
    });
  } catch (error) {
    await logger.error('Failed to get user segments', {
      operation: 'admin_get_user_segments',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get user segments' });
  }
});

router.post('/business-intelligence/user-segments', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const segmentData = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.createUserSegment(segmentData, adminUser.id);

    await logger.info('Admin created user segment', {
      operation: 'admin_create_user_segment',
      adminId: adminUser.id,
      segmentName: segmentData.name
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to create user segment', {
      operation: 'admin_create_user_segment',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to create user segment' });
  }
});

router.get('/business-intelligence/predictive-insights', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const insights = await AdminService.getPredictiveInsights();

    await logger.info('Admin retrieved predictive insights', {
      operation: 'admin_get_predictive_insights',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    await logger.error('Failed to get predictive insights', {
      operation: 'admin_get_predictive_insights',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get predictive insights' });
  }
});

router.get('/business-intelligence/competitive-analysis', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const analysis = await AdminService.getCompetitiveAnalysis();

    await logger.info('Admin retrieved competitive analysis', {
      operation: 'admin_get_competitive_analysis',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    await logger.error('Failed to get competitive analysis', {
      operation: 'admin_get_competitive_analysis',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get competitive analysis' });
  }
});

router.post('/business-intelligence/custom-report', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const reportConfig = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const report = await AdminService.generateCustomReport(reportConfig, adminUser.id);

    await logger.info('Admin generated custom report', {
      operation: 'admin_generate_custom_report',
      adminId: adminUser.id,
      reportName: reportConfig.name
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    await logger.error('Failed to generate custom report', {
      operation: 'admin_generate_custom_report',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to generate custom report' });
  }
});

// Customer Support Routes
router.get('/support/tickets', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, priority, category, dateRange } = req.query;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const tickets = await AdminService.getSupportTickets({
      status: status as string,
      priority: priority as string,
      category: category as string,
      dateRange: dateRange as string
    });

    await logger.info('Admin retrieved support tickets', {
      operation: 'admin_get_support_tickets',
      adminId: adminUser.id,
      filters: req.query
    });

    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    await logger.error('Failed to get support tickets', {
      operation: 'admin_get_support_tickets',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get support tickets' });
  }
});

router.get('/support/stats', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const stats = await AdminService.getSupportStats();

    await logger.info('Admin retrieved support statistics', {
      operation: 'admin_get_support_stats',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    await logger.error('Failed to get support statistics', {
      operation: 'admin_get_support_stats',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get support stats' });
  }
});

router.patch('/support/tickets/:ticketId', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { action, data } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.updateSupportTicket(ticketId, action, data, adminUser.id);

    await logger.info('Admin updated support ticket', {
      operation: 'admin_update_support_ticket',
      adminId: adminUser.id,
      ticketId,
      action
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to update support ticket', {
      operation: 'admin_update_support_ticket',
      ticketId: req.params.ticketId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update support ticket' });
  }
});

router.get('/support/knowledge-base', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const articles = await AdminService.getKnowledgeBase();

    await logger.info('Admin retrieved knowledge base', {
      operation: 'admin_get_knowledge_base',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: articles
    });
  } catch (error) {
    await logger.error('Failed to get knowledge base', {
      operation: 'admin_get_knowledge_base',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get knowledge base' });
  }
});

router.patch('/support/knowledge-base/:articleId', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    const { action, data } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.updateKnowledgeArticle(articleId, action, data, adminUser.id);

    await logger.info('Admin updated knowledge article', {
      operation: 'admin_update_knowledge_article',
      adminId: adminUser.id,
      articleId,
      action
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to update knowledge article', {
      operation: 'admin_update_knowledge_article',
      articleId: req.params.articleId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update knowledge article' });
  }
});

router.get('/support/live-chats', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const chats = await AdminService.getLiveChats();

    await logger.info('Admin retrieved live chats', {
      operation: 'admin_get_live_chats',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: chats
    });
  } catch (error) {
    await logger.error('Failed to get live chats', {
      operation: 'admin_get_live_chats',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get live chats' });
  }
});

router.post('/support/live-chats/:chatId/join', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.joinLiveChat(chatId, adminUser.id);

    await logger.info('Admin joined live chat', {
      operation: 'admin_join_live_chat',
      adminId: adminUser.id,
      chatId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to join live chat', {
      operation: 'admin_join_live_chat',
      chatId: req.params.chatId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to join live chat' });
  }
});

router.get('/support/analytics', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const analytics = await AdminService.getSupportAnalytics();

    await logger.info('Admin retrieved support analytics', {
      operation: 'admin_get_support_analytics',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    await logger.error('Failed to get support analytics', {
      operation: 'admin_get_support_analytics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get support analytics' });
  }
});

router.post('/support/tickets', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const ticketData = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.createSupportTicket(ticketData, adminUser.id);

    await logger.info('Admin created support ticket', {
      operation: 'admin_create_support_ticket',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to create support ticket', {
      operation: 'admin_create_support_ticket',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

// Customer-facing support ticket creation (no authentication required)
router.post('/support/tickets/customer', async (req: Request, res: Response) => {
  try {
    const { title, description, category, priority, contactEmail, contactPhone, userId, userName } = req.body;

    // Validate required fields
    if (!title || !description || !category || !priority || !contactEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create the ticket using AdminService
    const ticketData = {
      title,
      description,
      category,
      priority,
      status: 'open',
      customerId: userId || null,
      customerEmail: contactEmail,
      customerPhone: contactPhone,
      customerName: userName || 'Anonymous',
    };

    const result = await AdminService.createSupportTicket(ticketData);

    await logger.info('Customer support ticket created', {
      operation: 'customer_create_support_ticket',
      ticketId: (result as any).id
    });

    res.json({
      success: true,
      data: {
        ticketId: (result as any).id,
        message: 'Support ticket created successfully'
      }
    });
  } catch (error) {
    await logger.error('Failed to create customer support ticket', {
      operation: 'customer_create_support_ticket',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

router.post('/support/knowledge-base', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const articleData = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.createKnowledgeArticle(articleData, adminUser.id);

    await logger.info('Admin created knowledge article', {
      operation: 'admin_create_knowledge_article',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to create knowledge article', {
      operation: 'admin_create_knowledge_article',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to create knowledge article' });
  }
});

router.get('/support/export', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, priority, category, dateRange, format } = req.query;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const exportData = await AdminService.exportSupportData({
      status: status as string,
      priority: priority as string,
      category: category as string,
      dateRange: dateRange as string
    });

    await logger.info('Admin exported support data', {
      operation: 'admin_export_support_data',
      adminId: adminUser.id
    });

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="support-report.pdf"');
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="support-report.csv"');
    }
    
    res.send(exportData);
  } catch (error) {
    await logger.error('Failed to export support data', {
      operation: 'admin_export_support_data',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to export support data' });
  }
});

// Performance & Scalability Routes
router.get('/performance/metrics', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { timeRange, metricType } = req.query;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const metrics = await AdminService.getPerformanceMetrics({
      timeRange: timeRange as string,
      metricType: metricType as string
    });

    await logger.info('Admin retrieved performance metrics', {
      operation: 'admin_get_performance_metrics',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    await logger.error('Failed to get performance metrics', {
      operation: 'admin_get_performance_metrics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

router.get('/performance/scalability', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const scalability = await AdminService.getScalabilityMetrics();

    await logger.info('Admin retrieved scalability metrics', {
      operation: 'admin_get_scalability_metrics',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: scalability
    });
  } catch (error) {
    await logger.error('Failed to get scalability metrics', {
      operation: 'admin_get_scalability_metrics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get scalability metrics' });
  }
});

router.get('/performance/optimization', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const recommendations = await AdminService.getOptimizationRecommendations();

    await logger.info('Admin retrieved optimization recommendations', {
      operation: 'admin_get_optimization_recommendations',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    await logger.error('Failed to get optimization recommendations', {
      operation: 'admin_get_optimization_recommendations',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get optimization recommendations' });
  }
});

router.patch('/performance/optimization/:recommendationId', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { recommendationId } = req.params;
    const { action } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.updateOptimizationRecommendation(recommendationId, action, adminUser.id);

    await logger.info('Admin updated optimization recommendation', {
      operation: 'admin_update_optimization_recommendation',
      adminId: adminUser.id,
      recommendationId,
      action
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to update optimization recommendation', {
      operation: 'admin_update_optimization_recommendation',
      recommendationId: req.params.recommendationId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update optimization recommendation' });
  }
});

router.get('/performance/alerts', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { severity, status } = req.query;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const alerts = await AdminService.getPerformanceAlerts({
      severity: severity as string,
      status: status as string
    });

    await logger.info('Admin retrieved performance alerts', {
      operation: 'admin_get_performance_alerts',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    await logger.error('Failed to get performance alerts', {
      operation: 'admin_get_performance_alerts',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get performance alerts' });
  }
});

router.patch('/performance/alerts/:alertId', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { action } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.updatePerformanceAlert(alertId, action, adminUser.id);

    await logger.info('Admin updated performance alert', {
      operation: 'admin_update_performance_alert',
      adminId: adminUser.id,
      alertId,
      action
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to update performance alert', {
      operation: 'admin_update_performance_alert',
      alertId: req.params.alertId,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update performance alert' });
  }
});

router.get('/performance/analytics', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = req.user;
    
    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const analytics = await AdminService.getPerformanceAnalytics();

    await logger.info('Admin retrieved performance analytics', {
      operation: 'admin_get_performance_analytics',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    await logger.error('Failed to get performance analytics', {
      operation: 'admin_get_performance_analytics',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get performance analytics' });
  }
});

router.post('/performance/alerts/configure', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const alertConfig = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await AdminService.configurePerformanceAlert(alertConfig, adminUser.id);

    await logger.info('Admin configured performance alert', {
      operation: 'admin_configure_performance_alert',
      adminId: adminUser.id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await logger.error('Failed to configure performance alert', {
      operation: 'admin_configure_performance_alert',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to configure performance alert' });
  }
});

router.get('/performance/export', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { timeRange, metricType, format } = req.query;
    const adminUser = req.user;

    if (!adminUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const exportData = await AdminService.exportPerformanceData({
      timeRange: timeRange as string,
      metricType: metricType as string,
      format: format as string
    });

    await logger.info('Admin exported performance data', {
      operation: 'admin_export_performance_data',
      adminId: adminUser.id
    });

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="performance-report.pdf"');
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="performance-report.csv"');
    }

    res.send(exportData);
  } catch (error) {
    await logger.error('Failed to export performance data', {
      operation: 'admin_export_performance_data',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to export performance data' });
  }
});

// Security routes
router.use('/security', authenticateJWT, requireAdmin, adminSecurityRoutes);

export default router; 