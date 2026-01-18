'use client';

import React, { useEffect } from 'react';
import HRDashboard from './HRDashboard';
import { useRouter } from 'next/navigation';

interface HRContentViewProps {
  view: string;
  businessId: string;
  userRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  stats: {
    totalEmployees: number;
    pendingTimeOff: number;
    activeToday: number;
    upcomingReviews: number;
  };
  onViewChange?: (view: string) => void;
}

export default function HRContentView({
  view,
  businessId,
  userRole,
  stats,
  onViewChange,
}: HRContentViewProps) {
  const router = useRouter();

  // Route to existing pages for other views (these have separate pages)
  // IMPORTANT: This hook must be called before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if (view === 'employees') {
      router.push(`/business/${businessId}/admin/hr/employees`);
    } else if (view === 'analytics') {
      router.push(`/business/${businessId}/admin/hr/analytics`);
    } else if (view === 'attendance') {
      router.push(`/business/${businessId}/admin/hr/attendance`);
    } else if (view === 'team') {
      router.push(`/business/${businessId}/workspace/hr/team`);
    } else if (view === 'my-profile' || view === 'my-time-off' || view === 'my-attendance') {
      router.push(`/business/${businessId}/workspace/hr/me`);
    } else if (view === 'onboarding-templates') {
      router.push(`/business/${businessId}/admin/hr/onboarding/templates`);
    } else if (view === 'onboarding-journeys') {
      router.push(`/business/${businessId}/admin/hr/onboarding/journeys`);
    }
  }, [view, businessId, router]);

  // Dashboard is the default view
  if (view === 'dashboard' || !view) {
    return (
      <HRDashboard
        businessId={businessId}
        userRole={userRole}
        stats={stats}
      />
    );
  }

        // For views that redirect, show loading state
        if (['employees', 'analytics', 'attendance', 'team', 'my-profile', 'my-time-off', 'my-attendance', 'onboarding-templates', 'onboarding-journeys'].includes(view)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // For views that don't have pages yet, show a placeholder
  return (
    <div className="p-6">
      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
        <p className="font-medium">Coming Soon</p>
        <p className="text-sm">This section is under development</p>
      </div>
    </div>
  );
}

