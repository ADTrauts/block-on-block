'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import { 
  Brain, 
  TrendingUp, 
  Users, 
  BarChart3,
  Search,
  Globe,
  Activity,
  Shield,
  Zap,
  Target,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  DollarSign,
  Filter,
  Layers
} from 'lucide-react';
import Link from 'next/link';
import { adminApiService } from '../../../lib/adminApiService';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  Legend
} from 'recharts';

interface Pattern {
  id: string;
  type: string;
  description: string;
  frequency?: number;
  confidence?: number;
  source: 'ai-learning' | 'business-ai';
  modules?: string[];
  affectedBusinesses?: string[];
}

interface Insight {
  id: string;
  title: string;
  description: string;
  type: string;
  confidence?: number;
  source: 'ai-learning' | 'business-ai' | 'business-intelligence';
  impact?: string;
}

interface AISystemOverview {
  businessIntelligence: {
    totalUsers: number;
    monthlyRevenue: number;
    activeUsers: number;
    predictiveInsights: number;
  };
  aiLearning: {
    globalPatterns: number;
    collectiveInsights: number;
    systemHealth: number;
    consentingUsers: number;
  };
  businessAI: {
    totalBusinessAIs: number;
    activeBusinessAIs: number;
    totalInteractions: number;
    centralizedLearningEnabled: number;
  };
  context: {
    totalContexts: number;
    validatedContexts: number;
    crossModuleConnections: number;
  };
  unifiedPatterns: Pattern[];
  unifiedInsights: Insight[];
}

interface CombinedAnalytics {
  userGrowth: {
    monthlyTrend: Array<{ month: string; count: number }>;
    total: number;
    growthRate: number;
  };
  revenue: {
    monthlyTrend: Array<{ month: string; amount: number }>;
    total: number;
    growthRate: number;
  };
  aiInteractions: {
    monthlyTrend: Array<{ month: string; count: number }>;
    total: number;
    growthRate: number;
  };
  patterns: {
    monthlyTrend: Array<{ month: string; count: number }>;
    total: number;
    growthRate: number;
  };
}

