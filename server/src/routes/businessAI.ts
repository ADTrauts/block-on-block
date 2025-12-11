import express from 'express';
import { PrismaClient } from '@prisma/client';
import { BusinessAIDigitalTwinService } from '../ai/enterprise/BusinessAIDigitalTwinService';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const router: express.Router = express.Router();
const businessAIService = new BusinessAIDigitalTwinService(prisma);

console.log('BusinessAI routes loaded');

// JWT Authentication middleware
function authenticateJWT(req: express.Request, res: express.Response, next: express.NextFunction) {
  console.log('BusinessAI - Authenticating request:', req.method, req.path);
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET!, (err: unknown, decoded: unknown) => {
      if (err) {
        console.log('BusinessAI - JWT verification failed:', err instanceof Error ? err.message : 'Unknown error');
        return res.sendStatus(403);
      }
      
      console.log('BusinessAI - JWT decoded successfully:', JSON.stringify(decoded, null, 2));
      
      // Store the decoded token
      (req as any).user = decoded;
      
      // Try different possible user ID fields
      const userId = (decoded as any)?.userId || (decoded as any)?.sub || (decoded as any)?.id || (decoded as any)?.user?.id;
      console.log('BusinessAI - Extracted userId:', userId);
      
      if (!userId) {
        console.log('BusinessAI - No userId found in token, available fields:', Object.keys(decoded as Record<string, unknown>));
        return res.status(400).json({
          success: false,
          message: 'Invalid token: no user ID found'
        });
      }
      
      // Store the userId directly for easier access
      (req as any).userId = userId;
      
      next();
    });
  } else {
    console.log('BusinessAI - No authorization header');
    res.sendStatus(401);
  }
}

// Apply authentication to all routes
router.use(authenticateJWT);

/**
 * Initialize Business AI Digital Twin
 * POST /api/business-ai/:businessId/initialize
 */
router.post('/:businessId/initialize', async (req: express.Request, res: express.Response) => {
  console.log('BusinessAI - Initialize route hit:', req.params.businessId);
  try {
    const { businessId } = req.params;
    const userId = (req as any).userId;
    const config = req.body;

    console.log('BusinessAI - Initializing with:', { businessId, userId, config });

    const businessAI = await businessAIService.initializeBusinessAI(businessId, userId, config);

    res.json({
      success: true,
      message: 'Business AI Digital Twin initialized successfully',
      data: businessAI
    });
  } catch (error: unknown) {
    console.error('Failed to initialize business AI:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initialize business AI'
    });
  }
});

/**
 * Get Business AI Configuration
 * GET /api/business-ai/:businessId/config
 */
router.get('/:businessId/config', async (req: express.Request, res: express.Response) => {
  console.log('BusinessAI - Config route hit:', req.params.businessId);
  try {
    const { businessId } = req.params;
    const userId = (req as any).userId;

    const businessAI = await prisma.businessAIDigitalTwin.findUnique({
      where: { businessId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            industry: true
          }
        }
      }
    });

    if (!businessAI) {
      return res.status(404).json({
        success: false,
        message: 'Business AI not found'
      });
    }

    // Check if user has access (admin or employee)
    const member = await prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true }
    });

    if (!member) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Return appropriate data based on user role
    const isAdmin = businessAI.adminUsers.includes(userId) || member.role === 'ADMIN';
    
    if (isAdmin) {
      // Full configuration for admins
      res.json({
        success: true,
        data: businessAI
      });
    } else {
      // Limited data for employees
      res.json({
        success: true,
        data: {
          id: businessAI.id,
          name: businessAI.name,
          description: businessAI.description,
          capabilities: businessAI.capabilities,
          status: businessAI.status,
          allowEmployeeInteraction: businessAI.allowEmployeeInteraction
        }
      });
    }
  } catch (error: unknown) {
    console.error('Failed to get business AI config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get business AI configuration'
    });
  }
});

/**
 * Update Business AI Configuration (Admin only)
 * PUT /api/business-ai/:businessId/config
 */
router.put('/:businessId/config', async (req: express.Request, res: express.Response) => {
  try {
    const { businessId } = req.params;
    const userId = (req as any).userId;
    const settings = req.body;

    await businessAIService.updateBusinessAIControls(businessId, userId, settings);

    res.json({
      success: true,
      message: 'Business AI configuration updated successfully'
    });
  } catch (error: unknown) {
    console.error('Failed to update business AI config:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update business AI configuration'
    });
  }
});

/**
 * Employee AI Interaction
 * POST /api/business-ai/:businessId/interact
 */
router.post('/:businessId/interact', async (req: express.Request, res: express.Response) => {
  try {
    const { businessId } = req.params;
    const userId = (req as any).userId;
    const { query, context } = req.body;

    if (!query || !context) {
      return res.status(400).json({
        success: false,
        message: 'Query and context are required'
      });
    }

    const response = await businessAIService.processEmployeeInteraction(
      businessId,
      userId,
      query,
      context
    );

    res.json({
      success: true,
      data: response
    });
  } catch (error: unknown) {
    console.error('Business AI interaction failed:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'AI interaction failed'
    });
  }
});

