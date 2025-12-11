// Define types locally to avoid import issues
export type File = {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  url: string;
  starred: boolean;
  folderId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Folder = {
  id: string;
  name: string;
  starred: boolean;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Activity = {
  id: string;
  type: 'create' | 'edit' | 'delete' | 'share' | 'download';
  user: {
    id: string;
    name: string;
    email: string;
  };
  file: File;
  timestamp: string;
  details?: {
    sharedWith?: string;
    permission?: 'view' | 'edit';
    action?: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    originalName?: string;
    newName?: string;
    originalFolderId?: string;
    newFolderId?: string;
  };
};

// Drive API utility

// Helper to add Authorization header
function authHeaders(token: string, headers: Record<string, string> = {}) {
  return { ...headers, Authorization: `Bearer ${token}` };
}

export async function listFiles(token: string, folderId?: string, starred?: boolean) {
  const params = new URLSearchParams();
  if (folderId) params.append('folderId', folderId);
  if (starred !== undefined) params.append('starred', starred.toString());
  
  const url = `/api/drive/files${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch files');
  const data = await res.json();
  // API returns array directly, not wrapped in object
  return Array.isArray(data) ? data : (data.files || []);
}

export async function listFolders(token: string, parentId?: string, starred?: boolean) {
  const params = new URLSearchParams();
  if (parentId) params.append('parentId', parentId);
  if (starred !== undefined) params.append('starred', starred.toString());
  
  const url = `/api/drive/folders${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch folders');
  const data = await res.json();
  // API returns array directly, not wrapped in object
  return Array.isArray(data) ? data : (data.folders || []);
}

export async function uploadFile(
  token: string,
  file: globalThis.File,
  folderId?: string,
  isChatFile?: boolean,
  dashboardId?: string
): Promise<File> {
  const formData = new FormData();
  formData.append('file', file);
  if (folderId) formData.append('folderId', folderId);
  if (isChatFile) formData.append('chat', 'true');
  if (dashboardId) formData.append('dashboardId', dashboardId);
  
  console.log('📤 Uploading file:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    folderId,
    isChatFile,
    dashboardId,
    hasToken: !!token
  });
  
  const res = await fetch('/api/drive/files', {
    method: 'POST',
    body: formData,
    headers: authHeaders(token),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Upload failed:', {
      status: res.status,
      statusText: res.statusText,
      error: errorText
    });
    throw new Error(`Failed to upload file: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  console.log('✅ Upload successful:', data);
  return data.file;
}

export async function renameFile(token: string, id: string, name: string) {
  const res = await fetch(`/api/drive/files/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  if (!res.ok) throw new Error('Failed to rename file');
  const data = await res.json();
  return data.file;
}

export async function deleteFile(token: string, id: string) {
  const res = await fetch(`/api/drive/files/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete file');
  return true;
}

export async function createFolder(token: string, name: string, parentId?: string) {
  const res = await fetch('/api/drive/folders', {
    method: 'POST',
    body: JSON.stringify({ name, parentId }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  if (!res.ok) throw new Error('Failed to create folder');
  const data = await res.json();
  return data.folder;
}

export const downloadFile = async (token: string, fileId: string): Promise<void> => {
  try {
    // Try /download route first, fallback to direct route if needed
    let response = await fetch(`/api/drive/files/${fileId}/download`, {
      method: 'GET',
      headers: authHeaders(token),
    });

    // If /download route returns 404, try the direct route (for backward compatibility)
    if (!response.ok && response.status === 404) {
      console.log('📥 Download route returned 404, trying direct route...');
      response = await fetch(`/api/drive/files/${fileId}`, {
        method: 'GET',
        headers: authHeaders(token),
      });
    }

    if (!response.ok) {
      // Get error message from response if available
      let errorMessage = `Failed to download file (${response.status})`;
      try {
        const errorText = await response.clone().text();
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch {
            errorMessage = errorText.substring(0, 100) || errorMessage;
          }
        }
      } catch {
        // Ignore errors reading response
      }
      console.error('❌ Download failed:', {
        status: response.status,
        statusText: response.statusText,
        fileId,
        errorMessage
      });
      throw new Error(errorMessage);
    }

    // For GCS, the response might be a redirect, so we need to handle that
    // For local files, we get the blob directly
    if (response.redirected) {
      // If redirected (GCS), open in new window
      window.open(response.url, '_blank');
      return;
    }

    // Get the filename from the Content-Disposition header or use fileId
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Create a blob from the response
    const blob = await response.blob();
    
    // Create a temporary URL for the blob
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};

// Share file by email (finds user by email and grants permission, or returns share link)
export const shareItemByEmail = async (token: string, fileId: string, email: string, permission: 'view' | 'edit'): Promise<{ success: boolean; shareLink?: string; message: string }> => {
  // First, try to find the user by email
  try {
    const userSearchResponse = await fetch(`/api/member/users/search?query=${encodeURIComponent(email)}&limit=1`, {
      headers: authHeaders(token),
    });
    
    if (userSearchResponse.ok) {
      const userSearchData = await userSearchResponse.json();
      const users = userSearchData.users || userSearchData.data || [];
      
      if (users.length > 0) {
        // User exists - grant permission directly
        const userId = users[0].id;
        const canRead = true;
        const canWrite = permission === 'edit';
        await grantFilePermission(token, fileId, userId, canRead, canWrite);
        return { success: true, message: `File shared with ${email}` };
      }
    }
    // If response is not ok (404, etc.) or no users found, continue to generate share link
  } catch (error) {
    // Search failed, continue to handle as non-user
    console.error('User search failed:', error);
  }
  
  // User doesn't exist - generate and return share link
  const shareLink = `${window.location.origin}/drive/shared?file=${fileId}`;
  return {
    success: true,
    shareLink,
    message: `User with email ${email} is not registered. Share link generated - you can send this link to them.`
  };
};

export const getShareLink = async (token: string, itemId: string): Promise<string> => {
  const response = await fetch(`/api/drive/items/${itemId}/share-link`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });

  if (!response.ok) {
    throw new Error('Failed to get share link');
  }

  const data = await response.json();
  return data.link;
};

export const getItemActivity = async (token: string, itemId: string): Promise<Activity[]> => {
  const response = await fetch(`/api/drive/items/${itemId}/activity`, {
    method: 'GET',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch activity');
  }

  const data = await response.json();
  return data.activities;
};

export async function getRecentActivity(token: string): Promise<Activity[]> {
  const response = await fetch('/api/drive/folders/activity/recent', {
    method: 'GET',
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch recent activity');
  }

  const data = await response.json();
  return data.activities;
}

export async function toggleFileStarred(token: string, fileId: string): Promise<File> {
  const response = await fetch(`/api/drive/files/${fileId}/star`, {
    method: 'PUT',
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Failed to toggle star on file');
  }
  return response.json();
}

export async function toggleFolderStarred(token: string, folderId: string): Promise<Folder> {
  const response = await fetch(`/api/drive/folders/${folderId}/star`, {
    method: 'PUT',
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Failed to toggle star on folder');
  }
  return response.json();
}

// List trashed files
export async function listTrashedFiles(token: string) {
  const res = await fetch('/api/drive/files/trashed', { headers: authHeaders(token) });
  
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('You do not have permission to access trashed files');
    }
    if (res.status === 401) {
      throw new Error('Please log in to access trashed files');
    }
    throw new Error('Failed to fetch trashed files');
  }
  
  const data = await res.json();
  return data.files;
}

// Restore a trashed file
export async function restoreFile(token: string, id: string) {
  const res = await fetch(`/api/drive/files/${id}/restore`, { 
    method: 'POST', 
    headers: authHeaders(token) 
  });
  
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('You do not have permission to restore this file');
    }
    throw new Error('Failed to restore file');
  }
  
  return true;
}

// Permanently delete a trashed file
export async function hardDeleteFile(token: string, id: string) {
  const res = await fetch(`/api/drive/files/${id}/hard-delete`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('You do not have permission to permanently delete this file');
    }
    throw new Error('Failed to permanently delete file');
  }

  return true;
}

// List trashed folders
export async function listTrashedFolders(token: string) {
  const res = await fetch('/api/drive/folders/trashed', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch trashed folders');
  const data = await res.json();
  return data.folders;
}

// Restore a trashed folder
export async function restoreFolder(token: string, id: string) {
  const res = await fetch(`/api/drive/folders/${id}/restore`, { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to restore folder');
  return true;
}

// Permanently delete a trashed folder
export async function hardDeleteFolder(token: string, id: string) {
  const res = await fetch(`/api/drive/folders/${id}/hard`, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to permanently delete folder');
  return true;
}

export async function moveFile(token: string, fileId: string, targetFolderId: string): Promise<void> {
  const response = await fetch(`/api/drive/files/${fileId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetFolderId }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });

  if (!response.ok) {
    throw new Error('Failed to move file');
  }

  const data = await response.json();
  return data;
}

export async function moveFolder(token: string, folderId: string, targetParentId: string): Promise<void> {
  const response = await fetch(`/api/drive/folders/${folderId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetParentId }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });

  if (!response.ok) {
    throw new Error('Failed to move folder');
  }

  const data = await response.json();
  return data;
}

// List all permissions for a file
export async function listFilePermissions(token: string, fileId: string) {
  const res = await fetch(`/api/drive/files/${fileId}/permissions`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to list file permissions');
  const data = await res.json();
  return data.permissions;
}

// Grant permission to a user for a file
export async function grantFilePermission(token: string, fileId: string, userId: string, canRead: boolean, canWrite: boolean) {
  const res = await fetch(`/api/drive/files/${fileId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ userId, canRead, canWrite }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  if (!res.ok) throw new Error('Failed to grant file permission');
  return await res.json();
}

// Update a user's permission for a file
export async function updateFilePermission(token: string, fileId: string, userId: string, canRead: boolean, canWrite: boolean) {
  const res = await fetch(`/api/drive/files/${fileId}/permissions/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ canRead, canWrite }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  if (!res.ok) throw new Error('Failed to update file permission');
  return await res.json();
}

// Revoke a user's permission for a file
export async function revokeFilePermission(token: string, fileId: string, userId: string) {
  const res = await fetch(`/api/drive/files/${fileId}/permissions/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to revoke file permission');
  return await res.json();
}

// List all permissions for a folder
export async function listFolderPermissions(token: string, folderId: string) {
  const res = await fetch(`/api/drive/folders/${folderId}/permissions`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to list folder permissions');
  const data = await res.json();
  return data.permissions;
}

// Grant permission to a user for a folder
export async function grantFolderPermission(token: string, folderId: string, userId: string, canRead: boolean, canWrite: boolean) {
  const res = await fetch(`/api/drive/folders/${folderId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ userId, canRead, canWrite }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  if (!res.ok) throw new Error('Failed to grant folder permission');
  return await res.json();
}

// Update a user's permission for a folder
export async function updateFolderPermission(token: string, folderId: string, userId: string, canRead: boolean, canWrite: boolean) {
  const res = await fetch(`/api/drive/folders/${folderId}/permissions/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ canRead, canWrite }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  if (!res.ok) throw new Error('Failed to update folder permission');
  return await res.json();
}

// Revoke a user's permission for a folder
export async function revokeFolderPermission(token: string, folderId: string, userId: string) {
  const res = await fetch(`/api/drive/folders/${folderId}/permissions/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to revoke folder permission');
  return await res.json();
}

// Share folder by email (finds user by email and grants permission, or returns share link)
export const shareFolderByEmail = async (token: string, folderId: string, email: string, permission: 'view' | 'edit'): Promise<{ success: boolean; shareLink?: string; message: string }> => {
  // First, try to find the user by email
  try {
    const userSearchResponse = await fetch(`/api/member/users/search?query=${encodeURIComponent(email)}&limit=1`, {
      headers: authHeaders(token),
    });
    
    if (userSearchResponse.ok) {
      const userSearchData = await userSearchResponse.json();
      const users = userSearchData.users || userSearchData.data || [];
      
      if (users.length > 0) {
        // User exists - grant permission directly
        const userId = users[0].id;
        const canRead = true;
        const canWrite = permission === 'edit';
        await grantFolderPermission(token, folderId, userId, canRead, canWrite);
        return { success: true, message: `Folder shared with ${email}` };
      }
    }
    // If response is not ok (404, etc.) or no users found, continue to generate share link
  } catch (error) {
    // Search failed, continue to handle as non-user
    console.error('User search failed:', error);
  }
  
  // User doesn't exist - generate and return share link
  const shareLink = `${window.location.origin}/drive/shared?folder=${folderId}`;
  return {
    success: true,
    shareLink,
    message: `User with email ${email} is not registered. Share link generated - you can send this link to them.`
  };
};

export async function deleteFolder(token: string, id: string) {
  const res = await fetch(`/api/drive/folders/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete folder');
  return true;
}

export async function renameFolder(token: string, id: string, name: string) {
  const res = await fetch(`/api/drive/folders/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  if (!res.ok) throw new Error('Failed to rename folder');
  const data = await res.json();
  return data.folder;
}

export async function getSharedItems(token: string): Promise<{ files: File[], folders: Folder[] }> {
  const response = await fetch('/api/drive/shared', {
    method: 'GET',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch shared items');
  }

  const data = await response.json();
  return data;
}

export async function reorderFiles(token: string, folderId: string, fileIds: string[]): Promise<void> {
  const response = await fetch(`/api/drive/files/reorder/${folderId}`, {
    method: 'POST',
    body: JSON.stringify({ fileIds }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });

  if (!response.ok) {
    throw new Error('Failed to reorder files');
  }

  const data = await response.json();
  return data;
}

export async function reorderFolders(token: string, parentId: string, folderIds: string[]): Promise<void> {
  const response = await fetch(`/api/drive/folders/reorder/${parentId}`, {
    method: 'POST',
    body: JSON.stringify({ folderIds }),
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });

  if (!response.ok) {
    throw new Error('Failed to reorder folders');
  }

  const data = await response.json();
  return data;
}

// Search users for sharing
export async function searchUsers(token: string, query: string): Promise<Array<{
  id: string;
  name: string | null;
  email: string;
  connectionStatus: 'none' | 'pending' | 'accepted' | 'declined' | 'blocked';
  relationshipId: string | null;
  organization?: {
    id: string;
    name: string;
    type: 'business' | 'institution';
    role: string;
  } | null;
}>> {
  const response = await fetch(`/api/members/search?query=${encodeURIComponent(query)}&limit=20`, {
    headers: authHeaders(token),
  });
  
  if (!response.ok) {
    throw new Error('Failed to search users');
  }
  
  const data = await response.json();
  return data.users || data.data || [];
}

// Get business members for sharing
export async function getBusinessMembers(token: string, businessId: string): Promise<Array<{
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  title: string | null;
  department: string | null;
  isActive: boolean;
}>> {
  const response = await fetch(`/api/business/${businessId}/members`, {
    headers: authHeaders(token),
  });
  
  if (!response.ok) {
    throw new Error('Failed to get business members');
  }
  
  const data = await response.json();
  return data.members || data.data || [];
}