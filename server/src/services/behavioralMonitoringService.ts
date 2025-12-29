import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';
import {
  BehavioralMonitoringEvent,
  SecurityViolation,
  ThreatDetectionResult,
  MonitoringRule,
  ComplianceCheck,
  RiskAssessment
} from '../../../shared/dist/types/monitoring';

/**
 * Behavioral Monitoring Service
 * Monitors approved modules in production for suspicious behavior and security violations
 * Following our Service Architecture Standards
 */
export class BehavioralMonitoringService extends EventEmitter {
  private prisma: PrismaClient;
  private monitoringRules: MonitoringRule[] = [];
  private activeMonitors: Map<string, NodeJS.Timeout> = new Map();
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds
  private readonly ALERT_THRESHOLD = 5; // Number of violations before alert
  private readonly COMPLIANCE_CHECK_INTERVAL = 3600000; // 1 hour

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
    this.initializeMonitoringRules();
    this.startPeriodicMonitoring();
  }

  /**
   * Start monitoring a module for behavioral analysis
   * @param moduleId - ID of the module to monitor
   * @param moduleData - Module configuration and metadata
   */
  async startMonitoringModule(moduleId: string, moduleData: Record<string, unknown>): Promise<void> {
    try {
      console.log(`🔍 Starting behavioral monitoring for module: ${moduleId}`);
      
      // Create monitoring configuration
      const monitoringConfig = await this.createMonitoringConfiguration(moduleId, moduleData);
      
      // Start real-time monitoring
      const monitorId = `monitor_${moduleId}_${Date.now()}`;
      const monitorInterval = setInterval(async () => {
        await this.performBehavioralAnalysis(moduleId, monitoringConfig);
      }, this.MONITORING_INTERVAL);
      
      this.activeMonitors.set(moduleId, monitorInterval);
      
      // Start compliance checking
      const complianceInterval = setInterval(async () => {
        await this.performComplianceCheck(moduleId, monitoringConfig);
      }, this.COMPLIANCE_CHECK_INTERVAL);
      
      this.activeMonitors.set(`${moduleId}_compliance`, complianceInterval);
      
      this.emit('monitoringStarted', { moduleId, monitoringConfig });
      
      await logger.info('Behavioral monitoring started', {
        operation: 'behavioral_monitoring_start',
        moduleId,
        monitoringRules: monitoringConfig.rules.length
      });

      console.log(`✅ Behavioral monitoring started for module: ${moduleId}`);

    } catch (error) {
      console.error(`❌ Error starting behavioral monitoring for module ${moduleId}:`, error);
      await logger.error('Behavioral monitoring start failed', {
        operation: 'behavioral_monitoring_start',
        moduleId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Stop monitoring a module
   * @param moduleId - ID of the module to stop monitoring
   */
  async stopMonitoringModule(moduleId: string): Promise<void> {
    try {
      console.log(`🛑 Stopping behavioral monitoring for module: ${moduleId}`);
      
      // Stop monitoring intervals
      const monitorInterval = this.activeMonitors.get(moduleId);
      if (monitorInterval) {
        clearInterval(monitorInterval);
        this.activeMonitors.delete(moduleId);
      }
      
      const complianceInterval = this.activeMonitors.get(`${moduleId}_compliance`);
      if (complianceInterval) {
        clearInterval(complianceInterval);
        this.activeMonitors.delete(`${moduleId}_compliance`);
      }
      
      this.emit('monitoringStopped', { moduleId });
      
      await logger.info('Behavioral monitoring stopped', {
        operation: 'behavioral_monitoring_stop',
        moduleId
      });

      console.log(`✅ Behavioral monitoring stopped for module: ${moduleId}`);

    } catch (error) {
      console.error(`❌ Error stopping behavioral monitoring for module ${moduleId}:`, error);
      await logger.error('Behavioral monitoring stop failed', {
        operation: 'behavioral_monitoring_stop',
        moduleId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Record a behavioral event for analysis
   * @param moduleId - ID of the module
   * @param event - Behavioral event to record
   */
  async recordBehavioralEvent(moduleId: string, event: BehavioralMonitoringEvent): Promise<void> {
    try {
      // Analyze event against monitoring rules
      const violations = await this.analyzeEventForViolations(event);
      
      if (violations.length > 0) {
        await this.handleSecurityViolations(moduleId, violations, event);
      }
      
      // Record event for trend analysis
      await this.recordEventForTrendAnalysis(moduleId, event);
      
      this.emit('behavioralEventRecorded', { moduleId, event, violations });
      
    } catch (error) {
      console.error('❌ Error recording behavioral event:', error);
      await logger.error('Behavioral event recording failed', {
        operation: 'behavioral_event_recording',
        moduleId,
        eventType: event.type,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    }
  }

  /**
   * Perform behavioral analysis for a module
   */
  private async performBehavioralAnalysis(moduleId: string, monitoringConfig: any): Promise<void> {
    try {
      // Get recent events for the module
      const recentEvents = await this.getRecentEvents(moduleId, 300); // Last 5 minutes
      
      // Analyze for suspicious patterns
      const threatDetection = await this.detectThreats(moduleId, recentEvents);
      
      if (threatDetection.threatsDetected) {
        await this.handleThreatDetection(moduleId, threatDetection);
      }
      
      // Perform risk assessment
      const riskAssessment = await this.assessRisk(moduleId, recentEvents);
      
      if (riskAssessment.riskLevel === 'high' || riskAssessment.riskLevel === 'critical') {
        await this.handleHighRiskAssessment(moduleId, riskAssessment);
      }
      
    } catch (error) {
      console.error(`❌ Error in behavioral analysis for module ${moduleId}:`, error);
    }
  }

  /**
   * Initialize monitoring rules
   */
  private initializeMonitoringRules(): void {
    this.monitoringRules = [
      {
        id: 'excessive_network_requests',
        name: 'Excessive Network Requests',
        description: 'Detect modules making excessive network requests',
        type: 'network',
        condition: 'count > 100',
        timeWindow: 300000, // 5 minutes
        severity: 'medium',
        action: 'alert',
        enabled: true
      },
      {
        id: 'suspicious_file_access',
        name: 'Suspicious File Access',
        description: 'Detect modules accessing sensitive files',
        type: 'filesystem',
        condition: 'path.includes("/etc/") || path.includes("/root/")',
        timeWindow: 60000, // 1 minute
        severity: 'high',
        action: 'block',
        enabled: true
      },
      {
        id: 'unusual_cpu_usage',
        name: 'Unusual CPU Usage',
        description: 'Detect modules with unusually high CPU usage',
        type: 'performance',
        condition: 'cpuUsage > 80',
        timeWindow: 120000, // 2 minutes
        severity: 'medium',
        action: 'alert',
        enabled: true
      },
      {
        id: 'memory_leak_detection',
        name: 'Memory Leak Detection',
        description: 'Detect potential memory leaks in modules',
        type: 'performance',
        condition: 'memoryGrowth > 50',
        timeWindow: 600000, // 10 minutes
        severity: 'high',
        action: 'alert',
        enabled: true
      },
      {
        id: 'unauthorized_api_access',
        name: 'Unauthorized API Access',
        description: 'Detect modules accessing unauthorized APIs',
        type: 'api',
        condition: 'endpoint.includes("admin") || endpoint.includes("system")',
        timeWindow: 30000, // 30 seconds
        severity: 'critical',
        action: 'block',
        enabled: true
      }
    ];
  }

  /**
   * Create monitoring configuration for a module
   */
  private async createMonitoringConfiguration(moduleId: string, moduleData: Record<string, unknown>): Promise<any> {
    const manifest = moduleData.manifest as Record<string, unknown>;
    const permissions = manifest?.permissions as string[] || [];
    
    // Filter monitoring rules based on module permissions
    const applicableRules = this.monitoringRules.filter(rule => {
      if (rule.type === 'filesystem' && !permissions.some(p => p.includes('file-system'))) {
        return false;
      }
      if (rule.type === 'network' && !permissions.some(p => p.includes('network-access'))) {
        return false;
      }
      return rule.enabled;
    });

    return {
      moduleId,
      permissions,
      rules: applicableRules,
      monitoringStarted: new Date().toISOString(),
      configuration: {
        networkMonitoring: permissions.some(p => p.includes('network-access')),
        fileSystemMonitoring: permissions.some(p => p.includes('file-system')),
        performanceMonitoring: true,
        apiMonitoring: true
      }
    };
  }

  /**
   * Analyze event for security violations
   */
  private async analyzeEventForViolations(event: BehavioralMonitoringEvent): Promise<SecurityViolation[]> {
    const violations: SecurityViolation[] = [];
    
    for (const rule of this.monitoringRules) {
      if (!rule.enabled) continue;
      
      // Check if event matches rule condition
      if (this.evaluateRuleCondition(event, rule)) {
        violations.push({
          type: rule.id,
          severity: rule.severity,
          description: rule.description,
          timestamp: new Date().toISOString(),
          details: {
            rule: rule,
            event: event,
            condition: rule.condition
          }
        });
      }
    }
    
    return violations;
  }

  /**
   * Evaluate rule condition against event
   */
  private evaluateRuleCondition(event: BehavioralMonitoringEvent, rule: MonitoringRule): boolean {
    try {
      // Simple condition evaluation (in a real implementation, this would be more sophisticated)
      switch (rule.condition) {
        case 'count > 100':
          return (event.data?.count as number) > 100;
        case 'path.includes("/etc/") || path.includes("/root/")':
          const path = event.data?.path as string;
          return Boolean(path && (path.includes('/etc/') || path.includes('/root/')));
        case 'cpuUsage > 80':
          return (event.data?.cpuUsage as number) > 80;
        case 'memoryGrowth > 50':
          return (event.data?.memoryGrowth as number) > 50;
        case 'endpoint.includes("admin") || endpoint.includes("system")':
          const endpoint = event.data?.endpoint as string;
          return Boolean(endpoint && (endpoint.includes('admin') || endpoint.includes('system')));
        default:
          return false;
      }
    } catch (error) {
      console.error('Error evaluating rule condition:', error);
      return false;
    }
  }

  /**
   * Handle security violations
   */
  private async handleSecurityViolations(moduleId: string, violations: SecurityViolation[], event: BehavioralMonitoringEvent): Promise<void> {
    for (const violation of violations) {
      // Log violation
      await logger.warn('Security violation detected', {
        operation: 'security_violation',
        moduleId,
        violationType: violation.type,
        severity: violation.severity,
        eventType: event.type,
        details: violation.details
      });
      
      // Take action based on severity
      switch (violation.severity) {
        case 'critical':
          await this.handleCriticalViolation(moduleId, violation);
          break;
        case 'high':
          await this.handleHighViolation(moduleId, violation);
          break;
        case 'medium':
          await this.handleMediumViolation(moduleId, violation);
          break;
        case 'low':
          await this.handleLowViolation(moduleId, violation);
          break;
      }
    }
  }

  /**
   * Handle critical security violations
   */
  private async handleCriticalViolation(moduleId: string, violation: SecurityViolation): Promise<void> {
    console.log(`🚨 CRITICAL security violation detected for module ${moduleId}: ${violation.type}`);
    
    // Immediately disable module
    await this.disableModule(moduleId, 'Critical security violation detected');
    
    // Send immediate alert
    this.emit('criticalSecurityViolation', { moduleId, violation });
  }

  /**
   * Handle high severity violations
   */
  private async handleHighViolation(moduleId: string, violation: SecurityViolation): Promise<void> {
    console.log(`⚠️ HIGH security violation detected for module ${moduleId}: ${violation.type}`);
    
    // Send alert
    this.emit('highSecurityViolation', { moduleId, violation });
  }

  /**
   * Handle medium severity violations
   */
  private async handleMediumViolation(moduleId: string, violation: SecurityViolation): Promise<void> {
    console.log(`⚠️ MEDIUM security violation detected for module ${moduleId}: ${violation.type}`);
    
    // Send alert
    this.emit('mediumSecurityViolation', { moduleId, violation });
  }

  /**
   * Handle low severity violations
   */
  private async handleLowViolation(moduleId: string, violation: SecurityViolation): Promise<void> {
    console.log(`ℹ️ LOW security violation detected for module ${moduleId}: ${violation.type}`);
    
    // Log for trend analysis
    this.emit('lowSecurityViolation', { moduleId, violation });
  }

  /**
   * Detect threats from recent events
   */
  private async detectThreats(moduleId: string, events: BehavioralMonitoringEvent[]): Promise<ThreatDetectionResult> {
    const threatsDetected = events.some(event => 
      event.type === 'suspicious_activity' || 
      event.type === 'unauthorized_access' ||
      event.type === 'data_exfiltration'
    );
    
    const threatTypes = events
      .filter(event => event.type === 'suspicious_activity' || event.type === 'unauthorized_access')
      .map(event => event.type);
    
    return {
      threatsDetected,
      threatTypes,
      confidence: threatsDetected ? 85 : 95,
      timestamp: new Date().toISOString(),
      details: {
        eventsAnalyzed: events.length,
        suspiciousEvents: events.filter(e => e.type.includes('suspicious')).length,
        unauthorizedEvents: events.filter(e => e.type.includes('unauthorized')).length,
        riskFactors: threatTypes
      }
    };
  }

  /**
   * Assess risk level based on recent events
   */
  private async assessRisk(moduleId: string, events: BehavioralMonitoringEvent[]): Promise<RiskAssessment> {
    let riskScore = 0;
    
    // Calculate risk score based on event types and frequency
    for (const event of events) {
      switch (event.type) {
        case 'suspicious_activity':
          riskScore += 20;
          break;
        case 'unauthorized_access':
          riskScore += 30;
          break;
        case 'data_exfiltration':
          riskScore += 40;
          break;
        case 'performance_anomaly':
          riskScore += 10;
          break;
        default:
          riskScore += 5;
      }
    }
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 80) riskLevel = 'critical';
    else if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';
    else riskLevel = 'low';
    
    return {
      riskLevel,
      riskScore,
      factors: events.map(e => e.type),
      timestamp: new Date().toISOString(),
      recommendations: this.generateRiskRecommendations(riskLevel, events)
    };
  }

  /**
   * Generate risk recommendations
   */
  private generateRiskRecommendations(riskLevel: string, events: BehavioralMonitoringEvent[]): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Immediate review of module behavior required');
      recommendations.push('Consider disabling module until investigation complete');
    }
    
    if (events.some(e => e.type === 'suspicious_activity')) {
      recommendations.push('Review module permissions and access patterns');
    }
    
    if (events.some(e => e.type === 'performance_anomaly')) {
      recommendations.push('Optimize module performance and resource usage');
    }
    
    return recommendations;
  }

  /**
   * Perform compliance check
   */
  private async performComplianceCheck(moduleId: string, monitoringConfig: any): Promise<void> {
    try {
      // Check compliance against security policies
      const complianceChecks = await this.runComplianceChecks(moduleId, monitoringConfig);
      
      // Handle non-compliance
      const nonCompliantChecks = complianceChecks.filter(check => !check.compliant);
      if (nonCompliantChecks.length > 0) {
        await this.handleComplianceViolations(moduleId, nonCompliantChecks);
      }
      
    } catch (error) {
      console.error(`❌ Error in compliance check for module ${moduleId}:`, error);
    }
  }

  /**
   * Run compliance checks
   */
  private async runComplianceChecks(moduleId: string, monitoringConfig: any): Promise<ComplianceCheck[]> {
    // Placeholder implementation - in a real system, this would check against actual compliance frameworks
    return [
      {
        id: 'data_privacy_compliance',
        name: 'Data Privacy Compliance',
        compliant: true,
        details: 'Module complies with data privacy requirements',
        timestamp: new Date().toISOString()
      },
      {
        id: 'security_standards_compliance',
        name: 'Security Standards Compliance',
        compliant: true,
        details: 'Module meets security standards',
        timestamp: new Date().toISOString()
      }
    ];
  }

  /**
   * Handle compliance violations
   */
  private async handleComplianceViolations(moduleId: string, violations: ComplianceCheck[]): Promise<void> {
    console.log(`⚠️ Compliance violations detected for module ${moduleId}:`, violations.map(v => v.name));
    
    // Send compliance violation alerts
    this.emit('complianceViolation', { moduleId, violations });
  }

  /**
   * Get recent events for analysis
   */
  private async getRecentEvents(moduleId: string, timeWindowMs: number): Promise<BehavioralMonitoringEvent[]> {
    // Placeholder implementation - in a real system, this would query a database
    return [];
  }

  /**
   * Record event for trend analysis
   */
  private async recordEventForTrendAnalysis(moduleId: string, event: BehavioralMonitoringEvent): Promise<void> {
    // Placeholder implementation - in a real system, this would store events in a time-series database
  }

  /**
   * Handle threat detection
   */
  private async handleThreatDetection(moduleId: string, threatDetection: ThreatDetectionResult): Promise<void> {
    console.log(`🚨 Threat detected for module ${moduleId}:`, threatDetection.threatTypes);
    
    // Send threat detection alert
    this.emit('threatDetected', { moduleId, threatDetection });
  }

  /**
   * Handle high risk assessment
   */
  private async handleHighRiskAssessment(moduleId: string, riskAssessment: RiskAssessment): Promise<void> {
    console.log(`⚠️ High risk assessment for module ${moduleId}: ${riskAssessment.riskLevel}`);
    
    // Send risk assessment alert
    this.emit('highRiskAssessment', { moduleId, riskAssessment });
  }

  /**
   * Disable module due to security violation
   */
  private async disableModule(moduleId: string, reason: string): Promise<void> {
    try {
      // Update module status in database
      await this.prisma.module.update({
        where: { id: moduleId },
        data: { status: 'SUSPENDED' }
      });
      
      console.log(`🔒 Module ${moduleId} disabled due to: ${reason}`);
      
      // Emit module disabled event
      this.emit('moduleDisabled', { moduleId, reason });
      
    } catch (error) {
      console.error(`❌ Error disabling module ${moduleId}:`, error);
    }
  }

  /**
   * Start periodic monitoring
   */
  private startPeriodicMonitoring(): void {
    // Start global monitoring tasks
    setInterval(async () => {
      await this.performGlobalSecurityScan();
    }, 300000); // 5 minutes
  }

  /**
   * Perform global security scan
   */
  private async performGlobalSecurityScan(): Promise<void> {
    try {
      // Get all active modules
      const activeModules = await this.prisma.module.findMany({
        where: { status: 'APPROVED' }
      });
      
      // Check each module for security issues
      for (const module of activeModules) {
        await this.performModuleSecurityCheck(module.id);
      }
      
    } catch (error) {
      // Check if it's a database connection error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes("Can't reach database") || errorMessage.includes('localhost:5432')) {
        // Silently skip if database is not available - will retry on next interval
        return;
      }
      // Log other errors
      console.error('❌ Error in global security scan:', error);
    }
  }

  /**
   * Perform security check for a specific module
   */
  private async performModuleSecurityCheck(moduleId: string): Promise<void> {
    // Placeholder implementation for module-specific security checks
  }
}
