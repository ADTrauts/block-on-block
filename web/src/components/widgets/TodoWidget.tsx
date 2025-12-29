'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  CheckSquare, 
  Plus, 
  MoreHorizontal, 
  Clock, 
  AlertCircle,
  Trash2,
  Calendar,
  List
} from 'lucide-react';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import { getTasks, Task } from '../../api/todo';
import { formatRelativeTime } from '../../utils/format';

interface TodoWidgetProps {
  id: string;
  config?: TodoWidgetConfig;
  onConfigChange?: (config: TodoWidgetConfig) => void;
  onRemove?: () => void;
  
  // Dashboard context
  dashboardId: string;
  dashboardType: 'personal' | 'business' | 'educational' | 'household';
  dashboardName: string;
}

interface TodoWidgetConfig {
  showUpcomingTasks: boolean;
  maxTasksToShow: number;
  showOverdueTasks: boolean;
  showCompletedTasks: boolean;
  showPriorityBadges: boolean;
  filterByStatus: ('TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DONE' | 'CANCELLED')[];
  sortBy: 'dueDate' | 'priority' | 'createdAt';
}

const defaultConfig: TodoWidgetConfig = {
  showUpcomingTasks: true,
  maxTasksToShow: 5,
  showOverdueTasks: true,
  showCompletedTasks: false,
  showPriorityBadges: true,
  filterByStatus: ['TODO', 'IN_PROGRESS'],
  sortBy: 'dueDate'
};

