'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Tabs, Spinner, Alert } from 'shared/components';
import { useSession } from 'next-auth/react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useSidebarCustomization } from '../../contexts/SidebarCustomizationContext';
import { usePositionAwareModules } from '../PositionAwareModuleProvider';
import { useWorkAuth } from '../../contexts/WorkAuthContext';
import { LeftSidebarCustomizer } from './LeftSidebarCustomizer';
import { RightSidebarCustomizer } from './RightSidebarCustomizer';

interface SidebarCustomizationModalProps {
  open: boolean;
  onClose: () => void;
}

export function SidebarCustomizationModal({
  open,
  onClose,
}: SidebarCustomizationModalProps) {
  const { data: session } = useSession();
  const { currentDashboardId, allDashboards, getDashboardType } = useDashboard();
  const { config, loading, error, isDirty, saveConfig, loadConfig, resetConfig } = useSidebarCustomization();
  const { getFilteredModules } = usePositionAwareModules();
  const { isWorkAuthenticated, currentBusinessId } = useWorkAuth();

  const [activeTab, setActiveTab] = useState<'left' | 'right'>('left');
  const [selectedDashboardTab, setSelectedDashboardTab] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const availableModules = getFilteredModules();
  const context = isWorkAuthenticated ? 'business' : 'personal';

  // Set selected dashboard tab to current dashboard on open
  useEffect(() => {
    if (open && currentDashboardId) {
      setSelectedDashboardTab(currentDashboardId);
      if (currentDashboardId) {
        loadConfig(currentDashboardId);
      }
    }
  }, [open, currentDashboardId, loadConfig]);

  // Get personal dashboards for tab selector
  const personalDashboards = allDashboards.filter(
    d => {
      const type = getDashboardType(d);
      return type === 'personal';
    }
  );

  const handleSave = async () => {
    if (!currentDashboardId || !session?.accessToken) {
      setSaveError('Dashboard ID or session missing');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await saveConfig(currentDashboardId);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    onClose();
  };

  const handleReset = async (scope?: 'tab' | 'sidebar' | 'global') => {
    if (!currentDashboardId || !session?.accessToken) {
      setSaveError('Dashboard ID or session missing');
      return;
    }

    const scopeLabel = scope === 'tab' ? 'this tab' : scope === 'sidebar' ? 'this sidebar' : 'all customizations';
    if (!confirm(`Reset ${scopeLabel} to defaults? This cannot be undone.`)) {
      return;
    }

    setResetting(true);
    setSaveError(null);

    try {
      await resetConfig(currentDashboardId, {
        scope,
        dashboardTabId: scope === 'tab' ? selectedDashboardTab || undefined : undefined,
        context: scope === 'sidebar' ? (isWorkAuthenticated && currentBusinessId ? currentBusinessId : 'personal') : undefined,
      });
      // Reload config after reset
      await loadConfig(currentDashboardId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="Customize Sidebars"
      size="large"
      headerActions={
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-gray-500">Unsaved changes</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activeTab === 'left') {
                handleReset('tab');
              } else {
                handleReset('sidebar');
              }
            }}
            disabled={saving || resetting}
            title="Reset to defaults"
          >
            {resetting ? <Spinner size={16} /> : 'Reset'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={saving || resetting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || resetting || !isDirty}
          >
            {saving ? <Spinner size={16} /> : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert type="error" title="Error">
            {error}
          </Alert>
        )}

        {saveError && (
          <Alert type="error" title="Save Error">
            {saveError}
          </Alert>
        )}

        {loading && !config ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={32} />
          </div>
        ) : (
          <>
            {/* Dashboard Tab Selector (for left sidebar) */}
            {activeTab === 'left' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dashboard Tab
                </label>
                <select
                  value={selectedDashboardTab || ''}
                  onChange={(e) => {
                    setSelectedDashboardTab(e.target.value);
                    if (e.target.value) {
                      loadConfig(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {personalDashboards.map((dashboard) => (
                    <option key={dashboard.id} value={dashboard.id}>
                      {dashboard.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Each dashboard tab can have its own sidebar organization
                </p>
              </div>
            )}

            {/* Tabs for Left/Right Sidebar */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'left' | 'right')}>
              <Tabs.List>
                <Tabs.Trigger value="left">Left Sidebar</Tabs.Trigger>
                <Tabs.Trigger value="right">Right Sidebar</Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="left">
                {selectedDashboardTab ? (
                  <LeftSidebarCustomizer
                    dashboardTabId={selectedDashboardTab}
                    availableModules={availableModules}
                    context={context}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Please select a dashboard tab
                  </div>
                )}
              </Tabs.Content>

              <Tabs.Content value="right">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Context
                  </label>
                  <select
                    value={context}
                    onChange={(e) => {
                      // Context is determined by work auth, but we can show it
                    }}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                  >
                    <option value="personal">Personal</option>
                    {isWorkAuthenticated && currentBusinessId && (
                      <option value={currentBusinessId}>Business</option>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Right sidebar is context-specific (Personal or Business)
                  </p>
                </div>
                <RightSidebarCustomizer
                  context={isWorkAuthenticated && currentBusinessId ? currentBusinessId : 'personal'}
                  availableModules={availableModules}
                />
              </Tabs.Content>
            </Tabs>
          </>
        )}
      </div>
    </Modal>
  );
}

