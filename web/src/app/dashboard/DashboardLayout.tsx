'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Folder, MessageSquare, Shield, Home, Briefcase, GraduationCap, Plus, Settings, Users, BarChart3, Lock, Puzzle, Brain, Calendar as CalendarIcon } from 'lucide-react';
import GlobalTrashBin from '../../components/GlobalTrashBin';
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from 'next/navigation';
import { COLORS, getBrandColor, semanticColors } from 'shared/utils/brandColors';
import ClientOnlyWrapper from '../ClientOnlyWrapper';
import { createDashboard } from '../../api/dashboard';
import { useDashboard } from '../../contexts/DashboardContext';
import { useGlobalBranding } from '../../contexts/GlobalBrandingContext';
import { useGlobalSearch } from '../../contexts/GlobalSearchContext';
import { useGlobalTrash } from '../../contexts/GlobalTrashContext';
import { useWorkAuth } from '../../contexts/WorkAuthContext';
import { BusinessConfigurationProvider } from '../../contexts/BusinessConfigurationContext';
import WorkTab from '../../components/WorkTab';
import { ModuleConfig } from '../../config/modules';
import { PositionAwareModuleProvider, usePositionAwareModules } from '../../components/PositionAwareModuleProvider';
import { toast } from 'react-hot-toast';
import { useDashboardDeletion } from '../../hooks/useDashboardDeletion';
import DashboardDeletionModal from '../../components/DashboardDeletionModal';
import AvatarContextMenu from '../../components/AvatarContextMenu';
import CompactSearchButton from '../../components/header/CompactSearchButton';
import AIChatDropdown from '../../components/header/AIChatDropdown';
import { Modal, DraggableWrapper } from 'shared/components';
import { useThemeColors } from '../../hooks/useThemeColors';
import { DragEndEvent } from '@dnd-kit/core';

// Add CSS styles for enhanced drag and drop UX
const dragStyles = `
  .sortable-item {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center;
  }
  
  .sortable-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .sortable-item.dragging {
    transform: scale(1.05) rotate(2deg);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
    z-index: 1000;
  }
  
  .drag-overlay {
    transform: scale(1.05) rotate(2deg);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
    opacity: 0.9;
    pointer-events: none;
  }
  
  .sortable-container {
    transition: all 0.2s ease;
  }
  
  .dashboard-tab {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  
  .dashboard-tab::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.6s ease;
  }
  
  .dashboard-tab:hover::before {
    transform: translateX(100%);
  }
  
  .dashboard-tab.dragging {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important;
    border-color: #3b82f6 !important;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  
  .delete-button {
    transition: all 0.2s ease;
    opacity: 0.7;
  }
  
  .delete-button:hover {
    opacity: 1;
    transform: scale(1.1);
    color: #dc2626 !important;
  }
`;

// Module icons mapping
const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  drive: Folder,
  chat: MessageSquare,
  members: Users,
  analytics: BarChart3,
  connections: Users,
  ai: Brain,
  calendar: CalendarIcon,
};

// Helper function to get sidebar key
function getSidebarKey(pathname: string | null) {
  const module = pathname?.split('/')[1] || 'dashboard';
  return `sidebarCollapsed:/${module}`;
}

// Helper function to get dashboard icon
function getDashboardIcon(name: string, type?: string) {
  const lower = name.toLowerCase();
  if (type === 'household' || lower.includes('home')) return Home;
  if (type === 'business' || lower.includes('work') || lower.includes('business')) return Briefcase;
  if (type === 'educational' || lower.includes('school') || lower.includes('edu')) return GraduationCap;
  return LayoutDashboard;
}

