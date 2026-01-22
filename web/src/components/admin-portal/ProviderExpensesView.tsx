'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Spinner, Alert, Badge } from 'shared/components';
import { adminApiService } from '../../lib/adminApiService';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  BarChart3
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

interface ProviderExpensesViewProps {
  period?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export default function ProviderExpensesView({ period = 'month', dateRange }: ProviderExpensesViewProps) {
  const [expensesData, setExpensesData] = useState<any>(null);
  const [historicalExpenses, setHistoricalExpenses] = useState<
    Array<{ date: string; openai: number; anthropic: number; total: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadExpensesData();
  }, [period, dateRange]);

  const loadExpensesData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminApiService.getAIProviderExpensesCombined(
        period,
        dateRange?.startDate,
        dateRange?.endDate
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if ('data' in response && response.data) {
        setExpensesData(response.data);
      }

      // Load historical expense snapshots for trend chart
      const defaultStart = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const defaultEnd = new Date().toISOString();
      const historicalStart = dateRange?.startDate || defaultStart;
      const historicalEnd = dateRange?.endDate || defaultEnd;

      const historicalResp = await adminApiService.getAIProviderHistoricalExpenses(
        'all',
        period as 'day' | 'week' | 'month' | 'year',
        historicalStart,
        historicalEnd
      );

      if (!('error' in historicalResp) && 'data' in historicalResp && historicalResp.data) {
        const pointsMap = new Map<string, { date: string; openai: number; anthropic: number; total: number }>();
        (historicalResp.data as Array<any>).forEach(snap => {
          const rawDate: string | undefined =
            typeof snap.periodStart === 'string'
              ? snap.periodStart
              : typeof snap.date === 'string'
                ? snap.date
                : undefined;
          if (!rawDate) return;
          const dateKey = rawDate.split('T')[0];
          if (!pointsMap.has(dateKey)) {
            pointsMap.set(dateKey, { date: dateKey, openai: 0, anthropic: 0, total: 0 });
          }
          const point = pointsMap.get(dateKey)!;
          const cost = snap.totalCost || 0;
          if (snap.provider === 'openai') {
            point.openai += cost;
          } else if (snap.provider === 'anthropic') {
            point.anthropic += cost;
          }
          point.total = point.openai + point.anthropic;
        });

        const sortedPoints = Array.from(pointsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        setHistoricalExpenses(sortedPoints);
      } else {
        setHistoricalExpenses([]);
      }
    } catch (err) {
      console.error('Error loading provider expenses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load expenses data');
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

  if (!expensesData) {
    return (
      <Alert>
        No expense data available. Data will appear once provider APIs are fully configured.
      </Alert>
    );
  }

  const totalCost = expensesData.totalCost || 0;
  const breakdown = expensesData.breakdown || {};
  const openaiCost = breakdown.openai?.cost || 0;
  const anthropicCost = breakdown.anthropic?.cost || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-700 mb-1">Total Provider Expenses</p>
              <p className="text-2xl font-bold text-gray-900">
                ${totalCost.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">{period}</p>
            </div>
            <DollarSign className="w-8 h-8 text-red-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-700 mb-1">OpenAI Costs</p>
              <p className="text-2xl font-bold text-gray-900">
                ${openaiCost.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {totalCost > 0 ? ((openaiCost / totalCost) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-700 mb-1">Anthropic Costs</p>
              <p className="text-2xl font-bold text-gray-900">
                ${anthropicCost.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {totalCost > 0 ? ((anthropicCost / totalCost) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-600 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Provider Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Provider</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">OpenAI</span>
              <span className="font-semibold text-gray-900">${openaiCost.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${totalCost > 0 ? (openaiCost / totalCost) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">Anthropic</span>
              <span className="font-semibold text-gray-900">${anthropicCost.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full"
                style={{ width: `${totalCost > 0 ? (anthropicCost / totalCost) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Cost Trends (historical snapshots) */}
      {historicalExpenses.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalExpenses}>
                <defs>
                  <linearGradient id="colorOpenAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAnthropic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
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
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="openai" 
                  name="OpenAI"
                  stroke="#3b82f6" 
                  fillOpacity={1}
                  fill="url(#colorOpenAI)"
                />
                <Area 
                  type="monotone" 
                  dataKey="anthropic" 
                  name="Anthropic"
                  stroke="#9333ea" 
                  fillOpacity={1}
                  fill="url(#colorAnthropic)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* P&L Impact Note */}
      <Alert>
        <DollarSign className="h-4 w-4" />
        <div>
          <strong>Note:</strong> These are operating expenses (Vssyl pays providers).
          User revenue is tracked separately in the Subscriptions and Payments tabs.
          Net profit = Total Revenue - Total Expenses.
        </div>
      </Alert>

      <div className="flex justify-end">
        <Button onClick={loadExpensesData} variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>
    </div>
  );
}
