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
import { useSidebarCustomization } from '../../contexts/SidebarCustomizationContext';
import { SidebarCustomizationModal } from '../sidebar/SidebarCustomizationModal';
import { SidebarFolderRenderer } from '../sidebar/SidebarFolderRenderer';
import BusinessWorkspaceContent from './BusinessWorkspaceContent';
import { businessAPI } from '../../api/business';

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
  business: Business | null;
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
  const nextPathname = usePathname();
  const router = useRouter();
  const [pathname, setPathname] = useState<string>('/');
  
  // Handle pathname safely for SSR
  useEffect(() => {
    if (nextPathname) {
      setPathname(nextPathname);
    } else if (typeof window !== 'undefined') {
      setPathname(window.location.pathname);
    }
  }, [nextPathname]);
  const { data: session, status } = useSession();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  
  // Business state - load client-side if prop is null
  const [localBusiness, setLocalBusiness] = useState<Business | null>(business);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  
  // Business dashboard state - CRITICAL for data isolation
  const [businessDashboardId, setBusinessDashboardId] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  
  // Update local business when prop changes
  useEffect(() => {
    if (business) {
      setLocalBusiness(business);
    }
  }, [business]);
  
  // Use local business if prop is null (fallback to loaded business)
  const effectiveBusiness = business || localBusiness;
  
  const { currentBranding, isBusinessContext, getSidebarStyles, getHeaderStyles } = useGlobalBranding();
  const { getFilteredModules } = usePositionAwareModules();
  const { getConfigForContext, getConfigForTab } = useSidebarCustomization();
  
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  
  // Get left sidebar config for current dashboard
  const dashboardTabId = businessDashboardId || '';
  const leftSidebarConfig = getConfigForTab(dashboardTabId);
  
  // Initialize collapsed folders state from config
  useEffect(() => {
    if (leftSidebarConfig) {
      const sortedFolders = [...leftSidebarConfig.folders].sort((a, b) => a.order - b.order);
      const initialCollapsed = new Set(sortedFolders.filter(f => f.collapsed).map(f => f.id));
      setCollapsedFolders(initialCollapsed);
    } else {
      setCollapsedFolders(new Set());
    }
  }, [businessDashboardId, leftSidebarConfig]);

  // Get available modules using position-aware filtering
  const getAvailableModules = () => {
    return getFilteredModules();
  };

  const modules = getAvailableModules();

  // Load business data client-side if prop is null
  useEffect(() => {
    async function loadBusiness() {
      // Extract businessId from pathname
      const businessIdFromPath = pathname?.split('/business/')[1]?.split('/')[0] || null;
      
      // Only load if business prop is null and we have a businessId from path
      if (!business && businessIdFromPath && session?.accessToken) {
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
          console.log('📥 DashboardLayoutWrapper: Loading business data for:', businessIdFromPath);
        }
        setBusinessLoading(true);
        setBusinessError(null);
        
        try {
          const businessResponse = await businessAPI.getBusiness(businessIdFromPath);
          if (isDev) {
            console.log('📦 DashboardLayoutWrapper: Business response:', {
              success: businessResponse.success,
              hasData: !!businessResponse.data
            });
          }
          
          if (businessResponse.success && businessResponse.data) {
            setLocalBusiness(businessResponse.data as unknown as Business);
            if (isDev) {
              console.log('✅ DashboardLayoutWrapper: Business loaded:', businessResponse.data.name);
            }
          } else {
            setBusinessError('Failed to load business data');
            if (isDev) {
              console.error('❌ DashboardLayoutWrapper: Business response failed:', businessResponse);
            }
          }
        } catch (err) {
          console.error('❌ DashboardLayoutWrapper: Error loading business data:', err);
          setBusinessError(err instanceof Error ? err.message : 'Failed to load business data');
        } finally {
          setBusinessLoading(false);
        }
      }
    }
    
    loadBusiness();
  }, [business, pathname, session?.accessToken]);

  // Client-side auth check - redirect to login if not authenticated after session loads
  useEffect(() => {
    // Wait for session to finish loading before checking authentication
    if (status === 'loading') {
      return; // Still loading, don't redirect yet
    }

    // Only redirect if we're sure the user is unauthenticated
    if (status === 'unauthenticated' || !session?.accessToken) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('No session detected on client, redirecting to login');
      }
      router.push('/auth/login');
    }
  }, [status, session, router]);

  // CRITICAL: Ensure business dashboard exists for proper data isolation
  useEffect(() => {
    async function ensureBusinessDashboard() {
      const isDev = process.env.NODE_ENV === 'development';
      
      // Extract businessId from pathname if business prop is null
      const businessIdFromPath = pathname?.split('/business/')[1]?.split('/')[0] || null;
      const effectiveBusinessId = effectiveBusiness?.id || businessIdFromPath;
      
      if (isDev) {
        console.log('🚀 DashboardLayoutWrapper: ensureBusinessDashboard called', {
          hasToken: !!session?.accessToken,
          hasBusiness: !!effectiveBusiness,
          businessIdFromProp: effectiveBusiness?.id,
          businessIdFromPath,
          effectiveBusinessId,
          pathname
        });
      }
      
      if (!session?.accessToken || !effectiveBusinessId) {
        if (isDev) {
          console.log('⏸️ DashboardLayoutWrapper: Missing requirements, skipping', {
            hasToken: !!session?.accessToken,
            hasBusiness: !!effectiveBusiness,
            effectiveBusinessId
          });
        }
        setDashboardLoading(false);
        return;
      }

      try {
        if (isDev) {
          console.log('🔄 DashboardLayoutWrapper: Starting dashboard initialization...');
        }
        setDashboardLoading(true);
        setDashboardError(null);

        // Fetch all user's dashboards
        const dashboardsResponse = await fetch('/api/dashboard', {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
          },
        });

        if (!dashboardsResponse.ok) {
          const errorText = await dashboardsResponse.text();
          console.error('❌ DashboardLayoutWrapper: Dashboard API error:', {
            status: dashboardsResponse.status,
            statusText: dashboardsResponse.statusText,
            errorText
          });
          throw new Error(`Failed to load dashboards: ${dashboardsResponse.status} - ${errorText}`);
        }

        const dashboardsData = await dashboardsResponse.json();
        if (isDev) {
          console.log('📊 DashboardLayoutWrapper: Dashboards data:', dashboardsData);
        }
        
        // Extract all dashboards from the nested structure
        const allDashboards = dashboardsData.dashboards ? [
          ...(dashboardsData.dashboards.personal || []),
          ...(dashboardsData.dashboards.business || []),
          ...(dashboardsData.dashboards.educational || []),
          ...(dashboardsData.dashboards.household || [])
        ] : [];
        
        if (isDev) {
          console.log('📊 DashboardLayoutWrapper: Total dashboards:', allDashboards.length);
          console.log('🔍 DashboardLayoutWrapper: Business dashboards:', allDashboards.filter((d: any) => d.businessId).map((d: any) => ({ id: d.id, businessId: d.businessId, name: d.name })));
          console.log('🔍 DashboardLayoutWrapper: Looking for business dashboard with businessId:', effectiveBusinessId);
        }

        // Find existing business dashboard
        let businessDashboard = allDashboards.find((d: Record<string, any>) => d.businessId === effectiveBusinessId);

        if (businessDashboard) {
          if (isDev) {
            console.log('✅ DashboardLayoutWrapper: Found existing business dashboard:', {
              id: businessDashboard.id,
              name: businessDashboard.name,
              businessId: businessDashboard.businessId
            });
          }
        } else {
          if (isDev) {
            console.log('🆕 DashboardLayoutWrapper: Creating new business dashboard for business:', effectiveBusinessId);
          }
          
          // Create business dashboard
          const createResponse = await fetch('/api/dashboard', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.accessToken}`,
            },
            body: JSON.stringify({
              name: `${effectiveBusiness?.name || 'Business'} Workspace`,
              businessId: effectiveBusinessId,
              layout: {},
              preferences: {},
            }),
          });

          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('❌ DashboardLayoutWrapper: Create dashboard failed:', {
              status: createResponse.status,
              errorText
            });
            throw new Error(`Failed to create business dashboard: ${createResponse.status} - ${errorText}`);
          }

          const createResponseData = await createResponse.json();
          if (isDev) {
            console.log('📦 DashboardLayoutWrapper: Create dashboard response:', createResponseData);
          }
          
          // Handle both response formats: { dashboard: {...} } or just {...}
          businessDashboard = createResponseData?.dashboard || createResponseData;
          
          if (!businessDashboard) {
            throw new Error('Create dashboard response is empty');
          }
          
          if (isDev) {
            console.log('✅ DashboardLayoutWrapper: Created new business dashboard:', {
              id: businessDashboard.id,
              name: businessDashboard.name,
              businessId: businessDashboard.businessId
            });
          }
        }

        // Set the dashboard ID
        if (!businessDashboard?.id) {
          console.error('❌ DashboardLayoutWrapper: Business dashboard missing id:', businessDashboard);
          throw new Error('Business dashboard response missing id');
        }
        
        if (isDev) {
          console.log('🎯 DashboardLayoutWrapper: Setting businessDashboardId to:', businessDashboard.id);
        }
        setBusinessDashboardId(businessDashboard.id);
        if (isDev) {
          console.log('✅ DashboardLayoutWrapper: Business Dashboard Ready:', {
            dashboardId: businessDashboard.id,
            businessId: effectiveBusinessId,
            dashboardName: businessDashboard.name,
            timestamp: new Date().toISOString()
          });
        }

      } catch (err) {
        console.error('❌ DashboardLayoutWrapper: Failed to ensure business dashboard:', err);
        setDashboardError(err instanceof Error ? err.message : 'Failed to initialize business dashboard');
      } finally {
        setDashboardLoading(false);
      }
    }

    ensureBusinessDashboard();
  }, [session?.accessToken, effectiveBusiness?.id, effectiveBusiness?.name, pathname]);

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
    // Extract businessId from pathname if business is null
    const businessId = business?.id || pathname?.split('/business/')[1]?.split('/')[0] || '';
    if (businessId) {
      router.push(`/business/${businessId}/workspace?module=${moduleId}`);
    }
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

  // Show loading state while session is being determined
  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column' }}>
        <Spinner size={32} />
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>Verifying session...</p>
      </div>
    );
  }

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
                {(() => {
                  // If no config exists, show flat list (fallback)
                  if (!leftSidebarConfig) {
                    return modules.map(m => {
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
                    });
                  }

                  // Render with folders
                  const sortedFolders = [...leftSidebarConfig.folders].sort((a, b) => a.order - b.order);
                  const sortedLooseModules = [...leftSidebarConfig.looseModules].sort((a, b) => a.order - b.order);
                  const textColor = isBusinessContext ? getSidebarStyles().color : '#fff';

                  const handleToggleCollapse = (folderId: string) => {
                    setCollapsedFolders(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(folderId)) {
                        newSet.delete(folderId);
                      } else {
                        newSet.add(folderId);
                      }
                      return newSet;
                    });
                  };

                  return (
                    <>
                      {/* Folders */}
                      {sortedFolders.map(folder => (
                        <SidebarFolderRenderer
                          key={folder.id}
                          folder={{
                            ...folder,
                            collapsed: collapsedFolders.has(folder.id),
                          }}
                          modules={modules}
                          onToggleCollapse={handleToggleCollapse}
                          onModuleClick={navigateToModule}
                          activeModuleId={currentModule || undefined}
                          textColor={textColor}
                        />
                      ))}

                      {/* Loose Modules */}
                      {sortedLooseModules.map(moduleRef => {
                        const module = modules.find(m => m.id === moduleRef.id);
                        if (!module) return null;
                        const Icon = MODULE_ICONS[module.id as keyof typeof MODULE_ICONS] || LayoutDashboard;
                        const isActive = currentModule === module.id;
                        return (
                          <li key={module.id} style={{ marginBottom: 8 }}>
                            <button
                              onClick={() => navigateToModule(module.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 12px',
                                borderRadius: 8,
                                background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                color: textColor,
                                textDecoration: 'none',
                                gap: 12,
                                border: 'none',
                                cursor: 'pointer',
                                width: '100%',
                                textAlign: 'left',
                              }}
                            >
                              <Icon size={22} />
                              <span>{module.name}</span>
                      </button>
                    </li>
                  );
                })}
                    </>
                  );
                })()}
              </ul>
            </nav>
            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <button 
                onClick={() => setShowCustomizationModal(true)} 
                style={{ 
                  width: '100%', 
                  background: 'none', 
                  border: '1px solid #555', 
                  color: isBusinessContext ? getSidebarStyles().color : '#fff', 
                  padding: '8px 0', 
                  borderRadius: 6, 
                  fontWeight: 600 
                }}
              >
                Customize
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200" style={{
          padding: 0,
          paddingRight: 40, // Always account for fixed right sidebar (always visible)
          marginLeft: 0,
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
          ) : businessLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column' }}>
              <Spinner size={32} />
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading business information...</p>
            </div>
          ) : businessError ? (
            <div style={{ padding: '1.5rem' }}>
              <Alert type="error" title="Failed to Load Business">
                {businessError}
              </Alert>
            </div>
          ) : !effectiveBusiness ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column' }}>
              <Spinner size={32} />
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading business information...</p>
            </div>
          ) : shouldRenderNestedRoute ? (
            <>{children}</>
          ) : (
            <BusinessWorkspaceContent 
              business={effectiveBusiness}
              currentModule={currentModule}
              businessDashboardId={businessDashboardId}
            />
          )}
        </main>

        {/* Right Quick-Access Sidebar */}
        <aside style={{
          width: 40,
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
          zIndex: 1000,
          boxShadow: '0 0 8px rgba(0,0,0,0.04)',
          transition: 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out',
          overflow: 'hidden',
          // Right sidebar should always be visible in workspace, regardless of left sidebar collapse state
          visibility: 'visible',
          opacity: 1,
        }}>
          {/* Fixed Top: Dashboard */}
          {modules.filter(m => m.id === 'dashboard').map(module => {
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
          
          {/* Customizable Middle: Pinned Modules */}
          {(() => {
            const rightSidebarContext = effectiveBusiness?.id || 'personal';
            const rightSidebarConfig = getConfigForContext(rightSidebarContext);
            const pinnedModuleIds = rightSidebarConfig?.pinnedModules
              .sort((a, b) => a.order - b.order)
              .map(m => m.id) || [];
            
            return pinnedModuleIds
              .map(id => modules.find(m => m.id === id))
              .filter((module): module is typeof modules[0] => module !== undefined)
              .map(module => {
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
              });
          })()}
          
          {/* Spacer to push bottom items down */}
          <div style={{ flex: 1 }} />
          
          {/* Fixed Bottom: AI Assistant, Modules, Trash */}
          <button
            className={`flex items-center justify-center w-10 h-10 my-1 rounded-lg transition-colors ${pathname?.startsWith('/ai-chat') ? 'bg-purple-600' : 'hover:bg-gray-700'} ${pathname?.startsWith('/ai-chat') ? 'text-white' : 'text-gray-300'}`}
            style={{
              background: pathname?.startsWith('/ai-chat') ? '#9333ea' : 'transparent',
              color: pathname?.startsWith('/ai-chat') ? '#fff' : '#cbd5e1',
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
            onClick={() => {
              try {
                router.push('/ai-chat');
              } catch (error) {
                console.error('Error navigating to AI chat:', error);
                window.location.href = '/ai-chat';
              }
            }}
            title="AI Chat"
          >
            <Brain size={22} />
          </button>
          
          <button
            className="flex items-center justify-center w-10 h-10 my-1 rounded-lg transition-colors hover:bg-gray-700 text-gray-300"
            style={{
              background: 'transparent',
              color: '#cbd5e1',
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
            onClick={() => router.push('/modules')}
            title="Module Management"
          >
            <Package size={22} />
          </button>
          
          {/* Global Trash Bin */}
          <div className="mb-4">
            <GlobalTrashBin />
          </div>
        </aside>
      </div>
      
      {/* Sidebar Customization Modal */}
      <SidebarCustomizationModal
        open={showCustomizationModal}
        onClose={() => setShowCustomizationModal(false)}
      />
    </div>
  );
}

export default DashboardLayoutWrapper;
