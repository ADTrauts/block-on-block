'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Card, Button, Input, Alert, Spinner } from 'shared/components';
import { adminApiService } from '../../../lib/adminApiService';
import { useImpersonation } from '../../../contexts/ImpersonationContext';
import { 
  Users, 
  Search, 
  Eye, 
  User, 
  Mail, 
  Calendar,
  Shield,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Clock,
  Monitor,
  Maximize2,
  Minimize2,
  Building2,
  Layers,
  Sparkles,
  Gauge,
  ChevronRight,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

interface DirectoryUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  emailVerified: string | null;
  _count?: {
    businesses: number;
    files: number;
  };
}

interface ImpersonationSession {
  id: string;
  targetUser: {
    id: string;
    email: string;
    name: string | null;
  };
  startedAt: string;
  reason?: string | null;
  businessId?: string | null;
  business?: {
    id: string;
    name: string;
  } | null;
  context?: string | null;
  expiresAt?: string | null;
}

interface BusinessSummary {
  id: string;
  name: string;
  tier: string;
  industry?: string | null;
  size?: string | null;
  createdAt: string;
  memberCount: number;
  employeePositionCount: number;
  moduleCount: number;
  hrEnabledFeatures: unknown;
}

interface BusinessDetail {
  id: string;
  name: string;
  tier: string;
  industry?: string | null;
  size?: string | null;
  createdAt: string;
  hrEnabledFeatures: unknown;
}

interface BusinessMember {
  id: string;
  role: string;
  title: string | null;
  department: string | null;
  joinedAt: string;
  canManage: boolean;
  canInvite: boolean;
  canBilling: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface BusinessModule {
  id: string;
  moduleId: string;
  moduleName: string;
  category: string | null;
  installedAt: string;
  enabled: boolean;
}

interface SeedPersona {
  role: 'MANAGER' | 'EMPLOYEE';
  userId: string;
  email: string;
  name: string | null;
  businessMemberId: string;
  employeePositionId: string | null;
  hrProfileId: string | null;
  temporaryPassword?: string;
}

type RoleFilter = 'ALL' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

const BUSINESS_CONTEXT_OPTIONS = [
  'Business Workspace',
  'Admin Dashboard',
  'Manager Workspace',
  'Employee Workspace',
  'HR Management',
];

export default function ImpersonationLabPage() {
  const {
    startImpersonation,
    endImpersonation,
    isImpersonating,
    currentSession,
  } = useImpersonation();

  // --- Tab State -----------------------------------------------------------
  const [activeTab, setActiveTab] = useState<'business' | 'user'>('business');

  // --- User Directory State ------------------------------------------------
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);

