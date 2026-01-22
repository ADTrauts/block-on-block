import { PrismaClient } from '@prisma/client';
import { CrossModuleContextEngine } from '../context/CrossModuleContextEngine';
import { CentralizedLearningEngine } from './CentralizedLearningEngine';

export interface LearningEventData {
  action?: string;
  context?: Record<string, unknown>;
  feedback?: { rating: number; comment?: string };
  correction?: { expected: unknown; actual: unknown };
  [key: string]: unknown;
}

export interface LearningEvent {
  id: string;
  userId: string;
  eventType: 'interaction' | 'feedback' | 'correction' | 'pattern' | 'prediction';
  module: string;
  data: LearningEventData;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  processed: boolean;
}

export interface LearningPatternData {
  occurrences?: Array<{ timestamp: Date; context: Record<string, unknown> }>;
  triggers?: string[];
  outcomes?: Array<{ result: string; success: boolean }>;
  [key: string]: unknown;
}

export interface LearningPattern {
  id: string;
  userId: string;
  patternType: 'behavioral' | 'temporal' | 'preference' | 'communication' | 'decision';
  confidence: number;
  strength: number;
  frequency: number;
  lastObserved: Date;
  data: LearningPatternData;
  predictions: Prediction[];
}

export interface PredictionData {
  basis?: string[];
  factors?: Array<{ factor: string; weight: number }>;
  alternatives?: Array<{ option: string; probability: number }>;
  [key: string]: unknown;
}

export interface Prediction {
  id: string;
  userId: string;
  type: 'action' | 'preference' | 'schedule' | 'communication' | 'decision';
  confidence: number;
  probability: number;
  timeframe: 'immediate' | 'short_term' | 'long_term';
  description: string;
  data: PredictionData;
  createdAt: Date;
  expiresAt: Date;
  validated: boolean;
}

export interface LearningInsightData {
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  evidence?: Array<{ source: string; value: unknown }>;
  impact?: { area: string; magnitude: number };
  [key: string]: unknown;
}

export interface LearningInsight {
  id: string;
  userId: string;
  insightType: 'behavior_change' | 'preference_shift' | 'pattern_emergence' | 'anomaly_detection';
  confidence: number;
  significance: number;
  description: string;
  recommendations: string[];
  data: LearningInsightData;
  createdAt: Date;
}

export interface AdaptiveResponse {
  personalityAdjustments: PersonalityAdjustment[];
  behaviorModifications: BehaviorModification[];
  newPredictions: Prediction[];
  insights: LearningInsight[];
  recommendations: string[];
}

export interface PersonalityAdjustment {
  trait: string;
  currentValue: number;
  newValue: number;
  confidence: number;
  reasoning: string;
  evidence: string[];
}

export interface BehaviorModification {
  behavior: string;
  context: string;
  modification: 'increase' | 'decrease' | 'change';
  confidence: number;
  reasoning: string;
}

