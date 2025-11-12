'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import { businessAPI } from '@/api/business';
import { BusinessBrandingProvider, BrandedHeader, BrandedButton } from '@/components/BusinessBranding';
import AvatarContextMenu from '@/components/AvatarContextMenu';
import BillingModal from '@/components/BillingModal';
import { getInstalledModules } from '@/api/modules';
import type { LucideIcon } from 'lucide-react';
import {
  Building2, 
  Users, 
  Palette, 
  Brain, 
  Package, 
  BarChart3, 
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Zap,
  Target,
  Briefcase,
  CreditCard,
  Layout,
  Folder,
  MessageSquare,
  Calendar,
  UserCheck
} from 'lucide-react';

interface Business {
  id: string;
  name: string;
  ein: string;
  einVerified: boolean;
  industry?: string;
  size?: string;
  website?: string;
  logo?: string;
  description?: string;
  tier?: string;  // Business tier field
  members: Array<{
    id: string;
    role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  dashboards: Array<{
    id: string;
    name: string;
  }>;
  subscriptions?: Array<{
    id: string;
    tier: string;
    status: string;
  }>;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
  aiDigitalTwin?: {
    id: string;
    name: string;
    status: string;
    totalInteractions: number;
  };
}

interface SetupStatus {
  orgChart: boolean;
  branding: boolean;
  modules: boolean;
  aiAssistant: boolean;
  employees: boolean;
}

interface InstalledModule {
  id: string;
  name: string;
  description?: string;
  status: string;
  category?: string;
  version?: string;
}

interface SidebarSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

export default function BusinessAdminPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const businessId = params?.id as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({
    orgChart: false,
    branding: false,
    modules: false,
    aiAssistant: false,
    employees: false
  });
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [installedModules, setInstalledModules] = useState<InstalledModule[]>([]);
  const [activeSection, setActiveSection] = useState<string>('overview');

