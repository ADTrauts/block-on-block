'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SchedulingSidebar from './SchedulingSidebar';
import SchedulingContentView from './SchedulingContentView';
import ScheduleBuilderSidebar from './ScheduleBuilderSidebar';
import { businessAPI } from '@/api/business';
import { useScheduling } from '@/hooks/useScheduling';

interface SchedulingLayoutProps {
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

export default function SchedulingLayout({ businessId }: SchedulingLayoutProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [business, setBusiness] = useState<Business | null>(null);
  const [userRole, setUserRole] = useState<'ADMIN' | 'MANAGER' | 'EMPLOYEE' | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);

  // Get current view from URL, default to 'dashboard'
  const currentView = searchParams?.get('view') || 'dashboard';

  // Get scheduling data for stats
  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';
  const scope = isAdmin ? 'admin' : isManager ? 'manager' : 'employee';
  const { swapRequests, shifts } = useScheduling({ 
    businessId, 
    scope, 
    autoFetch: !!userRole && userRole !== 'EMPLOYEE' // Only auto-fetch for admin/manager
  });

  // Calculate stats for sidebar badges
  const pendingSwaps = swapRequests.filter(sr => sr.status === 'PENDING').length;
  const openShifts = shifts.filter(s => s.status === 'OPEN').length;

  useEffect(() => {
    if (businessId && session?.user?.id) {
      loadBusinessData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, session?.user?.id]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      const businessResponse = await businessAPI.getBusiness(businessId);
      if (businessResponse.success) {
        const businessData = businessResponse.data as unknown as Business;
        setBusiness(businessData);

        const userMembership = businessData.members.find(
          m => m.user.id === session?.user?.id
        );
        
        if (userMembership) {
          setUserRole(userMembership.role);
        } else {
          setUserRole('EMPLOYEE'); // Default fallback
        }
      }
    } catch (err) {
      console.error('Failed to load business data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (view: string) => {
    router.push(`/business/${businessId}/workspace/scheduling?view=${view}`);
  };

  const handleCreateSchedule = () => {
    router.push(`/business/${businessId}/workspace/scheduling?view=builder`);
  };

  const handleRequestSwap = () => {
    router.push(`/business/${businessId}/workspace/scheduling?view=shift-swaps`);
  };

  const handleSetAvailability = () => {
    router.push(`/business/${businessId}/workspace/scheduling?view=availability`);
  };

  if (loading || !userRole) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600">Loading scheduling module...</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">Failed to load business data</p>
        </div>
      </div>
    );
  }

  // Check if we're in builder mode or editing a template (hide main sidebar in these cases)
  const isBuilderMode = currentView === 'builder';

  return (
    <div className="flex h-full">
      {/* Scheduling Sidebar - Hide when in builder mode or editing template (builder sidebar will be shown by content) */}
      {!isBuilderMode && !isEditingTemplate && (
        <SchedulingSidebar
          businessId={businessId}
          currentView={currentView}
          onViewChange={handleViewChange}
          userRole={userRole}
          stats={{
            pendingSwaps,
            openShifts,
          }}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden bg-gray-50">
        <SchedulingContentView
          view={currentView}
          businessId={businessId}
          userRole={userRole}
          onCreateSchedule={handleCreateSchedule}
          onRequestSwap={handleRequestSwap}
          onSetAvailability={handleSetAvailability}
          onViewChange={handleViewChange}
          onEditingTemplateChange={setIsEditingTemplate}
        />
      </div>
    </div>
  );
}