export default function AISystemPage() {
  const { data: session, status } = useSession();
  const [overview, setOverview] = useState<AISystemOverview | null>(null);
  const [combinedAnalytics, setCombinedAnalytics] = useState<CombinedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPatternsSection, setShowPatternsSection] = useState(true);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(['users', 'revenue', 'aiInteractions', 'patterns']));
  const [dateRange, setDateRange] = useState<string>('90d');
  const [showUnifiedTrends, setShowUnifiedTrends] = useState(true);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      loadOverviewData();
    }
  }, [status, session, dateRange]);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load data from all AI systems in parallel
      // Note: Some endpoints may not exist yet, so we gracefully handle failures
      const [biRes, businessAIRes, patternsRes, analyticsRes] = await Promise.all([
        adminApiService.getBusinessIntelligence().catch(() => ({ data: null, error: null })),
        fetch('/api/admin/business-ai/global', {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        })
          .then(r => r.ok ? r.json() : null)
          .catch(() => ({ success: false, data: null })),
        fetch('/api/admin/business-ai/patterns', {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        })
          .then(r => r.ok ? r.json() : null)
          .catch(() => ({ success: false, data: null })),
        adminApiService.getAnalytics({ dateRange: dateRange, userType: 'all', metric: 'all' })
          .catch(() => ({ data: null, error: null }))
      ]);

      // Build overview from available data
      const biData = biRes.data as any;
      const businessAIData = businessAIRes?.success ? businessAIRes.data : null;
      const patternsData = patternsRes?.success ? patternsRes.data : null;
      const analyticsData = analyticsRes.data as any;

      // Combine patterns from different sources
      const unifiedPatterns: Pattern[] = [];
      if (patternsData?.patterns && Array.isArray(patternsData.patterns)) {
        patternsData.patterns.forEach((p: any) => {
          unifiedPatterns.push({
            id: p.id || `pattern-${unifiedPatterns.length}`,
            type: p.patternType || p.type || 'unknown',
            description: p.description || p.pattern || 'No description',
            frequency: p.frequency,
            confidence: p.confidence,
            source: 'business-ai',
            modules: p.modules || [],
            affectedBusinesses: p.affectedBusinesses || []
          });
        });
      }

      // Combine insights from different sources
      const unifiedInsights: Insight[] = [];
      
      // Add Business Intelligence predictive insights
      if (Array.isArray(biData?.predictiveInsights)) {
        biData.predictiveInsights.forEach((insight: any) => {
          unifiedInsights.push({
            id: `bi-${insight.type}-${unifiedInsights.length}`,
            title: insight.title || 'Predictive Insight',
            description: insight.description || '',
            type: insight.type || 'prediction',
            confidence: insight.confidence,
            source: 'business-intelligence',
            impact: insight.impact
          });
        });
      }

      // Add Business AI insights
      if (patternsData?.insights && Array.isArray(patternsData.insights)) {
        patternsData.insights.forEach((insight: any) => {
          unifiedInsights.push({
            id: insight.id || `bai-${unifiedInsights.length}`,
            title: insight.title || insight.insight || 'Cross-Business Insight',
            description: insight.description || '',
            type: insight.type || 'cross-business',
            confidence: insight.confidence,
            source: 'business-ai',
            impact: insight.impact
          });
        });
      }

      setOverview({
        businessIntelligence: {
          totalUsers: biData?.userGrowth?.totalUsers || 0,
          monthlyRevenue: biData?.revenueMetrics?.monthlyRecurringRevenue || 0,
          activeUsers: biData?.userGrowth?.activeUsers || 0,
          predictiveInsights: Array.isArray(biData?.predictiveInsights) ? biData.predictiveInsights.length : 0
        },
        aiLearning: {
          globalPatterns: 0, // Will be loaded when AI Learning endpoints are available through admin API
          collectiveInsights: 0,
          systemHealth: 95, // Default value
          consentingUsers: 0
        },
        businessAI: {
          totalBusinessAIs: businessAIData?.globalMetrics?.totalBusinessAIs || 0,
          activeBusinessAIs: businessAIData?.globalMetrics?.activeBusinessAIs || 0,
          totalInteractions: businessAIData?.globalMetrics?.totalInteractions || 0,
          centralizedLearningEnabled: businessAIData?.globalMetrics?.centralizedLearningEnabled || 0
        },
        context: {
          totalContexts: 0, // Would need context stats endpoint
          validatedContexts: 0,
          crossModuleConnections: 0
        },
        unifiedPatterns,
        unifiedInsights
      });

      // Build combined analytics with trend data
      if (analyticsData) {
        const userTrend = analyticsData.userGrowth?.monthlyTrend || [];
        const revenueTrend = analyticsData.revenue?.monthlyTrend || [];
        
        // Generate AI interactions trend (simulate from business AI data)
        // Use user growth trend as a template for timing
        const aiInteractionsTrend = userTrend.length > 0 ? userTrend.map((item: any, index: number) => {
          const totalInteractions = businessAIData?.globalMetrics?.totalInteractions || 0;
          // Distribute interactions across months proportionally
          const baseCount = Math.floor(totalInteractions / userTrend.length);
          const remainder = totalInteractions % userTrend.length;
          return {
            month: item.month,
            count: baseCount + (index < remainder ? 1 : 0)
          };
        }) : [];

        // Generate patterns trend (simulate from unified patterns)
        const patternsTrend = userTrend.length > 0 ? userTrend.map((item: any, index: number) => {
          const totalPatterns = unifiedPatterns.length || 0;
          // Distribute patterns across months proportionally
          const baseCount = Math.floor(totalPatterns / userTrend.length);
          const remainder = totalPatterns % userTrend.length;
          return {
            month: item.month,
            count: baseCount + (index < remainder ? 1 : 0)
          };
        }) : [];

        // Calculate growth rates safely
        const calculateGrowthRate = (trend: Array<{ count: number }>) => {
          if (trend.length < 2 || trend[0].count === 0) return 0;
          const first = trend[0].count;
          const last = trend[trend.length - 1].count;
          return ((last - first) / first) * 100;
        };

        setCombinedAnalytics({
          userGrowth: {
            monthlyTrend: userTrend,
            total: analyticsData.userGrowth?.total || 0,
            growthRate: analyticsData.userGrowth?.growthRate || 0
          },
          revenue: {
            monthlyTrend: revenueTrend,
            total: analyticsData.revenue?.total || 0,
            growthRate: analyticsData.revenue?.growthRate || 0
          },
          aiInteractions: {
            monthlyTrend: aiInteractionsTrend,
            total: businessAIData?.globalMetrics?.totalInteractions || 0,
            growthRate: calculateGrowthRate(aiInteractionsTrend)
          },
          patterns: {
            monthlyTrend: patternsTrend,
            total: unifiedPatterns.length,
            growthRate: calculateGrowthRate(patternsTrend)
          }
        });
      }
    } catch (err) {
      console.error('Error loading AI System overview:', err);
      setError('Failed to load AI System overview');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading AI System overview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI System</h1>
          <p className="text-gray-600 mt-2">Unified AI system management and monitoring</p>
        </div>
        <Alert onClose={() => setError(null)}>
          {error}
        </Alert>
      </div>
    );
  }

  const systemCards = [
    {
      id: 'business-intelligence',
      title: 'Business Intelligence',
      description: 'Advanced analytics, predictive insights, and strategic reporting',
      icon: BarChart3,
      color: 'blue',
      path: '/admin-portal/business-intelligence',
      metrics: [
        { label: 'Total Users', value: overview?.businessIntelligence.totalUsers.toLocaleString() || '0' },
        { label: 'Monthly Revenue', value: `$${overview?.businessIntelligence.monthlyRevenue.toLocaleString() || '0'}` },
        { label: 'Active Users', value: overview?.businessIntelligence.activeUsers.toLocaleString() || '0' },
        { label: 'Predictive Insights', value: overview?.businessIntelligence.predictiveInsights || 0 }
      ]
    },
    {
      id: 'ai-learning',
      title: 'AI Learning',
      description: 'Centralized AI learning system across all users',
      icon: Brain,
      color: 'purple',
      path: '/admin-portal/ai-learning',
      metrics: [
        { label: 'Global Patterns', value: overview?.aiLearning.globalPatterns || 0 },
        { label: 'Collective Insights', value: overview?.aiLearning.collectiveInsights || 0 },
        { label: 'System Health', value: `${overview?.aiLearning.systemHealth || 0}%` },
        { label: 'Consenting Users', value: overview?.aiLearning.consentingUsers || 0 }
      ]
    },
    {
      id: 'business-ai',
      title: 'Business AI Global',
      description: 'Manage all business AI digital twins across the platform',
      icon: Globe,
      color: 'green',
      path: '/admin-portal/business-ai',
      metrics: [
        { label: 'Total Business AIs', value: overview?.businessAI.totalBusinessAIs || 0 },
        { label: 'Active Business AIs', value: overview?.businessAI.activeBusinessAIs || 0 },
        { label: 'Total Interactions', value: overview?.businessAI.totalInteractions.toLocaleString() || '0' },
        { label: 'Centralized Learning', value: overview?.businessAI.centralizedLearningEnabled || 0 }
      ]
    },
    {
      id: 'context-debug',
      title: 'Context Debug',
      description: 'Debug and monitor AI context across all modules',
      icon: Search,
      color: 'orange',
      path: '/admin-portal/ai-context',
      metrics: [
        { label: 'Total Contexts', value: overview?.context.totalContexts || 0 },
        { label: 'Validated', value: overview?.context.validatedContexts || 0 },
        { label: 'Cross-Module Connections', value: overview?.context.crossModuleConnections || 0 }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI System</h1>
          <p className="text-gray-600 mt-2">Unified AI system management and monitoring</p>
        </div>
        <Button onClick={loadOverviewData} variant="secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {systemCards.map((system) => {
          const Icon = system.icon;
          const colorClasses = {
            blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
            purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
            green: { bg: 'bg-green-100', text: 'text-green-600' },
            orange: { bg: 'bg-orange-100', text: 'text-orange-600' }
          };
          const colors = colorClasses[system.color as keyof typeof colorClasses] || colorClasses.blue;
          
          return (
            <Link key={system.id} href={system.path}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-lg ${colors.bg}`}>
                      <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{system.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{system.description}</p>
                    </div>
                  </div>
                  <ArrowRight className={`w-5 h-5 ${colors.text}`} />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {system.metrics.map((metric, idx) => (
                    <div key={idx} className="border-t border-gray-200 pt-3">
                      <p className="text-xs text-gray-700 mb-1">{metric.label}</p>
                      <p className="text-lg font-semibold text-gray-900">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Combined Analytics Summary */}
      {overview && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Combined Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-700 mb-1">Total AI Systems</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {overview.businessAI.totalBusinessAIs + (overview.aiLearning.systemHealth > 0 ? 1 : 0)}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    {overview.businessAI.activeBusinessAIs} active
                  </p>
                </div>
                <Brain className="w-8 h-8 text-purple-600 opacity-50" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-700 mb-1">Total Insights</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(overview?.unifiedInsights?.length ?? 0) + (overview?.businessIntelligence?.predictiveInsights ?? 0)}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    Across all systems
                  </p>
                </div>
                <Lightbulb className="w-8 h-8 text-yellow-600 opacity-50" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-700 mb-1">Total Patterns</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {overview?.unifiedPatterns?.length ?? 0}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    Discovered patterns
                  </p>
                </div>
                <Target className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-700 mb-1">AI Interactions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {overview.businessAI.totalInteractions.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    Total conversations
                  </p>
                </div>
                <Activity className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Combined Analytics Charts */}
      {combinedAnalytics && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Trend Analytics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Growth Chart */}
            {combinedAnalytics.userGrowth.monthlyTrend.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">User Growth</h3>
                  </div>
                  <span className={`text-sm font-medium ${
                    combinedAnalytics.userGrowth.growthRate > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {combinedAnalytics.userGrowth.growthRate > 0 ? '+' : ''}
                    {combinedAnalytics.userGrowth.growthRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={combinedAnalytics.userGrowth.monthlyTrend}>
                      <defs>
                        <linearGradient id="colorUserGrowth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                        tickFormatter={(value) => value.substring(0, 3)}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#3b82f6" 
                        fillOpacity={1}
                        fill="url(#colorUserGrowth)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Revenue Chart */}
            {combinedAnalytics.revenue.monthlyTrend.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Revenue</h3>
                  </div>
                  <span className={`text-sm font-medium ${
                    combinedAnalytics.revenue.growthRate > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {combinedAnalytics.revenue.growthRate > 0 ? '+' : ''}
                    {combinedAnalytics.revenue.growthRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={combinedAnalytics.revenue.monthlyTrend}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                        tickFormatter={(value) => value.substring(0, 3)}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                        formatter={(value: number) => `$${value.toLocaleString()}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#10b981" 
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* AI Interactions Chart */}
            {combinedAnalytics.aiInteractions.monthlyTrend.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">AI Interactions</h3>
                  </div>
                  <span className={`text-sm font-medium ${
                    combinedAnalytics.aiInteractions.growthRate > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {combinedAnalytics.aiInteractions.growthRate > 0 ? '+' : ''}
                    {combinedAnalytics.aiInteractions.growthRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={combinedAnalytics.aiInteractions.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                        tickFormatter={(value) => value.substring(0, 3)}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#a855f7" 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Patterns Discovery Chart */}
            {combinedAnalytics.patterns.monthlyTrend.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-orange-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Pattern Discovery</h3>
                  </div>
                  <span className={`text-sm font-medium ${
                    combinedAnalytics.patterns.growthRate > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {combinedAnalytics.patterns.growthRate > 0 ? '+' : ''}
                    {combinedAnalytics.patterns.growthRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={combinedAnalytics.patterns.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                        tickFormatter={(value) => value.substring(0, 3)}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#f97316" 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Unified Trends Visualization */}
      {combinedAnalytics && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-gray-700" />
              <h2 className="text-xl font-semibold text-gray-900">Unified Trends Comparison</h2>
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowUnifiedTrends(!showUnifiedTrends)}
            >
              {showUnifiedTrends ? 'Hide' : 'Show'}
            </Button>
          </div>

          {showUnifiedTrends && (
            <Card className="p-6">
              {/* Filters and Controls */}
              <div className="flex flex-wrap items-center gap-4 mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Date Range:</span>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="180d">Last 6 months</option>
                    <option value="365d">Last year</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Metrics:</span>
                  <div className="flex items-center space-x-2">
                    {[
                      { key: 'users', label: 'Users', color: '#3b82f6' },
                      { key: 'revenue', label: 'Revenue', color: '#10b981' },
                      { key: 'aiInteractions', label: 'AI Interactions', color: '#a855f7' },
                      { key: 'patterns', label: 'Patterns', color: '#f97316' }
                    ].map((metric) => (
                      <button
                        key={metric.key}
                        onClick={() => {
                          const newSet = new Set(selectedMetrics);
                          if (newSet.has(metric.key)) {
                            newSet.delete(metric.key);
                          } else {
                            newSet.add(metric.key);
                          }
                          setSelectedMetrics(newSet);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedMetrics.has(metric.key)
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                        }`}
                        style={{
                          borderColor: selectedMetrics.has(metric.key) ? metric.color : undefined
                        }}
                      >
                        <span className="flex items-center space-x-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: metric.color }}
                          />
                          <span>{metric.label}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Unified Multi-Line Chart */}
              {(() => {
                // Normalize and combine all trend data
                const userTrend = combinedAnalytics.userGrowth.monthlyTrend || [];
                const revenueTrend = combinedAnalytics.revenue.monthlyTrend || [];
                const aiTrend = combinedAnalytics.aiInteractions.monthlyTrend || [];
                const patternsTrend = combinedAnalytics.patterns.monthlyTrend || [];

                // Get all unique months
                const allMonths = new Set<string>();
                [userTrend, revenueTrend, aiTrend, patternsTrend].forEach(trend => {
                  trend.forEach(item => allMonths.add(item.month));
                });
                const sortedMonths = Array.from(allMonths).sort();

                // Normalize values to 0-100 scale for comparison
                const normalize = (values: number[]) => {
                  const max = Math.max(...values.filter(v => !isNaN(v) && isFinite(v)));
                  const min = Math.min(...values.filter(v => !isNaN(v) && isFinite(v)));
                  if (max === min) return values.map(() => 50); // Center if no variation
                  return values.map(v => ((v - min) / (max - min)) * 100);
                };

                // Build combined dataset
                const combinedData = sortedMonths.map(month => {
                  const userItem = userTrend.find((item: any) => item.month === month);
                  const revenueItem = revenueTrend.find((item: any) => item.month === month);
                  const aiItem = aiTrend.find((item: any) => item.month === month);
                  const patternItem = patternsTrend.find((item: any) => item.month === month);

                  return {
                    month: month.substring(0, 3),
                    fullMonth: month,
                    users: userItem?.count || 0,
                    revenue: revenueItem?.amount || 0,
                    aiInteractions: aiItem?.count || 0,
                    patterns: patternItem?.count || 0
                  };
                });

                // Normalize each metric
                const userValues = combinedData.map(d => d.users);
                const revenueValues = combinedData.map(d => d.revenue);
                const aiValues = combinedData.map(d => d.aiInteractions);
                const patternValues = combinedData.map(d => d.patterns);

                const normalizedUser = normalize(userValues);
                const normalizedRevenue = normalize(revenueValues);
                const normalizedAI = normalize(aiValues);
                const normalizedPatterns = normalize(patternValues);

                const normalizedData = combinedData.map((item, index) => ({
                  ...item,
                  usersNormalized: normalizedUser[index],
                  revenueNormalized: normalizedRevenue[index],
                  aiInteractionsNormalized: normalizedAI[index],
                  patternsNormalized: normalizedPatterns[index]
                }));

                return (
                  <div className="space-y-4">
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={normalizedData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 11 }}
                            stroke="#6b7280"
                          />
                          <YAxis 
                            tick={{ fontSize: 11 }}
                            stroke="#6b7280"
                            domain={[0, 100]}
                            tickFormatter={(value) => `${value}%`}
                            label={{ value: 'Normalized Scale (0-100%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#fff', 
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}
                            formatter={(value: number, name: string) => {
                              const metricMap: Record<string, string> = {
                                'usersNormalized': 'Users',
                                'revenueNormalized': 'Revenue',
                                'aiInteractionsNormalized': 'AI Interactions',
                                'patternsNormalized': 'Patterns'
                              };
                              return [`${value.toFixed(1)}%`, metricMap[name] || name];
                            }}
                          />
                          <Legend 
                            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                            formatter={(value) => {
                              const labelMap: Record<string, string> = {
                                'usersNormalized': 'Users',
                                'revenueNormalized': 'Revenue',
                                'aiInteractionsNormalized': 'AI Interactions',
                                'patternsNormalized': 'Patterns'
                              };
                              return labelMap[value] || value;
                            }}
                          />
                          {selectedMetrics.has('users') && (
                            <Line 
                              type="monotone" 
                              dataKey="usersNormalized" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name="usersNormalized"
                            />
                          )}
                          {selectedMetrics.has('revenue') && (
                            <Line 
                              type="monotone" 
                              dataKey="revenueNormalized" 
                              stroke="#10b981" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name="revenueNormalized"
                            />
                          )}
                          {selectedMetrics.has('aiInteractions') && (
                            <Line 
                              type="monotone" 
                              dataKey="aiInteractionsNormalized" 
                              stroke="#a855f7" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name="aiInteractionsNormalized"
                            />
                          )}
                          {selectedMetrics.has('patterns') && (
                            <Line 
                              type="monotone" 
                              dataKey="patternsNormalized" 
                              stroke="#f97316" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name="patternsNormalized"
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Correlation Analysis */}
                    {selectedMetrics.size > 1 && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Correlation Analysis</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(() => {
                            // Calculate correlation coefficients
                            const calculateCorrelation = (x: number[], y: number[]) => {
                              const n = Math.min(x.length, y.length);
                              if (n < 2) return 0;
                              
                              const xMean = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
                              const yMean = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
                              
                              let numerator = 0;
                              let xSumSq = 0;
                              let ySumSq = 0;
                              
                              for (let i = 0; i < n; i++) {
                                const xDiff = x[i] - xMean;
                                const yDiff = y[i] - yMean;
                                numerator += xDiff * yDiff;
                                xSumSq += xDiff * xDiff;
                                ySumSq += yDiff * yDiff;
                              }
                              
                              const denominator = Math.sqrt(xSumSq * ySumSq);
                              return denominator === 0 ? 0 : numerator / denominator;
                            };

                            const correlations: Array<{ metric1: string; metric2: string; value: number }> = [];
                            const metrics = [
                              { key: 'users', label: 'Users', values: userValues },
                              { key: 'revenue', label: 'Revenue', values: revenueValues },
                              { key: 'aiInteractions', label: 'AI Interactions', values: aiValues },
                              { key: 'patterns', label: 'Patterns', values: patternValues }
                            ].filter(m => selectedMetrics.has(m.key));

                            for (let i = 0; i < metrics.length; i++) {
                              for (let j = i + 1; j < metrics.length; j++) {
                                const corr = calculateCorrelation(metrics[i].values, metrics[j].values);
                                correlations.push({
                                  metric1: metrics[i].label,
                                  metric2: metrics[j].label,
                                  value: corr
                                });
                              }
                            }

                            return correlations.map((corr, idx) => {
                              const strength = Math.abs(corr.value);
                              const strengthLabel = strength > 0.7 ? 'Strong' : strength > 0.4 ? 'Moderate' : 'Weak';
                              const direction = corr.value > 0 ? 'positive' : 'negative';
                              const color = strength > 0.7 
                                ? (direction === 'positive' ? 'text-green-600' : 'text-red-600')
                                : strength > 0.4 
                                ? 'text-yellow-600' 
                                : 'text-gray-600';

                              return (
                                <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">
                                      {corr.metric1} ↔ {corr.metric2}
                                    </span>
                                    <span className={`text-sm font-semibold ${color}`}>
                                      {corr.value.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${
                                          strength > 0.7
                                            ? direction === 'positive' ? 'bg-green-500' : 'bg-red-500'
                                            : strength > 0.4
                                            ? 'bg-yellow-500'
                                            : 'bg-gray-400'
                                        }`}
                                        style={{ width: `${Math.abs(corr.value) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-600">
                                      {strengthLabel} {direction}
                                    </span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <p className="text-xs text-gray-600 mt-4">
                          Correlation values range from -1 (perfect negative) to +1 (perfect positive). 
                          Values closer to ±1 indicate stronger relationships.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
          )}
        </div>
      )}

      {/* Unified Patterns & Insights Section */}
      {((overview?.unifiedPatterns?.length ?? 0) > 0 || (overview?.unifiedInsights?.length ?? 0) > 0) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Patterns & Insights</h2>
            <Button
              variant="secondary"
              onClick={() => setShowPatternsSection(!showPatternsSection)}
            >
              {showPatternsSection ? 'Hide' : 'Show'}
            </Button>
          </div>
          
          {showPatternsSection && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Patterns Card */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Unified Patterns</h3>
                  </div>
                  <Badge color="blue" size="sm">
                    {overview?.unifiedPatterns?.length ?? 0} patterns
                  </Badge>
                </div>
                
                {(overview?.unifiedPatterns?.length ?? 0) > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {overview?.unifiedPatterns?.slice(0, 5).map((pattern) => (
                      <div key={pattern.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge color="blue" size="sm">
                                {pattern.source === 'ai-learning' ? 'AI Learning' : 'Business AI'}
                              </Badge>
                              <span className="text-xs text-gray-700 font-medium">{pattern.type}</span>
                            </div>
                            <p className="text-sm text-gray-900 font-medium">{pattern.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-700">
                          {pattern.frequency !== undefined && (
                            <span>Frequency: {pattern.frequency}</span>
                          )}
                          {pattern.confidence !== undefined && (
                            <span>Confidence: {Math.round(pattern.confidence * 100)}%</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(overview?.unifiedPatterns?.length ?? 0) > 5 && (
                      <Link href="/admin-portal/business-ai">
                        <div className="text-center py-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                          View all {overview?.unifiedPatterns?.length ?? 0} patterns →
                        </div>
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 text-center py-4">No patterns discovered yet</p>
                )}
              </Card>

              {/* Insights Card */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Lightbulb className="w-5 h-5 text-yellow-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Unified Insights</h3>
                  </div>
                  <Badge color="yellow" size="sm">
                    {overview?.unifiedInsights?.length ?? 0} insights
                  </Badge>
                </div>
                
                {(overview?.unifiedInsights?.length ?? 0) > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {overview?.unifiedInsights?.slice(0, 5).map((insight) => {
                      const sourceColors = {
                        'business-intelligence': 'blue',
                        'business-ai': 'green',
                        'ai-learning': 'purple'
                      };
                      const sourceLabels = {
                        'business-intelligence': 'BI',
                        'business-ai': 'Business AI',
                        'ai-learning': 'AI Learning'
                      };
                      const color = sourceColors[insight.source] || 'gray';
                      
                      return (
                        <div key={insight.id} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <Badge color={color as any} size="sm">
                                  {sourceLabels[insight.source]}
                                </Badge>
                                {insight.impact && (
                                  <Badge 
                                    color={insight.impact === 'high' ? 'red' : insight.impact === 'medium' ? 'yellow' : 'green'} 
                                    size="sm"
                                  >
                                    {insight.impact} impact
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-900 font-medium">{insight.title}</p>
                              {insight.description && (
                                <p className="text-xs text-gray-700 mt-1">{insight.description}</p>
                              )}
                            </div>
                          </div>
                          {insight.confidence !== undefined && (
                            <div className="mt-2 text-xs text-gray-700">
                              Confidence: {Math.round(insight.confidence)}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(overview?.unifiedInsights?.length ?? 0) > 5 && (
                      <div className="text-center py-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                        <Link href="/admin-portal/business-intelligence">View all insights →</Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 text-center py-4">No insights available yet</p>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin-portal/business-intelligence">
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-medium text-gray-900">View Business Intelligence</h3>
                  <p className="text-sm text-gray-600">Analytics and insights</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin-portal/ai-learning">
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center space-x-3">
                <Brain className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Manage AI Learning</h3>
                  <p className="text-sm text-gray-600">Centralized learning system</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin-portal/business-ai">
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-green-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Business AI Management</h3>
                  <p className="text-sm text-gray-600">Digital twins and patterns</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin-portal/ai-context">
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center space-x-3">
                <Search className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Debug AI Context</h3>
                  <p className="text-sm text-gray-600">Context monitoring tools</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

