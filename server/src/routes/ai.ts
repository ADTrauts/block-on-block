import express from 'express';
import { DigitalLifeTwinService, AIRequest } from '../ai/core/DigitalLifeTwinService';
import { PersonalityEngine } from '../ai/core/PersonalityEngine';
import { PrismaClient } from '@prisma/client';
import { authenticateJWT } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { FeatureGatingService } from '../services/featureGatingService';
import { AIQueryService } from '../services/aiQueryService';

const router: express.Router = express.Router();
const digitalLifeTwin = new DigitalLifeTwinService(prisma);
const personalityEngine = new PersonalityEngine(prisma);

/**
 * 🚀 POST /api/ai/twin
 * Revolutionary Digital Life Twin interaction endpoint
 */
router.post('/twin', authenticateJWT, async (req, res) => {
  try {
    const { query, context = {} } = req.body;
    const userId = req.user?.id;
    const businessId = context.businessId || null;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Check AI feature access (includes query balance check)
    const featureCheck = await FeatureGatingService.checkFeatureAccess(
      userId,
      'unlimited_ai',
      businessId || undefined
    );

    if (!featureCheck.hasAccess) {
      return res.status(429).json({
        error: 'AI query limit exceeded',
        message: featureCheck.reason || 'No queries remaining',
        remaining: featureCheck.usageInfo?.remaining || 0,
      });
    }

    // Use the revolutionary Digital Life Twin Core
    const response = await digitalLifeTwin.processAsDigitalLifeTwin(
      query, 
      userId, 
      {
        currentModule: context.currentModule,
        dashboardType: context.dashboardType,
        dashboardName: context.dashboardName,
        recentActivity: context.recentActivity,
        urgency: context.urgency || 'medium'
      }
    );
    
    // Consume query (only after successful processing)
    try {
      const consumeResult = await AIQueryService.consumeQuery(userId, businessId, 1);
      if (!consumeResult.success) {
        // This shouldn't happen since we checked above, but handle gracefully
        console.warn('Query consumption failed after processing:', consumeResult.error);
      }
    } catch (consumeError) {
      // Log error but don't fail the request since processing already succeeded
      console.error('Error consuming query after processing:', consumeError);
    }

    // Save conversation to history with enhanced cross-module data
    await prisma.aIConversationHistory.create({
      data: {
        userId,
        sessionId: `session_${Date.now()}`, // Generate session ID
        interactionType: 'QUERY',
        context: JSON.parse(JSON.stringify(context)),
        userQuery: query,
        aiResponse: response.response,
        confidence: response.confidence,
        reasoning: response.reasoning || null,
        actions: JSON.parse(JSON.stringify(response.actions || [])),
        provider: response.metadata.provider,
        model: response.metadata.provider, // Will be enhanced when we connect real providers
        tokensUsed: response.metadata.processingTime, // Placeholder
        cost: 0, // Will be calculated with real providers
        processingTime: response.metadata.processingTime
      }
    });

    // Record any actions that require approval
    if (response.actions && response.actions.length > 0) {
      const actionsRequiringApproval = response.actions.filter(action => action.requiresApproval);
      
      for (const action of actionsRequiringApproval) {
        await prisma.aIApprovalRequest.create({
          data: {
            userId,
            requestType: action.type,
            actionData: JSON.parse(JSON.stringify(action.data)),
            affectedUsers: action.peopleAffected,
            reasoning: action.description,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
          }
        });
      }
    }

    // Get updated query balance for response
    const updatedAvailability = await AIQueryService.checkQueryAvailability(userId, businessId);

    res.json({
      success: true,
      data: {
        response: response.response,
        confidence: response.confidence,
        reasoning: response.reasoning,
        actions: response.actions,
        insights: response.insights,
        personalityAlignment: response.personalityAlignment,
        crossModuleConnections: response.crossModuleConnections,
        metadata: response.metadata,
        queryBalance: {
          remaining: updatedAvailability.remaining,
          isUnlimited: updatedAvailability.isUnlimited,
        }
      }
    });
  } catch (error) {
    console.error('Digital Life Twin error:', error);
    res.status(500).json({
      error: 'Failed to process Digital Life Twin request',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/ai/context
 * Get comprehensive cross-module user context
 */
router.get('/context', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const context = await digitalLifeTwin.getCrossModuleContext(userId);

    res.json({
      success: true,
      data: context
    });
  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({
      error: 'Failed to get cross-module context',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/ai/context/:module
 * Get module-specific context with cross-module intelligence
 */
router.get('/context/:module', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { module } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const moduleContext = await digitalLifeTwin.getModuleContext(userId, module);

    res.json({
      success: true,
      data: moduleContext
    });
  } catch (error) {
    console.error('Get module context error:', error);
    res.status(500).json({
      error: 'Failed to get module context',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/ai/chat
 * Legacy AI conversation endpoint (kept for backward compatibility)
 */
router.post('/chat', authenticateJWT, async (req, res) => {
  try {
    const { query, context, priority = 'medium' } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const aiRequest: AIRequest = {
      id: `ai_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      query,
      context: context || {},
      timestamp: new Date(),
      priority
    };

    const response = await digitalLifeTwin.processRequest(aiRequest);

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      error: 'Failed to process AI request',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/ai/personality
 * Get user's personality profile
 */
router.get('/personality', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const personality = await personalityEngine.getPersonalityProfile(userId);

    res.json({
      success: true,
      data: personality
    });
  } catch (error) {
    console.error('Get personality error:', error);
    res.status(500).json({
      error: 'Failed to get personality profile',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * PUT /api/ai/personality
 * Update user's personality profile
 */
router.put('/personality', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { interaction, feedback } = req.body;

    const updatedPersonality = await personalityEngine.updatePersonalityFromInteraction(
      userId,
      interaction,
      feedback
    );

    res.json({
      success: true,
      data: updatedPersonality
    });
  } catch (error) {
    console.error('Update personality error:', error);
    res.status(500).json({
      error: 'Failed to update personality profile',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/ai/autonomy
 * Get user's autonomy settings
 */
router.get('/autonomy', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const settings = await prisma.aIAutonomySettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      // Create default autonomy settings
      const defaultSettings = await prisma.aIAutonomySettings.create({
        data: {
          userId,
          scheduling: 30,
          communication: 20,
          fileManagement: 40,
          taskCreation: 30,
          dataAnalysis: 60,
          crossModuleActions: 20
        }
      });

      return res.json({
        success: true,
        data: defaultSettings
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get autonomy settings error:', error);
    res.status(500).json({
      error: 'Failed to get autonomy settings',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * PUT /api/ai/autonomy
 * Update user's autonomy settings
 */
router.put('/autonomy', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const autonomyUpdates = req.body;

    const updatedSettings = await prisma.aIAutonomySettings.upsert({
      where: { userId },
      update: autonomyUpdates,
      create: {
        userId,
        ...autonomyUpdates
      }
    });

    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    console.error('Update autonomy settings error:', error);
    res.status(500).json({
      error: 'Failed to update autonomy settings',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/ai/approvals
 * Get pending approval requests for user
 */
router.get('/approvals', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const approvals = await prisma.aIApprovalRequest.findMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: approvals
    });
  } catch (error) {
    console.error('Get approvals error:', error);
    res.status(500).json({
      error: 'Failed to get approval requests',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/ai/approvals/:id/respond
 * Respond to an approval request
 */
router.post('/approvals/:id/respond', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { response, reasoning } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!['approve', 'reject'].includes(response)) {
      return res.status(400).json({ error: 'Response must be approve or reject' });
    }

    const approval = await prisma.aIApprovalRequest.findUnique({
      where: { id }
    });

    if (!approval) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (approval.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to respond to this approval' });
    }

    // Update approval request
    const updatedApproval = await prisma.aIApprovalRequest.update({
      where: { id },
      data: {
        status: response === 'approve' ? 'APPROVED' : 'REJECTED',
        approvedBy: response === 'approve' ? userId : null,
        rejectedBy: response === 'reject' ? userId : null,
        rejectionReason: response === 'reject' ? reasoning : null,
        respondedAt: new Date(),
        responses: {
          push: {
            userId,
            response,
            reasoning,
            timestamp: new Date()
          }
        }
      }
    });

    // If approved, execute the action
    if (response === 'approve') {
      // TODO: Execute the approved action
      console.log('Action approved, executing:', approval.actionData);
    }

    res.json({
      success: true,
      data: updatedApproval
    });
  } catch (error) {
    console.error('Respond to approval error:', error);
    res.status(500).json({
      error: 'Failed to respond to approval request',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/ai/history
 * Get AI conversation history
 */
router.get('/history', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { limit = 50, offset = 0, sessionId } = req.query;

    const whereClause: Record<string, unknown> = { userId };
    if (sessionId) {
      whereClause.sessionId = sessionId;
    }

    const history = await prisma.aIConversationHistory.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get AI history error:', error);
    res.status(500).json({
      error: 'Failed to get conversation history',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/ai/feedback
 * Provide feedback on AI response
 */
router.post('/feedback', authenticateJWT, async (req, res) => {
  try {
    const { interactionId, feedback, rating } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!interactionId || !feedback || rating === undefined) {
      return res.status(400).json({
        error: 'interactionId, feedback, and rating are required'
      });
    }

    // Update the conversation history with feedback
    const updatedHistory = await prisma.aIConversationHistory.updateMany({
      where: {
        id: interactionId,
        userId
      },
      data: {
        userFeedback: feedback,
        feedbackRating: rating,
        correctionApplied: rating <= 3 // Consider ratings 3 and below as corrections needed
      }
    });

    if (updatedHistory.count === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    // Process feedback for learning
    // TODO: Implement feedback processing in learning engine

    res.json({
      success: true,
      message: 'Feedback recorded successfully'
    });
  } catch (error) {
    console.error('AI feedback error:', error);
    res.status(500).json({
      error: 'Failed to record feedback',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/ai/usage
 * Get AI usage statistics
 */
router.get('/usage', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { month, year } = req.query;

    const currentDate = new Date();
    const targetMonth = month ? parseInt(month as string) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : currentDate.getFullYear();

    let usage = await prisma.aIUsageTracking.findUnique({
      where: {
        userId_month_year: {
          userId,
          month: targetMonth,
          year: targetYear
        }
      }
    });

    if (!usage) {
      // Create default usage record
      usage = await prisma.aIUsageTracking.create({
        data: {
          userId,
          month: targetMonth,
          year: targetYear
        }
      });
    }

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Get AI usage error:', error);
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/ai/insights
 * Get AI-generated insights about user's digital life
 */
router.get('/insights', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get recent activity and generate insights
    // TODO: Use recentActivity for AI analysis when implemented
    // const recentActivity = await prisma.activity.findMany({
    //   where: { userId },
    //   orderBy: { timestamp: 'desc' },
    //   take: 100
    // });

    // TODO: Generate insights using AI analysis
    const insights = [
      {
        type: 'productivity',
        title: 'Peak Productivity Hours',
        description: 'You are most productive between 9 AM and 11 AM',
        recommendation: 'Schedule important tasks during this time',
        confidence: 0.8
      },
      {
        type: 'communication',
        title: 'Communication Pattern',
        description: 'You respond to messages fastest in the afternoon',
        recommendation: 'Set expectations for morning response times',
        confidence: 0.7
      }
    ];

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Get AI insights error:', error);
    res.status(500).json({
      error: 'Failed to generate insights',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/ai/teach
 * Teach AI about user preferences
 */
router.post('/teach', authenticateJWT, async (req, res) => {
  try {
    const { scenario, preference, reasoning } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!scenario || !preference) {
      return res.status(400).json({
        error: 'Scenario and preference are required'
      });
    }

    // Create learning event
    const learningEvent = await prisma.aILearningEvent.create({
      data: {
        userId,
        eventType: 'preference_update',
        context: scenario,
        newBehavior: preference,
        userFeedback: reasoning,
        confidence: 0.9 // High confidence for explicit teaching
      }
    });

    // Update personality profile with new preference
    // TODO: Implement preference integration

    res.json({
      success: true,
      data: learningEvent,
      message: 'Preference learned successfully'
    });
  } catch (error) {
    console.error('AI teach error:', error);
    res.status(500).json({
      error: 'Failed to record preference',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;