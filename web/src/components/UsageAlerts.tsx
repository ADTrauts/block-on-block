'use client';

import React, { useState, useEffect } from 'react';
import { Card, Alert, Badge, Spinner } from 'shared/components';
import { AlertTriangle, AlertCircle, XCircle, TrendingUp } from 'lucide-react';
import { authenticatedApiCall } from '../lib/apiUtils';

interface UsageAlert {
  metric: string;
  severity: 'info' | 'warning' | 'critical';
  percentageUsed: number;
  message: string;
  limit: number;
  currentUsage: number;
  remaining: number;
}

interface UsageAlertsProps {
  businessId?: string;
  onAlertClick?: (metric: string) => void;
}

export default function UsageAlerts({ businessId, onAlertClick }: UsageAlertsProps) {
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, [businessId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = businessId ? `?businessId=${businessId}` : '';
      const response = await authenticatedApiCall<{ success: boolean; alerts: UsageAlert[] }>(
        `/api/usage/alerts/list${queryParams}`
      );

      if (response.success && response.alerts) {
        setAlerts(response.alerts);
      } else {
        setError('Failed to load usage alerts');
      }
    } catch (err) {
      console.error('Error loading usage alerts:', err);
      setError('Failed to load usage alerts');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'info':
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'info';
    }
  };

  const formatMetric = (metric: string): string => {
    return metric
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatValue = (value: number, metric: string): string => {
    if (metric.includes('storage') || metric.includes('gb')) {
      return `${value.toLocaleString()} GB`;
    }
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <div className="p-6 text-center">
          <Spinner size="md" />
          <p className="mt-2 text-gray-700">Loading usage alerts...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="error" title="Error">
        {error}
      </Alert>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-1">All usage within limits</p>
          <p className="text-sm text-gray-600">
            Your usage is within acceptable ranges for all metrics.
          </p>
        </div>
      </Card>
    );
  }

  // Group alerts by severity (critical first, then warning, then info)
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');

  const groupedAlerts = [...criticalAlerts, ...warningAlerts, ...infoAlerts];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Usage Alerts
        </h3>
        <Badge color={criticalAlerts.length > 0 ? 'red' : warningAlerts.length > 0 ? 'yellow' : 'blue'}>
          {alerts.length} {alerts.length === 1 ? 'Alert' : 'Alerts'}
        </Badge>
      </div>

      <div className="space-y-3">
        {groupedAlerts.map((alert, index) => {
          const severityColor = getSeverityColor(alert.severity);
          
          return (
            <Alert
              key={`${alert.metric}-${index}`}
              variant={severityColor}
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(alert.severity)}
                    <span className="font-semibold">{formatMetric(alert.metric)}</span>
                  </div>
                  <Badge color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'yellow' : 'blue'}>
                    {alert.percentageUsed.toFixed(0)}%
                  </Badge>
                </div>
              }
            >
              <div className="space-y-2">
                <p className="text-sm">{alert.message}</p>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      alert.severity === 'critical'
                        ? 'bg-red-600'
                        : alert.severity === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(alert.percentageUsed, 100)}%` }}
                  />
                </div>

                {/* Usage details */}
                <div className="flex items-center justify-between text-xs text-gray-700">
                  <span>
                    Used: {formatValue(alert.currentUsage, alert.metric)} / {formatValue(alert.limit, alert.metric)}
                  </span>
                  {alert.remaining >= 0 && (
                    <span className="font-medium">
                      {formatValue(alert.remaining, alert.metric)} remaining
                    </span>
                  )}
                  {alert.remaining < 0 && (
                    <span className="font-medium text-red-600">
                      {formatValue(Math.abs(alert.remaining), alert.metric)} over limit
                    </span>
                  )}
                </div>
              </div>
            </Alert>
          );
        })}
      </div>

      {onAlertClick && (
        <div className="text-sm text-gray-600 text-center">
          <button
            onClick={() => onAlertClick('usage')}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            View detailed usage breakdown
          </button>
        </div>
      )}
    </div>
  );
}

