'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import { 
  getInstalledModules, 
  getMarketplaceModules, 
  installModule, 
  uninstallModule,
  type Module as ApiModule 
} from '../../api/modules';
import { useWorkAuth } from '../../contexts/WorkAuthContext';
import { businessAPI } from '../../api/business';
import { 
  Puzzle, 
  Download, 
  Upload, 
  Settings, 
  Star, 
  Users, 
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  Lock,
  CalendarClock,
  CheckSquare,
  Folder,
  MessageSquare,
  LayoutDashboard,
  Brain,
  Shield,
  BarChart,
  Briefcase,
  UserCheck
} from 'lucide-react';
import { useFeatureGating } from '@/hooks/useFeatureGating';

type TabType = 'installed' | 'marketplace' | 'submit' | 'analytics';

// Use the API Module interface instead of local interface

export default function ModulesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('installed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<ApiModule[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPricingTier, setSelectedPricingTier] = useState('all');
  const [scope, setScope] = useState<'personal' | 'business'>('personal');
  const { currentBusinessId } = useWorkAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const { checkFeatureAccess, features, loading: featuresLoading } = useFeatureGating();
  const [businessFeatures, setBusinessFeatures] = useState<any>(null);
  const [modulePermissions, setModulePermissions] = useState<{[key: string]: any[]}>({});

  useEffect(() => {
    // load businesses to power dropdown
    setLoadingBusinesses(true);
    businessAPI.getUserBusinesses().then((res) => {
      if (res?.success) {
        setBusinesses(res.data.map((b: any) => ({ id: b.id, name: b.name })));
        // Auto-select first business if none selected and in business scope
        if (scope === 'business' && !businessId && res.data.length > 0) {
          setBusinessId(res.data[0].id);
        }
      }
    }).catch(() => {}).finally(() => {
      setLoadingBusinesses(false);
    });
  }, [scope, businessId]);

  // Load persisted scope/businessId preferences
  useEffect(() => {
    try {
      const savedScope = localStorage.getItem('modules:scope') as 'personal' | 'business' | null;
      const savedBusinessId = localStorage.getItem('modules:businessId');
      if (savedScope) setScope(savedScope);
      if (savedBusinessId) setBusinessId(savedBusinessId || null);
    } catch {}
  }, []);

  // Persist preferences on change
  useEffect(() => {
    try {
      localStorage.setItem('modules:scope', scope);
      if (scope === 'business') {
        localStorage.setItem('modules:businessId', businessId || '');
      } else {
        localStorage.removeItem('modules:businessId');
      }
    } catch {}
  }, [scope, businessId]);

  useEffect(() => {
    if (scope === 'business') {
      setBusinessId(currentBusinessId);
    }
  }, [scope, currentBusinessId]);

  // Load business features when in business scope
  useEffect(() => {
    if (scope === 'business' && businessId) {
      // Use the features from the hook instead of calling a non-existent method
      const businessFeaturesData = Object.values(features).filter((f: any) => f.hasAccess);
      setBusinessFeatures({
        subscriptionTier: businessFeaturesData.length > 0 ? 'standard' : 'free',
        moduleLimit: 'Unlimited',
        installedModules: modules.length
      });
    } else {
      setBusinessFeatures(null);
    }
  }, [scope, businessId, features, modules.length]);

  // Load module permissions for business scope
  useEffect(() => {
    if (scope === 'business' && businessId) {
      // Mock permissions data - in real app this would come from API
      setModulePermissions({
        '1': [
          { userId: 'user1', name: 'John Doe', role: 'ADMIN', access: 'full' },
          { userId: 'user2', name: 'Jane Smith', role: 'MANAGER', access: 'read-write' },
          { userId: 'user3', name: 'Bob Johnson', role: 'MEMBER', access: 'read-only' }
        ],
        '2': [
          { userId: 'user1', name: 'John Doe', role: 'ADMIN', access: 'full' },
          { userId: 'user2', name: 'Jane Smith', role: 'MANAGER', access: 'read-write' }
        ]
      });
    } else {
      setModulePermissions({});
    }
  }, [scope, businessId]);

  // Get active tab from URL params
  useEffect(() => {
    const tab = searchParams?.get('tab') as TabType;
    if (tab && ['installed', 'marketplace', 'submit', 'analytics'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/modules?tab=${tab}`);
  };

  // Load modules based on active tab
  useEffect(() => {
    const loadModules = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (activeTab === 'installed') {
          const installedModules = await getInstalledModules({ scope, businessId: scope === 'business' ? businessId || undefined : undefined });
          setModules(installedModules);
        } else if (activeTab === 'marketplace') {
          const marketplaceModules = await getMarketplaceModules({ scope, businessId: scope === 'business' ? businessId || undefined : undefined });
          setModules(marketplaceModules);
        }
      } catch (err) {
        console.error('Error loading modules:', err);
        setError('Failed to load modules. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, [activeTab, searchTerm, selectedCategory, selectedPricingTier, scope, businessId]);

  // Map icon name strings to lucide-react icon components
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      'users': Users,
      'Users': Users,
      'calendar-clock': CalendarClock,
      'CalendarClock': CalendarClock,
      'checksquare': CheckSquare,
      'CheckSquare': CheckSquare,
      'calendar': Calendar,
      'Calendar': Calendar,
      'drive': Folder,
      'Drive': Folder,
      'folder': Folder,
      'Folder': Folder,
      'chat': MessageSquare,
      'Chat': MessageSquare,
      'messagesquare': MessageSquare,
      'MessageSquare': MessageSquare,
      'dashboard': LayoutDashboard,
      'Dashboard': LayoutDashboard,
      'layoutdashboard': LayoutDashboard,
      'LayoutDashboard': LayoutDashboard,
      'ai': Brain,
      'AI': Brain,
      'brain': Brain,
      'Brain': Brain,
      'analytics': BarChart3,
      'Analytics': BarChart3,
      'barchart': BarChart3,
      'BarChart': BarChart3,
      'barchart3': BarChart3,
      'BarChart3': BarChart3,
      'admin': Settings,
      'Admin': Settings,
      'settings': Settings,
      'Settings': Settings,
      'members': Users,
      'Members': Users,
      'hr': UserCheck,
      'HR': UserCheck,
      'usercheck': UserCheck,
      'UserCheck': UserCheck,
      'scheduling': CalendarClock,
      'Scheduling': CalendarClock,
      'tasks': CheckSquare,
      'Tasks': CheckSquare,
      'todo': CheckSquare,
      'Todo': CheckSquare,
      'briefcase': Briefcase,
      'Briefcase': Briefcase,
    };

    // Normalize icon name (lowercase, remove spaces/dashes)
    const normalized = iconName.toLowerCase().replace(/[\s-]/g, '');
    
    // Try exact match first
    if (iconMap[iconName]) {
      const IconComponent = iconMap[iconName];
      return <IconComponent className="w-6 h-6" />;
    }
    
    // Try normalized match
    if (iconMap[normalized]) {
      const IconComponent = iconMap[normalized];
      return <IconComponent className="w-6 h-6" />;
    }
    
    return null;
  };

  const getModuleIcon = (module: ApiModule) => {
    // If module.icon exists, try to map it to an icon component
    if (module.icon) {
      // Check if it's a URL (starts with http:// or https://)
      if (module.icon.startsWith('http://') || module.icon.startsWith('https://') || module.icon.startsWith('/')) {
        return <img src={module.icon} alt={module.name} className="w-6 h-6" />;
      }
      
      // Otherwise, treat it as an icon name and map it
      const iconComponent = getIconComponent(module.icon);
      if (iconComponent) {
        return iconComponent;
      }
    }
    
    // Fallback to name-based mapping
    switch (module.name.toLowerCase()) {
      case 'dashboard':
        return <LayoutDashboard className="w-6 h-6" />;
      case 'drive':
        return <Folder className="w-6 h-6" />;
      case 'chat':
        return <MessageSquare className="w-6 h-6" />;
      case 'calendar':
        return <Calendar className="w-6 h-6" />;
      case 'members':
        return <Users className="w-6 h-6" />;
      case 'hr':
        return <UserCheck className="w-6 h-6" />;
      case 'scheduling':
        return <CalendarClock className="w-6 h-6" />;
      case 'tasks':
      case 'todo':
        return <CheckSquare className="w-6 h-6" />;
      case 'analytics':
        return <BarChart3 className="w-6 h-6" />;
      case 'admin':
        return <Settings className="w-6 h-6" />;
      default:
        return <Puzzle className="w-6 h-6" />;
    }
  };

  const getStatusBadge = (status: ApiModule['status']) => {
    switch (status) {
      case 'installed':
        return <Badge color="green" size="sm">Installed</Badge>;
      case 'available':
        return <Badge color="blue" size="sm">Available</Badge>;
      case 'pending':
        return <Badge color="yellow" size="sm">Pending</Badge>;
      default:
        return null;
    }
  };

  const handleInstallModule = async (moduleId: string) => {
    setActionLoading(moduleId);
    try {
      const module = modules.find(m => m.id === moduleId);
      
      if (module?.pricingTier && module.pricingTier !== 'free') {
        // Handle paid module installation
        if (module.pricingTier === 'enterprise') {
          // Redirect to enterprise contact form or billing
          router.push(`/billing?module=${moduleId}`);
          return;
        }
        
        // Create subscription for premium modules
        const response = await fetch('/api/billing/modules/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            moduleId,
            tier: module.pricingTier,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to create subscription');
        }
      }
      
      // Install the module
      await installModule(moduleId, { scope, businessId: scope === 'business' ? businessId || undefined : undefined });
      
      // Refresh the modules list
      const loadModules = async () => {
        if (activeTab === 'installed') {
          const installedModules = await getInstalledModules({ scope, businessId: scope === 'business' ? businessId || undefined : undefined });
          setModules(installedModules);
        } else if (activeTab === 'marketplace') {
          const marketplaceModules = await getMarketplaceModules({ scope, businessId: scope === 'business' ? businessId || undefined : undefined });
          setModules(marketplaceModules);
        }
      };
      loadModules();
      
    } catch (error) {
      console.error('Error installing module:', error);
      setError('Failed to install module. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstallModule = async (moduleId: string) => {
    setActionLoading(moduleId);
    try {
      await uninstallModule(moduleId, { scope, businessId: scope === 'business' ? businessId || undefined : undefined });
      // Refresh the modules list
      if (activeTab === 'installed') {
        const installedModules = await getInstalledModules({ scope, businessId: scope === 'business' ? businessId || undefined : undefined });
        setModules(installedModules);
      }
    } catch (err) {
      console.error('Error uninstalling module:', err);
      setError('Failed to uninstall module. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const renderInstalledTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Installed Modules</h2>
          <p className="text-gray-600">Manage your installed modules and their settings</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${scope === 'personal' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
              onClick={() => setScope('personal')}
            >
              Personal
            </button>
            <button
              className={`px-3 py-1 text-sm ${scope === 'business' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
              onClick={() => setScope('business')}
            >
              Business
            </button>
          </div>
          {scope === 'business' && (
            <select
              value={businessId || currentBusinessId || ''}
              onChange={(e) => setBusinessId(e.target.value || null)}
              className="px-2 py-1 border border-gray-300 rounded"
            >
              <option value="">Select business</option>
              {loadingBusinesses ? (
                <option value="">Loading businesses...</option>
              ) : businesses.length === 0 ? (
                <option value="">No businesses found</option>
              ) : (
                businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))
              )}
            </select>
          )}
          <Button onClick={() => handleTabChange('marketplace')}>
            <Download className="w-4 h-4 mr-2" />
            Browse Marketplace
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size={32} />
          <span className="ml-2">Loading modules...</span>
        </div>
      ) : modules.length === 0 ? (
        <Card className="p-8 text-center">
          <Puzzle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No modules installed</h3>
          <p className="text-gray-600 mb-4">Get started by browsing the marketplace for modules</p>
          <Button onClick={() => handleTabChange('marketplace')}>
            Browse Marketplace
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card key={module.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {getModuleIcon(module)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{module.name}</h3>
                    <p className="text-sm text-gray-600">{module.developer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {module.isBuiltIn && (
                    <span className="text-xs px-2 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">
                      Built-in
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded border ${scope === 'business' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {scope === 'business' ? 'Business' : 'Personal'}
                  </span>
                  {getStatusBadge(module.status)}
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-4">{module.description}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>v{module.version}</span>
                <span>{module.category}</span>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => router.push(`/modules/run/${module.id}?scope=${scope}${scope === 'business' && businessId ? `&businessId=${businessId}` : ''}`)}
                >
                  Open
                </Button>
                {!module.isBuiltIn && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => handleUninstallModule(module.id)}
                    disabled={actionLoading === module.id}
                  >
                    {actionLoading === module.id ? (
                      <Spinner size={16} />
                    ) : (
                      'Uninstall'
                    )}
                  </Button>
                )}
                {module.isBuiltIn && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    disabled
                    title="Built-in modules cannot be uninstalled"
                  >
                    <Lock className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              {/* Show permissions for business users */}
              {scope === 'business' && businessId && modulePermissions[module.id] && (
                renderModulePermissions(module.id)
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderMarketplaceTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Marketplace</h2>
          <p className="text-gray-600">Discover and install new modules to extend your workspace</p>
        </div>
        <div className="flex space-x-3 items-center">
          <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${scope === 'personal' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
              onClick={() => setScope('personal')}
            >
              Personal
            </button>
            <button
              className={`px-3 py-1 text-sm ${scope === 'business' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
              onClick={() => setScope('business')}
            >
              Business
            </button>
          </div>
          {scope === 'business' && (
            <input
              type="text"
              value={businessId || ''}
              onChange={(e) => setBusinessId(e.target.value || null)}
              placeholder="Business ID"
              className="px-2 py-1 border border-gray-300 rounded"
            />
          )}
          <Button onClick={() => router.push('/modules/submit')}>
            <Upload className="w-4 h-4 mr-2" />
            Submit Module
          </Button>
          <Button variant="secondary" onClick={() => router.push('/modules/admin')}>
            <Settings className="w-4 h-4 mr-2" />
            Admin Review
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search modules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select 
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="PRODUCTIVITY">Productivity</option>
          <option value="COMMUNICATION">Communication</option>
          <option value="ANALYTICS">Analytics</option>
          <option value="DEVELOPMENT">Development</option>
          <option value="ENTERTAINMENT">Entertainment</option>
          <option value="EDUCATION">Education</option>
          <option value="FINANCE">Finance</option>
          <option value="HEALTH">Health</option>
          <option value="OTHER">Other</option>
        </select>
        <select 
          value={selectedPricingTier}
          onChange={(e) => setSelectedPricingTier(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Pricing</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size={32} />
          <span className="ml-2">Loading marketplace...</span>
        </div>
      ) : modules.length === 0 ? (
        <Card className="p-8 text-center">
          <Puzzle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No modules available</h3>
          <p className="text-gray-600 mb-4">Check back soon for new modules in the marketplace!</p>
          <Button onClick={() => handleTabChange('submit')}>
            Submit Your Module
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card key={module.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {getModuleIcon(module)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{module.name}</h3>
                    <p className="text-sm text-gray-600">{module.developer}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <span className={`text-xs px-2 py-0.5 rounded border ${scope === 'business' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {scope === 'business' ? 'Business' : 'Personal'}
                  </span>
                  {getStatusBadge(module.status)}
                  {module.pricingTier && (
                    <Badge className={
                      module.pricingTier === 'free' ? 'bg-green-100 text-green-800' :
                      module.pricingTier === 'premium' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }>
                      {module.pricingTier === 'free' ? 'Free' :
                       module.pricingTier === 'premium' ? 'Premium' : 'Enterprise'}
                    </Badge>
                  )}
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-4">{module.description}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>v{module.version}</span>
                <span>{module.category}</span>
              </div>
              
              {/* Pricing Information */}
              {module.pricingTier && module.pricingTier !== 'free' && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Pricing:</span>
                    <span className="text-gray-900">
                      ${module.basePrice}/month
                      {module.enterprisePrice && module.enterprisePrice !== module.basePrice && (
                        <span className="text-gray-500 ml-1">
                          (Enterprise: ${module.enterprisePrice}/month)
                        </span>
                      )}
                    </span>
                  </div>
                  {module.subscriptionStatus && (
                    <div className="mt-1 text-xs text-gray-500">
                      Subscription: {module.subscriptionStatus}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span>{module.rating.toFixed(1)}</span>
                  <span>({module.reviewCount})</span>
                </div>
                <span>{module.downloads} downloads</span>
              </div>
              
              <div className="flex space-x-2">
                {module.status === 'installed' ? (
                  <Button variant="secondary" size="sm" className="flex-1" disabled>
                    {module.isBuiltIn ? 'Built-in' : 'Installed'}
                  </Button>
                ) : (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleInstallModule(module.id)}
                    disabled={actionLoading === module.id}
                  >
                    {actionLoading === module.id ? (
                      <Spinner size={16} />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        {module.pricingTier === 'free' ? 'Install' : 'Subscribe'}
                      </>
                    )}
                  </Button>
                )}
                <Button variant="secondary" size="sm">
                  Details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderSubmitTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Submit Module</h2>
          <p className="text-gray-600">Share your module with the community</p>
        </div>
        <Button variant="secondary" onClick={() => handleTabChange('marketplace')}>
          Browse Marketplace
        </Button>
      </div>

      <Card className="p-8 text-center">
        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Submit Your Module?</h3>
        <p className="text-gray-600 mb-4">
          Create and submit your module to the marketplace. Our team will review your submission 
          and get back to you within 2-3 business days.
        </p>
        <div className="space-y-4">
          <Button onClick={() => router.push('/modules/submit')}>
            <Upload className="w-4 h-4 mr-2" />
            Start Submission
          </Button>
          <div className="text-sm text-gray-500">
            <p>What you'll need:</p>
            <ul className="mt-2 space-y-1">
              <li>• Module name, description, and version</li>
              <li>• Category and relevant tags</li>
              <li>• Required permissions and dependencies</li>
              <li>• Module icon and screenshots</li>
              <li>• README documentation</li>
              <li>• License information</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderModulePermissions = (moduleId: string) => {
    const permissions = modulePermissions[moduleId] || [];
    
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">Team Access</h4>
          <Button size="sm" variant="secondary" className="text-xs">
            Manage Access
          </Button>
        </div>
        <div className="space-y-2">
          {permissions.map((permission, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                  {permission.name.charAt(0)}
                </div>
                <span className="text-gray-700">{permission.name}</span>
                <Badge color="gray" size="sm">{permission.role}</Badge>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                permission.access === 'full' ? 'bg-red-100 text-red-700' :
                permission.access === 'read-write' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {permission.access}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAnalyticsTab = () => {
    if (scope !== 'business' || !businessId) {
      return (
        <Card className="p-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Unavailable</h3>
          <p className="text-gray-600 mb-4">Module analytics are only available for business users</p>
          <Button onClick={() => setScope('business')}>
            Switch to Business Mode
          </Button>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Module Analytics</h2>
            <p className="text-gray-600">Track module usage and team activity across your business</p>
          </div>
        </div>

        {/* Analytics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Modules</p>
                <p className="text-2xl font-bold text-gray-900">{modules.length}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Puzzle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.values(modulePermissions).flat().filter((p: any) => p.access !== 'read-only').length}
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Most Used</p>
                <p className="text-2xl font-bold text-gray-900">Dashboard</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Module Usage Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Module Usage This Month</h3>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600">Usage charts coming soon</p>
            </div>
          </div>
        </Card>

        {/* Team Activity */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Team Activity</h3>
          <div className="space-y-3">
            {Object.values(modulePermissions).flat().slice(0, 5).map((permission: any, index: number) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  {permission.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{permission.name}</p>
                  <p className="text-xs text-gray-600">Accessed Dashboard module</p>
                </div>
                <span className="text-xs text-gray-500">2 hours ago</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Module Management</h1>
          <p className="text-gray-600 mt-2">
            Manage your installed modules, discover new ones, and submit your own
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => handleTabChange('installed')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'installed'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Installed
              </button>
              <button
                onClick={() => handleTabChange('marketplace')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'marketplace'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Marketplace
              </button>
              <button
                onClick={() => handleTabChange('submit')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'submit'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Submit
              </button>
              {scope === 'business' && businessId && (
                <button
                  onClick={() => handleTabChange('analytics')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'analytics'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Analytics
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert type="error" title="Error" className="mb-6">
            {error}
          </Alert>
        )}


        {/* Tab Content */}
        {activeTab === 'installed' && renderInstalledTab()}
        {activeTab === 'marketplace' && renderMarketplaceTab()}
        {activeTab === 'submit' && renderSubmitTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
      </div>
    </div>
  );
} 