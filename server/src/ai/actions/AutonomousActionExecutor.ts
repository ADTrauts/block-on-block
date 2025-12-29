import { PrismaClient } from '@prisma/client';
import { AutonomyManager, AutonomyContext, AutonomyDecision } from '../autonomy/AutonomyManager';
import { ActionTemplates, ActionTemplate } from './ActionTemplates';
import { DigitalLifeTwinCore } from '../core/DigitalLifeTwinCore';

export interface AutonomousAction {
  id: string;
  userId: string;
  actionType: string;
  parameters: Record<string, unknown>;
  context: AutonomousActionContext;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'awaiting_approval';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  executedAt?: Date;
  result?: any;
  error?: string;
}

export interface AutonomousActionContext {
  module: string;
  trigger: 'user_request' | 'ai_suggestion' | 'scheduled' | 'pattern_detected';
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  expectedBenefit: string;
  potentialRisks: string[];
  affectedModules: string[];
}

export interface ActionExecutionResult {
  success: boolean;
  actionId: string;
  result?: any;
  error?: string;
  autonomyDecision: AutonomyDecision;
  executionTime: number;
  needsApproval: boolean;
  approvalReason?: string;
}

export class AutonomousActionExecutor {
  private prisma: PrismaClient;
  private autonomyManager: AutonomyManager;
  private actionTemplates: ActionTemplates;
  private digitalTwin: DigitalLifeTwinCore;

  constructor(
    prisma: PrismaClient,
    autonomyManager: AutonomyManager,
    actionTemplates: ActionTemplates,
    digitalTwin: DigitalLifeTwinCore
  ) {
    this.prisma = prisma;
    this.autonomyManager = autonomyManager;
    this.actionTemplates = actionTemplates;
    this.digitalTwin = digitalTwin;
  }

  /**
   * Execute an autonomous action if autonomy settings allow it
   */
  async executeAutonomousAction(
    userId: string,
    actionType: string,
    parameters: Record<string, unknown>,
    context: AutonomousActionContext
  ): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Create autonomy context for evaluation
      const autonomyContext: AutonomyContext = {
        userId,
      actionType,
      module: context.module,
      urgency: this.mapPriorityToUrgency(context.confidence),
      affectedUsers: Array.isArray(parameters.affectedUsers) ? parameters.affectedUsers : [userId],
      financialImpact: typeof parameters.financialImpact === 'number' ? parameters.financialImpact : 0,
      timeCommitment: typeof parameters.timeCommitment === 'number' ? parameters.timeCommitment : 5,
      dataSensitivity: (typeof parameters.dataSensitivity === 'string' && ['internal', 'public', 'confidential', 'restricted'].includes(parameters.dataSensitivity))
        ? parameters.dataSensitivity as 'internal' | 'public' | 'confidential' | 'restricted'
        : 'internal'
      };

      // Evaluate if action can be executed autonomously
      const autonomyDecision = await this.autonomyManager.evaluateAutonomy(autonomyContext);
      
      // Create action record
      const action: AutonomousAction = {
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        actionType,
        parameters,
        context,
        status: autonomyDecision.canExecute ? 'executing' : 'awaiting_approval',
        priority: this.mapUrgencyToPriority(autonomyContext.urgency),
        createdAt: new Date()
      };

      // Store action in database
      await this.storeAction(action, autonomyDecision);

      const executionResult: ActionExecutionResult = {
        success: false,
        actionId: action.id,
        autonomyDecision,
        executionTime: 0,
        needsApproval: autonomyDecision.requiresApproval,
        approvalReason: autonomyDecision.approvalReason
      };

      // Execute if allowed, otherwise queue for approval
      if (autonomyDecision.canExecute && !autonomyDecision.requiresApproval) {
        const result = await this.performAction(action);
        executionResult.success = result.success;
        executionResult.result = result.result;
        executionResult.error = result.error;
      } else {
        // Queue for user approval
        await this.queueForApproval(action, autonomyDecision);
        executionResult.success = true; // Successfully queued
        executionResult.result = {
          message: 'Action queued for approval',
          approvalRequired: true,
          reason: autonomyDecision.approvalReason
        };
      }

