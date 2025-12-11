import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotificationService } from '../services/notificationService';
import { sendBusinessInvitationEmail } from '../services/emailService';
import { addUsersToScheduleCalendar } from '../services/hrScheduleService';

// Request type definitions
interface CreateBusinessRequest {
  name: string;
  ein: string;
  industry?: string;
  size?: string;
  website?: string;
  address?: Record<string, unknown>;
  phone?: string;
  email?: string;
  description?: string;
}

interface UpdateBusinessRequest {
  name?: string;
  industry?: string;
  size?: string;
  website?: string;
  address?: Record<string, unknown>;
  phone?: string;
  email?: string;
  description?: string;
  branding?: Record<string, unknown>;
  schedulingMode?: string;
  schedulingStrategy?: string;
  schedulingConfig?: Record<string, unknown>;
}

interface InviteMemberRequest {
  email: string;
  role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
  title?: string;
  department?: string;
}

interface UpdateMemberRequest {
  role?: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
  title?: string;
  department?: string;
  canInvite?: boolean;
  canManage?: boolean;
  canBilling?: boolean;
}

// Helper function to get user from request
const getUserFromRequest = (req: Request) => {
  const user = (req as any).user;
  if (!user) return null;
  
  return {
    ...user,
    id: user.sub || user.id
  };
};

// Helper function to handle errors
const handleError = (res: Response, error: unknown, message: string = 'Internal server error') => {
  const err = error as Error;
  console.error('Business Controller Error:', error);
  res.status(500).json({ success: false, error: message });
};

// Create a new business
export const createBusiness = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const businessData: CreateBusinessRequest = req.body;

    // Check if EIN already exists
    const existingBusiness = await prisma.business.findUnique({
      where: { ein: businessData.ein }
    });

    if (existingBusiness) {
      return res.status(400).json({ success: false, error: 'Business with this EIN already exists' });
    }

    // Create business and add user as owner
    const business = await prisma.business.create({
      data: {
        ...businessData,
        members: {
          create: {
            userId: user.id,
            role: 'ADMIN',
            title: 'Owner',
            canInvite: true,
            canManage: true,
            canBilling: true
          }
        },
        dashboards: {
          create: {
            userId: user.id,
            name: `${businessData.name} Dashboard`
          }
        }
      } as any,
      include: {
        members: {
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
        dashboards: true
      }
    });

    // Auto-provision business calendar named after tab (business name)
    try {
      await prisma.calendar.create({
        data: {
          name: businessData.name,
          contextType: 'BUSINESS',
          contextId: business.id,
          isPrimary: true,
          isSystem: false,
          isDeletable: true,
          defaultReminderMinutes: 10,
          members: { create: { userId: user.id, role: 'OWNER' } }
        }
      });
    } catch (e) {
      console.error('Failed to auto-provision business calendar:', e);
    }

    // Auto-install core business modules (Drive, Chat, Calendar)
    // These are the foundational modules every business needs
    const coreModules = [
      {
        moduleId: 'drive',
        name: 'Drive',
        category: 'PRODUCTIVITY',
        description: 'File management and storage system',
        version: '1.0.0'
      },
      {
        moduleId: 'chat',
        name: 'Chat',
        category: 'COMMUNICATION',
        description: 'Real-time messaging and communication',
        version: '1.0.0'
      },
      {
        moduleId: 'calendar',
        name: 'Calendar',
        category: 'PRODUCTIVITY',
        description: 'Calendar and scheduling system',
        version: '1.0.0'
      }
    ];

    try {
      console.log(`🔧 Auto-installing core modules for business: ${business.id}`);
      
      for (const { moduleId, name, category, description, version } of coreModules) {
        // STEP 1: Ensure Module record exists (create if needed)
        let module = await prisma.module.findUnique({
          where: { id: moduleId }
        });

        if (!module) {
          console.log(`   📝 Creating Module record for ${name}...`);
          module = await prisma.module.create({
            data: {
              id: moduleId,
              name: name,
              description: description,
              version: version,
              category: category as any,
              tags: [moduleId, 'core', 'proprietary'],
              icon: moduleId,
              screenshots: [],
              developerId: user.id,
              manifest: {
                name,
                version,
                description,
                author: 'Vssyl',
                license: 'proprietary',
                entryPoint: `/${moduleId}`,
                permissions: [`${moduleId}:read`, `${moduleId}:write`],
                dependencies: [],
                runtime: { apiVersion: '1.0' },
                frontend: { entryUrl: `/${moduleId}` },
                settings: {}
              } as any,
              dependencies: [],
              permissions: [`${moduleId}:read`, `${moduleId}:write`],
              status: 'APPROVED' as any,
              pricingTier: 'free',
              basePrice: 0,
              enterprisePrice: 0,
              isProprietary: true,
              revenueSplit: 0,
              downloads: 0,
              rating: 5.0,
              reviewCount: 0
            }
          });
          console.log(`   ✅ Created Module record for ${name}`);
        }

        // STEP 2: Check if already installed for this business
        const existingInstallation = await prisma.businessModuleInstallation.findFirst({
          where: {
            businessId: business.id,
            moduleId: moduleId
          }
        });

        if (!existingInstallation) {
          await prisma.businessModuleInstallation.create({
            data: {
              businessId: business.id,
              moduleId: moduleId,
              installedBy: user.id,
              installedAt: new Date(),
              enabled: true,
              configured: {
                permissions: ['view', 'create', 'edit', 'delete']
              }
            }
          });
          console.log(`   ✅ Installed core module: ${name} (${moduleId})`);
        } else {
          console.log(`   ℹ️  Core module already installed: ${name} (${moduleId})`);
        }
      }
      
      console.log(`✅ Core modules installed for business: ${business.name}`);
    } catch (moduleError) {
      // Don't fail business creation if module installation fails
      console.error('❌ Failed to auto-install core modules:', moduleError);
      console.error('Business creation succeeded, but module installation failed. Admin can manually install modules.');
    }

    res.status(201).json({ success: true, data: business });
  } catch (error) {
    handleError(res, error, 'Failed to create business');
  }
};

