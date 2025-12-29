/**
 * To-Do Module API Client
 * Handles all API calls for task management
 */

// Type definitions
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dashboardId: string;
  businessId?: string | null;
  householdId?: string | null;
  createdById: string;
  assignedToId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  completedAt?: string | null;
  snoozedUntil?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  parentRecurringTaskId?: string | null;
  recurrenceRule?: string | null;
  recurrenceEndAt?: string | null;
  tags: string[];
  category?: string | null;
  timeEstimate?: number | null;
  actualTimeSpent?: number | null;
  trashedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  subtasks?: Task[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  dependsOnTasks?: TaskDependency[];
  blockingTasks?: TaskDependency[];
  project?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
  _count?: {
    subtasks: number;
    comments: number;
    watchers: number;
    attachments?: number;
  };
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileId?: string | null;
  url?: string | null;
  name: string;
  size?: number | null;
  mimeType?: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dashboardId: string;
  businessId?: string;
  householdId?: string;
  dueDate?: string;
  startDate?: string;
  category?: string;
  tags?: string[];
  timeEstimate?: number;
  assignedToId?: string;
  parentTaskId?: string;
  projectId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  startDate?: string;
  completedAt?: string | null;
  snoozedUntil?: string | null;
  category?: string;
  tags?: string[];
  timeEstimate?: number;
  actualTimeSpent?: number;
  assignedToId?: string | null;
  projectId?: string | null;
  recurrenceRule?: string | null;
  recurrenceEndAt?: string | null;
}

export interface TaskProject {
  id: string;
  name: string;
  description?: string | null;
  dashboardId: string;
  businessId?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tasks: number;
  };
}

export interface GetTasksParams {
  dashboardId?: string;
  businessId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedToId?: string;
  projectId?: string | null;
}

// Helper to add Authorization header
function authHeaders(token: string, headers: Record<string, string> = {}) {
  return { ...headers, Authorization: `Bearer ${token}` };
}

/**
 * Get all tasks with optional filters
 */
export async function getTasks(token: string, params?: GetTasksParams): Promise<Task[]> {
  if (!token) throw new Error('Authentication required');
  
  const queryParams = new URLSearchParams();
  if (params?.dashboardId) queryParams.append('dashboardId', params.dashboardId);
  if (params?.businessId) queryParams.append('businessId', params.businessId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.priority) queryParams.append('priority', params.priority);
  if (params?.dueDate) queryParams.append('dueDate', params.dueDate);
  if (params?.assignedToId) queryParams.append('assignedToId', params.assignedToId);
  
  const url = `/api/todo/tasks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch tasks' }));
    throw new Error(error.error || 'Failed to fetch tasks');
  }
  
  return res.json();
}

/**
 * Get a single task by ID
 */
export async function getTaskById(token: string, id: string): Promise<Task> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${id}`, {
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch task' }));
    throw new Error(error.error || 'Failed to fetch task');
  }
  
  return res.json();
}

/**
 * Create a new task
 */
export async function createTask(token: string, data: CreateTaskInput): Promise<Task> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch('/api/todo/tasks', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create task' }));
    throw new Error(error.error || 'Failed to create task');
  }
  
  return res.json();
}

/**
 * Update a task
 */
export async function updateTask(token: string, id: string, data: UpdateTaskInput): Promise<Task> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${id}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to update task' }));
    throw new Error(error.error || 'Failed to update task');
  }
  
  return res.json();
}

/**
 * Delete a task (soft delete - moves to trash)
 */
export async function deleteTask(token: string, id: string): Promise<void> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to delete task' }));
    throw new Error(error.error || 'Failed to delete task');
  }
}

/**
 * Mark a task as complete
 */
