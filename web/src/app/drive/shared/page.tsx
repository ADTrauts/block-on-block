'use client';

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDashboard } from '@/contexts/DashboardContext';
import { getSharedItems, File, Folder, downloadFile } from '@/api/drive';
import { LoadingOverlay } from 'shared/components/LoadingOverlay';
import { Alert } from 'shared/components/Alert';
import { Button } from 'shared/components';
import { formatFileSize, formatDate } from 'shared/utils/format';
import { UserGroupIcon, FolderIcon, DocumentIcon, ArrowDownTrayIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Squares2X2Icon, Bars3Icon } from '@heroicons/react/24/solid';
import DriveSidebar from '../DriveSidebar';

type ViewMode = 'list' | 'grid';

type SharedItem = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  owner?: {
    id: string;
    name: string;
  };
  url?: string;
  isShared?: boolean;
  sharedWith?: number;
  isStarred?: boolean;
  permission?: 'view' | 'edit';
};

const SharedPageContent = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentDashboard, navigateToDashboard } = useDashboard();
  const [sharedFiles, setSharedFiles] = useState<SharedItem[]>([]);
  const [sharedFolders, setSharedFolders] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [specificItem, setSpecificItem] = useState<SharedItem | null>(null);
  
  // Get file or folder ID from query params
  const fileId = searchParams?.get('file');
  const folderId = searchParams?.get('folder');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Initialize from localStorage, default to 'grid' if not set
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shared-view-mode');
      return (saved === 'grid' || saved === 'list') ? saved : 'grid';
    }
    return 'grid';
  });

  // Save view mode to localStorage whenever it changes
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('shared-view-mode', mode);
    }
  };

  // Sidebar handlers
  const handleCreateFolder = useCallback(async () => {
    if (!session?.accessToken) return;
    const name = prompt('Enter folder name:');
    if (!name) return;
    try {
      const response = await fetch('/api/drive/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ 
          name,
          dashboardId: currentDashboard?.id || null,
          parentId: null
        }),
      });
      if (!response.ok) console.error('Failed to create folder');
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  }, [session, currentDashboard]);

  const handleFileUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (!files || !session?.accessToken) return;
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const formData = new FormData();
          formData.append('file', file);
          if (currentDashboard?.id) formData.append('dashboardId', currentDashboard.id);
          const response = await fetch('/api/drive/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.accessToken}` },
            body: formData,
          });
          if (!response.ok) console.error('Upload failed:', response.status);
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    };
    input.click();
  }, [session, currentDashboard]);

  const handleContextSwitch = useCallback(async (dashboardId: string) => {
    await navigateToDashboard(dashboardId);
    router.push(`/drive?dashboard=${dashboardId}`);
  }, [navigateToDashboard, router]);

  const handleFolderSelect = useCallback((folderId: string | null) => {
    const folder = folderId ? { id: folderId, name: '' } : null;
    setSelectedFolder(folder);
    if (folderId) {
      const dashboardId = currentDashboard?.id;
      const basePath = '/drive';
      const query = dashboardId ? `?dashboard=${dashboardId}&folder=${folderId}` : `?folder=${folderId}`;
      router.push(`${basePath}${query}`);
    }
  }, [currentDashboard, router]);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      const fetchSharedItems = async () => {
        try {
          setLoading(true);
          setError(null);
          
          // If a specific file or folder ID is in the URL, fetch that item
          if (fileId || folderId) {
            const { files, folders } = await getSharedItems(session.accessToken as string);
            
            // Find the specific item
            const allFiles = files.map((file: File & { permission?: string }) => ({
              id: file.id,
              name: file.name,
              type: 'file' as const,
              size: file.size,
              createdAt: file.createdAt,
              updatedAt: file.updatedAt,
              url: file.url,
              isStarred: file.starred,
              isShared: true,
              permission: (file.permission as 'view' | 'edit') || 'view'
            }));
            
            const allFolders = folders.map((folder: Folder & { permission?: string }) => ({
              id: folder.id,
              name: folder.name,
              type: 'folder' as const,
              createdAt: folder.createdAt,
              updatedAt: folder.updatedAt,
              isStarred: folder.starred,
              isShared: true,
              permission: (folder.permission as 'view' | 'edit') || 'view'
            }));
            
            const item = fileId 
              ? allFiles.find(f => f.id === fileId)
              : allFolders.find(f => f.id === folderId);
            
            if (item) {
              console.log('Found specific item', item);
              setSpecificItem(item);
            } else {
              console.log('Item not found', { fileId, folderId, allFilesCount: allFiles.length, allFoldersCount: allFolders.length });
              setError('The shared item was not found or you do not have access to it.');
            }
            
            setSharedFiles(allFiles);
            setSharedFolders(allFolders);
          } else {
            // Fetch all shared files and folders
            const { files, folders } = await getSharedItems(session.accessToken as string);

            // Convert to SharedItem format
            const fileItems: SharedItem[] = files.map((file: File & { permission?: string }) => ({
              id: file.id,
              name: file.name,
              type: 'file' as const,
              size: file.size,
              createdAt: file.createdAt,
              updatedAt: file.updatedAt,
              url: file.url,
              isStarred: file.starred,
              isShared: true,
              permission: (file.permission as 'view' | 'edit') || 'view'
            }));

            const folderItems: SharedItem[] = folders.map((folder: Folder & { permission?: string }) => ({
              id: folder.id,
              name: folder.name,
              type: 'folder' as const,
              createdAt: folder.createdAt,
              updatedAt: folder.updatedAt,
              isStarred: folder.starred,
              isShared: true,
              permission: (folder.permission as 'view' | 'edit') || 'view'
            }));

            setSharedFiles(fileItems);
            setSharedFolders(folderItems);
          }
        } catch (err) {
          console.error('Error fetching shared items:', err);
          setError('Failed to load shared items. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      fetchSharedItems();
    } else if (status === 'unauthenticated') {
      setError('You must be logged in to view shared items.');
      setLoading(false);
    }
  }, [session, status, fileId, folderId]);
  
  const handleDownload = async (item: SharedItem) => {
    if (!session?.accessToken || item.type !== 'file') return;
    try {
      await downloadFile(session.accessToken, item.id);
    } catch (error) {
      console.error('Download failed:', error);
      setError('Failed to download file');
    }
  };
  
  const handleBack = () => {
    router.push('/drive/shared');
  };

  const allSharedItems = [...sharedFiles, ...sharedFolders];

  // Debug logging
  console.log('SharedPageContent render', {
    status,
    loading,
    error,
    hasSession: !!session,
    fileId,
    folderId,
    specificItem: !!specificItem,
    sharedFilesCount: sharedFiles.length,
    sharedFoldersCount: sharedFolders.length
  });

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Drive Sidebar */}
      <DriveSidebar 
        onNewFolder={handleCreateFolder} 
        onFileUpload={handleFileUpload} 
        onFolderUpload={handleFileUpload}
        onContextSwitch={handleContextSwitch}
        onFolderSelect={handleFolderSelect}
        selectedFolderId={selectedFolder?.id}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {status === 'loading' || loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingOverlay message="Loading shared items..." />
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert type="error" title="Error">{error}</Alert>
            {(fileId || folderId) && (
              <div className="mt-4">
                <Button onClick={handleBack} variant="secondary" size="md">
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back to all shared items
                </Button>
              </div>
            )}
          </div>
        ) : specificItem ? (
          // Show specific shared item
          <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
              <Button
                onClick={handleBack}
                variant="ghost"
                size="sm"
                className="mb-4"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to all shared items
              </Button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{specificItem.name}</h1>
              <p className="text-gray-600">
                {specificItem.type === 'file' ? 'Shared file' : 'Shared folder'}
                {specificItem.permission && (
                  <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                    specificItem.permission === 'edit' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {specificItem.permission} access
                  </span>
                )}
              </p>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-4 mb-6">
                {specificItem.type === 'file' ? (
                  <DocumentIcon className="w-16 h-16 text-blue-500 flex-shrink-0" />
                ) : (
                  <FolderIcon className="w-16 h-16 text-yellow-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{specificItem.name}</h2>
                  <div className="space-y-2 text-sm text-gray-600">
                    {specificItem.type === 'file' && specificItem.size && (
                      <p><strong>Size:</strong> {formatFileSize(specificItem.size)}</p>
                    )}
                    {specificItem.createdAt && (
                      <p><strong>Created:</strong> {formatDate(specificItem.createdAt)}</p>
                    )}
                    {specificItem.updatedAt && (
                      <p><strong>Last modified:</strong> {formatDate(specificItem.updatedAt)}</p>
                    )}
                  </div>
                </div>
              </div>
              
              {specificItem.type === 'file' && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleDownload(specificItem)}
                    variant="primary"
                    size="md"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  {specificItem.url && (
                    <Button
                      onClick={() => window.open(specificItem.url, '_blank')}
                      variant="secondary"
                      size="md"
                    >
                      Open in new tab
                    </Button>
                  )}
                </div>
              )}
              
              {specificItem.type === 'folder' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    This is a shared folder. Navigate to your Drive to view its contents.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Shared with me</h1>
              <p className="text-gray-600">Files and folders that others have shared with you</p>
            </div>

            {allSharedItems.length === 0 ? (
              <div className="text-center py-12">
                <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No shared items</h3>
                <p className="text-gray-600 mb-6">
                  When others share files or folders with you, they will appear here.
                </p>
              </div>
            ) : (
        <div className="space-y-6">
          {/* View Toggle */}
          <div className="flex justify-end">
            <div className="flex gap-2">
              <button
                onClick={() => handleViewModeChange('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                aria-label="List view"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleViewModeChange('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                aria-label="Grid view"
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          {viewMode === 'list' ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-gray-600">Name</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Type</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Permission</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Size</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Shared</th>
                  </tr>
                </thead>
                <tbody>
                  {allSharedItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-800 flex items-center gap-2">
                        {item.type === 'file' ? (
                          <DocumentIcon className="w-5 h-5 text-blue-500" />
                        ) : (
                          <FolderIcon className="w-5 h-5 text-yellow-500" />
                        )}
                        {item.name}
                      </td>
                      <td className="p-4 text-gray-600 capitalize">{item.type}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.permission === 'edit' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.permission}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600">
                        {item.type === 'file' ? formatFileSize(item.size || 0) : '-'}
                      </td>
                      <td className="p-4 text-gray-600">
                        {formatDate(item.updatedAt || new Date())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Shared Files */}
              {sharedFiles.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <DocumentIcon className="w-5 h-5" />
                    Shared Files ({sharedFiles.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sharedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <DocumentIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            file.permission === 'edit' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {file.permission}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1 truncate">{file.name}</h3>
                        <p className="text-sm text-gray-500 mb-2">{formatFileSize(file.size || 0)}</p>
                        <p className="text-xs text-gray-400">Shared {formatDate(file.updatedAt || new Date())}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shared Folders */}
              {sharedFolders.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FolderIcon className="w-5 h-5" />
                    Shared Folders ({sharedFolders.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sharedFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <FolderIcon className="w-8 h-8 text-yellow-500 flex-shrink-0" />
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            folder.permission === 'edit' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {folder.permission}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1 truncate">{folder.name}</h3>
                        <p className="text-xs text-gray-400">Shared {formatDate(folder.updatedAt || new Date())}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const SharedPage = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <LoadingOverlay message="Loading..." />
      </div>
    }>
      <SharedPageContent />
    </Suspense>
  );
};

export default SharedPage; 