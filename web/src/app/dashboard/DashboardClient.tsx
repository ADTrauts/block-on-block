"use client";
import React, { useEffect, useState } from 'react';
import { getDashboards, createDashboard, updateDashboardLayout, getDashboard } from '../../api/dashboard';
import { Dashboard } from 'shared/types';
import { createWidget, deleteWidget } from '../../api/widget';
import { Avatar, FilePreview, DraggableWrapper } from 'shared/components';
// import { BarChart } from 'shared/components';
import { DragEndEvent } from '@dnd-kit/core';
import { useHydration } from '../HydrationHandler';
import { useSession } from 'next-auth/react';
import { getConversations } from '../../api/chat';
import { getHousehold, getHouseholds, Household, getRoleDisplayName, getRoleColor } from '../../api/household';
import { Conversation } from 'shared/types/chat';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useGlobalTrash } from '../../contexts/GlobalTrashContext';
import { toast } from 'react-hot-toast';
import { useCallback } from 'react';
import ClassificationBadge from '../../components/ClassificationBadge';
import { getDataClassifications } from '../../api/retention';
import type { DataClassification } from '../../api/retention';
import ClassificationModal from '../../components/ClassificationModal';
import { Shield } from 'lucide-react';
import HouseholdMemberManager from '../../components/household/HouseholdMemberManager';
import DriveWidget from '../../components/widgets/DriveWidget';
import ChatWidget from '../../components/widgets/ChatWidget';
import CalendarWidget from '../../components/widgets/CalendarWidget';
import TodoWidget from '../../components/widgets/TodoWidget';
import DashboardBuildOutModal from '../../components/DashboardBuildOutModal';
import ModuleManagementModal from '../../components/ModuleManagementModal';
import { DashboardSkeleton } from '../../components/SkeletonComponents';

function SimpleChatWidget() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    setLoading(true);
    getConversations(session.accessToken)
      .then((res) => {
        if (res.success) setConversations(res.data.slice(0, 5));
        else setError('Failed to load conversations');
      })
      .catch(() => setError('Failed to load conversations'))
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  if (!session?.accessToken) return <div>Please sign in to view chat.</div>;
  if (loading) return <div>Loading chat...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (conversations.length === 0) return <div>No recent conversations.</div>;

  return (
    <div style={{ minWidth: 220 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Recent Conversations</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {conversations.map((c) => {
          const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
          const unread = c.messages ? c.messages.filter(m => !m.readReceipts?.some(r => r.userId === session.user?.id)).length : 0;
          return (
            <li key={c.id} style={{ marginBottom: 10, padding: 8, borderRadius: 6, background: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 500 }}>{c.name || 'Untitled Chat'}</span>
              <span style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
                {lastMsg ? `${lastMsg.sender?.name || 'Someone'}: ${lastMsg.content?.slice(0, 40)}` : 'No messages yet'}
              </span>
              {unread > 0 && <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 12, marginTop: 2 }}>{unread} unread</span>}
            </li>
          );
        })}
      </ul>
      <a href="/chat" style={{ display: 'inline-block', marginTop: 8, color: '#2563eb', fontWeight: 500, textDecoration: 'underline', fontSize: 14 }}>Open Chat</a>
    </div>
  );
}

