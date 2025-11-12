'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  LayoutDashboard, 
  Folder, 
  MessageSquare, 
  Users, 
  Shield, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Briefcase,
  Home,
  LogOut,
  Package,
  Brain,
  Calendar
} from 'lucide-react';
import GlobalTrashBin from '../GlobalTrashBin';
import { COLORS, getBrandColor } from 'shared/utils/brandColors';
import { Spinner, Alert } from 'shared/components';
import ClientOnlyWrapper from '../../app/ClientOnlyWrapper';
import AvatarContextMenu from '../AvatarContextMenu';
import GlobalHeaderTabs from '../GlobalHeaderTabs';
import { useBusinessConfiguration } from '../../contexts/BusinessConfigurationContext';
import { useGlobalBranding } from '../../contexts/GlobalBrandingContext';
import { usePositionAwareModules } from '../PositionAwareModuleProvider';
import BusinessWorkspaceContent from './BusinessWorkspaceContent';

interface Business {
  id: string;
  name: string;
  logo?: string;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    customCSS?: string;
  };
}

interface DashboardLayoutWrapperProps {
  business: Business;
  children: React.ReactNode;
}

// Module icons mapping
const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  drive: Folder,
  chat: MessageSquare,
  admin: Shield,
  members: Users,
  analytics: BarChart3,
  ai: Brain,
  calendar: Calendar,
};

