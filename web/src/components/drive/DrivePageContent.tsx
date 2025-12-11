  'use client';

import React, { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../../contexts/DashboardContext';
import DriveSidebar from '../../app/drive/DriveSidebar';
import { DriveModuleWrapper } from './DriveModuleWrapper';

interface DrivePageContentProps {
  className?: string;
}

export function DrivePageContent({ className = '' }: DrivePageContentProps) {
  const { data: session } = useSession();
  const { currentDashboard, navigateToDashboard } = useDashboard();
  const router = useRouter();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);

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

  // Folder selection handler
  const handleFolderSelect = useCallback((folder: { id: string; name: string } | null) => {
    setSelectedFolder(folder);
    // Folder selection is handled by DriveModuleWrapper which receives dashboardId
    // The selected folder ID is passed to DriveModule via props if needed
    // For now, folder navigation is handled by the DriveModule's currentFolder state
    console.log('Selected folder:', folder);
  }, []);

  return (
    <div className={`flex h-screen bg-gray-50 ${className}`}>
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
        />
      </div>
    </div>
  );
}

export default DrivePageContent;

