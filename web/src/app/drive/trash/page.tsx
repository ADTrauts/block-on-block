"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/contexts/DashboardContext';
import { listTrashedFiles, restoreFile, hardDeleteFile, listTrashedFolders, restoreFolder, hardDeleteFolder } from "../../../api/drive";
import { TrashIcon, ArrowUturnLeftIcon, ArchiveBoxXMarkIcon } from '@heroicons/react/24/outline';
import { Squares2X2Icon, Bars3Icon } from '@heroicons/react/24/solid';
import { LoadingOverlay } from 'shared/components/LoadingOverlay';
import { Alert } from 'shared/components/Alert';
import DriveSidebar from '../DriveSidebar';

type ViewMode = 'list' | 'grid';

export default function TrashPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { currentDashboard, navigateToDashboard } = useDashboard();
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Initialize from localStorage, default to 'list' if not set
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trash-view-mode');
      return (saved === 'grid' || saved === 'list') ? saved : 'list';
    }
    return 'list';
  });

  // Save view mode to localStorage whenever it changes
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trash-view-mode', mode);
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

  const fetchTrash = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [f, d] = await Promise.all([
        listTrashedFiles(session.accessToken),
        listTrashedFolders(session.accessToken),
      ]);
      setFiles(f);
      setFolders(d);
    } catch (err) {
      setError("Failed to load trash");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTrash();
    }
  }, [status, session?.accessToken, fetchTrash]);

  const handleRestore = async (item: any, type: 'file' | 'folder') => {
    if (!session?.accessToken) return;
    setActionLoading(item.id);
    try {
      if (type === 'file') await restoreFile(session.accessToken, item.id);
      else await restoreFolder(session.accessToken, item.id);
      fetchTrash();
    } catch {
      setError('Failed to restore');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (item: any, type: 'file' | 'folder') => {
    if (!session?.accessToken) return;
    setActionLoading(item.id);
    try {
      if (type === 'file') await hardDeleteFile(session.accessToken, item.id);
      else await hardDeleteFolder(session.accessToken, item.id);
      fetchTrash();
    } catch {
      setError('Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const isEmpty = files.length === 0 && folders.length === 0;

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
      <main className="flex-1 overflow-auto">
        {loading || status === 'loading' ? (
          <div className="flex items-center justify-center h-full">
            <LoadingOverlay message="Loading trash..." />
          </div>
        ) : status === 'unauthenticated' ? (
          <div className="p-6">
            <Alert type="error" title="Authentication Error">
              Please log in to view trash.
            </Alert>
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert type="error" title="Error">{error}</Alert>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-8 flex items-center gap-4">
              <TrashIcon className="w-8 h-8 text-gray-700" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Trash</h1>
                <p className="text-gray-600">Items in trash will be permanently deleted after 30 days.</p>
              </div>
            </div>

            {isEmpty ? (
              <div className="text-center py-16">
                <TrashIcon className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">Trash is empty</h3>
                <p className="text-gray-500">Items you move to the trash will appear here.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* View Toggle */}
          <div className="p-4 border-b border-gray-200 flex justify-end">
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
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-4 text-sm font-semibold text-gray-600">Name</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Type</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Trashed At</th>
                  <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...folders, ...files].map((item) => (
                  <tr key={item.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">{item.name}</td>
                    <td className="p-4 text-gray-600 capitalize">{item.size !== undefined ? 'File' : 'Folder'}</td>
                    <td className="p-4 text-gray-600">{item.trashedAt ? new Date(item.trashedAt).toLocaleString() : ''}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleRestore(item, item.size !== undefined ? 'file' : 'folder')} 
                        disabled={actionLoading === item.id} 
                        className="font-medium text-green-600 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        <ArrowUturnLeftIcon className="w-4 h-4" />
                        Restore
                      </button>
                      <button 
                        onClick={() => handleDelete(item, item.size !== undefined ? 'file' : 'folder')} 
                        disabled={actionLoading === item.id} 
                        className="ml-4 font-medium text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        <ArchiveBoxXMarkIcon className="w-4 h-4" />
                        Delete Forever
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {[...folders, ...files].map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                          {item.size !== undefined ? (
                            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                            </svg>
                          )}
                        </div>
                        <span className="font-medium text-sm text-gray-900 truncate">{item.name}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-3">
                      {item.trashedAt ? new Date(item.trashedAt).toLocaleDateString() : ''}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRestore(item, item.size !== undefined ? 'file' : 'folder')} 
                        disabled={actionLoading === item.id} 
                        className="flex-1 text-xs font-medium text-green-600 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1 py-1 px-2 border border-green-200 rounded hover:bg-green-50"
                      >
                        <ArrowUturnLeftIcon className="w-3 h-3" />
                        Restore
                      </button>
                      <button 
                        onClick={() => handleDelete(item, item.size !== undefined ? 'file' : 'folder')} 
                        disabled={actionLoading === item.id} 
                        className="flex-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1 py-1 px-2 border border-red-200 rounded hover:bg-red-50"
                      >
                        <ArchiveBoxXMarkIcon className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
} 