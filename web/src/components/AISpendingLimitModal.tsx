'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner } from 'shared/components';
import { DollarSign, AlertCircle, Info } from 'lucide-react';
import { authenticatedApiCall } from '../lib/apiUtils';

interface SpendingStatus {
  limit: number;
  currentSpending: number;
  remaining: number;
  overageQueries: number;
  overageCost: number;
}

interface AISpendingLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  onUpdate?: () => void;
}

const PRICE_PER_QUERY = 0.02;

export default function AISpendingLimitModal({ 
  isOpen, 
  onClose, 
  businessId,
  onUpdate 
}: AISpendingLimitModalProps) {
  const [spending, setSpending] = useState<SpendingStatus | null>(null);
  const [limit, setLimit] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSpendingStatus();
    }
  }, [isOpen, businessId]);

  const loadSpendingStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = businessId ? `?businessId=${businessId}` : '';
      const response = await authenticatedApiCall<{ success: boolean; data: SpendingStatus }>(
        `/api/ai/queries/spending${params}`
      );

      if (response.success) {
        setSpending(response.data);
        setLimit(response.data.limit > 0 ? response.data.limit.toString() : '');
      }
    } catch (err) {
      console.error('Failed to load spending status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load spending status');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const limitValue = parseFloat(limit);
    
    if (isNaN(limitValue) || limitValue < 0) {
      setError('Please enter a valid amount (0 or greater)');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await authenticatedApiCall<{ success: boolean; message?: string }>(
        `/api/ai/queries/spending/limit`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            limit: limitValue,
            businessId: businessId || null,
          }),
        }
      );

      if (response.success) {
        onUpdate?.();
        onClose();
      } else {
        setError('Failed to update spending limit');
      }
    } catch (err) {
      console.error('Failed to save spending limit:', err);
      setError(err instanceof Error ? err.message : 'Failed to save spending limit');
    } finally {
      setSaving(false);
    }
  };

  const estimatedQueries = limit ? Math.floor(parseFloat(limit) / PRICE_PER_QUERY) : 0;

  return (
    <Modal open={isOpen} onClose={onClose} title="AI Query Spending Limit" size="medium">
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} />
          </div>
        ) : (
          <>
            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How Spending Limits Work</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Base allowance is used first (free)</li>
                    <li>When base allowance is exhausted, queries continue and charge against your limit</li>
                    <li>Queries are blocked when your spending limit is reached</li>
                    <li>You'll be billed for overage usage at the end of each billing period</li>
                    <li>Price: ${PRICE_PER_QUERY.toFixed(2)} per query</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Current Status */}
            {spending && spending.limit > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Current Period</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Current Spending</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ${spending.currentSpending.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Remaining</p>
                    <p className={`text-lg font-semibold ${
                      spending.remaining <= 0 ? 'text-red-600' : 
                      spending.remaining < spending.limit * 0.2 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      ${spending.remaining.toFixed(2)}
                    </p>
                  </div>
                </div>
                {spending.overageQueries > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-600 mb-1">Overage Queries Used</p>
                    <p className="text-sm font-medium text-gray-900">
                      {spending.overageQueries.toLocaleString()} queries (${spending.overageCost.toFixed(2)})
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Limit Input */}
            <div className="space-y-2">
              <label htmlFor="limit" className="block text-sm font-medium text-gray-700">
                Monthly Spending Limit (USD)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="limit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="0.00"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {limit && !isNaN(parseFloat(limit)) && parseFloat(limit) > 0 && (
                <p className="text-xs text-gray-600">
                  This allows approximately <strong>{estimatedQueries.toLocaleString()}</strong> overage queries per month
                </p>
              )}
              {limit === '0' || limit === '' ? (
                <p className="text-xs text-gray-600">
                  Setting limit to $0 disables overage billing. Queries will be blocked when base allowance is exhausted.
                </p>
              ) : null}
            </div>

            {/* Warning if decreasing limit below current spending */}
            {spending && limit && parseFloat(limit) > 0 && parseFloat(limit) < spending.currentSpending && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Warning</p>
                    <p>
                      Your current spending (${spending.currentSpending.toFixed(2)}) exceeds the new limit (${parseFloat(limit).toFixed(2)}). 
                      Queries will be blocked until the limit is increased or the billing period resets.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={onClose}
                className="flex-1"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                className="flex-1"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Limit'
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