// Get user's businesses
export const getUserBusinesses = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const businesses = await prisma.business.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
            isActive: true
          }
        }
      },
      include: {
        members: {
          where: {
            isActive: true
          },
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
        dashboards: {
          where: {
            userId: user.id
          }
        },
        subscriptions: {
          where: {
            status: 'active'
          },
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            id: true,
            tier: true,
            status: true
          }
        },
        _count: {
          select: {
            members: {
              where: {
                isActive: true
              }
            }
          }
        }
      }
    });

    res.json({ success: true, data: businesses });
  } catch (error) {
    handleError(res, error, 'Failed to fetch businesses');
  }
};

// Get business details
export const getBusiness = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    const business = await prisma.business.findFirst({
      where: {
        id,
        members: {
          some: {
            userId: user.id,
            isActive: true
          }
        }
      },
      include: {
        members: {
          where: {
            isActive: true
          },
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
        dashboards: {
          where: {
            userId: user.id
          }
        },
        subscriptions: {
          where: {
            status: 'active'
          },
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            id: true,
            tier: true,
            status: true
          }
        }
      }
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    res.json({ success: true, data: business });
  } catch (error) {
    handleError(res, error, 'Failed to fetch business');
  }
};

// Invite member to business
export const inviteMember = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { businessId } = req.params;
    const inviteData: InviteMemberRequest = req.body;

    // Check if user has permission to invite
    const userMembership = await prisma.businessMember.findFirst({
      where: {
        businessId,
        userId: user.id,
        isActive: true,
        canInvite: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Check if user is already a member
    const existingMember = await prisma.businessMember.findFirst({
      where: {
        businessId,
        user: {
          email: inviteData.email
        },
        isActive: true
      }
    });

    if (existingMember) {
      return res.status(400).json({ success: false, error: 'User is already a member' });
    }

    // Get business info for notification
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        members: {
          where: { userId: user.id },
          select: { role: true, title: true }
        }
      }
    });

    // Create invitation
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.businessInvitation.create({
      data: {
        businessId,
        email: inviteData.email,
        role: inviteData.role,
        title: inviteData.title,
        department: inviteData.department,
        invitedById: user.id,
        token,
        expiresAt
      }
    });

    // Send invitation email with Block ID
    try {
      await sendBusinessInvitationEmail(
        invitation.email,
        business?.name || 'Business',
        user.name || 'Team Member',
        invitation.role,
        invitation.title,
        invitation.department,
        invitation.token,
        undefined, // message
        user.userNumber // Include inviter's Block ID
      );
    } catch (emailError) {
      console.error('Error sending business invitation email:', emailError);
      // Don't fail the invitation if email fails
    }

    // Create notification for the invited user (if they exist in the system)
    try {
      const invitedUser = await prisma.user.findUnique({
        where: { email: inviteData.email }
      });

      if (invitedUser) {
        await NotificationService.handleNotification({
          type: 'business_invitation',
          title: `You've been invited to join ${business?.name}`,
          body: `${user.name} invited you to join as ${inviteData.role.toLowerCase()}`,
          data: {
            businessId,
            businessName: business?.name,
            invitationId: invitation.id,
            role: inviteData.role,
            title: inviteData.title,
            department: inviteData.department,
            invitedById: user.id,
            invitedByName: user.name
          },
          recipients: [invitedUser.id],
          senderId: user.id
        });
      }
    } catch (notificationError) {
      console.error('Error creating business invitation notification:', notificationError);
      // Don't fail the invitation if notification fails
    }

    res.status(201).json({ success: true, data: invitation });
  } catch (error) {
    handleError(res, error, 'Failed to invite member');
  }
};

