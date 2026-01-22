import { PrismaClient } from '@prisma/client';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { AnthropicProvider } from '../providers/AnthropicProvider';
import { LocalProvider } from '../providers/LocalProvider';
import { PrivacyDataRouter } from '../privacy/PrivacyDataRouter';
import { PersonalityEngine } from './PersonalityEngine';
import { DecisionEngine } from './DecisionEngine';
import { LearningEngine } from './LearningEngine';
import { ActionExecutor } from './ActionExecutor';
import { CrossModuleContextEngine } from '../context/CrossModuleContextEngine';
import { DigitalLifeTwinCore, LifeTwinQuery, DigitalLifeTwinResponse } from './DigitalLifeTwinCore';

export interface AIRequest {
  id: string;
  userId: string;
  query: string;
  context: Record<string, unknown>;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface AIResponse {
  id: string;
  requestId: string;
  response: string;
  confidence: number;
  reasoning?: string;
  actions?: AIAction[];
  metadata: {
    provider: string;
    model: string;
    tokens: number;
    cost: number;
    processingTime: number;
    inputTokens?: number;
    outputTokens?: number;
    error?: string;
    specialization?: string;
    actionResults?: any;
    processingMethod?: string;
  };
}

export interface AIAction {
  id: string;
  type: string;
  module: string;
  operation: string;
  parameters: Record<string, unknown>;
  requiresApproval: boolean;
  affectedUsers?: string[];
  reasoning: string;
}

export interface UserContext {
  userId: string;
  personality: unknown;
  preferences: unknown;
  autonomySettings: unknown;
  currentModule?: string;
  dashboardContext?: Record<string, unknown>;
  recentActivity: unknown[];
}

export class DigitalLifeTwinService {
  private prisma: PrismaClient;
  private privacyRouter: PrivacyDataRouter;
  private personalityEngine: PersonalityEngine;
  private decisionEngine: DecisionEngine;
  private learningEngine: LearningEngine;
  private actionExecutor: ActionExecutor;
  
  // Revolutionary Cross-Module Intelligence
  private contextEngine: CrossModuleContextEngine;
  private digitalLifeTwinCore: DigitalLifeTwinCore;

  // AI Providers
  private openaiProvider: OpenAIProvider;
  private anthropicProvider: AnthropicProvider;
  private localProvider: LocalProvider;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.privacyRouter = new PrivacyDataRouter();
    this.personalityEngine = new PersonalityEngine(prisma);
    this.decisionEngine = new DecisionEngine(prisma);
    this.learningEngine = new LearningEngine(prisma);
    this.actionExecutor = new ActionExecutor(prisma);
    
    // Initialize revolutionary cross-module intelligence
    this.contextEngine = new CrossModuleContextEngine();
    this.digitalLifeTwinCore = new DigitalLifeTwinCore(this.contextEngine, prisma);

    // Initialize AI providers
    this.openaiProvider = new OpenAIProvider();
    this.anthropicProvider = new AnthropicProvider();
    this.localProvider = new LocalProvider();
  }

  /**
   * 🚀 REVOLUTIONARY: Process as Digital Life Twin with full cross-module intelligence
   */
  async processAsDigitalLifeTwin(
    query: string,
    userId: string,
    context: {
      currentModule?: string;
      dashboardType?: string;
      dashboardName?: string;
      recentActivity?: unknown[];
      urgency?: 'low' | 'medium' | 'high';
      preferredProvider?: 'auto' | 'openai' | 'anthropic';
    } = {}
  ): Promise<DigitalLifeTwinResponse> {
    const lifeTwinQuery: LifeTwinQuery = {
      query,
      userId,
      context: context as any, // Context structure is runtime-determined
      conversationHistory: [], // Could be populated from recent AI conversations
      preferredProvider: context.preferredProvider // Pass provider preference
    };

    return await this.digitalLifeTwinCore.processAsDigitalTwin(lifeTwinQuery);
  }

  /**
   * Get comprehensive cross-module user context
   */
  async getCrossModuleContext(userId: string, forceRefresh = false) {
    return await this.contextEngine.getUserContext(userId, forceRefresh);
  }

  /**
   * Get context for specific module with cross-module intelligence
   */
  async getModuleContext(userId: string, moduleName: string) {
    return await this.contextEngine.getModuleContext(userId, moduleName);
  }

