import { PrismaClient } from '@prisma/client';
import { CrossModuleContextEngine, UserContext, CrossModuleInsight } from '../context/CrossModuleContextEngine';
import { PersonalityEngine } from './PersonalityEngine';
import { DecisionEngine } from './DecisionEngine';
import { AdvancedLearningEngine } from '../learning/AdvancedLearningEngine';
import { ActionExecutor } from './ActionExecutor';
import { SmartPatternEngine } from '../intelligence/SmartPatternEngine';
import { prisma as sharedPrisma } from '../../lib/prisma';

export interface DigitalLifeTwinResponse {
  response: string;
  confidence: number;
  actions: LifeTwinAction[];
  insights: CrossModuleInsight[];
  reasoning: string;
  personalityAlignment: number;
  crossModuleConnections: CrossModuleConnection[];
  metadata: {
    contextUsed: string[];
    modulesFocused: string[];
    patternMatches: string[];
    processingTime: number;
    provider: string;
    smartContext?: {
      queryAnalysis: {
        relevantModules: Array<{ name: string; relevance: string }>;
        contextProvidersFetched: string[];
      };
      performanceGain: {
        modulesAnalyzed: number;
        totalModulesAvailable: number;
      };
    };
  };
}

export interface LifeTwinActionData {
  targetId?: string;
  operation?: string;
  parameters?: Record<string, unknown>;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LifeTwinAction {
  id: string;
  type: 'schedule' | 'communicate' | 'organize' | 'analyze' | 'create' | 'update' | 'delete';
  module: string;
  description: string;
  data: LifeTwinActionData;
  requiresApproval: boolean;
  approvalReason?: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  estimatedTime: number; // minutes
  peopleAffected: string[];
  consequences: string[];
}

export interface CrossModuleConnection {
  type: 'workflow' | 'relationship' | 'pattern' | 'opportunity';
  description: string;
  modules: string[];
  strength: number;
  actionable: boolean;
  suggestedAction?: string;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  timestamp: Date | string;
  module?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ConversationHistoryItem {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date | string;
  [key: string]: unknown;
}

export interface LifeTwinQuery {
  query: string;
  context: {
    currentModule?: string;
    dashboardType?: string;
    dashboardName?: string;
    recentActivity?: RecentActivityItem[];
    urgency?: 'low' | 'medium' | 'high';
  };
  userId: string;
  conversationHistory?: ConversationHistoryItem[];
}

export class DigitalLifeTwinCore {
  private prisma: PrismaClient;
  private contextEngine: CrossModuleContextEngine;
  private personalityEngine: PersonalityEngine;
  private decisionEngine: DecisionEngine;
  private learningEngine: AdvancedLearningEngine;
  private actionExecutor: ActionExecutor;
  private smartPatternEngine: SmartPatternEngine;

  constructor(contextEngine?: CrossModuleContextEngine, prismaClient?: PrismaClient) {
    this.prisma = prismaClient || sharedPrisma;
    
    this.contextEngine = contextEngine || new CrossModuleContextEngine();
    
    try {
      this.personalityEngine = new PersonalityEngine(this.prisma);
      this.decisionEngine = new DecisionEngine(this.prisma);
      this.learningEngine = new AdvancedLearningEngine(this.prisma);
      this.actionExecutor = new ActionExecutor(this.prisma);
      this.smartPatternEngine = new SmartPatternEngine(this.prisma);
    } catch (error) {
      console.error('Error initializing DigitalLifeTwinCore engines:', error);
      throw error; // Re-throw to prevent using uninitialized engines
    }
  }

