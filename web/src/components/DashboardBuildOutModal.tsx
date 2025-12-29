'use client';

import React, { useState, useEffect } from 'react';
import { X, Puzzle, Check, Search, Zap, Users, FileText, BarChart, MessageSquare, Settings } from 'lucide-react';
import { Button, Card } from 'shared/components';
import { Module } from '../api/modules';
import { getInstalledModules, getMarketplaceModules } from '../api/modules';
import { useSession } from 'next-auth/react';

interface DashboardBuildOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (selectedModuleIds: string[]) => void;
  dashboardName: string;
  businessId?: string; // For enterprise module filtering
  scope?: 'personal' | 'business';
}

interface QuickSetupOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  modules: string[];
  color: string;
}

const quickSetupOptions: QuickSetupOption[] = [
  {
    id: 'basic-workspace',
    name: 'Basic Workspace',
    description: 'Essential tools for personal productivity',
    icon: <FileText className="w-6 h-6" />,
    modules: ['drive', 'chat'],
    color: 'blue'
  },
  {
    id: 'collaboration-hub',
    name: 'Collaboration Hub',
    description: 'Team communication and file sharing',
    icon: <Users className="w-6 h-6" />,
    modules: ['drive', 'chat', 'dashboard'],
    color: 'green'
  },
  {
    id: 'file-management',
    name: 'File Management',
    description: 'Focus on document organization',
    icon: <FileText className="w-6 h-6" />,
    modules: ['drive'],
    color: 'purple'
  },
  {
    id: 'communication-center',
    name: 'Communication Center',
    description: 'Chat and notifications focused',
    icon: <MessageSquare className="w-6 h-6" />,
    modules: ['chat', 'dashboard'],
    color: 'orange'
  }
];

const getModuleIcon = (moduleName: string) => {
  switch (moduleName.toLowerCase()) {
    case 'drive':
      return <FileText className="w-5 h-5" />;
    case 'chat':
      return <MessageSquare className="w-5 h-5" />;
    case 'dashboard':
      return <BarChart className="w-5 h-5" />;
    case 'settings':
      return <Settings className="w-5 h-5" />;
    default:
      return <Puzzle className="w-5 h-5" />;
  }
};

const getModuleDescription = (moduleName: string) => {
  switch (moduleName.toLowerCase()) {
    case 'drive':
      return 'File storage, sharing, and organization';
    case 'chat':
      return 'Real-time messaging and collaboration';
    case 'dashboard':
      return 'Insights and activity tracking';
    case 'settings':
      return 'Dashboard configuration and preferences';
    default:
      return 'Module functionality';
  }
};

