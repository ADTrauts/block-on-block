'use client';

import React from 'react';
import { CheckSquare, Plus, Calendar, Flag, Clock } from 'lucide-react';
import { Button, Card, Badge } from 'shared/components';

interface EmptyTaskStateProps {
  onCreateTask: () => void;
  view?: 'list' | 'board';
}

export function EmptyTaskState({ onCreateTask, view = 'list' }: EmptyTaskStateProps) {
  // Placeholder task cards
  const placeholderTasks = [
    { title: 'Example Task', priority: 'high', dueDate: 'Today', status: 'TODO' },
    { title: 'Another Task', priority: 'medium', dueDate: 'Tomorrow', status: 'IN_PROGRESS' },
    { title: 'Third Task', priority: 'low', dueDate: 'Next Week', status: 'REVIEW' },
    { title: 'Important Task', priority: 'urgent', dueDate: 'Today', status: 'BLOCKED' },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 border-red-300';
      case 'high': return 'bg-orange-100 border-orange-300';
      case 'medium': return 'bg-blue-100 border-blue-300';
      case 'low': return 'bg-gray-100 border-gray-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  // Board view columns
  const columns = [
    { id: 'TODO', label: 'To Do', color: 'bg-gray-100' },
    { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-100' },
    { id: 'BLOCKED', label: 'Blocked', color: 'bg-red-100' },
    { id: 'REVIEW', label: 'Review', color: 'bg-purple-100' },
    { id: 'DONE', label: 'Done', color: 'bg-green-100' },
  ];

  // Render board view placeholders
  if (view === 'board') {
    return (
      <div className="p-8">
        {/* Grid of placeholder task cards (color-coded by priority) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {placeholderTasks.map((task, index) => (
            <div
              key={index}
              className={`relative border-2 border-dashed rounded-lg p-2 ${getPriorityColor(task.priority)} opacity-40 animate-pulse`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start gap-2">
                <CheckSquare className="w-3 h-3 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <div className="h-3 w-20 bg-gray-300 rounded mb-2"></div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-2.5 h-2.5 text-gray-400" />
                    <div className="h-2 w-12 bg-gray-300 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 mb-4">
            <CheckSquare className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Ready to get organized?
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Create your first task to start managing your to-dos. Organize them in columns and track your workflow.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={onCreateTask}
            className="inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Your First Task
          </Button>
        </div>
      </div>
    );
  }

  // List view placeholders
  return (
    <div className="p-8">
      {/* Vertical list of placeholder task cards */}
      <div className="space-y-3 mb-8 max-w-3xl">
        {placeholderTasks.map((task, index) => (
          <div
            key={index}
            className={`relative border-2 border-dashed rounded-lg p-4 ${getPriorityColor(task.priority)} opacity-40 animate-pulse`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex items-start gap-3">
              <CheckSquare className="w-5 h-5 text-gray-400 mt-1" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-gray-300 rounded mb-2"></div>
                <div className="space-y-2 mb-3">
                  <div className="h-3 w-full bg-gray-300 rounded"></div>
                  <div className="h-3 w-3/4 bg-gray-300 rounded"></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div className="h-3 w-16 bg-gray-300 rounded"></div>
                  </div>
                  <div className="h-4 w-16 bg-gray-300 rounded"></div>
                  <div className="h-4 w-20 bg-gray-300 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Call to action */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 mb-4">
          <CheckSquare className="w-10 h-10 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Ready to get organized?
        </h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Create your first task to start managing your to-dos. You can organize by priority, set due dates, and track your progress.
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={onCreateTask}
          className="inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Your First Task
        </Button>
        
        {/* Quick tips */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <Flag className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900 text-sm">Set Priorities</div>
              <div className="text-xs text-gray-600 mt-1">Mark tasks as urgent, high, medium, or low</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900 text-sm">Due Dates</div>
              <div className="text-xs text-gray-600 mt-1">Never miss a deadline with date tracking</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900 text-sm">Track Progress</div>
              <div className="text-xs text-gray-600 mt-1">See your productivity at a glance</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

