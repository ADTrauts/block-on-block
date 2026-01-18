import {
  GetSidebarConfigResponse,
  SaveSidebarConfigRequest,
  SaveSidebarConfigResponse,
  ResetSidebarConfigRequest,
  ResetSidebarConfigResponse,
  SidebarCustomization,
} from '../types/sidebar';

// Helper to add Authorization header
function authHeaders(token: string, headers: Record<string, string> = {}) {
  return { ...headers, Authorization: `Bearer ${token}` };
}

const API_BASE = '/api/dashboard';

/**
 * Get sidebar customization configuration for a dashboard
 */
export async function getSidebarConfig(
  token: string,
  dashboardId: string
): Promise<SidebarCustomization | null> {
  const res = await fetch(`${API_BASE}/${dashboardId}/sidebar-config`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    if (res.status === 404) {
      // No config exists yet - return null
      return null;
    }
    throw new Error('Failed to fetch sidebar configuration');
  }

  const data: GetSidebarConfigResponse = await res.json();
  return data.config;
}

/**
 * Save sidebar customization configuration for a dashboard
 */
export async function saveSidebarConfig(
  token: string,
  dashboardId: string,
  config: SidebarCustomization
): Promise<void> {
  const res = await fetch(`${API_BASE}/${dashboardId}/sidebar-config`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ config } as SaveSidebarConfigRequest),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Failed to save sidebar configuration' }));
    throw new Error(errorData.message || 'Failed to save sidebar configuration');
  }

  const data: SaveSidebarConfigResponse = await res.json();
  if (!data.success) {
    throw new Error(data.message || 'Failed to save sidebar configuration');
  }
}

/**
 * Update sidebar customization configuration for a dashboard
 * (Alias for saveSidebarConfig - same endpoint, PUT method)
 */
export async function updateSidebarConfig(
  token: string,
  dashboardId: string,
  config: SidebarCustomization
): Promise<void> {
  const res = await fetch(`${API_BASE}/${dashboardId}/sidebar-config`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ config } as SaveSidebarConfigRequest),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Failed to update sidebar configuration' }));
    throw new Error(errorData.message || 'Failed to update sidebar configuration');
  }

  const data: SaveSidebarConfigResponse = await res.json();
  if (!data.success) {
    throw new Error(data.message || 'Failed to update sidebar configuration');
  }
}

/**
 * Reset sidebar customization configuration to defaults
 */
export async function resetSidebarConfig(
  token: string,
  dashboardId: string,
  options?: {
    scope?: 'tab' | 'sidebar' | 'global';
    dashboardTabId?: string;
    context?: string;
  }
): Promise<void> {
  const queryParams = new URLSearchParams();
  if (options?.scope) {
    queryParams.append('scope', options.scope);
  }
  if (options?.dashboardTabId) {
    queryParams.append('dashboardTabId', options.dashboardTabId);
  }
  if (options?.context) {
    queryParams.append('context', options.context);
  }

  const url = `${API_BASE}/${dashboardId}/sidebar-config${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Failed to reset sidebar configuration' }));
    throw new Error(errorData.message || 'Failed to reset sidebar configuration');
  }

  const data: ResetSidebarConfigResponse = await res.json();
  if (!data.success) {
    throw new Error(data.message || 'Failed to reset sidebar configuration');
  }
}