// Interface for work tab modules (simplified version)
interface WorkTabModule {
  id: string;
  name: string;
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [selectedTabType, setSelectedTabType] = useState<'blank' | 'home'>('blank');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [aiDropdownPosition, setAIDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const aiButtonRef = useRef<HTMLButtonElement>(null);
  
  // Member invitation state for household creation
  const [inviteMembers, setInviteMembers] = useState<Array<{email: string, role: string, relation: string}>>([]);
  const [showMemberInvite, setShowMemberInvite] = useState(false);
  
  // Post-creation member invitation modal
  const [showPostCreationInvite, setShowPostCreationInvite] = useState(false);
  const [createdHouseholdId, setCreatedHouseholdId] = useState<string | null>(null);
  const [createdHouseholdName, setCreatedHouseholdName] = useState<string>('');
  const { data: session } = useSession();
  const { trashItem } = useGlobalTrash();
  
  // Dashboard deletion hook
  const {
    isModalOpen: isDeletionModalOpen,
    selectedDashboard,
    fileSummary,
    isLoadingSummary,
    error: deletionError,
    openDeletionModal,
    closeDeletionModal,
    confirmDeletion,
  } = useDashboardDeletion();
  
  // Inject CSS styles for drag and drop UX
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = dragStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const {
    currentDashboard,
    currentDashboardId,
    allDashboards,
    loading,
    error,
    navigateToDashboard,
    navigateToModule,
    getDashboardDisplayName,
    getDashboardType
  } = useDashboard();

  const { currentBranding, isBusinessContext, getHeaderStyles, getSidebarStyles } = useGlobalBranding();
  const { isWorkAuthenticated, currentBusinessId } = useWorkAuth();
  const { getFilteredModules, hasModuleAccess, getModuleAccessReason } = usePositionAwareModules();
  const { getHeaderStyle, getBrandColor } = useThemeColors();

  const [showWorkTab, setShowWorkTab] = useState(false);

  // Determine if sidebar should be shown
  // Hide sidebars on Work tab (both pre- and post-auth) so BrandedWorkDashboard is full-width
  const shouldShowSidebar = !showWorkTab;

  // Get available modules using position-aware filtering
  const getAvailableModules = (): ModuleConfig[] => {
    return getFilteredModules();
  };

  useEffect(() => {
    setModules(getAvailableModules());
    setIsMobile(window.innerWidth < 700);
    setHydrated(true);
  }, [currentDashboard, getDashboardType]);

  useEffect(() => {
    if (!hydrated || !pathname) return;
    const key = getSidebarKey(pathname);
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      setSidebarCollapsed(stored === 'true');
    } else {
      setSidebarCollapsed(!pathname?.startsWith('/dashboard'));
    }
  }, [pathname, hydrated]);

  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile]);

  const handleTabClick = (dashboardId: string) => {
    if (dashboardId === 'work') {
      setShowWorkTab(true);
    } else {
      setShowWorkTab(false);
    navigateToDashboard(dashboardId);
    }
  };

  const handleCreateDashboard = async (name?: string, tabType?: 'blank' | 'home') => {
    if (!session?.accessToken) return;
    try {
      if (tabType === 'home') {
        // Create household first, then create dashboard linked to it
        const householdResponse = await fetch('/api/household', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name || 'My Home',
            description: 'Family household',
            type: 'PRIMARY',
            isPrimary: true
          })
        });

        if (!householdResponse.ok) {
          const errorData = await householdResponse.json();
          throw new Error(errorData.error || 'Failed to create household');
        }

        const { household } = await householdResponse.json();

        // Create dashboard linked to household
        const newDashboard = await createDashboard(session.accessToken, {
          name: `${household.name} Dashboard`,
          householdId: household.id
        });
        
        // Store household info for post-creation member invitation
        setCreatedHouseholdId(household.id);
        setCreatedHouseholdName(household.name);
        
        // Show member invitation modal after creation
        setShowPostCreationInvite(true);
        
        navigateToDashboard(newDashboard.id);
      } else {
        // For regular dashboards, create directly and show build out modal
        const newDashboard = await createDashboard(session.accessToken, {
          name: name || `New Dashboard ${allDashboards.length + 1}`
        });
        
        // Navigate to the new dashboard which will show the build out modal
        router.push(`/dashboard/${newDashboard.id}`);
        return;
      }
      // Note: Do not force a full reload here; it would close the invitation modal.
      // The dashboard list will update on next render, and we navigate after creation.
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create dashboard');
    }
  };

  const handleManageBusiness = () => {
    if (currentDashboard && 'business' in currentDashboard && currentDashboard.business) {
      router.push(`/business/${currentDashboard.business.id}/profile`);
    }
  };

  const handleSwitchToWork = (businessId: string) => {
    router.push(`/business/${businessId}/workspace`);
  };

  // Handle AI button click
  const handleAIClick = () => {
    if (aiButtonRef.current) {
      const rect = aiButtonRef.current.getBoundingClientRect();
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

  const handleDeleteDashboard = async (dashboardId: string) => {
    try {
      const response = await fetch(`/api/dashboard/${dashboardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // If the deleted dashboard was the current one, switch to the first dashboard
        if (currentDashboardId === dashboardId) {
          const remainingDashboards = allDashboards.filter(d => d.id !== dashboardId);
          if (remainingDashboards.length > 0) {
            handleTabClick(remainingDashboards[0].id);
          }
        }
        
        // Reload the page to refresh dashboard data
        window.location.reload();
      } else {
        console.error('Failed to delete dashboard');
      }
    } catch (error) {
      console.error('Error deleting dashboard:', error);
    }
  };

  // Handle dashboard deletion confirmation
  const handleDashboardDeletionConfirm = async (fileAction: any) => {
    try {
      await confirmDeletion(fileAction);
      
      // If the deleted dashboard was the current one, navigate to the main dashboard
      if (selectedDashboard && currentDashboardId === selectedDashboard.id) {
        const remainingDashboards = allDashboards.filter(d => d.id !== selectedDashboard.id);
        if (remainingDashboards.length > 0) {
          // Navigate to the first remaining dashboard
          router.push(`/dashboard/${remainingDashboards[0].id}`);
        } else {
          // No dashboards left, go to dashboard creation
          router.push('/dashboard');
        }
      }
      
      // Show success message
      toast.success(`${selectedDashboard?.name || 'Dashboard'} deleted successfully`);
      
      // Close the modal
      closeDeletionModal();
      
      // Force a refresh of dashboard data without full page reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      toast.error('Failed to delete dashboard');
    }
  };

  // Business modules for Work tab - now handled by BusinessConfigurationContext
  // const WORK_TAB_MODULES: ModuleConfig[] = [ ... ]; // Removed - use context instead

  // Helper: get draggable personal dashboards (excluding first/main)
  const [orderedPersonalIds, setOrderedPersonalIds] = useState<string[]>([]);
  // Correctly filter personal dashboards (not business or educational)
  const personalDashboards = allDashboards.filter(
    d => ('businessId' in d ? (d as any).businessId == null : true) && ('institutionId' in d ? (d as any).institutionId == null : true)
  );

  // Reconcile localStorage order with actual dashboards
  useEffect(() => {
    const saved = localStorage.getItem('dashboardTabOrder');
    let order: string[] = [];
    if (saved) {
      order = JSON.parse(saved);
    } else {
      order = personalDashboards.map(d => d.id);
    }
    // Remove IDs that no longer exist
    order = order.filter(id => personalDashboards.some(d => d.id === id));
    // Add new dashboards to the end
    personalDashboards.forEach(d => {
      if (!order.includes(d.id)) order.push(d.id);
    });
    // If order is empty but dashboards exist, reset
    if (order.length === 0 && personalDashboards.length > 0) {
      order = personalDashboards.map(d => d.id);
    }
    setOrderedPersonalIds(order);
    localStorage.setItem('dashboardTabOrder', JSON.stringify(order));
  }, [allDashboards.length]);

  // Apply order to personal dashboards
  const orderedPersonalDashboards = orderedPersonalIds
    .map(id => personalDashboards.find(d => d.id === id))
    .filter(Boolean) as typeof personalDashboards;

  // If order is out of sync, reset
  useEffect(() => {
    if (personalDashboards.length > 0 && orderedPersonalDashboards.length === 0) {
      const order = personalDashboards.map(d => d.id);
      setOrderedPersonalIds(order);
      localStorage.setItem('dashboardTabOrder', JSON.stringify(order));
    }
  }, [personalDashboards.length, orderedPersonalDashboards.length]);

  const mainPersonalDashboard = orderedPersonalDashboards[0];
  const draggableDashboards = orderedPersonalDashboards.slice(1);

  // Remove debug logs and restore guard clause
  // if (!mainPersonalDashboard) return null;
  if (!mainPersonalDashboard) return null;

  // Handler for drag end
  const handleTabDragEnd = (result: DragEndEvent) => {
    if (!result.over) {
      return;
    }
    
    // Check if dropping on global trash bin
    if (result.over.id === 'global-trash-bin') {
      const dashboard = draggableDashboards.find(d => d.id === result.active.id);
      if (dashboard) {
        handleTrashDashboard(dashboard);
      }
      return;
    }
    
    const oldIndex = draggableDashboards.findIndex(d => d.id === result.active.id);
    const newIndex = draggableDashboards.findIndex(d => d.id === result.over?.id);
    
    if (oldIndex !== newIndex) {
      const reordered = Array.from(draggableDashboards);
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);
      // Save new order to localStorage (main + reordered)
      const newIds = [mainPersonalDashboard.id, ...reordered.map(d => d.id)];
      setOrderedPersonalIds(newIds);
      localStorage.setItem('dashboardTabOrder', JSON.stringify(newIds));
    }
  };

  // Handle trashing a dashboard
  const handleTrashDashboard = async (dashboard: any) => {
    try {
      await trashItem({
        id: dashboard.id,
        name: dashboard.name,
        type: 'dashboard_tab',
        moduleId: 'dashboard',
        moduleName: 'Dashboard',
        metadata: {
          createdAt: dashboard.createdAt,
        },
      });
      
      // Remove dashboard from local state
      const newIds = orderedPersonalIds.filter(id => id !== dashboard.id);
      setOrderedPersonalIds(newIds);
      localStorage.setItem('dashboardTabOrder', JSON.stringify(newIds));
      
      // If this was the current dashboard, redirect to main dashboard
      if (currentDashboardId === dashboard.id) {
        router.push(`/dashboard/${mainPersonalDashboard.id}`);
      }
      
      toast.success(`${dashboard.name} moved to trash`);
    } catch (error) {
      console.error('Failed to trash dashboard:', error);
      toast.error('Failed to move dashboard to trash');
    }
  };

  // Show loading state while dashboards are being fetched
  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: getBrandColor('neutralLight'),
        color: getBrandColor('neutralDark')
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Loading dashboards...</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Please wait while we load your workspace</div>
        </div>
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: getBrandColor('neutralLight'),
        color: getBrandColor('neutralDark')
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px', color: '#ef4444' }}>Error</div>
          <div style={{ fontSize: '14px', color: '#666' }}>{error}</div>
        </div>
      </div>
    );
  }

  // If no dashboards exist after loading, show empty state
  if (!mainPersonalDashboard) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: getBrandColor('neutralLight'),
        color: getBrandColor('neutralDark')
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>No dashboards found</div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>Create your first dashboard to get started</div>
          <button
            onClick={() => handleCreateDashboard()}
            style={{
              background: getBrandColor('highlightYellow'),
              color: '#000',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Create Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      {/* Full-width header */}
      <header style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: 64,
        ...getHeaderStyle(isBusinessContext, isBusinessContext ? getHeaderStyles().backgroundColor : undefined),
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        padding: isMobile ? '0 12px' : '0 32px',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '0 0 auto' }}>
          {isBusinessContext && currentBranding?.logo ? (
            <img 
              src={currentBranding.logo} 
              alt={`${currentBranding.name} logo`}
              style={{ height: 32, width: 'auto' }}
            />
          ) : (
            <div style={{ fontWeight: 800, fontSize: 22, color: getBrandColor('highlightYellow') }}>B</div>
          )}
          <h1 style={{ 
            fontWeight: 600, 
            fontSize: 18, 
            color: isBusinessContext ? getHeaderStyles().color : '#fff' 
          }}>
            {isBusinessContext ? currentBranding?.name : 'Vssyl'}
          </h1>
        </div>
        <div style={{ flex: '1 1 auto', display: 'flex', justifyContent: 'center', marginTop: isMobile ? 8 : 0, overflow: 'hidden' }}>
          {/* Search functionality moved to GlobalHeaderTabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: '100%', overflow: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, flexWrap: 'nowrap' }}>
              {/* Main personal dashboard (not draggable) */}
              <button
                key={mainPersonalDashboard.id}
                onClick={() => handleTabClick(mainPersonalDashboard.id)}
                style={{
                  background: currentDashboardId === mainPersonalDashboard.id ? '#fff' : '#e5e7eb',
                  color: currentDashboardId === mainPersonalDashboard.id ? '#222' : '#666',
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
              {/* Draggable personal dashboards */}
              {editMode ? (
                <DraggableWrapper
                  items={draggableDashboards}
                  onDragEnd={handleTabDragEnd}
                  onDragStart={(result) => {}}
                  renderItem={(dashboard, idx, isDragging) => (
                    <button
                      key={dashboard.id}
                      onClick={() => handleTabClick(dashboard.id)}
                      className={`dashboard-tab ${isDragging ? 'dragging' : ''}`}
                      style={{
                        background: currentDashboardId === dashboard.id ? '#fff' : '#e5e7eb',
                        color: currentDashboardId === dashboard.id ? '#222' : '#666',
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
                        cursor: 'grab',
                      }}
                    >
                      {getDashboardIcon(dashboard.name, getDashboardType(dashboard)) && React.createElement(getDashboardIcon(dashboard.name, getDashboardType(dashboard)), { size: 20, style: { marginRight: 4 } })}
                      {getDashboardDisplayName(dashboard)}
                      {/* Drag handle indicator */}
                      {editMode && (
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            background: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)',
                            backgroundSize: '4px 4px',
                            backgroundPosition: '0 0, 2px 2px',
                            borderRadius: '2px',
                            marginLeft: 'auto',
                            opacity: 0.6,
                          }}
                          title="Drag to reorder"
                        />
                      )}
                      {/* Delete (X) button */}
                      {editMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeletionModal(dashboard);
                          }}
                          className="delete-button"
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            background: 'transparent',
                            border: 'none',
                            color: '#c00',
                            fontWeight: 'bold',
                            fontSize: 18,
                            cursor: 'pointer',
                            padding: 0,
                            marginLeft: 0,
                          }}
                          title="Delete dashboard"
                        >
                          ×
                        </button>
                      )}
                    </button>
                  )}
                />
              ) : (
                draggableDashboards.map((dashboard, idx) => (
                  <button
                    key={dashboard.id}
                    onClick={() => handleTabClick(dashboard.id)}
                    style={{
                      background: currentDashboardId === dashboard.id ? '#fff' : '#e5e7eb',
                      color: currentDashboardId === dashboard.id ? '#222' : '#666',
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
                ))
              )}
              {/* Work Tab, Add Tab, +/- Button as before */}
              <button
                onClick={() => handleTabClick('work')}
                style={{
                  background: showWorkTab ? '#fff' : '#e5e7eb',
                  color: showWorkTab ? '#222' : '#666',
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
              {/* Edit Mode: Add Tab (greyed out) */}
              {editMode && (
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    background: '#f3f4f6',
                    color: '#888',
                    border: '1px dashed #ccc',
                    borderBottom: 'none',
                    borderRadius: '0',
                    padding: '8px 24px 10px 24px',
                    marginLeft: -1,
                    fontWeight: 700,
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 700, marginRight: 4 }}>+</span>
                  New Tab
                </button>
              )}
              {/* '+/-' Edit Button */}
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
            ref={aiButtonRef}
            onClick={handleAIClick}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-purple-100"
            style={{
              background: isAIOpen ? '#8b5cf6' : 'transparent',
              color: isAIOpen ? '#fff' : '#8b5cf6',
              border: '2px solid #8b5cf6',
              outline: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: '50%',
              transition: 'all 0.2s ease',
              fontWeight: '600',
              fontSize: '12px',
            }}
            title="AI Assistant"
          >
            AI
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
        />
      </header>
      {/* Main content area below header */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'absolute', top: 64, left: 0, right: 0, bottom: 0 }}>
        <aside style={{
          width: shouldShowSidebar ? (sidebarCollapsed ? 0 : 240) : 0,
          background: (showWorkTab || isBusinessContext) ? getSidebarStyles().backgroundColor : getBrandColor('neutralMid'),
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
              left: shouldShowSidebar ? (sidebarCollapsed ? 0 : 228) : -100,
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
            visibility: (shouldShowSidebar && !sidebarCollapsed) ? 'visible' : 'hidden', 
            opacity: (shouldShowSidebar && !sidebarCollapsed) ? 1 : 0, 
            transition: 'opacity 0.2s, visibility 0.2s' 
          }}>
            {!customizing && (
              <nav>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {showWorkTab && isWorkAuthenticated ? (
                    // Show business-specific modules when work is authenticated
                    // Modules are now handled by BusinessConfigurationContext
                    <li style={{ marginBottom: 8 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'transparent',
                        color: getSidebarStyles().color,
                        gap: 12,
                        width: '100%',
                        textAlign: 'left',
                      }}>
                        <Briefcase size={22} />
                        <span>Work Dashboard</span>
                      </div>
                    </li>
                  ) : showWorkTab && !isWorkAuthenticated ? (
                    // Show no modules when selecting business
                    null
                  ) : (
                    // Show personal modules
                    modules.map(m => {
                      const Icon = (MODULE_ICONS as Record<string, typeof LayoutDashboard>)[m.id] || LayoutDashboard;
                      const isActive = pathname?.startsWith(`/${m.id}`);
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
                              color: (showWorkTab || isBusinessContext) ? getSidebarStyles().color : '#fff',
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
                    })
                  )}
                </ul>
              </nav>
            )}
            <div style={{ marginTop: 'auto' }}>
              <button onClick={() => setCustomizing(true)} style={{ width: '100%', background: 'none', border: '1px solid #555', color: (showWorkTab || isBusinessContext) ? getSidebarStyles().color : '#fff', padding: '8px 0', borderRadius: 6, fontWeight: 600 }}>
                Customize
              </button>
            </div>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200" style={{ 
          padding: 0, 
          paddingRight: shouldShowSidebar ? 40 : 0,
          marginLeft: 0,
          transition: 'margin-left 0.2s ease-in-out, padding-right 0.2s ease-in-out',
        }}>
          {showWorkTab ? (
            <BusinessConfigurationProvider>
              <WorkTab onSwitchToWork={handleSwitchToWork} />
            </BusinessConfigurationProvider>
          ) : (
            children
          )}
        </main>
        <aside
          style={{
            width: shouldShowSidebar ? 40 : 0,
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
            zIndex: 2000,
            boxShadow: '0 0 8px rgba(0,0,0,0.04)',
            transition: 'width 0.2s ease-in-out',
            overflow: 'hidden',
          }}
        >
          {/* All main module icons */}
          {modules.map(module => {
            const Icon = (MODULE_ICONS as Record<string, typeof LayoutDashboard>)[module.id] || LayoutDashboard;
            const isActive = pathname?.startsWith(`/${module.id}`) ?? false;
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
          
          {/* Marketplace/Modules Icon */}
          {/* AI Assistant Button */}
          <button
            className={`flex items-center justify-center w-10 h-10 my-1 rounded-lg transition-colors ${pathname?.startsWith('/ai') ? 'bg-purple-600' : 'hover:bg-gray-700'} ${pathname?.startsWith('/ai') ? 'text-white' : 'text-gray-300'}`}
            style={{
              background: pathname?.startsWith('/ai') ? '#9333ea' : 'transparent',
              color: pathname?.startsWith('/ai') ? '#fff' : '#cbd5e1',
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
            onClick={() => router.push('/ai')}
            title="AI Assistant"
          >
            <Brain size={22} />
          </button>

          <button
            className={`flex items-center justify-center w-10 h-10 my-1 rounded-lg transition-colors ${pathname?.startsWith('/modules') ? 'bg-gray-800' : 'hover:bg-gray-700'} ${pathname?.startsWith('/modules') ? 'text-white' : 'text-gray-300'}`}
            style={{
              background: pathname?.startsWith('/modules') ? '#1f2937' : 'transparent',
              color: pathname?.startsWith('/modules') ? '#fff' : '#cbd5e1',
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
            <Puzzle size={22} />
          </button>
          
          {/* Global Trash Bin */}
          <div className="mt-auto mb-4">
            <GlobalTrashBin 
              onItemTrashed={(item) => {
                // If a message was trashed, we need to reload messages in chat
                if (item.type === 'message') {
                  // This will be handled by the chat context when it detects the change
                  // We could add a global event or context update here if needed
                }
              }}
            />
          </div>
        </aside>
      </div>
      {/* Modal for new dashboard */}
      {showAddModal && (
        <Modal open={showAddModal} onClose={() => {
          setShowAddModal(false);
          setNewDashboardName("");
          setSelectedTabType('blank');
        }}>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Create New Tab</h2>
            
            {/* Tab Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tab Type
              </label>
              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="tabType"
                    value="blank"
                    checked={selectedTabType === 'blank'}
                    onChange={(e) => setSelectedTabType('blank')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex items-center space-x-3">
                    <LayoutDashboard className="w-5 h-5 text-gray-600" />
                    <div>
                      <div className="font-medium text-gray-900">Blank Tab</div>
                      <div className="text-sm text-gray-500">Create a personal dashboard</div>
                    </div>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="tabType"
                    value="home"
                    checked={selectedTabType === 'home'}
                    onChange={(e) => setSelectedTabType('home')}
                    className="w-4 h-4 text-orange-600"
                  />
                  <div className="flex items-center space-x-3">
                    <Home className="w-5 h-5 text-orange-600" />
                    <div>
                      <div className="font-medium text-gray-900">Home Tab</div>
                      <div className="text-sm text-gray-500">Create a household management dashboard</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedTabType === 'home' ? 'Household Name' : 'Dashboard Name'}
              </label>
              <input
                name="dashboardName"
                value={newDashboardName}
                onChange={e => setNewDashboardName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={selectedTabType === 'home' ? 'My Family' : 'My Dashboard'}
              />
            </div>



            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setNewDashboardName("");
                  setSelectedTabType('blank');
                  setInviteMembers([]);
                  setShowMemberInvite(false);
                }} 
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newDashboardName.trim()) return;
                  await handleCreateDashboard(newDashboardName.trim(), selectedTabType);
                  setShowAddModal(false);
                  setNewDashboardName("");
                  setSelectedTabType('blank');
                  setInviteMembers([]);
                  setShowMemberInvite(false);
                }}
                className={`px-4 py-2 rounded-lg text-white transition-colors ${
                  selectedTabType === 'home' 
                    ? 'bg-orange-600 hover:bg-orange-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={!newDashboardName.trim()}
              >
                Create {selectedTabType === 'home' ? 'Home Tab' : 'Dashboard'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Post-Creation Member Invitation Modal */}
      {showPostCreationInvite && (
        <Modal open={showPostCreationInvite} onClose={() => {
          setShowPostCreationInvite(false);
          setInviteMembers([]);
          setCreatedHouseholdId(null);
          setCreatedHouseholdName('');
        }}>
          <div className="p-6 max-w-lg">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏠</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {createdHouseholdName} Created!
              </h2>
              <p className="text-gray-600">
                Would you like to invite family members to your household?
              </p>
            </div>

            {/* Member Invitation Section */}
            <div className="mb-6">
              <div className="space-y-3">
                {inviteMembers.map((member, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border">
                    <input
                      type="email"
                      placeholder="Email address"
                      value={member.email}
                      onChange={(e) => {
                        const updated = [...inviteMembers];
                        updated[index].email = e.target.value;
                        setInviteMembers(updated);
                      }}
                      className="flex-1 text-sm bg-white border border-gray-200 rounded px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <select
                      value={member.relation}
                      onChange={(e) => {
                        const updated = [...inviteMembers];
                        updated[index].relation = e.target.value;
                        setInviteMembers(updated);
                      }}
                      className="text-sm bg-white border border-gray-200 rounded px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Relation</option>
                      <option value="spouse">Spouse/Partner</option>
                      <option value="parent">Parent</option>
                      <option value="child">Child</option>
                      <option value="teen">Teenager</option>
                      <option value="sibling">Sibling</option>
                      <option value="grandparent">Grandparent</option>
                      <option value="other-family">Other Family</option>
                      <option value="roommate">Roommate</option>
                      <option value="guest">Guest</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = inviteMembers.filter((_, i) => i !== index);
                        setInviteMembers(updated);
                      }}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => {
                    setInviteMembers([...inviteMembers, { email: '', role: 'ADULT', relation: '' }]);
                  }}
                  className="w-full p-3 border-2 border-dashed border-orange-200 rounded-lg text-orange-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50 text-sm font-medium transition-colors"
                >
                  + Add Family Member
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowPostCreationInvite(false);
                  setInviteMembers([]);
                  setCreatedHouseholdId(null);
                  setCreatedHouseholdName('');
                }} 
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium"
              >
                Skip for Now
              </button>
              <button
                onClick={async () => {
                  if (!session?.accessToken || !createdHouseholdId) return;
                  
                  // Send invitations
                  if (inviteMembers.length > 0) {
                    const validMembers = inviteMembers.filter(member => member.email.trim() && member.relation);
                    
                    if (validMembers.length > 0) {
                      const invitePromises = validMembers.map(async (member) => {
                        // Map relation to role
                        const roleMap: { [key: string]: string } = {
                          'spouse': 'ADULT',
                          'parent': 'ADULT', 
                          'child': 'CHILD',
                          'teen': 'TEEN',
                          'sibling': 'ADULT',
                          'grandparent': 'ADULT',
                          'other-family': 'ADULT',
                          'roommate': 'ADULT',
                          'guest': 'TEMPORARY_GUEST'
                        };
                        
                        const role = roleMap[member.relation] || 'ADULT';
                        
                        try {
                          const inviteResponse = await fetch(`/api/household/${createdHouseholdId}/members`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${session.accessToken}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              email: member.email.trim(),
                              role: role,
                              ...(role === 'TEMPORARY_GUEST' ? { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } : {})
                            })
                          });

                          if (inviteResponse.ok) {
                            return { success: true, email: member.email, relation: member.relation };
                          } else {
                            const errorData = await inviteResponse.json();
                            return { success: false, email: member.email, error: errorData.error };
                          }
                        } catch (error) {
                          return { success: false, email: member.email, error: 'Network error' };
                        }
                      });

                      const inviteResults = await Promise.all(invitePromises);
                      const successCount = inviteResults.filter(r => r.success).length;
                      const failCount = inviteResults.filter(r => !r.success).length;
                      
                      if (successCount > 0) {
                        toast.success(`Invited ${successCount} member${successCount !== 1 ? 's' : ''} to your household!`);
                      }
                      if (failCount > 0) {
                        toast.error(`${failCount} invitation${failCount !== 1 ? 's' : ''} failed. You can try again later.`);
                      }
                    }
                  }
                  
                  // Close modal
                  setShowPostCreationInvite(false);
                  setInviteMembers([]);
                  setCreatedHouseholdId(null);
                  setCreatedHouseholdName('');
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors font-medium disabled:opacity-50"
                disabled={inviteMembers.filter(m => m.email.trim() && m.relation).length === 0}
              >
                Send Invitations
              </button>
            </div>

            <div className="text-xs text-gray-500 mt-4 text-center">
              💡 You can always invite more members later from your dashboard
            </div>
          </div>
        </Modal>
      )}

      {/* Dashboard Deletion Modal */}
      {selectedDashboard && (
        <DashboardDeletionModal
          isOpen={isDeletionModalOpen}
          onClose={closeDeletionModal}
          onConfirm={handleDashboardDeletionConfirm}
          dashboard={selectedDashboard}
          fileSummary={fileSummary}
          isLoading={isLoadingSummary}
        />
      )}

    </div>
  );
}

// Main export component that wraps with providers
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentBusinessId } = useWorkAuth();
  
  return (
    <BusinessConfigurationProvider businessId={currentBusinessId || undefined}>
      <PositionAwareModuleProvider>
        <DashboardLayoutInner>
          {children}
        </DashboardLayoutInner>
      </PositionAwareModuleProvider>
    </BusinessConfigurationProvider>
  );
}