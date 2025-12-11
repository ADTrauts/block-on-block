'use client';

import React, { useEffect, useState, useRef } from 'react';
import { LayoutDashboard, Home, Briefcase, GraduationCap, Users, Brain } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDashboard } from '../contexts/DashboardContext';
import { useGlobalBranding } from '../contexts/GlobalBrandingContext';
import { usePositionAwareModules } from './PositionAwareModuleProvider';
import AvatarContextMenu from './AvatarContextMenu';
import CompactSearchButton from './header/CompactSearchButton';
import AIChatDropdown from './header/AIChatDropdown';
import ClientOnlyWrapper from '../app/ClientOnlyWrapper';
import { useWorkAuth } from '../contexts/WorkAuthContext';
import { useThemeColors } from '../hooks/useThemeColors';
import { useBusinessConfiguration } from '../contexts/BusinessConfigurationContext';
import { getBusiness } from '../api/business';

// Helper: get dashboard icon
function getDashboardIcon(name: string, type?: string) {
  const lower = name.toLowerCase();
  if (type === 'household' || lower.includes('home')) return Home;
  if (type === 'business' || lower.includes('work') || lower.includes('business')) return Briefcase;
  if (type === 'educational' || lower.includes('school') || lower.includes('edu')) return GraduationCap;
  return LayoutDashboard;
}

