'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from 'shared/components';
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { adminApiService, DashboardStats } from '../../../lib/adminApiService';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon: React.ComponentType<any>;
  color?: string;
}

const StatCard = ({ title, value, trend, icon: Icon, color = 'blue' }: StatCardProps) => {
  const getTrendColor = (trend: number) => {
    return trend >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getTrendIcon = (trend: number) => {
    return trend >= 0 ? TrendingUp : TrendingDown;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend !== undefined && trend !== null && (
            <div className={`flex items-center mt-1 ${getTrendColor(trend)}`}>
              {React.createElement(getTrendIcon(trend), { className: 'w-4 h-4 mr-1' })}
              <span className="text-sm font-medium">{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </Card>
  );
};

interface SystemAlert {
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
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

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      loadDashboardData();
    }
  }, [status, session]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load dashboard stats from API
      const statsResponse = await adminApiService.getDashboardStats();
      if (statsResponse.error) {
        throw new Error(statsResponse.error);
      }

      setStats(statsResponse.data as DashboardStats || {
        totalUsers: 0,
        activeUsers: 0,
        totalBusinesses: 0,
        monthlyRevenue: 0,
        systemHealth: 99.9
      });

      // Load real system alerts from API
      try {
        const alertsResponse = await adminApiService.getSystemHealth();
        if (alertsResponse.data && typeof alertsResponse.data === 'object' && 'alerts' in alertsResponse.data) {
          setAlerts((alertsResponse.data as any).alerts || []);
        } else {
          // No alerts is good - system is healthy
          setAlerts([]);
        }
      } catch (alertError) {
        console.error('Error loading system alerts:', alertError);
        // Set empty alerts array instead of mock data
        setAlerts([]);
      }

      // Load real recent activity from API
      try {
        const activityResponse = await adminApiService.getRecentActivity();
        if (activityResponse.error) {
          console.error('Error loading recent activity:', activityResponse.error);
          setRecentActivity([]);
        } else {
          setRecentActivity((activityResponse.data as RecentActivity[]) || []);
        }
      } catch (activityError) {
        console.error('Error loading recent activity:', activityError);
        setRecentActivity([]);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
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

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">Authentication Required</div>
          <p className="text-gray-600">Please log in to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Platform overview and quick actions</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Dashboard</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Platform overview and quick actions</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers?.toLocaleString() || '0'}
          trend={stats?.userGrowthTrend}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Active Businesses"
          value={stats?.totalBusinesses || 0}
          trend={stats?.businessGrowthTrend}
          icon={Briefcase}
          color="green"
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${(stats?.monthlyRevenue || 0).toLocaleString()}`}
          trend={stats?.revenueGrowthTrend}
          icon={DollarSign}
          color="purple"
        />
        <StatCard
          title="System Health"
          value={`${stats?.systemHealth || 99.9}%`}
          icon={Activity}
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => window.location.href = '/admin-portal/users'}
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-red-100 w-fit mb-3">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Manage Users</h3>
            <p className="text-sm text-gray-600">Ban, suspend, or manage user accounts</p>
          </button>
          <button 
            onClick={() => window.location.href = '/admin-portal/moderation'}
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-blue-100 w-fit mb-3">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Review Content</h3>
            <p className="text-sm text-gray-600">Review reported content and violations</p>
          </button>
          <button 
            onClick={() => window.location.href = '/admin-portal/performance'}
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-green-100 w-fit mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">System Health</h3>
            <p className="text-sm text-gray-600">Check system performance and metrics</p>
          </button>
        </div>
      </div>

      {/* System Alerts */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Alerts</h2>
        <div className="space-y-3">
          {alerts.length > 0 ? (
            alerts.map((alert, index) => (
              <div key={index} className={`p-4 border rounded-lg ${
                alert.type === 'success' ? 'text-green-600 bg-green-50 border-green-200' :
                alert.type === 'warning' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                'text-red-600 bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start space-x-3">
                  {alert.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium">{alert.title}</h4>
                    <p className="text-sm mt-1">{alert.message}</p>
                    <p className="text-xs mt-2 opacity-75">{alert.timestamp}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 border rounded-lg text-gray-600 bg-gray-50 border-gray-200">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-medium">All Systems Operational</h4>
                  <p className="text-sm mt-1">No active alerts at this time</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <Card className="p-6">
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const getActivityColor = (action: string) => {
                  if (action.includes('CREATE') || action.includes('REGISTER')) return 'bg-blue-500';
                  if (action.includes('DELETE') || action.includes('REMOVE')) return 'bg-red-500';
                  if (action.includes('UPDATE') || action.includes('MODIFY')) return 'bg-yellow-500';
                  return 'bg-green-500';
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
                  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
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
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className={`w-2 h-2 ${getActivityColor(activity.action)} rounded-full`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{formatAction(activity.action)}</p>
                      <p className="text-xs text-gray-500">
                        {userEmail}
                        {resourceInfo && ` • ${resourceInfo}`}
                      </p>
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
    </div>
  );
} 