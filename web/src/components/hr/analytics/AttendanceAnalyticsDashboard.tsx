'use client';

import React, { useState, useEffect } from 'react';
import { Card, Spinner, Alert, Badge } from 'shared/components';
import { Users, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { getAttendanceAnalytics, type AttendanceAnalytics } from '@/api/hrAnalytics';
import { toast } from 'react-hot-toast';

interface AttendanceAnalyticsDashboardProps {
  businessId: string;
}

export default function AttendanceAnalyticsDashboard({
  businessId,
}: AttendanceAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [businessId, dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      if (dateRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate.setDate(startDate.getDate() - 90);
      }

      const data = await getAttendanceAnalytics(
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
          onClick={() => setDateRange('7d')}
          className={`px-3 py-1 rounded text-sm ${
            dateRange === '7d'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          7 Days
        </button>
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
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Employees</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.totalEmployees}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Today</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.activeToday}</p>
            </div>
            <Clock className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Clocked In Now</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.clockedInNow}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Open Exceptions</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.openExceptions}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Compliance */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Policy Compliance</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-600 h-4 rounded-full transition-all"
                style={{ width: `${analytics.compliance.policyComplianceRate}%` }}
              />
            </div>
          </div>
          <span className="text-2xl font-bold text-gray-900">
            {analytics.compliance.policyComplianceRate.toFixed(1)}%
          </span>
        </div>
      </Card>

      {/* Exceptions Breakdown */}
      {analytics.exceptions.byType.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Exceptions by Type</h3>
            <div className="space-y-2">
              {analytics.exceptions.byType.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">{item.type.toLowerCase().replace('_', ' ')}</span>
                  <Badge color="red" size="sm">{item.count}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Exceptions by Status</h3>
            <div className="space-y-2">
              {analytics.exceptions.byStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">{item.status.toLowerCase().replace('_', ' ')}</span>
                  <Badge color="yellow" size="sm">{item.count}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Daily Trends */}
      {analytics.trends.daily.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Attendance Trends</h3>
          <div className="flex items-end gap-1 h-48">
            {analytics.trends.daily.slice(-14).map((item, index) => {
              const maxCount = Math.max(
                ...analytics.trends.daily.slice(-14).map(i => Math.max(i.clockedIn, i.clockedOut)),
                1
              );
              const clockedInHeight = (item.clockedIn / maxCount) * 100;
              const clockedOutHeight = (item.clockedOut / maxCount) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end">
                    <div
                      className="flex-1 bg-blue-500 rounded-t"
                      style={{ height: `${clockedInHeight}%`, minHeight: item.clockedIn > 0 ? '4px' : '0' }}
                      title={`Clocked In: ${item.clockedIn}`}
                    />
                    <div
                      className="flex-1 bg-green-500 rounded-t"
                      style={{ height: `${clockedOutHeight}%`, minHeight: item.clockedOut > 0 ? '4px' : '0' }}
                      title={`Clocked Out: ${item.clockedOut}`}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-xs text-gray-600">Clocked In</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-xs text-gray-600">Clocked Out</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

