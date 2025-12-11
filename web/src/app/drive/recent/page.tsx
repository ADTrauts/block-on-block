'use client';

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/contexts/DashboardContext';
import { getRecentActivity, Activity } from '@/api/drive';
import { LoadingOverlay } from 'shared/components/LoadingOverlay';
import { Alert } from 'shared/components/Alert';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ClockIcon, DocumentIcon, FolderIcon, TrashIcon, ArrowDownTrayIcon, PencilIcon } from '@heroicons/react/24/outline';
import DriveSidebar from '../DriveSidebar';

const RecentPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { currentDashboard, navigateToDashboard } = useDashboard();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);

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
      const fetchRecentActivity = async () => {
        try {
          setLoading(true);
          setError(null);
          const recentActivities = await getRecentActivity(session.accessToken as string);
          setActivities(recentActivities);
        } catch (err) {
          console.error('Error fetching recent activity:', err);
          setError('Failed to load recent activity. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      fetchRecentActivity();
    } else if (status === 'unauthenticated') {
      setError('You must be logged in to view recent activity.');
      setLoading(false);
    }
  }, [session, status]);

  const renderActivityIcon = (type: Activity['type']) => {
    const iconClasses = "w-5 h-5";
    switch (type) {
      case 'create': return <DocumentIcon className={iconClasses} />;
      case 'edit': return <PencilIcon className={iconClasses} />;
      case 'delete': return <TrashIcon className={iconClasses} />;
      case 'share': return <FolderIcon className={iconClasses} />;
      case 'download': return <ArrowDownTrayIcon className={iconClasses} />;
      default: return <ClockIcon className={iconClasses} />;
    }
  };

  const renderActivityText = (activity: Activity) => {
    const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });
    const user = activity.user.name === session?.user?.name ? 'You' : activity.user.name;

    switch (activity.type) {
      case 'create':
        return <>{user} created <Link href={`/drive?file=${activity.file.id}`} className="font-semibold text-blue-600 hover:underline">{activity.file.name}</Link> • {timeAgo}</>;
      case 'edit':
        return <>{user} edited <Link href={`/drive?file=${activity.file.id}`} className="font-semibold text-blue-600 hover:underline">{activity.file.name}</Link> • {timeAgo}</>;
      case 'delete':
        return <>{user} moved <span className="font-semibold">{activity.file.name}</span> to trash • {timeAgo}</>;
      case 'share':
        return <>{user} shared <Link href={`/drive?file=${activity.file.id}`} className="font-semibold text-blue-600 hover:underline">{activity.file.name}</Link> • {timeAgo}</>;
      case 'download':
        return <>{user} downloaded <Link href={`/drive?file=${activity.file.id}`} className="font-semibold text-blue-600 hover:underline">{activity.file.name}</Link> • {timeAgo}</>;
      default:
        return <>Action performed on <Link href={`/drive?file=${activity.file.id}`} className="font-semibold text-blue-600 hover:underline">{activity.file.name}</Link> • {timeAgo}</>;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'create': return 'text-green-600 bg-green-50';
      case 'edit': return 'text-blue-600 bg-blue-50';
      case 'delete': return 'text-red-600 bg-red-50';
      case 'share': return 'text-purple-600 bg-purple-50';
      case 'download': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

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
            <LoadingOverlay message="Loading recent activity..." />
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert type="error" title="Error">{error}</Alert>
          </div>
        ) : (
          <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Recent Activity</h1>
            <p className="text-gray-600">Track your recent file and folder activities</p>
          </div>

      {activities.length === 0 ? (
        <div className="text-center py-12">
          <ClockIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recent activity</h3>
          <p className="text-gray-600 mb-6">
            Your recent file activities will appear here. Start by uploading or working with files in your Drive.
          </p>
          <Link 
            href="/drive" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Drive
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div 
              key={activity.id} 
              className="flex items-center p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                {renderActivityIcon(activity.type)}
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  {renderActivityText(activity)}
                </p>
                {activity.details && (
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.details.action && (
                      <span className="capitalize">{activity.details.action.replace('_', ' ')}</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentPage; 