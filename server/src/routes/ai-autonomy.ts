import express from 'express';
import { PrismaClient } from '@prisma/client';
import AutonomyManager from '../ai/autonomy/AutonomyManager';
import ApprovalManager from '../ai/approval/ApprovalManager';
import ActionTemplates from '../ai/actions/ActionTemplates';
import { authenticateJWT } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router: express.Router = express.Router();
const autonomyManager = new AutonomyManager(prisma);
const approvalManager = new ApprovalManager(prisma);
const actionTemplates = new ActionTemplates(prisma);

/**
 * GET /api/ai/autonomy/settings
 * Get user's autonomy settings
 */
router.get('/settings', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const settings = await prisma.aIAutonomySettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      // Create default settings
      const defaultSettings = await prisma.aIAutonomySettings.create({
        data: { userId }
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
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * PUT /api/ai/autonomy/settings
 * Update user's autonomy settings
 */
router.put('/settings', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const updatedSettings = await autonomyManager.updateAutonomySettings(userId, req.body);
    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * POST /api/ai/autonomy/evaluate
 * Evaluate autonomy for a proposed action
 */
router.post('/evaluate', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { actionType, module, affectedUsers, financialImpact, timeCommitment, dataSensitivity, urgency } = req.body;

    const context = {
      userId,
      actionType,
      module,
      affectedUsers: affectedUsers || [],
      financialImpact,
      timeCommitment,
      dataSensitivity: dataSensitivity || 'internal',
      urgency: urgency || 'medium'
    };

    const decision = await autonomyManager.evaluateAutonomy(context);
    res.json(decision);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * GET /api/ai/autonomy/recommendations
 * Get autonomy recommendations based on user behavior
 */
router.get('/recommendations', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const recommendations = await autonomyManager.getAutonomyRecommendations(userId);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * GET /api/ai/approvals/pending
 * Get pending approval requests for user
 */
router.get('/approvals/pending', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const pendingApprovals = await approvalManager.getPendingApprovals(userId);
    res.json(pendingApprovals);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * GET /api/ai/approvals/:requestId
 * Get specific approval request
 */
router.get('/approvals/:requestId', authenticateJWT, async (req, res) => {
  try {
    const { requestId } = req.params;
    const approvalRequest = await approvalManager.getApprovalRequest(requestId);
    
    if (!approvalRequest) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    res.json(approvalRequest);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * POST /api/ai/approvals/:requestId/respond
 * Respond to an approval request
 */
router.post('/approvals/:requestId/respond', authenticateJWT, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { response, reasoning, modifications } = req.body;
    const responderId = req.user?.id;

    if (!responderId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const updatedRequest = await approvalManager.respondToApproval(
      requestId,
      responderId,
      response,
      reasoning,
      modifications
    );

    res.json(updatedRequest);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * POST /api/ai/approvals/:requestId/execute
 * Execute an approved action
 */
router.post('/approvals/:requestId/execute', authenticateJWT, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const success = await approvalManager.executeApprovedAction(requestId);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * GET /api/ai/approvals/stats
 * Get approval statistics for user
 */
router.get('/approvals/stats', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stats = await approvalManager.getApprovalStats(userId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * GET /api/ai/actions/templates
 * Get all available action templates
 */
router.get('/actions/templates', authenticateJWT, async (req, res) => {
  try {
    const templates = await actionTemplates.getActionTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * GET /api/ai/actions/templates/:templateId
 * Get specific action template
 */
router.get('/actions/templates/:templateId', authenticateJWT, async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = await actionTemplates.getActionTemplate(templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * POST /api/ai/actions/templates/:templateId/execute
 * Execute an action template
 */
router.post('/actions/templates/:templateId/execute', authenticateJWT, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { parameters } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await actionTemplates.executeTemplate(templateId, parameters, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * POST /api/ai/actions/execute
 * Execute an action with autonomy evaluation
 */
router.post('/actions/execute', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { 
      actionType, 
      module, 
      parameters, 
      affectedUsers, 
      financialImpact, 
      timeCommitment, 
      dataSensitivity, 
      urgency 
    } = req.body;

    // Evaluate autonomy
    const context = {
      userId,
      actionType,
      module,
      affectedUsers: affectedUsers || [],
      financialImpact,
      timeCommitment,
      dataSensitivity: dataSensitivity || 'internal',
      urgency: urgency || 'medium'
    };

    const autonomyDecision = await autonomyManager.evaluateAutonomy(context);

    // If approval is required, create approval request
    if (autonomyDecision.requiresApproval) {
      const approvalRequest = await approvalManager.createApprovalRequest(
        userId,
        actionType,
        parameters,
        affectedUsers || [],
        'Action requires approval based on autonomy settings',
        autonomyDecision
      );

      return res.json({
        requiresApproval: true,
        approvalRequest,
        autonomyDecision
      });
    }

    // If action can execute autonomously
    if (autonomyDecision.canExecute) {
      // Execute the action (this would integrate with ActionExecutor)
      const executionResult = {
        success: true,
        actionId: autonomyDecision.actionId,
        result: 'Action executed autonomously',
        autonomyDecision
      };

      return res.json(executionResult);
    }

    // Action cannot execute
    return res.status(400).json({
      error: 'Action cannot be executed',
      autonomyDecision
    });

  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

/**
 * GET /api/ai/actions/history
 * Get action execution history
 */
router.get('/actions/history', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const history = await prisma.aIConversationHistory.findMany({
      where: { 
        userId,
        interactionType: 'ACTION_REQUEST'
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

export default router; 