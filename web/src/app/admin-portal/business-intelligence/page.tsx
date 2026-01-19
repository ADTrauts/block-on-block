'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Alert, Spinner, Modal, Input } from 'shared/components';
import { adminApiService } from '../../../lib/adminApiService';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity,
  Filter,
  Search,
  RefreshCw,
  Download,
  Eye,
  Target,
  PieChart,
  LineChart,
  Calendar,
  Zap,
  Brain,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface BusinessIntelligenceData {
  userGrowth: {
    totalUsers: number;
    newUsersThisMonth: number;
    activeUsers: number;
    churnRate: number;
    growthRate: number;
  };
  revenueMetrics: {
    totalRevenue: number;
    monthlyRecurringRevenue: number;
    averageRevenuePerUser: number;
    revenueGrowth: number;
    topRevenueSources: Array<{
      source: string;
      amount: number;
      percentage: number;
    }>;
  };
  engagementMetrics: {
    averageSessionDuration: number;
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    featureUsage: Array<{
      feature: string;
      usageCount: number;
      percentage: number;
    }>;
  };
  predictiveInsights: Array<{
    type: 'churn' | 'upsell' | 'growth' | 'risk';
    title: string;
    description: string;
    confidence: number;
    impact: 'high' | 'medium' | 'low';
    recommendedAction: string;
  }>;
  abTests: Array<{
    id: string;
    name: string;
    status: 'running' | 'completed' | 'paused';
    startDate: string;
    endDate?: string;
    variantA: {
      name: string;
      users: number;
      conversionRate: number;
      revenue: number;
    };
    variantB: {
      name: string;
      users: number;
      conversionRate: number;
      revenue: number;
    };
    winner?: 'A' | 'B' | 'none';
    confidence: number;
  }>;
  userSegments: Array<{
    id: string;
    name: string;
    criteria: string;
    userCount: number;
    averageValue: number;
    growthRate: number;
  }>;
  competitiveAnalysis: {
    marketPosition: string;
    keyCompetitors: Array<{
      name: string;
      marketShare: number;
      strengths: string[];
      weaknesses: string[];
    }>;
    opportunities: string[];
    threats: string[];
  };
}

interface FilterOptions {
  dateRange: string;
  userType: string;
  metricType: string;
  segment: string;
  [key: string]: unknown;
}

