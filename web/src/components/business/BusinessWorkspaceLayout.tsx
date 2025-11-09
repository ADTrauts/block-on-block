'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from 'next/navigation';
import { COLORS } from 'shared/styles/theme';
import { Spinner, Alert } from 'shared/components';
import ClientOnlyWrapper from '../../app/ClientOnlyWrapper';
import { BusinessBrandingProvider } from '../../components/BusinessBranding';
import AvatarContextMenu from '../AvatarContextMenu';
import { useBusinessConfiguration } from '../../contexts/BusinessConfigurationContext';
import BusinessWorkspaceContent from './BusinessWorkspaceContent';

interface BusinessWorkspaceLayoutProps {
  business: Business;
}

interface Module {
  id: string;
  name: string;
  hidden?: boolean;
}

interface BusinessModule {
  id: string;
  name?: string;
  status: string;
}

const BUSINESS_MODULES: Module[] = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'drive', name: 'Drive' },
  { id: 'chat', name: 'Chat' },
  { id: 'ai', name: 'AI Assistant' },
  { id: 'members', name: 'Members' },
  { id: 'admin', name: 'Admin' },
  { id: 'analytics', name: 'Analytics' },
];

const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  drive: Folder,
  chat: MessageSquare,
  calendar: Calendar,
  ai: Brain,
  members: Users,
  admin: Shield,
  analytics: BarChart3,
};

function getSidebarKey(pathname: string | null) {
  const module = pathname?.split('/')[3] || 'dashboard';
  return `businessSidebarCollapsed:/${module}`;
}

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
  members?: Array<{
    id: string;
    role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  // Add other fields as needed from the API response
}

