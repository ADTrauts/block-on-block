'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Card, Badge, Tabs } from 'shared/components';
import { 
  CreditCard, 
  Package, 
  Settings, 
  TrendingUp, 
  FileText, 
  Download,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useFeatureGating } from '../hooks/useFeatureGating';
import { authenticatedApiCall } from '../lib/apiUtils';
import AIQueryBalance from './AIQueryBalance';
import QueryPackPurchase from './QueryPackPurchase';
import PaymentMethodManager from './PaymentMethodManager';
import UsageAlerts from './UsageAlerts';
import UpgradeFlow from './UpgradeFlow';
import CancelSubscriptionModal from './CancelSubscriptionModal';
import PlanComparison, { Tier } from './PlanComparison';
import AISpendingLimitModal from './AISpendingLimitModal';

interface Subscription {
  id: string;
  tier: 'free' | 'pro' | 'business_basic' | 'business_advanced' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  employeeCount?: number;
  includedEmployees?: number;
  additionalEmployeeCost?: number;
}

interface ModuleSubscription {
  id: string;
  moduleId: string;
  module: {
    name: string;
    description: string;
    icon?: string;
  };
  tier: 'premium' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due';
  amount: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

interface UsageRecord {
  date: string;
  value: number;
  unit: string;
  description: string;
}

interface UsageData {
  coreUsage: UsageRecord[];
  moduleUsage: Array<{
    moduleId: string;
    moduleName: string;
    usage: UsageRecord[];
  }>;
  period: {
    start: string;
    end: string;
  };
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
}

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
}

