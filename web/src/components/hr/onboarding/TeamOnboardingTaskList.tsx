'use client';

import React, { useState, useMemo } from 'react';
import { Card, Button, Badge } from 'shared/components';
import { Filter, User, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import OnboardingTaskStatusBadge from './OnboardingTaskStatusBadge';
import OnboardingTaskTypeIcon from './OnboardingTaskTypeIcon';
import OnboardingTaskApprovalModal from './OnboardingTaskApprovalModal';
import OnboardingChatIntegration from './integrations/OnboardingChatIntegration';
import type { TeamOnboardingTask } from '@/api/hrOnboarding';

interface TeamOnboardingTaskListProps {
  tasks: TeamOnboardingTask[];
  businessId: string;
  onTaskComplete: (taskId: string, payload: { approved?: boolean; notes?: string }) => Promise<void>;
  completingTaskId?: string | null;
}

type TaskFilter = 'all' | 'pending_approval' | 'overdue' | 'by_employee';

export default function TeamOnboardingTaskList({
  tasks,
  businessId,
  onTaskComplete,
  completingTaskId,
}: TeamOnboardingTaskListProps) {
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TeamOnboardingTask | null>(null);

  const employees = useMemo(() => {
    const employeeMap = new Map<string, { name: string; email: string }>();
    tasks.forEach((task) => {
      const employee = task.onboardingJourney.employeeHrProfile?.employeePosition?.user;
      if (employee) {
        const key = employee.id || employee.email || 'unknown';
        if (!employeeMap.has(key)) {
          employeeMap.set(key, {
            name: employee.name || 'Unknown',
            email: employee.email || '',
          });
        }
      }
    });
    return Array.from(employeeMap.entries());
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (taskFilter === 'pending_approval') {
      filtered = filtered.filter(
        (task) => task.requiresApproval && task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
      );
    } else if (taskFilter === 'overdue') {
      filtered = filtered.filter(
        (task) =>
          task.dueDate &&
          new Date(task.dueDate) < new Date() &&
          task.status !== 'COMPLETED' &&
          task.status !== 'CANCELLED'
      );
    }

    if (selectedEmployee) {
      filtered = filtered.filter((task) => {
        const employee = task.onboardingJourney.employeeHrProfile?.employeePosition?.user;
        return employee && (employee.id === selectedEmployee || employee.email === selectedEmployee);
      });
    }

    return filtered.sort((a, b) => {
      // Sort by due date (overdue first), then by employee name
      if (a.dueDate && b.dueDate) {
        const aOverdue = new Date(a.dueDate) < new Date();
        const bOverdue = new Date(b.dueDate) < new Date();
        if (aOverdue !== bOverdue) {
          return aOverdue ? -1 : 1;
        }
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      const aName =
        a.onboardingJourney.employeeHrProfile?.employeePosition?.user?.name || '';
      const bName =
        b.onboardingJourney.employeeHrProfile?.employeePosition?.user?.name || '';
      return aName.localeCompare(bName);
    });
  }, [tasks, taskFilter, selectedEmployee]);

  const getEmployeeName = (task: TeamOnboardingTask) => {
    return (
      task.onboardingJourney.employeeHrProfile?.employeePosition?.user?.name ||
      task.onboardingJourney.employeeHrProfile?.employeePosition?.user?.email ||
      'Team member'
  );
  };

  const isOverdue = (task: TeamOnboardingTask) => {
    return (
      task.dueDate &&
      new Date(task.dueDate) < new Date() &&
      task.status !== 'COMPLETED' &&
      task.status !== 'CANCELLED'
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          <button
            onClick={() => {
              setTaskFilter('all');
              setSelectedEmployee(null);
            }}
            className={`px-3 py-1 rounded text-sm ${
              taskFilter === 'all' && !selectedEmployee
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setTaskFilter('pending_approval')}
            className={`px-3 py-1 rounded text-sm ${
              taskFilter === 'pending_approval'
                ? 'bg-yellow-100 text-yellow-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending Approval (
            {tasks.filter((t) => t.requiresApproval && t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length})
          </button>
          <button
            onClick={() => setTaskFilter('overdue')}
            className={`px-3 py-1 rounded text-sm ${
              taskFilter === 'overdue'
                ? 'bg-red-100 text-red-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Overdue ({tasks.filter(isOverdue).length})
          </button>
        </div>

        {employees.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Employee:</span>
            <select
              value={selectedEmployee || ''}
              onChange={(e) => {
                setSelectedEmployee(e.target.value || null);
                setTaskFilter('all');
              }}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Employees</option>
              {employees.map(([id, employee]) => (
                <option key={id} value={id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-gray-500">No tasks match the selected filters.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const employeeName = getEmployeeName(task);
            const overdue = isOverdue(task);
            const templateName =
              task.onboardingJourney.onboardingTemplate?.name || 'Onboarding Journey';

            return (
              <Card
                key={task.id}
                className={`p-4 ${overdue ? 'border-red-300 bg-red-50' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Task Icon */}
                  <div className="flex-shrink-0">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                        task.status === 'COMPLETED'
                          ? 'bg-green-100'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-blue-100'
                          : task.status === 'BLOCKED'
                          ? 'bg-red-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      <OnboardingTaskTypeIcon
                        type={task.taskType}
                        size={20}
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

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
                          <OnboardingTaskStatusBadge status={task.status} />
                          {overdue && (
                            <Badge color="red" size="sm">Overdue</Badge>
                          )}
                          {task.requiresApproval && task.status !== 'COMPLETED' && (
                            <Badge color="yellow" size="sm">Requires Approval</Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{employeeName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {task.dueDate ? (
                              <span className={overdue ? 'text-red-600 font-medium' : ''}>
                                Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}
                              </span>
                            ) : (
                              <span>No due date</span>
                            )}
                          </div>
                          <span className="text-gray-400">•</span>
                          <span>{templateName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Task Actions */}
                    {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                      <div className="flex items-center gap-2 mt-3">
                        <OnboardingChatIntegration
                          businessId={businessId}
                          employeeUserId={task.onboardingJourney.employeeHrProfile?.employeePosition?.user?.id}
                          employeeName={employeeName}
                          className="inline-block"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setSelectedTask(task)}
                          disabled={completingTaskId === task.id}
                        >
                          {task.requiresApproval ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Review & Approve
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Mark Complete
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Completed Info */}
                    {task.status === 'COMPLETED' && task.completedAt && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>
                            Completed {format(new Date(task.completedAt), 'MMM d, yyyy')}
                            {task.approvedAt && ' • Approved'}
                          </span>
                        </div>
                        {task.notes && (
                          <p className="text-sm text-gray-600 mt-1 ml-6">{task.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approval Modal */}
      {selectedTask && (
        <OnboardingTaskApprovalModal
          task={selectedTask}
          businessId={businessId}
          onApprove={async (approved, notes) => {
            await onTaskComplete(selectedTask.id, { approved, notes });
            setSelectedTask(null);
          }}
          onReject={async (notes) => {
            await onTaskComplete(selectedTask.id, { approved: false, notes });
            setSelectedTask(null);
          }}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