function DashboardLayoutWrapper({ business, children }: DashboardLayoutWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  
  // Business dashboard state - CRITICAL for data isolation
  const [businessDashboardId, setBusinessDashboardId] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  
  const { currentBranding, isBusinessContext, getSidebarStyles, getHeaderStyles } = useGlobalBranding();
  const { getFilteredModules } = usePositionAwareModules();

  // Get available modules using position-aware filtering
  const getAvailableModules = () => {
    return getFilteredModules();
  };

  const modules = getAvailableModules();

  // CRITICAL: Ensure business dashboard exists for proper data isolation
  useEffect(() => {
    async function ensureBusinessDashboard() {
      if (!session?.accessToken || !business?.id) {
        setDashboardLoading(false);
        return;
      }

      try {
        setDashboardLoading(true);
        setDashboardError(null);

        console.log('🔄 DashboardLayoutWrapper: Fetching dashboards for business:', business.id);

        // Fetch all user's dashboards
        const dashboardsResponse = await fetch('/api/dashboard', {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
          },
        });

        if (!dashboardsResponse.ok) {
          throw new Error(`Failed to load dashboards: ${dashboardsResponse.status}`);
        }

        const dashboardsData = await dashboardsResponse.json();
        console.log('📊 DashboardLayoutWrapper: Dashboards data:', dashboardsData);
        
        // Extract all dashboards from the nested structure
        const allDashboards = dashboardsData.dashboards ? [
          ...(dashboardsData.dashboards.personal || []),
          ...(dashboardsData.dashboards.business || []),
          ...(dashboardsData.dashboards.educational || []),
          ...(dashboardsData.dashboards.household || [])
        ] : [];
        
        console.log('📊 DashboardLayoutWrapper: Total dashboards:', allDashboards.length);

        // Find existing business dashboard
        let businessDashboard = allDashboards.find((d: Record<string, any>) => d.businessId === business.id);

        if (businessDashboard) {
          console.log('✅ DashboardLayoutWrapper: Found existing business dashboard:', businessDashboard.id);
        } else {
          console.log('🆕 DashboardLayoutWrapper: Creating new business dashboard...');

          // Create business dashboard
          const createResponse = await fetch('/api/dashboard', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.accessToken}`,
            },
            body: JSON.stringify({
              name: `${business.name} Workspace`,
              businessId: business.id,
              layout: {},
              preferences: {},
            }),
          });

          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Failed to create business dashboard: ${createResponse.status} - ${errorText}`);
          }

          businessDashboard = await createResponse.json();
          console.log('✅ DashboardLayoutWrapper: Created new business dashboard:', businessDashboard.id);
        }

        // Set the dashboard ID
        setBusinessDashboardId(businessDashboard.id);
        console.log('🎯 DashboardLayoutWrapper: Business Dashboard Ready:', {
          dashboardId: businessDashboard.id,
          businessId: business.id,
          dashboardName: businessDashboard.name,
          timestamp: new Date().toISOString()
        });

      } catch (err) {
        console.error('❌ DashboardLayoutWrapper: Failed to ensure business dashboard:', err);
        setDashboardError(err instanceof Error ? err.message : 'Failed to initialize business dashboard');
      } finally {
        setDashboardLoading(false);
      }
    }

    ensureBusinessDashboard();
  }, [session?.accessToken, business?.id, business?.name]);

  useEffect(() => {
    setIsMobile(window.innerWidth < 700);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile]);

  // Get current module from URL params
  const getCurrentModule = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('module') || 'dashboard';
  };

  const navigateToModule = (moduleId: string) => {
    // Update URL to show the module in the main content area
    router.push(`/business/${business.id}/workspace?module=${moduleId}`);
  };

  const handleSwitchToPersonal = () => {
    router.push('/dashboard');
  };

  const afterWorkspace = pathname?.split('/workspace/')[1] || '';
  const pathSegments = afterWorkspace.split('/').filter(Boolean);
  const pathModule = pathSegments[0] || null;
  const hasNestedSegments = pathSegments.length > 1;
  const currentModule = pathModule || getCurrentModule();
  const shouldRenderNestedRoute = hasNestedSegments;

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      {/* Global Header (shared tabs) */}
      <GlobalHeaderTabs />
      {/* Main content area below header */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'absolute', top: 64, left: 0, right: 0, bottom: 0 }}>
        {/* Left Sidebar */}
        <aside style={{
          width: sidebarCollapsed ? 0 : 240,
          background: isBusinessContext ? getSidebarStyles().backgroundColor : getBrandColor('neutralMid'),
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 0',
          flexShrink: 0,
          transition: 'width 0.2s ease-in-out',
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
        }}>
          {/* Collapse/Expand Arrow Button */}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              position: 'fixed',
              top: '50%',
              left: sidebarCollapsed ? 0 : 228,
              transform: 'translateY(-50%)',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#444',
              color: '#fff',
              border: '1px solid #555',
              cursor: 'pointer',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'left 0.2s ease-in-out',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d={sidebarCollapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          <div style={{ 
            visibility: !sidebarCollapsed ? 'visible' : 'hidden', 
            opacity: !sidebarCollapsed ? 1 : 0, 
            transition: 'opacity 0.2s, visibility 0.2s' 
          }}>
            <nav>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {modules.map(m => {
                  const Icon = MODULE_ICONS[m.id as keyof typeof MODULE_ICONS] || LayoutDashboard;
                  const isActive = currentModule === m.id;
                  return (
                    <li key={m.id} style={{ marginBottom: 8 }}>
                      <button
                        onClick={() => navigateToModule(m.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          color: isBusinessContext ? getSidebarStyles().color : '#fff',
                          textDecoration: 'none',
                          gap: 12,
                          border: 'none',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                        }}
                      >
                        <Icon size={22} />
                        <span>{m.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200" style={{
          padding: 0,
          paddingRight: !sidebarCollapsed ? 40 : 0,
          marginLeft: !sidebarCollapsed ? 0 : 0,
          transition: 'margin-left 0.2s ease-in-out, padding-right 0.2s ease-in-out',
        }}>
          {dashboardLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column' }}>
              <Spinner size={32} />
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>Setting up workspace...</p>
            </div>
          ) : dashboardError ? (
            <div style={{ padding: '1.5rem' }}>
              <Alert type="error" title="Failed to Initialize Workspace">
                {dashboardError}
              </Alert>
            </div>
          ) : !businessDashboardId ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column' }}>
              <Spinner size={32} />
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>Initializing business workspace...</p>
            </div>
          ) : shouldRenderNestedRoute ? (
            <>{children}</>
          ) : (
            <BusinessWorkspaceContent 
              business={business}
              currentModule={currentModule}
              businessDashboardId={businessDashboardId}
            />
          )}
        </main>

        {/* Right Quick-Access Sidebar */}
        <aside style={{
          width: !sidebarCollapsed ? 40 : 0,
          background: isBusinessContext ? getSidebarStyles().backgroundColor : getBrandColor('neutralMid'),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 0',
          gap: 12,
          flexShrink: 0,
          position: 'fixed',
          right: 0,
          top: 64,
          height: 'calc(100vh - 64px)',
          zIndex: 50,
          boxShadow: '0 0 8px rgba(0,0,0,0.04)',
          transition: 'width 0.2s ease-in-out',
          overflow: 'hidden',
        }}>
          {/* Module icons */}
          {modules.map(module => {
            const Icon = MODULE_ICONS[module.id as keyof typeof MODULE_ICONS] || LayoutDashboard;
            const isActive = currentModule === module.id;
            return (
              <button
                key={module.id}
                className={`flex items-center justify-center w-10 h-10 my-1 rounded-lg transition-colors ${isActive ? 'bg-gray-800' : 'hover:bg-gray-700'} ${isActive ? 'text-white' : 'text-gray-300'}`}
                style={{
                  background: isActive ? '#1f2937' : 'transparent',
                  color: isActive ? '#fff' : '#cbd5e1',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  margin: '8px 0',
                  borderRadius: 8,
                  transition: 'background 0.18s cubic-bezier(.4,1.2,.6,1)',
                }}
                onClick={() => navigateToModule(module.id)}
                title={module.name}
              >
                <Icon size={22} />
              </button>
            );
          })}
          
          {/* Global Trash Bin */}
          <div className="mt-auto mb-4">
            <GlobalTrashBin />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default DashboardLayoutWrapper;
