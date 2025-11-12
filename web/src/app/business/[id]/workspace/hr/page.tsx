'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import {
  UserCheck,
  Users,
  Calendar,
  Clock,
  Briefcase,
  TrendingUp,
  FileText,
  Settings,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { businessAPI } from '@/api/business';
import { useBusinessConfiguration } from '@/contexts/BusinessConfigurationContext';
import { useHRFeatures } from '@/hooks/useHRFeatures';

interface Business {
  id: string;
  name: string;
  members: Array<{
    id: string;
    role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

interface HRStats {
  totalEmployees: number;
  pendingTimeOff: number;
  activeToday: number;
  upcomingReviews: number;
}

export default function HRWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const businessId = params?.id as string;
  const { businessTier } = useBusinessConfiguration();
  const hrFeatures = useHRFeatures(businessTier || undefined);

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'ADMIN' | 'MANAGER' | 'EMPLOYEE' | null>(null);
  const [stats, setStats] = useState<HRStats>({
    totalEmployees: 0,
    pendingTimeOff: 0,
    activeToday: 0,
    upcomingReviews: 0
  });

  useEffect(() => {
    if (businessId && session?.user?.id) {
      loadBusinessData();
    }
  }, [businessId, session?.user?.id]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      setError(null);

      const businessResponse = await businessAPI.getBusiness(businessId);
      if (businessResponse.success) {
        const businessData = businessResponse.data as unknown as Business;
        setBusiness(businessData);

        // Determine user's role in this business
        const userMembership = businessData.members.find(
          m => m.user.id === session?.user?.id
        );
        
        if (userMembership) {
          setUserRole(userMembership.role);
          
          // Set basic stats (these will be replaced with real API calls later)
          setStats({
            totalEmployees: businessData.members.length,
            pendingTimeOff: 0, // TODO: Fetch from API
            activeToday: businessData.members.length, // TODO: Fetch from API
            upcomingReviews: 0 // TODO: Fetch from API
          });
        } else {
          setError('You are not a member of this business');
        }
      } else {
        setError('Failed to load business data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load HR data');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';
  const isEmployee = userRole === 'EMPLOYEE';

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
        <Alert type="error" title="Error Loading HR">
          {error || 'HR module not accessible'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <UserCheck className="w-8 h-8 text-blue-600" />
            <span>Human Resources</span>
          </h1>
          <p className="text-gray-600 mt-1">
            {isAdmin && 'Manage your team and HR operations'}
            {isManager && 'Manage your team members'}
            {isEmployee && 'Your personal HR portal'}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge color={isAdmin ? 'red' : isManager ? 'blue' : 'green'}>
            {isAdmin && 'Admin'}
            {isManager && 'Manager'}
            {isEmployee && 'Employee'}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalEmployees}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {(isAdmin || isManager) && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingTimeOff}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Today</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeToday}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        {isAdmin && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Reviews</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.upcomingReviews}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Admin Actions */}
        {isAdmin && (
          <>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Link href={`/business/${businessId}/admin/hr`} className="block w-full">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Manage Employees</h3>
                  <p className="text-sm text-gray-600">View, add, and edit employee records</p>
                </div>
              </div>
              <Button variant="secondary" className="w-full">
                Open Admin Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              </Link>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Link href={`/business/${businessId}/workspace/hr/team`} className="block w-full">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Time-Off Requests</h3>
                  <p className="text-sm text-gray-600">Review and approve pending requests</p>
                </div>
              </div>
              <Button variant="secondary" className="w-full">
                View Requests
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              </Link>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Settings className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">HR Settings</h3>
                  <p className="text-sm text-gray-600">Configure policies and settings</p>
                </div>
              </div>
              <Badge color="gray">Coming Soon</Badge>
            </Card>
          </>
        )}

        {/* Manager Actions */}
        {isManager && !isAdmin && (
          <>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Link href={`/business/${businessId}/workspace/hr/team`} className="block w-full">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">My Team</h3>
                  <p className="text-sm text-gray-600">View and manage your direct reports</p>
                </div>
              </div>
              <Button variant="secondary" className="w-full">
                View Team
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              </Link>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Link href={`/business/${businessId}/workspace/hr/team`} className="block w-full">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Approve Requests</h3>
                  <p className="text-sm text-gray-600">Review team time-off requests</p>
                </div>
              </div>
              <Button variant="secondary" className="w-full">
                View Requests
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              </Link>
            </Card>

            {hrFeatures.attendance.enabled && (
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <Link
                  href={`/business/${businessId}/workspace/hr/team?view=attendance`}
                  className="block w-full"
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Attendance Exceptions</h3>
                      <p className="text-sm text-gray-600">
                        Review and resolve flagged attendance issues for your team
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" className="w-full">
                    Manage Exceptions
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </Card>
            )}
          </>
        )}

        {/* Employee Self-Service (All Users) */}
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <Link href={`/business/${businessId}/workspace/hr/me`} className="block w-full">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">My Profile</h3>
              <p className="text-sm text-gray-600">View and update your personal information</p>
            </div>
          </div>
          <Button variant="secondary" className="w-full">
            View Profile
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          </Link>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <Link href={`/business/${businessId}/workspace/hr/me`} className="block w-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Request Time Off</h3>
                <p className="text-sm text-gray-600">Submit vacation or sick leave requests</p>
              </div>
            </div>
            <Button variant="secondary" className="w-full">
              Request Time Off
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <Link href={`/business/${businessId}/workspace/hr/me`} className="block w-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Clock className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">My Attendance</h3>
                <p className="text-sm text-gray-600">
                  Track clock-ins, clock-outs, and attendance history
                </p>
              </div>
            </div>
            {hrFeatures.attendance.clockInOut ? (
              <Button variant="secondary" className="w-full">
                Manage Attendance
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Clock in/out available on Enterprise. Attendance history is still accessible.
              </div>
            )}
          </Link>
        </Card>
      </div>

      {/* Feature Notice */}
      <Card className="p-6 bg-blue-50 border-l-4 border-l-blue-500">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Briefcase className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">HR Module Framework Active</h3>
            <p className="text-gray-700 mb-3">
              The HR module infrastructure is now operational! Core features are being developed and will be released incrementally:
            </p>
            <ul className="space-y-1 text-sm text-gray-600">
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>✅ Employee directory and profiles</span>
              </li>
              <li className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span>🔄 Time-off request system (coming soon)</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>✅ Attendance policies and self-service clock in/out*</span>
              </li>
              <li className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span>🔄 Payroll & performance reviews (Enterprise - coming soon)</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