// Accept business invitation
export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { token } = req.params;

    const invitation = await prisma.businessInvitation.findUnique({
      where: { token },
      include: {
        business: true
      }
    });

    if (!invitation) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Invitation has expired' });
    }

    if (invitation.acceptedAt) {
      return res.status(400).json({ success: false, error: 'Invitation already accepted' });
    }

    // Check if user is already a member
    const existingMember = await prisma.businessMember.findFirst({
      where: {
        businessId: invitation.businessId,
        userId: user.id,
        isActive: true
      }
    });

    if (existingMember) {
      return res.status(400).json({ success: false, error: 'Already a member of this business' });
    }

    // Create business member and dashboard
    const [member, dashboard] = await prisma.$transaction([
      prisma.businessMember.create({
        data: {
          businessId: invitation.businessId,
          userId: user.id,
          role: invitation.role,
          title: invitation.title,
          department: invitation.department,
          canInvite: invitation.role === 'ADMIN' || invitation.role === 'MANAGER',
          canManage: invitation.role === 'ADMIN',
          canBilling: invitation.role === 'ADMIN'
        },
        include: {
          business: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.dashboard.create({
        data: {
          userId: user.id,
          businessId: invitation.businessId,
          name: `${invitation.business.name} Dashboard`
        }
      }),
      prisma.businessInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() }
      })
    ]);

    // Ensure a primary business calendar exists for this business
    try {
      const existingCal = await prisma.calendar.findFirst({ where: { contextType: 'BUSINESS', contextId: invitation.businessId, isPrimary: true } });
      if (!existingCal) {
        await prisma.calendar.create({
          data: {
            name: invitation.business.name,
            contextType: 'BUSINESS',
            contextId: invitation.businessId,
            isPrimary: true,
            isSystem: false,
            isDeletable: true,
            defaultReminderMinutes: 10,
            members: { create: { userId: user.id, role: 'OWNER' } }
          }
        });
      } else {
        // Add the new member as at least READER
        await prisma.calendarMember.upsert({
          where: { calendarId_userId: { calendarId: existingCal.id, userId: user.id } },
          update: {},
          create: { calendarId: existingCal.id, userId: user.id, role: 'READER' }
        });
      }
    } catch (e) {
      console.error('Failed to ensure business calendar on invitation accept:', e);
    }

    try {
      await addUsersToScheduleCalendar(invitation.businessId, [user.id]);
    } catch (scheduleError) {
      console.error('Failed to add user to HR schedule calendar:', scheduleError);
    }

    res.json({ success: true, data: { member, dashboard } });
  } catch (error) {
    handleError(res, error, 'Failed to accept invitation');
  }
};