  // --- Business Personas State --------------------------------------------
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [businessSuccess, setBusinessSuccess] = useState<string | null>(null);
  const [businessSearchTerm, setBusinessSearchTerm] = useState('');
  const [businessPage, setBusinessPage] = useState(1);
  const [businessTotalPages, setBusinessTotalPages] = useState(1);
  const [selectedBusiness, setSelectedBusiness] =
    useState<BusinessSummary | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seededPersonas, setSeededPersonas] = useState<SeedPersona[]>([]);
  const [businessDetails, setBusinessDetails] =
    useState<BusinessDetail | null>(null);
  const [businessMembers, setBusinessMembers] = useState<BusinessMember[]>([]);
  const [businessMembersLoading, setBusinessMembersLoading] = useState(false);
  const [businessModules, setBusinessModules] = useState<BusinessModule[]>([]);
  const [businessMembersSearch, setBusinessMembersSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] =
    useState<RoleFilter>('ALL');
  const [businessImpersonationContext, setBusinessImpersonationContext] =
    useState<string>('Business Workspace');
  const [businessImpersonationReason, setBusinessImpersonationReason] =
    useState<string>('');

  // --- Shared Impersonation State -----------------------------------------
  const [showUserDashboard, setShowUserDashboard] = useState(false);
  const [userDashboardUrl, setUserDashboardUrl] = useState('');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Helpers -------------------------------------------------------------
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const parseFeatureKeys = (value: unknown): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (typeof entry === 'object' && entry && 'name' in entry)
            return String((entry as Record<string, unknown>).name);
          return null;
        })
        .filter((item): item is string => !!item);
    }
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .filter(([, enabled]) => {
          if (typeof enabled === 'boolean') return enabled;
          if (typeof enabled === 'number') return enabled > 0;
          return Boolean(enabled);
        })
        .map(([feature]) => feature);
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parseFeatureKeys(parsed);
      } catch {
        return [value];
      }
    }
    return [];
  };

  // --- Load Users ---------------------------------------------------------
  const loadUsers = useCallback(async () => {
    try {
      setUserLoading(true);
      setUserError(null);

      const response = await adminApiService.getUsers({
        page: userPage,
        limit: 20,
        search: userSearchTerm || undefined,
      });

      if (response.error) {
        setUserError(response.error);
        return;
      }

      const data = response.data as any;
      setUsers(data.users || []);
      setUserTotalPages(data.totalPages || 1);
    } catch (err) {
      setUserError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setUserLoading(false);
    }
  }, [userPage, userSearchTerm]);

  useEffect(() => {
    if (activeTab === 'user') {
    loadUsers();
    }
  }, [activeTab, loadUsers]);

  // --- Load Businesses ----------------------------------------------------
  const loadBusinesses = useCallback(async () => {
    try {
      setBusinessLoading(true);
      setBusinessError(null);

      const response = await adminApiService.getImpersonationBusinesses({
        page: businessPage,
        limit: 12,
        search: businessSearchTerm || undefined,
      });

      if (response.error) {
        setBusinessError(response.error);
        return;
      }

      const data = response.data as any;
      setBusinesses(data.businesses || []);
      setBusinessTotalPages(data.totalPages || 1);
    } catch (err) {
      setBusinessError('Failed to load businesses');
      console.error('Error loading businesses:', err);
    } finally {
      setBusinessLoading(false);
    }
  }, [businessPage, businessSearchTerm]);

  useEffect(() => {
    if (activeTab === 'business') {
      loadBusinesses();
    }
  }, [activeTab, loadBusinesses]);

  const loadBusinessMembers = useCallback(
    async (businessId: string, business: BusinessSummary) => {
      try {
        setBusinessMembersLoading(true);
        setBusinessError(null);

        const response =
          await adminApiService.getImpersonationBusinessMembers(businessId);

        if (response.error) {
          setBusinessError(response.error);
          return;
        }

        const data = response.data as any;
        const detail: BusinessDetail = {
          id: business.id,
          name: business.name,
          tier: business.tier,
          industry: business.industry,
          size: business.size,
          createdAt: business.createdAt,
          hrEnabledFeatures:
            data.business?.hrModuleSettings?.enabledFeatures ?? null,
        };

        setBusinessDetails(detail);
        setBusinessMembers(data.members || []);
        setBusinessModules(data.modules || []);
        setMemberRoleFilter('ALL');
        setBusinessMembersSearch('');
        setBusinessImpersonationReason(
          `Business impersonation for ${business.name}`,
        );
        setBusinessImpersonationContext('Business Workspace');
      } catch (err) {
        setBusinessError('Failed to load business members');
        console.error('Error loading business members:', err);
      } finally {
        setBusinessMembersLoading(false);
      }
    },
    [],
  );

  // --- Timer for impersonation session ------------------------------------
  useEffect(() => {
    if (isImpersonating && currentSession) {
      const startTime = new Date(currentSession.startedAt).getTime();
      
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }

      setElapsedTime(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    return undefined;
  }, [isImpersonating, currentSession]);

  // --- Business Select Handlers -------------------------------------------
  const handleBusinessSearch = () => {
    setBusinessPage(1);
    loadBusinesses();
  };

  const handleSelectBusiness = async (business: BusinessSummary) => {
    setSelectedBusiness(business);
    setBusinessSuccess(null);
    setSeededPersonas([]);
    await loadBusinessMembers(business.id, business);
  };

  const handleSeedPersonas = async () => {
    if (!selectedBusiness) return;
    try {
      setSeeding(true);
      setBusinessError(null);
      setBusinessSuccess(null);
      setSeededPersonas([]);

      const response = await adminApiService.seedImpersonationPersonas(
        selectedBusiness.id,
      );

      if (response.error) {
        setBusinessError(response.error);
        return;
      }

      const personas =
        (response.data?.personas as SeedPersona[] | undefined) ?? [];
      setSeededPersonas(personas);
      setBusinessSuccess(
        response.data?.message ??
          'Impersonation lab personas are now available.',
      );

      await loadBusinessMembers(selectedBusiness.id, selectedBusiness);
      await loadBusinesses();
    } catch (err) {
      setBusinessError('Failed to generate personas');
      console.error('Seed personas error:', err);
    } finally {
      setSeeding(false);
    }
  };

  const handleBusinessImpersonation = async (member: BusinessMember) => {
    if (!selectedBusiness) return;
    try {
      setImpersonating(true);
      setBusinessError(null);

      const reason =
        businessImpersonationReason ||
        `Business impersonation for ${selectedBusiness.name}`;

      const success = await startImpersonation(member.user.id, reason, {
        businessId: selectedBusiness.id,
        context: businessImpersonationContext,
      });

      if (success) {
        setUserDashboardUrl(
          `/business/${selectedBusiness.id}/workspace?impersonated=true`,
        );
        setShowUserDashboard(true);
      } else {
        setBusinessError('Failed to start impersonation');
      }
    } catch (err) {
      setBusinessError('Failed to start impersonation');
      console.error('Business impersonation error:', err);
    } finally {
      setImpersonating(false);
    }
  };

  // --- User directory handlers -------------------------------------------
  const handleUserSearch = () => {
    setUserPage(1);
    loadUsers();
  };

  const handleUserImpersonate = (user: DirectoryUser) => {
    setSelectedUser(user);
    setShowConfirmModal(true);
  };

  const confirmUserImpersonation = async () => {
    if (!selectedUser) return;
    try {
      setImpersonating(true);
      setUserError(null);

      const success = await startImpersonation(
        selectedUser.id, 
        `Admin impersonation for user management - ${selectedUser.email}`,
      );

      if (success) {
        setUserDashboardUrl(
          `/dashboard?impersonated=true&userId=${selectedUser.id}`,
        );
        setShowUserDashboard(true);
        setShowConfirmModal(false);
        setSelectedUser(null);
      } else {
        setUserError('Failed to start impersonation');
      }
    } catch (err) {
      setUserError('Failed to start impersonation');
      console.error('Impersonation error:', err);
    } finally {
      setImpersonating(false);
    }
  };

  const handleEndImpersonation = async () => {
    try {
      const success = await endImpersonation();
      if (success) {
        setShowUserDashboard(false);
        setUserDashboardUrl('');
        setElapsedTime(0);
        window.location.reload();
      } else {
        setUserError('Failed to end impersonation');
        setBusinessError('Failed to end impersonation');
      }
    } catch (err) {
      setUserError('Failed to end impersonation');
      setBusinessError('Failed to end impersonation');
    }
  };

  // --- Derived Data -------------------------------------------------------
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const term = userSearchTerm.toLowerCase();
      return (
        user.email.toLowerCase().includes(term) ||
        (user.name || '').toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term)
      );
    });
  }, [users, userSearchTerm]);

  const filteredBusinessMembers = useMemo(() => {
    const roleFiltered =
      memberRoleFilter === 'ALL'
        ? businessMembers
        : businessMembers.filter(
            (member) => member.role === memberRoleFilter,
          );

    if (!businessMembersSearch) return roleFiltered;

    const term = businessMembersSearch.toLowerCase();
    return roleFiltered.filter((member) => {
      const name = (member.user.name || '').toLowerCase();
      const email = member.user.email.toLowerCase();
      const title = (member.title || '').toLowerCase();
      return (
        name.includes(term) ||
        email.includes(term) ||
        title.includes(term) ||
        (member.department || '').toLowerCase().includes(term)
      );
    });
  }, [businessMembers, memberRoleFilter, businessMembersSearch]);

  const roleCounts = useMemo(() => {
    const counts: Record<RoleFilter, number> = {
      ALL: businessMembers.length,
      ADMIN: 0,
      MANAGER: 0,
      EMPLOYEE: 0,
    };
    businessMembers.forEach((member) => {
      const role = member.role as RoleFilter;
      if (role === 'ADMIN' || role === 'MANAGER' || role === 'EMPLOYEE') {
        counts[role] += 1;
      }
    });
    return counts;
  }, [businessMembers]);

  const hrFeatures = useMemo(() => {
    return parseFeatureKeys(businessDetails?.hrEnabledFeatures);
  }, [businessDetails]);

  // --- Embedded Workspace View -------------------------------------------
  if (showUserDashboard && isImpersonating && currentSession) {
    return (
      <div className="h-screen flex flex-col">
        <div className="bg-yellow-50 border-b border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-wrap gap-y-2">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">
                  Admin Impersonation Active
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-yellow-800">
                <Clock className="w-4 h-4" />
                <span>Duration: {formatDuration(elapsedTime)}</span>
              </div>
              <div className="text-sm text-yellow-800">
                Persona:{' '}
                <strong>{currentSession.targetUser.name || 'Unknown'}</strong>{' '}
                ({currentSession.targetUser.email})
              </div>
              {currentSession.business && (
                <div className="text-sm text-yellow-800 flex items-center space-x-1">
                  <Building2 className="w-4 h-4" />
                  <span>
                    Business:{' '}
                    <strong>{currentSession.business.name}</strong>
                  </span>
                </div>
              )}
              {currentSession.context && (
                <div className="text-sm text-yellow-800 flex items-center space-x-1">
                  <Sparkles className="w-4 h-4" />
                  <span>Context: {currentSession.context}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowUserDashboard(false)}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Exit View</span>
              </Button>
              <Button
                onClick={handleEndImpersonation}
                variant="primary"
                size="sm"
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700"
              >
                <XCircle className="w-4 h-4" />
                <span>End Impersonation</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 relative">
          <iframe
            src={userDashboardUrl}
            className="w-full h-full border-0"
            title="Impersonated Workspace"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    );
  }

  // --- Renderers ----------------------------------------------------------
  const renderBusinessTab = () => (
      <div className="space-y-6">
      {businessError && (
        <Alert type="error" title="Error">
          {businessError}
        </Alert>
      )}

      {businessSuccess && (
        <Alert type="success" title="Personas Ready">
          <p>{businessSuccess}</p>
          {seededPersonas.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-gray-700">
              {seededPersonas.map((persona) => (
                <li key={persona.userId}>
                  <strong>{persona.role}</strong>: {persona.name || persona.email}{' '}
                  ({persona.email})
                  {persona.temporaryPassword && (
                    <span className="block text-xs text-gray-500">
                      Temporary password:{' '}
                      <span className="font-mono">
                        {persona.temporaryPassword}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Choose a business workspace
            </h2>
            <p className="text-sm text-gray-600">
              Explore active modules, HR features, and available personas for
              each business.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Input
              type="text"
              className="w-56"
              placeholder="Search businesses..."
              value={businessSearchTerm}
              onChange={(e) => setBusinessSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleBusinessSearch()}
            />
            <Button onClick={handleBusinessSearch}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {businessLoading ? (
            <div className="flex items-center justify-center py-16">
          <Spinner size={32} />
        </div>
          ) : businesses.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No businesses found. Try adjusting your search.
      </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {businesses.map((business) => {
                const isSelected =
                  selectedBusiness && selectedBusiness.id === business.id;
                return (
                  <button
                    key={business.id}
                    onClick={() => handleSelectBusiness(business)}
                    className={`text-left border rounded-lg p-4 transition-all ${
                      isSelected
                        ? 'border-blue-500 shadow-lg shadow-blue-100 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Building2
                          className={`w-5 h-5 ${
                            isSelected ? 'text-blue-600' : 'text-gray-500'
                          }`}
                        />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {business.name}
                        </h3>
                      </div>
                      <span className="text-xs uppercase font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                        {business.tier}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-gray-600 space-y-1">
                      {business.industry && (
                        <div className="flex items-center space-x-2">
                          <Layers className="w-4 h-4 text-gray-400" />
                          <span>{business.industry}</span>
                        </div>
                      )}
                      {business.size && (
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>{business.size} employees</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>Created {formatDate(business.createdAt)}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                      <span>{business.memberCount} members</span>
                      <span>{business.moduleCount} modules</span>
                    </div>
                    <div className="mt-4 flex items-center text-sm font-medium text-blue-600">
                      <span>View personas</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {businessTotalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
              <Button
                onClick={() => setBusinessPage((prev) => Math.max(1, prev - 1))}
                disabled={businessPage === 1}
                variant="secondary"
                size="sm"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {businessPage} of {businessTotalPages}
              </span>
              <Button
                onClick={() =>
                  setBusinessPage((prev) =>
                    Math.min(businessTotalPages, prev + 1),
                  )
                }
                disabled={businessPage === businessTotalPages}
                variant="secondary"
                size="sm"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </Card>

      {selectedBusiness ? (
        <>
          <Card className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedBusiness.name} Overview
                </h3>
                <p className="text-sm text-gray-600">
                  Tier: <strong>{selectedBusiness.tier}</strong> • Members:{' '}
                  <strong>{selectedBusiness.memberCount}</strong> • Modules:{' '}
                  <strong>{selectedBusiness.moduleCount}</strong>
                </p>
          </div>
              <Button
                onClick={handleSeedPersonas}
                disabled={seeding}
                variant="secondary"
                className="flex items-center space-x-2"
              >
                {seeding ? (
                  <Spinner size={16} />
                ) : (
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                )}
                <span>
                  {seeding ? 'Generating personas…' : 'Generate Lab Personas'}
                </span>
              </Button>
        </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700">
                  HR Features
                </h4>
                {hrFeatures.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {hrFeatures.map((feature) => (
                      <li key={feature} className="flex items-center">
                        <Sparkles className="w-4 h-4 text-blue-500 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    No HR feature flags detected.
                  </p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">Context</h4>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Workspace Focus
                </label>
                <select
                  className="w-full border-gray-200 rounded-md text-sm"
                  value={businessImpersonationContext}
                  onChange={(e) =>
                    setBusinessImpersonationContext(e.target.value)
                  }
                >
                  {BUSINESS_CONTEXT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Session Reason
                </label>
                <Input
                  type="text"
                  value={businessImpersonationReason}
                  onChange={(e) =>
                    setBusinessImpersonationReason(e.target.value)
                  }
                />
                <p className="text-xs text-gray-500">
                  Reason and context are recorded in the audit log for
                  traceability.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700">
                  Recently Installed Modules
                </h4>
                {businessModules.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {businessModules.slice(0, 5).map((module) => (
                      <li key={module.id} className="flex items-center">
                        <Gauge className="w-4 h-4 text-purple-500 mr-2" />
                        <div>
                          <div className="font-medium">
                            {module.moduleName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {module.category || 'Uncategorized'} •{' '}
                            {formatDate(module.installedAt)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    No recent module installations.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Available Personas
                </h3>
                <p className="text-sm text-gray-600">
                  Select a team member to launch a scoped impersonation session.
                </p>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center space-x-2">
                  {(['ALL', 'ADMIN', 'MANAGER', 'EMPLOYEE'] as RoleFilter[]).map(
                    (role) => (
          <Button
                        key={role}
                        size="sm"
                        variant={
                          memberRoleFilter === role ? 'primary' : 'secondary'
                        }
                        onClick={() => setMemberRoleFilter(role)}
                      >
                        {role.charAt(0) + role.slice(1).toLowerCase()} (
                        {roleCounts[role]})
                      </Button>
                    ),
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    type="text"
                    className="w-48"
                    placeholder="Search teammates..."
                    value={businessMembersSearch}
                    onChange={(e) => setBusinessMembersSearch(e.target.value)}
                  />
                  <Filter className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>

            {businessMembersLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size={32} />
              </div>
            ) : filteredBusinessMembers.length === 0 ? (
              <div className="text-center py-12 text-gray-500 space-y-3">
                <p>No matching personas found for the current filters.</p>
                <Button
                  onClick={handleSeedPersonas}
                  disabled={seeding}
            variant="primary"
                  className="flex items-center space-x-2 mx-auto"
                >
                  {seeding ? (
                    <Spinner size={16} />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {seeding ? 'Generating personas…' : 'Generate lab personas'}
                  </span>
          </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBusinessMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-3"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Eye className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {member.user.name || member.user.email}
                        </h4>
                        <div className="text-sm text-gray-600 space-x-3">
                          <span className="uppercase text-xs font-semibold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                            {member.role}
                          </span>
                          {member.title && <span>{member.title}</span>}
                          {member.department && (
                            <span>{member.department}</span>
        )}
      </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Joined {formatDate(member.joinedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => handleBusinessImpersonation(member)}
                        disabled={isImpersonating}
                        className="flex items-center space-x-2"
                      >
                        <Monitor className="w-4 h-4" />
                        <span>
                          Launch {businessImpersonationContext} View
                        </span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card className="p-10 text-center text-gray-500">
          Select a business on the left to view personas you can impersonate.
        </Card>
      )}
    </div>
  );

  const renderUserTab = () => (
    <div className="space-y-6">
      {userError && (
        <Alert type="error" title="Error">
          {userError}
        </Alert>
      )}

      {isImpersonating && currentSession && !currentSession.business && (
        <Alert type="warning" title="Currently Impersonating">
          You are currently impersonating{' '}
          {currentSession.targetUser.name || currentSession.targetUser.email} (
          {currentSession.targetUser.email}) - Duration:{' '}
          {formatDuration(elapsedTime)}
        </Alert>
      )}

      <Card className="p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search users by name, email, or role..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleUserSearch()}
            />
          </div>
          <Button onClick={handleUserSearch} className="flex items-center space-x-2">
            <Search className="w-4 h-4" />
            <span>Search</span>
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Users</h2>
          <span className="text-sm text-gray-600">
            {filteredUsers.length} users matched
          </span>
        </div>

        {userLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={32} />
          </div>
        ) : (
        <div className="space-y-4">
          {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-medium text-gray-900">
                      {user.name || user.email}
                    </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center space-x-1">
                      <Mail className="w-3 h-3" />
                      <span>{user.email}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Shield className="w-3 h-3" />
                      <span className="capitalize">{user.role}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Joined {formatDate(user.createdAt)}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                    <span>{user._count?.businesses || 0} businesses</span>
                    <span>{user._count?.files || 0} files</span>
                    {user.emailVerified && (
                      <span className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                    onClick={() => handleUserImpersonate(user)}
                  disabled={isImpersonating}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Monitor className="w-4 h-4" />
                  <span>View Dashboard</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
        )}

        {userTotalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
            <Button
              onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
              disabled={userPage === 1}
              variant="secondary"
              size="sm"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {userPage} of {userTotalPages}
            </span>
            <Button
              onClick={() =>
                setUserPage((prev) => Math.min(userTotalPages, prev + 1))
              }
              disabled={userPage === userTotalPages}
              variant="secondary"
              size="sm"
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );

  // --- Loading States -----------------------------------------------------
  if (userLoading && activeTab === 'user' && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  // --- Main Render --------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link href="/admin-portal" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Impersonation Lab
            </h1>
            <p className="text-gray-600">
              Switch between full-business personas or quick user views for
              debugging and support.
            </p>
          </div>
        </div>
        <div className="inline-flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('business')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'business'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Business Personas
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'user'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            User Directory
          </button>
        </div>
      </div>

      {activeTab === 'business' ? renderBusinessTab() : renderUserTab()}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                View User Dashboard
              </h2>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            {selectedUser && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">
                      Embedded View
                    </h3>
                  </div>
                  <p className="text-sm text-blue-800 mt-2">
                    You will view this user's dashboard within the admin portal.
                    You can exit the view at any time without ending the
                    impersonation session.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    User Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Name:</strong>{' '}
                      {selectedUser.name || selectedUser.email}
                    </div>
                    <div>
                      <strong>Email:</strong> {selectedUser.email}
                    </div>
                    <div>
                      <strong>Role:</strong> {selectedUser.role}
                    </div>
                    <div>
                      <strong>Joined:</strong>{' '}
                      {formatDate(selectedUser.createdAt)}
                    </div>
                    <div>
                      <strong>Businesses:</strong>{' '}
                      {selectedUser._count?.businesses || 0}
                    </div>
                    <div>
                      <strong>Files:</strong>{' '}
                      {selectedUser._count?.files || 0}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3">
                  <Button
                    onClick={() => setShowConfirmModal(false)}
                    variant="secondary"
                    disabled={impersonating}
                  >
                    Cancel
                  </Button>
                                  <Button
                    onClick={confirmUserImpersonation}
                  disabled={impersonating}
                  size="md"
                  className="flex items-center space-x-2"
                >
                    {impersonating ? (
                      <Spinner size={16} />
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                    <span>
                      {impersonating ? 'Starting...' : 'View Dashboard'}
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