export class AdvancedLearningEngine {
  private prisma: PrismaClient;
  private contextEngine: CrossModuleContextEngine;
  private centralizedLearning: CentralizedLearningEngine;
  private learningCache: Map<string, any> = new Map();
  private patternCache: Map<string, LearningPattern[]> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.contextEngine = new CrossModuleContextEngine();
    this.centralizedLearning = new CentralizedLearningEngine(prisma);
  }

  /**
   * Process an AI interaction for learning
   */
  async processInteraction(
    request: any,
    response: any,
    context: any
  ): Promise<void> {
    // Process the interaction for learning
    const learningEvent: Omit<LearningEvent, 'id' | 'timestamp' | 'processed'> = {
      userId: request.userId,
      eventType: 'interaction',
      module: context.currentModule || 'unknown',
      data: { request, response, context },
      confidence: response.confidence || 0.5,
      impact: 'medium'
    };

    await this.processLearningEvent(learningEvent);
  }

  /**
   * Process a learning event and update AI understanding
   */
  async processLearningEvent(event: Omit<LearningEvent, 'id' | 'timestamp' | 'processed'>): Promise<AdaptiveResponse> {
    const learningEvent = await this.prisma.aILearningEvent.create({
      data: {
        userId: event.userId,
        eventType: event.eventType,
        context: event.module, // Use 'context' instead of 'module'
        newBehavior: JSON.stringify(event.data), // Use 'newBehavior' instead of 'data'
        confidence: event.confidence,
        patternData: JSON.parse(JSON.stringify({ impact: event.impact, data: event.data })), // Use 'patternData' for additional data
        frequency: 1,
        applied: false,
        validated: false
      }
    });

    // Analyze the event for patterns
    const patterns = await this.analyzeEventForPatterns(learningEvent);
    
    // Update personality based on event
    const personalityAdjustments = await this.updatePersonalityFromEvent(learningEvent);
    
    // Extract and save explicit facts from conversation (if this is a conversation event)
    // This complements pattern learning by capturing WHAT the user told us, not just HOW they behave
    if (event.eventType === 'interaction') {
      try {
        const eventData = event.data as any;
        // Check multiple possible data structures (request/response or userQuery/aiResponse)
        const userQuery = eventData?.request?.query || eventData?.userQuery || eventData?.query;
        const aiResponse = eventData?.response?.response || eventData?.aiResponse || eventData?.response;
        
        if (userQuery && aiResponse) {
          // Import fact extraction service dynamically to avoid circular dependencies
          const { factExtractionService } = await import('../../services/factExtractionService');
          await factExtractionService.extractAndSaveFacts(
            event.userId,
            userQuery,
            aiResponse,
            eventData?.context || eventData?.request?.context
          ).catch(err => {
            // Log but don't fail - fact extraction is non-critical
            console.warn('Fact extraction in learning engine failed:', err);
          });
        }
      } catch (error) {
        // Silently fail - fact extraction shouldn't break learning
        console.warn('Error extracting facts in learning engine:', error);
      }
    }
    
    // Generate new predictions
    const newPredictions = await this.generatePredictionsFromEvent(learningEvent);
    
    // Create insights
    const insights = await this.createInsightsFromEvent(learningEvent, patterns);
    
    // Generate behavior modifications
    const behaviorModifications = await this.generateBehaviorModifications(learningEvent, patterns);
    
    // Create recommendations
    const recommendations = await this.generateRecommendations(learningEvent, insights);

    // Mark event as applied
    await this.prisma.aILearningEvent.update({
      where: { id: learningEvent.id },
      data: { applied: true }
    });

    // Send event to centralized learning system for global pattern recognition
    try {
      await this.centralizedLearning.processGlobalLearningEvent(
        event.userId,
        {
          eventType: event.eventType,
          context: event.module,
          patternData: { data: event.data },
          confidence: event.confidence,
          impact: event.impact
        }
      );
    } catch (error) {
      console.error('Error sending event to centralized learning:', error);
      // Don't fail the local learning process if centralized learning fails
    }

    return {
      personalityAdjustments,
      behaviorModifications,
      newPredictions,
      insights,
      recommendations
    };
  }

  /**
   * Analyze an event for behavioral patterns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async analyzeEventForPatterns(event: any): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];
    
    // Get recent events for pattern analysis
    const recentEvents = await this.prisma.aILearningEvent.findMany({
      where: { 
        userId: event.userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Analyze temporal patterns
    const temporalPatterns = this.analyzeTemporalPatterns(recentEvents);
    patterns.push(...temporalPatterns);

    // Analyze behavioral patterns
    const behavioralPatterns = this.analyzeBehavioralPatterns(recentEvents);
    patterns.push(...behavioralPatterns);

    // Analyze preference patterns
    const preferencePatterns = this.analyzePreferencePatterns(recentEvents);
    patterns.push(...preferencePatterns);

    // Analyze communication patterns
    const communicationPatterns = this.analyzeCommunicationPatterns(recentEvents);
    patterns.push(...communicationPatterns);

    // Save patterns to database
    for (const pattern of patterns) {
      await this.prisma.aILearningEvent.create({
        data: {
          userId: pattern.userId,
          eventType: 'pattern',
          context: 'learning', // Use 'context' instead of 'module'
          newBehavior: JSON.stringify(pattern), // Use 'newBehavior' instead of 'data'
          confidence: pattern.confidence,
          patternData: JSON.parse(JSON.stringify({ impact: 'medium', data: pattern.data })),
          frequency: pattern.frequency,
          applied: true,
          validated: true
        }
      });
    }

    return patterns;
  }

  /**
   * Analyze temporal patterns in user behavior
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzeTemporalPatterns(events: any[]): LearningPattern[] {
    const patterns: LearningPattern[] = [];
    
    // Group events by hour of day
    const hourlyActivity = new Map<number, number>();
    events.forEach(event => {
      const hour = new Date(event.createdAt).getHours();
      hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + 1);
    });

    // Find peak activity hours
    const peakHours = Array.from(hourlyActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (peakHours.length > 0) {
      patterns.push({
        id: `temporal_${Date.now()}`,
        userId: events[0]?.userId || '',
        patternType: 'temporal',
        confidence: 0.8,
        strength: peakHours[0][1] / events.length,
        frequency: peakHours.length,
        lastObserved: new Date(),
        data: { peakHours, hourlyActivity: Object.fromEntries(hourlyActivity) },
        predictions: []
      });
    }

    // Analyze day-of-week patterns
    const dailyActivity = new Map<number, number>();
    events.forEach(event => {
      const day = new Date(event.createdAt).getDay();
      dailyActivity.set(day, (dailyActivity.get(day) || 0) + 1);
    });

    if (dailyActivity.size > 0) {
      patterns.push({
        id: `daily_${Date.now()}`,
        userId: events[0]?.userId || '',
        patternType: 'temporal',
        confidence: 0.7,
        strength: Math.max(...dailyActivity.values()) / events.length,
        frequency: dailyActivity.size,
        lastObserved: new Date(),
        data: { dailyActivity: Object.fromEntries(dailyActivity) },
        predictions: []
      });
    }

    return patterns;
  }

  /**
   * Analyze behavioral patterns in user actions
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzeBehavioralPatterns(events: any[]): LearningPattern[] {
    const patterns: LearningPattern[] = [];
    
    // Group events by context (module)
    const moduleActivity = new Map<string, number>();
    events.forEach(event => {
      moduleActivity.set(event.context, (moduleActivity.get(event.context) || 0) + 1);
    });

    // Find most active modules
    const activeModules = Array.from(moduleActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (activeModules.length > 0) {
      patterns.push({
        id: `behavioral_${Date.now()}`,
        userId: events[0]?.userId || '',
        patternType: 'behavioral',
        confidence: 0.9,
        strength: activeModules[0][1] / events.length,
        frequency: activeModules.length,
        lastObserved: new Date(),
        data: { activeModules, moduleActivity: Object.fromEntries(moduleActivity) },
        predictions: []
      });
    }

    // Analyze action preferences
    const actionTypes = new Map<string, number>();
    events.forEach(event => {
      if (event.patternData) {
        const data = event.patternData as any;
        if (data.actionType) {
          actionTypes.set(data.actionType, (actionTypes.get(data.actionType) || 0) + 1);
        }
      }
    });

    if (actionTypes.size > 0) {
      patterns.push({
        id: `actions_${Date.now()}`,
        userId: events[0]?.userId || '',
        patternType: 'behavioral',
        confidence: 0.8,
        strength: Math.max(...actionTypes.values()) / events.length,
        frequency: actionTypes.size,
        lastObserved: new Date(),
        data: { actionTypes: Object.fromEntries(actionTypes) },
        predictions: []
      });
    }

    return patterns;
  }

  /**
   * Analyze preference patterns in user choices
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzePreferencePatterns(events: any[]): LearningPattern[] {
    const patterns: LearningPattern[] = [];
    
    // Analyze confidence preferences
    const confidenceLevels = events.map(e => e.confidence);
    const avgConfidence = confidenceLevels.reduce((a, b) => a + b, 0) / confidenceLevels.length;
    
    if (confidenceLevels.length > 0) {
      patterns.push({
        id: `confidence_${Date.now()}`,
        userId: events[0]?.userId || '',
        patternType: 'preference',
        confidence: 0.7,
        strength: avgConfidence,
        frequency: confidenceLevels.length,
        lastObserved: new Date(),
        data: { 
          averageConfidence: avgConfidence,
          confidenceDistribution: this.getDistribution(confidenceLevels)
        },
        predictions: []
      });
    }

    // Analyze impact preferences
    const impactLevels = events.map(e => {
      if (e.patternData) {
        const data = e.patternData as any;
        return data.impact || 'medium';
      }
      return 'medium';
    });
    const impactCounts = new Map<string, number>();
    impactLevels.forEach(impact => {
      impactCounts.set(impact, (impactCounts.get(impact) || 0) + 1);
    });

    if (impactCounts.size > 0) {
      patterns.push({
        id: `impact_${Date.now()}`,
        userId: events[0]?.userId || '',
        patternType: 'preference',
        confidence: 0.6,
        strength: Math.max(...impactCounts.values()) / events.length,
        frequency: impactCounts.size,
        lastObserved: new Date(),
        data: { impactPreferences: Object.fromEntries(impactCounts) },
        predictions: []
      });
    }

    return patterns;
  }

  /**
   * Analyze communication patterns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzeCommunicationPatterns(events: any[]): LearningPattern[] {
    const patterns: LearningPattern[] = [];
    
    // Analyze interaction frequency
    const interactionEvents = events.filter(e => e.eventType === 'interaction');
    const interactionFrequency = interactionEvents.length / (events.length || 1);
    
    if (interactionEvents.length > 0) {
      patterns.push({
        id: `communication_${Date.now()}`,
        userId: events[0]?.userId || '',
        patternType: 'communication',
        confidence: 0.8,
        strength: interactionFrequency,
        frequency: interactionEvents.length,
        lastObserved: new Date(),
        data: { 
          interactionFrequency,
          totalInteractions: interactionEvents.length,
          averageConfidence: interactionEvents.reduce((sum, e) => sum + e.confidence, 0) / interactionEvents.length
        },
        predictions: []
      });
    }

    return patterns;
  }

  /**
   * Update personality based on learning event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async updatePersonalityFromEvent(event: any): Promise<PersonalityAdjustment[]> {
    const adjustments: PersonalityAdjustment[] = [];
    
    // Get current personality profile
    const personality = await this.prisma.aIPersonalityProfile.findUnique({
      where: { userId: event.userId }
    });

    if (!personality) {
      return adjustments;
    }

    const personalityData = personality.personalityData as any;
    
    // Analyze event impact on personality traits
    const traitAdjustments = this.analyzeTraitImpact(event, personalityData);
    
    for (const [trait, adjustment] of Object.entries(traitAdjustments)) {
      const currentValue = personalityData[trait] || 0.5;
      const newValue = Math.max(0, Math.min(1, currentValue + (adjustment as number)));
      
      if (Math.abs(newValue - currentValue) > 0.05) { // Only adjust if change is significant
        adjustments.push({
          trait,
          currentValue,
          newValue,
          confidence: 0.7,
          reasoning: `Based on ${event.eventType} event in ${event.context}`,
          evidence: [`Event confidence: ${event.confidence}`, `Event impact: ${event.patternData?.impact || 'medium'}`]
        });
      }
    }

    // Update personality profile if there are adjustments
    if (adjustments.length > 0) {
      const updatedPersonalityData = { ...personalityData };
      adjustments.forEach(adj => {
        updatedPersonalityData[adj.trait] = adj.newValue;
      });

      await this.prisma.aIPersonalityProfile.update({
        where: { userId: event.userId },
        data: {
          personalityData: JSON.parse(JSON.stringify(updatedPersonalityData)),
          lastUpdated: new Date()
        }
      });
    }

    return adjustments;
  }

  /**
   * Analyze how an event impacts personality traits
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzeTraitImpact(event: any, personalityData: any): Record<string, number> {
    const adjustments: Record<string, number> = {};
    
    // Define trait impact rules based on event type and context
    const impactRules = {
      'interaction': {
        'communication_style': 0.02,
        'social_preference': 0.01
      },
      'feedback': {
        'adaptability': 0.03,
        'learning_orientation': 0.02
      },
      'correction': {
        'precision': 0.04,
        'attention_to_detail': 0.03
      },
      'pattern': {
        'consistency': 0.02,
        'predictability': 0.01
      }
    };

    const moduleRules = {
      'drive': {
        'organization': 0.02,
        'efficiency': 0.01
      },
      'chat': {
        'communication_style': 0.02,
        'social_preference': 0.01
      },
      'household': {
        'family_orientation': 0.02,
        'responsibility': 0.01
      },
      'business': {
        'professionalism': 0.02,
        'ambition': 0.01
      }
    };

    // Apply event type adjustments
    const eventAdjustments = impactRules[event.eventType as keyof typeof impactRules] || {};
    Object.entries(eventAdjustments).forEach(([trait, adjustment]) => {
      adjustments[trait] = (adjustments[trait] || 0) + adjustment;
    });

    // Apply context adjustments
    const contextAdjustments = moduleRules[event.context as keyof typeof moduleRules] || {};
    Object.entries(contextAdjustments).forEach(([trait, adjustment]) => {
      adjustments[trait] = (adjustments[trait] || 0) + adjustment;
    });

    // Adjust based on confidence and impact
    const confidenceMultiplier = event.confidence / 100;
    const impactMap: Record<'low' | 'medium' | 'high' | 'critical', number> = { low: 0.5, medium: 1, high: 1.5, critical: 2 };
    const impactKey = (event.patternData?.impact ?? 'medium') as 'low' | 'medium' | 'high' | 'critical';
    const impactMultiplier = impactMap[impactKey] ?? 1;

    Object.keys(adjustments).forEach(trait => {
      adjustments[trait] *= confidenceMultiplier * impactMultiplier;
    });

    return adjustments;
  }

  /**
   * Generate predictions based on learning event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generatePredictionsFromEvent(event: any): Promise<Prediction[]> {
    const predictions: Prediction[] = [];
    
    // Get recent patterns for this user
    const patterns = await this.getUserPatterns(event.userId);
    
    // Generate action predictions
    const actionPredictions = this.predictActions(event, patterns);
    predictions.push(...actionPredictions);
    
    // Generate preference predictions
    const preferencePredictions = this.predictPreferences(event, patterns);
    predictions.push(...preferencePredictions);
    
    // Generate schedule predictions
    const schedulePredictions = this.predictSchedule(event, patterns);
    predictions.push(...schedulePredictions);
    
    // Generate communication predictions
    const communicationPredictions = this.predictCommunication(event, patterns);
    predictions.push(...communicationPredictions);

    // Save predictions to database
    for (const prediction of predictions) {
      await this.prisma.aILearningEvent.create({
        data: {
          userId: prediction.userId,
          eventType: 'prediction',
          context: 'learning', // Use 'context' instead of 'module'
          newBehavior: JSON.stringify(prediction), // Use 'newBehavior' instead of 'data'
          confidence: prediction.confidence,
          patternData: JSON.parse(JSON.stringify({ impact: 'medium', data: prediction.data })),
          frequency: 1,
          applied: true,
          validated: true
        }
      });
    }

    return predictions;
  }

  /**
   * Predict user actions based on patterns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private predictActions(event: any, patterns: LearningPattern[]): Prediction[] {
    const predictions: Prediction[] = [];
    
    // Find behavioral patterns
    const behavioralPatterns = patterns.filter(p => p.patternType === 'behavioral');
    
    for (const pattern of behavioralPatterns) {
      if (pattern.data?.actionTypes) {
        const mostLikelyAction = Object.entries(pattern.data.actionTypes)
          .sort((a, b) => (b[1] as number) - (a[1] as number))[0];
        
        if (mostLikelyAction) {
          predictions.push({
            id: `action_${Date.now()}_${Math.random()}`,
            userId: event.userId,
            type: 'action',
            confidence: pattern.confidence * 0.8,
            probability: (mostLikelyAction[1] as number) / pattern.frequency,
            timeframe: 'short_term',
            description: `Likely to perform ${mostLikelyAction[0]} action`,
            data: { predictedAction: mostLikelyAction[0], pattern: pattern.id },
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            validated: false
          });
        }
      }
    }

    return predictions;
  }

  /**
   * Predict user preferences based on patterns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private predictPreferences(event: any, patterns: LearningPattern[]): Prediction[] {
    const predictions: Prediction[] = [];
    
    // Find preference patterns
    const preferencePatterns = patterns.filter(p => p.patternType === 'preference');
    
    for (const pattern of preferencePatterns) {
      if (pattern.data?.confidenceDistribution) {
        const avgConfidence = pattern.data.averageConfidence;
        
        const avgConfidenceNum = typeof avgConfidence === 'number' ? avgConfidence : 0.5;
        predictions.push({
          id: `preference_${Date.now()}_${Math.random()}`,
          userId: event.userId,
          type: 'preference',
          confidence: pattern.confidence * 0.7,
          probability: avgConfidenceNum,
          timeframe: 'long_term',
          description: `Expected confidence level: ${(avgConfidenceNum * 100).toFixed(1)}%`,
          data: { expectedConfidence: avgConfidenceNum, pattern: pattern.id },
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
          validated: false
        });
      }
    }

    return predictions;
  }

  /**
   * Predict user schedule based on temporal patterns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private predictSchedule(event: any, patterns: LearningPattern[]): Prediction[] {
    const predictions: Prediction[] = [];
    
    // Find temporal patterns
    const temporalPatterns = patterns.filter(p => p.patternType === 'temporal');
    
    for (const pattern of temporalPatterns) {
      if (pattern.data?.peakHours && Array.isArray(pattern.data.peakHours)) {
        const peakHours = pattern.data.peakHours as Array<[number, number]>;
        if (peakHours.length > 0) {
          const peakHour = peakHours[0];
          const probability = typeof peakHour[1] === 'number' ? peakHour[1] / pattern.frequency : 0.5;
          const hourValue = typeof peakHour[0] === 'number' ? peakHour[0] : 9;
          
          predictions.push({
            id: `schedule_${Date.now()}_${Math.random()}`,
            userId: event.userId,
            type: 'schedule',
            confidence: pattern.confidence * 0.6,
            probability,
            timeframe: 'immediate',
            description: `Peak activity expected at ${hourValue}:00`,
            data: { peakHour: hourValue, pattern: pattern.id },
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            validated: false
          });
        }
      }
    }

    return predictions;
  }

  /**
   * Predict communication patterns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private predictCommunication(event: any, patterns: LearningPattern[]): Prediction[] {
    const predictions: Prediction[] = [];
    
    // Find communication patterns
    const communicationPatterns = patterns.filter(p => p.patternType === 'communication');
    
    for (const pattern of communicationPatterns) {
      if (pattern.data?.interactionFrequency) {
        const frequency = typeof pattern.data.interactionFrequency === 'number' ? pattern.data.interactionFrequency : 0.5;
        predictions.push({
          id: `communication_${Date.now()}_${Math.random()}`,
          userId: event.userId,
          type: 'communication',
          confidence: pattern.confidence * 0.8,
          probability: frequency,
          timeframe: 'short_term',
          description: `Expected interaction frequency: ${(frequency * 100).toFixed(1)}%`,
          data: { expectedFrequency: frequency, pattern: pattern.id },
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          validated: false
        });
      }
    }

    return predictions;
  }

  /**
   * Create insights from learning event and patterns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async createInsightsFromEvent(event: any, patterns: LearningPattern[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Analyze for behavior changes
    const behaviorChanges = this.analyzeBehaviorChanges(event, patterns);
    insights.push(...behaviorChanges);
    
    // Analyze for preference shifts
    const preferenceShifts = this.analyzePreferenceShifts(event, patterns);
    insights.push(...preferenceShifts);
    
    // Analyze for pattern emergence
    const patternEmergence = this.analyzePatternEmergence(event, patterns);
    insights.push(...patternEmergence);
    
    // Analyze for anomalies
    const anomalies = this.analyzeAnomalies(event, patterns);
    insights.push(...anomalies);

    // Save insights to database
    for (const insight of insights) {
      await this.prisma.aILearningEvent.create({
        data: {
          userId: insight.userId,
          eventType: 'insight',
          context: 'learning', // Use 'context' instead of 'module'
          newBehavior: JSON.stringify(insight), // Use 'newBehavior' instead of 'data'
          confidence: insight.confidence,
          patternData: JSON.parse(JSON.stringify({ impact: 'high', data: insight.data })),
          frequency: 1,
          applied: true,
          validated: true
        }
      });
    }

    return insights;
  }

  /**
   * Analyze behavior changes
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzeBehaviorChanges(event: any, patterns: LearningPattern[]): LearningInsight[] {
    const insights: LearningInsight[] = [];
    
    // Compare current event with historical patterns
    const behavioralPatterns = patterns.filter(p => p.patternType === 'behavioral');
    
    for (const pattern of behavioralPatterns) {
      const currentBehavior = event.context;
      const activeModules = Array.isArray(pattern.data?.activeModules) ? pattern.data.activeModules : [];
      const expectedBehavior = activeModules.length > 0 && Array.isArray(activeModules[0]) ? activeModules[0][0] : null;
      
      if (expectedBehavior && currentBehavior !== expectedBehavior) {
        insights.push({
          id: `behavior_change_${Date.now()}`,
          userId: event.userId,
          insightType: 'behavior_change',
          confidence: 0.8,
          significance: 0.7,
          description: `User switched from ${expectedBehavior} to ${currentBehavior} module`,
          recommendations: [
            'Consider adapting AI responses for the new module',
            'Update user preferences for the current context'
          ],
          data: { 
            previousBehavior: expectedBehavior,
            currentBehavior: currentBehavior,
            pattern: pattern.id
          },
          createdAt: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Analyze preference shifts
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzePreferenceShifts(event: any, patterns: LearningPattern[]): LearningInsight[] {
    const insights: LearningInsight[] = [];
    
    const preferencePatterns = patterns.filter(p => p.patternType === 'preference');
    
    for (const pattern of preferencePatterns) {
      const currentConfidence = event.confidence;
      const expectedConfidence = typeof pattern.data?.averageConfidence === 'number' ? pattern.data.averageConfidence : null;
      
      if (expectedConfidence !== null && Math.abs(currentConfidence - expectedConfidence) > 0.2) {
        insights.push({
          id: `preference_shift_${Date.now()}`,
          userId: event.userId,
          insightType: 'preference_shift',
          confidence: 0.7,
          significance: 0.6,
          description: `User confidence shifted from ${(expectedConfidence * 100).toFixed(1)}% to ${(currentConfidence * 100).toFixed(1)}%`,
          recommendations: [
            'Adjust AI confidence levels accordingly',
            'Review recent interactions for cause of shift'
          ],
          data: { 
            previousConfidence: expectedConfidence,
            currentConfidence: currentConfidence,
            pattern: pattern.id
          },
          createdAt: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Analyze pattern emergence
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzePatternEmergence(event: any, patterns: LearningPattern[]): LearningInsight[] {
    const insights: LearningInsight[] = [];
    
    // Look for new patterns with high confidence
    const newPatterns = patterns.filter(p => p.confidence > 0.8 && p.strength > 0.6);
    
    for (const pattern of newPatterns) {
      insights.push({
        id: `pattern_emergence_${Date.now()}`,
        userId: event.userId,
        insightType: 'pattern_emergence',
        confidence: pattern.confidence,
        significance: pattern.strength,
        description: `New ${pattern.patternType} pattern detected with ${(pattern.confidence * 100).toFixed(1)}% confidence`,
        recommendations: [
          'Incorporate this pattern into AI decision-making',
          'Use pattern for future predictions'
        ],
        data: { 
          patternType: pattern.patternType,
          confidence: pattern.confidence,
          strength: pattern.strength,
          pattern: pattern.id
        },
        createdAt: new Date()
      });
    }

    return insights;
  }

  /**
   * Analyze anomalies
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzeAnomalies(event: any, patterns: LearningPattern[]): LearningInsight[] {
    const insights: LearningInsight[] = [];
    
    // Check for events that don't match expected patterns
    for (const pattern of patterns) {
      const expectedValue = this.getExpectedValueFromPattern(pattern, event);
      const actualValue = this.getActualValueFromEvent(event, pattern);
      
      if (expectedValue && actualValue && Math.abs(actualValue - expectedValue) > 0.3) {
        insights.push({
          id: `anomaly_${Date.now()}`,
          userId: event.userId,
          insightType: 'anomaly_detection',
          confidence: 0.9,
          significance: 0.8,
          description: `Anomaly detected: expected ${expectedValue.toFixed(2)}, got ${actualValue.toFixed(2)}`,
          recommendations: [
            'Investigate cause of anomaly',
            'Consider if this represents a new pattern'
          ],
          data: { 
            expectedValue,
            actualValue,
            pattern: pattern.id
          },
          createdAt: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Generate behavior modifications
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generateBehaviorModifications(event: any, patterns: LearningPattern[]): Promise<BehaviorModification[]> {
    const modifications: BehaviorModification[] = [];
    
    // Analyze patterns for behavior modifications
    for (const pattern of patterns) {
      if (pattern.patternType === 'behavioral' && pattern.strength > 0.7) {
        const activeModules = Array.isArray(pattern.data?.activeModules) ? pattern.data.activeModules : [];
        const firstModule = activeModules.length > 0 && Array.isArray(activeModules[0]) ? activeModules[0][0] : 'general';
        const moduleContext = typeof firstModule === 'string' ? firstModule : 'general';
        
        modifications.push({
          behavior: 'module_preference',
          context: moduleContext,
          modification: 'increase',
          confidence: pattern.confidence,
          reasoning: `Strong pattern detected for ${moduleContext} module usage`
        });
      }
    }

    return modifications;
  }

  /**
   * Generate recommendations based on learning
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generateRecommendations(event: any, insights: LearningInsight[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Generate recommendations based on insights
    for (const insight of insights) {
      recommendations.push(...insight.recommendations);
    }
    
    // Add general recommendations based on event type
    if (event.eventType === 'feedback') {
      recommendations.push('Consider adjusting AI response style based on feedback');
    }
    
    if (event.eventType === 'correction') {
      recommendations.push('Review and improve AI accuracy in this domain');
    }
    
    if (event.confidence < 0.5) {
      recommendations.push('Increase AI confidence through better pattern recognition');
    }

    return recommendations;
  }

  /**
   * Get user patterns from cache or database
   */
  public async getUserPatterns(userId: string): Promise<LearningPattern[]> {
    if (this.patternCache.has(userId)) {
      return this.patternCache.get(userId) || [];
    }

    // Get patterns from database
    const patternEvents = await this.prisma.aILearningEvent.findMany({
      where: { 
        userId,
        eventType: 'pattern',
        applied: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const patterns: LearningPattern[] = patternEvents.map(event => {
      const data = event.patternData as any;
      return {
        id: data.id,
        userId: data.userId,
        patternType: data.patternType,
        confidence: data.confidence,
        strength: data.strength,
        frequency: data.frequency,
        lastObserved: new Date(data.lastObserved),
        data: data.data,
        predictions: data.predictions || []
      };
    });

    this.patternCache.set(userId, patterns);
    return patterns;
  }

  /**
   * Get distribution of values
   */
  private getDistribution(values: number[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    const ranges = [
      { min: 0, max: 0.2, label: '0-20%' },
      { min: 0.2, max: 0.4, label: '20-40%' },
      { min: 0.4, max: 0.6, label: '40-60%' },
      { min: 0.6, max: 0.8, label: '60-80%' },
      { min: 0.8, max: 1, label: '80-100%' }
    ];

    ranges.forEach(range => {
      const count = values.filter(v => v >= range.min && v < range.max).length;
      distribution[range.label] = count / values.length;
    });

    return distribution;
  }

  /**
   * Get expected value from pattern
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getExpectedValueFromPattern(pattern: LearningPattern, event: any): number | null {
    if (pattern.patternType === 'preference' && pattern.data?.averageConfidence) {
      return typeof pattern.data.averageConfidence === 'number' ? pattern.data.averageConfidence : null;
    }
    
    if (pattern.patternType === 'behavioral' && pattern.data?.actionTypes) {
      const actionType = event.patternData?.actionType;
      const actionTypes = pattern.data.actionTypes as Record<string, number>;
      if (actionType && typeof actionTypes[actionType] === 'number') {
        return actionTypes[actionType] / pattern.frequency;
      }
    }
    
    return null;
  }

  /**
   * Get actual value from event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getActualValueFromEvent(event: any, pattern: LearningPattern): number | null {
    if (pattern.patternType === 'preference') {
      return event.confidence;
    }
    
    if (pattern.patternType === 'behavioral') {
      return 1; // Event occurred, so frequency is 1
    }
    
    return null;
  }

  /**
   * Get learning analytics for a user
   */
  async getLearningAnalytics(userId: string): Promise<Record<string, unknown>> {
    const events = await this.prisma.aILearningEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const patterns = await this.getUserPatterns(userId);
    const predictions = await this.getUserPredictions(userId);

    return {
      totalEvents: events.length,
      eventTypes: this.getEventTypeDistribution(events),
      patterns: patterns.length,
      predictions: predictions.length,
      confidence: this.calculateAverageConfidence(events),
      learningProgress: this.calculateLearningProgress(events, patterns),
      recentInsights: await this.getRecentInsights(userId)
    };
  }

  /**
   * Get user predictions
   */
  private async getUserPredictions(userId: string): Promise<Prediction[]> {
    const predictionEvents = await this.prisma.aILearningEvent.findMany({
      where: { 
        userId,
        eventType: 'prediction',
        applied: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return predictionEvents.map(event => {
      const data = event.patternData as any;
      return {
        id: data.id,
        userId: data.userId,
        type: data.type,
        confidence: data.confidence,
        probability: data.probability,
        timeframe: data.timeframe,
        description: data.description,
        data: data.data,
        createdAt: new Date(data.createdAt),
        expiresAt: new Date(data.expiresAt),
        validated: data.validated
      };
    });
  }

  /**
   * Get recent insights
   */
  private async getRecentInsights(userId: string): Promise<LearningInsight[]> {
    const insightEvents = await this.prisma.aILearningEvent.findMany({
      where: { 
        userId,
        eventType: 'insight',
        applied: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return insightEvents.map(event => {
      const data = event.patternData as any;
      return {
        id: data.id,
        userId: data.userId,
        insightType: data.insightType,
        confidence: data.confidence,
        significance: data.significance,
        description: data.description,
        recommendations: data.recommendations,
        data: data.data,
        createdAt: new Date(data.createdAt)
      };
    });
  }

  /**
   * Get event type distribution
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getEventTypeDistribution(events: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    events.forEach(event => {
      distribution[event.eventType] = (distribution[event.eventType] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Calculate average confidence
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateAverageConfidence(events: any[]): number {
    if (events.length === 0) return 0;
    return events.reduce((sum, event) => sum + event.confidence, 0) / events.length;
  }

  /**
   * Calculate learning progress
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateLearningProgress(events: any[], patterns: LearningPattern[]): number {
    const recentEvents = events.slice(0, 10);
    const recentConfidence = this.calculateAverageConfidence(recentEvents);
    const patternStrength = patterns.length > 0 ? 
      patterns.reduce((sum, p) => sum + p.strength, 0) / patterns.length : 0;
    
    return (recentConfidence + patternStrength) / 2;
  }
}

export default AdvancedLearningEngine;