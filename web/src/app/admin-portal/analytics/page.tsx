'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Alert, Spinner, Modal, Input } from 'shared/components';
import { 
  BarChart3, 
  Activity, 
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { adminApiService } from '../../../lib/adminApiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AnalyticsData {
  userGrowth: {
    total: number;
    newThisMonth: number;
    growthRate: number;
    monthlyTrend: Array<{ month: string; count: number }>;
  };
  revenue: {
    total: number;
    thisMonth: number;
    growthRate: number;
    monthlyTrend: Array<{ month: string; amount: number }>;
  };
  engagement: {
    activeUsers: number;
    avgSessionDuration: number;
    retentionRate: number;
    dailyActiveUsers: Array<{ date: string; count: number }>;
  };
  system: {
    uptime: number;
    avgResponseTime: number;
    errorRate: number;
    performanceTrend: Array<{ date: string; responseTime: number }>;
  };
}

interface FilterOptions {
  dateRange: string;
  userType: string;
  metric: string;
}

interface RecentActivity {
  id: string;
  action: string;
  userId: string;
  resourceType: string | null;
  resourceId: string | null;
  details: string;
  timestamp: string;
  user?: {
    email: string;
    name: string | null;
  };
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: '30d',
    userType: 'all',
    metric: 'all'
  });
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      const [analyticsRes, realtimeRes, activityRes] = await Promise.all([
        adminApiService.getAnalytics(filters),
        adminApiService.getRealTimeMetrics(),
        adminApiService.getRecentActivity()
      ]);
      
      if (analyticsRes.error) {
        setError(analyticsRes.error);
        return;
      }

      if (realtimeRes.error) {
        setError(realtimeRes.error);
        return;
      }

      setAnalyticsData(analyticsRes.data as AnalyticsData);
      
      // Load real recent activity
      if (activityRes.error) {
        console.error('Error loading recent activity:', activityRes.error);
        setRecentActivity([]);
      } else {
        setRecentActivity((activityRes.data as RecentActivity[]) || []);
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAnalyticsData();
    
    if (autoRefresh) {
      const interval = setInterval(loadAnalyticsData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [filters, autoRefresh, loadAnalyticsData]);

  const exportData = async (format: 'csv' | 'json') => {
    try {
      const response = await adminApiService.exportAnalytics(filters, format);
      if (response.error) {
        setError(response.error);
        return;
      }

      // Create download link
      const blob = new Blob([response.data as string], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export data');
    }
  };

  if (loading && !analyticsData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
            <p className="text-gray-600 mt-2">Real-time platform metrics and insights</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-gray-600 mt-2">System performance, technical metrics, and real-time activity monitoring</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </span>
          </button>
          <button
            onClick={loadAnalyticsData}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium">Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>

          <select
            value={filters.userType}
            onChange={(e) => setFilters({ ...filters, userType: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All users</option>
            <option value="active">Active users</option>
            <option value="premium">Premium users</option>
            <option value="new">New users</option>
          </select>

          <select
            value={filters.metric}
            onChange={(e) => setFilters({ ...filters, metric: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All metrics</option>
            <option value="system">System performance</option>
            <option value="activity">Real-time activity</option>
          </select>

          <div className="flex items-center space-x-2 ml-auto">
            <button
              onClick={() => exportData('csv')}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export CSV</span>
            </button>
            <button
              onClick={() => exportData('json')}
              className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export JSON</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {analyticsData && (
        <div className="space-y-6">
          {/* System Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* System Performance */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-gray-900">System Performance</h3>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-700">Uptime</span>
                  <span className="font-semibold text-green-600">{analyticsData.system.uptime}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Avg Response Time</span>
                  <span className="font-semibold">{analyticsData.system.avgResponseTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Error Rate</span>
                  <span className={`font-semibold ${
                    analyticsData.system.errorRate < 1 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {analyticsData.system.errorRate}%
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick System Stats */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-700">API Requests (24h)</span>
                  <span className="font-semibold">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Database Queries (24h)</span>
                  <span className="font-semibold">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Cache Hit Rate</span>
                  <span className="font-semibold">-</span>
                </div>
              </div>
            </Card>

            {/* Resource Usage */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Resource Usage</h3>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-700">CPU Usage</span>
                  <span className="font-semibold">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Memory Usage</span>
                  <span className="font-semibold">-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Storage Usage</span>
                  <span className="font-semibold">-</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Performance Trends */}
          {analyticsData.system.performanceTrend && analyticsData.system.performanceTrend.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Time Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.system.performanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      stroke="#6b7280"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      stroke="#6b7280"
                      tickFormatter={(value) => `${value}ms`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => `${value}ms`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#f97316" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Note about business metrics */}
          <Alert>
            <div className="flex items-start space-x-2">
              <BarChart3 className="h-4 w-4 mt-0.5" />
              <div>
                <strong>Note:</strong> For business metrics (user growth, revenue, engagement), see{' '}
                <a href="/admin-portal/business-intelligence" className="text-blue-600 hover:underline font-medium">
                  Business Intelligence
                </a>
                {' '}page. This page focuses on system and technical performance metrics.
              </div>
            </div>
          </Alert>
        </div>
      )}

      {/* Real-time Activity Feed */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Real-time Activity</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live</span>
          </div>
        </div>
        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.slice(0, 10).map((activity) => {
              const getActivityColor = (action: string) => {
                if (action.includes('CREATE') || action.includes('REGISTER') || action.includes('SIGNUP')) return 'bg-blue-400';
                if (action.includes('DELETE') || action.includes('REMOVE')) return 'bg-red-400';
                if (action.includes('UPDATE') || action.includes('MODIFY') || action.includes('EDIT')) return 'bg-yellow-400';
                if (action.includes('SUBSCRIPTION') || action.includes('PAYMENT')) return 'bg-green-400';
                return 'bg-gray-400';
              };

              const formatAction = (action: string) => {
                return action
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, (l) => l.toUpperCase());
              };

              const formatTimestamp = (timestamp: string) => {
                const date = new Date(timestamp);
                const now = new Date();
                const diffMs = now.getTime() - date.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);

                if (diffMins < 1) return 'Just now';
                if (diffMins < 60) return `${diffMins} min ago`;
                if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
                return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
              };

              let details: Record<string, unknown> = {};
              try {
                details = JSON.parse(activity.details);
              } catch {
                // If parsing fails, use the raw string
              }

              const userEmail = activity.user?.email || details.email || 'Unknown user';
              const resourceInfo = activity.resourceType 
                ? `${activity.resourceType}${activity.resourceId ? ` #${activity.resourceId.substring(0, 8)}` : ''}`
                : '';

              return (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 ${getActivityColor(activity.action)} rounded-full`}></div>
                    <span className="text-sm font-medium text-gray-900">
                      {formatAction(activity.action)}
                      {userEmail !== 'Unknown user' && `: ${userEmail}`}
                      {resourceInfo && ` • ${resourceInfo}`}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No recent activity</p>
          </div>
        )}
      </Card>
    </div>
  );
} 