'use client';

import React from 'react';
import { format, isPast, isToday, isFuture } from 'date-fns';
import OnboardingTaskStatusBadge from './OnboardingTaskStatusBadge';
import OnboardingTaskTypeIcon from './OnboardingTaskTypeIcon';
import type { EmployeeOnboardingTask } from '@/api/hrOnboarding';

interface OnboardingTimelineProps {
  tasks: EmployeeOnboardingTask[];
  className?: string;
}

export default function OnboardingTimeline({ tasks, className = '' }: OnboardingTimelineProps) {
  const sortedTasks = [...tasks].sort((a, b) => a.orderIndex - b.orderIndex);

  const getDateStatus = (dueDate: string | null) => {
    if (!dueDate) return { status: 'no-date', label: 'No due date', color: 'text-gray-500' };
    
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) {
      return { status: 'overdue', label: `Overdue: ${format(date, 'MMM d, yyyy')}`, color: 'text-red-600' };
    }
    if (isToday(date)) {
      return { status: 'today', label: `Due today: ${format(date, 'MMM d, yyyy')}`, color: 'text-orange-600' };
    }
    if (isFuture(date)) {
      return { status: 'upcoming', label: `Due: ${format(date, 'MMM d, yyyy')}`, color: 'text-gray-600' };
    }
    return { status: 'no-date', label: 'No due date', color: 'text-gray-500' };
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {sortedTasks.map((task, index) => {
        const dateStatus = getDateStatus(task.dueDate);
        const isLast = index === sortedTasks.length - 1;

        return (
          <div key={task.id} className="relative flex gap-4">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200" />
            )}

            {/* Icon */}
            <div className="relative z-10 flex-shrink-0">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full border-2 ${
                  task.status === 'COMPLETED'
                    ? 'bg-green-100 border-green-500'
                    : task.status === 'IN_PROGRESS'
                    ? 'bg-blue-100 border-blue-500'
                    : task.status === 'BLOCKED'
                    ? 'bg-red-100 border-red-500'
                    : 'bg-gray-100 border-gray-300'
                }`}
              >
                <OnboardingTaskTypeIcon
                  type={task.taskType}
                  size={14}
                  className={
                    task.status === 'COMPLETED'
                      ? 'text-green-600'
                      : task.status === 'IN_PROGRESS'
                      ? 'text-blue-600'
                      : task.status === 'BLOCKED'
                      ? 'text-red-600'
                      : 'text-gray-500'
                  }
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
                    <OnboardingTaskStatusBadge status={task.status} />
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="capitalize">{task.taskType.toLowerCase()}</span>
                    {task.ownerType && (
                      <span className="capitalize">Owner: {task.ownerType.toLowerCase()}</span>
                    )}
                    {task.requiresApproval && (
                      <span className="text-orange-600">Requires approval</span>
                    )}
                  </div>
                </div>
                {task.dueDate && (
                  <div className={`text-xs font-medium ${dateStatus.color}`}>
                    {dateStatus.label}
                  </div>
                )}
              </div>
              {task.completedAt && (
                <div className="mt-2 text-xs text-gray-500">
                  Completed: {format(new Date(task.completedAt), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

