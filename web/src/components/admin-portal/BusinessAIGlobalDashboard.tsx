'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import { 
  Brain, 
  TrendingUp, 
  Users, 
  Globe, 
  BarChart3, 
  Lightbulb, 
  Shield,
  Activity,
  Target,
  Zap
} from 'lucide-react';

interface BusinessAI {
  id: string;
  businessId: string;
  name: string;
  status: string;
  securityLevel: string;
  totalInteractions: number;
  lastInteractionAt: string;
  lastCentralizedLearningAt: string;
  allowCentralizedLearning: boolean;
  business: {
    name: string;
    industry: string;
    size: string;
  };
}

interface GlobalMetrics {
  totalBusinessAIs: number;
  activeBusinessAIs: number;
  totalInteractions: number;
  averageConfidence: number;
  centralizedLearningEnabled: number;
  industryBreakdown: Record<string, number>;
}

interface CrossBusinessPattern {
  id: string;
  pattern: string;
  description: string;
  patternType: string;
  frequency: number;
  impact: string;
  affectedBusinesses: string[];
  modules: string[];
  confidence: number;
}

interface CrossBusinessInsight {
  id: string;
  insight: string;
  title: string;
  description: string;
  type: string;
  confidence: number;
  source: string;
  businessCount: number;
  impact: 'high' | 'medium' | 'low';
  implementationComplexity: string;
}

interface CrossBusinessRecommendation {
  id: string;
  recommendation: string;
  priority: 'low' | 'medium' | 'high';
  implementation: string;
  expectedBenefit: string;
}

interface CrossBusinessPatterns {
  patterns: CrossBusinessPattern[];
  insights: CrossBusinessInsight[];
  recommendations: CrossBusinessRecommendation[];
}

