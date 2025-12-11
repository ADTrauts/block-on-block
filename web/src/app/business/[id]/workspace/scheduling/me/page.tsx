'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function EmployeeSchedulingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = params?.id as string;
  
  // Get active tab from URL and map to view
  const activeTab = searchParams?.get('tab') || 'schedule';
  
  // Map tab to view parameter for SchedulingLayout and redirect
  useEffect(() => {
    if (businessId) {
      const viewMap: Record<string, string> = {
        schedule: 'my-schedule',
        availability: 'availability',
        swaps: 'shift-swaps',
        'open-shifts': 'open-shifts',
      };
      const view = viewMap[activeTab] || 'my-schedule';
      router.replace(`/business/${businessId}/workspace/scheduling?view=${view}`);
    }
  }, [businessId, activeTab, router]);

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to scheduling module...</p>
      </div>
    </div>
  );
}
