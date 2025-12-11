'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, Badge, Spinner, Alert } from 'shared/components';
import {
  CalendarClock,
  Users,
  Clock,
  Calendar,
  RefreshCw,
  TrendingUp,
  Settings,
  ArrowRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { businessAPI } from '@/api/business';
import { useBusinessConfiguration } from '@/contexts/BusinessConfigurationContext';

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

interface SchedulingStats {
  totalSchedules: number;
  openShifts: number;
  pendingSwaps: number;
  upcomingShifts: number;
}

export default function SchedulingWorkspaceLanding({ businessId }: { businessId: string }) {
  const { data: session } = useSession();

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'ADMIN' | 'MANAGER' | 'EMPLOYEE' | null>(null);
  const [stats, setStats] = useState<SchedulingStats>({
    totalSchedules: 0,
    openShifts: 0,
    pendingSwaps: 0,
    upcomingShifts: 0
  });

  useEffect(() => {
    if (businessId && session?.user?.id) {
      loadBusinessData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, session?.user?.id]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      setError(null);

      const businessResponse = await businessAPI.getBusiness(businessId);
      if (businessResponse.success) {
        const businessData = businessResponse.data as unknown as Business;
        setBusiness(businessData);

        const userMembership = businessData.members.find(
          m => m.user.id === session?.user?.id
        );
        
        if (userMembership) {
          setUserRole(userMembership.role);
          // TODO: Load actual scheduling stats from API
          setStats({
            totalSchedules: 3,
            openShifts: 5,
            pendingSwaps: 2,
            upcomingShifts: 12
          });
        } else {
          setError('You are not a member of this business');
        }
      } else {
        setError('Failed to load business data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduling data');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';
  const isEmployee = userRole === 'EMPLOYEE';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="p-6">
        <Alert type="error" title="Error Loading Scheduling">
          {error || 'Scheduling module not accessible'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
            <CalendarClock className="w-8 h-8 text-blue-600" />
            <span>Employee Scheduling</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isAdmin && 'Manage schedules and workforce planning'}
            {isManager && 'Manage your team schedules'}
            {isEmployee && 'View your schedule and availability'}
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Schedules</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalSchedules}</p>
            </div>
            <Calendar className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Open Shifts</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.openShifts}</p>
            </div>
            <Clock className="w-12 h-12 text-orange-500 opacity-20" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending Swaps</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingSwaps}</p>
            </div>
            <RefreshCw className="w-12 h-12 text-purple-500 opacity-20" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Upcoming Shifts</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.upcomingShifts}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Admin Access Cards */}
        {isAdmin && (
          <>
            <Link href={`/business/${businessId}/admin/scheduling`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Settings className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Schedule Builder</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create and manage work schedules for your team
                </p>
              </Card>
            </Link>

            <Link href={`/business/${businessId}/admin/scheduling?tab=templates`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-500">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Schedule Templates</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage reusable schedule templates and rotations
                </p>
              </Card>
            </Link>

            <Link href={`/business/${businessId}/admin/scheduling?tab=analytics`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Labor Analytics</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  View labor costs, coverage, and scheduling insights
                </p>
              </Card>
            </Link>
          </>
        )}

        {/* Manager Access Cards */}
        {(isAdmin || isManager) && (
          <>
            <Link href={`/business/${businessId}/workspace/scheduling/team`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Team Schedules</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage schedules for your team members
                </p>
              </Card>
            </Link>

            <Link href={`/business/${businessId}/workspace/scheduling/team?tab=swaps`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-500">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                  </div>
                  {stats.pendingSwaps > 0 && (
                    <Badge color="red">{stats.pendingSwaps} pending</Badge>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Swap Approvals</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review and approve shift swap requests
                </p>
              </Card>
            </Link>
          </>
        )}

        {/* Employee Access Cards */}
        <Link href={`/business/${businessId}/workspace/scheduling/me`}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600 dark:text-green-300" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">My Schedule</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View your upcoming shifts and schedule
            </p>
          </Card>
        </Link>

        <Link href={`/business/${businessId}/workspace/scheduling/me?tab=availability`}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-orange-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-300" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">My Availability</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage your work availability preferences
            </p>
          </Card>
        </Link>

        <Link href={`/business/${businessId}/workspace/scheduling/me?tab=swaps`}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-500">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-300" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Shift Swaps</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Request to swap or trade shifts with colleagues
            </p>
          </Card>
        </Link>

        {stats.openShifts > 0 && (
          <Link href={`/business/${businessId}/workspace/scheduling/me?tab=open-shifts`}>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-orange-500 bg-orange-50 dark:bg-orange-900/20">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-300" />
                </div>
                <Badge color="yellow">{stats.openShifts} available</Badge>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Open Shifts</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Browse and claim available open shifts
              </p>
            </Card>
          </Link>
        )}
      </div>

      {/* Quick Tips */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-300 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Getting Started with Scheduling
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {isAdmin && 'Start by creating your first schedule or setting up shift templates. You can publish schedules to make them visible to your team.'}
              {isManager && 'View your team\'s schedules and approve any pending shift swap requests. You can also post open shifts for team members to claim.'}
              {isEmployee && 'Check your upcoming shifts, set your availability preferences, and browse open shifts you can claim for extra hours.'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