  /**
   * Legacy: Main entry point for AI processing (kept for backward compatibility)
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    try {
      // Build unified user context
      const userContext = await this.buildUserContext(request.userId);
      
      // Classify data and route to appropriate processor
      const routingDecision = await this.privacyRouter.routeRequest(request, userContext);
      
      // Process request based on routing decision
      let response: AIResponse;
      
      if (routingDecision.processor === 'local') {
        response = await this.processLocally(request, userContext, routingDecision);
      } else if (routingDecision.processor === 'cloud') {
        response = await this.processInCloud(request, userContext, routingDecision);
      } else {
        response = await this.processHybrid(request, userContext, routingDecision);
      }

      // Learn from interaction
      await this.learningEngine.processInteraction(request, response, userContext);

      // Execute any approved actions
      if (response.actions && response.actions.length > 0) {
        const executionResults = await this.actionExecutor.executeActions(response.actions, userContext);
        response.metadata.actionResults = executionResults;
      }

      return response;
    } catch (error) {
      console.error('Error processing AI request:', error);
      throw error;
    }
  }

  /**
   * Build unified context from all modules
   */
  private async buildUserContext(userId: string): Promise<UserContext> {
    // Get user personality and preferences
    const personality = await this.personalityEngine.getPersonalityProfile(userId);
    const preferences = await this.getUserPreferences(userId);
    const autonomySettings = await this.getAutonomySettings(userId);

    // Get recent activity across all modules
    const recentActivity = await this.getRecentActivity(userId);

    // Get current dashboard context
    const dashboardContext = await this.getCurrentDashboardContext(userId);

    return {
      userId,
      personality,
      preferences,
      autonomySettings,
      dashboardContext: dashboardContext as Record<string, unknown> | undefined,
      recentActivity
    };
  }

  /**
   * Process request using local AI (for sensitive data)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async processLocally(
    request: AIRequest, 
    context: UserContext, 
    routingDecision: any
  ): Promise<AIResponse> {
    return this.localProvider.process(request, context, routingDecision.localData);
  }

  /**
   * Process request using cloud AI (for general data)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async processInCloud(
    request: AIRequest, 
    context: UserContext, 
    routingDecision: any
  ): Promise<AIResponse> {
    // Determine best cloud provider based on task type
    const provider = await this.selectOptimalProvider(request, context);
    
    if (provider === 'openai') {
      return this.openaiProvider.process(request, context, routingDecision.cloudData);
    } else {
      return this.anthropicProvider.process(request, context, routingDecision.cloudData);
    }
  }

  /**
   * Process request using hybrid approach
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async processHybrid(
    request: AIRequest, 
    context: UserContext, 
    routingDecision: any
  ): Promise<AIResponse> {
    // Process sensitive data locally
    const localResult = await this.localProvider.process(
      request, 
      context, 
      routingDecision.localData
    );

    // Process general data in cloud
    const cloudResult = await this.processInCloud(request, context, {
      ...routingDecision,
      cloudData: routingDecision.cloudData
    });

    // Combine results
    return this.combineResults(localResult, cloudResult);
  }

  /**
   * Select optimal AI provider based on request characteristics
   */
  private async selectOptimalProvider(request: AIRequest, context: UserContext): Promise<'openai' | 'anthropic'> {
    // GPT-4o for conversational and decision-making tasks
    if (request.query.includes('decide') || request.query.includes('plan') || request.query.includes('conversation')) {
      return 'openai';
    }
    
    // Claude for analysis and reasoning tasks
    if (request.query.includes('analyze') || request.query.includes('understand') || request.query.includes('reason')) {
      return 'anthropic';
    }

    // Default to OpenAI for general queries
    return 'openai';
  }

  /**
   * Combine local and cloud processing results
   */
  private combineResults(localResult: AIResponse, cloudResult: AIResponse): AIResponse {
    return {
      id: cloudResult.id,
      requestId: cloudResult.requestId,
      response: this.synthesizeResponses(localResult.response, cloudResult.response),
      confidence: Math.min(localResult.confidence, cloudResult.confidence),
      reasoning: `Combined analysis: ${localResult.reasoning} | ${cloudResult.reasoning}`,
      actions: [...(localResult.actions || []), ...(cloudResult.actions || [])],
      metadata: {
        provider: 'hybrid',
        model: `${localResult.metadata.model} + ${cloudResult.metadata.model}`,
        tokens: localResult.metadata.tokens + cloudResult.metadata.tokens,
        cost: localResult.metadata.cost + cloudResult.metadata.cost,
        processingTime: Math.max(localResult.metadata.processingTime, cloudResult.metadata.processingTime)
      }
    };
  }

  /**
   * Synthesize responses from multiple providers
   */
  private synthesizeResponses(localResponse: string, cloudResponse: string): string {
    // For now, prioritize cloud response but include local insights
    return `${cloudResponse}\n\n[Additional context from secure analysis: ${localResponse.substring(0, 100)}...]`;
  }

  // Helper methods for context building
  private async getUserPreferences(userId: string): Promise<unknown[]> {
    return this.prisma.userPreference.findMany({
      where: { userId }
    });
  }

  private async getAutonomySettings(userId: string): Promise<unknown | null> {
    return this.prisma.aIAutonomySettings.findUnique({
      where: { userId }
    });
  }

  private async getRecentActivity(userId: string): Promise<any[]> {
    // Get recent activity from all modules
    const activities = await this.prisma.activity.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 50
    });
    return activities;
  }

  private async getCurrentDashboardContext(userId: string): Promise<unknown | null> {
    // Get current dashboard and its context
    return this.prisma.dashboard.findFirst({
      where: { userId },
      include: {
        widgets: true,
        business: true,
        institution: true,
        household: true
      }
    });
  }
}