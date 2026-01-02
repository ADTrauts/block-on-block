'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, Button, Spinner, Alert } from 'shared/components';
import { CheckCircle, AlertCircle, Home } from 'lucide-react';
import Link from 'next/link';

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionId = searchParams?.get('session_id');

  useEffect(() => {
    // If we have a session ID, we can verify the subscription was created
    // For now, we'll just show success - in production you might want to verify
    if (sessionId) {
      setLoading(false);
    } else {
      setLoading(false);
      setError('No session ID provided');
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center">
            <Spinner size={48} />
            <p className="mt-4 text-gray-600">Verifying your subscription...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex gap-4 justify-center">
              <Button variant="primary" onClick={() => router.push('/')}>
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="p-8 max-w-md w-full">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Your subscription has been activated successfully. You now have access to all premium features.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/">
              <Button variant="primary">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