  /**
   * Main interface - process a query as the user's Digital Life Twin
   */
  async processAsDigitalTwin(query: LifeTwinQuery): Promise<DigitalLifeTwinResponse> {
    const startTime = Date.now();

    try {
      // Validate input
      if (!query || !query.query || !query.userId) {
        throw new Error('Invalid query: missing required fields');
      }

      // 1. 🚀 NEW: Get SMART context - only fetches relevant modules based on query
      let userContext: UserContext;
      let smartContext: Record<string, unknown> | null = null;
      try {
        // Use the NEW intelligent context fetching system
        smartContext = await this.contextEngine?.getContextForAIQuery(query.userId, query.query);
        
        // Convert smart context to UserContext format for backward compatibility
        userContext = (smartContext as any)?.fullContext || await this.contextEngine?.getUserContext(query.userId) || this.createFallbackUserContext(query.userId);
        
        console.log(`✨ Smart Context: Analyzed query and fetched from ${smartContext?.relevantModuleCount || 0} relevant modules (instead of all)`);
      } catch (error) {
        console.warn('Error getting smart context, falling back to full context:', error);
        // Fallback to old method if smart context fails
        try {
          userContext = await this.contextEngine?.getUserContext(query.userId) || this.createFallbackUserContext(query.userId);
        } catch (fallbackError) {
          console.warn('Error getting user context:', fallbackError);
          userContext = this.createFallbackUserContext(query.userId);
        }
      }
      
      // 2. Get user's personality profile (with fallback)
      let personality;
      try {
        personality = await this.personalityEngine?.getPersonalityProfile(query.userId) || {};
      } catch (error) {
        console.warn('Error getting personality profile:', error);
        personality = {};
      }

      // 2a. Get user-defined context entries (with fallback)
      let userDefinedContext: Array<Record<string, unknown>> = [];
      try {
        const contexts = await this.prisma.userAIContext.findMany({
          where: {
            userId: query.userId,
            active: true
          },
          orderBy: [
            { priority: 'desc' },
            { updatedAt: 'desc' }
          ],
          take: 20 // Limit to top 20 most relevant contexts
        });
        userDefinedContext = contexts.map(ctx => ({
          scope: ctx.scope,
          moduleId: ctx.moduleId,
          contextType: ctx.contextType,
          title: ctx.title,
          content: ctx.content,
          tags: ctx.tags
        }));
      } catch (error) {
        console.warn('Error getting user-defined context:', error);
      }
      
      // 3. Get smart pattern analysis and predictions
      let smartAnalysis: Record<string, unknown> = { patterns: [], predictions: [], suggestions: [] };
      try {
        smartAnalysis = await this.smartPatternEngine?.analyzeAndPredict(query.userId, {
          currentQuery: query.query,
          currentModule: query.context.currentModule,
          urgency: query.context.urgency
        }) || smartAnalysis;
      } catch (error) {
        console.warn('Error getting smart pattern analysis:', error);
      }

      // 4. Enhance query with semantic understanding
      let semanticEnhancement: Record<string, unknown> = { 
        originalQuery: query.query, 
        enhancedContext: query.query, 
        relatedQueries: [], 
        confidenceBoost: 0, 
        suggestedCategories: ['general'] 
      };
      try {
        semanticEnhancement = await this.smartPatternEngine?.enhanceQueryWithSemantics(query.query, query.userId) || semanticEnhancement;
      } catch (error) {
        console.warn('Error enhancing query with semantics:', error);
      }

      // 5. Analyze the query intent and determine response strategy (enhanced with patterns and semantics)
      const queryAnalysis = await this.analyzeQuery(query, userContext, personality, smartAnalysis, semanticEnhancement);
      
      // 6. Generate Digital Life Twin response (enhanced with smart insights and semantics)
      const response = await this.generateLifeTwinResponse(query, userContext, personality, queryAnalysis, smartAnalysis, semanticEnhancement, userDefinedContext);
      
      // 5. Identify cross-module connections and opportunities (with error handling)
      let connections: CrossModuleConnection[] = [];
      try {
        connections = await this.identifyCrossModuleConnections(query, userContext, response);
      } catch (error) {
        console.warn('Error identifying cross-module connections:', error);
      }
      
      // 6. Determine actions the Digital Life Twin should take (with error handling)
      let actions: LifeTwinAction[] = [];
      try {
        actions = await this.determineActions(query, userContext, personality, response);
      } catch (error) {
        console.warn('Error determining actions:', error);
      }
      
      // 7. Extract relevant insights (with error handling)
      let relevantInsights: CrossModuleInsight[] = [];
      try {
        relevantInsights = this.extractRelevantInsights(userContext, query);
      } catch (error) {
        console.warn('Error extracting insights:', error);
      }
      
      // 8. Calculate personality alignment (with error handling)
      let personalityAlignment = 0.5;
      try {
        personalityAlignment = this.calculatePersonalityAlignment(response, personality);
      } catch (error) {
        console.warn('Error calculating personality alignment:', error);
      }
      
      // 9. Learn from this interaction (using mock AIRequest/AIResponse for now)
      await this.learningEngine.processInteraction(
        {
          id: `ai_req_${Date.now()}`,
          userId: query.userId,
          query: query.query,
          context: query.context,
          timestamp: new Date(),
          priority: 'medium'
        },
        {
          id: `ai_res_${Date.now()}`,
          requestId: `ai_req_${Date.now()}`,
          response: response.response,
          confidence: response.confidence,
          reasoning: response.reasoning,
          metadata: {
            provider: 'hybrid',
            model: 'digital-life-twin',
            tokens: 0,
            cost: 0,
            processingTime: Date.now() - startTime
          }
        },
        {
          userId: query.userId,
          personality: await this.personalityEngine.getPersonalityProfile(query.userId),
          preferences: userContext.preferences,
          autonomySettings: {},
          currentModule: query.context.currentModule,
          recentActivity: []
        }
      );

      const processingTime = Date.now() - startTime;

      return {
        response: response.response,
        confidence: response.confidence,
        actions,
        insights: relevantInsights,
        reasoning: response.reasoning,
        personalityAlignment,
        crossModuleConnections: connections,
        metadata: {
          contextUsed: Object.keys(userContext),
          modulesFocused: response.modulesFocused || [],
          patternMatches: response.patternMatches || [],
          processingTime,
          provider: response.provider || 'hybrid',
          // NEW: Smart context metadata
          smartContext: smartContext ? {
            queryAnalysis: {
              relevantModules: (smartContext as Record<string, any>).analysis?.matchedModules?.map((m: Record<string, unknown>) => ({
                name: m.moduleName as string,
                relevance: m.relevance as string
              })) || [],
              contextProvidersFetched: (smartContext as Record<string, any>).analysis?.suggestedContextProviders?.map((p: Record<string, unknown>) => p.providerName as string) || []
            },
            performanceGain: {
              modulesAnalyzed: (smartContext as any).relevantModuleCount || 0,
              totalModulesAvailable: (smartContext as any).analysis?.matchedModules?.length || 0
            }
          } : undefined
        }
      };
    } catch (error) {
      console.error('Error in Digital Life Twin processing:', error);
      
      return {
        response: "I apologize, but I'm having trouble accessing your full digital context right now. Let me try to help with what I can access.",
        confidence: 0.3,
        actions: [],
        insights: [],
        reasoning: "Limited context due to system error",
        personalityAlignment: 0.5,
        crossModuleConnections: [],
        metadata: {
          contextUsed: [],
          modulesFocused: [],
          patternMatches: [],
          processingTime: Date.now() - startTime,
          provider: 'fallback'
        }
      };
    }
  }