function WidgetContent({ 
  type, 
  widget, 
  onRemoveWidget, 
  currentDashboard 
}: { 
  type: string; 
  widget: any; 
  onRemoveWidget: (id: string) => void; 
  currentDashboard: any;
}) {
  // Extract dashboard context
  const getDashboardType = (dashboard: any): 'personal' | 'business' | 'educational' | 'household' => {
    if (dashboard?.business) return 'business';
    if (dashboard?.institution) return 'educational';
    if (dashboard?.household) return 'household';
    return 'personal';
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getDashboardDisplayName = (dashboard: any): string => {
    if (dashboard?.business) return dashboard.business.name || dashboard.name;
    if (dashboard?.institution) return dashboard.institution.name || dashboard.name;
    if (dashboard?.household) return dashboard.household.name || dashboard.name;
    return dashboard?.name || 'My Dashboard';
  };

  const dashboardContext = currentDashboard ? {
    dashboardId: currentDashboard.id,
    dashboardType: getDashboardType(currentDashboard),
    dashboardName: getDashboardDisplayName(currentDashboard)
  } : {
    dashboardId: 'personal',
    dashboardType: 'personal' as const,
    dashboardName: 'My Dashboard'
  };
  if (type === 'chat') {
    return (
      <ChatWidget
        id={widget.id}
        config={widget.config}
        onConfigChange={(config) => {
          // TODO: Implement widget config update
        }}
        onRemove={() => onRemoveWidget(widget.id)}
        {...dashboardContext}
      />
    );
  }
  if (type === 'drive') {
    return (
      <DriveWidget
        id={widget.id}
        config={widget.config}
        onConfigChange={(config) => {
          // TODO: Implement widget config update
        }}
        onRemove={() => onRemoveWidget(widget.id)}
        {...dashboardContext}
      />
    );
  }
  if (type === 'calendar') {
    return (
      <CalendarWidget
        id={widget.id}
        config={widget.config}
        onConfigChange={(config) => {
          // TODO: Implement widget config update
        }}
        onRemove={() => onRemoveWidget(widget.id)}
        {...dashboardContext}
      />
    );
  }
  if (type === 'todo') {
    return (
      <TodoWidget
        id={widget.id}
        config={widget.config}
        onConfigChange={(config) => {
          // TODO: Implement widget config update
        }}
        onRemove={() => onRemoveWidget(widget.id)}
        {...dashboardContext}
      />
    );
  }
  return <span>Unknown widget type</span>;
}

// Widget with classification support
function WidgetWithClassification({
  widget, 
  onRemoveWidget, 
  widgetLoading, 
  accessToken,
  currentDashboard
}: { 
  widget: any; 
  onRemoveWidget: (id: string) => void; 
  widgetLoading: boolean;
  accessToken: string;
  currentDashboard?: any;
}) {
  const [classification, setClassification] = useState<DataClassification | null>(null);
  const [loadingClassification, setLoadingClassification] = useState(false);
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  // Load classification for this widget
  useEffect(() => {
    const loadClassification = async () => {
      if (!accessToken) return;
      
      try {
        setLoadingClassification(true);
        const response = await getDataClassifications(accessToken, {
          resourceType: 'widget'
        });
        // Find classification for this specific widget
        const widgetClassification = response.data.classifications.find(c => c.resourceId === widget.id);
        if (widgetClassification) {
          setClassification(widgetClassification);
        }
      } catch (err) {
        // Error loading widget classification - non-critical, silent fail
      } finally {
        setLoadingClassification(false);
      }
    };

    loadClassification();
  }, [widget.id, accessToken]);

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
        minHeight: 100,
        position: 'relative',
        background: '#fafafa',
      }}
      onContextMenu={handleContextMenu}
    >
      <strong>{widget.type.charAt(0).toUpperCase() + widget.type.slice(1)} Widget</strong>
      
      {/* Classification Badge */}
      {classification && (
        <div style={{ marginTop: 8 }}>
          <ClassificationBadge
            sensitivity={classification.sensitivity}
            expiresAt={classification.expiresAt}
            showExpiration={true}
            size="sm"
          />
        </div>
      )}
      
      <button
        onClick={() => onRemoveWidget(widget.id)}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'transparent',
          border: 'none',
          color: '#c00',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
        disabled={widgetLoading}
        title="Remove Widget"
      >
        ×
      </button>
      <div style={{ marginTop: 8, color: '#888' }}>
        {WidgetContent({ type: widget.type, widget, onRemoveWidget, currentDashboard })}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div 
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ 
            left: contextMenuPosition.x, 
            top: contextMenuPosition.y,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <button
            onClick={() => {
              setShowClassificationModal(true);
              setShowContextMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2"
          >
            <Shield className="w-4 h-4" />
            <span>Classify Widget</span>
          </button>
        </div>
      )}

      {/* Classification Modal */}
      <ClassificationModal
        isOpen={showClassificationModal}
        onClose={() => setShowClassificationModal(false)}
        resourceType="widget"
        resourceId={widget.id}
        content={`${widget.type} widget`}
        currentClassification={classification || undefined}
        onClassify={(newClassification) => {
          setClassification(newClassification);
          setShowClassificationModal(false);
        }}
      />
    </div>
  );
}