export default function BillingModal({ isOpen, onClose, businessId }: BillingModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [moduleSubscriptions, setModuleSubscriptions] = useState<ModuleSubscription[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradeFlow, setShowUpgradeFlow] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSpendingLimitModal, setShowSpendingLimitModal] = useState(false);
  const { features, loading: featuresLoading } = useFeatureGating();

  useEffect(() => {
    if (isOpen) {
      loadBillingData();
    }
  }, [isOpen]);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      
      // Load subscription data
      try {
        const subscriptionData = await authenticatedApiCall('/api/billing/subscriptions/user');
        setSubscription((subscriptionData as any).subscription);
      } catch (error) {
        console.error('Failed to load subscription data:', error);
      }

      // Load module subscriptions
      try {
        const moduleSubsData = await authenticatedApiCall('/api/billing/modules/subscriptions');
        setModuleSubscriptions((moduleSubsData as any).subscriptions || []);
      } catch (error) {
        console.error('Failed to load module subscriptions:', error);
      }

      // Load usage data
      try {
        const usageData = await authenticatedApiCall('/api/billing/usage');
        setUsage(usageData as UsageData);
      } catch (error) {
        console.error('Failed to load usage data:', error);
      }

      // Load invoices
      try {
        const invoicesData = await authenticatedApiCall('/api/billing/invoices');
        setInvoices((invoicesData as any).invoices || []);
      } catch (error) {
        console.error('Failed to load invoices:', error);
      }
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-800';
      case 'pro': return 'bg-blue-100 text-blue-800';
      case 'business_basic': return 'bg-green-100 text-green-800';
      case 'business_advanced': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'past_due': return 'bg-yellow-100 text-yellow-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const tabs = [
    { label: 'Overview', key: 'overview' },
    { label: 'Modules', key: 'modules' },
    { label: 'Usage', key: 'usage' },
    { label: 'Invoices', key: 'invoices' },
  ];

  if (loading) {
    return (
      <Modal open={isOpen} onClose={onClose} title="Billing & Subscriptions" size="xlarge">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Billing & Subscriptions" size="xlarge">
      <div className="max-h-[80vh] overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="plans">Plans</Tabs.Trigger>
            <Tabs.Trigger value="payment-methods">Payment Methods</Tabs.Trigger>
            <Tabs.Trigger value="queries">Query Packs</Tabs.Trigger>
            <Tabs.Trigger value="modules">Modules</Tabs.Trigger>
            <Tabs.Trigger value="usage">Usage</Tabs.Trigger>
            <Tabs.Trigger value="invoices">Invoices</Tabs.Trigger>
          </Tabs.List>
          
          <Tabs.Content value="plans">
            <div className="space-y-4">
              <PlanComparison
                currentTier={subscription?.tier as Tier || 'free'}
                onSelectTier={(tier) => {
                  setShowUpgradeFlow(true);
                }}
                showActions={true}
                userType={businessId ? 'business' : 'personal'}
              />
            </div>
          </Tabs.Content>
          
          <Tabs.Content value="overview">
            <div className="space-y-4">
              {/* Current Subscription */}
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Current Plan</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Your current subscription and billing information
                  </p>
                  
                  {subscription ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold capitalize">{subscription.tier.replace('_', ' ')} Plan</h3>
                          <p className="text-sm text-gray-600">
                            {subscription.tier === 'free' ? 'Free tier with ads' : 
                             subscription.tier === 'pro' ? '$29.00/month' :
                             subscription.tier === 'business_basic' ? `$49.99/month + $5/employee (${subscription.includedEmployees || 10} included)` :
                             subscription.tier === 'business_advanced' ? `$69.99/month + $5/employee (${subscription.includedEmployees || 10} included)` :
                             subscription.tier === 'enterprise' ? `$129.99/month + $5/employee (${subscription.includedEmployees || 10} included)` : 'Custom pricing'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={getTierColor(subscription.tier)}>
                            {subscription.tier}
                          </Badge>
                          <Badge className={getStatusColor(subscription.status)}>
                            {subscription.status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Billing Period:</span>
                          <p>{formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Auto-renewal:</span>
                          <p>{subscription.cancelAtPeriodEnd ? 'Cancelled' : 'Active'}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => setShowUpgradeFlow(true)}
                        >
                          Change Plan
                        </Button>
                        {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => setShowCancelModal(true)}
                          >
                            Cancel
                          </Button>
                        )}
                        {subscription.status === 'cancelled' && subscription.cancelAtPeriodEnd && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              try {
                                await authenticatedApiCall(`/api/billing/subscriptions/${subscription.id}/reactivate`, {
                                  method: 'POST',
                                });
                                await loadBillingData();
                              } catch (error) {
                                console.error('Failed to reactivate subscription:', error);
                                alert('Failed to reactivate subscription. Please try again.');
                              }
                            }}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No active subscription found</p>
                      <Button 
                        className="mt-2"
                        onClick={async () => {
                          try {
                            // Create checkout session for Pro tier (default)
                            const response = await authenticatedApiCall<{ sessionId: string; url: string }>('/api/billing/checkout/session', {
                              method: 'POST',
                              body: JSON.stringify({
                                tier: 'pro',
                                billingCycle: 'monthly',
                                businessId: businessId || null,
                              }),
                            });
                            
                            if (response.url) {
                              // Redirect to Stripe Checkout
                              window.location.href = response.url;
                            }
                          } catch (error) {
                            console.error('Failed to create checkout session:', error);
                            alert('Failed to start checkout. Please try again.');
                          }
                        }}
                      >
                        Subscribe to Pro Plan
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Feature Access */}
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Feature Access</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Features available with your current plan
                  </p>
                  
                  <div className="space-y-4">
                    {Object.values(features || {}).map((feature: { name: string; requiredTier: string; description: string; category: string }) => (
                      <div key={feature.name} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-medium">{feature.name}</h4>
                          <p className="text-sm text-gray-600">{feature.description}</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800">
                          {feature.requiredTier} Tier
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Active Modules</span>
                    </div>
                    <p className="text-2xl font-bold">{moduleSubscriptions.filter(s => s.status === 'active').length}</p>
                  </div>
                </Card>
                
                <Card>
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">This Month</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatCurrency(moduleSubscriptions.reduce((sum, sub) => sum + sub.amount, 0))}
                    </p>
                  </div>
                </Card>
                
                <Card>
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">Total Invoices</span>
                    </div>
                    <p className="text-2xl font-bold">{invoices.length}</p>
                  </div>
                </Card>
              </div>

              {/* AI Query Balance */}
              <AIQueryBalance 
                businessId={businessId}
                onPurchaseClick={() => setActiveTab('queries')}
                onSpendingLimitClick={() => setShowSpendingLimitModal(true)}
              />
            </div>
          </Tabs.Content>

          <Tabs.Content value="payment-methods">
            <div className="space-y-4">
              <PaymentMethodManager onUpdate={loadBillingData} />
            </div>
          </Tabs.Content>

          <Tabs.Content value="queries">
            <div className="space-y-4">
              <AIQueryBalance 
                businessId={businessId}
                onPurchaseClick={() => {}}
                onSpendingLimitClick={() => setShowSpendingLimitModal(true)}
              />
              <QueryPackPurchase 
                businessId={businessId}
                onPurchaseComplete={() => {
                  // Reload balance if needed
                  setActiveTab('overview');
                }}
              />
            </div>
          </Tabs.Content>

          <Tabs.Content value="modules">
            <div className="space-y-4">
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Module Subscriptions</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage your module subscriptions and billing
                  </p>
                  
                  {moduleSubscriptions.length > 0 ? (
                    <div className="space-y-4">
                      {moduleSubscriptions.map((sub) => (
                        <div key={sub.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{sub.module.name}</h4>
                              <p className="text-sm text-gray-600">{sub.module.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getTierColor(sub.tier)}>
                                {sub.tier}
                              </Badge>
                              <Badge className={getStatusColor(sub.status)}>
                                {sub.status}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span>{formatCurrency(sub.amount)}/month</span>
                            <span>Renews {formatDate(sub.currentPeriodEnd)}</span>
                          </div>
                          
                          <div className="mt-2 flex gap-2">
                            <Button variant="secondary" size="sm">
                              Manage
                            </Button>
                            <Button variant="secondary" size="sm">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No module subscriptions</p>
                      <Button className="mt-2">Browse Modules</Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </Tabs.Content>

          <Tabs.Content value="usage">
            <div className="space-y-4">
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Usage Analytics</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Monitor your usage across all modules
                  </p>
                  
                  {usage ? (
                    <div className="space-y-6">
                      {/* Core Usage */}
                      <div>
                        <h4 className="font-semibold mb-2">Core Platform Usage</h4>
                        <div className="space-y-2">
                          {usage.coreUsage && usage.coreUsage.length > 0 ? (
                            usage.coreUsage.map((record: UsageRecord, index: number) => (
                              <div key={index} className="flex items-center justify-between p-2 border-b">
                                <span className="text-sm">{record.description}</span>
                                <span className="text-sm font-medium">{record.value} {record.unit}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-600">No usage data available</p>
                          )}
                        </div>
                      </div>

                      {/* Module Usage */}
                      <div>
                        <h4 className="font-semibold mb-2">Module Usage</h4>
                        <div className="space-y-4">
                          {usage.moduleUsage && usage.moduleUsage.length > 0 ? (
                            usage.moduleUsage.map((moduleUsage) => (
                              <div key={moduleUsage.moduleId} className="border rounded-lg p-3">
                                <h5 className="font-medium mb-2">{moduleUsage.moduleName}</h5>
                                <div className="space-y-1">
                                  {moduleUsage.usage.map((record: UsageRecord, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-2 border-b">
                                      <span className="text-sm">{record.description}</span>
                                      <span className="text-sm font-medium">{record.value} {record.unit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-600">No module usage data available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No usage data available</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </Tabs.Content>

          <Tabs.Content value="invoices">
            <div className="space-y-4">
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Invoice History</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    View and download your billing invoices
                  </p>
                  
                  {invoices.length > 0 ? (
                    <div className="space-y-4">
                      {invoices.map((invoice) => (
                        <div key={invoice.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">Invoice #{invoice.id.slice(0, 8)}</h4>
                              <p className="text-sm text-gray-600">
                                {formatDate(invoice.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{formatCurrency(invoice.amount)}</span>
                              <Badge className={getStatusColor(invoice.status)}>
                                {invoice.status}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="mt-2 flex gap-2">
                            <Button variant="secondary" size="sm">
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                            <Button variant="secondary" size="sm">
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No invoices found</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </Tabs.Content>
        </Tabs>
      </div>

      {/* Upgrade/Downgrade Flow Modal */}
      {subscription && (
        <UpgradeFlow
          isOpen={showUpgradeFlow}
          onClose={() => setShowUpgradeFlow(false)}
          currentTier={subscription.tier as Tier}
          subscriptionId={subscription.id}
          businessId={businessId}
          onSuccess={loadBillingData}
        />
      )}

      {/* AI Spending Limit Modal */}
      <AISpendingLimitModal
        isOpen={showSpendingLimitModal}
        onClose={() => setShowSpendingLimitModal(false)}
        businessId={businessId}
        onUpdate={loadBillingData}
      />

      {/* Cancel Subscription Modal */}
      {subscription && (
        <CancelSubscriptionModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          subscriptionId={subscription.id}
          currentTier={subscription.tier}
          currentPeriodEnd={subscription.currentPeriodEnd}
          onSuccess={loadBillingData}
        />
      )}
    </Modal>
  );
} 