'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings, Search, Check } from 'lucide-react';
import { Button, Card } from 'shared/components';
import { Module } from '../api/modules';
import { getInstalledModules, getMarketplaceModules } from '../api/modules';
import { createWidget, deleteWidget } from '../api/widget';
import { calendarAPI } from '../api/calendar';
import { useSession } from 'next-auth/react';
import { Dashboard } from 'shared/types';

interface ModuleManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: Dashboard;
  onDashboardUpdate: (updatedDashboard: Dashboard) => void;
}

interface ModuleWithStatus extends Module {
  isInstalled: boolean;
  widgetId?: string;
}

const getModuleIcon = (moduleName: string) => {
  const iconMap: Record<string, string> = {
    drive: '📁',
    chat: '💬',
    analytics: '📊',
    settings: '⚙️',
    calendar: '📅',
    tasks: '✅',
    notes: '📝',
  };
  
  return iconMap[moduleName.toLowerCase()] || '🧩';
};

export default function ModuleManagementModal({
  isOpen,
  onClose,
  dashboard,
  onDashboardUpdate
}: ModuleManagementModalProps) {
  const { data: session } = useSession();
  const [modules, setModules] = useState<ModuleWithStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load available modules and check installation status
  useEffect(() => {
    if (!isOpen || !session?.accessToken) return;

    const loadModules = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // For now, use mock data
        const mockModules: Module[] = [
          {
            id: 'drive',
            name: 'File Hub',
            description: 'File storage and management system',
            version: '1.0.0',
            category: 'Core',
            developer: 'Vssyl',
            rating: 5,
            reviewCount: 0,
            downloads: 0,
            status: 'available',
            manifest: {
              name: 'File Hub',
              version: '1.0.0',
              description: 'File storage and management system',
              author: 'Vssyl',
              license: 'MIT',
              entryPoint: '/api/drive',
              permissions: ['files:read', 'files:write'],
              dependencies: [],
              runtime: { apiVersion: '1.0' },
              frontend: { entryUrl: '/modules/drive' },
              settings: {}
            },
            configured: {
              enabled: true,
              settings: {},
              permissions: ['files:read', 'files:write']
            }
          },
          {
            id: 'chat',
            name: 'Chat',
            description: 'Real-time messaging and collaboration',
            version: '1.0.0',
            category: 'Core',
            developer: 'Vssyl',
            rating: 5,
            reviewCount: 0,
            downloads: 0,
            status: 'available',
            manifest: {
              name: 'Chat',
              version: '1.0.0',
              description: 'Real-time messaging and collaboration',
              author: 'Vssyl',
              license: 'MIT',
              entryPoint: '/api/chat',
              permissions: ['messages:read', 'messages:write'],
              dependencies: [],
              runtime: { apiVersion: '1.0' },
              frontend: { entryUrl: '/modules/chat' },
              settings: {}
            },
            configured: {
              enabled: true,
              settings: {},
              permissions: ['messages:read', 'messages:write']
            }
          },
          {
            id: 'analytics',
            name: 'Analytics',
            description: 'Dashboard analytics and insights',
            version: '1.0.0',
            category: 'Core',
            developer: 'Vssyl',
            rating: 5,
            reviewCount: 0,
            downloads: 0,
            status: 'available',
            manifest: {
              name: 'Analytics',
              version: '1.0.0',
              description: 'Dashboard analytics and insights',
              author: 'Vssyl',
              license: 'MIT',
              entryPoint: '/api/analytics',
              permissions: ['data:read'],
              dependencies: [],
              runtime: { apiVersion: '1.0' },
              frontend: { entryUrl: '/modules/analytics' },
              settings: {}
            },
            configured: {
              enabled: true,
              settings: {},
              permissions: ['data:read']
            }
          },
          {
            id: 'calendar',
            name: 'Calendar',
            description: 'Schedule and event management',
            version: '1.0.0',
            category: 'Productivity',
            developer: 'Vssyl',
            rating: 4.5,
            reviewCount: 12,
            downloads: 150,
            status: 'available',
            manifest: {
              name: 'Calendar',
              version: '1.0.0',
              description: 'Schedule and event management',
              author: 'Vssyl',
              license: 'MIT',
              entryPoint: '/api/calendar',
              permissions: ['events:read', 'events:write'],
              dependencies: [],
              runtime: { apiVersion: '1.0' },
              frontend: { entryUrl: '/modules/calendar' },
              settings: {}
            },
            configured: {
              enabled: true,
              settings: {},
              permissions: ['events:read', 'events:write']
            }
          },
          {
            id: 'tasks',
            name: 'Tasks',
            description: 'Task and project management',
            version: '1.0.0',
            category: 'Productivity',
            developer: 'Vssyl',
            rating: 4.3,
            reviewCount: 8,
            downloads: 120,
            status: 'available',
            manifest: {
              name: 'Tasks',
              version: '1.0.0',
              description: 'Task and project management',
              author: 'Vssyl',
              license: 'MIT',
              entryPoint: '/api/tasks',
              permissions: ['tasks:read', 'tasks:write'],
              dependencies: [],
              runtime: { apiVersion: '1.0' },
              frontend: { entryUrl: '/modules/tasks' },
              settings: {}
            },
            configured: {
              enabled: true,
              settings: {},
              permissions: ['tasks:read', 'tasks:write']
            }
          },
          {
            id: 'notes',
            name: 'Notes',
            description: 'Quick notes and documentation',
            version: '1.0.0',
            category: 'Productivity',
            developer: 'Vssyl',
            rating: 4.7,
            reviewCount: 25,
            downloads: 200,
            status: 'available',
            manifest: {
              name: 'Notes',
              version: '1.0.0',
              description: 'Quick notes and documentation',
              author: 'Vssyl',
              license: 'MIT',
              entryPoint: '/api/notes',
              permissions: ['notes:read', 'notes:write'],
              dependencies: [],
              runtime: { apiVersion: '1.0' },
              frontend: { entryUrl: '/modules/notes' },
              settings: {}
            },
            configured: {
              enabled: true,
              settings: {},
              permissions: ['notes:read', 'notes:write']
            }
          }
        ];
        
        // Add installation status based on current dashboard widgets
        const modulesWithStatus: ModuleWithStatus[] = mockModules.map(module => {
          const widget = dashboard.widgets.find(w => w.type === module.id);
          return {
            ...module,
            isInstalled: !!widget,
            widgetId: widget?.id
          };
        });
        
        setModules(modulesWithStatus);
      } catch (err) {
        console.error('Error loading modules:', err);
        setError('Failed to load available modules');
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, [isOpen, session?.accessToken, dashboard.widgets]);

  const handleInstallModule = async (module: ModuleWithStatus) => {
    if (!session?.accessToken) return;
    
    setActionLoading(module.id);
    try {
      const widget = await createWidget(session.accessToken, dashboard.id, { type: module.id });
      
      // Update local state
      setModules(prev => prev.map(m => 
        m.id === module.id 
          ? { ...m, isInstalled: true, widgetId: widget.id }
          : m
      ));
      
      // Update dashboard
      const updatedDashboard = {
        ...dashboard,
        widgets: [...dashboard.widgets, widget]
      };
      onDashboardUpdate(updatedDashboard);
      
      // Post-install provisioning for Calendar module
      if (module.id === 'calendar') {
        try {
          // Derive context from dashboard
          let contextType: 'PERSONAL'|'BUSINESS'|'HOUSEHOLD' = 'PERSONAL';
          let contextId = dashboard.userId as any;
          if ((dashboard as any).businessId) { contextType = 'BUSINESS'; contextId = (dashboard as any).businessId; }
          if ((dashboard as any).householdId) { contextType = 'HOUSEHOLD'; contextId = (dashboard as any).householdId; }
          await calendarAPI.autoProvision({ contextType, contextId, name: dashboard.name, isPrimary: true });
        } catch {}
      }
      
    } catch (err) {
      console.error('Error installing module:', err);
      setError(`Failed to install ${module.name} module`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstallModule = async (module: ModuleWithStatus) => {
    if (!session?.accessToken || !module.widgetId) return;
    
    if (!window.confirm(`Are you sure you want to remove the ${module.name} module from this dashboard?`)) {
      return;
    }
    
    setActionLoading(module.id);
    try {
      await deleteWidget(session.accessToken, module.widgetId);
      
      // Update local state
      setModules(prev => prev.map(m => 
        m.id === module.id 
          ? { ...m, isInstalled: false, widgetId: undefined }
          : m
      ));
      
      // Update dashboard
      const updatedDashboard = {
        ...dashboard,
        widgets: dashboard.widgets.filter(w => w.id !== module.widgetId)
      };
      onDashboardUpdate(updatedDashboard);
      
    } catch (err) {
      console.error('Error uninstalling module:', err);
      setError(`Failed to remove ${module.name} module`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredModules = modules.filter(module =>
    module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const installedModules = filteredModules.filter(m => m.isInstalled);
  const availableModules = filteredModules.filter(m => !m.isInstalled);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Manage Dashboard Modules
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Add or remove modules for "{dashboard.name}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading modules...</span>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Installed Modules */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  Installed Modules ({installedModules.length})
                </h3>
                
                {installedModules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No modules installed on this dashboard</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {installedModules.map((module) => (
                      <Card key={module.id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="text-2xl">{getModuleIcon(module.name)}</div>
                            <div>
                              <h4 className="font-medium text-gray-900">{module.name}</h4>
                              <p className="text-xs text-gray-600">{module.category}</p>
                            </div>
                          </div>
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            Installed
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          {module.description}
                        </p>
                        
                        <div className="flex space-x-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleUninstallModule(module)}
                            disabled={actionLoading === module.id}
                            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                          >
                            {actionLoading === module.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-1" />
                                Remove
                              </>
                            )}
                          </Button>
                          <Button variant="secondary" size="sm">
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Modules */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Plus className="w-5 h-5 text-blue-500 mr-2" />
                  Available Modules ({availableModules.length})
                </h3>
                
                {availableModules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>All available modules are already installed</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableModules.map((module) => (
                      <Card key={module.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="text-2xl">{getModuleIcon(module.name)}</div>
                            <div>
                              <h4 className="font-medium text-gray-900">{module.name}</h4>
                              <p className="text-xs text-gray-600">{module.category}</p>
                            </div>
                          </div>
                          <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            Available
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          {module.description}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span>v{module.version}</span>
                          <span>⭐ {module.rating} ({module.reviewCount})</span>
                        </div>
                        
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleInstallModule(module)}
                          disabled={actionLoading === module.id}
                          className="w-full"
                        >
                          {actionLoading === module.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-1" />
                              Add to Dashboard
                            </>
                          )}
                        </Button>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {installedModules.length} module{installedModules.length !== 1 ? 's' : ''} installed
          </div>
          <Button onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}