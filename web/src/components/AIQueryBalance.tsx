'use client';

import React, { useState, useEffect } from 'react';
import { Card, Badge, Spinner } from 'shared/components';
import { Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { authenticatedApiCall } from '../lib/apiUtils';

interface QueryBalance {
  available: boolean;
  remaining: number;
  totalAvailable: number;
  breakdown: {
    baseAllowance: number;
    purchased: number;
    rolledOver: number;
  };
  isUnlimited: boolean;
}

interface SpendingStatus {
  limit: number;
  currentSpending: number;
  remaining: number;
  overageQueries: number;
  overageCost: number;
}

interface AIQueryBalanceProps {
  businessId?: string;
  onPurchaseClick?: () => void;
  onSpendingLimitClick?: () => void;
}

export default function AIQueryBalance({ businessId, onPurchaseClick, onSpendingLimitClick }: AIQueryBalanceProps) {
  const [balance, setBalance] = useState<QueryBalance | null>(null);
  const [spending, setSpending] = useState<SpendingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBalance();
    loadSpendingStatus();
  }, [businessId]);

  const loadBalance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = businessId ? `?businessId=${businessId}` : '';
      const response = await authenticatedApiCall<{ success: boolean; data: QueryBalance }>(
        `/api/ai/queries/balance${params}`
      );

      if (response.success) {
        setBalance(response.data);
      }
    } catch (err) {
      console.error('Failed to load query balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to load balance');
    } finally {
      setLoading(false);
    }
  };

  const loadSpendingStatus = async () => {
    try {
      const params = businessId ? `?businessId=${businessId}` : '';
      const response = await authenticatedApiCall<{ success: boolean; data: SpendingStatus }>(
        `/api/ai/queries/spending${params}`
      );

      if (response.success) {
        setSpending(response.data);
      }
    } catch (err) {
      console.error('Failed to load spending status:', err);
      // Don't show error for spending status - it's optional
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Spinner size={24} />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  if (!balance) {
    return null;
  }

  // Enterprise tier - unlimited
  if (balance.isUnlimited) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Queries</h3>
              <p className="text-sm text-gray-600">Unlimited queries available</p>
            </div>
          </div>
          <Badge color="green">Unlimited</Badge>
        </div>
      </Card>
    );
  }

  const { remaining, breakdown } = balance;
  const isLow = remaining < 100;
  const isEmpty = remaining === 0;
  const percentage = balance.totalAvailable > 0 
    ? Math.round((remaining / balance.totalAvailable) * 100) 
    : 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isEmpty ? 'bg-red-100' : isLow ? 'bg-yellow-100' : 'bg-blue-100'
            }`}>
              <Zap className={`w-6 h-6 ${
                isEmpty ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Queries</h3>
              <p className="text-sm text-gray-600">
                {isEmpty ? 'No queries remaining' : `${remaining.toLocaleString()} queries remaining`}
              </p>
            </div>
          </div>
          {isEmpty ? (
            <Badge color="red">Exhausted</Badge>
          ) : isLow ? (
            <Badge color="yellow">Low</Badge>
          ) : (
            <Badge color="blue">Available</Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Usage</span>
            <span>{percentage}% remaining</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isEmpty ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
          <div>
            <p className="text-xs text-gray-600 mb-1">Base Allowance</p>
            <p className="text-sm font-semibold text-gray-900">
              {breakdown.baseAllowance.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Purchased</p>
            <p className="text-sm font-semibold text-gray-900">
              {breakdown.purchased.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Rolled Over</p>
            <p className="text-sm font-semibold text-gray-900">
              {breakdown.rolledOver.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Spending Limit Section */}
        {spending && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Monthly Spending Limit</p>
                <p className="text-sm font-semibold text-gray-900">
                  {spending.limit > 0 ? `$${spending.limit.toFixed(2)}` : 'Not set'}
                </p>
              </div>
              {spending.limit > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-600 mb-1">Current Spending</p>
                  <p className={`text-sm font-semibold ${
                    spending.currentSpending >= spending.limit ? 'text-red-600' : 
                    spending.currentSpending >= spending.limit * 0.8 ? 'text-yellow-600' : 
                    'text-gray-900'
                  }`}>
                    ${spending.currentSpending.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {spending.limit > 0 && (
              <>
                {/* Spending Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Spending</span>
                    <span>${spending.remaining.toFixed(2)} remaining</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        spending.currentSpending >= spending.limit ? 'bg-red-500' : 
                        spending.currentSpending >= spending.limit * 0.8 ? 'bg-yellow-500' : 
                        'bg-green-500'
                      }`}
                      style={{ 
                        width: `${Math.min(100, (spending.currentSpending / spending.limit) * 100)}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Overage Info */}
                {spending.overageQueries > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <p className="text-xs font-medium text-yellow-800">Overage Usage</p>
                    </div>
                    <p className="text-xs text-yellow-700">
                      {spending.overageQueries.toLocaleString()} queries @ ${spending.overageCost.toFixed(2)}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Spending Limit Button */}
            {onSpendingLimitClick && (
              <button
                onClick={onSpendingLimitClick}
                className="w-full mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                {spending.limit > 0 ? 'Manage Spending Limit' : 'Set Spending Limit'}
              </button>
            )}
          </div>
        )}

        {/* Purchase button */}
        {onPurchaseClick && (
          <button
            onClick={onPurchaseClick}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Purchase Query Packs
          </button>
        )}
      </div>
    </Card>
  );
}

