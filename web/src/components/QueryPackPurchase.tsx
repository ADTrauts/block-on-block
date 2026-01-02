'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner } from 'shared/components';
import { Zap, ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react';
import { authenticatedApiCall } from '../lib/apiUtils';

interface QueryPack {
  id: string;
  name: string;
  queries: number;
  price: number;
  description: string;
}

interface QueryPackPurchaseProps {
  businessId?: string;
  onPurchaseComplete?: () => void;
}

export default function QueryPackPurchase({ businessId, onPurchaseComplete }: QueryPackPurchaseProps) {
  const [packs, setPacks] = useState<QueryPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    try {
      setLoading(true);
      const response = await authenticatedApiCall<{ success: boolean; data: QueryPack[] }>(
        '/api/ai/queries/packs'
      );

      if (response.success) {
        setPacks(response.data);
      }
    } catch (err) {
      console.error('Failed to load query packs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load packs');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packId: string) => {
    try {
      setPurchasing(packId);
      setError(null);

      const response = await authenticatedApiCall<{
        success: boolean;
        data: {
          paymentIntentId: string;
          clientSecret: string;
          queries: number;
          price: number;
        };
      }>('/api/ai/queries/purchase', {
        method: 'POST',
        body: JSON.stringify({
          packType: packId,
          businessId: businessId || null,
        }),
      });

      if (response.success && response.data.clientSecret) {
        // Use Stripe.js to confirm payment
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
        );

        if (!stripe) {
          throw new Error('Stripe failed to load');
        }

        const { error: confirmError } = await stripe.confirmCardPayment(response.data.clientSecret);

        if (confirmError) {
          throw new Error(confirmError.message || 'Payment failed');
        }

        // Payment succeeded - webhook will handle adding queries
        alert(`Purchase successful! ${response.data.queries} queries will be added to your account shortly.`);
        
        if (onPurchaseComplete) {
          onPurchaseComplete();
        }
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(null);
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

  if (error && !packs.length) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  // Calculate price per query for comparison
  const getPricePerQuery = (pack: QueryPack) => {
    return (pack.price / pack.queries).toFixed(4);
  };

  // Find best value (lowest price per query)
  const bestValuePack = packs.reduce((best, pack) => {
    const currentPricePerQuery = pack.price / pack.queries;
    const bestPricePerQuery = best.price / best.queries;
    return currentPricePerQuery < bestPricePerQuery ? pack : best;
  }, packs[0]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Purchase Query Packs</h3>
        <p className="text-sm text-gray-600">
          Buy additional AI queries that never expire. Perfect for heavy AI usage.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {packs.map((pack) => {
          const isBestValue = pack.id === bestValuePack?.id;
          const isPurchasing = purchasing === pack.id;
          const pricePerQuery = getPricePerQuery(pack);

          return (
            <Card key={pack.id} className={`p-6 ${isBestValue ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="space-y-4">
                {/* Header */}
                <div>
                  {isBestValue && (
                    <Badge color="blue" className="mb-2">Best Value</Badge>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-gray-900">{pack.name}</h4>
                  </div>
                  <p className="text-xs text-gray-600">{pack.description}</p>
                </div>

                {/* Pricing */}
                <div>
                  <p className="text-2xl font-bold text-gray-900">${pack.price.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">
                    ${pricePerQuery} per query
                  </p>
                </div>

                {/* Queries */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Queries</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {pack.queries.toLocaleString()}
                  </p>
                </div>

                {/* Purchase Button */}
                <Button
                  variant="primary"
                  onClick={() => handlePurchase(pack.id)}
                  disabled={isPurchasing}
                  className="w-full"
                >
                  {isPurchasing ? (
                    <>
                      <Spinner size={16} className="mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Purchase
                    </>
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Note:</strong> Purchased queries never expire and are added to your account balance. 
          They are used after your monthly base allowance and rolled-over queries.
        </p>
      </div>
    </div>
  );
}

