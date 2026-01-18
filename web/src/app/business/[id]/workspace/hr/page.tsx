'use client';

import HRLayout from '@/components/hr/HRLayout';
import { useParams } from 'next/navigation';

export default function HRWorkspacePage() {
  const params = useParams();
  const businessId = params?.id as string;

  if (!businessId) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">Business ID is required</p>
        </div>
      </div>
    );
  }

  return <HRLayout businessId={businessId} />;
}