export default function BusinessWorkspaceLayout({ business }: BusinessWorkspaceLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const userToggled = useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarCollapsedOld, setSidebarCollapsedOld] = useState(sidebarCollapsed);
  const [sidebarCollapsedNew, setSidebarCollapsedNew] = useState(sidebarCollapsed);
  const [sidebarCollapsedTransition, setSidebarCollapsedTransition] = useState(false);
  const [mobileMenuOpenOld, setMobileMenuOpenOld] = useState(false);
  const [mobileMenuOpenNew, setMobileMenuOpenNew] = useState(false);
  const [sidebarOpenOld, setSidebarOpenOld] = useState(true);
  const [sidebarOpenNew, setSidebarOpenNew] = useState(true);
  const userToggledOld = useRef(false);
  const userToggledNew = useRef(false);
  const rightPanelIconSize = 20;
  const rightPanelTouchSize = isMobile ? 36 : 28;
  const { data: session } = useSession();
  const { configuration, loading: configLoading, getModulesForUser } = useBusinessConfiguration();

  // Business dashboard state - CRITICAL for data isolation
  const [businessDashboardId, setBusinessDashboardId] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Business branding - prefer configuration over business object
  const branding = configuration?.branding || business.branding || {};
  const primaryColor = branding.primaryColor || COLORS.infoBlue;
  const secondaryColor = branding.secondaryColor || COLORS.neutralDark;
  const accentColor = branding.accentColor || COLORS.highlightYellow;

  // Get modules for current user based on permissions
  const getAvailableModules = (): Module[] => {
    if (!configuration || !session?.user?.id) {
      // Return empty array - no fallback
      // If configuration fails to load, the error state will show appropriate message
      console.warn('⚠️  No configuration or session available for module filtering');
      return [];
    }

    // Use getModulesForUser to filter by position and department permissions
    const userModules = getModulesForUser(session.user.id);
    
    // Convert BusinessModule[] to Module[]
    const modules: Module[] = userModules.map((bModule: BusinessModule) => ({
      id: bModule.id,
      name: bModule.name || bModule.id,
      hidden: false
    }));

    // Return actual modules from API - no hardcoded fallback
    return modules;
  };

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

        console.log('🔄 BusinessWorkspaceLayout: Fetching dashboards for business:', business.id);

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
        console.log('📊 BusinessWorkspaceLayout: Dashboards data:', dashboardsData);
        
        // Extract all dashboards from the nested structure
        const allDashboards = dashboardsData.dashboards ? [
          ...(dashboardsData.dashboards.personal || []),
          ...(dashboardsData.dashboards.business || []),
          ...(dashboardsData.dashboards.educational || []),
          ...(dashboardsData.dashboards.household || [])
        ] : [];
        
        console.log('📊 BusinessWorkspaceLayout: Total dashboards:', allDashboards.length);

        // Find existing business dashboard
        let businessDashboard = allDashboards.find((d: Record<string, any>) => d.businessId === business.id);

        if (businessDashboard) {
          console.log('✅ BusinessWorkspaceLayout: Found existing business dashboard:', businessDashboard.id);
        } else {
          console.log('🆕 BusinessWorkspaceLayout: Creating new business dashboard...');

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

          const createdDashboardResponse = await createResponse.json();
          businessDashboard = createdDashboardResponse?.dashboard ?? createdDashboardResponse;
          console.log('✅ BusinessWorkspaceLayout: Created new business dashboard:', businessDashboard?.id);
        }

        // Set the dashboard ID
        if (businessDashboard?.id) {
          setBusinessDashboardId(businessDashboard.id);
        } else {
          throw new Error('Business dashboard response missing id');
        }
        console.log('🎯 BusinessWorkspaceLayout: Business Dashboard Ready:', {
          dashboardId: businessDashboard.id,
          businessId: business.id,
          dashboardName: businessDashboard.name,
          timestamp: new Date().toISOString()
        });

      } catch (err) {
        console.error('❌ BusinessWorkspaceLayout: Failed to ensure business dashboard:', err);
        setDashboardError(err instanceof Error ? err.message : 'Failed to initialize business dashboard');
      } finally {
        setDashboardLoading(false);
      }
    }

    ensureBusinessDashboard();
  }, [session?.accessToken, business?.id, business?.name]);

  // Initialize client-side state after hydration
  useEffect(() => {
    setModules(getAvailableModules());
    setIsMobile(window.innerWidth < 700);
    setHydrated(true);
  }, [configuration, session?.user?.id]);

  // Handle window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 700);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // After hydration, update sidebarCollapsed from localStorage or default logic
  useEffect(() => {
    if (!hydrated || !pathname) return;
    
    const key = getSidebarKey(pathname);
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      setSidebarCollapsed(stored === 'true');
    } else {
      setSidebarCollapsed(false); // Default to expanded for business workspace
    }
  }, [pathname, hydrated]);

  // Save sidebarCollapsed to localStorage per module
  useEffect(() => {
    if (!hydrated || !pathname) return;
    
    const key = getSidebarKey(pathname);
    localStorage.setItem(key, sidebarCollapsed ? 'true' : 'false');
  }, [sidebarCollapsed, pathname, hydrated]);

  // Responsive: auto-collapse on mobile
  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile]);

  // Accessibility: focus management
  const sidebarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sidebarCollapsed && sidebarRef.current) {
      sidebarRef.current.focus();
    }
  }, [sidebarCollapsed]);

  // Toggle handler with user intent
  const handleSidebarToggle = () => {
    userToggled.current = true;
    setSidebarCollapsed((v) => !v);
  };

  const handleMove = (from: number, to: number) => {
    const updated = [...modules];
    const [removed] = updated.splice(from, 1);
    updated.splice(to, 0, removed);
    setModules(updated);
  };

  const handleToggle = (idx: number) => {
    const updated = modules.map((m: Module, i: number) => i === idx ? { ...m, hidden: !m.hidden } : m);
    setModules(updated);
  };

  useEffect(() => {
    if (sidebarCollapsed !== sidebarCollapsedOld) {
      setSidebarCollapsedOld(sidebarCollapsed);
      setSidebarCollapsedNew(sidebarCollapsed);
      setSidebarCollapsedTransition(true);
      setTimeout(() => {
        setSidebarCollapsedTransition(false);
      }, 200);
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (mobileMenuOpen !== mobileMenuOpenOld) {
      setMobileMenuOpenOld(mobileMenuOpen);
      setMobileMenuOpenNew(mobileMenuOpen);
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (sidebarOpen !== sidebarOpenOld) {
      setSidebarOpenOld(sidebarOpen);
      setSidebarOpenNew(sidebarOpen);
    }
  }, [sidebarOpen]);

  const navigateToModule = (moduleId: string) => {
    // Update URL to show the module in the main content area
    router.push(`/business/${business.id}/workspace?module=${moduleId}`);
  };

  const navigateToTab = (tabId: string) => {
    // Map dashboard to the main workspace page (Overview)
    if (tabId === 'dashboard') {
      router.push(`/business/${business.id}/workspace`);
    } else {
      router.push(`/business/${business.id}/workspace?module=${tabId}`);
    }
  };

  const handleSwitchToPersonal = () => {
    router.push('/dashboard');
  };

  const handleManageBusiness = () => {
    router.push(`/business/${business.id}/profile`);
  };

  // Core modules that are always available
  const CORE_MODULES = [
    { id: 'dashboard', name: 'Overview', icon: LayoutDashboard },
    { id: 'drive', name: 'Drive', icon: Folder },
    { id: 'chat', name: 'Chat', icon: MessageSquare },
    { id: 'calendar', name: 'Calendar', icon: Calendar },
  ];

  // Additional modules based on business configuration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAdditionalModules = (): Array<{ id: string; name: string; icon: any }> => {
    if (!configuration || !session?.user?.id) {
      return [];
    }

    const enabledModules = configuration.enabledModules?.filter(m => m.status === 'enabled') || [];
    const coreModuleIds = CORE_MODULES.map(m => m.id);
    
    return enabledModules
      .filter(m => !coreModuleIds.includes(m.id))
      .map(m => ({
        id: m.id,
        name: m.name || m.id,
        icon: MODULE_ICONS[m.id as keyof typeof MODULE_ICONS] || Package
      }));
  };

  // Combine core and additional modules for tabs
  const businessTabs = [
    ...CORE_MODULES,
    ...getAdditionalModules()
  ];

  // Determine current tab based on pathname
  const getCurrentTab = () => {
    const pathParts = pathname?.split('/') || [];
    const lastPart = pathParts[pathParts.length - 1];
    
    // If we're on the main workspace page (no sub-path), show 'dashboard' as active
    if (pathParts.length === 4 && lastPart === 'workspace') {
      return 'dashboard';
    }
    
    // Otherwise, use the last part as the tab ID
    return lastPart || 'dashboard';
  };

  // Get current module from URL params
  const getCurrentModule = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('module') || 'dashboard';
  };
  
  const currentTab = getCurrentTab();

  return (
    <BusinessBrandingProvider initialBranding={{
      id: business.id,
      name: business.name,
      logo: business.logo,
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily: branding.fontFamily || '',
      customCSS: (branding as any).customCSS || '',
    }}>
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
        {/* Main Header */}
        <header style={{
          height: isMobile ? 'auto' : 64,
          background: secondaryColor,
          color: '#fff',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '0 12px' : '0 32px',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          zIndex: 10,
        }}>
          {/* Left: Business Logo and Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '0 0 auto' }}>
            {business.logo ? (
              <img 
                src={business.logo} 
                alt={`${business.name} logo`}
                style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 6,
                  objectFit: 'cover'
                }} 
              />
            ) : (
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 6,
                background: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 16,
                color: secondaryColor
              }}>
                {business.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 style={{ fontWeight: 600, fontSize: 18, color: '#fff', margin: 0 }}>
                {business.name}
              </h1>
              <div style={{ fontSize: 12, color: '#ccc', marginTop: -2 }}>
                Business Workspace
              </div>
            </div>
          </div>

          {/* Center: Business Dashboard Tabs */}
          <div style={{ 
            flex: '1 1 auto', 
            display: 'flex', 
            justifyContent: 'center',
            marginTop: isMobile ? 8 : 0,
            overflow: 'hidden'
          }}>
            <nav style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0,
              maxWidth: '100%',
              overflow: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0,
                minWidth: 0,
                flexWrap: 'nowrap'
              }}>
                {businessTabs.map((tab, idx) => {
                  const isActive = currentTab === tab.id;
                  const Icon = tab.icon;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => navigateToTab(tab.id)}
                      style={{
                        background: isActive ? '#fff' : '#e5e7eb',
                        color: isActive ? secondaryColor : '#666',
                        border: '1px solid #ccc',
                        borderBottom: 'none',
                        borderRadius: idx === 0 ? '8px 0 0 0' : idx === businessTabs.length - 1 ? '0 8px 0 0' : '0 0 0 0',
                        padding: `8px ${businessTabs.length > 5 ? 16 : 28}px 10px ${businessTabs.length > 5 ? 16 : 28}px`,
                        marginLeft: idx === 0 ? 0 : -1,
                        fontWeight: 700,
                        fontSize: businessTabs.length > 5 ? 14 : 16,
                        boxShadow: 'none',
                        position: 'relative',
                        top: 0,
                        zIndex: isActive ? 2 : 1,
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'background 0.18s cubic-bezier(.4,1.2,.6,1)',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderLeft: idx === 0 ? undefined : 'none',
                        minWidth: 0,
                        maxWidth: 120,
                        gap: 8,
                      }}
                      onFocus={e => {
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${primaryColor}`;
                      }}
                      onBlur={e => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background = '#f3f4f6';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background = isActive ? '#fff' : '#e5e7eb';
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                      title={tab.name}
                    >
                      <Icon size={18} style={{ opacity: 0.85 }} />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* Right: User Avatar and Actions */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: isMobile ? 8 : 0, flex: '0 0 auto', gap: 12 }}>
            {/* Admin Dashboard Button - Only show for admins/managers */}
            {(business.members?.find((m: { user: { id: string }; role: string }) => m.user.id === session?.user?.id)?.role === 'ADMIN' || 
              business.members?.find((m: { user: { id: string }; role: string }) => m.user.id === session?.user?.id)?.role === 'MANAGER') && (
              <button
                onClick={() => router.push(`/business/${business.id}`)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'none';
                }}
                title="Business Admin Dashboard"
              >
                <Shield size={14} />
                Admin
              </button>
            )}
            <button
              onClick={handleSwitchToPersonal}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <Home size={14} />
              Personal
            </button>
            <ClientOnlyWrapper>
              <AvatarContextMenu />
            </ClientOnlyWrapper>
          </div>
        </header>

        <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* Left Sidebar */}
          <aside style={{
            width: sidebarCollapsed ? 0 : 260,
            background: COLORS.neutralMid,
            color: '#fff',
            padding: sidebarCollapsed ? 0 : '24px 16px',
            display: 'none',
            flexDirection: 'column',
            transition: 'width 0.2s ease-in-out, padding 0.2s ease-in-out',
            flexShrink: 0,
            overflow: 'hidden',
          }} ref={sidebarRef} tabIndex={-1}>
            <button 
              onClick={handleSidebarToggle}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{ 
                position: 'absolute', 
                top: '50%', 
                left: sidebarCollapsed ? 12 : 248,
                transform: 'translateY(-50%)',
                width: 24, 
                height: 24, 
                borderRadius: '50%', 
                background: '#444', 
                color: '#fff', 
                border: '1px solid #555', 
                cursor: 'pointer',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d={sidebarCollapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <div style={{ visibility: sidebarCollapsed ? 'hidden' : 'visible', opacity: sidebarCollapsed ? 0 : 1, transition: 'opacity 0.2s, visibility 0.2s' }}>
              {!customizing && (
                <nav>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {modules.filter(m => !m.hidden).map(m => {
                      const Icon = MODULE_ICONS[m.id as keyof typeof MODULE_ICONS] || LayoutDashboard;
                      const isActive = pathname?.includes(`/${m.id}`);

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
                              color: '#fff',
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
              )}

              <div style={{ marginTop: 'auto' }}>
                <button 
                  onClick={() => setCustomizing(true)} 
                  style={{ 
                    width: '100%', 
                    background: 'none', 
                    border: '1px solid #555', 
                    color: '#fff', 
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
          <main style={{
            flexGrow: 1,
            overflowY: 'auto',
            background: COLORS.neutralLight,
            color: COLORS.neutralDark,
            padding: 0
          }}>
            {dashboardLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <Spinner size={32} />
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: COLORS.neutralDark }}>Setting up workspace...</p>
              </div>
            ) : dashboardError ? (
              <div style={{ padding: '1.5rem' }}>
                <Alert type="error" title="Failed to Initialize Workspace">
                  {dashboardError}
                </Alert>
              </div>
            ) : !businessDashboardId ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <Spinner size={32} />
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: COLORS.neutralDark }}>Initializing business workspace...</p>
              </div>
            ) : (
              <BusinessWorkspaceContent 
                business={business}
                currentModule={getCurrentModule()}
                businessDashboardId={businessDashboardId}
              />
            )}
          </main>

          {/* Right Quick-Access Sidebar */}
          <aside style={{
            width: 68,
            background: COLORS.neutralMid,
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 0',
            gap: 24,
            flexShrink: 0,
          }}>
            {modules.filter(m => !m.hidden).map(m => {
              const Icon = MODULE_ICONS[m.id as keyof typeof MODULE_ICONS] || LayoutDashboard;
              return { icon: Icon, label: m.name, module: m.id };
            }).map(({ icon: Icon, label, module }) => (
              <button
                key={label}
                onClick={() => navigateToModule(module)}
                title={label}
                style={{
                  color: '#fff',
                  opacity: pathname?.includes(`/${module}`) ? 1 : 0.7,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={24} />
              </button>
            ))}
            
            {/* Global Trash Bin */}
            <div style={{ marginTop: 'auto', marginBottom: 16 }}>
              <GlobalTrashBin 
          onItemTrashed={(item) => {
            // If a message was trashed, we need to reload messages in chat
            if (item.type === 'message') {
              // This will be handled by the chat context when it detects the change
            }
          }}
        />
            </div>
            
            {/* Manage Business Button */}
            <button
              onClick={handleManageBusiness}
              title="Manage Business"
              style={{
                color: '#fff',
                opacity: 0.7,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 8,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={24} />
            </button>
          </aside>
        </div>
      </div>
    </BusinessBrandingProvider>
  );
} 