export async function completeTask(token: string, id: string): Promise<Task> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${id}/complete`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to complete task' }));
    throw new Error(error.error || 'Failed to complete task');
  }
  
  return res.json();
}

/**
 * Reopen a completed task
 */
export async function reopenTask(token: string, id: string, status?: TaskStatus): Promise<Task> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${id}/reopen`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to reopen task' }));
    throw new Error(error.error || 'Failed to reopen task');
  }
  
  return res.json();
}

/**
 * Get tasks due today
 */
export async function getTodayTasks(token: string, dashboardId?: string, businessId?: string): Promise<Task[]> {
  const today = new Date().toISOString().split('T')[0];
  return getTasks(token, { dashboardId, businessId, dueDate: today });
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(token: string, dashboardId?: string, businessId?: string): Promise<Task[]> {
  if (!token) throw new Error('Authentication required');
  
  const queryParams = new URLSearchParams();
  if (dashboardId) queryParams.append('dashboardId', dashboardId);
  if (businessId) queryParams.append('businessId', businessId);
  
  const url = `/api/todo/tasks/overdue${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch overdue tasks' }));
    throw new Error(error.error || 'Failed to fetch overdue tasks');
  }
  
  return res.json();
}

/**
 * Create a calendar event from a task
 */
export async function createEventFromTask(token: string, taskId: string, calendarId?: string): Promise<{ task: Task; event: { id: string; title: string; startAt: string; endAt: string } }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/create-event`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ calendarId }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create calendar event' }));
    throw new Error(error.error || 'Failed to create calendar event');
  }
  
  return res.json();
}

/**
 * Link a task to an existing calendar event
 */
export async function linkTaskToEvent(token: string, taskId: string, eventId: string): Promise<void> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/link-event`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ eventId }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to link task to event' }));
    throw new Error(error.error || 'Failed to link task to event');
  }
}

/**
 * Unlink a task from a calendar event
 */
export async function unlinkTaskFromEvent(token: string, taskId: string, eventId: string): Promise<void> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/unlink-event/${eventId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to unlink task from event' }));
    throw new Error(error.error || 'Failed to unlink task from event');
  }
}

/**
 * Get all calendar events linked to a task
 */
export async function getTaskLinkedEvents(token: string, taskId: string): Promise<Array<{ id: string; title: string; startAt: string; endAt: string; calendarId: string }>> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/linked-events`, {
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch linked events' }));
    throw new Error(error.error || 'Failed to fetch linked events');
  }
  
  return res.json();
}

/**
 * Create a comment on a task
 */
export async function createTaskComment(token: string, taskId: string, content: string): Promise<TaskComment> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create comment' }));
    throw new Error(error.error || 'Failed to create comment');
  }
  
  return res.json();
}

/**
 * Update a comment on a task
 */
export async function updateTaskComment(token: string, taskId: string, commentId: string, content: string): Promise<TaskComment> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/comments/${commentId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to update comment' }));
    throw new Error(error.error || 'Failed to update comment');
  }
  
  return res.json();
}

/**
 * Delete a comment on a task
 */
export async function deleteTaskComment(token: string, taskId: string, commentId: string): Promise<void> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to delete comment' }));
    throw new Error(error.error || 'Failed to delete comment');
  }
}

/**
 * Create a subtask
 */
export async function createSubtask(token: string, parentTaskId: string, data: { title: string; description?: string; priority?: TaskPriority; dueDate?: string }): Promise<Task> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${parentTaskId}/subtasks`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create subtask' }));
    throw new Error(error.error || 'Failed to create subtask');
  }
  
  return res.json();
}

/**
 * Update a subtask
 */
export async function updateSubtask(token: string, parentTaskId: string, subtaskId: string, data: UpdateTaskInput): Promise<Task> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${parentTaskId}/subtasks/${subtaskId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to update subtask' }));
    throw new Error(error.error || 'Failed to update subtask');
  }
  
  return res.json();
}

/**
 * Delete a subtask
 */
export async function deleteSubtask(token: string, parentTaskId: string, subtaskId: string): Promise<void> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${parentTaskId}/subtasks/${subtaskId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to delete subtask' }));
    throw new Error(error.error || 'Failed to delete subtask');
  }
}

/**
 * Complete a subtask
 */
export async function completeSubtask(token: string, parentTaskId: string, subtaskId: string): Promise<Task> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${parentTaskId}/subtasks/${subtaskId}/complete`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to complete subtask' }));
    throw new Error(error.error || 'Failed to complete subtask');
  }
  
  return res.json();
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileId?: string | null;
  url?: string | null;
  name: string;
  size?: number | null;
  mimeType?: string | null;
}

