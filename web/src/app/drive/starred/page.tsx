'use client';

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/contexts/DashboardContext';
import { listFiles, listFolders, File, Folder } from '@/api/drive';
import { LoadingOverlay } from 'shared/components/LoadingOverlay';
import { Alert } from 'shared/components/Alert';
import { FileGrid, FileGridItem } from 'shared/components/FileGrid';
import { FolderCard } from 'shared/components/FolderCard';
import { Squares2X2Icon, Bars3Icon } from '@heroicons/react/24/solid';
import { Pin } from 'lucide-react';
import DriveSidebar from '../DriveSidebar';

type ViewMode = 'list' | 'grid';

const PinnedPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { currentDashboard, navigateToDashboard } = useDashboard();
  const [pinnedFiles, setPinnedFiles] = useState<File[]>([]);
  const [pinnedFolders, setPinnedFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Initialize from localStorage, default to 'grid' if not set
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pinned-view-mode');
      return (saved === 'grid' || saved === 'list') ? saved : 'grid';
    }
    return 'grid';
  });

  // Save view mode to localStorage whenever it changes
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pinned-view-mode', mode);
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

  const handleFolderSelect = useCallback((folder: { id: string; name: string } | null) => {
    setSelectedFolder(folder);
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      const fetchPinnedItems = async () => {
        try {
          setLoading(true);
          // Use the starred filtering parameter (backend still uses 'starred' field)
          const [files, folders] = await Promise.all([
            listFiles(session.accessToken as string, undefined, true),
            listFolders(session.accessToken as string, undefined, true)
          ]);
          
          // Ensure arrays are never undefined
          setPinnedFiles(Array.isArray(files) ? files : []);
          setPinnedFolders(Array.isArray(folders) ? folders : []);
        } catch (err) {
          setError('Failed to load pinned items.');
        } finally {
          setLoading(false);
        }
      };
      fetchPinnedItems();
    } else if (status === 'unauthenticated') {
      setError('You must be logged in to view pinned items.');
      setLoading(false);
    }
  }, [session, status]);

  const totalItems = (pinnedFiles?.length || 0) + (pinnedFolders?.length || 0);

  // Convert files and folders to FileGridItem format
  const folderItems: FileGridItem[] = pinnedFolders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    type: 'folder' as const,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  }));

  const fileItems: FileGridItem[] = pinnedFiles.map((file) => ({
    id: file.id,
    name: file.name,
    type: 'file' as const,
    size: file.size,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  }));

  const pinnedItems: FileGridItem[] = [...folderItems, ...fileItems];

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
            <LoadingOverlay message="Loading pinned items..." />
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert type="error" title="Error">{error}</Alert>
          </div>
        ) : (
          <div className="p-6">
          <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pin className="w-8 h-8 text-yellow-500 fill-current" />
            <h1 className="text-3xl font-bold text-gray-900">Pinned Items</h1>
          </div>
          <p className="text-gray-600">Your pinned files and folders</p>
        </div>
        
        {/* View Toggle */}
        {totalItems > 0 && (
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
        )}
      </div>
      
      {totalItems === 0 ? (
        <div className="text-center py-12">
          <Pin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pinned items</h3>
          <p className="text-gray-600">Pin files and folders to see them here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === 'list' ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-gray-600">Name</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Type</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Size</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {pinnedItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-800 flex items-center gap-2">
                        <Pin className="w-4 h-4 text-yellow-500 fill-current" />
                        {item.name}
                      </td>
                      <td className="p-4 text-gray-600 capitalize">{item.type}</td>
                      <td className="p-4 text-gray-600">
                        {item.type === 'file' && 'size' in item ? `${Math.round((item.size || 0) / 1024)} KB` : '-'}
                      </td>
                      <td className="p-4 text-gray-600">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              {pinnedFolders.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Pin className="w-5 h-5 text-yellow-500 fill-current" />
                    Pinned Folders
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {pinnedFolders.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        name={folder.name}
                        isStarred={true}
                        onClick={() => {}}
                        onContextMenu={(e) => {
                          e.preventDefault();
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {pinnedFiles.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Pin className="w-5 h-5 text-yellow-500 fill-current" />
                    Pinned Files
                  </h2>
                  <FileGrid
                    items={pinnedItems.filter(item => item.type === 'file')}
                    viewMode="grid"
                    onItemClick={(item) => {}}
                    onContextMenu={(e, item) => {
                      e.preventDefault();
                    }}
                    selectedIds={[]}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PinnedPage; 