export default function BusinessIntelligencePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BusinessIntelligenceData | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: '30d',
    userType: 'all',
    metricType: 'all',
    segment: 'all'
  });
  const [selectedInsight, setSelectedInsight] = useState<any>(null);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await adminApiService.getBusinessIntelligence(filters);
      setData((response as any)?.data || null);
    } catch (err) {
      console.error('Error loading business intelligence data:', err);
      setError('Failed to load business intelligence data. Please try again.');
      
      // Set empty data instead of mock data
      setData(null);
        } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load data
  useEffect(() => {
    loadData();
  }, [filters, loadData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadData();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportLoading(true);
    try {
      await adminApiService.exportBusinessIntelligence(filters, format);
    } catch (err) {
      console.error('Error exporting data:', err);
      setError('Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const getGrowthIcon = (rate: number) => {
    if (rate > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (rate < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-700" />;
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'churn': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'upsell': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'growth': return <Target className="w-5 h-5 text-blue-500" />;
      case 'risk': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Lightbulb className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'red';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getTestStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'blue';
      case 'completed': return 'green';
      case 'paused': return 'yellow';
      default: return 'gray';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Intelligence</h1>
          <p className="text-gray-600">Business metrics, predictive insights, A/B testing, and strategic reporting</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-blue-50 text-blue-600' : ''}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </Button>
          <Button onClick={loadData} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('csv')}
            disabled={exportLoading}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          
          <select
            value={filters.userType}
            onChange={(e) => setFilters(prev => ({ ...prev, userType: e.target.value }))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="all">All Users</option>
            <option value="premium">Premium Users</option>
            <option value="enterprise">Enterprise Users</option>
            <option value="free">Free Users</option>
          </select>
          
          <select
            value={filters.metricType}
            onChange={(e) => setFilters(prev => ({ ...prev, metricType: e.target.value }))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="all">All Metrics</option>
            <option value="growth">Growth Metrics</option>
            <option value="revenue">Revenue Metrics</option>
            <option value="engagement">Engagement Metrics</option>
          </select>
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Separation Notice */}
      <Alert>
        <div className="flex items-start space-x-2">
          <BarChart3 className="h-4 w-4 mt-0.5" />
          <div>
            <strong>Note:</strong> This page focuses on business and strategic metrics. For system performance, uptime, and technical metrics, see{' '}
            <a href="/admin-portal/analytics" className="text-blue-600 hover:underline font-medium">
              Platform Analytics
            </a>
            .
          </div>
        </div>
      </Alert>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size={48} />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.userGrowth.totalUsers.toLocaleString()}
                  </p>
                  <div className="flex items-center mt-1">
                    {getGrowthIcon(data.userGrowth.growthRate)}
                    <span className="text-sm text-gray-600 ml-1">
                      {data.userGrowth.growthRate > 0 ? '+' : ''}{data.userGrowth.growthRate}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">MRR</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.revenueMetrics.monthlyRecurringRevenue.toLocaleString()}
                  </p>
                  <div className="flex items-center mt-1">
                    {getGrowthIcon(data.revenueMetrics.revenueGrowth)}
                    <span className="text-sm text-gray-600 ml-1">
                      {data.revenueMetrics.revenueGrowth > 0 ? '+' : ''}{data.revenueMetrics.revenueGrowth}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.userGrowth.activeUsers.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    {((data.userGrowth.activeUsers / data.userGrowth.totalUsers) * 100).toFixed(1)}% of total
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">ARPU</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.revenueMetrics.averageRevenuePerUser}
                  </p>
                  <p className="text-sm text-gray-600">
                    Per user per month
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Predictive Insights */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Predictive Insights</h2>
              <Badge color="blue" size="sm">
                AI-Powered
              </Badge>
            </div>
            
            <div className="space-y-4">
              {data.predictiveInsights.map((insight, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{insight.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                        <p className="text-sm text-gray-700 mt-2">
                          <strong>Recommended Action:</strong> {insight.recommendedAction}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge color={getImpactColor(insight.impact)} size="sm">
                        {insight.impact} impact
                      </Badge>
                      <span className="text-sm text-gray-700">
                        {insight.confidence}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* A/B Testing */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">A/B Testing</h2>
            
            <div className="space-y-4">
              {data.abTests.map((test) => (
                <div key={test.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">{test.name}</h3>
                    <Badge color={getTestStatusColor(test.status)} size="sm">
                      {test.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-2">{test.variantA.name}</h4>
                      <div className="space-y-1 text-sm">
                        <p>Users: {test.variantA.users.toLocaleString()}</p>
                        <p>Conversion: {test.variantA.conversionRate}%</p>
                        <p>Revenue: ${test.variantA.revenue.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-2">{test.variantB.name}</h4>
                      <div className="space-y-1 text-sm">
                        <p>Users: {test.variantB.users.toLocaleString()}</p>
                        <p>Conversion: {test.variantB.conversionRate}%</p>
                        <p>Revenue: ${test.variantB.revenue.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  
                  {test.winner && (
                    <div className="mt-3 p-2 bg-green-50 rounded">
                      <p className="text-sm text-green-800">
                        <strong>Winner:</strong> Variant {test.winner} ({test.confidence}% confidence)
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* User Segments */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">User Segments</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.userSegments.map((segment) => (
                <div key={segment.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{segment.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{segment.criteria}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Users:</span>
                      <span className="font-medium">{segment.userCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Value:</span>
                      <span className="font-medium">${segment.averageValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Growth:</span>
                      <span className="font-medium text-green-600">
                        +{segment.growthRate}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Competitive Analysis */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Competitive Analysis</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Market Position</h3>
                <Badge color="green" size="lg">
                  {data.competitiveAnalysis.marketPosition}
                </Badge>
                
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Opportunities</h4>
                  <ul className="space-y-2">
                    {data.competitiveAnalysis.opportunities.map((opportunity, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        {opportunity}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Key Competitors</h3>
                <div className="space-y-4">
                  {data.competitiveAnalysis.keyCompetitors.map((competitor, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{competitor.name}</h4>
                        <span className="text-sm text-gray-600">{competitor.marketShare}% market share</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="font-medium text-green-600 mb-1">Strengths</p>
                          <ul className="space-y-1">
                            {competitor.strengths.map((strength, idx) => (
                              <li key={idx} className="text-gray-600">• {strength}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-red-600 mb-1">Weaknesses</p>
                          <ul className="space-y-1">
                            {competitor.weaknesses.map((weakness, idx) => (
                              <li key={idx} className="text-gray-600">• {weakness}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
          <p className="text-gray-700">Business intelligence data will appear here once available.</p>
        </div>
      )}
    </div>
  );
} 