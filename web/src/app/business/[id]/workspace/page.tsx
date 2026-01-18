'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { businessAPI } from '../../../../api/business';
import { Spinner, Alert } from 'shared/components';
import BusinessWorkspaceContent from '../../../../components/business/BusinessWorkspaceContent';
import { useDashboard } from '../../../../contexts/DashboardContext';

interface Business {
  id: string;
  name: string;
  ein: string;
  einVerified: boolean;
  industry?: string;
  size?: string;
  website?: string;
  address?: any;
  phone?: string;
  email?: string;
  description?: string;
  logo?: string;
  branding?: any;
  members: Array<{
    id: string;
    role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    title?: string;
    department?: string;
    canInvite: boolean;
    canManage: boolean;
    canBilling: boolean;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}



export default function BusinessWorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { navigateToDashboard } = useDashboard();
  const businessId = params?.id as string;
  
  // Get current module from URL params
  const currentModule = searchParams?.get('module') || 'dashboard';

  const [business, setBusiness] = useState<Business | null>(null);
  const [businessDashboardId, setBusinessDashboardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (businessId && session?.accessToken) {
      console.log('🚀 BusinessWorkspacePage: Starting load with:', {
        businessId,
        hasToken: !!session?.accessToken,
        tokenLength: session?.accessToken?.length
      });
      loadBusinessData();
    } else {
      console.log('⏸️ BusinessWorkspacePage: Waiting for:', {
        hasBusinessId: !!businessId,
        hasToken: !!session?.accessToken,
        sessionStatus: session ? 'exists' : 'null'
      });
    }
  }, [businessId, session?.accessToken]);

  const loadBusinessData = async () => {
    try {
      console.log('📥 BusinessWorkspacePage: Loading business data for:', businessId);
      setLoading(true);
      setError(null);

      const businessResponse = await businessAPI.getBusiness(businessId);
      console.log('📦 BusinessWorkspacePage: Business response:', {
        success: businessResponse.success,
        hasData: !!businessResponse.data
      });

      if (businessResponse.success) {
        const businessData = businessResponse.data as unknown as Business;
        setBusiness(businessData);
        console.log('✅ BusinessWorkspacePage: Business loaded:', businessData.name);
        
        // Auto-create or get business dashboard
        // IMPORTANT: Must complete BEFORE rendering modules!
        // ensureBusinessDashboard will set loading to false on success or error
        await ensureBusinessDashboard(businessData);
      } else {
        console.error('❌ BusinessWorkspacePage: Business response failed:', businessResponse);
        setError('Failed to load business data');
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ BusinessWorkspacePage: Error loading business data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load business data');
      setLoading(false);
    }
  };
  
  // Ensure business has a dashboard for context isolation
  const ensureBusinessDashboard = async (businessData: Business) => {
    if (!session?.accessToken) {
      throw new Error('No session token available');
    }
    
    try {
      console.log('🔄 Fetching dashboards for user...');
      
      // Check if business dashboard already exists
      const dashboardsResponse = await fetch('/api/dashboard', {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });
      
      if (!dashboardsResponse.ok) {
        const errorText = await dashboardsResponse.text();
        console.error('❌ Dashboard API error:', {
          status: dashboardsResponse.status,
          statusText: dashboardsResponse.statusText,
          errorText
        });
        throw new Error(`Failed to load dashboards: ${dashboardsResponse.status} - ${errorText}`);
      }
      
      const dashboardsData = await dashboardsResponse.json();
      console.log('📊 BusinessWorkspace: Dashboards data:', dashboardsData);
      
      // Validate response structure
      if (!dashboardsData || typeof dashboardsData !== 'object') {
        throw new Error('Invalid dashboard response format');
      }
      
      // Extract all dashboards from the nested structure
      const allDashboards = dashboardsData.dashboards ? [
        ...(dashboardsData.dashboards.personal || []),
        ...(dashboardsData.dashboards.business || []),
        ...(dashboardsData.dashboards.educational || []),
        ...(dashboardsData.dashboards.household || [])
      ] : [];
      
      console.log('📊 BusinessWorkspace: Total dashboards:', allDashboards.length);
      console.log('🔍 BusinessWorkspace: Looking for business dashboard with businessId:', businessId);
      console.log('📋 BusinessWorkspace: Business dashboards:', allDashboards.filter((d: any) => d.businessId).map((d: any) => ({ id: d.id, businessId: d.businessId, name: d.name })));
      
      // Find existing business dashboard
      let businessDashboard = allDashboards.find((d: any) => d.businessId === businessId);
      
      if (businessDashboard) {
        console.log('✅ Found existing business dashboard:', {
          id: businessDashboard.id,
          name: businessDashboard.name,
          businessId: businessDashboard.businessId
        });
      } else {
        console.log('🆕 Creating new business dashboard for business:', businessId);
        
        // If doesn't exist, create it
        const createResponse = await fetch('/api/dashboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({
            name: `${businessData.name} Workspace`,
            businessId: businessId,
            layout: {},
            preferences: {},
          }),
        });
        
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Failed to create business dashboard: ${createResponse.status} - ${errorText}`);
        }
        
        const createResponseData = await createResponse.json();
        console.log('📦 Create dashboard response:', createResponseData);
        
        // Handle both response formats: { dashboard: {...} } or just {...}
        businessDashboard = createResponseData?.dashboard || createResponseData;
        
        if (!businessDashboard) {
          throw new Error('Create dashboard response is empty');
        }
        
        console.log('✅ Created new business dashboard:', {
          id: businessDashboard.id,
          name: businessDashboard.name,
          businessId: businessDashboard.businessId
        });
      }
      
      // Set as current dashboard context
      if (!businessDashboard?.id) {
        console.error('❌ Business dashboard missing id:', businessDashboard);
        throw new Error('Business dashboard response missing id');
      }
      
      console.log('🎯 Setting businessDashboardId to:', businessDashboard.id);
      setBusinessDashboardId(businessDashboard.id);
      console.log('🔍 Business Dashboard Ready:', {
        dashboardId: businessDashboard.id,
        businessId: businessId,
        dashboardName: businessDashboard.name,
        timestamp: new Date().toISOString()
      });
      
      // Success - ensure loading is set to false
      setLoading(false);
      console.log('✅ BusinessWorkspacePage: Dashboard initialization complete, loading set to false');
      
    } catch (err) {
      console.error('❌ Failed to ensure business dashboard:', err);
      // Set error state instead of throwing to prevent infinite loading
      setError(err instanceof Error ? err.message : 'Failed to initialize business dashboard');
      setLoading(false);
      // Re-throw so loadBusinessData knows it failed
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={32} />
        <p className="mt-4 text-sm text-gray-600">Setting up workspace...</p>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="container mx-auto p-6">
        <Alert type="error" title="Error Loading Business">
          {error || 'Business not found'}
        </Alert>
      </div>
    );
  }

  // Retry logic if dashboard initialization failed
  useEffect(() => {
    // If we have business but no dashboard ID and we're not loading, something went wrong
    // Try to re-initialize if we have the data
    if (business && !businessDashboardId && !loading && !error && session?.accessToken) {
      console.log('🔄 Retrying dashboard initialization...');
      ensureBusinessDashboard(business).catch(err => {
        console.error('❌ Retry failed:', err);
      });
    }
  }, [business, businessDashboardId, loading, error, session?.accessToken]);

  // Safety check: Don't render modules until dashboard is ready
  if (!businessDashboardId) {
    console.warn('⚠️ BusinessWorkspace rendering without dashboardId!', {
      hasBusiness: !!business,
      businessId: business?.id,
      loading,
      error,
      sessionHasToken: !!session?.accessToken
    });
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={32} />
        <p className="mt-4 text-sm text-gray-600">Initializing business workspace...</p>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }

  console.log('✅ BusinessWorkspace rendering with dashboardId:', businessDashboardId);

  return (
    <BusinessWorkspaceContent 
      business={business} 
      currentModule={currentModule}
      businessDashboardId={businessDashboardId}
    />
  );
} 