export default function GlobalHeaderTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const { currentBranding, isBusinessContext, getHeaderStyles } = useGlobalBranding();
  const { getHeaderStyle } = useThemeColors();
  const { isWorkAuthenticated } = useWorkAuth();
  const { configuration } = useBusinessConfiguration();
  // Local override when on business workspace: fetch authoritative business branding
  const [businessHeader, setBusinessHeader] = useState<{ name?: string; logo?: string } | null>(null);

  useEffect(() => {
    const fetchBusinessBranding = async () => {
      try {
        if (!pathname || !session?.accessToken) return;
        const segments = pathname?.split('/').filter(Boolean) || [];
        if (segments[0] !== 'business' || !segments[1]) return;
        const businessId = segments[1];
        const res = await getBusiness(businessId, session.accessToken);
        if (res?.success && res.data) {
          setBusinessHeader({
            name: res.data.name,
            logo: res.data.branding?.logoUrl,
          });
        }
      } catch (e) {
        // Silent fallback to context branding
      }
    };
    if (pathname?.startsWith('/business/')) {
      fetchBusinessBranding();
    } else {
      setBusinessHeader(null);
    }
  }, [pathname, session?.accessToken]);

  const { 
    currentDashboard,
    currentDashboardId,
    allDashboards,
    loading,
    error,
    navigateToDashboard,
    getDashboardDisplayName,
    getDashboardType
  } = useDashboard();

  const [isMobile, setIsMobile] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showWorkTab, setShowWorkTab] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [aiDropdownPosition, setAIDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const tabsRef = useRef<HTMLDivElement>(null);
  const [isInScheduling, setIsInScheduling] = useState(false);
  const [schedulingContext, setSchedulingContext] = useState<{ businessId?: string; scheduleId?: string } | null>(null);

  useEffect(() => {
    setIsMobile(window.innerWidth < 700);
    setHydrated(true);
  }, []);

  // Detect if we're in scheduling module and listen for schedule selection
  useEffect(() => {
    if (pathname) {
      // Check for scheduling module in URL (workspace, admin, or direct scheduling paths)
      const isScheduling = pathname.includes('/workspace/scheduling') || 
                          pathname.includes('/admin/scheduling') ||
                          pathname.includes('/scheduling');
      setIsInScheduling(isScheduling);
      
      if (isScheduling) {
        // Extract businessId from URL
        const segments = pathname.split('/').filter(Boolean);
        const businessIndex = segments.indexOf('business');
        const businessId = businessIndex >= 0 && segments[businessIndex + 1] ? segments[businessIndex + 1] : undefined;
        
        setSchedulingContext(businessId ? { businessId } : null);
      } else {
        setSchedulingContext(null);
      }
    }
  }, [pathname]);

  // Listen for schedule selection events from scheduling components
  useEffect(() => {
    const handleScheduleSelected = (e: CustomEvent<{ scheduleId: string }>) => {
      if (isInScheduling && schedulingContext) {
        setSchedulingContext({
          ...schedulingContext,
          scheduleId: e.detail.scheduleId
        });
      }
    };

    window.addEventListener('scheduleSelected', handleScheduleSelected as EventListener);
    return () => {
      window.removeEventListener('scheduleSelected', handleScheduleSelected as EventListener);
    };
  }, [isInScheduling, schedulingContext]);

  // Personal dashboards ordering
  const personalDashboards = allDashboards.filter(
    d => ('businessId' in d ? (d as any).businessId == null : true) && ('institutionId' in d ? (d as any).institutionId == null : true)
  );

  const [orderedPersonalIds, setOrderedPersonalIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('dashboardTabOrder');
    let order: string[] = [];
    if (saved) {
      order = JSON.parse(saved);
    } else {
      order = personalDashboards.map(d => d.id);
    }
    order = order.filter(id => personalDashboards.some(d => d.id === id));
    personalDashboards.forEach(d => { if (!order.includes(d.id)) order.push(d.id); });
    if (order.length === 0 && personalDashboards.length > 0) {
      order = personalDashboards.map(d => d.id);
    }
    setOrderedPersonalIds(order);
    localStorage.setItem('dashboardTabOrder', JSON.stringify(order));
  }, [allDashboards.length]);

  const orderedPersonalDashboards = orderedPersonalIds
    .map(id => personalDashboards.find(d => d.id === id))
    .filter(Boolean) as typeof personalDashboards;

  const mainPersonalDashboard = orderedPersonalDashboards[0];
  const draggableDashboards = orderedPersonalDashboards.slice(1);

  const handleTabClick = (dashboardId: string) => {
    if (dashboardId === 'work') {
      setShowWorkTab(true);
    } else {
      setShowWorkTab(false);
      // If on business route, force navigation to personal dashboard page
      if (pathname?.startsWith('/business/')) {
        router.push(`/dashboard/${dashboardId}`);
        return;
      }
      navigateToDashboard(dashboardId);
    }
  };

  // Handle AI button click
  const handleAIClick = () => {
    if (tabsRef.current) {
      const rect = tabsRef.current.getBoundingClientRect();
      setAIDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: Math.max(20, (window.innerWidth - 700) / 2), // Center with min margin
        width: Math.min(700, window.innerWidth - 40)
      });
    }
    setIsAIOpen(!isAIOpen);
  };

  // Handle AI dropdown close
  const handleAIClose = () => {
    setIsAIOpen(false);
  };

  const isBusinessWorkspace = pathname?.startsWith('/business/');
  const workActive = isBusinessWorkspace || showWorkTab;

  if (loading || !mainPersonalDashboard) {
    return null;
  }

  // Detect business/workspace context and compute branding
  const effectiveBusiness = !!(isBusinessContext || isBusinessWorkspace);
  const overrideBg = isBusinessWorkspace && configuration?.branding?.secondaryColor 
    ? configuration.branding.secondaryColor 
    : (isBusinessContext ? getHeaderStyles().backgroundColor : undefined);

  const brandLogo = isBusinessWorkspace 
    ? (businessHeader?.logo || configuration?.branding?.logo || currentBranding?.logo)
    : (currentBranding?.logo);
  const brandName = isBusinessWorkspace 
    ? (businessHeader?.name || configuration?.name || currentBranding?.name)
    : (currentBranding?.name);

  return (
    <header style={{
      position: 'fixed',
      left: 0,
      top: 0,
      width: '100vw',
      height: 64,
      ...getHeaderStyle(effectiveBusiness, overrideBg),
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center',
      flexDirection: isMobile ? 'column' : 'row',
      padding: isMobile ? '0 12px' : '0 32px',
      flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '0 0 auto' }}>
        {effectiveBusiness && brandLogo ? (
          <img src={brandLogo} alt={`${brandName || 'Business'} logo`} style={{ height: 32, width: 'auto' }} />
        ) : (
          <div style={{ fontWeight: 800, fontSize: 22, color: getHeaderStyles().color }}>V</div>
        )}
        <h1 style={{ fontWeight: 600, fontSize: 18, color: isBusinessContext ? getHeaderStyles().color : '#fff' }}>
          {effectiveBusiness ? (brandName || 'Workspace') : 'Vssyl'}
        </h1>
      </div>
      <div style={{ flex: '1 1 auto', display: 'flex', justifyContent: 'center', marginTop: isMobile ? 8 : 0, overflow: 'hidden' }}>
        <nav ref={tabsRef} style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: '100%', overflow: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, flexWrap: 'nowrap' }}>
            {/* Main personal dashboard (not draggable) */}
            <button
              key={mainPersonalDashboard.id}
              onClick={() => handleTabClick(mainPersonalDashboard.id)}
              style={{
                background: !workActive && currentDashboardId === mainPersonalDashboard.id ? '#fff' : '#e5e7eb',
                color: !workActive && currentDashboardId === mainPersonalDashboard.id ? '#222' : '#666',
                border: '1px solid #ccc',
                borderBottom: 'none',
                borderRadius: '8px 0 0 0',
                padding: '8px 24px 10px 24px',
                marginLeft: 0,
                fontWeight: 700,
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
              }}
            >
              {getDashboardIcon(mainPersonalDashboard.name, getDashboardType(mainPersonalDashboard)) && React.createElement(getDashboardIcon(mainPersonalDashboard.name, getDashboardType(mainPersonalDashboard)), { size: 20, style: { marginRight: 4 } })}
              {getDashboardDisplayName(mainPersonalDashboard)}
            </button>
            {/* Non-draggable personal dashboards (to match appearance without DnD complexity) */}
            {draggableDashboards.map((dashboard) => (
              <button
                key={dashboard.id}
                onClick={() => handleTabClick(dashboard.id)}
                style={{
                  background: !workActive && currentDashboardId === dashboard.id ? '#fff' : '#e5e7eb',
                  color: !workActive && currentDashboardId === dashboard.id ? '#222' : '#666',
                  border: '1px solid #ccc',
                  borderBottom: 'none',
                  borderRadius: '0',
                  padding: '8px 24px 10px 24px',
                  marginLeft: -1,
                  fontWeight: 700,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  position: 'relative',
                }}
              >
                {getDashboardIcon(dashboard.name, getDashboardType(dashboard)) && React.createElement(getDashboardIcon(dashboard.name, getDashboardType(dashboard)), { size: 20, style: { marginRight: 4 } })}
                {getDashboardDisplayName(dashboard)}
              </button>
            ))}
            {/* Work Tab */}
            <button
              onClick={() => handleTabClick('work')}
              style={{
                background: workActive ? '#fff' : '#e5e7eb',
                color: workActive ? '#222' : '#666',
                border: '1px solid #ccc',
                borderBottom: 'none',
                borderRadius: allDashboards.length === 0 ? '8px 0 0 0' : '0 0 0 0',
                padding: '8px 24px 10px 24px',
                marginLeft: allDashboards.length === 0 ? 0 : -1,
                fontWeight: 700,
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
              }}
            >
              <Briefcase size={20} style={{ marginRight: 4 }} />
              Work
            </button>
            {/* '+/-' Edit Button (visual consistency) */}
            <button
              onClick={() => setEditMode((v) => !v)}
              style={{
                background: editMode ? '#fff' : '#e5e7eb',
                color: editMode ? '#222' : '#666',
                border: '1px solid #ccc',
                borderBottom: 'none',
                borderRadius: '0 8px 0 0',
                padding: '8px 24px 10px 24px',
                marginLeft: -1,
                fontWeight: 700,
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 700, marginRight: 4 }}>+/-</span>
            </button>
          </div>
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: isMobile ? 8 : 0, flex: '0 0 auto' }}>
        {/* Search Button */}
        <CompactSearchButton />
        
        {/* AI Button */}
        <button
          onClick={handleAIClick}
          className="flex items-center justify-center transition-all hover:bg-purple-100 relative"
          style={{
            background: isAIOpen ? '#8b5cf6' : 'transparent',
            color: isAIOpen ? '#fff' : '#8b5cf6',
            border: 'none',
            outline: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52,
            height: 52,
            borderRadius: '50%',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
          title="AI Assistant"
        >
          {/* Pulsing circle animation when in scheduling context */}
          {isInScheduling && !isAIOpen && (
            <>
              {/* Outer pulsing ring with expanding glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.6) 0%, rgba(139, 92, 246, 0.3) 50%, transparent 70%)',
                  animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  zIndex: 0,
                  borderRadius: '50%',
                }}
              />
              {/* Rotating color wave */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'conic-gradient(from 0deg, rgba(139, 92, 246, 0.4), rgba(168, 85, 247, 0.6), rgba(139, 92, 246, 0.4))',
                  backgroundSize: '200% 200%',
                  animation: 'color-wave 4s linear infinite',
                  zIndex: 0,
                  borderRadius: '50%',
                  opacity: 0.8,
                }}
              />
              {/* Glow effect on the button itself */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  animation: 'glow-pulse 2s ease-in-out infinite',
                  zIndex: 0,
                  borderRadius: '50%',
                }}
              />
            </>
          )}
          <Brain size={26} style={{ position: 'relative', zIndex: 1 }} />
        </button>
        
        {/* Avatar */}
        <ClientOnlyWrapper>
          <AvatarContextMenu />
        </ClientOnlyWrapper>
      </div>

      {/* AI Chat Dropdown */}
      <AIChatDropdown
        isOpen={isAIOpen}
        onClose={handleAIClose}
        position={aiDropdownPosition}
        dashboardId={currentDashboardId || undefined}
        dashboardType={currentDashboard ? getDashboardType(currentDashboard) : 'personal'}
        dashboardName={currentDashboard ? getDashboardDisplayName(currentDashboard) : 'Dashboard'}
        moduleContext={isInScheduling ? {
          module: 'scheduling',
          businessId: schedulingContext?.businessId,
          scheduleId: schedulingContext?.scheduleId,
        } : undefined}
      />
    </header>
  );
}


