'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Spinner, Alert, Badge } from 'shared/components';
import { adminApiService } from '../../lib/adminApiService';
import { 
  Activity, 
  TrendingUp, 
  DollarSign, 
  RefreshCw,
  Brain,
  Zap,
  BarChart3,
  Clock
} from 'lucide-react';
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
  Legend,
  BarChart,
  Bar
} from 'recharts';

interface ProviderUsageViewProps {
  provider: 'combined' | 'openai' | 'anthropic';
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export default function ProviderUsageView({ provider, dateRange }: ProviderUsageViewProps) {
  const [usageData, setUsageData] = useState<any>(null);
  const [usageTrends, setUsageTrends] = useState<Array<{ date: string; cost: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadUsageData();
  }, [provider, dateRange]);

  const loadUsageData = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (provider === 'combined') {
        response = await adminApiService.getAIProviderUsageCombined(
          dateRange?.startDate,
          dateRange?.endDate
        );
      } else if (provider === 'openai') {
        response = await adminApiService.getAIProviderUsageOpenAI(
          dateRange?.startDate,
          dateRange?.endDate
        );
      } else {
        response = await adminApiService.getAIProviderUsageAnthropic(
          dateRange?.startDate,
          dateRange?.endDate
        );
      }

      if (response.error) {
        throw new Error(response.error);
      }

      if ('data' in response && response.data) {
        setUsageData(response.data);
      }

      // Also load historical trends for the selected provider
      const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const defaultEnd = new Date().toISOString();
      const historicalStart = dateRange?.startDate || defaultStart;
      const historicalEnd = dateRange?.endDate || defaultEnd;

      const historicalResp = await adminApiService.getAIProviderHistoricalUsage(
        provider === 'combined' ? 'all' : provider,
        historicalStart,
        historicalEnd,
        'day'
      );

      if (!('error' in historicalResp) && 'data' in historicalResp && historicalResp.data) {
        const trends = (historicalResp.data as Array<{ date: string; cost?: number }>).map(item => ({
          date: item.date,
          cost: item.cost || 0
        }));
        setUsageTrends(trends);
      } else {
        setUsageTrends([]);
      }
    } catch (err) {
      console.error('Error loading provider usage:', err);
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  if (!usageData) {
    return (
      <Alert>
        No usage data available. Data will appear once provider APIs are fully configured.
      </Alert>
    );
  }

  const summary = usageData.summary || {};
  const byProvider = usageData.byProvider || {};

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-700 mb-1">Total Tokens</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.totalTokens?.toLocaleString() || 0}
              </p>
            </div>
            <Brain className="w-8 h-8 text-purple-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-700 mb-1">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.totalRequests?.toLocaleString() || 0}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-700 mb-1">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                ${summary.totalCost?.toFixed(2) || '0.00'}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-700 mb-1">Provider</p>
              <Badge color={provider === 'combined' ? 'blue' : 'gray'}>
                {provider === 'combined' ? 'Combined' : provider.toUpperCase()}
              </Badge>
            </div>
            <BarChart3 className="w-8 h-8 text-orange-600 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Usage Trends (historical snapshots) */}
      {usageTrends.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usageTrends}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  stroke="#6b7280"
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  stroke="#6b7280"
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="cost" 
                  stroke="#10b981" 
                  fillOpacity={1}
                  fill="url(#colorCost)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Provider Comparison (for combined view) */}
      {provider === 'combined' && byProvider.openai && byProvider.anthropic && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">OpenAI Usage</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Tokens</span>
                <span className="font-semibold text-gray-900">
                  {byProvider.openai.tokens?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Requests</span>
                <span className="font-semibold text-gray-900">
                  {byProvider.openai.requests?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Cost</span>
                <span className="font-semibold text-gray-900">
                  ${byProvider.openai.cost?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Anthropic Usage</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Tokens</span>
                <span className="font-semibold text-gray-900">
                  {byProvider.anthropic.tokens?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Requests</span>
                <span className="font-semibold text-gray-900">
                  {byProvider.anthropic.requests?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Cost</span>
                <span className="font-semibold text-gray-900">
                  ${byProvider.anthropic.cost?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Model Breakdown */}
      {byProvider[provider === 'combined' ? 'openai' : provider]?.models && 
       byProvider[provider === 'combined' ? 'openai' : provider].models.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage by Model</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Model</th>
                  <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700">Tokens</th>
                  <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700">Requests</th>
                  <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byProvider[provider === 'combined' ? 'openai' : provider].models.map((model: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2 px-4 text-sm text-gray-900">{model.model}</td>
                    <td className="py-2 px-4 text-sm text-gray-700 text-right">
                      {model.tokens?.toLocaleString() || 0}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-700 text-right">
                      {model.requests?.toLocaleString() || 0}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-700 text-right">
                      ${model.cost?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={loadUsageData} variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>
    </div>
  );
}