/**
 * Upload a file attachment to a task
 */
export async function uploadTaskAttachment(token: string, taskId: string, file: File): Promise<TaskAttachment> {
  if (!token) throw new Error('Authentication required');
  
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`/api/todo/tasks/${taskId}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - browser will set it with boundary for FormData
    },
    body: formData,
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to upload attachment' }));
    throw new Error(error.error || 'Failed to upload attachment');
  }
  
  return res.json();
}

/**
 * Delete a task attachment
 */
export async function deleteTaskAttachment(token: string, taskId: string, attachmentId: string): Promise<void> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to delete attachment' }));
    throw new Error(error.error || 'Failed to delete attachment');
  }
}

/**
 * Add a dependency to a task
 */
export async function addTaskDependency(
  token: string,
  taskId: string,
  dependsOnTaskId: string
): Promise<TaskDependency> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/dependencies`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dependsOnTaskId }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to add dependency' }));
    throw new Error(error.error || 'Failed to add dependency');
  }

  return res.json();
}

/**
 * Remove a dependency from a task
 */
export async function removeTaskDependency(
  token: string,
  taskId: string,
  dependsOnTaskId: string
): Promise<void> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/dependencies/${dependsOnTaskId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to remove dependency' }));
    throw new Error(error.error || 'Failed to remove dependency');
  }
}

/**
 * Get all dependencies for a task
 */
export async function getTaskDependencies(
  token: string,
  taskId: string
): Promise<{ dependsOn: Array<{ id: string; task: Task }>; blockedBy: Array<{ id: string; task: Task }> }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/dependencies`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch dependencies' }));
    throw new Error(error.error || 'Failed to fetch dependencies');
  }

  return res.json();
}

/**
 * Get all task projects for a dashboard/business
 */
export async function getProjects(
  token: string,
  dashboardId: string,
  businessId?: string | null
): Promise<TaskProject[]> {
  if (!token) throw new Error('Authentication required');
  
  const params = new URLSearchParams({ dashboardId });
  if (businessId) {
    params.append('businessId', businessId);
  }
  
  const res = await fetch(`/api/todo/projects?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch projects' }));
    throw new Error(error.error || 'Failed to fetch projects');
  }
  
  return res.json();
}

/**
 * Create a new task project
 */
export async function createProject(
  token: string,
  data: {
    name: string;
    description?: string;
    dashboardId: string;
    businessId?: string | null;
    color?: string;
  }
): Promise<TaskProject> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch('/api/todo/projects', {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create project' }));
    throw new Error(error.error || 'Failed to create project');
  }
  
  return res.json();
}

/**
 * Update a task project
 */
export async function updateProject(
  token: string,
  projectId: string,
  data: {
    name?: string;
    description?: string;
    color?: string;
  }
): Promise<TaskProject> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/projects/${projectId}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to update project' }));
    throw new Error(error.error || 'Failed to update project');
  }
  
  return res.json();
}

/**
 * Delete a task project
 */
export async function deleteProject(token: string, projectId: string): Promise<void> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/projects/${projectId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to delete project' }));
    throw new Error(error.error || 'Failed to delete project');
  }
}

/**
 * Generate recurring task instances for a parent task
 */