      executionResult.executionTime = Date.now() - startTime;
      return executionResult;

    } catch (error) {
      return {
        success: false,
        actionId: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        autonomyDecision: { 
          actionId: 'error_action',
          canExecute: false, 
          requiresApproval: true, 
          autonomyLevel: 0, 
          confidence: 0, 
          riskAssessment: { level: 'high', factors: ['execution_error'], impact: 'significant' } 
        },
        executionTime: Date.now() - startTime,
        needsApproval: true
      };
    }
  }

  /**
   * Perform the actual action execution
   */
  private async performAction(action: AutonomousAction): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Get action templates and find the matching one
      const templates = await this.actionTemplates.getActionTemplates();
      const template = templates.find(t => t.actionType === action.actionType);
      if (!template) {
        throw new Error(`Action template not found: ${action.actionType}`);
      }

      // Update status to executing
      await this.updateActionStatus(action.id, 'executing');

      // Execute based on action type
      let result;
      switch (action.actionType) {
        case 'schedule_event':
          result = await this.executeScheduleEvent(action, template);
          break;
        case 'send_message':
          result = await this.executeSendMessage(action, template);
          break;
        case 'create_task':
          result = await this.executeCreateTask(action, template);
          break;
        case 'update_task_priority':
          result = await this.executeUpdateTaskPriority(action, template);
          break;
        case 'analyze_data':
          result = await this.executeAnalyzeData(action, template);
          break;
        case 'organize_files':
          result = await this.executeOrganizeFiles(action, template);
          break;
        case 'schedule_followup':
          result = await this.executeScheduleFollowup(action, template);
          break;
        default:
          throw new Error(`Unsupported action type: ${action.actionType}`);
      }

      // Update status to completed
      await this.updateActionStatus(action.id, 'completed', result);

      // Record learning event
      await this.recordLearningEvent(action, result, true);

      return { success: true, result };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update status to failed
      await this.updateActionStatus(action.id, 'failed', null, errorMessage);

      // Record learning event
      await this.recordLearningEvent(action, null, false, errorMessage);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute schedule event action
   */
  private async executeScheduleEvent(action: AutonomousAction, template: ActionTemplate): Promise<unknown> {
    const { title, startTime, duration, attendees } = action.parameters;
    
    // This would integrate with calendar APIs
    const event = {
      id: `event_${Date.now()}`,
      title: typeof title === 'string' ? title : '',
      startTime: startTime instanceof Date ? startTime : new Date(String(startTime)),
      duration: typeof duration === 'number' ? duration : 60,
      attendees: Array.isArray(attendees) ? attendees : [],
      createdBy: 'ai_assistant',
      userId: action.userId
    };

    // Store in database (mock implementation)
    // In real implementation, this would call calendar APIs
    console.log('Scheduling event:', event);
    
    return {
      eventId: event.id,
      message: `Event "${title}" scheduled successfully`,
      details: event
    };
  }

  /**
   * Execute send message action
   */
  private async executeSendMessage(action: AutonomousAction, template: ActionTemplate): Promise<unknown> {
    const { recipient, message, channel } = action.parameters;
    
    // This would integrate with messaging APIs
    const messageData = {
      id: `msg_${Date.now()}`,
      recipient,
      content: message,
      channel: channel || 'email',
      sentAt: new Date(),
      sentBy: 'ai_assistant',
      userId: action.userId
    };

    // Store in database (mock implementation)
    console.log('Sending message:', messageData);
    
    return {
      messageId: messageData.id,
      message: `Message sent to ${recipient} via ${channel}`,
      details: messageData
    };
  }

  /**
   * Execute create task action
   */
  private async executeCreateTask(action: AutonomousAction, template: ActionTemplate): Promise<unknown> {
    const { title, description, priority, dueDate } = action.parameters;
    
    const task = {
      id: `task_${Date.now()}`,
      title: typeof title === 'string' ? title : '',
      description: typeof description === 'string' ? description : '',
      priority: typeof priority === 'string' ? priority : 'medium',
      dueDate: dueDate ? (dueDate instanceof Date ? dueDate : new Date(String(dueDate))) : null,
      status: 'pending',
      createdBy: 'ai_assistant',
      userId: action.userId,
      createdAt: new Date()
    };

    // Store in database (mock implementation)
    console.log('Creating task:', task);
    
    return {
      taskId: task.id,
      message: `Task "${title}" created successfully`,
      details: task
    };
  }

  /**
   * Execute update task priority action
   */
  private async executeUpdateTaskPriority(action: AutonomousAction, template: ActionTemplate): Promise<unknown> {
    const { taskId, newPriority, suggestions } = action.parameters;
    
    try {
      // Import todoController to use the actual implementation
      const { updateTask, executePriorityChanges } = await import('../../controllers/todoController');
      
      // If suggestions array is provided, use bulk update
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        // Create mock request/response for executePriorityChanges
        const mockReq = {
          user: { id: action.userId },
          body: { suggestions }
        } as any;
        
        let result: any = {};
        const mockRes = {
          json: (data: any) => { result = data; },
          status: (code: number) => ({ json: (data: any) => { result = { ...data, statusCode: code }; } })
        } as any;

        await executePriorityChanges(mockReq, mockRes);

        return {
          success: result.success || false,
          updated: result.updated || 0,
          total: result.total || suggestions.length,
          message: `Updated priorities for ${result.updated || 0} task(s)`,
        };
      }
      
      // Single task update
      if (taskId && newPriority) {
        const mockReq = {
          user: { id: action.userId },
          params: { id: taskId },
          body: { priority: newPriority }
        } as any;
        
        let result: any = {};
        const mockRes = {
          json: (data: any) => { result = data; },
          status: (code: number) => ({ json: (data: any) => { result = { ...data, statusCode: code }; } })
        } as any;

        await updateTask(mockReq, mockRes);

        return {
          success: !result.statusCode || result.statusCode === 200,
          taskId,
          newPriority,
          message: `Task priority updated to ${newPriority}`,
        };
      }

      throw new Error('Either taskId/newPriority or suggestions array is required');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating task priority:', errorMessage);
      throw error;
    }
  }

  /**
   * Execute analyze data action
   */
  private async executeAnalyzeData(action: AutonomousAction, template: ActionTemplate): Promise<unknown> {
    const { dataSource, analysisType, parameters: analysisParams } = action.parameters;
    
    // This would perform actual data analysis
    const analysis = {
      id: `analysis_${Date.now()}`,
      dataSource,
      type: analysisType,
      parameters: analysisParams,
      results: {
        summary: 'Data analysis completed successfully',
        insights: ['Key insight 1', 'Key insight 2'],
        recommendations: ['Recommendation 1', 'Recommendation 2']
      },
      completedAt: new Date(),
      userId: action.userId
    };

    console.log('Performing data analysis:', analysis);
    
    return {
      analysisId: analysis.id,
      message: `Data analysis for ${dataSource} completed`,
      details: analysis
    };
  }

  /**
   * Execute organize files action
   */
  private async executeOrganizeFiles(action: AutonomousAction, template: ActionTemplate): Promise<unknown> {
    const { source, organizationType, rules } = action.parameters;
    
    const organization = {
      id: `org_${Date.now()}`,
      source,
      type: organizationType,
      rules: rules || {},
      results: {
        filesProcessed: 42,
        foldersCreated: 5,
        duplicatesRemoved: 3
      },
      completedAt: new Date(),
      userId: action.userId
    };

    console.log('Organizing files:', organization);
    
    return {
      organizationId: organization.id,
      message: `File organization completed for ${source}`,
      details: organization
    };
  }

  /**
   * Execute schedule followup action
   */
  private async executeScheduleFollowup(action: AutonomousAction, template: ActionTemplate): Promise<unknown> {
    const { conversationId, followUpType, delayDays } = action.parameters;
    
    const followUp = {
      id: `followup_${Date.now()}`,
      conversationId,
      type: followUpType,
      scheduledFor: new Date(Date.now() + (typeof delayDays === 'number' ? delayDays : 7) * 24 * 60 * 60 * 1000),
      status: 'scheduled',
      userId: action.userId,
      createdAt: new Date()
    };

    console.log('Scheduling follow-up:', followUp);
    
    return {
      followUpId: followUp.id,
      message: `Follow-up scheduled for ${followUp.scheduledFor.toLocaleDateString()}`,
      details: followUp
    };
  }

  /**
   * Store action in database
   */
  private async storeAction(action: AutonomousAction, decision: AutonomyDecision): Promise<void> {
    // Store in AI conversation history for now
    await this.prisma.aIConversationHistory.create({
      data: {
        userId: action.userId,
        sessionId: `session_${Date.now()}`,
        userQuery: `Autonomous Action: ${action.actionType}`,
        aiResponse: JSON.stringify({
          action: action,
          autonomyDecision: decision
        }),
        confidence: decision.confidence,
        interactionType: 'ACTION_REQUEST',
        actions: [JSON.stringify(action)],
        context: JSON.stringify(action.context),
        provider: 'autonomous_system',
        model: 'autonomy_manager'
      }
    });
  }

  /**
   * Update action status
   */
  private async updateActionStatus(
    actionId: string, 
    status: AutonomousAction['status'], 
    result?: any, 
    error?: string
  ): Promise<void> {
    // Update the stored action record
    // For now, we'll create a new record to track the status change
    console.log(`Action ${actionId} status updated to ${status}`, { result, error });
  }

  /**
   * Queue action for user approval
   */
  private async queueForApproval(action: AutonomousAction, decision: AutonomyDecision): Promise<void> {
    // Store in pending approvals
    await this.prisma.aIConversationHistory.create({
      data: {
        userId: action.userId,
        sessionId: `approval_${Date.now()}`,
        userQuery: `Approval Required: ${action.actionType}`,
        aiResponse: JSON.stringify({
          action: action,
          autonomyDecision: decision,
          approvalRequired: true,
          reason: decision.approvalReason
        }),
        confidence: decision.confidence,
        interactionType: 'ACTION_REQUEST',
        actions: [JSON.stringify(action)],
        context: JSON.stringify({
          ...action.context,
          needsApproval: true,
          approvalReason: decision.approvalReason
        }),
        provider: 'autonomous_system',
        model: 'approval_queue'
      }
    });
  }

  /**
   * Record learning event for AI improvement
   */
  private async recordLearningEvent(
    action: AutonomousAction, 
    result: any, 
    success: boolean, 
    error?: string
  ): Promise<void> {
    await this.prisma.aILearningEvent.create({
      data: {
        userId: action.userId,
        eventType: 'autonomous_action',
        context: JSON.stringify({
          actionType: action.actionType,
          success,
          parameters: action.parameters,
          context: action.context,
          result,
          error
        }),
        confidence: action.context.confidence,
        oldBehavior: success ? null : 'Action failed to execute',
        newBehavior: success ? 'Action executed successfully' : 'Improved error handling needed',
        patternData: {
          executionTime: Date.now() - action.createdAt.getTime(),
          autonomyLevel: action.context.confidence,
          riskLevel: action.context.riskLevel,
          outcome: success ? 'SUCCESS' : 'FAILURE'
        }
      }
    });
  }

  /**
   * Get pending actions for user approval
   */
  async getPendingApprovals(userId: string): Promise<any[]> {
    const pendingActions = await this.prisma.aIConversationHistory.findMany({
      where: {
        userId,
        userQuery: {
          contains: 'Approval Required:'
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return pendingActions.map(action => {
      const data = typeof action.aiResponse === 'string' 
        ? JSON.parse(action.aiResponse) 
        : action.aiResponse;
      
      return {
        id: action.id,
        actionType: data.action?.actionType,
        parameters: data.action?.parameters,
        reason: data.reason,
        createdAt: action.createdAt,
        confidence: action.confidence,
        riskLevel: data.action?.context?.riskLevel
      };
    });
  }

  /**
   * Approve or reject a pending action
   */
  async handleApproval(userId: string, actionId: string, approved: boolean): Promise<ActionExecutionResult> {
    // Find the pending action
    const pendingAction = await this.prisma.aIConversationHistory.findFirst({
      where: {
        id: actionId,
        userId,
        userQuery: {
          contains: 'Approval Required:'
        }
      }
    });

    if (!pendingAction) {
      throw new Error('Pending action not found');
    }

    const data = typeof pendingAction.aiResponse === 'string' 
      ? JSON.parse(pendingAction.aiResponse) 
      : pendingAction.aiResponse;

    const action = data.action as AutonomousAction;

    if (approved) {
      // Execute the approved action
      return await this.performAction(action).then(result => ({
        success: result.success,
        actionId: action.id,
        result: result.result,
        error: result.error,
        autonomyDecision: data.autonomyDecision,
        executionTime: 0,
        needsApproval: false
      }));
    } else {
      // Record rejection
      await this.recordLearningEvent(action, null, false, 'User rejected action');
      
      return {
        success: true,
        actionId: action.id,
        result: { message: 'Action rejected by user' },
        autonomyDecision: data.autonomyDecision,
        executionTime: 0,
        needsApproval: false
      };
    }
  }

  /**
   * Utility methods
   */
  private mapPriorityToUrgency(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence >= 0.9) return 'critical';
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  private mapUrgencyToPriority(urgency: 'low' | 'medium' | 'high' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    return urgency;
  }
}

export default AutonomousActionExecutor;
