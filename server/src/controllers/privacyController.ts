import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper function to get user from request
const getUserFromRequest = (req: Request) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return null;
  return user;
};

// Get user privacy settings
export const getUserPrivacySettings = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    let settings = await prisma.userPrivacySettings.findUnique({
      where: { userId: user.id }
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.userPrivacySettings.create({
        data: {
          userId: user.id,
          profileVisibility: 'PUBLIC',
          activityVisibility: 'PUBLIC',
          allowDataProcessing: true,
          allowMarketingEmails: false,
          allowAnalytics: true,
          allowAuditLogs: true,
          dataRetentionPeriod: 2555 // 7 years
        }
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting user privacy settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get privacy settings' });
  }
};

// Update user privacy settings
export const updateUserPrivacySettings = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      profileVisibility,
      activityVisibility,
      allowDataProcessing,
      allowMarketingEmails,
      allowAnalytics,
      allowAuditLogs,
      dataRetentionPeriod
    } = req.body;

    const settings = await prisma.userPrivacySettings.upsert({
      where: { userId: user.id },
      update: {
        profileVisibility,
        activityVisibility,
        allowDataProcessing,
        allowMarketingEmails,
        allowAnalytics,
        allowAuditLogs,
        dataRetentionPeriod
      },
      create: {
        userId: user.id,
        profileVisibility: profileVisibility || 'PUBLIC',
        activityVisibility: activityVisibility || 'PUBLIC',
        allowDataProcessing: allowDataProcessing !== undefined ? allowDataProcessing : true,
        allowMarketingEmails: allowMarketingEmails !== undefined ? allowMarketingEmails : false,
        allowAnalytics: allowAnalytics !== undefined ? allowAnalytics : true,
        allowAuditLogs: allowAuditLogs !== undefined ? allowAuditLogs : true,
        dataRetentionPeriod: dataRetentionPeriod || 2555
      }
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error updating user privacy settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update privacy settings' });
  }
};

// Get user consent history
export const getUserConsents = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const consents = await prisma.userConsent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: consents
    });
  } catch (error) {
    console.error('Error getting user consents:', error);
    res.status(500).json({ success: false, error: 'Failed to get consent history' });
  }
};

// Grant consent
export const grantConsent = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { consentType, version } = req.body;

    if (!consentType || !version) {
      return res.status(400).json({ success: false, error: 'Consent type and version are required' });
    }

    const consent = await prisma.userConsent.upsert({
      where: {
        userId_consentType_version: {
          userId: user.id,
          consentType,
          version
        }
      },
      update: {
        granted: true,
        grantedAt: new Date(),
        revokedAt: null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      create: {
        userId: user.id,
        consentType,
        version,
        granted: true,
        grantedAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      success: true,
      data: consent
    });
  } catch (error) {
    console.error('Error granting consent:', error);
    res.status(500).json({ success: false, error: 'Failed to grant consent' });
  }
};

// Revoke consent
export const revokeConsent = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { consentType, version } = req.body;

    if (!consentType || !version) {
      return res.status(400).json({ success: false, error: 'Consent type and version are required' });
    }

    const consent = await prisma.userConsent.update({
      where: {
        userId_consentType_version: {
          userId: user.id,
          consentType,
          version
        }
      },
      data: {
        granted: false,
        revokedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: consent
    });
  } catch (error) {
    console.error('Error revoking consent:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke consent' });
  }
};

// Request data deletion
export const requestDataDeletion = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { reason } = req.body;

    // Check if user already has a pending request
    const existingRequest = await prisma.dataDeletionRequest.findFirst({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'PROCESSING'] }
      }
    });

    if (existingRequest) {
      return res.status(400).json({ 
        success: false, 
        error: 'You already have a pending data deletion request' 
      });
    }

    const deletionRequest = await prisma.dataDeletionRequest.create({
      data: {
        userId: user.id,
        reason,
        status: 'PENDING'
      }
    });

    res.json({
      success: true,
      data: deletionRequest
    });
  } catch (error) {
    console.error('Error requesting data deletion:', error);
    res.status(500).json({ success: false, error: 'Failed to request data deletion' });
  }
};

// Get user's data deletion requests
export const getUserDeletionRequests = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const requests = await prisma.dataDeletionRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error getting user deletion requests:', error);
    res.status(500).json({ success: false, error: 'Failed to get deletion requests' });
  }
};

// Export user data (GDPR right to data portability)
export const exportUserData = async (req: Request, res: Response) => {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get all user data
    const [userData, files, conversations, dashboards, modules, auditLogs, consents, privacySettings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.file.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          size: true,
          type: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              userId: user.id
            }
          }
        },
        select: {
          id: true,
          name: true,
          type: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.dashboard.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.moduleInstallation.findMany({
        where: { userId: user.id },
        include: {
          module: {
            select: {
              id: true,
              name: true,
              description: true,
              version: true
            }
          }
        }
      }),
      prisma.auditLog.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          timestamp: true
        }
      }),
      prisma.userConsent.findMany({
        where: { userId: user.id }
      }),
      prisma.userPrivacySettings.findUnique({
        where: { userId: user.id }
      })
    ]);

    const exportData = {
      user: userData,
      files,
      conversations,
      dashboards,
      modules,
      auditLogs,
      consents,
      privacySettings,
      exportedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ success: false, error: 'Failed to export user data' });
  }
}; 