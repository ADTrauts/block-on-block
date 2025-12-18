'use client';

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/contexts/DashboardContext';
import { listFiles, listFolders, toggleFileStarred, toggleFolderStarred, downloadFile, File as DriveFile, Folder as DriveFolder } from '@/api/drive';
import { LoadingOverlay } from 'shared/components/LoadingOverlay';
import { Alert } from 'shared/components/Alert';
import { ShareModal, ShareLinkModal } from 'shared/components';
import { useGlobalTrash } from '@/contexts/GlobalTrashContext';
import DriveDetailsPanel from '@/components/drive/DriveDetailsPanel';
import DriveSidebar from '../DriveSidebar';
import { Pin, Grid, List, Share, Download, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
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
  getBusinessMembers,
  moveFile,
  moveFolder
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
  url?: string;
}

// Draggable and droppable item component (same as DriveModule)
function DraggableItem({
  item,
  isSelected,
  isDragging,
  onClick,
  onContextMenu,
  getFileIcon,
  formatFileSize,
  formatDate,
  handleStar,
  handleShare,
  handleDownload,
  viewMode = 'grid',
  dashboardId
}: {
  item: DriveItem;
  isSelected: boolean;
  isDragging: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  getFileIcon: (item: DriveItem) => React.ReactNode;
  formatFileSize: (size: number) => string;
  formatDate: (date: string) => string;
  handleStar: (id: string) => void;
  handleShare: (id: string) => void;
  handleDownload: (id: string) => void;
  viewMode?: 'grid' | 'list';
  dashboardId?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isDraggingItem } = useDraggable({
    id: item.id,
    disabled: false,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: item.id,
    disabled: item.type !== 'folder',
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDraggingItem ? 0.5 : 1,
  } : undefined;

  const combinedRef = (node: HTMLElement | null) => {
    setNodeRef(node);
    if (item.type === 'folder') {
      setDropRef(node);
    }
  };

  const hasDraggedRef = React.useRef(false);

  React.useEffect(() => {
    if (isDraggingItem) {
      hasDraggedRef.current = true;
    } else if (hasDraggedRef.current) {
      const timer = setTimeout(() => {
        hasDraggedRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDraggingItem]);

  const handleClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    onClick();
  };

  if (viewMode === 'list') {
    return (
      <div
        ref={combinedRef}
        style={style}
        className={`group relative cursor-move hover:bg-gray-50 transition-colors rounded-lg p-2 ${
          isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : ''
        } ${isOver && item.type === 'folder' ? 'ring-2 ring-blue-400 bg-blue-50' : ''} ${isDraggingItem ? 'opacity-50' : ''}`}
        onClick={handleClick}
        onContextMenu={onContextMenu}
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
            {getFileIcon(item)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {item.starred && (
                <Pin className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />
              )}
              <span className="font-medium text-gray-900 truncate">{item.name}</span>
            </div>
            <div className="text-sm text-gray-500">{formatDate(item.modifiedAt)}</div>
          </div>
          {item.type === 'file' && item.size && (
            <div className="text-sm text-gray-500">{formatFileSize(item.size)}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={combinedRef}
      style={style}
      className={`group relative cursor-move hover:shadow-md transition-shadow rounded-lg ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${isOver && item.type === 'folder' ? 'ring-2 ring-blue-400 bg-blue-50' : ''} ${isDraggingItem ? 'opacity-50' : ''}`}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      {...attributes}
      {...listeners}
    >
      <div className="bg-white rounded-lg border border-gray-200 p-4 relative">
        {item.starred && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStar(item.id);
            }}
            className="absolute top-2 left-2 z-10 p-1 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
            title="Unpin"
          >
            <Pin className="w-4 h-4 text-yellow-500 fill-current" />
          </button>
        )}
        
        <div className={`absolute ${item.starred ? 'top-8' : 'top-2'} left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1`}>
          {!item.starred && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStar(item.id);
              }}
              className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-50 transition-colors"
              title="Pin"
            >
              <Pin className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleShare(item.id);
            }}
            className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-50 transition-colors"
            title="Share"
          >
            <Share className="w-4 h-4 text-gray-600" />
          </button>
          {item.type === 'file' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(item.id);
              }}
              className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-50 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center min-h-[120px]">
          <div className="mb-2 w-full flex justify-center">
            {getFileIcon(item)}
          </div>
          <span className="text-sm font-medium text-gray-700 truncate w-full text-center">{item.name}</span>
        </div>
      </div>
    </div>
  );
}

const PinnedPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { currentDashboard, navigateToDashboard } = useDashboard();
  const { trashItem } = useGlobalTrash();
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: DriveItem } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareItem, setShareItem] = useState<DriveItem | null>(null);
  const [shareLinkModal, setShareLinkModal] = useState<{ email: string; shareLink: string; itemName: string; itemType: 'file' | 'folder' } | null>(null);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [detailsPanelCollapsed, setDetailsPanelCollapsed] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<DriveItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const loadPinnedItems = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      setLoading(true);
      const [files, folders] = await Promise.all([
        listFiles(session.accessToken, undefined, true),
        listFolders(session.accessToken, undefined, true)
      ]);

      const driveItems: DriveItem[] = [
        ...(Array.isArray(folders) ? folders.map((f: DriveFolder) => ({
          id: f.id,
          name: f.name,
          type: 'folder' as const,
          modifiedAt: f.updatedAt,
          createdBy: '',
          permissions: [],
          starred: f.starred,
          mimeType: undefined,
        })) : []),
        ...(Array.isArray(files) ? files.map((f: DriveFile) => ({
          id: f.id,
          name: f.name,
          type: 'file' as const,
          size: f.size,
          modifiedAt: f.updatedAt,
          createdBy: '',
          permissions: [],
          starred: f.starred,
          mimeType: f.type,
          url: f.url,
        })) : [])
      ];

      setItems(driveItems);
    } catch (err) {
      setError('Failed to load pinned items.');
      console.error('Error loading pinned items:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      loadPinnedItems();
    } else if (status === 'unauthenticated') {
      setError('You must be logged in to view pinned items.');
      setLoading(false);
    }
  }, [session, status, loadPinnedItems]);

  const folders = items.filter(item => item.type === 'folder');
  const files = items.filter(item => item.type === 'file');

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const getFileIcon = (item: DriveItem) => {
    if (item.type === 'folder') {
      return <div className="text-4xl">📁</div>;
    }

    const mimeType = item.mimeType || '';
    
    if (mimeType.startsWith('image/')) {
      return (
        <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
          <img
            src={`/api/drive/files/${item.id}/download`}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.parentElement?.querySelector('.fallback-icon');
              if (fallback) {
                (fallback as HTMLElement).style.display = 'flex';
              }
            }}
          />
          <div className="fallback-icon hidden absolute inset-0 items-center justify-center bg-gray-50 text-4xl">🖼️</div>
        </div>
      );
    }

    if (mimeType.includes('pdf')) return <div className="text-4xl">📄</div>;
    if (mimeType.includes('word') || mimeType.includes('document')) return <div className="text-4xl">📝</div>;
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <div className="text-4xl">📊</div>;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <div className="text-4xl">📈</div>;
    if (mimeType.startsWith('video/')) return <div className="text-4xl">🎥</div>;
    if (mimeType.startsWith('audio/')) return <div className="text-4xl">🎵</div>;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return <div className="text-4xl">📦</div>;
    if (mimeType.includes('text')) return <div className="text-4xl">📋</div>;

    return <div className="text-4xl">📄</div>;
  };

  const handleItemClick = async (item: DriveItem) => {
    if (item.type === 'folder') {
      router.push(`/drive?folder=${item.id}`);
    } else {
      setSelectedItemForDetails(item);
      setDetailsPanelOpen(true);
      setDetailsPanelCollapsed(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (!confirm(`Are you sure you want to move "${item.name}" to trash?`)) {
      return;
    }

    if (!session?.accessToken) {
      toast.error('Please log in to delete items');
      return;
    }

    try {
      await trashItem({
        id: item.id,
        name: item.name,
        type: item.type,
        moduleId: 'drive',
        moduleName: 'Drive',
        metadata: {
          dashboardId: currentDashboard?.id || undefined,
        },
      });

      toast.success(`${item.name} moved to trash`);
      await loadPinnedItems();
    } catch (error) {
      console.error('Failed to move item to trash:', error);
      toast.error(`Failed to move ${item.name} to trash`);
    }
  };

  const handleShare = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
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

      setItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, starred: updatedItem.starred } : i
      ));
      
      if (!updatedItem.starred) {
        // Item was unpinned, remove from list
        setItems(prev => prev.filter(i => i.id !== itemId));
        toast.success('Unpinned');
      } else {
        toast.success('📌 Pinned');
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      toast.error('Failed to update pin status');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: DriveItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setDraggingId(activeId);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingId(null);

    if (!over || active.id === over.id || !session?.accessToken) {
      return;
    }

    const draggedItem = items.find(item => item.id === active.id);
    const targetItem = items.find(item => item.id === over.id);

    if (!draggedItem) return;

    // Handle trash drop
    if (over.id === 'global-trash-bin') {
      await handleDelete(draggedItem.id);
      return;
    }

    // Handle folder drop
    if (targetItem && targetItem.type === 'folder' && draggedItem.id !== targetItem.id) {
      try {
        if (draggedItem.type === 'file') {
          await moveFile(session.accessToken, draggedItem.id, targetItem.id);
        } else {
          await moveFolder(session.accessToken, draggedItem.id, targetItem.id);
        }
        toast.success(`Moved ${draggedItem.name} to ${targetItem.name}`);
        await loadPinnedItems();
      } catch (error) {
        console.error('Move failed:', error);
        toast.error('Failed to move item');
      }
    }
  };

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
        await loadPinnedItems();
      } catch (error) {
        console.error('Upload failed:', error);
      }
    };
    input.click();
  }, [session, currentDashboard, loadPinnedItems]);

  const handleContextSwitch = useCallback(async (dashboardId: string) => {
    await navigateToDashboard(dashboardId);
    router.push(`/drive?dashboard=${dashboardId}`);
  }, [navigateToDashboard, router]);

  const handleFolderSelect = useCallback((folderId: string | null) => {
    setSelectedFolder(folderId ? { id: folderId, name: '' } : null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-gray-50">
        <DriveSidebar 
          onNewFolder={handleCreateFolder} 
          onFileUpload={handleFileUpload} 
          onFolderUpload={handleFileUpload}
          onContextSwitch={handleContextSwitch}
          onFolderSelect={handleFolderSelect}
          selectedFolderId={selectedFolder?.id}
        />
        
        <div className="flex-1 overflow-auto flex">
          {status === 'loading' || loading ? (
            <div className="flex items-center justify-center h-full w-full">
              <LoadingOverlay message="Loading pinned items..." />
            </div>
          ) : error ? (
            <div className="p-6 w-full">
              <Alert type="error" title="Error">{error}</Alert>
            </div>
          ) : (
            <div className="flex-1 p-6">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Pin className="w-8 h-8 text-yellow-500 fill-current" />
                    <h1 className="text-3xl font-bold text-gray-900">Pinned Items</h1>
                  </div>
                  <p className="text-gray-600">Your pinned files and folders</p>
                </div>
                
                {items.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                      onClick={() => setViewMode('list')}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <div className="text-center py-12">
                  <Pin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No pinned items</h3>
                  <p className="text-gray-600">Pin files and folders to see them here.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {folders.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Folders</h2>
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                          {folders.map((item) => (
                            <DraggableItem
                              key={`folder-${item.id}`}
                              item={item}
                              isSelected={selectedItems.has(item.id)}
                              isDragging={draggingId === item.id}
                              onClick={() => handleItemClick(item)}
                              onContextMenu={(e) => handleContextMenu(e, item)}
                              getFileIcon={getFileIcon}
                              formatFileSize={formatFileSize}
                              formatDate={formatDate}
                              handleStar={handleStar}
                              handleShare={handleShare}
                              handleDownload={handleDownload}
                              dashboardId={currentDashboard?.id || null}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {folders.map((item) => (
                            <DraggableItem
                              key={`folder-${item.id}`}
                              item={item}
                              isSelected={selectedItems.has(item.id)}
                              isDragging={draggingId === item.id}
                              onClick={() => handleItemClick(item)}
                              onContextMenu={(e) => handleContextMenu(e, item)}
                              getFileIcon={getFileIcon}
                              formatFileSize={formatFileSize}
                              formatDate={formatDate}
                              handleStar={handleStar}
                              handleShare={handleShare}
                              handleDownload={handleDownload}
                              viewMode="list"
                              dashboardId={currentDashboard?.id || null}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {files.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Files</h2>
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                          {files.map((item) => (
                            <DraggableItem
                              key={`file-${item.id}`}
                              item={item}
                              isSelected={selectedItems.has(item.id)}
                              isDragging={draggingId === item.id}
                              onClick={() => handleItemClick(item)}
                              onContextMenu={(e) => handleContextMenu(e, item)}
                              getFileIcon={getFileIcon}
                              formatFileSize={formatFileSize}
                              formatDate={formatDate}
                              handleStar={handleStar}
                              handleShare={handleShare}
                              handleDownload={handleDownload}
                              dashboardId={currentDashboard?.id || null}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {files.map((item) => (
                            <DraggableItem
                              key={`file-${item.id}`}
                              item={item}
                              isSelected={selectedItems.has(item.id)}
                              isDragging={draggingId === item.id}
                              onClick={() => handleItemClick(item)}
                              onContextMenu={(e) => handleContextMenu(e, item)}
                              getFileIcon={getFileIcon}
                              formatFileSize={formatFileSize}
                              formatDate={formatDate}
                              handleStar={handleStar}
                              handleShare={handleShare}
                              handleDownload={handleDownload}
                              viewMode="list"
                              dashboardId={currentDashboard?.id || null}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Details Panel */}
          {detailsPanelOpen && selectedItemForDetails && (
            <DriveDetailsPanel
              item={selectedItemForDetails}
              isOpen={detailsPanelOpen}
              isCollapsed={detailsPanelCollapsed}
              onClose={() => {
                setDetailsPanelOpen(false);
                setSelectedItemForDetails(null);
              }}
              onToggleCollapse={() => setDetailsPanelCollapsed(!detailsPanelCollapsed)}
              onDelete={handleDelete}
              onShare={handleShare}
              onDownload={handleDownload}
              getFileIcon={getFileIcon}
              formatFileSize={formatFileSize}
              formatDate={formatDate}
            />
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <button
              onClick={() => {
                handleStar(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <Pin className="w-4 h-4" />
              {contextMenu.item.starred ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={() => {
                handleShare(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <Share className="w-4 h-4" />
              Share
            </button>
            {contextMenu.item.type === 'file' && (
              <button
                onClick={() => {
                  handleDownload(contextMenu.item.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
            <button
              onClick={() => {
                handleDelete(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}

        {/* Share Modal */}
        {shareModalOpen && shareItem && (
          <ShareModal
            isOpen={shareModalOpen}
            onClose={() => {
              setShareModalOpen(false);
              setShareItem(null);
            }}
            itemId={shareItem.id}
            itemType={shareItem.type}
            itemName={shareItem.name}
            onShareLink={(email, shareLink) => {
              setShareLinkModal({ email, shareLink, itemName: shareItem.name, itemType: shareItem.type });
              setShareModalOpen(false);
            }}
          />
        )}

        {/* Share Link Modal */}
        {shareLinkModal && (
          <ShareLinkModal
            isOpen={!!shareLinkModal}
            onClose={() => setShareLinkModal(null)}
            email={shareLinkModal.email}
            shareLink={shareLinkModal.shareLink}
            itemName={shareLinkModal.itemName}
            itemType={shareLinkModal.itemType}
          />
        )}
      </div>
    </DndContext>
  );
};

export default PinnedPage;
