'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import { 
  Package, 
  Plus, 
  Check, 
  X, 
  Search, 
  Filter,
  Download,
  Trash2,
  Settings as SettingsIcon,
  Star,
  TrendingUp,
  Shield,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getInstalledModules, getMarketplaceModules, installModule, uninstallModule } from '@/api/modules';
import { businessAPI } from '@/api/business';

interface Module {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  developer: string;
  rating: number;
  reviewCount: number;
  downloads: number;
  status: 'installed' | 'available' | 'pending';
  icon?: string;
  tags?: string[];
  pricingTier?: 'free' | 'premium' | 'enterprise';
  basePrice?: number;
  installedAt?: string;
}

interface Business {
  id: string;
  name: string;
  members: Array<{
    role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
    user: { id: string };
  }>;
}

export default function BusinessModulesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const businessId = params?.id as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [installedModules, setInstalledModules] = useState<Module[]>([]);
  const [marketplaceModules, setMarketplaceModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');
  const [installingModuleId, setInstallingModuleId] = useState<string | null>(null);

  // Core modules that are auto-installed
  const coreModuleIds = ['drive', 'chat', 'calendar'];

  // Get active tab from URL params (defaults to 'installed')
  useEffect(() => {
    const tab = searchParams?.get('tab') as 'installed' | 'marketplace' | null;
    if (tab && (tab === 'installed' || tab === 'marketplace')) {
      setActiveTab(tab);
    } else {
      // Default to 'installed' if no tab param or invalid tab
      setActiveTab('installed');
    }
  }, [searchParams]);

  useEffect(() => {
    if (businessId && session?.accessToken) {
      loadData();
    }
  }, [businessId, session?.accessToken]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load business data
      const businessResponse = await businessAPI.getBusiness(businessId);
      if (businessResponse.success) {
        setBusiness(businessResponse.data as unknown as Business);
      }

      // Load installed modules
      const installed = await getInstalledModules({ 
        scope: 'business', 
        businessId 
      });
      console.log('[Module Manager] Installed modules:', installed);
      console.log('[Module Manager] Scheduling module found:', installed.find(m => m.id === 'scheduling' || m.id.includes('scheduling')));
      setInstalledModules(installed);

      // Load marketplace modules (with business scope to properly determine installed status)
      const marketplace = await getMarketplaceModules({
        scope: 'business',
        businessId
      });
      console.log('[Module Manager] Marketplace modules:', marketplace);
      console.log('[Module Manager] Scheduling in marketplace:', marketplace.find(m => m.id === 'scheduling' || m.id.includes('scheduling')));
      setMarketplaceModules(marketplace);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallModule = async (moduleId: string) => {
    try {
      setInstallingModuleId(moduleId);
      
      await installModule(moduleId, {
        scope: 'business',
        businessId
      });

      toast.success('Module installed successfully');
      
      // Reload modules
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to install module');
    } finally {
      setInstallingModuleId(null);
    }
  };

  const handleUninstallModule = async (moduleId: string) => {
    // Prevent uninstalling core modules
    if (coreModuleIds.includes(moduleId)) {
      toast.error('Cannot uninstall core modules (Drive, Chat, Calendar)');
      return;
    }

    if (!confirm('Are you sure you want to uninstall this module? This will remove it for all employees.')) {
      return;
    }

    try {
      setInstallingModuleId(moduleId);
      
      await uninstallModule(moduleId, {
        scope: 'business',
        businessId
      });

      toast.success('Module uninstalled successfully');
      
      // Reload modules
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to uninstall module');
    } finally {
      setInstallingModuleId(null);
    }
  };

  const isAdmin = () => {
    if (!business || !session?.user?.id) return false;
    const userMember = business.members.find(m => m.user.id === session.user.id);
    return userMember?.role === 'ADMIN' || userMember?.role === 'MANAGER';
  };

  const getCategories = () => {
    const allModules = [...installedModules, ...marketplaceModules];
    const categories = new Set(allModules.map(m => m.category));
    return ['all', ...Array.from(categories)];
  };

  const filterModules = (modules: Module[]) => {
    return modules.filter(module => {
      const matchesSearch = module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          module.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || module.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  };

  const getAvailableModules = () => {
    const installedIds = new Set(installedModules.map(m => m.id));
    return marketplaceModules.filter(m => !installedIds.has(m.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="container mx-auto p-6">
        <Alert type="error" title="Error Loading Modules">
          {error || 'Business not found'}
        </Alert>
      </div>
    );
  }

  if (!isAdmin()) {
    return (
      <div className="container mx-auto p-6">
        <Alert type="warning" title="Access Denied">
          Only business administrators can manage modules.
        </Alert>
      </div>
    );
  }

  const filteredInstalled = filterModules(installedModules);
  const filteredAvailable = filterModules(getAvailableModules());
  const categories = getCategories();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push(`/business/${businessId}`)}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Admin</span>
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Module Management</h1>
                <p className="text-sm text-gray-600">{business.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge color="blue">
                {installedModules.length} Installed
              </Badge>
              <Badge color="gray">
                {getAvailableModules().length} Available
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Search and Filters */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => {
              setActiveTab('installed');
              router.push(`/business/${businessId}/modules?tab=installed`);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'installed'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Installed Modules ({filteredInstalled.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('marketplace');
              router.push(`/business/${businessId}/modules?tab=marketplace`);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'marketplace'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Marketplace ({filteredAvailable.length})
          </button>
        </div>

        {/* Module Grid */}
        {activeTab === 'installed' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInstalled.length === 0 ? (
              <div className="col-span-full">
                <Card className="p-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No modules found
                  </h3>
                  <p className="text-gray-600">
                    {searchQuery || selectedCategory !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'Install modules from the marketplace to get started'}
                  </p>
                </Card>
              </div>
            ) : (
              filteredInstalled.map(module => {
                const isCoreModule = coreModuleIds.includes(module.id);
                return (
                  <Card key={module.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{module.name}</h3>
                          <p className="text-sm text-gray-600">{module.version}</p>
                        </div>
                      </div>
                      {isCoreModule && (
                        <Badge color="blue">Core</Badge>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {module.description}
                    </p>

                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-400 mr-1" />
                        {module.rating.toFixed(1)}
                      </span>
                      <span className="flex items-center">
                        <Download className="w-4 h-4 mr-1" />
                        {module.downloads.toLocaleString()}
                      </span>
                      <Badge color="green">Installed</Badge>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => router.push(`/business/${businessId}/modules/${module.id}`)}
                      >
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                      {!isCoreModule && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUninstallModule(module.id)}
                          disabled={installingModuleId === module.id}
                          className="text-red-600 hover:bg-red-50 border border-red-200"
                        >
                          {installingModuleId === module.id ? (
                            <Spinner size={16} />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>

                    {isCoreModule && (
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Core module - cannot be uninstalled
                      </p>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAvailable.length === 0 ? (
              <div className="col-span-full">
                <Card className="p-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No modules found
                  </h3>
                  <p className="text-gray-600">
                    {searchQuery || selectedCategory !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'All available modules are already installed'}
                  </p>
                </Card>
              </div>
            ) : (
              filteredAvailable.map(module => (
                <Card key={module.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{module.name}</h3>
                        <p className="text-sm text-gray-600">{module.version}</p>
                      </div>
                    </div>
                    {module.pricingTier && module.pricingTier !== 'free' && (
                      <Badge color={module.pricingTier === 'enterprise' ? 'blue' : 'yellow'}>
                        {module.pricingTier}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {module.description}
                  </p>

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 mr-1" />
                      {module.rating.toFixed(1)}
                    </span>
                    <span className="flex items-center">
                      <Download className="w-4 h-4 mr-1" />
                      {module.downloads.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {module.category}
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleInstallModule(module.id)}
                    disabled={installingModuleId === module.id}
                  >
                    {installingModuleId === module.id ? (
                      <>
                        <Spinner size={16} />
                        <span className="ml-2">Installing...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Install Module
                      </>
                    )}
                  </Button>

                  {module.basePrice && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      ${module.basePrice}/month
                    </p>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {/* Info Alert */}
        <div className="mt-8">
          <Alert type="info" title="Module Management">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Core modules (Drive, Chat, Calendar) are automatically installed and cannot be removed</li>
              <li>Installing a module makes it available to all employees in your business</li>
              <li>Changes sync in real-time - employees will see new modules immediately</li>
              <li>You can configure module permissions from the module settings</li>
            </ul>
          </Alert>
        </div>
      </div>
    </div>
  );
}

