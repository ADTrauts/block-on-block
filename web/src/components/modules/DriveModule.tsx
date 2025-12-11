'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Avatar, Badge, Spinner } from 'shared/components';
import { 
  Folder, 
  File, 
  Upload, 
  Search, 
  MoreVertical, 
  Grid, 
  List,
  Download,
  Share,
  Trash2,
  Star,
  Eye,
  Pin
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDashboard } from '../../contexts/DashboardContext';
import { ShareModal, ShareLinkModal } from 'shared/components';
import { 
  toggleFileStarred,
  toggleFolderStarred,
  File as DriveFile,
  Folder as DriveFolder,
  downloadFile,
  shareItemByEmail,
  listFilePermissions,
  grantFilePermission,
  updateFilePermission,
  revokeFilePermission,
  listFolderPermissions,
  grantFolderPermission,
  updateFolderPermission,
  revokeFolderPermission,
  shareFolderByEmail,
  searchUsers,
  getBusinessMembers
} from '@/api/drive';

interface DriveItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  modifiedAt: string;
  createdBy: string;
  permissions: string[];
  starred?: boolean;
  shared?: boolean;
  mimeType?: string;
  thumbnail?: string;
}

interface DriveModuleProps {
  className?: string;
  refreshTrigger?: number;
  dashboardId?: string | null;
}

