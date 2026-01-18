'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDashboard } from '../../contexts/DashboardContext';
import DriveSidebar from '../../app/drive/DriveSidebar';
import { DriveModuleWrapper } from './DriveModuleWrapper';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from '@dnd-kit/core';

interface DrivePageContentProps {
  className?: string;
}

export function DrivePageContent({ className = '' }: DrivePageContentProps) {
  const { data: session } = useSession();
  const { currentDashboard, navigateToDashboard } = useDashboard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Use ref instead of state to avoid render-phase updates
  const dragEndHandlerRef = useRef<((event: DragEndEvent | null) => Promise<void>) | null>(null);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setDraggingId(activeId);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent | null) => {
    setDraggingId(null);
    if (dragEndHandlerRef.current && event && typeof dragEndHandlerRef.current === 'function') {
      await dragEndHandlerRef.current(event);
    }
  }, []);

  // File upload handler
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

          if (!response.ok) {
            console.error('Upload failed:', response.status);
          }
        }
        
        // Trigger refresh without page reload
        setRefreshTrigger(prev => prev + 1);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    };
    input.click();
  }, [session, currentDashboard]);

  // Folder creation handler
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

      if (!response.ok) {
        console.error('Failed to create folder');
      }
      
      // Trigger refresh without page reload
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  }, [session, currentDashboard]);

  // Context switch handler
  const handleContextSwitch = useCallback(async (dashboardId: string) => {
    await navigateToDashboard(dashboardId);
    // Use router.push for seamless navigation instead of page reload
    router.push(`/drive?dashboard=${dashboardId}`);
  }, [navigateToDashboard, router]);

  // Folder selection handler - receives folderId string from DriveSidebar
  const handleFolderSelect = useCallback((folderId: string | null) => {
    setSelectedFolder(folderId ? { id: folderId, name: '' } : null);
  }, []);

  // Initialize selected folder from URL (?folder=...) so other pages can deep-link into Drive
  useEffect(() => {
    if (!searchParams) {
      return;
    }
    const folderId = searchParams.get('folder');
    if (folderId) {
      setSelectedFolder({ id: folderId, name: '' });
    }
  }, [searchParams]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={`flex h-full bg-gray-50 ${className}`}>
        {/* Drive Sidebar - Same for all users */}
        <DriveSidebar 
          onNewFolder={handleCreateFolder} 
          onFileUpload={handleFileUpload} 
          onFolderUpload={handleFileUpload}
          onContextSwitch={handleContextSwitch}
          onFolderSelect={handleFolderSelect}
          selectedFolderId={selectedFolder?.id}
        />
        
        {/* Main Content - Context-aware module */}
        <div className="flex-1 overflow-hidden">
          <DriveModuleWrapper 
            className="h-full" 
            refreshTrigger={refreshTrigger}
            selectedFolderId={selectedFolder?.id || null}
            onFolderSelect={(folderId) => {
              // Update selected folder state with folderId from DriveModuleWrapper
              setSelectedFolder(folderId ? { id: folderId, name: '' } : null);
            }}
            onRegisterDragEndHandler={(handler) => {
              dragEndHandlerRef.current = handler;
            }}
          />
        </div>
      </div>
    </DndContext>
  );
}

export default DrivePageContent;