export async function generateRecurringInstances(
  token: string,
  taskId: string,
  maxInstances?: number
): Promise<{ success: boolean; count: number }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/generate-instances`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ maxInstances: maxInstances || 100 }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to generate instances' }));
    throw new Error(error.error || 'Failed to generate instances');
  }
  
  return res.json();
}

/**
 * Get human-readable description of recurrence rule
 */
export async function getRecurrenceDescription(
  token: string,
  taskId: string
): Promise<{ description: string }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/recurrence-description`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to get recurrence description' }));
    throw new Error(error.error || 'Failed to get recurrence description');
  }
  
  return res.json();
}

// ============================================================================
// TIME TRACKING API
// ============================================================================

export interface TaskTimeLog {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;
  stoppedAt?: string | null;
  duration?: number | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  task?: {
    id: string;
    title: string;
  };
}

export interface TimeLogsResponse {
  timeLogs: TaskTimeLog[];
  totalTime: number;
  task: {
    timeEstimate?: number | null;
    actualTimeSpent?: number | null;
  };
}

/**
 * Start a timer for a task
 */
export async function startTimer(
  taskId: string,
  token: string
): Promise<{ timeLog: TaskTimeLog }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/timer/start`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to start timer' }));
    throw new Error(error.error || 'Failed to start timer');
  }
  
  return res.json();
}

/**
 * Stop the active timer for a task
 */
export async function stopTimer(
  taskId: string,
  token: string,
  description?: string
): Promise<{ timeLog: TaskTimeLog; totalTimeSpent: number }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/timer/stop`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ description }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to stop timer' }));
    throw new Error(error.error || 'Failed to stop timer');
  }
  
  return res.json();
}

/**
 * Get active timer for current user
 */
export async function getActiveTimer(
  token: string
): Promise<{ timeLog: TaskTimeLog | null }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/timer/active`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to get active timer' }));
    throw new Error(error.error || 'Failed to get active timer');
  }
  
  return res.json();
}

/**
 * Log manual time entry
 */
export async function logTime(
  taskId: string,
  data: {
    startedAt: string;
    duration: number; // minutes
    description?: string;
  },
  token: string
): Promise<{ timeLog: TaskTimeLog; totalTimeSpent: number }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/time-logs`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to log time' }));
    throw new Error(error.error || 'Failed to log time');
  }
  
  return res.json();
}

/**
 * Get time logs for a task
 */