export default function DriveModule({ dashboardId, className = '', refreshTrigger }: DriveModuleProps) {
  const { data: session } = useSession();
  const { currentDashboard, getDashboardType } = useDashboard();
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 10 * 1024 * 1024 * 1024 }); // 10GB default
  const [isDragging, setIsDragging] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: DriveItem } | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveItem | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareItem, setShareItem] = useState<DriveItem | null>(null);
  const [shareLinkModal, setShareLinkModal] = useState<{ email: string; shareLink: string; itemName: string; itemType: 'file' | 'folder' } | null>(null);

  const effectiveDashboardId = dashboardId || currentDashboard?.id || null;

  // Load real data from API - memoized to prevent infinite loops
  const loadFilesAndFolders = useCallback(async () => {
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }
    
    // CRITICAL: ONLY use dashboardId - no fallback to currentDashboard
    // BusinessId is NOT a dashboard ID and will cause data leakage
    if (!effectiveDashboardId) {
      console.error('❌ DriveModule: No dashboardId provided! Cannot load drive content.');
      setError('Dashboard context not initialized. Please refresh the page.');
      setLoading(false);
      return;
    }
    
    const contextId = effectiveDashboardId;
    const parentId = currentFolder;
    
    console.log('📁 DriveModule Context Resolution:', {
      dashboardId,
      resolvedDashboardId: effectiveDashboardId,
      resolvedContextId: contextId,
      currentDashboardId: currentDashboard?.id || '(not used - business routes ignored)'
    });
    
    // Build API URLs with context and folder
    const filesParams = new URLSearchParams();
    if (contextId) filesParams.append('dashboardId', contextId);
    if (parentId) filesParams.append('folderId', parentId);
    
    const foldersParams = new URLSearchParams();
    if (contextId) foldersParams.append('dashboardId', contextId);
    if (parentId) foldersParams.append('parentId', parentId);

    const filesUrl = `/api/drive/files?${filesParams}`;
    const foldersUrl = `/api/drive/folders?${foldersParams}`;

    try {
      setLoading(true);
      setError(null);

      console.log('📁 Drive Debug - API URLs:', { filesUrl, foldersUrl });

      // Fetch files and folders with context and folder filtering
      const [filesResponse, foldersResponse] = await Promise.all([
        fetch(filesUrl, {
          headers: { 'Authorization': `Bearer ${session.accessToken}` }
        }),
        fetch(foldersUrl, {
          headers: { 'Authorization': `Bearer ${session.accessToken}` }
        })
      ]);

      if (!filesResponse.ok || !foldersResponse.ok) {
        throw new Error('Failed to fetch drive content');
      }

      const filesData = await filesResponse.json();
      const foldersData = await foldersResponse.json();
      
      // API returns arrays directly, not wrapped in objects
      const files = Array.isArray(filesData) ? filesData : (filesData.files || []);
      const folders = Array.isArray(foldersData) ? foldersData : (foldersData.folders || []);
      
      console.log('📁 Drive Debug - Raw API Data:', { filesData, foldersData });
      console.log('📁 Drive Debug - Parsed Data:', { files, folders });
      console.log('📁 Drive Debug - Counts:', { fileCount: files.length, folderCount: folders.length });
      
      // Map files to DriveItem format
      const mappedFiles = files.map((file: any) => ({
        id: file.id,
        name: file.name,
        type: 'file' as const,
        size: file.size,
        modifiedAt: file.updatedAt || file.createdAt,
        createdBy: file.createdBy || 'Unknown',
        permissions: ['view', 'edit'], // Default permissions - fetch from /api/drive/files/:id/permissions when viewing file details
        mimeType: file.type,
        starred: false,
        shared: false
      }));

      // Map folders to DriveItem format
      const mappedFolders = folders.map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        type: 'folder' as const,
        modifiedAt: folder.updatedAt || folder.createdAt,
        createdBy: folder.createdBy || 'Unknown',
        permissions: ['view', 'edit'], // Default permissions - fetch from /api/drive/files/:id/permissions when viewing file details
        starred: false,
        shared: false
      }));

      // Combine files and folders
      const combinedItems = [...mappedFolders, ...mappedFiles];
      console.log('📁 Drive Debug - Final Items:', { 
        totalItems: combinedItems.length, 
        folders: mappedFolders.length, 
        files: mappedFiles.length,
        items: combinedItems 
      });
      setItems(combinedItems);

      // Calculate storage usage
      const totalSize = mappedFiles.reduce((sum: number, file: any) => sum + (file.size || 0), 0);
      setStorageUsage(prev => ({ ...prev, used: totalSize }));

    } catch (err) {
      console.error('Error loading drive content:', err);
      console.error('Error details:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        session: !!session,
        hasToken: !!session?.accessToken,
        dashboardId: effectiveDashboardId,
        currentDashboard: currentDashboard?.id,
        currentFolder,
        filesUrl,
        foldersUrl
      });
      setError(`Failed to load drive content: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, effectiveDashboardId, currentFolder]);

  useEffect(() => {
    loadFilesAndFolders();
  }, [loadFilesAndFolders]);

  // Listen to refresh trigger from parent
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadFilesAndFolders();
    }
  }, [refreshTrigger, loadFilesAndFolders]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // File upload handler
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (!files || !session?.accessToken) return;

      try {
        setLoading(true);
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const formData = new FormData();
          formData.append('file', file);
          if (effectiveDashboardId) formData.append('dashboardId', effectiveDashboardId);
          if (currentFolder) formData.append('folderId', currentFolder);

          const response = await fetch('/api/drive/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.accessToken}` },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
          }
        }

        // Refresh content
        await loadFilesAndFolders();
        toast.success('Files uploaded successfully');
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error('Failed to upload files. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  // Folder creation handler
  const handleCreateFolder = async () => {
    if (!session?.accessToken) return;

    const name = prompt('Enter folder name:');
    if (!name) return;

    try {
      setLoading(true);
      
      const response = await fetch('/api/drive/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ 
          name,
          dashboardId: effectiveDashboardId,
          parentId: currentFolder || null
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create folder');
      }

      // Refresh content
      await loadFilesAndFolders();
      toast.success('Folder created successfully');
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder. Please try again.');
    } finally {
    setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getFileIcon = (item: DriveItem) => {
    if (item.type === 'folder') {
      return <div className="text-4xl">📁</div>;
    }

    // Enhanced file type icons
    const mimeType = item.mimeType || '';
    if (mimeType.includes('pdf')) return <div className="text-4xl">📄</div>;
    if (mimeType.includes('word') || mimeType.includes('document')) return <div className="text-4xl">📝</div>;
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <div className="text-4xl">📊</div>;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <div className="text-4xl">📈</div>;
    if (mimeType.startsWith('image/')) return <div className="text-4xl">🖼️</div>;
    if (mimeType.startsWith('video/')) return <div className="text-4xl">🎥</div>;
    if (mimeType.startsWith('audio/')) return <div className="text-4xl">🎵</div>;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return <div className="text-4xl">📦</div>;
    if (mimeType.includes('text')) return <div className="text-4xl">📋</div>;

    return <div className="text-4xl">📄</div>;
  };

  const handleItemClick = (item: DriveItem) => {
    if (item.type === 'folder') {
      setCurrentFolder(item.id);
      setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
    } else {
      // Open preview panel for files
      setPreviewFile(item);
    }
  };



  const handleDelete = (itemId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      setItems(prev => prev.filter(item => item.id !== itemId));
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      toast.success('Item deleted successfully');
    }
  };

  const handleShare = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    // Both files and folders can now be shared
    setShareItem(item);
    setShareModalOpen(true);
  };

  const handleDownload = async (itemId: string) => {
    if (!session?.accessToken) {
      toast.error('Please log in to download files');
      return;
    }

    const item = items.find(i => i.id === itemId);
    if (!item || item.type !== 'file') {
      toast.error('Only files can be downloaded');
      return;
    }

    try {
      await downloadFile(session.accessToken, itemId);
      toast.success('Download started');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download file');
    }
  };

  const handleStar = async (itemId: string) => {
    if (!session?.accessToken) {
      toast.error('Please log in to pin items');
      return;
    }

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    try {
      let updatedItem: DriveFile | DriveFolder;
      if (item.type === 'file') {
        updatedItem = await toggleFileStarred(session.accessToken, itemId);
      } else {
        updatedItem = await toggleFolderStarred(session.accessToken, itemId);
      }

      // Update local state with the response from the server
      setItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, starred: updatedItem.starred } : i
      ));
      
      toast.success(updatedItem.starred ? '📌 Pinned' : 'Unpinned');
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      toast.error('Failed to update pin status');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: DriveItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0 || !session?.accessToken) return;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        if (effectiveDashboardId) formData.append('dashboardId', effectiveDashboardId);
        if (currentFolder) formData.append('folderId', currentFolder);

        const response = await fetch('/api/drive/files', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.accessToken}` },
          body: formData,
        });

        if (!response.ok) {
          toast.error(`Failed to upload ${file.name}`);
        } else {
          toast.success(`Uploaded ${file.name}`);
        }
      }
      
      // Refresh file list
      loadFilesAndFolders();
    } catch (error) {
      console.error('Drop upload failed:', error);
      toast.error('Failed to upload files');
    }
  }, [session, currentDashboard, currentFolder, loadFilesAndFolders]);

  // Filter and sort items
  const filteredItems = items
    .filter(item => {
      // Search filter
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // File type filter
      if (fileTypeFilter && item.type === 'file') {
        const mimeType = item.mimeType || '';
        if (fileTypeFilter === 'documents' && !mimeType.includes('pdf') && !mimeType.includes('word') && !mimeType.includes('document')) return false;
        if (fileTypeFilter === 'images' && !mimeType.startsWith('image/')) return false;
        if (fileTypeFilter === 'videos' && !mimeType.startsWith('video/')) return false;
        if (fileTypeFilter === 'spreadsheets' && !mimeType.includes('excel') && !mimeType.includes('spreadsheet')) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      // Folders always first
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      
      // Then sort by selected criteria
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          comparison = (a.mimeType || '').localeCompare(b.mimeType || '');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  console.log('📁 Drive Debug - Rendering:', { 
    itemsCount: items.length, 
    filteredCount: filteredItems.length,
    loading,
    error,
    searchQuery,
    fileTypeFilter,
    session: !!session,
    hasToken: !!session?.accessToken,
    dashboardId: effectiveDashboardId,
    currentDashboard: currentDashboard?.id,
    currentFolder,
    filesUrl: `/api/drive/files?${new URLSearchParams({
      dashboardId: effectiveDashboardId || '',
      folderId: currentFolder || ''
    })}`,
    foldersUrl: `/api/drive/folders?${new URLSearchParams({
      dashboardId: effectiveDashboardId || '',
      parentId: currentFolder || ''
    })}`
  });

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Drive Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={loadFilesAndFolders} variant="primary">
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} variant="secondary">
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative space-y-6 p-6 overflow-auto ${className} ${isDragging ? 'bg-blue-50 border-2 border-blue-400 border-dashed' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50 bg-opacity-90">
          <div className="text-center">
            <Upload className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <p className="text-xl font-medium text-blue-900">Drop files to upload</p>
            <p className="text-sm text-blue-700 mt-2">
              {currentFolder ? `Upload to current folder` : `Upload to ${currentDashboard?.name || 'My Drive'}`}
            </p>
          </div>
        </div>
      )}

      {/* Header - Only show when at root level */}
      {!currentFolder && breadcrumbs.length === 0 && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentDashboard ? `${currentDashboard.name} Drive` : 'My Drive'}
            </h1>
            <p className="text-gray-600">
              {currentDashboard 
                ? 'Shared file storage and collaboration' 
                : 'Your personal file storage'}
            </p>
        </div>
        <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={handleCreateFolder}>
            <Folder className="w-4 h-4 mr-2" />
            New Folder
          </Button>
            <Button size="sm" onClick={handleFileUpload}>
            <Upload className="w-4 h-4 mr-2" />
              Upload Files
          </Button>
        </div>
      </div>
      )}

      {/* Storage Usage - Only show at root level */}
      {!currentFolder && breadcrumbs.length === 0 && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Storage</span>
            </div>
            <span className="text-sm text-gray-600">
              {formatFileSize(storageUsage.used)} / {formatFileSize(storageUsage.total)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((storageUsage.used / storageUsage.total) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{((storageUsage.used / storageUsage.total) * 100).toFixed(1)}% used</span>
            <span>{formatFileSize(storageUsage.total - storageUsage.used)} available</span>
          </div>
        </div>
      )}

      {/* Breadcrumbs - Show when navigating folders */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <button
            onClick={() => {
              setCurrentFolder(null);
              setBreadcrumbs([]);
            }}
            className="hover:text-blue-600"
          >
            Drive
          </button>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <span>/</span>
              <button
                onClick={() => {
                  const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                  setBreadcrumbs(newBreadcrumbs);
                  setCurrentFolder(crumb.id);
                }}
                className="hover:text-blue-600"
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Search, Sort, and View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
          
          {/* File Type Filter */}
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="documents">📝 Documents</option>
            <option value="spreadsheets">📊 Spreadsheets</option>
            <option value="images">🖼️ Images</option>
            <option value="videos">🎥 Videos</option>
          </select>
          
          {/* Sort Options */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size' | 'type')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Name</option>
            <option value="date">Date Modified</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* File Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`group relative cursor-pointer hover:shadow-md transition-shadow rounded-lg ${
                selectedItems.has(item.id) ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleItemClick(item)}
              onContextMenu={(e) => handleContextMenu(e, item)}
            >
              <Card className="p-4">
                {/* Quick Actions - Show on hover */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStar(item.id);
                    }}
                    className="p-1 bg-white rounded-full shadow-sm hover:bg-gray-50"
                    title={item.starred ? 'Unpin' : 'Pin'}
                  >
                    <Pin className={`w-4 h-4 ${item.starred ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                  </button>
                  {item.type === 'file' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(item.id);
                        }}
                        className="p-1 bg-white rounded-full shadow-sm hover:bg-gray-50"
                        title="Share"
                      >
                        <Share className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item.id);
                        }}
                        className="p-1 bg-white rounded-full shadow-sm hover:bg-gray-50"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-gray-400" />
                      </button>
                    </>
                  )}
                </div>
                
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    {getFileIcon(item)}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate" title={item.name}>
                    {item.name}
                  </p>
                  {item.type === 'file' && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(item.size || 0)}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(item.modifiedAt)}
                  </p>
                  {item.starred && (
                    <Pin className="w-3 h-3 text-yellow-500 fill-current mx-auto mt-1" />
                  )}
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedItems.has(item.id) ? 'bg-blue-50 ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleItemClick(item)}
              onContextMenu={(e) => handleContextMenu(e, item)}
            >
              <Card className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {getFileIcon(item)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Modified {formatDate(item.modifiedAt)} by {item.createdBy}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.starred && <Pin className="w-4 h-4 text-yellow-500 fill-current" />}
                    {item.shared && <Share className="w-4 h-4 text-blue-500" />}
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStar(item.id);
                        }}
                      >
                        <Pin className={`w-4 h-4 ${item.starred ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(item.id);
                        }}
                      >
                        <Share className="w-4 h-4 text-gray-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No files found' : 'No files yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Get started by uploading your first file or creating a folder'
            }
          </p>
          {!searchQuery && (
            <div className="flex items-center justify-center space-x-3">
              <Button onClick={handleFileUpload}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
              <Button variant="secondary" onClick={handleCreateFolder}>
                <Folder className="w-4 h-4 mr-2" />
                Create Folder
              </Button>
            </div>
          )}
        </div>
      )}

      {/* File Preview Panel */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setPreviewFile(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                {getFileIcon(previewFile)}
                <div>
                  <h3 className="font-medium text-gray-900">{previewFile.name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(previewFile.size || 0)} • Modified {formatDate(previewFile.modifiedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(previewFile.thumbnail || '#', '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Preview Content */}
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
              {previewFile.mimeType?.startsWith('image/') ? (
                <img src={previewFile.thumbnail || previewFile.name} alt={previewFile.name} className="max-w-full mx-auto" />
              ) : previewFile.mimeType?.includes('pdf') ? (
                <iframe src={previewFile.thumbnail || '#'} className="w-full h-[600px] border-0" title={previewFile.name} />
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">{getFileIcon(previewFile)}</div>
                  <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                  <Button onClick={() => window.open(previewFile.thumbnail || '#', '_blank')}>
                    <Download className="w-4 h-4 mr-2" />
                    Download to View
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-48"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2"
            onClick={() => {
              if (contextMenu.item.type === 'folder') {
                handleItemClick(contextMenu.item);
              } else {
                setPreviewFile(contextMenu.item);
              }
              setContextMenu(null);
            }}
          >
            <Eye className="w-4 h-4" />
            <span>{contextMenu.item.type === 'folder' ? 'Open' : 'Preview'}</span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2"
            onClick={() => {
              handleStar(contextMenu.item.id);
              setContextMenu(null);
            }}
          >
            <Pin className="w-4 h-4" />
            <span>{contextMenu.item.starred ? 'Unpin' : 'Pin'}</span>
          </button>
          {contextMenu.item.type === 'file' && (
            <>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2"
                onClick={() => {
                  handleShare(contextMenu.item.id);
                  setContextMenu(null);
                }}
              >
                <Share className="w-4 h-4" />
                <span>Share</span>
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2"
                onClick={() => {
                  handleDownload(contextMenu.item.id);
                  setContextMenu(null);
                }}
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </>
          )}
          <div className="border-t border-gray-200 my-1"></div>
          <button
            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center space-x-2"
            onClick={() => {
              handleDelete(contextMenu.item.id);
              setContextMenu(null);
            }}
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && shareItem && session?.accessToken && (
        <ShareModal
          item={{
            id: shareItem.id,
            name: shareItem.name,
            type: shareItem.type
          }}
          onClose={() => {
            setShareModalOpen(false);
            setShareItem(null);
          }}
          onShare={async (email: string, permission: 'view' | 'edit') => {
            try {
              let result;
              if (shareItem.type === 'file') {
                result = await shareItemByEmail(session.accessToken!, shareItem.id, email, permission);
              } else {
                result = await shareFolderByEmail(session.accessToken!, shareItem.id, email, permission);
              }
              
              if (result.shareLink) {
                // User doesn't exist - show share link modal
                setShareLinkModal({
                  email: email,
                  shareLink: result.shareLink,
                  itemName: shareItem.name,
                  itemType: shareItem.type
                });
                // Close the share modal
                setShareModalOpen(false);
                setShareItem(null);
              } else {
                // User exists - shared successfully
                toast.success(result.message);
                setShareModalOpen(false);
                setShareItem(null);
              }
            } catch (error) {
              console.error('Share failed:', error);
              const itemType = shareItem.type === 'file' ? 'file' : 'folder';
              toast.error(error instanceof Error ? error.message : `Failed to share ${itemType}`);
              throw error;
            }
          }}
          onShareWithUser={async (userId: string, permission: 'view' | 'edit') => {
            try {
              const canRead = true;
              const canWrite = permission === 'edit';
              if (shareItem.type === 'file') {
                await grantFilePermission(session.accessToken!, shareItem.id, userId, canRead, canWrite);
                toast.success('File shared');
              } else {
                await grantFolderPermission(session.accessToken!, shareItem.id, userId, canRead, canWrite);
                toast.success('Folder shared');
              }
              setShareModalOpen(false);
              setShareItem(null);
            } catch (error) {
              console.error('Share failed:', error);
              const itemType = shareItem.type === 'file' ? 'file' : 'folder';
              toast.error(`Failed to share ${itemType}`);
              throw error;
            }
          }}
          onCopyLink={async () => {
            try {
              // Generate a shareable link
              const itemType = shareItem.type === 'file' ? 'file' : 'folder';
              const shareUrl = `${window.location.origin}/drive/shared?${itemType}=${shareItem.id}`;
              await navigator.clipboard.writeText(shareUrl);
              toast.success('Share link copied to clipboard');
            } catch (error) {
              console.error('Copy failed:', error);
              toast.error('Failed to copy link');
              throw error;
            }
          }}
          shareLink={shareItem ? `${window.location.origin}/drive/shared?${shareItem.type === 'file' ? 'file' : 'folder'}=${shareItem.id}` : undefined}
          onListPermissions={async (itemId: string) => {
            try {
              const permissions = shareItem.type === 'file'
                ? await listFilePermissions(session.accessToken!, itemId)
                : await listFolderPermissions(session.accessToken!, itemId);
              return permissions.map((p: any) => ({
                id: p.id,
                userId: p.userId,
                canRead: p.canRead,
                canWrite: p.canWrite,
                user: {
                  id: p.user.id,
                  name: p.user.name,
                  email: p.user.email
                }
              }));
            } catch (error) {
              console.error('Failed to list permissions:', error);
              return [];
            }
          }}
          onUpdatePermission={async (itemId: string, userId: string, canRead: boolean, canWrite: boolean) => {
            try {
              if (shareItem.type === 'file') {
                await updateFilePermission(session.accessToken!, itemId, userId, canRead, canWrite);
              } else {
                await updateFolderPermission(session.accessToken!, itemId, userId, canRead, canWrite);
              }
              toast.success('Permission updated');
            } catch (error) {
              console.error('Update permission failed:', error);
              toast.error('Failed to update permission');
              throw error;
            }
          }}
          onRevokePermission={async (itemId: string, userId: string) => {
            try {
              if (shareItem.type === 'file') {
                await revokeFilePermission(session.accessToken!, itemId, userId);
              } else {
                await revokeFolderPermission(session.accessToken!, itemId, userId);
              }
              toast.success('Permission revoked');
            } catch (error) {
              console.error('Revoke permission failed:', error);
              toast.error('Failed to revoke permission');
              throw error;
            }
          }}
          onSearchUsers={async (query: string) => {
            try {
              const users = await searchUsers(session.accessToken!, query);
              return users.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                connectionStatus: user.connectionStatus || 'none',
                relationshipId: user.relationshipId || null,
                organization: user.organization || null
              }));
            } catch (error) {
              console.error('Search users failed:', error);
              return [];
            }
          }}
          onGetBusinessMembers={async () => {
            try {
              if (!currentDashboard) {
                return [];
              }
              const dashboardType = getDashboardType(currentDashboard);
              if (dashboardType !== 'business') {
                return [];
              }
              const businessDashboard = currentDashboard as { business?: { id: string } };
              if (!businessDashboard.business?.id) {
                return [];
              }
              const members = await getBusinessMembers(session.accessToken!, businessDashboard.business.id);
              return members;
            } catch (error) {
              console.error('Get business members failed:', error);
              return [];
            }
          }}
          currentDashboard={currentDashboard ? {
            id: currentDashboard.id,
            type: (() => {
              const type = getDashboardType(currentDashboard);
              // ShareModal doesn't support 'household', map it to 'personal'
              return type === 'household' ? 'personal' : type as 'personal' | 'business' | 'educational';
            })(),
            businessId: (currentDashboard as { business?: { id: string } }).business?.id
          } : null}
        />
      )}

      {/* Share Link Modal - shown when sharing with non-user email */}
      {shareLinkModal && (
        <ShareLinkModal
          isOpen={!!shareLinkModal}
          onClose={() => {
            setShareLinkModal(null);
          }}
          itemName={shareLinkModal.itemName}
          itemType={shareLinkModal.itemType}
          shareLink={shareLinkModal.shareLink}
          email={shareLinkModal.email}
        />
      )}
    </div>
  );
}
