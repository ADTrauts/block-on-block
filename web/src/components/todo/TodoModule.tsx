'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Card, Badge, Spinner } from 'shared/components';
import { Plus, List, LayoutGrid, Calendar, Filter, MoreVertical, Folder } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDashboard } from '@/contexts/DashboardContext';
import * as todoAPI from '@/api/todo';
import { calendarAPI } from '@/api/calendar';
import type { Task, TaskProject } from '@/api/todo';
import type { EventItem } from '@/api/calendar';
import { TaskList } from './TaskList';
import { TaskBoard } from './TaskBoard';
import { TaskDetail } from './TaskDetail';
import { TaskForm } from './TaskForm';
import { TaskCalendar } from './TaskCalendar';
import { QuickTaskInput } from './QuickTaskInput';
import { AttachmentViewer } from './AttachmentViewer';
import { ProjectManager } from './ProjectManager';

type ViewType = 'list' | 'board' | 'calendar';
type CalendarViewMode = 'month' | 'week' | 'day';

interface TodoModuleProps {
  dashboardId?: string | null;
  businessId?: string | null;
}

export function TodoModule({ dashboardId, businessId }: TodoModuleProps) {
  const { data: session } = useSession();
  const { currentDashboardId } = useDashboard();
  const [view, setView] = useState<ViewType>('list');
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('month');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewingAttachments, setViewingAttachments] = useState<Task | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);

  // Debug: Log when task is selected
  useEffect(() => {
    if (selectedTask) {
      console.log('Task selected:', selectedTask.id, selectedTask.title);
    }
  }, [selectedTask]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [initialDueDate, setInitialDueDate] = useState<Date | undefined>(undefined);

  const effectiveDashboardId = dashboardId || currentDashboardId;

  const loadProjects = useCallback(async () => {
    if (!session?.accessToken || !effectiveDashboardId) return;

    try {
      const fetchedProjects = await todoAPI.getProjects(
        session.accessToken,
        effectiveDashboardId,
        businessId || undefined
      );
      setProjects(fetchedProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      // Don't show error toast - projects are optional
    }
  }, [session?.accessToken, effectiveDashboardId, businessId]);

  const loadTasks = useCallback(async () => {
    if (!session?.accessToken || !effectiveDashboardId) return;

    setLoading(true);
    try {
      const fetchedTasks = await todoAPI.getTasks(session.accessToken, {
        dashboardId: effectiveDashboardId,
        businessId: businessId || undefined,
        projectId: selectedProjectId,
      });
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, effectiveDashboardId, businessId, selectedProjectId]);

  const loadCalendarEvents = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      // Get user's personal calendars
      const calendarsResponse = await calendarAPI.listCalendars({
        contextType: 'PERSONAL',
      });

      if (calendarsResponse.success) {
        // Get primary calendar or first calendar
        let primaryCalendar = calendarsResponse.data.find(c => c.isPrimary) || calendarsResponse.data[0];
        
        // If no calendar exists, the backend will auto-provision when creating events
        // For now, just skip loading events if no calendar exists
        if (!primaryCalendar) {
          console.log('No personal calendar found - events will be created when tasks are linked to calendar');
          return;
        }

        if (primaryCalendar) {
          // Calculate date range based on current view
          const start = new Date(calendarDate);
          const end = new Date(calendarDate);
          
          if (calendarViewMode === 'month') {
            start.setDate(1);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
          } else if (calendarViewMode === 'week') {
            start.setDate(start.getDate() - start.getDay());
            end.setDate(start.getDate() + 6);
          }
          // Day view: start and end are the same day

          const eventsResponse = await calendarAPI.listEvents({
            start: start.toISOString(),
            end: end.toISOString(),
            calendarIds: [primaryCalendar.id],
          });

          if (eventsResponse.success) {
            setCalendarEvents(eventsResponse.data);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load calendar events:', error);
      // Don't show error toast - calendar events are optional
    }
  }, [session?.accessToken, calendarDate, calendarViewMode]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (view === 'calendar') {
      loadCalendarEvents();
    }
  }, [view, loadCalendarEvents]);


  const handleTaskComplete = useCallback(async (taskId: string) => {
    if (!session?.accessToken) return;

    try {
      await todoAPI.completeTask(session.accessToken, taskId);
      await loadTasks();
      toast.success('Task completed!');
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error('Failed to complete task');
    }
  }, [session?.accessToken, loadTasks]);

  const handleTaskReopen = useCallback(async (taskId: string) => {
    if (!session?.accessToken) return;

    try {
      await todoAPI.reopenTask(session.accessToken, taskId);
      await loadTasks();
      toast.success('Task reopened!');
    } catch (error) {
      console.error('Failed to reopen task:', error);
      toast.error('Failed to reopen task');
    }
  }, [session?.accessToken, loadTasks]);

  const handleTaskCreate = useCallback(async (data: todoAPI.CreateTaskInput & { createCalendarEvent?: boolean }) => {
    if (!session?.accessToken || !effectiveDashboardId) return;

    try {
      const { createCalendarEvent, ...taskData } = data;
      const newTask = await todoAPI.createTask(session.accessToken, {
        ...taskData,
        dashboardId: effectiveDashboardId,
        businessId: businessId || undefined,
      });
      
      // Create calendar event if requested
      if (createCalendarEvent && taskData.dueDate) {
        try {
          await todoAPI.createEventFromTask(session.accessToken, newTask.id);
          toast.success('Task and calendar event created!');
        } catch (error) {
          console.error('Failed to create calendar event:', error);
          toast.error('Task created, but failed to create calendar event');
        }
      } else {
        toast.success('Task created!');
      }
      
      await loadTasks();
      if (view === 'calendar') {
        await loadCalendarEvents();
      }
      setShowTaskForm(false);
      setInitialDueDate(undefined);
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    }
  }, [session?.accessToken, effectiveDashboardId, businessId, loadTasks, view, loadCalendarEvents]);

  const handleTaskUpdate = useCallback(async (taskId: string, data: todoAPI.UpdateTaskInput) => {
    if (!session?.accessToken) return;

    try {
      await todoAPI.updateTask(session.accessToken, taskId, data);
      await loadTasks();
      setEditingTask(null);
      setSelectedTask(null);
      toast.success('Task updated!');
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  }, [session?.accessToken, loadTasks]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    if (!session?.accessToken) return;

    try {
      await todoAPI.deleteTask(session.accessToken, taskId);
      await loadTasks();
      setSelectedTask(null);
      toast.success('Task deleted');
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    }
  }, [session?.accessToken, loadTasks]);

  if (!effectiveDashboardId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please select a dashboard</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compact Header - Single Row */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-white">
        {/* Title */}
        <h1 className="text-xl font-bold whitespace-nowrap">To-Do</h1>
        
        {/* Quick Task Input - Inline */}
        <div className="flex-1 max-w-md">
          <QuickTaskInput
            dashboardId={effectiveDashboardId}
            businessId={businessId || undefined}
            onCreateTask={async (data) => {
              await handleTaskCreate({ ...data, createCalendarEvent: false });
            }}
            disabled={loading}
          />
        </div>

        {/* View Toggle - Compact */}
        <div className="flex items-center gap-1 border-r pr-4 mr-2">
          <Button
            variant={view === 'list' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setView('list')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={view === 'board' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setView('board')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={view === 'calendar' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setView('calendar')}
          >
            <Calendar className="w-4 h-4" />
          </Button>
        </div>

        {/* Task Counts - Compact */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{tasks.filter(t => t.status !== 'DONE').length} active</span>
          <span className="text-gray-300">•</span>
          <span>{tasks.filter(t => t.status === 'DONE').length} completed</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => {
              setEditingTask(null);
              setShowTaskForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            New Task
          </Button>
          <Button 
            variant={showProjectManager ? 'primary' : 'ghost'} 
            size="sm"
            onClick={() => setShowProjectManager(!showProjectManager)}
            title="Projects"
          >
            <Folder className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" title="Filter">
            <Filter className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" title="More options">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* Project Manager Sidebar */}
        {showProjectManager && (
          <ProjectManager
            isOpen={showProjectManager}
            onClose={() => setShowProjectManager(false)}
            dashboardId={effectiveDashboardId}
            businessId={businessId || undefined}
            selectedProjectId={selectedProjectId}
            onProjectSelect={(projectId) => {
              setSelectedProjectId(projectId);
              // Reload tasks when project filter changes
              setTimeout(() => loadTasks(), 100);
            }}
            onProjectsChange={() => {
              loadProjects();
              loadTasks();
            }}
          />
        )}


        <div className="flex-1 flex overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto min-w-0">
              {view === 'list' && (
                <TaskList
                  tasks={tasks}
                  projects={projects}
                  onTaskSelect={setSelectedTask}
                  onTaskComplete={handleTaskComplete}
                  onTaskReopen={handleTaskReopen}
                  onTaskEdit={(task) => {
                    setEditingTask(task);
                    setShowTaskForm(true);
                  }}
                  onTaskDelete={handleTaskDelete}
                  onViewAttachments={async (task) => {
                    console.log('[TodoModule] onViewAttachments called with task:', task.id, task.title);
                    // If task doesn't have full attachments loaded, fetch it
                    if (!task.attachments || task.attachments.length === 0) {
                      if (session?.accessToken) {
                        try {
                          const fullTask = await todoAPI.getTaskById(session.accessToken, task.id);
                          console.log('[TodoModule] Fetched full task with attachments:', fullTask.attachments?.length);
                          setViewingAttachments(fullTask);
                        } catch (error) {
                          console.error('[TodoModule] Failed to fetch task:', error);
                          // Fallback to the task we have
                          setViewingAttachments(task);
                        }
                      } else {
                        setViewingAttachments(task);
                      }
                    } else {
                      setViewingAttachments(task);
                    }
                  }}
                  onCreateTask={() => {
                    setEditingTask(null);
                    setShowTaskForm(true);
                  }}
                />
              )}
              {view === 'board' && (
                <TaskBoard
                  tasks={tasks}
                  onTaskSelect={setSelectedTask}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskReopen={handleTaskReopen}
                  onTaskEdit={(task) => {
                    setEditingTask(task);
                    setShowTaskForm(true);
                  }}
                  onTaskDelete={handleTaskDelete}
                  onViewAttachments={async (task) => {
                    console.log('[TodoModule] onViewAttachments called with task:', task.id, task.title);
                    // If task doesn't have full attachments loaded, fetch it
                    if (!task.attachments || task.attachments.length === 0) {
                      if (session?.accessToken) {
                        try {
                          const fullTask = await todoAPI.getTaskById(session.accessToken, task.id);
                          console.log('[TodoModule] Fetched full task with attachments:', fullTask.attachments?.length);
                          setViewingAttachments(fullTask);
                        } catch (error) {
                          console.error('[TodoModule] Failed to fetch task:', error);
                          // Fallback to the task we have
                          setViewingAttachments(task);
                        }
                      } else {
                        setViewingAttachments(task);
                      }
                    } else {
                      setViewingAttachments(task);
                    }
                  }}
                  onCreateTask={() => {
                    setEditingTask(null);
                    setShowTaskForm(true);
                  }}
                />
              )}
              {view === 'calendar' && (
                <TaskCalendar
                  tasks={tasks}
                  calendarEvents={calendarEvents}
                  onTaskSelect={setSelectedTask}
                  onTaskCreate={(dueDate) => {
                    setEditingTask(null);
                    setInitialDueDate(dueDate);
                    setShowTaskForm(true);
                  }}
                  viewMode={calendarViewMode}
                  currentDate={calendarDate}
                  onDateChange={(date) => {
                    setCalendarDate(date);
                    // Reload calendar events when date changes
                    setTimeout(() => loadCalendarEvents(), 100);
                  }}
                  onViewModeChange={(mode) => {
                    setCalendarViewMode(mode);
                    // Reload calendar events when view mode changes
                    setTimeout(() => loadCalendarEvents(), 100);
                  }}
                />
              )}
            </div>

            {/* Task Detail Panel - Always render but conditionally show */}
            {selectedTask && (
              <div className="w-96 min-w-[384px] max-w-[384px] flex-shrink-0 h-full overflow-hidden border-l border-gray-200">
                <TaskDetail
                  task={selectedTask}
                  onClose={() => setSelectedTask(null)}
                  onUpdate={async (data) => {
                    // If data is a full Task object (from comment refresh), update selectedTask
                    if (data && typeof data === 'object' && 'id' in data && 'title' in data) {
                      setSelectedTask(data as Task);
                    } else {
                      // Otherwise it's an UpdateTaskInput, handle normally
                      await handleTaskUpdate(selectedTask.id, data);
                      // Refresh selected task after update
                      if (session?.accessToken) {
                        const updatedTask = await todoAPI.getTaskById(session.accessToken, selectedTask.id);
                        setSelectedTask(updatedTask);
                      }
                    }
                  }}
                  onDelete={() => handleTaskDelete(selectedTask.id)}
                  onComplete={() => handleTaskComplete(selectedTask.id)}
                  onRefresh={loadTasks}
                />
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* Attachment Viewer Modal */}
      {viewingAttachments && (
        <AttachmentViewer
          attachments={viewingAttachments.attachments || []}
          taskId={viewingAttachments.id}
          isOpen={true}
          onClose={() => setViewingAttachments(null)}
          onRefresh={async () => {
            if (session?.accessToken) {
              const updatedTask = await todoAPI.getTaskById(session.accessToken, viewingAttachments.id);
              setViewingAttachments(updatedTask);
              // Also update in tasks list if this task is selected
              if (selectedTask?.id === viewingAttachments.id) {
                setSelectedTask(updatedTask);
              }
              await loadTasks();
            }
          }}
        />
      )}

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          task={editingTask}
          dashboardId={effectiveDashboardId}
          businessId={businessId || undefined}
          initialDueDate={initialDueDate}
          onSave={editingTask 
            ? (data) => handleTaskUpdate(editingTask.id, data)
            : handleTaskCreate
          }
          onClose={() => {
            setShowTaskForm(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}

