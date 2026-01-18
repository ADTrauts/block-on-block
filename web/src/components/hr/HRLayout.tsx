'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import HRSidebar from './HRSidebar';
import HRContentView from './HRContentView';
import { businessAPI } from '@/api/business';
import { Spinner, Alert } from 'shared/components';

interface HRLayoutProps {
  businessId: string;
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

interface HRStats {
  totalEmployees: number;
  pendingTimeOff: number;
  activeToday: number;
  upcomingReviews: number;
}

export default function HRLayout({ businessId }: HRLayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const [business, setBusiness] = useState<Business | null>(null);
  const [userRole, setUserRole] = useState<'ADMIN' | 'MANAGER' | 'EMPLOYEE' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<HRStats>({
    totalEmployees: 0,
    pendingTimeOff: 0,
    activeToday: 0,
    upcomingReviews: 0,
  });
  const [currentView, setCurrentView] = useState<string>('dashboard');

  // Get current view from URL (using window.location to avoid Next.js context issues)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const view = urlParams.get('view') || 'dashboard';
      setCurrentView(view);
    }
  }, []);

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
          
          // Set basic stats (these will be replaced with real API calls later)
          setStats({
            totalEmployees: businessData.members.length,
            pendingTimeOff: 0, // TODO: Fetch from API
            activeToday: businessData.members.length, // TODO: Fetch from API
            upcomingReviews: 0 // TODO: Fetch from API
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
    router.push(`/business/${businessId}/workspace/hr?view=${view}`);
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

  // Calculate stats for sidebar badges
  const sidebarStats = {
    pendingTimeOff: stats.pendingTimeOff,
    pendingApprovals: stats.pendingTimeOff, // Same for now
    openExceptions: 0, // TODO: Fetch from API
  };

  return (
    <div className="flex h-full">
      {/* HR Sidebar */}
      <HRSidebar
        businessId={businessId}
        currentView={currentView}
        onViewChange={handleViewChange}
        userRole={userRole}
        stats={sidebarStats}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <HRContentView
          view={currentView}
          businessId={businessId}
          userRole={userRole}
          stats={stats}
          onViewChange={handleViewChange}
        />
      </div>
    </div>
  );
}

