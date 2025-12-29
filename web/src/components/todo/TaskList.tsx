'use client';

import React, { useState } from 'react';
import { TaskItem } from './TaskItem';
import { EmptyTaskState } from './EmptyTaskState';
import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
import type { Task, TaskProject } from '@/api/todo';

interface TaskListProps {
  tasks: Task[];
  projects?: TaskProject[];
  onTaskSelect: (task: Task) => void;
  onTaskComplete: (taskId: string) => void;
  onTaskReopen?: (taskId: string) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  onViewAttachments?: (task: Task) => void;
  onCreateTask?: () => void;
}

export function TaskList({ tasks, projects = [], onTaskSelect, onTaskComplete, onTaskReopen, onTaskEdit, onTaskDelete, onViewAttachments, onCreateTask }: TaskListProps) {
  // Track collapsed state for each project
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  // Separate parent tasks, subtasks, and recurring instances
  const parentTasks = tasks.filter(t => !t.parentTaskId && !t.parentRecurringTaskId);
  const subtasks = tasks.filter(t => t.parentTaskId);
  const recurringInstances = tasks.filter(t => t.parentRecurringTaskId);
  
  // Group subtasks by parent
  const subtasksByParent = subtasks.reduce((acc, subtask) => {
    if (!subtask.parentTaskId) return acc;
    if (!acc[subtask.parentTaskId]) {
      acc[subtask.parentTaskId] = [];
    }
    acc[subtask.parentTaskId].push(subtask);
    return acc;
  }, {} as Record<string, Task[]>);

  // Group recurring instances by parent
  const instancesByParent = recurringInstances.reduce((acc, instance) => {
    if (!instance.parentRecurringTaskId) return acc;
    if (!acc[instance.parentRecurringTaskId]) {
      acc[instance.parentRecurringTaskId] = [];
    }
    acc[instance.parentRecurringTaskId].push(instance);
    return acc;
  }, {} as Record<string, Task[]>);

  // Sort parent tasks: recurring parents first, then by due date
  const sortedParentTasks = [...parentTasks].sort((a, b) => {
    // Parent recurring tasks first
    const aIsRecurring = !!a.recurrenceRule && !a.parentRecurringTaskId;
    const bIsRecurring = !!b.recurrenceRule && !b.parentRecurringTaskId;
    if (aIsRecurring && !bIsRecurring) return -1;
    if (!aIsRecurring && bIsRecurring) return 1;
    
    // Then by due date
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    
    // Then by priority
    const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const aPriority = priorityOrder[a.priority] || 0;
    const bPriority = priorityOrder[b.priority] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    
    // Finally by creation date
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Group parent tasks by project (using sorted list)
  const tasksByProject = sortedParentTasks.reduce((acc, task) => {
    const projectId = task.projectId || 'no-project';
    if (!acc[projectId]) {
      acc[projectId] = [];
    }
    acc[projectId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Create a map of project ID to project data
  const projectMap = new Map<string, TaskProject>();
  projects.forEach(project => {
    projectMap.set(project.id, project);
  });

  // Get project name and color
  const getProjectInfo = (projectId: string | null) => {
    if (!projectId || projectId === 'no-project') {
      return { name: 'No Project', color: '#9CA3AF' }; // gray
    }
    const project = projectMap.get(projectId);
    return {
      name: project?.name || 'Unknown Project',
      color: project?.color || '#3B82F6' // default blue
    };
  };

  // Toggle project collapse
  const toggleProject = (projectId: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Filter by status
  const filterByStatus = (taskList: Task[]) => {
    return {
      active: taskList.filter(t => t.status !== 'DONE'),
      completed: taskList.filter(t => t.status === 'DONE')
    };
  };

  const renderTaskWithSubtasks = (task: Task) => {
    const taskSubtasks = subtasksByParent[task.id] || [];
    const activeSubtasks = taskSubtasks.filter(st => st.status !== 'DONE');
    const completedSubtasks = taskSubtasks.filter(st => st.status === 'DONE');
    
    // Get recurring instances for this parent task
    const taskInstances = instancesByParent[task.id] || [];
    const activeInstances = taskInstances.filter(inst => inst.status !== 'DONE');
    const completedInstances = taskInstances.filter(inst => inst.status === 'DONE');
    
    // Sort instances by due date
    const sortedActiveInstances = [...activeInstances].sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
    const sortedCompletedInstances = [...completedInstances].sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

    return (
      <div key={task.id} className="space-y-0">
        {/* Parent Task */}
        <TaskItem
          task={task}
          onSelect={() => {
            console.log('[TaskList] Task clicked:', task.id, task.title);
            onTaskSelect(task);
          }}
          onComplete={() => onTaskComplete(task.id)}
          onReopen={onTaskReopen ? () => onTaskReopen(task.id) : undefined}
          onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
          onDelete={onTaskDelete ? () => onTaskDelete(task.id) : undefined}
          onViewAttachments={onViewAttachments ? () => onViewAttachments(task) : undefined}
        />
        
        {/* Recurring Instances - Nested under parent */}
        {taskInstances.length > 0 && (
          <div className="ml-8 pl-4 border-l-2 border-purple-200 space-y-1">
            {sortedActiveInstances.map((instance) => (
              <TaskItem
                key={instance.id}
                task={instance}
                view="compact"
                onSelect={() => {
                  console.log('[TaskList] Instance clicked:', instance.id, instance.title);
                  onTaskSelect(instance);
                }}
                onComplete={() => onTaskComplete(instance.id)}
                onReopen={onTaskReopen ? () => onTaskReopen(instance.id) : undefined}
                onEdit={onTaskEdit ? () => onTaskEdit(instance) : undefined}
                onDelete={onTaskDelete ? () => onTaskDelete(instance.id) : undefined}
                onViewAttachments={onViewAttachments ? () => onViewAttachments(instance) : undefined}
              />
            ))}
            {sortedCompletedInstances.map((instance) => (
              <TaskItem
                key={instance.id}
                task={instance}
                view="compact"
                onSelect={() => {
                  console.log('[TaskList] Instance clicked:', instance.id, instance.title);
                  onTaskSelect(instance);
                }}
                onComplete={() => onTaskComplete(instance.id)}
                onReopen={onTaskReopen ? () => onTaskReopen(instance.id) : undefined}
                onEdit={onTaskEdit ? () => onTaskEdit(instance) : undefined}
                onDelete={onTaskDelete ? () => onTaskDelete(instance.id) : undefined}
                onViewAttachments={onViewAttachments ? () => onViewAttachments(instance) : undefined}
              />
            ))}
          </div>
        )}
        
        {/* Subtasks - Nested under parent */}
        {taskSubtasks.length > 0 && (
          <div className="ml-8 pl-4 border-l-2 border-gray-200 space-y-1">
            {activeSubtasks.map((subtask) => (
              <TaskItem
                key={subtask.id}
                task={subtask}
                onSelect={() => {
                  console.log('[TaskList] Subtask clicked:', subtask.id, subtask.title);
                  onTaskSelect(subtask);
                }}
                onComplete={() => onTaskComplete(subtask.id)}
                onReopen={onTaskReopen ? () => onTaskReopen(subtask.id) : undefined}
                onEdit={onTaskEdit ? () => onTaskEdit(subtask) : undefined}
                onDelete={onTaskDelete ? () => onTaskDelete(subtask.id) : undefined}
                onViewAttachments={onViewAttachments ? () => onViewAttachments(subtask) : undefined}
                view="compact"
              />
            ))}
            {completedSubtasks.map((subtask) => (
              <TaskItem
                key={subtask.id}
                task={subtask}
                onSelect={() => {
                  console.log('[TaskList] Subtask clicked:', subtask.id, subtask.title);
                  onTaskSelect(subtask);
                }}
                onComplete={() => onTaskComplete(subtask.id)}
                onReopen={onTaskReopen ? () => onTaskReopen(subtask.id) : undefined}
                onEdit={onTaskEdit ? () => onTaskEdit(subtask) : undefined}
                onDelete={onTaskDelete ? () => onTaskDelete(subtask.id) : undefined}
                onViewAttachments={onViewAttachments ? () => onViewAttachments(subtask) : undefined}
                view="compact"
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderProjectSection = (projectId: string, projectTasks: Task[]) => {
    const { name, color } = getProjectInfo(projectId);
    const isCollapsed = collapsedProjects.has(projectId);
    const { active, completed } = filterByStatus(projectTasks);
    const totalCount = projectTasks.length;

    if (totalCount === 0) return null;

    return (
      <div key={projectId} className="mb-6">
        {/* Project Header */}
        <button
          onClick={() => toggleProject(projectId)}
          className="w-full flex items-center gap-2 px-2 py-3 mb-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold text-gray-900">{name}</span>
          <span className="text-sm text-gray-500 ml-auto">
            {totalCount} {totalCount === 1 ? 'task' : 'tasks'}
          </span>
        </button>

        {/* Project Tasks */}
        {!isCollapsed && (
          <div className="ml-6 space-y-3">
            {/* Active Tasks */}
            {active.length > 0 && (
              <div className="space-y-3">
                {active.map((task) => renderTaskWithSubtasks(task))}
              </div>
            )}

            {/* Completed Tasks */}
            {completed.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Completed ({completed.length})
                </h3>
                <div className="space-y-3">
                  {completed.map((task) => renderTaskWithSubtasks(task))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Get all project IDs (including 'no-project')
  const allProjectIds = Array.from(new Set([
    ...Object.keys(tasksByProject),
    ...projects.map(p => p.id)
  ]));

  // Sort projects: projects with tasks first, then "No Project" at the end
  const sortedProjectIds = allProjectIds.sort((a, b) => {
    if (a === 'no-project') return 1;
    if (b === 'no-project') return -1;
    const aCount = tasksByProject[a]?.length || 0;
    const bCount = tasksByProject[b]?.length || 0;
    if (aCount === 0 && bCount > 0) return 1;
    if (bCount === 0 && aCount > 0) return -1;
    return 0;
  });

  return (
    <div className="p-6 space-y-4 min-w-0">
      {sortedProjectIds.length > 0 ? (
        sortedProjectIds.map(projectId => {
          const projectTasks = tasksByProject[projectId] || [];
          return renderProjectSection(projectId, projectTasks);
        })
      ) : (
        <EmptyTaskState onCreateTask={onCreateTask || (() => {})} view="list" />
      )}
    </div>
  );
}

