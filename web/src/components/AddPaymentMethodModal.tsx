'use client';

import React, { useState, useEffect } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Modal, Button, Alert, Spinner } from 'shared/components';
import { CreditCard, X } from 'lucide-react';
import { authenticatedApiCall } from '../lib/apiUtils';

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Initialize Stripe
// Note: Stripe.js requires HTTPS for production, but HTTP is fine for local development
const stripePromise = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function PaymentMethodForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create setup intent
      const response = await authenticatedApiCall<{ clientSecret: string; setupIntentId: string }>(
        '/api/billing/payment-methods/setup-intent',
        {
          method: 'POST',
        }
      );

      // Confirm setup intent with card element
      const { error: confirmError } = await stripe.confirmCardSetup(response.clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (confirmError) {
        setError(confirmError.message || 'Failed to add payment method');
        setLoading(false);
        return;
      }

      // Success!
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to add payment method:', err);
      setError(err instanceof Error ? err.message : 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert type="error" title="Error">
          {error}
        </Alert>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Card Details
        </label>
        <div className="p-3 border border-gray-300 rounded-md bg-white">
          <CardElement options={cardElementOptions} />
        </div>
        <p className="text-xs text-gray-500">
          Your card information is securely processed by Stripe and never stored on our servers.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={!stripe || loading}
        >
          {loading ? (
            <>
              <span className="mr-2"><Spinner size={16} /></span>
              Adding...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Add Payment Method
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default function AddPaymentMethodModal({
  isOpen,
  onClose,
  onSuccess,
}: AddPaymentMethodModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !clientSecret) {
      // Pre-create setup intent when modal opens
      const createSetupIntent = async () => {
        try {
          setLoading(true);
          setError(null);
          const response = await authenticatedApiCall<{ clientSecret: string; setupIntentId: string }>(
            '/api/billing/payment-methods/setup-intent',
            {
              method: 'POST',
            }
          );
          setClientSecret(response.clientSecret);
        } catch (err) {
          console.error('Failed to create setup intent:', err);
          setError(err instanceof Error ? err.message : 'Failed to initialize payment form');
        } finally {
          setLoading(false);
        }
      };

      createSetupIntent();
    }
  }, [isOpen, clientSecret]);

  const handleClose = () => {
    setClientSecret(null);
    setError(null);
    onClose();
  };

  const handleSuccess = () => {
    setClientSecret(null);
    setError(null);
    onSuccess();
  };

  const options: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Add Payment Method"
      size="medium"
    >
      <div className="p-6">
        {loading && !clientSecret ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={48} />
          </div>
        ) : error ? (
          <Alert type="error" title="Error">
            {error}
          </Alert>
        ) : clientSecret && stripePromise ? (
          <Elements stripe={stripePromise} options={options}>
            <PaymentMethodForm onSuccess={handleSuccess} onClose={handleClose} />
          </Elements>
        ) : !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? (
          <Alert type="error" title="Configuration Error">
            Stripe publishable key is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}

