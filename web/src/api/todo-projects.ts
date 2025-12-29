/**
 * Project API functions for To-Do module
 * Separated for better organization
 */

import type { TaskProject } from './todo';

// Helper to add Authorization header
function authHeaders(token: string, headers: Record<string, string> = {}) {
  return { ...headers, Authorization: `Bearer ${token}` };
}

/**
 * Get all projects for a dashboard/business
 */
export async function getProjects(
  token: string,
  dashboardId: string,
  businessId?: string
): Promise<TaskProject[]> {
  if (!token) throw new Error('Authentication required');
  
  const params = new URLSearchParams({ dashboardId });
  if (businessId) params.append('businessId', businessId);
  
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
 * Create a new project
 */
export async function createProject(
  token: string,
  data: {
    name: string;
    description?: string;
    dashboardId: string;
    businessId?: string;
    color?: string;
  }
): Promise<TaskProject> {
  if (!token) throw new Error('Authentication required');
  
  const res = await fetch(`/api/todo/projects`, {
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
 * Update a project
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
 * Delete a project
 */
export async function deleteProject(
  token: string,
  projectId: string
): Promise<void> {
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

