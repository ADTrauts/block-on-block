'use client';

import React from 'react';
import { Card } from 'shared/components';
import { Users, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { TeamOnboardingTask } from '@/api/hrOnboarding';

interface ManagerOnboardingDashboardProps {
  tasks: TeamOnboardingTask[];
  teamMemberCount: number;
}

export default function ManagerOnboardingDashboard({
  tasks,
  teamMemberCount,
}: ManagerOnboardingDashboardProps) {
  const pendingApprovals = tasks.filter(
    (task) => task.requiresApproval && task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
  ).length;

  const overdueTasks = tasks.filter(
    (task) =>
      task.dueDate &&
      new Date(task.dueDate) < new Date() &&
      task.status !== 'COMPLETED' &&
      task.status !== 'CANCELLED'
  ).length;

  const activeJourneys = new Set(tasks.map((task) => task.onboardingJourney.id)).size;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Team Members</p>
            <p className="text-2xl font-semibold text-gray-900">{teamMemberCount}</p>
          </div>
          <Users className="w-8 h-8 text-blue-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Active Journeys</p>
            <p className="text-2xl font-semibold text-gray-900">{activeJourneys}</p>
          </div>
          <Users className="w-8 h-8 text-green-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Pending Approvals</p>
            <p className="text-2xl font-semibold text-gray-900">{pendingApprovals}</p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-yellow-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Overdue Tasks</p>
            <p className="text-2xl font-semibold text-gray-900">{overdueTasks}</p>
          </div>
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
      </Card>
    </div>
  );
}