/**
 * Get Employee AI Access Information
 * GET /api/business-ai/:businessId/employee-access
 */
router.get('/:businessId/employee-access', async (req: express.Request, res: express.Response) => {
  try {
    const { businessId } = req.params;
    const userId = (req as any).userId;

    // Check if user is business member
    const member = await prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
      include: {
        job: {
          include: {
            department: true
          }
        }
      }
    });

    if (!member) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get business AI
    const businessAI = await prisma.businessAIDigitalTwin.findUnique({
      where: { businessId }
    });

    if (!businessAI) {
      return res.status(404).json({
        success: false,
        message: 'Business AI not found'
      });
    }

    // Get allowed capabilities based on role
    const allowedCapabilities = await getEmployeeAICapabilities(member, businessAI);

    res.json({
      success: true,
      data: {
        businessAI: {
          id: businessAI.id,
          name: businessAI.name,
          description: businessAI.description,
          securityLevel: businessAI.securityLevel,
          allowEmployeeInteraction: businessAI.allowEmployeeInteraction
        },
        allowedCapabilities,
        userContext: {
          role: member.role,
          title: member.title,
          department: member.job?.department?.name,
          permissions: member.job?.permissions || {}
        }
      }
    });
  } catch (error: unknown) {
    console.error('Failed to get employee AI access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI access information'
    });
  }
});

/**
 * Get Business AI Analytics (Admin only)
 * GET /api/business-ai/:businessId/analytics
 */
router.get('/:businessId/analytics', async (req: express.Request, res: express.Response) => {
  try {
    const { businessId } = req.params;
    const userId = (req as any).userId;
    const { period = 'daily' } = req.query;

    // Validate admin access
    const businessAI = await prisma.businessAIDigitalTwin.findUnique({
      where: { businessId }
    });

    if (!businessAI) {
      return res.status(404).json({
        success: false,
        message: 'Business AI not found'
      });
    }

    const isAdmin = businessAI.adminUsers.includes(userId);
    const member = await prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true, role: 'ADMIN' }
    });

    if (!isAdmin && !member) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const analytics = await businessAIService.getBusinessAIAnalytics(
      businessId, 
      period as 'daily' | 'weekly' | 'monthly'
    );

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: unknown) {
    console.error('Failed to get business AI analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics'
    });
  }
});

/**
 * Get Business AI Learning Events (Admin only)
 * GET /api/business-ai/:businessId/learning-events
 */
router.get('/:businessId/learning-events', async (req: express.Request, res: express.Response) => {
  try {
    const { businessId } = req.params;
    const userId = (req as any).user.userId;
    const { status, limit = 50 } = req.query;

    // Validate admin access
    const businessAI = await prisma.businessAIDigitalTwin.findUnique({
      where: { businessId }
    });

    if (!businessAI) {
      return res.status(404).json({
        success: false,
        message: 'Business AI not found'
      });
    }

    const isAdmin = businessAI.adminUsers.includes(userId);
    const member = await prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true, role: 'ADMIN' }
    });

    if (!isAdmin && !member) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Build query filters
    const where: any = { businessAIId: businessAI.id };
    if (status === 'pending') {
      where.requiresApproval = true;
      where.approved = false;
    } else if (status === 'approved') {
      where.approved = true;
    }

    const learningEvents = await prisma.businessAILearningEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      include: {
        businessAI: {
          select: { name: true }
        }
      }
    });

    res.json({
      success: true,
      data: learningEvents
    });
  } catch (error: unknown) {
    console.error('Failed to get learning events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get learning events'
    });
  }
});

/**
 * Get Centralized Learning Insights (Admin only)
 * GET /api/business-ai/:businessId/centralized-insights
 */
router.get('/:businessId/centralized-insights', async (req: express.Request, res: express.Response) => {
  try {
    const { businessId } = req.params;
    const userId = (req as any).user.userId;

    // Validate admin access
    const businessAI = await prisma.businessAIDigitalTwin.findUnique({
      where: { businessId }
    });

    if (!businessAI) {
      return res.status(404).json({
        success: false,
        message: 'Business AI not found'
      });
    }

    const isAdmin = businessAI.adminUsers.includes(userId);
    const member = await prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true, role: 'ADMIN' }
    });

    if (!isAdmin && !member) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const insights = await businessAIService.getCentralizedInsights(businessId);

    res.json({
      success: true,
      data: insights
    });
  } catch (error: unknown) {
    console.error('Failed to get centralized insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get centralized insights'
    });
  }
});

/**
 * Approve/Reject Learning Event (Admin only)
 * PUT /api/business-ai/:businessId/learning-events/:eventId/review
 */