export async function getTimeLogs(
  taskId: string,
  token: string
): Promise<TimeLogsResponse> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/time-logs`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to get time logs' }));
    throw new Error(error.error || 'Failed to get time logs');
  }
  
  return res.json();
}

/**
 * Update a time log
 */
export async function updateTimeLog(
  taskId: string,
  logId: string,
  data: {
    startedAt?: string;
    duration?: number;
    description?: string;
  },
  token: string
): Promise<{ timeLog: TaskTimeLog; totalTimeSpent: number }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/time-logs/${logId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to update time log' }));
    throw new Error(error.error || 'Failed to update time log');
  }
  
  return res.json();
}

/**
 * Delete a time log
 */
export async function deleteTimeLog(
  taskId: string,
  logId: string,
  token: string
): Promise<{ success: boolean; totalTimeSpent: number }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/time-logs/${logId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to delete time log' }));
    throw new Error(error.error || 'Failed to delete time log');
  }
  
  return res.json();
}

// ============================================================================
// AI PRIORITIZATION API FUNCTIONS
// ============================================================================

export interface PrioritySuggestion {
  taskId: string;
  taskTitle: string;
  currentPriority: TaskPriority;
  suggestedPriority: TaskPriority;
  confidence: number; // 0-1
  reasoning: string;
  factors: Array<{
    type: 'due_date' | 'dependency' | 'time_pressure' | 'project' | 'category' | 'historical';
    impact: number;
    description: string;
  }>;
}

export interface PriorityAnalysis {
  suggestions: PrioritySuggestion[];
  summary: {
    totalTasks: number;
    needsPrioritization: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
}

/**
 * Get priority suggestions for current tasks
 */
export async function getPrioritySuggestions(
  dashboardId: string,
  businessId: string | undefined,
  token: string
): Promise<PrioritySuggestion[]> {
  if (!token) throw new Error('Authentication required');
  
  const queryParams = new URLSearchParams();
  queryParams.append('dashboardId', dashboardId);
  if (businessId) queryParams.append('businessId', businessId);
  
  const res = await fetch(`/api/todo/ai/prioritize/suggestions?${queryParams.toString()}`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to get priority suggestions' }));
    throw new Error(error.error || 'Failed to get priority suggestions');
  }
  
  const data = await res.json();
  return data.suggestions || [];
}

/**
 * Analyze tasks for prioritization
 */
export async function analyzeTaskPriorities(
  dashboardId: string,
  businessId: string | undefined,
  taskIds: string[] | undefined,
  token: string
): Promise<PriorityAnalysis> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch('/api/todo/ai/prioritize/analyze', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      dashboardId,
      businessId,
      taskIds: taskIds || [],
    }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to analyze task priorities' }));
    throw new Error(error.error || 'Failed to analyze task priorities');
  }
  
  const data = await res.json();
  return data.analysis;
}

/**
 * Execute priority changes
 */
export async function executePriorityChanges(
  suggestions: Array<{ taskId: string; newPriority: TaskPriority }>,
  token: string
): Promise<{ success: boolean; updated: number; failed: number; total: number; requiresApproval?: boolean }> {
  if (!token) throw new Error('Authentication required');
  
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error('suggestions array is required');
  }
  
  const res = await fetch('/api/todo/ai/prioritize/execute', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ suggestions }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to execute priority changes' }));
    throw new Error(error.error || 'Failed to execute priority changes');
  }
  
  return res.json();
}

/**
 * Submit feedback on priority suggestions
 */
export async function submitPriorityFeedback(
  suggestionId: string,
  accepted: boolean,
  actualPriority: TaskPriority | undefined,
  taskId: string,
  category: string | null | undefined,
  token: string
): Promise<{ success: boolean; message: string }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch('/api/todo/ai/prioritize/feedback', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      suggestionId,
      accepted,
      actualPriority,
      taskId,
      category,
    }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to submit feedback' }));
    throw new Error(error.error || 'Failed to submit feedback');
  }
  
  return res.json();
}

// ============================================================================
// AI SMART SCHEDULING API FUNCTIONS
// ============================================================================

export interface SchedulingSuggestion {
  taskId: string;
  taskTitle: string;
  currentDueDate: string | null;
  suggestedDueDate: string;
  suggestedStartDate?: string;
  confidence: number; // 0-1
  reasoning: string;
  factors: Array<{
    type: 'availability' | 'dependency' | 'priority' | 'time_estimate' | 'workload';
    impact: number;
    description: string;
  }>;
  conflicts?: Array<{
    eventId: string;
    eventTitle: string;
    startAt: string;
    endAt: string;
  }>;
}

export interface SchedulingAnalysis {
  suggestions: SchedulingSuggestion[];
  summary: {
    totalTasks: number;
    needsScheduling: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    conflicts: number;
  };
}

/**
 * Get scheduling suggestions for current tasks
 */
export async function getSchedulingSuggestions(
  dashboardId: string,
  businessId: string | undefined,
  token: string
): Promise<SchedulingSuggestion[]> {
  if (!token) throw new Error('Authentication required');
  
  const queryParams = new URLSearchParams();
  queryParams.append('dashboardId', dashboardId);
  if (businessId) queryParams.append('businessId', businessId);
  
  const res = await fetch(`/api/todo/ai/schedule/suggestions?${queryParams.toString()}`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to get scheduling suggestions' }));
    throw new Error(error.error || 'Failed to get scheduling suggestions');
  }
  
  const data = await res.json();
  return data.suggestions || [];
}

/**
 * Analyze tasks for scheduling
 */
export async function analyzeTaskScheduling(
  dashboardId: string,
  businessId: string | undefined,
  taskIds: string[] | undefined,
  token: string
): Promise<SchedulingAnalysis> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch('/api/todo/ai/schedule/analyze', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      dashboardId,
      businessId,
      taskIds: taskIds || [],
    }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to analyze task scheduling' }));
    throw new Error(error.error || 'Failed to analyze task scheduling');
  }
  
  const data = await res.json();
  return data.analysis;
}

/**
 * Execute scheduling changes
 */
export async function executeSchedulingChanges(
  suggestions: Array<{ taskId: string; suggestedDueDate: string; suggestedStartDate?: string }>,
  token: string
): Promise<{ success: boolean; updated: number; failed: number; total: number }> {
  if (!token) throw new Error('Authentication required');
  
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error('suggestions array is required');
  }
  
  const res = await fetch('/api/todo/ai/schedule/execute', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ suggestions }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to execute scheduling changes' }));
    throw new Error(error.error || 'Failed to execute scheduling changes');
  }
  
  return res.json();
}

// ============================================================================
// CHAT INTEGRATION API FUNCTIONS
// ============================================================================

export interface CreateTaskFromMessageInput {
  messageId: string;
  conversationId: string;
  dashboardId: string;
  businessId?: string;
  householdId?: string;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  assignedToId?: string;
}

export interface ParsedTaskDetails {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
}

/**
 * Create a task from a chat message
 */
export async function createTaskFromMessage(
  data: CreateTaskFromMessageInput,
  token: string
): Promise<{ success: boolean; task: Task; messageLink: { messageId: string; conversationId: string; taskId: string } }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch('/api/todo/chat/create-task', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create task from message' }));
    throw new Error(error.error || 'Failed to create task from message');
  }
  
  return res.json();
}

/**
 * Parse a chat message to extract task details
 */
export async function parseMessageForTask(
  content: string,
  token: string
): Promise<{ success: boolean; parsed: ParsedTaskDetails }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch('/api/todo/chat/parse-message', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to parse message' }));
    throw new Error(error.error || 'Failed to parse message');
  }
  
  return res.json();
}

/**
 * Get tasks linked to a conversation
 */
export async function getTasksForConversation(
  conversationId: string,
  token: string
): Promise<{ success: boolean; tasks: Task[] }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/chat/conversation/${conversationId}/tasks`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to get tasks for conversation' }));
    throw new Error(error.error || 'Failed to get tasks for conversation');
  }
  
  return res.json();
}

// ============================================================================
// DRIVE INTEGRATION API FUNCTIONS
// ============================================================================

/**
 * Link a Drive file to a task
 */
export async function linkTaskToFile(
  taskId: string,
  fileId: string,
  token: string
): Promise<{ success: boolean; link: { id: string; taskId: string; fileId: string } }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/link-file`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fileId }),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to link file to task' }));
    throw new Error(error.error || 'Failed to link file to task');
  }
  
  return res.json();
}

/**
 * Unlink a Drive file from a task
 */
export async function unlinkTaskFromFile(
  taskId: string,
  fileId: string,
  token: string
): Promise<{ success: boolean }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/unlink-file/${fileId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to unlink file from task' }));
    throw new Error(error.error || 'Failed to unlink file from task');
  }
  
  return res.json();
}

/**
 * Get all Drive files linked to a task
 */
export async function getTaskLinkedFiles(
  taskId: string,
  token: string
): Promise<{ success: boolean; files: Array<{ id: string; fileId: string; taskId: string }>; fileIds: string[] }> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/tasks/${taskId}/linked-files`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to get linked files' }));
    throw new Error(error.error || 'Failed to get linked files');
  }
  
  return res.json();
}