// Update business profile
export const updateBusiness = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;
    const updateData: UpdateBusinessRequest = req.body;

    // Check if user has permission to manage this business
    const userMembership = await prisma.businessMember.findFirst({
      where: {
        businessId: id,
        userId: user.id,
        isActive: true,
        canManage: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Update business
    const business = await prisma.business.update({
      where: { id },
      data: updateData as any,
      include: {
        members: {
          where: {
            isActive: true
          },
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

    res.json({ success: true, data: business });
  } catch (error) {
    handleError(res, error, 'Failed to update business');
  }
};

// Upload business logo
export const uploadLogo = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { logoUrl } = req.body;

    // Check if user has permission to manage this business
    const userMembership = await prisma.businessMember.findFirst({
      where: {
        businessId: id,
        userId: user.id,
        isActive: true,
        canManage: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Update business logo
    const business = await prisma.business.update({
      where: { id },
      data: { logo: logoUrl },
      include: {
        members: {
          where: {
            isActive: true
          },
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

    res.json({ success: true, data: business });
  } catch (error) {
    handleError(res, error, 'Failed to upload logo');
  }
};

// Remove business logo
export const removeLogo = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Check if user has permission to manage this business
    const userMembership = await prisma.businessMember.findFirst({
      where: {
        businessId: id,
        userId: user.id,
        isActive: true,
        canManage: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Remove business logo
    const business = await prisma.business.update({
      where: { id },
      data: { logo: null },
      include: {
        members: {
          where: {
            isActive: true
          },
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

    res.json({ success: true, data: business });
  } catch (error) {
    handleError(res, error, 'Failed to remove logo');
  }
};

// Get business members
export const getBusinessMembers = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Check if user is a member of this business
    const userMembership = await prisma.businessMember.findFirst({
      where: {
        businessId: id,
        userId: user.id,
        isActive: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get all members
    const members = await prisma.businessMember.findMany({
      where: {
        businessId: id,
        isActive: true
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
      orderBy: {
        joinedAt: 'asc'
      }
    });

    res.json({ success: true, data: members });
  } catch (error) {
    handleError(res, error, 'Failed to fetch members');
  }
};

// Update business member
export const updateBusinessMember = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id, userId } = req.params;
    const updateData: UpdateMemberRequest = req.body;

    // Check if user has permission to manage this business
    const userMembership = await prisma.businessMember.findFirst({
      where: {
        businessId: id,
        userId: user.id,
        isActive: true,
        canManage: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Update member
    const member = await prisma.businessMember.update({
      where: {
        businessId_userId: {
          businessId: id,
          userId
        }
      },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({ success: true, data: member });
  } catch (error) {
    handleError(res, error, 'Failed to update member');
  }
};

// Remove business member
export const removeBusinessMember = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id, userId } = req.params;

    // Check if user has permission to manage this business
    const userMembership = await prisma.businessMember.findFirst({
      where: {
        businessId: id,
        userId: user.id,
        isActive: true,
        canManage: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Prevent removing the last admin
    if (userId === user.id) {
      const adminCount = await prisma.businessMember.count({
        where: {
          businessId: id,
          role: 'ADMIN',
          isActive: true
        }
      });

      if (adminCount <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot remove the last admin' });
      }
    }

    // Remove member
    await prisma.businessMember.update({
      where: {
        businessId_userId: {
          businessId: id,
          userId
        }
      },
      data: {
        isActive: false,
        leftAt: new Date()
      }
    });

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to remove member');
  }
};

// Get business analytics
export const getBusinessAnalytics = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { timeRange = '30d' } = req.query;

    // Check if user is a member of this business
    const userMembership = await prisma.businessMember.findFirst({
      where: {
        businessId: id,
        userId: user.id,
        isActive: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get basic analytics
    const [
      memberCount,
      dashboardCount,
      fileCount,
      conversationCount,
      storageUsed
    ] = await Promise.all([
      // Member count
      prisma.businessMember.count({
        where: {
          businessId: id,
          isActive: true
        }
      }),
      // Dashboard count
      prisma.dashboard.count({
        where: {
          businessId: id
        }
      }),
      // File count
      prisma.file.count({
        where: {
          user: {
            businesses: {
              some: {
                businessId: id,
                isActive: true
              }
            }
          },
          createdAt: {
            gte: startDate
          }
        }
      }),
      // Conversation count
      prisma.conversation.count({
        where: {
          participants: {
            some: {
              user: {
                businesses: {
                  some: {
                    businessId: id,
                    isActive: true
                  }
                }
              }
            }
          },
          createdAt: {
            gte: startDate
          }
        }
      }),
      // Storage used (sum of file sizes)
      prisma.file.aggregate({
        where: {
          user: {
            businesses: {
              some: {
                businessId: id,
                isActive: true
              }
            }
          }
        },
        _sum: {
          size: true
        }
      }),

    ]);

    const analytics = {
      // Basic metrics
      memberCount,
      dashboardCount,
      fileCount,
      conversationCount,
      storageUsed: storageUsed._sum?.size || 0,
      
      // Time range
      timeRange,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    };

    res.json({ success: true, data: analytics });
  } catch (error) {
    handleError(res, error, 'Failed to fetch analytics');
  }
};

// Get business module analytics
export const getBusinessModuleAnalytics = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Check if user is a member of this business
    const userMembership = await prisma.businessMember.findFirst({
      where: {
        businessId: id,
        userId: user.id,
        isActive: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // For now, return basic module analytics without complex queries
    const analytics = {
      modules: [],
      totalModules: 0,
      totalInstallations: 0,
      activeInstallations: 0,
      memberCount: 0,
      moduleAdoptionRate: 0
    };

    res.json({ success: true, data: analytics });
  } catch (error) {
    handleError(res, error, 'Failed to fetch module analytics');
  }
};

// Get business setup status (org chart, branding, modules, AI, employees)
export const getBusinessSetupStatus = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Ensure the requester is a member of this business
    const userMembership = await prisma.businessMember.findFirst({
      where: { businessId: id, userId: user.id, isActive: true }
    });
    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const [business, orgCounts, moduleInstallCount, activeMemberCount] = await Promise.all([
      prisma.business.findUnique({
        where: { id },
        select: {
          id: true,
          logo: true,
          branding: true,
          aiSettings: true,
          aiDigitalTwin: { select: { id: true } }
        }
      }),
      prisma.$transaction([
        prisma.organizationalTier.count({ where: { businessId: id } }),
        prisma.position.count({ where: { businessId: id } })
      ]),
      (prisma as any).businessModuleInstallation.count({ where: { businessId: id } }),
      prisma.businessMember.count({ where: { businessId: id, isActive: true } })
    ]);

    const [tierCount, positionCount] = orgCounts as unknown as [number, number];

    const setup = {
      orgChart: (tierCount || 0) > 0 || (positionCount || 0) > 0,
      branding: !!(business?.logo) || !!(business?.branding && Object.keys(business.branding as Record<string, unknown>).length > 0),
      modules: (moduleInstallCount || 0) > 0,
      aiAssistant: !!business?.aiSettings || !!business?.aiDigitalTwin,
      employees: (activeMemberCount || 0) > 1 // more than just the owner/admin
    };

    return res.json({ success: true, data: setup });
  } catch (error) {
    handleError(res, error, 'Failed to get business setup status');
  }
};

// Helper function to generate activity descriptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getActivityDescription = (activity: any): string => {
  const { type, details } = activity;
  
  switch (type) {
    case 'file_created':
      return `Created ${details?.fileName || 'a file'}`;
    case 'file_edited':
      return `Edited ${details?.fileName || 'a file'}`;
    case 'file_shared':
      return `Shared ${details?.fileName || 'a file'}`;
    case 'message_sent':
      return `Sent message in ${details?.conversationName || 'a conversation'}`;
    case 'module_accessed':
      return `Accessed ${details?.moduleName || 'a module'}`;
    case 'member_joined':
      return `Joined the business`;
    case 'dashboard_created':
      return `Created a dashboard`;
    default:
      return 'Performed an action';
  }
};

// Follow a business
export const followBusiness = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { businessId } = req.params;
    // Prevent duplicate follows
    const existing = await prisma.businessFollow.findUnique({
      where: { userId_businessId: { userId: user.id, businessId } }
    });
    if (existing) {
      return res.status(200).json({ success: true, message: 'Already following' });
    }
    await prisma.businessFollow.create({
      data: { userId: user.id, businessId }
    });
    res.status(201).json({ success: true, message: 'Followed business' });
  } catch (error) {
    handleError(res, error, 'Failed to follow business');
  }
};

// Unfollow a business
export const unfollowBusiness = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { businessId } = req.params;
    await prisma.businessFollow.deleteMany({
      where: { userId: user.id, businessId }
    });
    res.json({ success: true, message: 'Unfollowed business' });
  } catch (error) {
    handleError(res, error, 'Failed to unfollow business');
  }
};

// Get followers for a business
export const getBusinessFollowers = async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    const followers = await prisma.businessFollow.findMany({
      where: { businessId },
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, followers: followers.map(f => ({
      id: f.user.id,
      name: f.user.name,
      email: f.user.email,
      followedAt: f.createdAt
    })) });
  } catch (error) {
    handleError(res, error, 'Failed to get followers');
  }
};

// Get businesses the user is following
export const getUserFollowing = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const follows = await prisma.businessFollow.findMany({
      where: { userId: user.id },
      include: {
        business: { select: { id: true, name: true, description: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, following: follows.map(f => ({
      id: f.business.id,
      name: f.business.name,
      description: f.business.description,
      followedAt: f.createdAt
    })) });
  } catch (error) {
    handleError(res, error, 'Failed to get following businesses');
  }
}; 