router.put('/:businessId/learning-events/:eventId/review', async (req: express.Request, res: express.Response) => {
  try {
    const { businessId, eventId } = req.params;
    const userId = (req as any).user.userId;
    const { approved, rejectionReason } = req.body;

    // Validate admin access
    const businessAI = await prisma.businessAIDigitalTwin.findUnique({
      where: { businessId }
    });

    if (!businessAI) {
      return res.status(404).json({
        success: false,
        message: 'Business AI not found'
      });
    }

    const isAdmin = businessAI.adminUsers.includes(userId);
    const member = await prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true, role: 'ADMIN' }
    });

    if (!isAdmin && !member) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Update learning event
    const updatedEvent = await prisma.businessAILearningEvent.update({
      where: { id: eventId },
      data: {
        approved: approved === true,
        approvedBy: approved === true ? userId : null,
        approvedAt: approved === true ? new Date() : null,
        rejectionReason: approved === false ? rejectionReason : null,
        updatedAt: new Date()
      }
    });

    // Log the review action
    await prisma.auditLog.create({
      data: {
        action: `BUSINESS_AI_LEARNING_EVENT_${approved ? 'APPROVED' : 'REJECTED'}`,
        userId,
        resourceType: 'BUSINESS_AI_LEARNING',
        resourceId: eventId,
        details: JSON.stringify({
          businessId,
          eventId,
          approved,
          rejectionReason,
          timestamp: new Date()
        })
      }
    });

    res.json({
      success: true,
      message: `Learning event ${approved ? 'approved' : 'rejected'} successfully`,
      data: updatedEvent
    });
  } catch (error: unknown) {
    console.error('Failed to review learning event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review learning event'
    });
  }
});

// Capability definitions with metadata for UI
interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  iconName: string;
  roles: ('EMPLOYEE' | 'MANAGER' | 'ADMIN')[];
}

const CAPABILITY_DEFINITIONS: Record<string, CapabilityDefinition> = {
  employeeAssistance: {
    id: 'employeeAssistance',
    name: 'Employee Assistance',
    description: 'General employee support and guidance',
    iconName: 'brain',
    roles: ['EMPLOYEE', 'MANAGER', 'ADMIN']
  },
  documentAnalysis: {
    id: 'documentAnalysis',
    name: 'Document Analysis',
    description: 'Analyze and summarize documents',
    iconName: 'file-text',
    roles: ['EMPLOYEE', 'MANAGER', 'ADMIN']
  },
  emailDrafting: {
    id: 'emailDrafting',
    name: 'Email Drafting',
    description: 'Help draft professional emails',
    iconName: 'mail',
    roles: ['EMPLOYEE', 'MANAGER', 'ADMIN']
  },
  workflowOptimization: {
    id: 'workflowOptimization',
    name: 'Workflow Optimization',
    description: 'Suggest process improvements',
    iconName: 'trending-up',
    roles: ['MANAGER', 'ADMIN']
  },
  dataAnalysis: {
    id: 'dataAnalysis',
    name: 'Data Analysis',
    description: 'Analyze business data and trends',
    iconName: 'bar-chart-3',
    roles: ['MANAGER', 'ADMIN']
  },
  projectManagement: {
    id: 'projectManagement',
    name: 'Project Management',
    description: 'Assist with project planning and tracking',
    iconName: 'calendar',
    roles: ['MANAGER', 'ADMIN']
  },
  complianceMonitoring: {
    id: 'complianceMonitoring',
    name: 'Compliance Monitoring',
    description: 'Monitor for compliance issues',
    iconName: 'shield',
    roles: ['ADMIN']
  },
  predictiveAnalytics: {
    id: 'predictiveAnalytics',
    name: 'Predictive Analytics',
    description: 'Advanced analytics and predictions',
    iconName: 'trending-up',
    roles: ['ADMIN']
  }
};

// Helper function to determine employee AI capabilities
// Returns array format for frontend consumption
async function getEmployeeAICapabilities(member: any, businessAI: any): Promise<Array<{
  id: string;
  name: string;
  description: string;
  iconName: string;
  enabled: boolean;
}>> {
  const baseCapabilities = businessAI.capabilities || {};
  const memberRole = member.role || 'EMPLOYEE';
  
  // Map role string to enum
  const roleEnum = memberRole === 'ADMIN' ? 'ADMIN' : 
                   memberRole === 'MANAGER' ? 'MANAGER' : 
                   'EMPLOYEE';
  
  // Build array of allowed capabilities
  const allowedCapabilities: Array<{
    id: string;
    name: string;
    description: string;
    iconName: string;
    enabled: boolean;
  }> = [];
  
  // Iterate through all capability definitions
  for (const [key, definition] of Object.entries(CAPABILITY_DEFINITIONS)) {
    // Check if user's role has access to this capability
    const hasRoleAccess = definition.roles.includes(roleEnum);
    
    // Check if capability is enabled in business AI config
    const isEnabled = baseCapabilities[key] === true;
    
    // Only include if both role has access AND capability is enabled
    if (hasRoleAccess && isEnabled) {
      allowedCapabilities.push({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        iconName: definition.iconName,
        enabled: true
      });
    }
  }
  
  return allowedCapabilities;
}

export default router;