export const BusinessAIGlobalDashboard: React.FC = () => {
  const [businessAIs, setBusinessAIs] = useState<BusinessAI[]>([]);
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics | null>(null);
  const [crossBusinessPatterns, setCrossBusinessPatterns] = useState<CrossBusinessPatterns | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadBusinessAIData();
  }, []);

  const loadBusinessAIData = async () => {
    try {
      setLoading(true);
      
      // Load all business AIs
      const businessAIResponse = await fetch('/api/admin/business-ai/global');
      if (businessAIResponse.ok) {
        const response = await businessAIResponse.json();
        if (response.success && response.data) {
          setBusinessAIs(response.data.businessAIs || []);
          setGlobalMetrics(response.data.globalMetrics || null);
        }
      }

      // Load cross-business patterns
      const patternsResponse = await fetch('/api/admin/business-ai/patterns');
      if (patternsResponse.ok) {
        const response = await patternsResponse.json();
        if (response.success && response.data) {
          setCrossBusinessPatterns(response.data);
        }
      }

    } catch (error) {
      console.error('Failed to load business AI data:', error);
      setError('Failed to load business AI global data');
    } finally {
      setLoading(false);
    }
  };

  const enableCentralizedLearning = async (businessAIId: string) => {
    try {
      const response = await fetch(`/api/admin/business-ai/${businessAIId}/enable-centralized-learning`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadBusinessAIData(); // Reload data
      }
    } catch (error) {
      console.error('Failed to enable centralized learning:', error);
    }
  };

  const disableCentralizedLearning = async (businessAIId: string) => {
    try {
      const response = await fetch(`/api/admin/business-ai/${businessAIId}/disable-centralized-learning`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadBusinessAIData(); // Reload data
      }
    } catch (error) {
      console.error('Failed to disable centralized learning:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size={32} />
        <span className="ml-2">Loading Business AI Global Dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert type="error" title="Error" className="mb-6">
        {error}
      </Alert>
    );
  }

  const tabs = [
    { label: 'Overview', key: 'overview' },
    { label: 'Business AIs', key: 'businesses' },
    { label: 'Cross-Business Patterns', key: 'patterns' },
    { label: 'Industry Insights', key: 'insights' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8 text-blue-500" />
            Business AI Global Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Monitor and manage all business AI digital twins across the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800">
            {globalMetrics?.activeBusinessAIs || 0} Active
          </Badge>
          <Badge className="bg-blue-100 text-blue-800">
            {globalMetrics?.totalBusinessAIs || 0} Total
          </Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Global Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Total Business AIs</h3>
                  <Brain className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold">{globalMetrics?.totalBusinessAIs || 0}</div>
                <p className="text-xs text-gray-700">Across all businesses</p>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Active Business AIs</h3>
                  <Activity className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold">{globalMetrics?.activeBusinessAIs || 0}</div>
                <p className="text-xs text-gray-700">Currently operational</p>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Total Interactions</h3>
                  <Users className="h-4 w-4 text-purple-500" />
                </div>
                <div className="text-2xl font-bold">{globalMetrics?.totalInteractions || 0}</div>
                <p className="text-xs text-gray-700">All business AI conversations</p>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Centralized Learning</h3>
                  <Zap className="h-4 w-4 text-yellow-500" />
                </div>
                <div className="text-2xl font-bold">{globalMetrics?.centralizedLearningEnabled || 0}</div>
                <p className="text-xs text-gray-700">Contributing to global AI</p>
              </div>
            </Card>
          </div>

          {/* Industry Breakdown */}
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">Industry Distribution</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {globalMetrics?.industryBreakdown && Object.entries(globalMetrics.industryBreakdown).map(([industry, count]) => (
                  <div key={industry} className="text-center">
                    <p className="text-sm text-gray-700">{industry}</p>
                    <p className="text-xl font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">Recent Business AI Activity</h3>
              <div className="space-y-3">
                {(businessAIs || []).slice(0, 5).map((businessAI) => (
                  <div key={businessAI.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{businessAI.business.name}</p>
                      <p className="text-sm text-gray-700">{businessAI.business.industry} • {businessAI.business.size}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={businessAI.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {businessAI.status}
                      </Badge>
                      <span className="text-sm text-gray-700">
                        {businessAI.totalInteractions} interactions
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Business AIs Tab */}
      {activeTab === 'businesses' && (
        <div className="space-y-6">
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">All Business AI Digital Twins</h3>
              <div className="space-y-4">
                {(businessAIs || []).map((businessAI) => (
                  <div key={businessAI.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-medium">{businessAI.business.name}</h4>
                        <p className="text-sm text-gray-700">
                          {businessAI.business.industry} • {businessAI.business.size} • {businessAI.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={businessAI.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {businessAI.status}
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800">{businessAI.securityLevel}</Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-gray-700">Interactions</p>
                        <p className="font-medium">{businessAI.totalInteractions}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">Last Active</p>
                        <p className="font-medium">
                          {businessAI.lastInteractionAt ? new Date(businessAI.lastInteractionAt).toLocaleDateString() : 'Never'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">Centralized Learning</p>
                        <p className="font-medium">
                          {businessAI.allowCentralizedLearning ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">Last Contribution</p>
                        <p className="font-medium">
                          {businessAI.lastCentralizedLearningAt ? new Date(businessAI.lastCentralizedLearningAt).toLocaleDateString() : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {businessAI.allowCentralizedLearning ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => disableCentralizedLearning(businessAI.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Disable Centralized Learning
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => enableCentralizedLearning(businessAI.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Enable Centralized Learning
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(`/business/${businessAI.businessId}/workspace/ai`, '_blank')}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Cross-Business Patterns Tab */}
      {activeTab === 'patterns' && (
        <div className="space-y-6">
          {crossBusinessPatterns ? (
            <>
              {/* Global Patterns */}
              <Card>
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    Cross-Business AI Patterns
                  </h3>
                  {(crossBusinessPatterns?.patterns?.length || 0) === 0 ? (
                    <p className="text-gray-700 text-center py-4">No cross-business patterns discovered yet</p>
                  ) : (
                    <div className="space-y-3">
                      {(crossBusinessPatterns?.patterns || []).map((pattern: CrossBusinessPattern) => (
                        <div key={pattern.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{pattern.pattern}</h4>
                            <Badge className="bg-blue-100 text-blue-800">
                              {(pattern.confidence * 100).toFixed(0)}% confidence
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Type: {pattern.patternType} • Impact: {pattern.impact} • Frequency: {pattern.frequency} businesses
                          </p>
                          <p className="text-sm text-gray-700">
                            Modules: {pattern.modules.join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* Collective Insights */}
              <Card>
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Collective Business Insights
                  </h3>
                  {(crossBusinessPatterns?.insights?.length || 0) === 0 ? (
                    <p className="text-gray-700 text-center py-4">No collective insights available yet</p>
                  ) : (
                    <div className="space-y-3">
                      {(crossBusinessPatterns?.insights || []).map((insight: CrossBusinessInsight) => (
                        <div key={insight.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{insight.insight}</h4>
                            <Badge className={`${
                              insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                              insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {insight.impact} impact
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                          <p className="text-sm text-gray-700">
                            Type: {insight.type} • Complexity: {insight.implementationComplexity}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <div className="p-4 text-center">
                <p className="text-gray-700">Cross-business pattern data not available</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Industry Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-500" />
                Industry-Specific AI Performance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {globalMetrics?.industryBreakdown && Object.entries(globalMetrics.industryBreakdown).map(([industry, count]) => (
                  <div key={industry} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">{industry}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700">Business AIs:</span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700">Avg Confidence:</span>
                        <span className="font-medium">85%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700">Centralized Learning:</span>
                        <span className="font-medium">{Math.round(count * 0.7)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