export default function TodoWidget({ 
  id, 
  config = defaultConfig, 
  onConfigChange, 
  onRemove,
  dashboardId,
  dashboardType,
  dashboardName
}: TodoWidgetProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showConfig, setShowConfig] = useState(false);

  // Ensure config is never null
  const safeConfig = config || defaultConfig;

  // Context-aware widget content
  const getContextSpecificContent = () => {
    const safeDashboardName = dashboardName || 'My Dashboard';
    
    switch (dashboardType) {
      case 'household':
        return {
          title: `${safeDashboardName} Family Tasks`,
          emptyMessage: "No family tasks yet. Create tasks to coordinate with your family!",
          color: '#f59e0b',
          icon: '🏠'
        };
      case 'business':
        return {
          title: `${safeDashboardName} Work Tasks`,
          emptyMessage: "No work tasks yet. Create tasks to track your team's progress!",
          color: '#3b82f6',
          icon: '💼'
        };
      case 'educational':
        return {
          title: `${safeDashboardName} School Tasks`,
          emptyMessage: "No school tasks yet. Create tasks to manage assignments and projects!",
          color: '#10b981',
          icon: '🎓'
        };
      default:
        return {
          title: 'My Tasks',
          emptyMessage: "No tasks yet. Create your first task to get started!",
          color: '#6366f1',
          icon: '✅'
        };
    }
  };

  // Load tasks
  useEffect(() => {
    if (!session?.accessToken || !dashboardId) return;
    
    const loadTasks = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all tasks for this dashboard (API doesn't support status array or limit)
        const allTasks = await getTasks(session.accessToken, {
          dashboardId
        });

        // Filter by status (frontend filtering since API only accepts single status)
        let filteredTasks = allTasks;
        if (safeConfig.filterByStatus.length > 0) {
          filteredTasks = filteredTasks.filter(task => 
            safeConfig.filterByStatus.includes(task.status)
          );
        }

        // Exclude completed tasks unless explicitly requested
        if (!safeConfig.showCompletedTasks) {
          filteredTasks = filteredTasks.filter(task => 
            task.status !== 'DONE' && task.status !== 'CANCELLED'
          );
        }

        // Sort tasks
        filteredTasks.sort((a, b) => {
          switch (safeConfig.sortBy) {
            case 'dueDate':
              if (!a.dueDate && !b.dueDate) return 0;
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            case 'priority':
              const priorityOrder: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
              return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            case 'createdAt':
            default:
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
        });

        // Limit to maxTasksToShow
        setTasks(filteredTasks.slice(0, safeConfig.maxTasksToShow));

      } catch (err) {
        const safeDashboardName = dashboardName || 'dashboard';
        setError(`Failed to load ${safeDashboardName} tasks`);
        console.error(`Error loading ${dashboardType} tasks:`, err);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [session?.accessToken, dashboardId, dashboardType, safeConfig.maxTasksToShow, safeConfig.filterByStatus, safeConfig.sortBy, safeConfig.showCompletedTasks, dashboardName]);

  // Get priority badge color
  const getPriorityColor = (priority: string): 'red' | 'blue' | 'gray' | 'green' | 'yellow' | undefined => {
    switch (priority) {
      case 'URGENT': return 'red';
      case 'HIGH': return 'yellow';
      case 'MEDIUM': return 'blue';
      case 'LOW': return 'gray';
      default: return 'gray';
    }
  };

  // Get status badge color
  const getStatusColor = (status: string): 'red' | 'blue' | 'gray' | 'green' | 'yellow' | undefined => {
    switch (status) {
      case 'DONE': return 'green';
      case 'IN_PROGRESS': return 'blue';
      case 'BLOCKED': return 'red';
      case 'REVIEW': return 'blue';
      case 'CANCELLED': return 'gray';
      default: return 'gray';
    }
  };

  // Check if task is overdue
  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === 'DONE' || task.status === 'CANCELLED') return false;
    return new Date(task.dueDate) < new Date();
  };

  const contextContent = getContextSpecificContent();
  const overdueTasks = tasks.filter(isOverdue);
  const upcomingTasks = tasks.filter(task => !isOverdue(task) && task.status !== 'DONE');

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-5 h-5" style={{ color: contextContent.color }} />
            <h3 className="font-semibold text-gray-900">{contextContent.title}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <MoreHorizontal className="w-4 h-4 text-gray-500" />
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-1 hover:bg-red-100 rounded text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <Spinner size={24} />
          <span className="ml-2 text-gray-600">Loading tasks...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-5 h-5" style={{ color: contextContent.color }} />
            <h3 className="font-semibold text-gray-900">{contextContent.title}</h3>
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 hover:bg-red-100 rounded text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <Alert type="error">
          {error}
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <CheckSquare className="w-5 h-5" style={{ color: contextContent.color }} />
          <h3 className="font-semibold text-gray-900">{contextContent.title}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.location.href = '/todo'}
            className="flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </Button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 hover:bg-red-100 rounded text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Overdue Tasks */}
      {safeConfig.showOverdueTasks && overdueTasks.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <h4 className="text-sm font-medium text-red-800">Overdue Tasks</h4>
            <Badge size="sm" color="red">{overdueTasks.length}</Badge>
          </div>
          <div className="space-y-2">
            {overdueTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="flex items-start space-x-2 p-2 hover:bg-red-100 rounded cursor-pointer"
                onClick={() => window.location.href = `/todo?task=${task.id}`}
              >
                <CheckSquare className="w-4 h-4 text-red-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900 truncate">{task.title}</p>
                  {task.dueDate && (
                    <p className="text-xs text-red-600">
                      Due {formatRelativeTime(new Date(task.dueDate), { addSuffix: true })}
                    </p>
                  )}
                </div>
                {safeConfig.showPriorityBadges && (
                  <Badge size="sm" color={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Tasks */}
      {safeConfig.showUpcomingTasks && upcomingTasks.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Upcoming Tasks</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.location.href = '/todo'}
            >
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {upcomingTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                onClick={() => window.location.href = `/todo?task=${task.id}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {task.status === 'DONE' ? (
                    <CheckSquare className="w-4 h-4 text-green-600 fill-current" />
                  ) : (
                    <CheckSquare className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className={`text-sm font-medium truncate ${
                      task.status === 'DONE' ? 'text-gray-500 line-through' : 'text-gray-900'
                    }`}>
                      {task.title}
                    </p>
                    {safeConfig.showPriorityBadges && task.priority !== 'MEDIUM' && (
                      <Badge size="sm" color={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    )}
                    <Badge size="sm" color={getStatusColor(task.status)}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                    {task.dueDate && (
                      <>
                        <Calendar className="w-3 h-3" />
                        <span>{formatRelativeTime(new Date(task.dueDate), { addSuffix: true })}</span>
                      </>
                    )}
                    {!task.dueDate && (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>No due date</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="text-center py-6">
          <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">{contextContent.emptyMessage}</p>
          <Button
            size="sm"
            onClick={() => window.location.href = '/todo'}
          >
            Create Task
          </Button>
        </div>
      )}

      {/* Configuration Panel */}
      {showConfig && onConfigChange && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Widget Settings</h5>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={safeConfig.showUpcomingTasks}
                onChange={(e) => onConfigChange({
                  ...safeConfig,
                  showUpcomingTasks: e.target.checked
                })}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Show upcoming tasks</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={safeConfig.showOverdueTasks}
                onChange={(e) => onConfigChange({
                  ...safeConfig,
                  showOverdueTasks: e.target.checked
                })}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Show overdue tasks</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={safeConfig.showPriorityBadges}
                onChange={(e) => onConfigChange({
                  ...safeConfig,
                  showPriorityBadges: e.target.checked
                })}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Show priority badges</span>
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Max tasks to show:</span>
              <select
                value={safeConfig.maxTasksToShow}
                onChange={(e) => onConfigChange({
                  ...safeConfig,
                  maxTasksToShow: parseInt(e.target.value)
                })}
                className="text-sm border rounded px-2 py-1"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

