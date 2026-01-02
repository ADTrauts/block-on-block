'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import { CreditCard, Plus, Trash2, Star, ExternalLink, AlertCircle } from 'lucide-react';
import { authenticatedApiCall } from '../lib/apiUtils';
import AddPaymentMethodModal from './AddPaymentMethodModal';

interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details?: {
    name?: string;
    email?: string;
  };
}

interface PaymentMethodManagerProps {
  onUpdate?: () => void;
}

export default function PaymentMethodManager({ onUpdate }: PaymentMethodManagerProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authenticatedApiCall<{ paymentMethods: PaymentMethod[] }>('/api/billing/payment-methods');
      setPaymentMethods(response.paymentMethods || []);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      // If Stripe is not configured, just show empty list (graceful degradation)
      if (err instanceof Error && err.message.includes('Stripe')) {
        setPaymentMethods([]);
        setError(null); // Don't show error if Stripe is just not configured
      } else {
        setError('Failed to load payment methods');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      setDeleting(paymentMethodId);
      setError(null);
      await authenticatedApiCall(`/api/billing/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
      });
      await loadPaymentMethods();
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to delete payment method:', err);
      setError('Failed to delete payment method');
    } finally {
      setDeleting(null);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setOpeningPortal(true);
      setError(null);
      const response = await authenticatedApiCall<{ url: string }>('/api/billing/customer-portal', {
        method: 'POST',
      });
      
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (err) {
      console.error('Failed to open customer portal:', err);
      setError('Failed to open customer portal. Please try again.');
      setOpeningPortal(false);
    }
  };

  const handleAddSuccess = async () => {
    await loadPaymentMethods();
    if (onUpdate) {
      onUpdate();
    }
  };

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  const formatExpiry = (month: number, year: number) => {
    return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Spinner size={48} />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage your payment methods for subscriptions and purchases
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
          <Button
            variant="secondary"
            onClick={handleOpenPortal}
            disabled={openingPortal}
          >
            {openingPortal ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Opening...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Stripe Portal
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      {paymentMethods.length === 0 ? (
        <Card className="p-6">
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No payment methods on file</p>
            <p className="text-sm text-gray-500 mb-4">
              Add a payment method to get started with subscriptions and purchases
            </p>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((pm) => (
            <Card key={pm.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-8 bg-gray-100 rounded border">
                    {pm.card && (
                      <CreditCard className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    {pm.card && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatCardBrand(pm.card.brand)} •••• {pm.card.last4}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Expires {formatExpiry(pm.card.exp_month, pm.card.exp_year)}
                        </div>
                      </>
                    )}
                    {pm.billing_details?.name && (
                      <div className="text-sm text-gray-500 mt-1">
                        {pm.billing_details.name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(pm.id)}
                    disabled={deleting === pm.id}
                  >
                    {deleting === pm.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-600" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Alert variant="info" title="Payment Method Management">
        <p className="text-sm">
          Add payment methods directly here, or use the Stripe Customer Portal for advanced management. 
          All payment information is securely processed by Stripe and never stored on our servers.
        </p>
      </Alert>

      <AddPaymentMethodModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}