export default function DashboardBuildOutModal({
  isOpen,
  onClose,
  onComplete,
  dashboardName,
  businessId,
  scope = 'personal'
}: DashboardBuildOutModalProps) {
  const { data: session } = useSession();
  const [view, setView] = useState<'quick-setup' | 'custom'>('quick-setup');
  const [availableModules, setAvailableModules] = useState<Module[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available modules
  useEffect(() => {
    if (!isOpen || !session?.accessToken) return;

    const loadModules = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Try to load real modules from API
        let modules: Module[] = [];
        
        try {
          const params = new URLSearchParams();
          if (scope === 'business' && businessId) {
            params.append('scope', 'business');
            params.append('businessId', businessId);
            params.append('pricingTier', 'enterprise'); // Only show enterprise modules for business
          }
          
          const response = await fetch(`/api/modules/marketplace?${params.toString()}`, {
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            modules = data.data || [];
          }
        } catch (apiError) {
          console.warn('Failed to load modules from API, using mock data');
        }
        
        // Fallback to mock data if API fails
        if (modules.length === 0) {
          const mockModules: Module[] = [
            {
              id: 'drive',
              name: 'File Hub',
              description: scope === 'business' ? 'Enterprise file storage and management' : 'File storage and management',
              version: '1.0.0',
              category: 'Core',
              developer: 'Vssyl',
              rating: 5,
              reviewCount: 0,
              downloads: 0,
              status: 'available',
              pricingTier: scope === 'business' ? 'enterprise' : 'free',
              manifest: {
                name: 'File Hub',
                version: '1.0.0',
                description: 'File storage and management',
                author: 'Vssyl',
                license: 'MIT',
                entryPoint: 'index.js',
                permissions: [],
                dependencies: [],
                runtime: { apiVersion: '1.0' },
                frontend: { entryUrl: '/drive' },
                settings: {}
              },
              configured: {
                enabled: false,
                settings: {},
                permissions: []
              }
            },
            {
              id: 'chat',
              name: 'Chat',
              description: scope === 'business' ? 'Enterprise messaging and collaboration' : 'Real-time messaging and collaboration',
              version: '1.0.0',
              category: 'Core',
              developer: 'Vssyl',
              rating: 5,
              reviewCount: 0,
              downloads: 0,
              status: 'available',
              pricingTier: scope === 'business' ? 'enterprise' : 'free',
              manifest: {
                name: 'Chat',
                version: '1.0.0',
                description: 'Real-time messaging and collaboration',
                author: 'Vssyl',
                license: 'MIT',
                entryPoint: 'index.js',
                permissions: [],
                dependencies: [],
                runtime: { apiVersion: '1.0' },
                frontend: { entryUrl: '/chat' },
                settings: {}
              },
              configured: {
                enabled: false,
                settings: {},
                permissions: []
              }
            },
            {
              id: 'analytics',
              name: 'Analytics',
              description: scope === 'business' ? 'Enterprise insights and activity tracking' : 'Insights and activity tracking',
              version: '1.0.0',
              category: 'Core',
              developer: 'Vssyl',
              rating: 5,
              reviewCount: 0,
              downloads: 0,
              status: 'available',
              pricingTier: scope === 'business' ? 'enterprise' : 'free',
              manifest: {
                name: 'Analytics',
                version: '1.0.0',
                description: 'Insights and activity tracking',
                author: 'Vssyl',
                license: 'MIT',
                entryPoint: 'index.js',
                permissions: [],
                dependencies: [],
                runtime: { apiVersion: '1.0' },
                frontend: { entryUrl: '/analytics' },
                settings: {}
              },
              configured: {
                enabled: false,
                settings: {},
                permissions: []
              }
            }
          ];
          modules = mockModules;
        }
        
        setAvailableModules(modules);
      } catch (err) {
        console.error('Error loading modules:', err);
        setError('Failed to load available modules');
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, [isOpen, session?.accessToken]);

  const handleQuickSetup = (option: QuickSetupOption) => {
    const moduleIds = option.modules.filter(moduleId => 
      availableModules.some(module => module.id === moduleId)
    );
    onComplete(moduleIds);
  };

  const handleCustomSetup = () => {
    onComplete(Array.from(selectedModules));
  };

  const toggleModule = (moduleId: string) => {
    const newSelected = new Set(selectedModules);
    if (newSelected.has(moduleId)) {
      newSelected.delete(moduleId);
    } else {
      newSelected.add(moduleId);
    }
    setSelectedModules(newSelected);
  };

  const filteredModules = availableModules.filter(module =>
    module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Build Out Your Dashboard
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Choose modules for "{dashboardName}"
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
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              onClick={() => setView('quick-setup')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                view === 'quick-setup'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Zap className="w-4 h-4 inline mr-2" />
              Quick Setup
            </button>
            <button
              onClick={() => setView('custom')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                view === 'custom'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Custom Selection
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {view === 'quick-setup' ? (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Choose a Quick Setup
                </h3>
                <p className="text-gray-600 text-sm">
                  Get started quickly with pre-configured module combinations
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {quickSetupOptions.map((option) => (
                  <Card
                    key={option.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors border-2 border-transparent hover:border-blue-200"
                  >
                    <div 
                      className="p-6" 
                      onClick={() => handleQuickSetup(option)}
                    >
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-lg bg-${option.color}-100`}>
                        {option.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {option.name}
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          {option.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {option.modules.map((moduleId) => {
                            const module = availableModules.find(m => m.id === moduleId);
                            return (
                              <span
                                key={moduleId}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {getModuleIcon(moduleId)}
                                <span className="ml-1">{module?.name || moduleId}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Or choose your own modules with custom selection
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setView('custom')}
                >
                  Custom Selection
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select Modules
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Choose the modules you want to include in your dashboard
                </p>

                {/* Search */}
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

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading modules...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {filteredModules.map((module) => {
                    const isSelected = selectedModules.has(module.id);
                    return (
                      <Card
                        key={module.id}
                        className={`cursor-pointer transition-all border-2 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div 
                          className="p-4" 
                          onClick={() => toggleModule(module.id)}
                        >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-200' : 'bg-gray-100'}`}>
                              {getModuleIcon(module.name)}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{module.name}</h4>
                              <p className="text-xs text-gray-600">{module.category}</p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="p-1 bg-blue-500 rounded-full">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          {getModuleDescription(module.name)}
                        </p>
                        
                        <div className="text-xs text-gray-500">
                          v{module.version} • {module.developer}
                        </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {filteredModules.length === 0 && !loading && (
                <div className="text-center py-12">
                  <Puzzle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No modules found matching your search</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {view === 'custom' && selectedModules.size > 0 && (
              <span>{selectedModules.size} module{selectedModules.size !== 1 ? 's' : ''} selected</span>
            )}
          </div>
          <div className="flex space-x-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {view === 'custom' && (
              <Button
                onClick={handleCustomSetup}
                disabled={selectedModules.size === 0}
              >
                Continue with Selected Modules
              </Button>
            )}
            {view === 'quick-setup' && (
              <Button onClick={() => onComplete([])}>
                Skip Module Selection
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}