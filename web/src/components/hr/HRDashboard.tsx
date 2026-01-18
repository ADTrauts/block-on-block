'use client';

import React from 'react';
import { Card } from 'shared/components';
import {
  Users,
  AlertCircle,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

interface HRDashboardProps {
  businessId: string;
  userRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  stats: {
    totalEmployees: number;
    pendingTimeOff: number;
    activeToday: number;
    upcomingReviews: number;
  };
}

export default function HRDashboard({
  businessId,
  userRole,
  stats,
}: HRDashboardProps) {
  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">HR Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Overview of your HR operations and team
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Total Employees</p>
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
                <p className="text-sm font-medium text-gray-700">Pending Requests</p>
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
              <p className="text-sm font-medium text-gray-700">Active Today</p>
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
                <p className="text-sm font-medium text-gray-700">Upcoming Reviews</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.upcomingReviews}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Quick Actions Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isAdmin && (
            <>
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Manage Employees</h3>
                    <p className="text-sm text-gray-600">View and edit employee records</p>
                  </div>
                </div>
              </Card>
            </>
          )}
          
          {(isAdmin || isManager) && (
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Review Requests</h3>
                  <p className="text-sm text-gray-600">Approve time-off requests</p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">My Profile</h3>
                <p className="text-sm text-gray-600">View your HR information</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

