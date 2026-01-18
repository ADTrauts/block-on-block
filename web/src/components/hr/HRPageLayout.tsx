'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import HRSidebar from './HRSidebar';
import { businessAPI } from '@/api/business';
import { Spinner, Alert } from 'shared/components';

interface HRPageLayoutProps {
  businessId: string;
  children: React.ReactNode;
  currentView?: string; // Optional override for current view
}

interface Business {
  id: string;
  name: string;
  members: Array<{
    id: string;
    role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export default function HRPageLayout({ 
  businessId, 
  children,
  currentView: overrideView 
}: HRPageLayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const [business, setBusiness] = useState<Business | null>(null);
  const [userRole, setUserRole] = useState<'ADMIN' | 'MANAGER' | 'EMPLOYEE' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    pendingTimeOff: 0,
    pendingApprovals: 0,
    openExceptions: 0,
  });

  // Determine current view from pathname (using window.location to avoid Next.js context issues)
  const getCurrentView = (): string => {
    if (overrideView) return overrideView;
    
    // Use window.location.pathname directly (client-side only)
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath.includes('/admin/hr/employees')) return 'employees';
      if (currentPath.includes('/admin/hr/analytics')) return 'analytics';
      if (currentPath.includes('/admin/hr/attendance')) return 'attendance';
      if (currentPath.includes('/admin/hr/onboarding/templates')) return 'onboarding-templates';
      if (currentPath.includes('/admin/hr/onboarding/journeys')) return 'onboarding-journeys';
      if (currentPath.includes('/workspace/hr/team')) return 'team';
      if (currentPath.includes('/workspace/hr/me')) return 'my-profile';
      if (currentPath.includes('/workspace/hr')) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('view') || 'dashboard';
      }
    }
    return 'dashboard';
  };

  const currentView = getCurrentView();

  useEffect(() => {
    if (businessId && session?.user?.id) {
      loadBusinessData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, session?.user?.id]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      setError(null);

      const businessResponse = await businessAPI.getBusiness(businessId);
      if (businessResponse.success) {
        const businessData = businessResponse.data as unknown as Business;
        setBusiness(businessData);

        const userMembership = businessData.members.find(
          m => m.user.id === session?.user?.id
        );
        
        if (userMembership) {
          setUserRole(userMembership.role);
          
          // TODO: Fetch real stats from API
          setStats({
            pendingTimeOff: 0,
            pendingApprovals: 0,
            openExceptions: 0,
          });
        } else {
          setError('You are not a member of this business');
        }
      } else {
        setError('Failed to load business data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load HR data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (view: string) => {
    // Map view IDs to routes
    const viewRoutes: Record<string, string> = {
      'dashboard': `/business/${businessId}/workspace/hr`,
      'employees': `/business/${businessId}/admin/hr/employees`,
      'attendance': `/business/${businessId}/admin/hr/attendance`,
      'team': `/business/${businessId}/workspace/hr/team`,
      'my-profile': `/business/${businessId}/workspace/hr/me`,
      'my-time-off': `/business/${businessId}/workspace/hr/me?tab=time-off`,
      'my-attendance': `/business/${businessId}/workspace/hr/me?tab=attendance`,
      'time-off': `/business/${businessId}/workspace/hr/team?tab=time-off`,
      'approvals': `/business/${businessId}/workspace/hr/team?tab=approvals`,
    };

    const route = viewRoutes[view];
    if (route) {
      router.push(route);
    } else {
      // For views without specific routes, use query param
      router.push(`/business/${businessId}/workspace/hr?view=${view}`);
    }
  };

  if (loading || !userRole) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="p-6">
        <Alert type="error" title="Error Loading HR">
          {error || 'HR module not accessible'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* HR Sidebar */}
      <HRSidebar
        businessId={businessId}
        currentView={currentView}
        onViewChange={handleViewChange}
        userRole={userRole}
        stats={stats}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </div>
    </div>
  );
}

