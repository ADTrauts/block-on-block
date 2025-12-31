import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Request type definitions
interface CreateInstitutionRequest {
  name: string;
  type: 'UNIVERSITY' | 'COLLEGE' | 'HIGH_SCHOOL' | 'ELEMENTARY_SCHOOL';
  country: string;
  state?: string;
  city?: string;
  website?: string;
  email?: string;
  phone?: string;
  description?: string;
}

interface InviteMemberRequest {
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'STAFF';
  title?: string;
  department?: string;
}

import { AuthenticatedRequest } from '../middleware/auth';

// Helper function to get user from request
const getUserFromRequest = (req: Request) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return null;
  
  return {
    ...user,
    id: user.id
  };
};

// Helper function to handle errors
const handleError = (res: Response, error: any, message: string = 'Internal server error') => {
  console.error('Educational Controller Error:', error);
  res.status(500).json({ success: false, error: message });
};

// Create a new educational institution
export const createInstitution = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const institutionData: CreateInstitutionRequest = req.body;

    // Create institution and add user as faculty/staff
    const institution = await prisma.educationalInstitution.create({
      data: {
        ...institutionData,
        members: {
          create: {
            userId: user.id,
            role: 'FACULTY',
            title: 'Administrator',
            department: 'Administration',
            canInvite: true,
            canManage: true
          }
        },
        dashboards: {
          create: {
            userId: user.id,
            name: `${institutionData.name} Dashboard`
          }
        }
      },
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

    res.status(201).json({ success: true, data: institution });
  } catch (error) {
    handleError(res, error, 'Failed to create educational institution');
  }
};

// Get user's educational institutions
export const getUserInstitutions = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const institutions = await prisma.educationalInstitution.findMany({
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

    res.json({ success: true, data: institutions });
  } catch (error) {
    handleError(res, error, 'Failed to fetch educational institutions');
  }
};

// Get institution details
export const getInstitution = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;

    const institution = await prisma.educationalInstitution.findFirst({
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
        }
      }
    });

    if (!institution) {
      return res.status(404).json({ success: false, error: 'Educational institution not found' });
    }

    res.json({ success: true, data: institution });
  } catch (error) {
    handleError(res, error, 'Failed to fetch educational institution');
  }
};

// Invite member to institution
export const inviteMember = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { institutionId } = req.params;
    const inviteData: InviteMemberRequest = req.body;

    // Check if user has permission to invite
    const userMembership = await prisma.institutionMember.findFirst({
      where: {
        institutionId,
        userId: user.id,
        isActive: true,
        canInvite: true
      }
    });

    if (!userMembership) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Check if user is already a member
    const existingMember = await prisma.institutionMember.findFirst({
      where: {
        institutionId,
        user: {
          email: inviteData.email
        },
        isActive: true
      }
    });

    if (existingMember) {
      return res.status(400).json({ success: false, error: 'User is already a member' });
    }

    // Create invitation
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.institutionInvitation.create({
      data: {
        institutionId,
        email: inviteData.email,
        role: inviteData.role,
        title: inviteData.title,
        department: inviteData.department,
        invitedById: user.id,
        token,
        expiresAt
      }
    });

    // TODO: Send invitation email
    // await sendInstitutionInvitationEmail(invitation);

    res.status(201).json({ success: true, data: invitation });
  } catch (error) {
    handleError(res, error, 'Failed to invite member');
  }
};

// Accept institution invitation
export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { token } = req.params;

    const invitation = await prisma.institutionInvitation.findUnique({
      where: { token },
      include: {
        institution: true
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
    const existingMember = await prisma.institutionMember.findFirst({
      where: {
        institutionId: invitation.institutionId,
        userId: user.id,
        isActive: true
      }
    });

    if (existingMember) {
      return res.status(400).json({ success: false, error: 'Already a member of this institution' });
    }

    // Create institution member and dashboard
    const [member, dashboard] = await prisma.$transaction([
      prisma.institutionMember.create({
        data: {
          institutionId: invitation.institutionId,
          userId: user.id,
          role: invitation.role,
          title: invitation.title,
          department: invitation.department,
          canInvite: invitation.role === 'FACULTY' || invitation.role === 'STAFF',
          canManage: invitation.role === 'FACULTY'
        },
        include: {
          institution: true,
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
          institutionId: invitation.institutionId,
          name: `${invitation.institution.name} Dashboard`
        }
      }),
      prisma.institutionInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() }
      })
    ]);

    res.json({ success: true, data: { member, dashboard } });
  } catch (error) {
    handleError(res, error, 'Failed to accept invitation');
  }
}; 