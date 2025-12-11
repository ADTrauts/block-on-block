'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ManagerTeamSchedulingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = params?.id as string;
  
  // Get active tab from URL and map to view
  const activeTab = searchParams?.get('tab') || 'schedules';
  
  // Map tab to view parameter for SchedulingLayout and redirect
  useEffect(() => {
    if (businessId) {
      const viewMap: Record<string, string> = {
        schedules: 'team',
        swaps: 'swaps',
      };
      const view = viewMap[activeTab] || 'team';
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