  useEffect(() => {
    if (businessId && session?.accessToken) {
      loadBusinessData();
      checkSetupStatus();
    }
  }, [businessId, session?.accessToken]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      setError(null);

      const businessResponse = await businessAPI.getBusiness(businessId);

      if (businessResponse.success) {
        setBusiness(businessResponse.data as unknown as Business);
      }

      // Load installed modules
      try {
        const modules = await getInstalledModules({
          scope: 'business',
          businessId: businessId
        });
        setInstalledModules(modules);
      } catch (moduleError) {
        console.error('Failed to load installed modules:', moduleError);
        // Don't fail the whole page if modules can't load
        setInstalledModules([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business data');
    } finally {
      setLoading(false);
    }
  };

const truncateDescription = (value?: string) => {
  if (!value) {
    return 'Installed module';
  }

  if (value.length <= 120) {
    return value;
  }

  return `${value.slice(0, 117)}...`;
};

  const checkSetupStatus = async () => {
    try {
      const resp = await businessAPI.getBusinessSetupStatus(businessId);
      if (resp.success) {
        setSetupStatus(resp.data as any);
      }
    } catch (error) {
      console.error('Failed to check setup status:', error);
    }
  };

  const getSetupProgress = () => {
    const completed = Object.values(setupStatus).filter(Boolean).length;
    const total = Object.keys(setupStatus).length;
    return Math.round((completed / total) * 100);
  };

  const isOwnerOrAdmin = () => {
    if (!business || !session?.user?.id) return false;
    const userMember = business.members.find(m => m.user.id === session.user.id);
    return userMember?.role === 'ADMIN' || userMember?.role === 'MANAGER';
  };

  // Check if user can manage billing
  const canManageBilling = () => {
    if (!session?.user?.id) return false;
    return isOwnerOrAdmin();
  };

  const canManageBillingAccess = canManageBilling();

  const sidebarSections: SidebarSection[] = useMemo(() => {
    const sections: SidebarSection[] = [
      { id: 'overview', label: 'Overview', icon: Layout },
      { id: 'modules', label: 'Modules', icon: Package },
      { id: 'people', label: 'People & Access', icon: Users },
      { id: 'branding', label: 'Branding', icon: Palette },
      { id: 'ai', label: 'AI & Insights', icon: Brain },
    ];

    if (canManageBillingAccess) {
      sections.push({ id: 'subscription', label: 'Subscription', icon: CreditCard });
    }

    sections.push({ id: 'workspace', label: 'Workspace', icon: Briefcase });
    return sections;
  }, [canManageBillingAccess]);

  const sectionIds = useMemo(() => sidebarSections.map(section => section.id), [sidebarSections]);

  const handleNavClick = (sectionId: string) => {
    setActiveSection(sectionId);

    if (typeof window === 'undefined') {
      return;
    }

    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: '-120px 0px -60% 0px',
        threshold: [0.2, 0.4, 0.6],
      }
    );

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    elements.forEach((element) => observer.observe(element));

    return () => {
      elements.forEach((element) => observer.unobserve(element));
      observer.disconnect();
    };
  }, [sectionIds]);

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
        <Alert type="error" title="Error Loading Business">
          {error || 'Business not found'}
        </Alert>
      </div>
    );
  }

  if (!isOwnerOrAdmin()) {
    return (
      <div className="container mx-auto p-6">
        <Alert type="warning" title="Access Denied">
          You don't have permission to access the business admin dashboard.
        </Alert>
      </div>
    );
  }

  const setupProgress = getSetupProgress();
  const isSetupComplete = setupProgress === 100;

  // Get effective business tier (subscription tier or business tier)
  const getEffectiveTier = () => {
    if (business.subscriptions && business.subscriptions.length > 0) {
      const activeSub = business.subscriptions.find(s => s.status === 'active');
      if (activeSub) return activeSub.tier;
    }
    return business.tier || 'free';
  };

  const getTierBadgeColor = (tier: string): 'blue' | 'green' | 'gray' | 'yellow' | 'red' => {
    switch (tier) {
      case 'enterprise':
        return 'blue';
      case 'business_advanced':
        return 'yellow';
      case 'business_basic':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'Enterprise';
      case 'business_advanced':
        return 'Business Advanced';
      case 'business_basic':
        return 'Business Basic';
      case 'free':
        return 'Free';
      default:
        return 'Unknown';
    }
  };

  const effectiveTier = getEffectiveTier();

  // Get module icon based on module ID
  const getModuleIcon = (moduleId: string) => {
    switch (moduleId.toLowerCase()) {
      case 'drive':
        return Folder;
      case 'chat':
        return MessageSquare;
      case 'calendar':
        return Calendar;
      case 'hr':
        return UserCheck;
      case 'dashboard':
        return Layout;
      default:
        return Package;
    }
  };

  // Create branding object for the provider
  const branding = {
    id: business.id,
    name: business.name,
    logo: business.logo || business.branding?.logoUrl,
    primaryColor: business.branding?.primaryColor || '#3b82f6',
    secondaryColor: business.branding?.secondaryColor || '#1e40af',
    accentColor: '#f59e0b',
    fontFamily: '',
    customCSS: '',
  };

  return (
    <BusinessBrandingProvider initialBranding={branding}>
      <div className="min-h-screen bg-gray-900">
        <div className="sticky top-0 z-40">
          <BrandedHeader
            title={business.name}
            subtitle="Business Administration Dashboard"
          >
          <div className="flex items-center space-x-3">
            <BrandedButton
              onClick={() => router.push(`/business/${business.id}/workspace`)}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Briefcase className="w-4 h-4" />
              <span>Workspace</span>
            </BrandedButton>
            <BrandedButton
              onClick={() => router.push('/dashboard')}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <span>Personal</span>
            </BrandedButton>
            <AvatarContextMenu className="text-white" />
          </div>
          </BrandedHeader>
        </div>

        <div className="flex w-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <aside className="hidden w-64 flex-col border-r border-gray-800 bg-gray-900 text-white lg:flex">
            <nav className="flex-1 overflow-y-auto py-8">
              <p className="px-6 pb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Navigation
              </p>
              <div className="space-y-1">
                {sidebarSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleNavClick(section.id)}
                      className={`flex w-full items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{section.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </aside>

          <main className="flex-1 bg-gray-50">
            <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
              <div className="flex gap-2 overflow-x-auto">
                {sidebarSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleNavClick(section.id)}
                      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{section.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-auto max-w-6xl space-y-16 overflow-y-auto px-4 pb-16 pt-10" style={{ maxHeight: 'calc(100vh - 64px)' }}>
              <section id="overview" className="scroll-mt-24 space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Overview</h2>
                    <p className="text-sm text-gray-600">
                      Monitor setup progress and key metrics for {business.name}.
                    </p>
                  </div>
                  <Badge color={isSetupComplete ? 'green' : 'yellow'} size="sm">
                    {isSetupComplete ? 'Setup Complete' : 'Setup In Progress'}
                  </Badge>
                </div>

                {!isSetupComplete && (
                  <Card className="border border-blue-100 bg-blue-50 p-6 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-blue-900">Business Setup Progress</h3>
                        <p className="text-sm text-blue-700">
                          Complete your business setup to unlock all features for your team.
                        </p>
                      </div>
                      <span className="text-sm font-medium text-blue-900">{setupProgress}% Complete</span>
                    </div>
                    <div className="mt-4 h-2 w-full rounded-full bg-blue-200">
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${setupProgress}%` }}
                      />
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center">
                      <div className="rounded-lg bg-blue-100 p-2">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Team Members</p>
                        <p className="text-2xl font-bold text-gray-900">{business.members.length}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center">
                      <div className="rounded-lg bg-green-100 p-2">
                        <Package className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Active Modules</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {installedModules.length}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center">
                      <div className="rounded-lg bg-purple-100 p-2">
                        <Brain className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">AI Interactions</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {business.aiDigitalTwin?.totalInteractions || 0}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center">
                      <div className="rounded-lg bg-orange-100 p-2">
                        <Target className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Setup Progress</p>
                        <p className="text-2xl font-bold text-gray-900">{setupProgress}%</p>
                      </div>
                    </div>
                  </Card>
                </div>
              </section>

              <section id="modules" className="scroll-mt-24 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Modules</h2>
                    <p className="text-sm text-gray-600">
                      Install and configure the tools powering your workspace experience.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    className="flex items-center gap-2"
                    onClick={() => router.push(`/business/${businessId}/modules`)}
                  >
                    <Package className="h-4 w-4" />
                    Manage Modules
                  </Button>
                </div>

                {installedModules.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {installedModules.map((module) => {
                      const ModuleIcon = getModuleIcon(module.id);
                      const statusColor =
                        module.status === 'installed'
                          ? 'green'
                          : module.status === 'pending'
                          ? 'yellow'
                          : 'gray';

                      return (
                        <Card key={module.id} className="h-full p-5 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-50 p-2">
                              <ModuleIcon className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">{module.name}</h3>
                              <p className="text-xs uppercase tracking-wide text-gray-500">
                                {module.category || 'Core Module'}
                              </p>
                            </div>
                          </div>
                          <p className="mt-4 text-sm text-gray-600">
                            {truncateDescription(module.description)}
                          </p>
                          <div className="mt-4 flex items-center justify-between">
                            <Badge color={statusColor} size="sm">
                              {module.status === 'installed'
                                ? 'Active'
                                : module.status === 'pending'
                                ? 'Pending'
                                : 'Available'}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              v{module.version ?? '1.0.0'}
                            </span>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="flex flex-col gap-4 border border-dashed border-gray-300 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-amber-100 p-2">
                        <Package className="h-5 w-5 text-amber-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">No modules installed yet</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Install modules to unlock collaboration, automation, and analytics for your team.
                    </p>
                  </Card>
                )}

                <Card className="p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-100 p-2">
                        <Package className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Module Readiness</h3>
                        <p className="text-sm text-gray-600">
                          Keep modules aligned across personal and business contexts.
                        </p>
                      </div>
                    </div>
                    <Badge color={setupStatus.modules ? 'green' : 'yellow'} size="sm">
                      {setupStatus.modules ? 'Configured' : 'Action Required'}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                      <span>Installed Modules</span>
                      <Badge color={installedModules.length > 0 ? 'green' : 'gray'} size="sm">
                        {installedModules.length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                      <span>Status</span>
                      <span className="font-medium text-gray-900">
                        {setupStatus.modules ? 'Active' : 'Pending Setup'}
                      </span>
                    </div>
                  </div>
                </Card>
              </section>

              <section id="people" className="scroll-mt-24 space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">People & Access</h2>
                  <p className="text-sm text-gray-600">
                    Manage organizational structure, permissions, and team membership.
                  </p>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-100 p-2">
                          <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Organization Chart</h3>
                          <p className="text-sm text-gray-600">
                            Manage roles, permissions, and hierarchy.
                          </p>
                        </div>
                      </div>
                      <Badge color={setupStatus.orgChart ? 'green' : 'yellow'} size="sm">
                        {setupStatus.orgChart ? 'Configured' : 'Pending'}
                      </Badge>
                    </div>
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => router.push(`/business/${businessId}/org-chart`)}
                    >
                      <Building2 className="h-4 w-4" />
                      <span className="ml-2">
                        {setupStatus.orgChart ? 'Manage Org Chart' : 'Set Up Organization'}
                      </span>
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Button>
                  </Card>

                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center gap-3 pb-4">
                      <div className="rounded-lg bg-blue-100 p-2">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Team Management</h3>
                        <p className="text-sm text-gray-600">
                          Invite employees, assign roles, and maintain permissions.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => router.push(`/business/${businessId}/profile?tab=members`)}
                    >
                      <Users className="h-4 w-4" />
                      <span className="ml-2">Manage Team</span>
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Button>
                  </Card>
                </div>
              </section>

              <section id="branding" className="scroll-mt-24 space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Branding</h2>
                  <p className="text-sm text-gray-600">
                    Ensure every surface reflects your company identity across personal and business views.
                  </p>
                </div>

                <Card className="p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-indigo-100 p-2">
                        <Palette className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Business Branding</h3>
                        <p className="text-sm text-gray-600">
                          Centralize logos, colors, fonts, and front page messaging.
                        </p>
                      </div>
                    </div>
                    <Badge color="blue">Unified</Badge>
                  </div>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => router.push(`/business/${businessId}/branding`)}
                  >
                    <Palette className="h-4 w-4" />
                    <span className="ml-2">Configure Branding</span>
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Button>
                </Card>
              </section>

              <section id="ai" className="scroll-mt-24 space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">AI & Insights</h2>
                  <p className="text-sm text-gray-600">
                    Configure automation and review the intelligence supporting your business decisions.
                  </p>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-purple-100 p-2">
                          <Brain className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">AI Assistant</h3>
                          <p className="text-sm text-gray-600">Configure prompts, guardrails, and automations.</p>
                        </div>
                      </div>
                      <Badge color={setupStatus.aiAssistant ? 'green' : 'yellow'} size="sm">
                        {setupStatus.aiAssistant ? 'Active' : 'Not Configured'}
                      </Badge>
                    </div>
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => router.push(`/business/${businessId}/ai`)}
                    >
                      <Brain className="h-4 w-4" />
                      <span className="ml-2">
                        {setupStatus.aiAssistant ? 'Manage AI Assistant' : 'Set Up AI Assistant'}
                      </span>
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Button>
                  </Card>

                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center gap-3 pb-4">
                      <div className="rounded-lg bg-orange-100 p-2">
                        <BarChart3 className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
                        <p className="text-sm text-gray-600">
                          Review performance, adoption, and compliance metrics for your organization.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => router.push(`/business/${businessId}/profile?tab=analytics`)}
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span className="ml-2">View Analytics</span>
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Button>
                  </Card>
                </div>
              </section>

              {canManageBillingAccess && (
                <section id="subscription" className="scroll-mt-24 space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Subscription</h2>
                    <p className="text-sm text-gray-600">
                      Manage billing, seat counts, and plan upgrades for your business.
                    </p>
                  </div>

                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-purple-100 p-2">
                          <CreditCard className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Billing & Subscription</h3>
                          <p className="text-sm text-gray-600">
                            Update payment details, seats, and plan tiers whenever you need.
                          </p>
                        </div>
                      </div>
                      <Badge color="green">Active</Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                        <span className="text-sm font-medium text-gray-700">Current Plan</span>
                        <Badge color={getTierBadgeColor(effectiveTier)}>
                          {getTierDisplayName(effectiveTier)}
                        </Badge>
                      </div>

                      {!business.tier && !business.subscriptions?.length && (
                        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
                          ⚠️ Tier not set. Some features may be unavailable.
                        </div>
                      )}

                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => setShowBillingModal(true)}
                      >
                        <CreditCard className="h-4 w-4" />
                        <span className="ml-2">Manage Billing & Subscriptions</span>
                        <ArrowRight className="ml-auto h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </section>
              )}

              <section id="workspace" className="scroll-mt-24 space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Workspace & Actions</h2>
                  <p className="text-sm text-gray-600">
                    Launch the daily workspace and wrap up outstanding setup tasks.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="p-6 shadow-sm">
                    <div className="flex items-center gap-3 pb-4">
                      <div className="rounded-lg bg-gray-100 p-2">
                        <Briefcase className="h-6 w-6 text-gray-700" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Business Workspace</h3>
                        <p className="text-sm text-gray-600">
                          Enter the live workspace to collaborate with your team.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => router.push(`/business/${businessId}/workspace`)}
                    >
                      <Briefcase className="h-4 w-4" />
                      <span className="ml-2">Open Workspace</span>
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Button>
                  </Card>

                  {!isSetupComplete && (
                    <Card className="p-6 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="rounded-lg bg-orange-100 p-2">
                          <Zap className="h-6 w-6 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Complete Your Setup
                          </h3>
                          <p className="mt-2 text-sm text-gray-600">
                            You&apos;re {setupProgress}% done—finish the remaining steps to unlock all features.
                          </p>
                          <div className="mt-4 space-y-2 text-sm text-gray-600">
                            {!setupStatus.orgChart && (
                              <div className="flex items-center">
                                <AlertCircle className="mr-2 h-4 w-4 text-orange-500" />
                                Set up your organization chart and permissions.
                              </div>
                            )}
                            {!setupStatus.aiAssistant && (
                              <div className="flex items-center">
                                <AlertCircle className="mr-2 h-4 w-4 text-orange-500" />
                                Configure your business AI assistant.
                              </div>
                            )}
                            {!setupStatus.branding && (
                              <div className="flex items-center">
                                <AlertCircle className="mr-2 h-4 w-4 text-orange-500" />
                                Customize your business branding.
                              </div>
                            )}
                            {!setupStatus.employees && (
                              <div className="flex items-center">
                                <AlertCircle className="mr-2 h-4 w-4 text-orange-500" />
                                Invite your team members.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>

      {canManageBillingAccess && (
        <BillingModal
          isOpen={showBillingModal}
          onClose={() => setShowBillingModal(false)}
        />
      )}
    </BusinessBrandingProvider>
  );
}
