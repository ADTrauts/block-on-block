'use client';

import React, { useState, useEffect } from 'react';
import { Card, Spinner, Alert, Badge } from 'shared/components';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { getTimeOffAnalytics, type TimeOffAnalytics } from '@/api/hrAnalytics';
import { toast } from 'react-hot-toast';

interface TimeOffAnalyticsDashboardProps {
  businessId: string;
}

export default function TimeOffAnalyticsDashboard({
  businessId,
}: TimeOffAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<TimeOffAnalytics | null>(null);
  const [dateRange, setDateRange] = useState<'30d' | '90d' | '1y'>('1y');

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

      const data = await getTimeOffAnalytics(
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
              <p className="text-sm text-gray-600 mb-1">Total Requests</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.totalRequests}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.pendingRequests}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Approved</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.approvedRequests}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Denied</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.overview.deniedRequests}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Approval Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Approval Performance</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Average Approval Time</span>
                <span className="text-lg font-semibold text-gray-900">
                  {analytics.approval.averageApprovalTimeHours > 0
                    ? `${analytics.approval.averageApprovalTimeHours.toFixed(1)} hours`
                    : 'N/A'}
                </span>
              </div>
            </div>
            {analytics.approval.pendingOverdue > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    {analytics.approval.pendingOverdue} request{analytics.approval.pendingOverdue !== 1 ? 's' : ''} pending for more than 3 days
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Approved</span>
              <Badge color="green" size="sm">
                {analytics.overview.approvedRequests} ({analytics.overview.totalRequests > 0
                  ? Math.round((analytics.overview.approvedRequests / analytics.overview.totalRequests) * 100)
                  : 0}%)
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Pending</span>
              <Badge color="yellow" size="sm">
                {analytics.overview.pendingRequests} ({analytics.overview.totalRequests > 0
                  ? Math.round((analytics.overview.pendingRequests / analytics.overview.totalRequests) * 100)
                  : 0}%)
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Denied</span>
              <Badge color="red" size="sm">
                {analytics.overview.deniedRequests} ({analytics.overview.totalRequests > 0
                  ? Math.round((analytics.overview.deniedRequests / analytics.overview.totalRequests) * 100)
                  : 0}%)
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Usage by Type */}
      {analytics.usage.byType.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage by Type</h3>
          <div className="space-y-3">
            {analytics.usage.byType.map((item) => (
              <div key={item.type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{item.type}</span>
                  <span className="text-sm text-gray-600">
                    {item.daysUsed} days ({item.requests} requests)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${(item.daysUsed / Math.max(...analytics.usage.byType.map(i => i.daysUsed), 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Usage by Department */}
      {analytics.usage.byDepartment.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage by Department</h3>
          <div className="space-y-3">
            {analytics.usage.byDepartment.map((item) => (
              <div key={item.department}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{item.department}</span>
                  <span className="text-sm text-gray-600">
                    {item.daysUsed} days ({item.employees} employees)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${(item.daysUsed / Math.max(...analytics.usage.byDepartment.map(i => i.daysUsed), 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

