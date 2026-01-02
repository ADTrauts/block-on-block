'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button } from 'shared/components';
import { XCircle, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BillingCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="p-8 max-w-md w-full">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
          <p className="text-gray-600 mb-6">
            Your payment was cancelled. No charges were made to your account. You can try again anytime.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
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

