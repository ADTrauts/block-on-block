'use client';

import React, { useState, useEffect } from 'react';
import { Card, Spinner, Alert, Badge } from 'shared/components';
import { TrendingUp, Users, CheckCircle2, Clock } from 'lucide-react';
import { getOnboardingAnalytics, type OnboardingAnalytics } from '@/api/hrAnalytics';
import { toast } from 'react-hot-toast';

interface OnboardingAnalyticsDashboardProps {
  businessId: string;
}

export default function OnboardingAnalyticsDashboard({
  businessId,
}: OnboardingAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<OnboardingAnalytics | null>(null);
  const [dateRange, setDateRange] = useState<'30d' | '90d' | '1y'>('90d');

  useEffect(() => {
    loadAnalytics();
  }, [businessId, dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      if (dateRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (dateRange === '90d') {
        startDate.setDate(startDate.getDate() - 90);
      } else {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      const data = await getOnboardingAnalytics(
        businessId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      setAnalytics(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <Alert type="error" title="Error Loading Analytics">
        {error}
      </Alert>
    );
  }

  if (!analytics) {
    return (
      <Alert type="info" title="No Data">
        No analytics data available
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setDateRange('30d')}
          className={`px-3 py-1 rounded text-sm ${
            dateRange === '30d'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          30 Days
        </button>
        <button
          onClick={() => setDateRange('90d')}
          className={`px-3 py-1 rounded text-sm ${
            dateRange === '90d'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          90 Days
        </button>
        <button
          onClick={() => setDateRange('1y')}
          className={`px-3 py-1 rounded text-sm ${
            dateRange === '1y'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          1 Year
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Journeys</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.totalJourneys}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Journeys</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.activeJourneys}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.completedJourneys}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg. Completion</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics.overview.averageCompletionDays !== null
                  ? `${analytics.overview.averageCompletionDays} days`
                  : 'N/A'}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Completion Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Completion Rate</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all"
                  style={{ width: `${analytics.completionRates.overall}%` }}
                />
              </div>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {analytics.completionRates.overall.toFixed(1)}%
            </span>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Breakdown by Status</h3>
          <div className="space-y-2">
            {analytics.taskBreakdown.byStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 capitalize">{item.status.toLowerCase().replace('_', ' ')}</span>
                <Badge color="blue" size="sm">{item.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Department & Position Breakdown */}
      {analytics.completionRates.byDepartment.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Completion by Department</h3>
          <div className="space-y-3">
            {analytics.completionRates.byDepartment.map((item) => (
              <div key={item.department}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{item.department}</span>
                  <span className="text-sm text-gray-600">{item.rate.toFixed(1)}% ({item.count} journeys)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Trends */}
      {analytics.trends.journeysStarted.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Journey Trends</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Journeys Started</p>
              <div className="flex items-end gap-1 h-32">
                {analytics.trends.journeysStarted.slice(-14).map((item, index) => {
                  const maxCount = Math.max(
                    ...analytics.trends.journeysStarted.slice(-14).map(i => i.count),
                    1
                  );
                  const height = (item.count / maxCount) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 rounded-t"
                        style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                        title={`${item.date}: ${item.count}`}
                      />
                      <span className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-top-left">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

