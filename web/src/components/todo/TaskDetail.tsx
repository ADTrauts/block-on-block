'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Badge, Avatar, Textarea, Spinner } from 'shared/components';
import { 
  X, 
  Calendar, 
  Flag, 
  User, 
  Tag, 
  ListChecks, 
  MessageSquare,
  Paperclip,
  Clock,
  CheckCircle2,
  Edit,
  Trash2,
  Link as LinkIcon,
  Unlink,
  ExternalLink,
  GitBranch,
  AlertCircle,
  Plus,
  Search,
  File
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { Task, UpdateTaskInput, TaskDependency, TaskTimeLog, TimeLogsResponse } from '@/api/todo';
import * as todoAPI from '@/api/todo';
import { TaskTimer } from './TaskTimer';
import { TimeHistory } from './TimeHistory';
import { DriveFilePicker } from './DriveFilePicker';
import * as driveAPI from '@/api/drive';

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onUpdate: (data: UpdateTaskInput) => void;
  onDelete: () => void;
  onComplete: () => void;
  onRefresh?: () => void;
}

export function TaskDetail({ task, onClose, onUpdate, onDelete, onComplete, onRefresh }: TaskDetailProps) {
  const { data: session } = useSession();
  const [comment, setComment] = useState('');
  const [linkedEvents, setLinkedEvents] = useState<Array<{ id: string; title: string; startAt: string; endAt: string; calendarId: string }>>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const [isSubmittingSubtask, setIsSubmittingSubtask] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [dependencies, setDependencies] = useState<{ dependsOn: TaskDependency[]; blockedBy: TaskDependency[] }>({ dependsOn: [], blockedBy: [] });
  const [isLoadingDependencies, setIsLoadingDependencies] = useState(false);
  const [showAddDependency, setShowAddDependency] = useState(false);
  const [dependencySearch, setDependencySearch] = useState('');
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [activeTimer, setActiveTimer] = useState<TaskTimeLog | null>(null);
  const [timeData, setTimeData] = useState<TimeLogsResponse | null>(null);
  const [isLoadingTime, setIsLoadingTime] = useState(false);
  const [linkedFiles, setLinkedFiles] = useState<Array<{ id: string; fileId: string; taskId: string }>>([]);
  const [linkedFileDetails, setLinkedFileDetails] = useState<Array<{ id: string; name: string; url: string; type: string }>>([]);
  const [isLoadingLinkedFiles, setIsLoadingLinkedFiles] = useState(false);
  const [showDriveFilePicker, setShowDriveFilePicker] = useState(false);

  useEffect(() => {
    if (task && session?.accessToken) {
      loadLinkedEvents();
      loadDependencies();
      loadActiveTimer();
      loadTimeLogs();
      loadLinkedFiles();
    }
  }, [task.id, session?.accessToken]);

  const loadLinkedEvents = async () => {
    if (!session?.accessToken) return;
    setLoadingEvents(true);
    try {
      const events = await todoAPI.getTaskLinkedEvents(session.accessToken, task.id);
      setLinkedEvents(events);
    } catch (error) {
      console.error('Failed to load linked events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadLinkedFiles = async () => {
    if (!session?.accessToken) return;
    setIsLoadingLinkedFiles(true);
    try {
      const result = await todoAPI.getTaskLinkedFiles(task.id, session.accessToken);
      setLinkedFiles(result.files);
      
      // Fetch file details from Drive API
      if (result.fileIds.length > 0) {
        try {
          // Get all files to find the linked ones
          const allFiles = await driveAPI.listFiles(session.accessToken);
          const fileDetails = result.fileIds
            .map((fileId) => {
              const file = allFiles.find((f: driveAPI.File) => f.id === fileId);
              return file ? {
                id: fileId,
                name: file.name,
                url: file.url,
                type: file.type,
              } : null;
            })
            .filter((f): f is { id: string; name: string; url: string; type: string } => f !== null);
          setLinkedFileDetails(fileDetails);
        } catch (error) {
          console.error('Failed to load file details:', error);
          // Set file details with just IDs if we can't load details
          setLinkedFileDetails(result.fileIds.map(fileId => ({
            id: fileId,
            name: 'Unknown file',
            url: '',
            type: 'unknown',
          })));
        }
      } else {
        setLinkedFileDetails([]);
      }
    } catch (error) {
      console.error('Failed to load linked files:', error);
    } finally {
      setIsLoadingLinkedFiles(false);
    }
  };

  const loadDependencies = async () => {
    if (!session?.accessToken) return;
    setIsLoadingDependencies(true);
    try {
      const deps = await todoAPI.getTaskDependencies(session.accessToken, task.id);
      setDependencies({
        dependsOn: deps.dependsOn.map(d => ({
          id: d.id,
          taskId: task.id,
          dependsOnTaskId: d.task.id,
          dependsOn: d.task,
        })),
        blockedBy: deps.blockedBy.map(d => ({
          id: d.id,
          taskId: d.task.id,
          dependsOnTaskId: task.id,
          task: d.task,
        })),
      });
    } catch (error) {
      console.error('Failed to load dependencies:', error);
    } finally {
      setIsLoadingDependencies(false);
    }
  };

  const loadActiveTimer = async () => {
    if (!session?.accessToken) return;
    try {
      const result = await todoAPI.getActiveTimer(session.accessToken);
      // Set active timer if it exists (even if for different task, so we can show warning)
      setActiveTimer(result.timeLog);
    } catch (error) {
      console.error('Failed to load active timer:', error);
      setActiveTimer(null);
    }
  };

  const loadTimeLogs = async () => {
    if (!session?.accessToken) return;
    setIsLoadingTime(true);
    try {
      const data = await todoAPI.getTimeLogs(task.id, session.accessToken);
      setTimeData(data);
    } catch (error) {
      console.error('Failed to load time logs:', error);
    } finally {
      setIsLoadingTime(false);
    }
  };

  const handleTimerStart = (timeLog: TaskTimeLog) => {
    setActiveTimer(timeLog);
    loadTimeLogs();
  };

  const handleTimerStop = (timeLog: TaskTimeLog, totalTimeSpent: number) => {
    setActiveTimer(null);
    loadTimeLogs();
    // Update task's actualTimeSpent
    onUpdate({ actualTimeSpent: totalTimeSpent });
  };

  const handleTimeUpdate = (totalTimeSpent: number) => {
    onUpdate({ actualTimeSpent: totalTimeSpent });
    loadTimeLogs();
  };

  const handleAddDependency = async (dependsOnTaskId: string) => {
    if (!session?.accessToken) return;
    try {
      await todoAPI.addTaskDependency(session.accessToken, task.id, dependsOnTaskId);
      toast.success('Dependency added');
      await loadDependencies();
      if (onRefresh) {
        await onRefresh();
      }
      setShowAddDependency(false);
      setDependencySearch('');
    } catch (error) {
      console.error('Failed to add dependency:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add dependency');
    }
  };

  const handleRemoveDependency = async (dependsOnTaskId: string) => {
    if (!session?.accessToken) return;
    if (!confirm('Remove this dependency?')) return;
    try {
      await todoAPI.removeTaskDependency(session.accessToken, task.id, dependsOnTaskId);
      toast.success('Dependency removed');
      await loadDependencies();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Failed to remove dependency:', error);
      toast.error('Failed to remove dependency');
    }
  };

  const searchTasksForDependency = async (query: string) => {
    if (!session?.accessToken || !query.trim()) {
      setAvailableTasks([]);
      return;
    }
    try {
      const tasks = await todoAPI.getTasks(session.accessToken, {
        dashboardId: task.dashboardId,
        businessId: task.businessId || undefined,
      });
      // Filter out current task and already added dependencies
      const filtered = tasks.filter(
        t => t.id !== task.id && 
        !dependencies.dependsOn.some(d => d.dependsOnTaskId === t.id) &&
        t.title.toLowerCase().includes(query.toLowerCase())
      );
      setAvailableTasks(filtered.slice(0, 5));
    } catch (error) {
      console.error('Failed to search tasks:', error);
    }
  };

  useEffect(() => {
    if (showAddDependency && dependencySearch) {
      const timeout = setTimeout(() => {
        searchTasksForDependency(dependencySearch);
      }, 300);
      return () => clearTimeout(timeout);
    } else {
      setAvailableTasks([]);
    }
  }, [dependencySearch, showAddDependency]);

  const handleCreateEvent = async () => {
    if (!session?.accessToken || !task.dueDate) {
      toast.error('Task must have a due date to create calendar event');
      return;
    }

    try {
      await todoAPI.createEventFromTask(session.accessToken, task.id);
      toast.success('Calendar event created!');
      await loadLinkedEvents();
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      toast.error('Failed to create calendar event');
    }
  };

  const handleUnlinkEvent = async (eventId: string) => {
    if (!session?.accessToken) return;

    try {
      await todoAPI.unlinkTaskFromEvent(session.accessToken, task.id, eventId);
      toast.success('Event unlinked');
      await loadLinkedEvents();
    } catch (error) {
      console.error('Failed to unlink event:', error);
      toast.error('Failed to unlink event');
    }
  };

  const handleSubmitComment = async () => {
    if (!session?.accessToken || !comment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await todoAPI.createTaskComment(session.accessToken, task.id, comment.trim());
      setComment('');
      toast.success('Comment added');
      // Refresh task to get updated comments
      if (onRefresh) {
        await onRefresh();
      }
      // Also refresh the current task data
      if (session?.accessToken) {
        const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
        onUpdate({ 
          title: updatedTask.title,
          description: updatedTask.description || undefined,
          status: updatedTask.status,
          priority: updatedTask.priority,
          dueDate: updatedTask.dueDate || undefined,
          startDate: updatedTask.startDate || undefined,
          completedAt: updatedTask.completedAt || undefined,
          category: updatedTask.category || undefined,
          timeEstimate: updatedTask.timeEstimate || undefined,
          assignedToId: updatedTask.assignedToId || undefined,
          projectId: updatedTask.projectId || undefined,
          actualTimeSpent: updatedTask.actualTimeSpent || undefined,
        });
      }
    } catch (error) {
      console.error('Failed to create comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleStartEditComment = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId);
    setEditingCommentContent(currentContent);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentContent('');
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!session?.accessToken || !editingCommentContent.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await todoAPI.updateTaskComment(session.accessToken, task.id, commentId, editingCommentContent.trim());
      setEditingCommentId(null);
      setEditingCommentContent('');
      toast.success('Comment updated');
      // Refresh task to get updated comments
      if (onRefresh) {
        await onRefresh();
      }
      // Also refresh the current task data
      if (session?.accessToken) {
        const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
        onUpdate({ 
          title: updatedTask.title,
          description: updatedTask.description || undefined,
          status: updatedTask.status,
          priority: updatedTask.priority,
          dueDate: updatedTask.dueDate || undefined,
          startDate: updatedTask.startDate || undefined,
          completedAt: updatedTask.completedAt || undefined,
          category: updatedTask.category || undefined,
          timeEstimate: updatedTask.timeEstimate || undefined,
          assignedToId: updatedTask.assignedToId || undefined,
          projectId: updatedTask.projectId || undefined,
          actualTimeSpent: updatedTask.actualTimeSpent || undefined,
        });
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
      toast.error('Failed to update comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!session?.accessToken || isSubmittingComment) return;

    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    setIsSubmittingComment(true);
    try {
      await todoAPI.deleteTaskComment(session.accessToken, task.id, commentId);
      toast.success('Comment deleted');
      // Refresh task to get updated comments
      if (onRefresh) {
        await onRefresh();
      }
      // Also refresh the current task data
      if (session?.accessToken) {
        const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
        onUpdate({ 
          title: updatedTask.title,
          description: updatedTask.description || undefined,
          status: updatedTask.status,
          priority: updatedTask.priority,
          dueDate: updatedTask.dueDate || undefined,
          startDate: updatedTask.startDate || undefined,
          completedAt: updatedTask.completedAt || undefined,
          category: updatedTask.category || undefined,
          timeEstimate: updatedTask.timeEstimate || undefined,
          assignedToId: updatedTask.assignedToId || undefined,
          projectId: updatedTask.projectId || undefined,
          actualTimeSpent: updatedTask.actualTimeSpent || undefined,
        });
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error('Failed to delete comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Get current user ID for edit/delete permissions
  const currentUserId = session?.user?.id || (session?.user as { sub?: string })?.sub;

  if (!task) {
    return null;
  }

  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-gray-50">
        <h2 className="text-xl font-bold">Task Details</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Title & Status */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <input 
              type="checkbox" 
              checked={task.status === 'DONE'}
              onChange={onComplete}
              className="w-5 h-5"
            />
            <h3 className="text-2xl font-bold">{task.title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge>{task.status}</Badge>
            <Badge className="bg-red-100 text-red-800">
              <Flag className="w-3 h-3 mr-1" />
              {task.priority}
            </Badge>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-2">
          {task.dueDate && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          {task.assignedTo && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-500" />
              <Avatar 
                src={task.assignedTo.image || undefined} 
                nameOrEmail={task.assignedTo.name || task.assignedTo.email}
                size={24}
              />
              <span>Assigned to: {task.assignedTo.name || task.assignedTo.email}</span>
            </div>
          )}
          {task.category && (
            <div className="flex items-center gap-2 text-sm">
              <Tag className="w-4 h-4 text-gray-500" />
              <span>{task.category}</span>
            </div>
          )}
          {task.timeEstimate && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>Estimate: {task.timeEstimate} minutes</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <h4 className="font-semibold mb-2">Description</h4>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {task.description || 'No description'}
          </p>
        </div>

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              Subtasks
              {task.subtasks && task.subtasks.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({task.subtasks.filter((st: Task) => st.status === 'DONE').length}/{task.subtasks.length})
                </span>
              )}
            </h4>
          </div>
          
          {/* Add Subtask Form - At the top */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newSubtaskTitle.trim() && !isSubmittingSubtask) {
                  if (!session?.accessToken) return;
                  setIsSubmittingSubtask(true);
                  try {
                    await todoAPI.createSubtask(session.accessToken, task.id, { title: newSubtaskTitle.trim() });
                    setNewSubtaskTitle('');
                    toast.success('Subtask added');
                    // Refresh task
                    if (session?.accessToken) {
                      const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
                      onUpdate({ 
                        title: updatedTask.title,
                        description: updatedTask.description || undefined,
                        status: updatedTask.status,
                        priority: updatedTask.priority,
                        dueDate: updatedTask.dueDate || undefined,
                        startDate: updatedTask.startDate || undefined,
                        completedAt: updatedTask.completedAt || undefined,
                        category: updatedTask.category || undefined,
                        timeEstimate: updatedTask.timeEstimate || undefined,
                        assignedToId: updatedTask.assignedToId || undefined,
                        projectId: updatedTask.projectId || undefined,
                        actualTimeSpent: updatedTask.actualTimeSpent || undefined,
                      });
                    }
                  } catch (error) {
                    console.error('Failed to create subtask:', error);
                    toast.error('Failed to add subtask');
                  } finally {
                    setIsSubmittingSubtask(false);
                  }
                }
              }}
              placeholder="Add a subtask..."
              className="flex-1 px-3 py-2 text-sm border rounded"
              disabled={isSubmittingSubtask}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                if (!session?.accessToken || !newSubtaskTitle.trim() || isSubmittingSubtask) return;
                setIsSubmittingSubtask(true);
                try {
                  await todoAPI.createSubtask(session.accessToken, task.id, { title: newSubtaskTitle.trim() });
                  setNewSubtaskTitle('');
                  toast.success('Subtask added');
                  // Refresh task
                  if (session?.accessToken) {
                    const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
                    onUpdate({ 
                      title: updatedTask.title,
                      description: updatedTask.description || undefined,
                      status: updatedTask.status,
                      priority: updatedTask.priority,
                      dueDate: updatedTask.dueDate || undefined,
                      startDate: updatedTask.startDate || undefined,
                      completedAt: updatedTask.completedAt || undefined,
                      category: updatedTask.category || undefined,
                      timeEstimate: updatedTask.timeEstimate || undefined,
                      assignedToId: updatedTask.assignedToId || undefined,
                      projectId: updatedTask.projectId || undefined,
                      actualTimeSpent: updatedTask.actualTimeSpent || undefined,
                    });
                  }
                } catch (error) {
                  console.error('Failed to create subtask:', error);
                  toast.error('Failed to add subtask');
                } finally {
                  setIsSubmittingSubtask(false);
                }
              }}
              disabled={isSubmittingSubtask || !newSubtaskTitle.trim()}
            >
              Add
            </Button>
          </div>
          
          {/* Subtasks List - In one box with indented items */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="bg-gray-50 rounded border border-gray-200 p-3 space-y-1">
              {task.subtasks.map((subtask: Task) => {
                const isCompleted = subtask.status === 'DONE';
                const isEditing = editingSubtaskId === subtask.id;
                
                return (
                  <div key={subtask.id} className="flex items-center gap-2 pl-6 py-1">
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      onChange={async () => {
                        if (!session?.accessToken || isSubmittingSubtask) return;
                        setIsSubmittingSubtask(true);
                        try {
                          if (isCompleted) {
                            await todoAPI.updateSubtask(session.accessToken, task.id, subtask.id, { status: 'TODO' });
                          } else {
                            await todoAPI.completeSubtask(session.accessToken, task.id, subtask.id);
                          }
                          // Refresh task
                          if (session?.accessToken) {
                            const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
                            onUpdate({ 
                      title: updatedTask.title,
                      description: updatedTask.description || undefined,
                      status: updatedTask.status,
                      priority: updatedTask.priority,
                      dueDate: updatedTask.dueDate || undefined,
                      startDate: updatedTask.startDate || undefined,
                      completedAt: updatedTask.completedAt || undefined,
                      category: updatedTask.category || undefined,
                      timeEstimate: updatedTask.timeEstimate || undefined,
                      assignedToId: updatedTask.assignedToId || undefined,
                      projectId: updatedTask.projectId || undefined,
                      actualTimeSpent: updatedTask.actualTimeSpent || undefined,
                    });
                          }
                        } catch (error) {
                          console.error('Failed to toggle subtask:', error);
                          toast.error('Failed to update subtask');
                        } finally {
                          setIsSubmittingSubtask(false);
                        }
                      }}
                      className="w-4 h-4"
                      disabled={isSubmittingSubtask}
                    />
                    {isEditing ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={editingSubtaskTitle}
                          onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && editingSubtaskTitle.trim()) {
                              if (!session?.accessToken || isSubmittingSubtask) return;
                              setIsSubmittingSubtask(true);
                              try {
                                await todoAPI.updateSubtask(session.accessToken, task.id, subtask.id, { title: editingSubtaskTitle.trim() });
                                setEditingSubtaskId(null);
                                setEditingSubtaskTitle('');
                                // Refresh task
                                if (session?.accessToken) {
                                  const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
                                  onUpdate({ 
                      title: updatedTask.title,
                      description: updatedTask.description || undefined,
                      status: updatedTask.status,
                      priority: updatedTask.priority,
                      dueDate: updatedTask.dueDate || undefined,
                      startDate: updatedTask.startDate || undefined,
                      completedAt: updatedTask.completedAt || undefined,
                      category: updatedTask.category || undefined,
                      timeEstimate: updatedTask.timeEstimate || undefined,
                      assignedToId: updatedTask.assignedToId || undefined,
                      projectId: updatedTask.projectId || undefined,
                      actualTimeSpent: updatedTask.actualTimeSpent || undefined,
                    });
                                }
                              } catch (error) {
                                console.error('Failed to update subtask:', error);
                                toast.error('Failed to update subtask');
                              } finally {
                                setIsSubmittingSubtask(false);
                              }
                            } else if (e.key === 'Escape') {
                              setEditingSubtaskId(null);
                              setEditingSubtaskTitle('');
                            }
                          }}
                          className="flex-1 px-2 py-1 text-sm border rounded"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSubtaskId(null);
                            setEditingSubtaskTitle('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span 
                          className={`flex-1 text-sm ${isCompleted ? 'line-through text-gray-500' : 'text-gray-700'} cursor-pointer`}
                          onClick={() => {
                            setEditingSubtaskId(subtask.id);
                            setEditingSubtaskTitle(subtask.title);
                          }}
                        >
                          {subtask.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!session?.accessToken || isSubmittingSubtask) return;
                            if (!confirm('Are you sure you want to delete this subtask?')) return;
                            setIsSubmittingSubtask(true);
                            try {
                              await todoAPI.deleteSubtask(session.accessToken, task.id, subtask.id);
                              toast.success('Subtask deleted');
                              // Refresh task
                              if (session?.accessToken) {
                                const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
                                onUpdate({ 
                      title: updatedTask.title,
                      description: updatedTask.description || undefined,
                      status: updatedTask.status,
                      priority: updatedTask.priority,
                      dueDate: updatedTask.dueDate || undefined,
                      startDate: updatedTask.startDate || undefined,
                      completedAt: updatedTask.completedAt || undefined,
                      category: updatedTask.category || undefined,
                      timeEstimate: updatedTask.timeEstimate || undefined,
                      assignedToId: updatedTask.assignedToId || undefined,
                      projectId: updatedTask.projectId || undefined,
                      actualTimeSpent: updatedTask.actualTimeSpent || undefined,
                    });
                              }
                            } catch (error) {
                              console.error('Failed to delete subtask:', error);
                              toast.error('Failed to delete subtask');
                            } finally {
                              setIsSubmittingSubtask(false);
                            }
                          }}
                          className="h-6 px-2 text-red-600 hover:text-red-700"
                          disabled={isSubmittingSubtask}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attachments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments ({task.attachments?.length || 0})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAttachment}
            >
              <Paperclip className="w-4 h-4 mr-1" />
              Upload
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !session?.accessToken || isUploadingAttachment) return;
              
              setIsUploadingAttachment(true);
              try {
                await todoAPI.uploadTaskAttachment(session.accessToken, task.id, file);
                toast.success('Attachment uploaded');
                // Refresh task
                if (session?.accessToken) {
                  const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
                  onUpdate({ 
                    title: updatedTask.title,
                    description: updatedTask.description || undefined,
                    status: updatedTask.status,
                    priority: updatedTask.priority,
                    dueDate: updatedTask.dueDate || undefined,
                    startDate: updatedTask.startDate || undefined,
                    completedAt: updatedTask.completedAt || undefined,
                    category: updatedTask.category || undefined,
                    timeEstimate: updatedTask.timeEstimate || undefined,
                    assignedToId: updatedTask.assignedToId || undefined,
                    projectId: updatedTask.projectId || undefined,
                    actualTimeSpent: updatedTask.actualTimeSpent || undefined,
                  });
                }
              } catch (error) {
                console.error('Failed to upload attachment:', error);
                toast.error('Failed to upload attachment');
              } finally {
                setIsUploadingAttachment(false);
                // Reset file input
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }
            }}
            disabled={isUploadingAttachment}
          />
          
          {task.attachments && task.attachments.length > 0 ? (
            <div className="space-y-2">
              {task.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{attachment.name}</div>
                      {attachment.size && (
                        <div className="text-xs text-gray-500">
                          {(attachment.size / 1024).toFixed(1)} KB
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {attachment.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(attachment.url || '', '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!session?.accessToken || isUploadingAttachment) return;
                        if (!confirm('Are you sure you want to delete this attachment?')) return;
                        setIsUploadingAttachment(true);
                        try {
                          await todoAPI.deleteTaskAttachment(session.accessToken, task.id, attachment.id);
                          toast.success('Attachment deleted');
                          // Refresh task
                          if (session?.accessToken) {
                            const updatedTask = await todoAPI.getTaskById(session.accessToken, task.id);
                            onUpdate({ 
                      title: updatedTask.title,
                      description: updatedTask.description || undefined,
                      status: updatedTask.status,
                      priority: updatedTask.priority,
                      dueDate: updatedTask.dueDate || undefined,
                      startDate: updatedTask.startDate || undefined,
                      completedAt: updatedTask.completedAt || undefined,
                      category: updatedTask.category || undefined,
                      timeEstimate: updatedTask.timeEstimate || undefined,
                      assignedToId: updatedTask.assignedToId || undefined,
                      projectId: updatedTask.projectId || undefined,
                      actualTimeSpent: updatedTask.actualTimeSpent || undefined,
                    });
                          }
                        } catch (error) {
                          console.error('Failed to delete attachment:', error);
                          toast.error('Failed to delete attachment');
                        } finally {
                          setIsUploadingAttachment(false);
                        }
                      }}
                      className="h-6 px-2 text-red-600 hover:text-red-700"
                      disabled={isUploadingAttachment}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No attachments</div>
          )}
        </div>

        {/* Linked Drive Files */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Linked Files ({linkedFiles.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDriveFilePicker(true)}
            >
              <File className="w-4 h-4 mr-1" />
              Link File
            </Button>
          </div>
          
          {isLoadingLinkedFiles ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size={16} />
            </div>
          ) : linkedFiles.length > 0 ? (
            <div className="space-y-2">
              {linkedFileDetails.map((fileDetail, idx) => {
                const link = linkedFiles.find(l => l.fileId === fileDetail.id);
                return (
                  <div
                    key={link?.id || fileDetail.id}
                    className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <File className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{fileDetail.name}</div>
                        <div className="text-xs text-gray-500">{fileDetail.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (fileDetail.url) {
                            window.open(fileDetail.url, '_blank');
                          }
                        }}
                        className="h-6 px-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (!session?.accessToken || !link) return;
                          try {
                            await todoAPI.unlinkTaskFromFile(session.accessToken, task.id, link.fileId);
                            toast.success('File unlinked');
                            await loadLinkedFiles();
                          } catch (error) {
                            console.error('Failed to unlink file:', error);
                            toast.error('Failed to unlink file');
                          }
                        }}
                        className="h-6 px-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No linked files</div>
          )}
        </div>

        {/* Dependencies */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Dependencies
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddDependency(!showAddDependency)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {showAddDependency && (
            <div className="mb-3 p-2 bg-gray-50 rounded border">
              <div className="flex gap-2 mb-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={dependencySearch}
                    onChange={(e) => setDependencySearch(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {availableTasks.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {availableTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleAddDependency(t.id)}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{t.title}</div>
                        <div className="text-xs text-gray-500">{t.status}</div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isLoadingDependencies ? (
            <div className="text-sm text-gray-500">Loading dependencies...</div>
          ) : (
            <div className="space-y-3">
              {/* Depends On */}
              {dependencies.dependsOn.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Depends On:</div>
                  <div className="space-y-1">
                    {dependencies.dependsOn.map((dep) => (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{dep.dependsOn?.title || 'Unknown Task'}</div>
                          <div className="text-xs text-gray-600">
                            Status: {dep.dependsOn?.status || 'Unknown'}
                            {dep.dependsOn?.status !== 'DONE' && (
                              <span className="ml-2 text-orange-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Blocking
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDependency(dep.dependsOnTaskId)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blocked By */}
              {dependencies.blockedBy.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Blocked By:</div>
                  <div className="space-y-1">
                    {dependencies.blockedBy.map((dep) => (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{dep.task?.title || 'Unknown Task'}</div>
                          <div className="text-xs text-gray-600">Status: {dep.task?.status || 'Unknown'}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDependency(dep.taskId)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dependencies.dependsOn.length === 0 && dependencies.blockedBy.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-2">
                  No dependencies
                </div>
              )}
            </div>
          )}
        </div>

        {/* Linked Calendar Events */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Calendar Events ({linkedEvents.length})
            </h4>
            {task.dueDate && (
              <Button variant="ghost" size="sm" onClick={handleCreateEvent}>
                <LinkIcon className="w-4 h-4 mr-1" />
                Create Event
              </Button>
            )}
          </div>
          {loadingEvents ? (
            <div className="text-sm text-gray-500">Loading events...</div>
          ) : linkedEvents.length > 0 ? (
            <div className="space-y-2">
              {linkedEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-2 bg-purple-50 border border-purple-200 rounded"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{event.title}</div>
                    <div className="text-xs text-gray-600">
                      {new Date(event.startAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/calendar?eventId=${event.id}`, '_blank')}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlinkEvent(event.id)}
                    >
                      <Unlink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              {task.dueDate
                ? 'No calendar events linked. Click "Create Event" to create one.'
                : 'Add a due date to create a calendar event.'}
            </div>
          )}
        </div>

        {/* Time Tracking */}
        <div>
          <TaskTimer
            taskId={task.id}
            activeTimer={activeTimer}
            onTimerStart={handleTimerStart}
            onTimerStop={handleTimerStop}
          />
          {timeData && (
            <div className="mt-4">
              <TimeHistory
                taskId={task.id}
                timeData={timeData}
                onRefresh={loadTimeLogs}
                onUpdate={handleTimeUpdate}
              />
            </div>
          )}
        </div>

        {/* Comments */}
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Comments ({task.comments?.length || 0})
          </h4>
          <div className="space-y-3 mb-3">
            {task.comments?.map((commentItem) => {
              const isEditing = editingCommentId === commentItem.id;
              const isAuthor = commentItem.userId === currentUserId;
              
              return (
                <div key={commentItem.id} className="flex gap-2">
                <Avatar 
                  src={commentItem.user.image || undefined} 
                  nameOrEmail={commentItem.user.name || commentItem.user.email}
                  size={24}
                />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{commentItem.user.name || commentItem.user.email}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(commentItem.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {isAuthor && !isEditing && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEditComment(commentItem.id, commentItem.content)}
                            className="h-6 px-2"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(commentItem.id)}
                            className="h-6 px-2 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingCommentContent}
                          onChange={(e) => setEditingCommentContent(e.target.value)}
                          placeholder="Edit comment..."
                          className="flex-1 text-sm"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSaveEditComment(commentItem.id)}
                            disabled={isSubmittingComment || !editingCommentContent.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEditComment}
                            disabled={isSubmittingComment}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{commentItem.content}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
              placeholder="Add a comment... (Cmd/Ctrl+Enter to submit)"
              className="flex-1"
              rows={2}
              disabled={isSubmittingComment}
            />
            <Button 
              variant="primary" 
              size="sm"
              onClick={handleSubmitComment}
              disabled={isSubmittingComment || !comment.trim()}
            >
              {isSubmittingComment ? '...' : 'Post'}
            </Button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t flex gap-2">
        <Button variant="primary" className="flex-1" onClick={onComplete}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Complete
        </Button>
        <Button variant="secondary">
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Drive File Picker Modal */}
      {showDriveFilePicker && (
        <DriveFilePicker
          isOpen={showDriveFilePicker}
          onClose={() => setShowDriveFilePicker(false)}
          onSelectFile={async (fileId) => {
            if (!session?.accessToken) return;
            try {
              await todoAPI.linkTaskToFile(task.id, fileId, session.accessToken);
              toast.success('File linked to task');
              await loadLinkedFiles();
            } catch (error) {
              console.error('Failed to link file:', error);
              toast.error('Failed to link file to task');
            }
          }}
          excludeFileIds={linkedFiles.map(l => l.fileId)}
        />
      )}
    </div>
  );
}