  /**
   * Analyze query intent and context (enhanced with smart patterns and semantics)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async analyzeQuery(query: LifeTwinQuery, userContext: UserContext, personality: any, smartAnalysis?: any, semanticEnhancement?: any) {
    const queryLower = query.query.toLowerCase();
    
    // Determine query type
    const queryType = this.determineQueryType(queryLower);
    
    // Determine scope (single module vs cross-module)
    const scope = this.determineQueryScope(queryLower, userContext);
    
    // Determine urgency
    const urgency = this.determineUrgency(queryLower, query.context.urgency);
    
    // Find relevant patterns
    const relevantPatterns = userContext.patterns.filter(pattern => 
      this.isPatternRelevant(pattern as unknown as Record<string, unknown>, queryLower, queryType)
    );
    
    // Find relevant relationships
    const relevantRelationships = userContext.relationships.filter(rel =>
      this.isRelationshipRelevant(rel as unknown as Record<string, unknown>, queryLower, queryType)
    );
    
    return {
      queryType,
      scope,
      urgency,
      relevantPatterns,
      relevantRelationships,
      requiresAction: this.requiresAction(queryLower),
      moduleContext: query.context.currentModule,
      complexity: this.calculateQueryComplexity(queryLower, scope, relevantPatterns.length)
    };
  }

  /**
   * Generate response as Digital Life Twin (enhanced with smart insights and semantics)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generateLifeTwinResponse(
    query: LifeTwinQuery, 
    userContext: UserContext, 
    personality: any, 
    analysis: any,
    smartAnalysis?: any,
    semanticEnhancement?: any,
    userDefinedContext?: Array<Record<string, unknown>>
  ) {
    // Build context-aware prompt (enhanced with smart patterns and semantics)
    const prompt = this.buildDigitalTwinPrompt(query, userContext, personality, analysis, smartAnalysis, semanticEnhancement, userDefinedContext);
    
    // Use appropriate AI provider based on complexity and privacy
    const provider = this.selectAIProvider((analysis as any)?.complexity || 'medium', query.query);
    
    // Generate response
    const aiResponse = await this.callAIProvider(provider, prompt, {
      temperature: 0.7,
      maxTokens: 1000,
      personalityMode: true,
      userId: query.userId
    });
    
    const response = typeof aiResponse.response === 'string' ? aiResponse.response : String(aiResponse.response || '');
    const confidence = typeof aiResponse.confidence === 'number' ? aiResponse.confidence : 0.5;
    const reasoning = typeof aiResponse.reasoning === 'string' ? aiResponse.reasoning : "Generated based on your digital life patterns and personality";
    
    return {
      response,
      confidence,
      reasoning,
      modulesFocused: (analysis as any)?.scope?.modules || [],
      patternMatches: (analysis as any)?.relevantPatterns?.map((p: any) => p.id) || [],
      provider
    };
  }

  /**
   * Build comprehensive prompt for Digital Life Twin (enhanced with smart patterns and semantics)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildDigitalTwinPrompt(query: LifeTwinQuery, userContext: UserContext, personality: any, analysis: any, smartAnalysis?: any, semanticEnhancement?: any, userDefinedContext?: Array<Record<string, unknown>>): string {
    const currentTime = new Date().toLocaleString();
    
    // Build user-defined context section
    let userContextSection = '';
    if (userDefinedContext && userDefinedContext.length > 0) {
      // Filter contexts relevant to current query/module
      const relevantContexts = userDefinedContext.filter(ctx => {
        const queryLower = query.query.toLowerCase();
        const moduleMatch = !ctx.moduleId || ctx.moduleId === query.context.currentModule;
        const contentMatch = ctx.content && typeof ctx.content === 'string' && 
          (queryLower.includes(ctx.content.toLowerCase().substring(0, 20)) || 
           ctx.content.toLowerCase().includes(queryLower.substring(0, 20)));
        return moduleMatch || contentMatch;
      }).slice(0, 5); // Top 5 most relevant

      if (relevantContexts.length > 0) {
        userContextSection = `\n\nUSER-DEFINED CONTEXT (IMPORTANT - Follow these instructions):
${relevantContexts.map((ctx, idx) => {
          const scope = ctx.scope ? `[${ctx.scope}]` : '';
          const module = ctx.moduleId ? `[Module: ${ctx.moduleId}]` : '';
          return `${idx + 1}. ${scope} ${module} ${ctx.title || 'Context'}:
   ${ctx.content || ''}
   Type: ${ctx.contextType || 'instruction'}`;
        }).join('\n\n')}`;
      }
    }
    
    return `You are ${personality?.traits?.name || 'the user'}'s Digital Life Twin - an AI that understands and operates as their digital representation across their entire life ecosystem.

PERSONALITY PROFILE:
- Openness: ${personality?.traits?.openness || 50}/100
- Conscientiousness: ${personality?.traits?.conscientiousness || 50}/100  
- Extraversion: ${personality?.traits?.extraversion || 50}/100
- Agreeableness: ${personality?.traits?.agreeableness || 50}/100
- Risk Tolerance: ${personality?.traits?.riskTolerance || 50}/100
- Communication Style: ${personality?.preferences?.communication?.formality || 'professional but friendly'}
- Planning Horizon: ${personality?.preferences?.decision?.timeframePreference || 'planned'}

CURRENT DIGITAL LIFE STATE:
- Active Modules: ${userContext.activeModules.join(', ')}
- Current Focus: ${userContext.currentFocus.activity} (${userContext.currentFocus.priority} priority)
- Work-Life Balance Score: ${userContext.lifeState.workLifeBalance.score}/100
- Productivity Score: ${userContext.lifeState.productivity.score}/100
- Relationship Health: ${userContext.lifeState.relationships.score}/100

RECENT PATTERNS:
${userContext.patterns.slice(0, 3).map(p => `- ${p.pattern} (${Math.round(p.confidence * 100)}% confidence)`).join('\n')}

KEY INSIGHTS:
${userContext.crossModuleInsights.slice(0, 3).map(i => `- ${i.title}: ${i.description}`).join('\n')}

SMART PATTERN ANALYSIS:
${(smartAnalysis as Record<string, any>)?.patterns?.slice(0, 3).map((p: Record<string, unknown>) => `- ${p.pattern} (${Math.round((p.confidence as number) * 100)}% confidence)`).join('\n') || '- Learning your patterns...'}

INTELLIGENT PREDICTIONS:
${(smartAnalysis as Record<string, any>)?.predictions?.slice(0, 2).map((pred: Record<string, unknown>) => `- ${pred.description} (${Math.round((pred.confidence as number) * 100)}% confidence)`).join('\n') || '- Building predictive insights...'}

SEMANTIC CONTEXT:
${(semanticEnhancement as Record<string, any>)?.relatedQueries?.length > 0 ? 
  `Similar past queries:\n${(semanticEnhancement as Record<string, any>).relatedQueries.slice(0, 2).map((rq: Record<string, unknown>) => `- "${rq.query}" (${Math.round((rq.similarity as number) * 100)}% similar)`).join('\n')}` : 
  '- Learning query patterns...'}
- Suggested categories: ${semanticEnhancement?.suggestedCategories?.join(', ') || 'general'}
- Context understanding boost: +${Math.round((semanticEnhancement?.confidenceBoost || 0) * 100)}%

CURRENT CONTEXT:
- Time: ${currentTime}
- Current Module: ${query.context.currentModule || 'Dashboard'}
- Dashboard Type: ${query.context.dashboardType || 'Personal'}
- Query Urgency: ${analysis.urgency}

USER QUERY: "${query.query}"

INSTRUCTIONS:
Respond as the user's Digital Life Twin, demonstrating deep understanding of their:
1. Personality and communication style
2. Current life situation and priorities  
3. Patterns and behaviors across all modules
4. Relationships and responsibilities

Your response should:
- Reflect their personality in tone and approach
- Consider cross-module connections and implications
- Suggest actions that align with their patterns and goals
- Show awareness of their current context and priorities
- Be helpful while respecting their autonomy preferences
- CRITICALLY: Follow any user-defined context instructions above - these are explicit preferences and workflows the user has defined${userContextSection}

Respond naturally as if you ARE them, making decisions and suggestions they would make.`;
  }

  /**
   * Identify cross-module connections and opportunities
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async identifyCrossModuleConnections(
    query: LifeTwinQuery, 
    userContext: UserContext, 
    response: any
  ): Promise<CrossModuleConnection[]> {
    const connections: CrossModuleConnection[] = [];
    
    // Workflow connections
    if (query.query.toLowerCase().includes('schedule') || query.query.toLowerCase().includes('meeting')) {
      connections.push({
        type: 'workflow',
        description: 'Scheduling affects Calendar, Chat notifications, and Drive document sharing',
        modules: ['household', 'chat', 'drive'],
        strength: 0.8,
        actionable: true,
        suggestedAction: 'Automatically share relevant documents with meeting participants'
      });
    }
    
    // Relationship connections
    const mentionedPeople = this.extractPeopleFromQuery(query.query);
    if (mentionedPeople.length > 0) {
      connections.push({
        type: 'relationship',
        description: `Actions involving ${mentionedPeople.join(', ')} may affect multiple communication channels`,
        modules: ['chat', 'business'],
        strength: 0.7,
        actionable: true,
        suggestedAction: 'Consider notifying all relevant channels'
      });
    }
    
    // Pattern-based connections
    const relevantPatterns = userContext.patterns.filter((p: any) => 
      this.isPatternRelevant(p as any, query.query.toLowerCase(), 'action')
    );
    
    relevantPatterns.forEach((pattern: any) => {
      if (pattern.modules.length > 1) {
        connections.push({
          type: 'pattern',
          description: `This aligns with your ${pattern.pattern} pattern across ${pattern.modules.join(' and ')}`,
          modules: pattern.modules,
          strength: pattern.confidence,
          actionable: pattern.impact === 'positive',
          suggestedAction: pattern.impact === 'positive' ? 'Leverage this pattern for efficiency' : 'Consider adjusting approach'
        });
      }
    });
    
    return connections;
  }

  /**
   * Determine actions the Digital Life Twin should take
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async determineActions(
    query: LifeTwinQuery, 
    userContext: UserContext, 
    personality: any, 
    response: any
  ): Promise<LifeTwinAction[]> {
    const actions: LifeTwinAction[] = [];
    const queryLower = query.query.toLowerCase();
    
    // Get autonomy settings
    const autonomySettings = await this.getAutonomySettings(query.userId);
    
    // Schedule-related actions
    if (queryLower.includes('schedule') || queryLower.includes('meeting') || queryLower.includes('calendar')) {
      const scheduleAction = await this.createScheduleAction(query, userContext, autonomySettings);
      if (scheduleAction) actions.push(scheduleAction);
    }
    
    // Communication actions
    if (queryLower.includes('message') || queryLower.includes('email') || queryLower.includes('notify')) {
      const commAction = await this.createCommunicationAction(query, userContext, autonomySettings);
      if (commAction) actions.push(commAction);
    }
    
    // File organization actions
    if (queryLower.includes('organize') || queryLower.includes('file') || queryLower.includes('folder')) {
      const fileAction = await this.createFileAction(query, userContext, autonomySettings);
      if (fileAction) actions.push(fileAction);
    }
    
    // Task management actions
    if (queryLower.includes('task') || queryLower.includes('todo') || queryLower.includes('remind')) {
      // Check if this is a priority-related query
      if (queryLower.includes('priorit') || queryLower.includes('focus') || 
          queryLower.includes('what should i') || queryLower.includes('optimize')) {
        const priorityAction = await this.createPriorityAction(query, userContext, autonomySettings);
        if (priorityAction) actions.push(priorityAction);
      } else {
        const taskAction = await this.createTaskAction(query, userContext, autonomySettings);
        if (taskAction) actions.push(taskAction);
      }
    }
    
    // Analysis actions
    if (queryLower.includes('analyze') || queryLower.includes('report') || queryLower.includes('summary')) {
      const analysisAction = await this.createAnalysisAction(query, userContext, autonomySettings);
      if (analysisAction) actions.push(analysisAction);
    }
    
    return actions;
  }

  // Action creation methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async createScheduleAction(query: LifeTwinQuery, userContext: UserContext, autonomySettings: any): Promise<LifeTwinAction | null> {
    if (autonomySettings?.scheduling < 30) return null; // User prefers manual scheduling
    
    return {
      id: `schedule_${Date.now()}`,
      type: 'schedule',
      module: 'household',
      description: 'Create calendar event based on request',
      data: {
        title: this.extractEventTitle(query.query),
        duration: this.extractDuration(query.query) || 60,
        participants: this.extractPeopleFromQuery(query.query)
      },
      requiresApproval: autonomySettings.scheduling < 70,
      approvalReason: autonomySettings.scheduling < 70 ? 'User prefers approval for scheduling' : undefined,
      confidence: 0.8,
      priority: 'medium',
      estimatedTime: 5,
      peopleAffected: this.extractPeopleFromQuery(query.query),
      consequences: ['Calendar will be updated', 'Participants will be notified']
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async createCommunicationAction(query: LifeTwinQuery, userContext: UserContext, autonomySettings: any): Promise<LifeTwinAction | null> {
    if (autonomySettings.communication < 40) return null;
    
    return {
      id: `comm_${Date.now()}`,
      type: 'communicate',
      module: 'chat',
      description: 'Send message or notification',
      data: {
        recipients: this.extractPeopleFromQuery(query.query),
        message: this.extractMessageContent(query.query),
        channel: 'chat'
      },
      requiresApproval: autonomySettings.communication < 80,
      confidence: 0.7,
      priority: 'medium',
      estimatedTime: 2,
      peopleAffected: this.extractPeopleFromQuery(query.query),
      consequences: ['Message will be sent', 'Recipients will be notified']
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async createFileAction(query: LifeTwinQuery, userContext: UserContext, autonomySettings: any): Promise<LifeTwinAction | null> {
    if (autonomySettings.fileManagement < 50) return null;
    
    return {
      id: `file_${Date.now()}`,
      type: 'organize',
      module: 'drive',
      description: 'Organize files based on patterns',
      data: {
        action: 'organize',
        criteria: this.extractOrganizationCriteria(query.query)
      },
      requiresApproval: autonomySettings.fileManagement < 80,
      confidence: 0.75,
      priority: 'low',
      estimatedTime: 15,
      peopleAffected: [],
      consequences: ['Files will be reorganized', 'Folder structure may change']
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async createTaskAction(query: LifeTwinQuery, userContext: UserContext, autonomySettings: any): Promise<LifeTwinAction | null> {
    if (autonomySettings.taskCreation < 40) return null;
    
    return {
      id: `task_${Date.now()}`,
      type: 'create',
      module: 'todo',
      description: 'Create task based on request',
      data: {
        title: this.extractTaskTitle(query.query),
        priority: this.extractPriority(query.query),
        dueDate: this.extractDueDate(query.query)
      },
      requiresApproval: autonomySettings.taskCreation < 70,
      confidence: 0.8,
      priority: 'medium',
      estimatedTime: 3,
      peopleAffected: [],
      consequences: ['New task will be created', 'Task will appear in To-Do module']
    };
  }

  /**
   * Create priority action for task prioritization
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async createPriorityAction(query: LifeTwinQuery, userContext: UserContext, autonomySettings: any): Promise<LifeTwinAction | null> {
    // Priority changes are lower risk, so allow with lower autonomy threshold
    if (autonomySettings.taskCreation < 30) return null;
    
    const queryLower = query.query.toLowerCase();
    const isBulk = queryLower.includes('all') || queryLower.includes('tasks') || queryLower.includes('my tasks');
    
    return {
      id: `priority_${Date.now()}`,
      type: 'organize' as const,
      module: 'todo',
      description: isBulk 
        ? 'Analyze and prioritize all tasks' 
        : 'Analyze and suggest task priorities',
      data: {
        action: isBulk ? 'bulk_prioritize' : 'analyze_priorities',
        dashboardId: userContext.currentFocus?.dashboardId,
        businessId: userContext.currentFocus?.businessId,
      } as LifeTwinActionData,
      requiresApproval: autonomySettings.taskCreation < 60, // Lower threshold for priority changes
      approvalReason: autonomySettings.taskCreation < 60 
        ? 'User prefers approval for priority changes' 
        : undefined,
      confidence: 0.75,
      priority: 'medium',
      estimatedTime: 5,
      peopleAffected: [],
      consequences: ['Task priorities will be analyzed', 'Priority suggestions will be generated']
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async createAnalysisAction(query: LifeTwinQuery, userContext: UserContext, autonomySettings: any): Promise<LifeTwinAction | null> {
    return {
      id: `analysis_${Date.now()}`,
      type: 'analyze',
      module: 'ai',
      description: 'Generate analysis or insights',
      data: {
        type: 'insight_generation',
        scope: this.extractAnalysisScope(query.query)
      },
      requiresApproval: false, // Analysis generally doesn't require approval
      confidence: 0.9,
      priority: 'medium',
      estimatedTime: 10,
      peopleAffected: [],
      consequences: ['Analysis will be generated', 'Insights will be provided']
    };
  }

  // Utility methods
  private determineQueryType(query: string): string {
    if (query.includes('schedule') || query.includes('calendar')) return 'scheduling';
    if (query.includes('message') || query.includes('send') || query.includes('email')) return 'communication';
    if (query.includes('organize') || query.includes('file') || query.includes('folder')) return 'organization';
    if (query.includes('analyze') || query.includes('report') || query.includes('summary')) return 'analysis';
    if (query.includes('task') || query.includes('todo') || query.includes('remind')) return 'task_management';
    if (query.includes('?') || query.includes('how') || query.includes('what') || query.includes('why')) return 'question';
    return 'general';
  }

  private determineQueryScope(query: string, userContext: UserContext): { type: string; modules: string[] } {
    const modules = [];
    if (query.includes('drive') || query.includes('file') || query.includes('document')) modules.push('drive');
    if (query.includes('chat') || query.includes('message') || query.includes('conversation')) modules.push('chat');
    if (query.includes('household') || query.includes('task') || query.includes('schedule')) modules.push('household');
    if (query.includes('business') || query.includes('project') || query.includes('team')) modules.push('business');
    
    return {
      type: modules.length > 1 ? 'cross_module' : 'single_module',
      modules: modules.length > 0 ? modules : [userContext.currentFocus.module]
    };
  }

  private determineUrgency(query: string, contextUrgency?: string): string {
    if (contextUrgency) return contextUrgency;
    if (query.includes('urgent') || query.includes('asap') || query.includes('now')) return 'high';
    if (query.includes('soon') || query.includes('today')) return 'medium';
    return 'low';
  }

  private requiresAction(query: string): boolean {
    const actionWords = ['schedule', 'create', 'send', 'organize', 'delete', 'update', 'remind', 'notify'];
    return actionWords.some(word => query.includes(word));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateQueryComplexity(query: string, scope: any, patternCount: number): string {
    let complexity = 0;
    complexity += query.split(' ').length > 10 ? 2 : 1;
    complexity += scope.type === 'cross_module' ? 2 : 1;
    complexity += patternCount > 3 ? 2 : 1;
    
    if (complexity >= 5) return 'high';
    if (complexity >= 3) return 'medium';
    return 'low';
  }

  private isPatternRelevant(pattern: Record<string, unknown>, query: string, queryType: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pattern as any;
    return p.modules?.some((module: string) => query.includes(module)) ||
           p.type === queryType ||
           query.includes(p.pattern?.toLowerCase() || '');
  }

  private isRelationshipRelevant(relationship: Record<string, unknown>, query: string, queryType: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = relationship as any;
    return query.includes(r.name?.toLowerCase() || '') ||
           (queryType === 'communication' && r.modules?.includes('chat'));
  }

  private extractRelevantInsights(userContext: UserContext, query: LifeTwinQuery): CrossModuleInsight[] {
    return userContext.crossModuleInsights
      .filter(insight => {
        const queryLower = query.query.toLowerCase();
        return insight.modules.some(module => query.context.currentModule === module) ||
               queryLower.includes(insight.type) ||
               insight.title.toLowerCase().includes(queryLower.split(' ')[0]);
      })
      .slice(0, 3);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculatePersonalityAlignment(response: any, personality: any): number {
    // Calculate how well the response aligns with user's personality
    // This is a simplified calculation - could be much more sophisticated
    let alignment = 0.5; // Base alignment
    
    if (personality?.traits?.conscientiousness > 70 && response.response.includes('organize')) {
      alignment += 0.2;
    }
    
    if (personality?.traits?.extraversion > 70 && response.response.includes('collaborate')) {
      alignment += 0.2;
    }
    
    if (personality?.preferences?.communication?.formality === 'formal' && 
        !response.response.includes('hey') && !response.response.includes('cool')) {
      alignment += 0.1;
    }
    
    return Math.min(alignment, 1.0);
  }

  // Provider and settings methods
  private selectAIProvider(complexity: string, query: string): string {
    // Route to appropriate provider based on complexity and content
    const sensitiveContent = this.containsSensitiveContent(query);
    
    if (sensitiveContent) return 'local';
    if (complexity === 'high') return 'anthropic';
    return 'openai';
  }

  private containsSensitiveContent(query: string): boolean {
    const sensitiveKeywords = ['password', 'ssn', 'credit card', 'bank', 'medical', 'health'];
    return sensitiveKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  private async callAIProvider(provider: string, prompt: string, options: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      // Import AI providers
      const { OpenAIProvider } = await import('../providers/OpenAIProvider');
      const { AnthropicProvider } = await import('../providers/AnthropicProvider');
      const { LocalProvider } = await import('../providers/LocalProvider');

      // Create AI request object
      const aiRequest = {
        id: `ai_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: options.userId || 'system',
        query: prompt,
        context: options,
        timestamp: new Date(),
        priority: 'medium' as const
      };

      // Create user context (minimal for now)
      const userContext = {
        userId: options.userId || 'system',
        personalityProfile: {},
        preferences: {},
        recentActivity: [],
        dashboardContext: {},
        personality: {},
        autonomySettings: {}
      };

      // Call the appropriate provider
      let response;
      const aiRequestTyped = aiRequest as any; // AI request structures are runtime-determined
      const userContextTyped = userContext as any; // User context structures are runtime-determined
      if (provider === 'openai') {
        const openaiProvider = new OpenAIProvider();
        response = await openaiProvider.process(aiRequestTyped, userContextTyped, {});
      } else if (provider === 'anthropic') {
        const anthropicProvider = new AnthropicProvider();
        response = await anthropicProvider.process(aiRequestTyped, userContextTyped, {});
      } else {
        const localProvider = new LocalProvider();
        response = await localProvider.process(aiRequestTyped, userContextTyped, {});
      }

      return {
        response: response.response,
        confidence: response.confidence,
        reasoning: response.reasoning || "Generated using AI provider analysis"
      };
    } catch (error) {
      console.error(`Error calling AI provider ${provider}:`, error);
      
      // Fallback to mock response if AI provider fails
      return {
        response: "I understand your request and I'm working to provide the best response. (AI provider temporarily unavailable)",
        confidence: 0.6,
        reasoning: "Fallback response due to AI provider connection issue"
      };
    }
  }

  private async getAutonomySettings(userId: string): Promise<Record<string, unknown>> {
    const settings = await this.prisma.aIAutonomySettings.findUnique({
      where: { userId }
    });
    
    return settings || {
      scheduling: 50,
      communication: 30,
      fileManagement: 60,
      taskCreation: 50,
      dataAnalysis: 80,
      crossModuleActions: 40
    };
  }

  // Extraction utility methods
  private extractEventTitle(query: string): string {
    // Simple extraction - could be much more sophisticated
    const words = query.split(' ');
    const scheduleIndex = words.findIndex(w => w.includes('schedule') || w.includes('meeting'));
    return scheduleIndex >= 0 ? words.slice(scheduleIndex + 1, scheduleIndex + 4).join(' ') : 'New Event';
  }

  private extractDuration(query: string): number | null {
    const match = query.match(/(\d+)\s*(hour|minute|hr|min)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      return unit.startsWith('hour') || unit === 'hr' ? value * 60 : value;
    }
    return null;
  }

  private extractPeopleFromQuery(query: string): string[] {
    // Simple name extraction - could use NER for better results
    const commonNames = ['sarah', 'john', 'mike', 'jane', 'alex', 'chris', 'sam'];
    const words = query.toLowerCase().split(' ');
    return words.filter(word => commonNames.includes(word));
  }

  private extractMessageContent(query: string): string {
    // Extract message content from query
    const messageIndicators = ['message', 'tell', 'send', 'notify'];
    const words = query.split(' ');
    
    for (const indicator of messageIndicators) {
      const index = words.findIndex(w => w.toLowerCase().includes(indicator));
      if (index >= 0) {
        return words.slice(index + 1).join(' ');
      }
    }
    
    return query;
  }

  private extractOrganizationCriteria(query: string): string {
    if (query.includes('date')) return 'by_date';
    if (query.includes('type') || query.includes('extension')) return 'by_type';
    if (query.includes('project')) return 'by_project';
    return 'by_type';
  }

  private extractTaskTitle(query: string): string {
    const taskIndicators = ['task', 'todo', 'remind'];
    const words = query.split(' ');
    
    for (const indicator of taskIndicators) {
      const index = words.findIndex(w => w.toLowerCase().includes(indicator));
      if (index >= 0) {
        return words.slice(index + 1, index + 5).join(' ');
      }
    }
    
    return 'New Task';
  }

  private extractPriority(query: string): string {
    if (query.includes('urgent') || query.includes('high')) return 'HIGH';
    if (query.includes('low')) return 'LOW';
    return 'MEDIUM';
  }

  private extractDueDate(query: string): Date | null {
    if (query.includes('today')) return new Date();
    if (query.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    return null;
  }

  private extractAnalysisScope(query: string): string {
    if (query.includes('productivity')) return 'productivity';
    if (query.includes('relationship')) return 'relationships';
    if (query.includes('file') || query.includes('organization')) return 'organization';
    if (query.includes('communication')) return 'communication';
    return 'general';
  }

  /**
   * Create fallback user context when full context cannot be loaded
   */
  private createFallbackUserContext(userId: string): UserContext {
    return {
      userId,
      timestamp: new Date(),
      activeModules: ['household', 'chat', 'drive', 'business'],
      crossModuleInsights: [],
      currentFocus: {
        module: 'general',
        activity: 'general_usage',
        priority: 'medium',
        timeSpent: 0
      },
      patterns: [],
      relationships: [],
      preferences: {
        communication: {
          preferredChannels: ['email', 'chat'],
          responseTimeExpectations: { email: 240, chat: 30 },
          formalityLevel: 70,
          timezone: 'UTC'
        },
        work: {
          productiveHours: [9, 10, 11, 14, 15, 16],
          focusBlockPreference: 120,
          interruptionTolerance: 50,
          collaborationStyle: 'collaborative',
          prioritizationMethod: 'importance'
        },
        personal: {
          socialEngagement: 70,
          privacyLevel: 80,
          sharingComfort: 60,
          planningHorizon: 7
        }
      },
      lifeState: {
        workLifeBalance: { 
          score: 70, 
          trend: 'stable', 
          concerns: [], 
          opportunities: [] 
        },
        productivity: { 
          score: 75, 
          peakHours: [9, 10, 14, 15], 
          efficiency: 75,
          bottlenecks: [] 
        },
        relationships: { 
          score: 80, 
          socialConnections: 25, 
          communicationHealth: 80,
          networkGrowth: 5 
        },
        goals: {
          activeGoals: 5,
          progressRate: 70,
          completionRate: 80,
          alignment: 75
        }
      }
    };
  }
}

export default DigitalLifeTwinCore;