const draggingStyle = {
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  background: '#e0e7ff',
  opacity: 0.85,
  transition: 'box-shadow 0.2s, background 0.2s, opacity 0.2s',
};

interface DashboardClientProps {
  dashboardId?: string | null;
}

interface DashboardContentProps {
  dashboards: Dashboard[];
  currentDashboard: Dashboard | null;
  onDashboardSelect: (id: string) => void;
  onCreateDashboard: () => void;
  onAddWidget: (type: string) => void;
  onRemoveWidget: (widgetId: string) => void;
  onWidgetDragEnd: (result: DragEndEvent) => void;
  widgetLoading: boolean;
  widgetError: string | null;
  onShowModuleManagement: () => void;
}

function DashboardContent({
  dashboards,
  currentDashboard,
  onDashboardSelect,
  onCreateDashboard,
  onAddWidget,
  onRemoveWidget,
  onWidgetDragEnd,
  widgetLoading,
  widgetError,
  onShowModuleManagement,
  router
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}: DashboardContentProps & { router: any }) {
  const { isHydrated } = useHydration();
  const { data: session } = useSession();
  const [isMobile, setIsMobile] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  
  // Check if current dashboard is a household dashboard
  // For now, we'll detect household dashboards by name patterns
  // In the future, this should be based on dashboard.householdId property
  const isHouseholdDashboard = (dashboard: Dashboard | null): boolean => {
    if (!dashboard) return false;
    const name = dashboard.name.toLowerCase();
    return name.includes('home') || name.includes('household') || name.includes('family');
  };

  // Get household ID from dashboard
  const getHouseholdId = (dashboard: Dashboard | null): string | undefined => {
    if (!dashboard) return undefined;
    // Check if dashboard has householdId property (proper way)
    if ((dashboard as any).householdId) {
      return (dashboard as any).householdId;
    }
    return undefined;
  };

  // Load household data when viewing a household dashboard
  useEffect(() => {
    const loadHousehold = async () => {
      if (!session?.accessToken || !currentDashboard) return;
      if (!isHouseholdDashboard(currentDashboard)) {
        setHousehold(null);
        setHouseholdError(null);
        return;
      }
      try {
        setHouseholdLoading(true);
        setHouseholdError(null);
        const hId = getHouseholdId(currentDashboard);
        if (hId) {
          const h = await getHousehold(session.accessToken, hId);
          setHousehold(h);
        } else {
          // Fallback: use user's primary household or first household
          const households = await getHouseholds(session.accessToken);
          const primary = households.find(h => h.isPrimary) || households[0] || null;
          setHousehold(primary);
        }
      } catch (e) {
        setHouseholdError(e instanceof Error ? e.message : 'Failed to load household');
      } finally {
        setHouseholdLoading(false);
      }
    };

    loadHousehold();
  }, [session?.accessToken, currentDashboard]);

  useEffect(() => {
    setIsMobile(window.innerWidth < 700);
    const handleResize = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isHydrated) {
    return <DashboardSkeleton />;
  }

  if (!session?.accessToken) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>Authentication Required</h2>
        <p>Please sign in to view dashboards.</p>
        <button onClick={() => router.push('/auth/login')} style={{ marginTop: 16, padding: '8px 16px' }}>
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <h1>Dashboards</h1>
      {currentDashboard ? (
        <div>
          <h2>{currentDashboard.name}</h2>
          <p>Widgets: {currentDashboard.widgets.length}</p>
          
          {/* Household Members Bar */}
          {isHouseholdDashboard(currentDashboard) && (
            <div style={{ margin: '16px 0', padding: '20px', border: '1px solid #fed7aa', borderRadius: '12px', backgroundColor: '#fff7ed' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    backgroundColor: '#ea580c', 
                    borderRadius: '10px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}>
                    🏠
                  </div>
                  <div>
                    <h3 style={{ margin: '0', color: '#ea580c', fontSize: '18px', fontWeight: '600' }}>
                      {household ? household.name : currentDashboard.name} Members
                    </h3>
                    <p style={{ margin: '0', color: '#c2410c', fontSize: '13px' }}>
                      Manage your household members and their roles
                    </p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      router.push(`/household/manage?dashboard=${currentDashboard.id}`);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'white',
                      color: '#ea580c',
                      border: '1px solid #ea580c',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    + Add Member
                  </button>
                  <button
                    onClick={() => router.push(`/household/manage?dashboard=${currentDashboard.id}`)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ea580c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Manage All
                  </button>
                </div>
              </div>
              {/* Household Members */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px', borderTop: '1px solid #fed7aa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: '500' }}>Family Members:</span>
                  {householdLoading && (
                    <span style={{ fontSize: '12px', color: '#c2410c' }}>Loading...</span>
                  )}
                  {householdError && (
                    <span style={{ fontSize: '12px', color: '#b91c1c' }}>{householdError}</span>
                  )}
                  {household && household.members && household.members.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {household.members.slice(0, 8).map((m) => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 12, background: '#ffedd5', border: '1px solid #fed7aa' }} title={m.user.email}>
                          <div style={{ 
                            width: 24, height: 24, borderRadius: '50%',
                            background: '#ea580c', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700
                          }}>
                            {(m.user.name || m.user.email).slice(0,1).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 12, color: '#7c2d12', fontWeight: 600 }}>{m.user.name || m.user.email.split('@')[0]}</span>
                          <span style={{ fontSize: 11, color: '#9a3412', opacity: 0.9 }}>• {getRoleDisplayName(m.role)}</span>
                        </div>
                      ))}
                      {household.members.length > 8 && (
                        <div style={{ fontSize: 12, color: '#9a3412' }}>+{household.members.length - 8} more</div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#c2410c' }}>
                  <span>{household?.members?.length || 0} members</span>
                </div>
              </div>
            </div>
          )}
          <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => onAddWidget('chat')}
                disabled={widgetLoading}
                style={{ 
                  padding: '6px 12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: widgetLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Add Chat Widget
              </button>
              <button
                onClick={() => onAddWidget('drive')}
                disabled={widgetLoading}
                style={{ 
                  padding: '6px 12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: widgetLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Add File Hub Widget
              </button>
            </div>
            
            <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '12px' }}>
              <button
                onClick={onShowModuleManagement}
                disabled={widgetLoading}
                style={{ 
                  padding: '6px 12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: widgetLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ⚙️ Manage Modules
              </button>
            </div>
            
            {widgetLoading && <span style={{ marginLeft: 12, color: '#6b7280', fontSize: '14px' }}>Processing...</span>}
            {widgetError && <span style={{ color: '#ef4444', marginLeft: 12, fontSize: '14px' }}>{widgetError}</span>}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {currentDashboard.widgets.length === 0 ? (
              <div style={{ color: '#888', fontStyle: 'italic', padding: 32 }}>
                No widgets yet. Use the buttons above to add widgets to your dashboard.
              </div>
            ) : (
              <DraggableWrapper
                items={currentDashboard.widgets}
                onDragEnd={onWidgetDragEnd}
                renderItem={(w, index, isDragging) => (
                  <WidgetWithClassification
                    key={w.id}
                    widget={w}
                    onRemoveWidget={onRemoveWidget}
                    widgetLoading={widgetLoading}
                    accessToken={session?.accessToken || ''}
                    currentDashboard={currentDashboard}
                  />
                )}
              />
            )}
          </div>
        </div>
      ) : (
        <p>No dashboard selected.</p>
      )}
    </div>
  );
}

export default function DashboardClient({ dashboardId }: DashboardClientProps) {
  const { isHydrated } = useHydration();
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { trashItem } = useGlobalTrash();
  
  // Check if we should show create only mode from URL params

  
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [showBuildOutModal, setShowBuildOutModal] = useState(false);
  const [pendingDashboard, setPendingDashboard] = useState<Dashboard | null>(null);
  const [showModuleManagement, setShowModuleManagement] = useState(false);
  const [hasShownBuildOut, setHasShownBuildOut] = useState<Set<string>>(() => {
    // Load from localStorage on initialization
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dashboard-setup-completed');
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  // Get dashboard ID from URL params or props
  const activeDashboardId = (params?.id as string) || dashboardId;

  // Persist setup-completed state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && hasShownBuildOut.size > 0) {
      try {
        localStorage.setItem('dashboard-setup-completed', JSON.stringify(Array.from(hasShownBuildOut)));
      } catch (err) {
        console.warn('Failed to persist dashboard setup state:', err);
      }
    }
  }, [hasShownBuildOut]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    
    if (!session?.accessToken) {
      router.push('/auth/login');
      return;
    }

    setLoading(true);
    
    // Load all dashboards for the tab bar
    getDashboards(session.accessToken)
      .then((allDashboards) => {
        // Flatten all dashboards into a single array
        const flattenedDashboards = [
          ...allDashboards.personal,
          ...allDashboards.business,
          ...allDashboards.educational,
          ...(allDashboards.household || [])
        ];
        setDashboards(flattenedDashboards);
        

        
        // If we have a specific dashboard ID, load that dashboard
        if (activeDashboardId) {
          return getDashboard(session.accessToken!, activeDashboardId);
        } else if (flattenedDashboards.length > 0) {
          // No specific ID but dashboards exist, redirect to first one
          router.push(`/dashboard/${flattenedDashboards[0].id}`);
          return null;
        } else {
          // No dashboards
          setCurrentDashboard(null);
          return null;
        }
      })
      .then((dashboard) => {
        if (dashboard) {
          setCurrentDashboard(dashboard);
        } else if (activeDashboardId) {
          // Dashboard not found - redirect to first available dashboard
          if (dashboards.length > 0) {
            router.push(`/dashboard/${dashboards[0].id}`);
          } else {
            router.push('/dashboard');
          }
        }
      })
      .catch((err: unknown) => {
        console.error('DashboardClient: Error loading dashboards:', err);
        
        // Check if it's a 404 error (dashboard not found)
        const isNotFoundError = err && typeof err === 'object' && 'status' in err && (err as any).status === 404;
        
        if (isNotFoundError) {
          // Dashboard not found - redirect to first available dashboard
          if (dashboards.length > 0) {
            router.push(`/dashboard/${dashboards[0].id}`);
          } else {
            router.push('/dashboard');
          }
        } else if (
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
        ) {
          setError((err as { message: string }).message);
        } else {
          setError('An unknown error occurred');
        }
      })
      .finally(() => setLoading(false));
  }, [isHydrated, session?.accessToken, activeDashboardId, router]);

  // Auto-prompt module selection for new empty dashboards
  useEffect(() => {
    if (!currentDashboard || loading) return;
    
    // Check if dashboard is empty (no widgets) and we haven't shown the modal for this dashboard yet
    const isEmpty = !currentDashboard.widgets || currentDashboard.widgets.length === 0;
    const notShownYet = !hasShownBuildOut.has(currentDashboard.id);
    const notAlreadyShowing = !showBuildOutModal;
    
    if (isEmpty && notShownYet && notAlreadyShowing) {
      // Dashboard was just created or is empty - prompt for module selection
      setPendingDashboard(currentDashboard);
      setShowBuildOutModal(true);
      
      // Mark this dashboard as having shown the modal
      setHasShownBuildOut(prev => new Set([...Array.from(prev), currentDashboard.id]));
    }
  }, [currentDashboard, loading, showBuildOutModal, hasShownBuildOut]);

  const handleCreate = useCallback(async () => {
    if (!session?.accessToken) return;
    setCreating(true);
    setError(null);
    try {
      const dashboard = await createDashboard(session.accessToken, { name: `New Dashboard ${dashboards.length + 1}` });
      setDashboards((prev) => [...prev, dashboard]);
      
      // Show build out modal instead of immediately navigating
      setPendingDashboard(dashboard);
      setShowBuildOutModal(true);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
      ) {
        setError((err as { message: string }).message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setCreating(false);
    }
  }, [session?.accessToken, dashboards.length]);



  const handleAddWidget = async (type: string) => {
    if (!currentDashboard?.id || !session?.accessToken) return;
    setWidgetLoading(true);
    setWidgetError(null);
    try {
      const widget = await createWidget(session.accessToken, currentDashboard.id, { type });
      setCurrentDashboard(prev => prev ? { ...prev, widgets: [...prev.widgets, widget] } : null);
      // Also update the dashboard in the list
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === currentDashboard.id ? { ...d, widgets: [...d.widgets, widget] } : d
        )
      );
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
      ) {
        setWidgetError((err as { message: string }).message);
      } else {
        setWidgetError('An unknown error occurred');
      }
    } finally {
      setWidgetLoading(false);
    }
  };

  const handleRemoveWidget = async (widgetId: string) => {
    if (!currentDashboard?.id || !session?.accessToken) return;
    if (!window.confirm('Are you sure you want to remove this widget?')) return;
    setWidgetLoading(true);
    setWidgetError(null);
    try {
      await deleteWidget(session.accessToken, widgetId);
      setCurrentDashboard(prev => prev ? { ...prev, widgets: prev.widgets.filter((w) => w.id !== widgetId) } : null);
      // Also update the dashboard in the list
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === currentDashboard.id
            ? { ...d, widgets: d.widgets.filter((w) => w.id !== widgetId) }
            : d
        )
      );
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
      ) {
        setWidgetError((err as { message: string }).message);
      } else {
        setWidgetError('An unknown error occurred');
      }
    } finally {
      setWidgetLoading(false);
    }
  };

  const handleWidgetDragEnd = async (result: DragEndEvent) => {
    if (!currentDashboard?.id || !session?.accessToken) return;
    if (!result.over) return;

    const { active, over } = result;
    
    // Check if dropping on global trash bin
    if (over.id === 'global-trash-bin') {
      const widget = currentDashboard.widgets.find(w => w.id === active.id);
      if (widget) {
        try {
          await trashItem({
            id: widget.id,
            name: `${widget.type} Widget`,
            type: 'module',
            moduleId: 'dashboard',
            moduleName: 'Dashboard',
            metadata: {
              widgetType: widget.type,
              dashboardId: currentDashboard.id,
              dashboardName: currentDashboard.name,
            },
          });
          
          // Remove widget from local state
          setCurrentDashboard(prev => prev ? { ...prev, widgets: prev.widgets.filter(w => w.id !== widget.id) } : null);
          setDashboards(prev => prev.map(d => 
            d.id === currentDashboard.id 
              ? { ...d, widgets: d.widgets.filter(w => w.id !== widget.id) }
              : d
          ));
          
          toast.success('Widget moved to trash');
        } catch (error) {
          console.error('Failed to trash widget:', error);
          toast.error('Failed to move widget to trash');
        }
      }
      return;
    }
    
    const oldIndex = currentDashboard.widgets.findIndex(w => w.id === active.id);
    const newIndex = currentDashboard.widgets.findIndex(w => w.id === over.id);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const items = Array.from(currentDashboard.widgets);
    const [reorderedItem] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, reorderedItem);

    const newLayout = items.map((w) => w.id);
    setCurrentDashboard(prev => prev ? { ...prev, widgets: items } : null);

    try {
      await updateDashboardLayout(session.accessToken, currentDashboard.id, newLayout);
    } catch (err) {
      console.error('Failed to update layout:', err);
      // Revert on error
      setCurrentDashboard(prev => prev ? { ...prev, widgets: currentDashboard.widgets } : null);
    }
  };

  // Handle build out modal completion
  const handleBuildOutComplete = async (selectedModuleIds: string[]) => {
    if (!pendingDashboard || !session?.accessToken) return;
    
    setShowBuildOutModal(false);
    
    // Mark this dashboard as having shown the modal
    setHasShownBuildOut(prev => new Set([...Array.from(prev), pendingDashboard.id]));
    
    try {
      // Add selected modules as widgets to the dashboard
      const widgetPromises = selectedModuleIds.map(moduleId => 
        createWidget(session.accessToken!, pendingDashboard.id, { type: moduleId })
      );
      
      if (widgetPromises.length > 0) {
        const newWidgets = await Promise.all(widgetPromises);
        
        // Update the dashboard with new widgets
        const updatedDashboard = { ...pendingDashboard, widgets: newWidgets };
        setDashboards(prev => prev.map(d => 
          d.id === pendingDashboard.id ? updatedDashboard : d
        ));
      }
      
      // Navigate to the new dashboard
      router.push(`/dashboard/${pendingDashboard.id}`);
    } catch (err) {
      console.error('Error adding widgets to dashboard:', err);
      // Still navigate to dashboard even if widget creation fails
      router.push(`/dashboard/${pendingDashboard.id}`);
    } finally {
      setPendingDashboard(null);
    }
  };

  // Handle build out modal close
  const handleBuildOutClose = () => {
    setShowBuildOutModal(false);
    if (pendingDashboard) {
      // Mark this dashboard as having shown the modal (user chose to skip)
      setHasShownBuildOut(prev => new Set([...Array.from(prev), pendingDashboard.id]));
      
      // Navigate to dashboard without widgets if user cancels
      router.push(`/dashboard/${pendingDashboard.id}`);
      setPendingDashboard(null);
    }
  };

  // Handle trashing a dashboard
  const handleTrashDashboard = async (dashboard: Dashboard) => {
    try {
      await trashItem({
        id: dashboard.id,
        name: dashboard.name,
        type: 'dashboard_tab',
        moduleId: 'dashboard',
        moduleName: 'Dashboard',
        metadata: {
          widgetCount: dashboard.widgets.length,
          createdAt: dashboard.createdAt,
        },
      });
      
      // Remove dashboard from local state
      setDashboards(prev => prev.filter(d => d.id !== dashboard.id));
      
      // If this was the current dashboard, redirect to another one
      if (currentDashboard?.id === dashboard.id) {
        const remainingDashboards = dashboards.filter(d => d.id !== dashboard.id);
        if (remainingDashboards.length > 0) {
          router.push(`/dashboard/${remainingDashboards[0].id}`);
        } else {
          router.push('/dashboard');
        }
      }
      
      toast.success(`${dashboard.name} moved to trash`);
    } catch (error) {
      console.error('Failed to trash dashboard:', error);
      toast.error('Failed to move dashboard to trash');
    }
  };

  // Always redirect to an existing dashboard if no specific dashboard is selected
  useEffect(() => {
    if (!currentDashboard && !loading && dashboards.length > 0) {
      // Redirect to the first available dashboard
      router.push(`/dashboard/${dashboards[0].id}`);
    }
  }, [currentDashboard, loading, dashboards, router]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#f8fafc'
      }}>
        <div style={{ color: '#ef4444', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Error</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardContent
        dashboards={dashboards}
        currentDashboard={currentDashboard}
        onDashboardSelect={(id: string) => router.push(`/dashboard/${id}`)}
        onCreateDashboard={handleCreate}
        onAddWidget={handleAddWidget}
        onRemoveWidget={handleRemoveWidget}
        onWidgetDragEnd={handleWidgetDragEnd}
        widgetLoading={widgetLoading}
        widgetError={widgetError}
        onShowModuleManagement={() => setShowModuleManagement(true)}
        router={router}
      />
      
      {/* Dashboard Build Out Modal */}
      <DashboardBuildOutModal
        isOpen={showBuildOutModal}
        onClose={handleBuildOutClose}
        onComplete={handleBuildOutComplete}
        dashboardName={pendingDashboard?.name || 'New Dashboard'}
      />
      
      {/* Module Management Modal */}
      {currentDashboard && (
        <ModuleManagementModal
          isOpen={showModuleManagement}
          onClose={() => setShowModuleManagement(false)}
          dashboard={currentDashboard}
          onDashboardUpdate={(updatedDashboard) => {
            setCurrentDashboard(updatedDashboard);
            setDashboards(prev => prev.map(d => 
              d.id === updatedDashboard.id ? updatedDashboard : d
            ));
          }}
        />
      )}
    </>
  );
} 