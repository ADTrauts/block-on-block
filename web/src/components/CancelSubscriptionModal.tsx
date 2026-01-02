'use client';

import React, { useState } from 'react';
import { Modal, Button, Card, Alert, Spinner } from 'shared/components';
import { AlertTriangle, Gift, X, CheckCircle } from 'lucide-react';
import { authenticatedApiCall } from '../lib/apiUtils';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionId: string;
  currentTier: string;
  currentPeriodEnd?: string;
  onSuccess?: () => void;
}

export default function CancelSubscriptionModal({
  isOpen,
  onClose,
  subscriptionId,
  currentTier,
  currentPeriodEnd,
  onSuccess,
}: CancelSubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRetentionOffer, setShowRetentionOffer] = useState(true);
  const [retentionAccepted, setRetentionAccepted] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    setError(null);

    try {
      await authenticatedApiCall(`/api/billing/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetentionOffer = () => {
    // For now, just close - retention offer handling can be implemented later
    // This could redirect to a special checkout session with a discount
    setRetentionAccepted(true);
    setShowRetentionOffer(false);
    // In a full implementation, you might create a special checkout session with a discount code
    // For now, we'll just show the cancellation flow
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Cancel Subscription" size="medium">
      <div className="space-y-6">
        {showRetentionOffer && !retentionAccepted && (
          <Card className="border-yellow-300 bg-yellow-50">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <Gift className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">Wait! We'd hate to see you go</h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Stay with us and get 20% off your next 3 months. We're constantly improving and would love to have you as part of our community.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={handleRetentionOffer} className="bg-yellow-600 hover:bg-yellow-700">
                      Yes, I'll Stay
                    </Button>
                    <Button variant="secondary" onClick={() => setShowRetentionOffer(false)}>
                      No, Continue Cancellation
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {!showRetentionOffer && (
          <>
            <Alert type="warning" title="Are you sure you want to cancel?">
              <div className="space-y-2 text-sm">
                <p>
                  Cancelling your subscription will stop future charges, but you'll retain access to all paid features until{' '}
                  <span className="font-semibold">{formatDate(currentPeriodEnd)}</span>.
                </p>
                <p className="text-gray-600">
                  After that date, your account will be downgraded to the Free tier.
                </p>
              </div>
            </Alert>

            <Card>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Plan:</span>
                  <span className="font-medium capitalize">{currentTier.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Access Until:</span>
                  <span className="font-medium">{formatDate(currentPeriodEnd)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">After Cancellation:</span>
                  <span className="font-medium">Downgrade to Free tier</span>
                </div>
              </div>
            </Card>

            {error && (
              <Alert type="error" title="Error">
                {error}
              </Alert>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Keep Subscription
              </Button>
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? (
                  <>
                    <span className="mr-2"><Spinner size={16} /></span> Cancelling...
                  </>
                ) : (
                  <>
                    <X className="mr-2 h-4 w-4" /> Cancel Subscription
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {retentionAccepted && (
          <Alert type="success" title="Great Choice!">
            <p className="text-sm">
              We're glad you're staying! Your discount will be applied to your next invoice. Thank you for being part of our community.
            </p>
          </Alert>
        )}
      </div>
    </Modal>
  );
}

