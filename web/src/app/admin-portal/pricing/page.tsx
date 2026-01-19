'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner, Alert, Tabs, Input, Modal } from 'shared/components';
import { DollarSign, Edit, History, TrendingUp, Mail, RefreshCw, Save, X } from 'lucide-react';
import { adminApiService } from '../../../lib/adminApiService';

interface PricingConfig {
  id: string;
  tier: string;
  billingCycle: 'monthly' | 'yearly';
  basePrice: number;
  perEmployeePrice?: number | null;
  includedEmployees?: number | null;
  queryPackSmall?: number | null;
  queryPackMedium?: number | null;
  queryPackLarge?: number | null;
  queryPackEnterprise?: number | null;
  baseAIAllowance?: number | null;
  stripePriceId?: string | null;
  isActive: boolean;
  effectiveDate: string;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PricingManagementPage() {
  const [pricing, setPricing] = useState<PricingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingPrice, setEditingPrice] = useState<PricingConfig | null>(null);
  const [editForm, setEditForm] = useState<Partial<PricingConfig>>({});
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [impact, setImpact] = useState<any>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [updateExistingSubscriptions, setUpdateExistingSubscriptions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadPricing();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadPriceHistory();
    }
  }, [activeTab]);

  const loadPricing = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/pricing');
      if (!response.ok) {
        throw new Error('Failed to load pricing');
      }
      const data = await response.json();
      setPricing(data.pricing || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing');
    } finally {
      setLoading(false);
    }
  };

  const loadPriceHistory = async () => {
    try {
      setError(null);
      const response = await fetch('/api/pricing/history/all');
      if (!response.ok) {
        throw new Error('Failed to load price history');
      }
      const data = await response.json();
      setPriceHistory(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load price history');
    }
  };

  const calculateImpact = async () => {
    if (!editingPrice || !editForm.basePrice) return;

    try {
      setLoadingImpact(true);
      setError(null);
      const response = await fetch('/api/pricing/calculate-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: editingPrice.tier,
          newBasePrice: editForm.basePrice,
          billingCycle: editingPrice.billingCycle,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate impact');
      }

      const data = await response.json();
      setImpact(data.impact);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate impact');
    } finally {
      setLoadingImpact(false);
    }
  };

  const handleEdit = (price: PricingConfig) => {
    setEditingPrice(price);
    setEditForm({
      basePrice: price.basePrice,
      perEmployeePrice: price.perEmployeePrice || undefined,
      includedEmployees: price.includedEmployees || undefined,
      queryPackSmall: price.queryPackSmall || undefined,
      queryPackMedium: price.queryPackMedium || undefined,
      queryPackLarge: price.queryPackLarge || undefined,
      queryPackEnterprise: price.queryPackEnterprise || undefined,
      baseAIAllowance: price.baseAIAllowance || undefined,
      stripePriceId: price.stripePriceId || undefined,
    });
  };

  const handleSave = async () => {
    if (!editingPrice) return;

    try {
      setLoading(true);
      const response = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: editingPrice.tier,
          billingCycle: editingPrice.billingCycle,
          basePrice: editForm.basePrice,
          perEmployeePrice: editForm.perEmployeePrice,
          includedEmployees: editForm.includedEmployees,
          queryPackSmall: editForm.queryPackSmall,
          queryPackMedium: editForm.queryPackMedium,
          queryPackLarge: editForm.queryPackLarge,
          queryPackEnterprise: editForm.queryPackEnterprise,
          baseAIAllowance: editForm.baseAIAllowance,
          stripePriceId: editForm.stripePriceId,
          sendNotifications,
          updateExistingSubscriptions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update pricing');
      }

      await loadPricing();
      setEditingPrice(null);
      setEditForm({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatTierName = (tier: string) => {
    return tier
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Group pricing by tier
  const pricingByTier = pricing.reduce((acc, price) => {
    if (!acc[price.tier]) {
      acc[price.tier] = { monthly: null, yearly: null };
    }
    if (price.billingCycle === 'monthly') {
      acc[price.tier].monthly = price;
    } else {
      acc[price.tier].yearly = price;
    }
    return acc;
  }, {} as Record<string, { monthly: PricingConfig | null; yearly: PricingConfig | null }>);

  if (loading && pricing.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
          <p className="text-gray-600 mt-1">Manage subscription tier pricing and query pack prices</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={loadPricing}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert type="error" title="Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="history">Price History</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview">
          <Card className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Tier</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Monthly</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Yearly</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Per Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Included</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(pricingByTier).map(([tier, prices]) => (
                    <tr key={tier} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{formatTierName(tier)}</td>
                      <td className="py-3 px-4 text-gray-700">
                        {prices.monthly ? formatCurrency(prices.monthly.basePrice) : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {prices.yearly ? formatCurrency(prices.yearly.basePrice) : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {prices.monthly?.perEmployeePrice
                          ? formatCurrency(prices.monthly.perEmployeePrice)
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {prices.monthly?.includedEmployees || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {prices.monthly?.isActive ? (
                          <Badge color="green">Active</Badge>
                        ) : (
                          <Badge color="gray">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {prices.monthly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => prices.monthly && handleEdit(prices.monthly)}
                              title="Edit Monthly Pricing"
                              className="flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" />
                              <span className="text-xs">Monthly</span>
                            </Button>
                          )}
                          {prices.yearly && (
                        <Button
                          variant="ghost"
                          size="sm"
                              onClick={() => prices.yearly && handleEdit(prices.yearly)}
                              title="Edit Yearly Pricing"
                              className="flex items-center gap-1"
                        >
                              <Edit className="w-3 h-3" />
                              <span className="text-xs">Yearly</span>
                        </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="history">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Price Change History</h2>
              <Button variant="secondary" size="sm" onClick={loadPriceHistory}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
            {priceHistory.length === 0 ? (
              <p className="text-gray-600">No price changes recorded yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Tier</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Change Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Old Value</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">New Value</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Changed By</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Notification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.map((change: any) => (
                      <tr key={change.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-700">
                          {new Date(change.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {formatTierName(change.pricingConfig?.tier || '')} ({change.pricingConfig?.billingCycle || ''})
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {change.changeType.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {change.changeType.includes('price') ? formatCurrency(change.oldValue) : change.oldValue}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {change.changeType.includes('price') ? formatCurrency(change.newValue) : change.newValue}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {change.createdByUser?.name || change.createdByUser?.email || 'Unknown'}
                        </td>
                        <td className="py-3 px-4">
                          {change.notificationSent ? (
                            <Badge color="green">Sent</Badge>
                          ) : (
                            <Badge color="gray">Not Sent</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </Tabs.Content>
      </Tabs>

      {/* Edit Modal */}
      {editingPrice && (
        <Modal
          open={!!editingPrice}
          onClose={() => {
            setEditingPrice(null);
            setEditForm({});
          }}
          title={`Edit ${formatTierName(editingPrice.tier)} ${editingPrice.billingCycle} Pricing`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Price ($)
              </label>
              <Input
                type="number"
                step="0.01"
                value={editForm.basePrice || ''}
                onChange={(e) => {
                  const newPrice = parseFloat(e.target.value);
                  setEditForm({ ...editForm, basePrice: newPrice });
                  setImpact(null);
                  setShowPreview(false);
                }}
              />
              {editingPrice && editForm.basePrice !== editingPrice.basePrice && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={calculateImpact}
                  disabled={loadingImpact}
                  className="mt-2"
                >
                  {loadingImpact ? (
                    <>
                      <span className="mr-2 inline-block">
                        <Spinner size={16} />
                      </span>
                      Calculating...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Preview Impact
                    </>
                  )}
                </Button>
              )}
            </div>

            {showPreview && impact && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Impact Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Affected Subscriptions:</span>
                    <span className="font-medium text-gray-900">{impact.affectedSubscriptions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Current Monthly Revenue:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(impact.currentRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">New Monthly Revenue:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(impact.newRevenue)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-700">Revenue Change:</span>
                    <span className={`font-medium ${impact.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {impact.revenueChange >= 0 ? '+' : ''}{formatCurrency(impact.revenueChange)} ({impact.revenueChangePercent >= 0 ? '+' : ''}{impact.revenueChangePercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Per Employee Price ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.perEmployeePrice || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        perEmployeePrice: parseFloat(e.target.value) || undefined,
                      })
                    }
                placeholder="0.00"
                  />
              <p className="text-xs text-gray-500 mt-1">Leave empty if not applicable</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Included Employees
                  </label>
                  <Input
                    type="number"
                    value={editForm.includedEmployees || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        includedEmployees: parseInt(e.target.value) || undefined,
                      })
                    }
                placeholder="0"
                  />
              <p className="text-xs text-gray-500 mt-1">Number of employees included in base price</p>
                </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stripe Price ID (optional)
              </label>
              <Input
                type="text"
                value={editForm.stripePriceId || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, stripePriceId: e.target.value || undefined })
                }
                placeholder="price_..."
              />
            </div>

            {editingPrice && editForm.basePrice !== editingPrice.basePrice && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendNotifications"
                  checked={sendNotifications}
                  onChange={(e) => setSendNotifications(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="sendNotifications" className="text-sm text-gray-700">
                  Send email notifications to affected subscribers
                </label>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="updateExistingSubscriptions"
                    checked={updateExistingSubscriptions}
                    onChange={(e) => setUpdateExistingSubscriptions(e.target.checked)}
                    className="w-4 h-4 mt-0.5"
                  />
                  <div>
                    <label htmlFor="updateExistingSubscriptions" className="text-sm font-medium text-gray-700 block">
                      Update existing subscriptions to new price
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      All active subscriptions for this tier will be updated to the new price. 
                      The new price will take effect on their next billing cycle (no proration).
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      ⚠️ If unchecked, existing customers will keep their current price (grandfathered pricing).
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingPrice(null);
                  setEditForm({});
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

