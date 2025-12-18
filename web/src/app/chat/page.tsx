'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import ChatContent from './ChatContent';

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    currentDashboard, 
    currentDashboardId, 
    allDashboards, 
    loading,
    isModuleActiveOnDashboard,
    hasAnyModules
  } = useDashboard();

  // Handle fileId query parameter from Drive "Discuss in chat" action
  useEffect(() => {
    const fileId = searchParams?.get('fileId');
    const fileName = searchParams?.get('fileName');
    
    if (fileId && fileName) {
      // Store file reference for ChatContent to use
      // Remove query params after storing to clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('fileId');
      newUrl.searchParams.delete('fileName');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [searchParams]);

  // Handle dashboard context from URL
  useEffect(() => {
    if (loading) return; // Wait for dashboards to load

    const dashboardParam = searchParams?.get('dashboard');
    
    if (dashboardParam) {
      // Check if chat module is active on the target dashboard
      if (!isModuleActiveOnDashboard('chat', dashboardParam)) {
        // Chat module is not active on this dashboard, show module not available message
        return;
      }
      
      // If dashboard parameter is provided, ensure we're in the right context
      const targetDashboard = allDashboards.find(d => d.id === dashboardParam);
      if (targetDashboard && currentDashboardId !== dashboardParam) {
        // We're in the right context, no need to redirect
        return;
      }
    } else if (allDashboards.length > 0 && !currentDashboardId) {
      // No dashboard specified, find first dashboard with chat module
      const dashboardWithChat = allDashboards.find(d => isModuleActiveOnDashboard('chat', d.id));
      if (dashboardWithChat) {
        router.replace(`/chat?dashboard=${dashboardWithChat.id}`);
        return;
      } else {
        // No dashboard has chat module, redirect to dashboard management
        router.replace('/dashboard');
        return;
      }
    } else if (allDashboards.length === 0) {
      // No dashboards available, redirect to dashboard creation
      router.replace('/dashboard');
      return;
    }
  }, [searchParams, currentDashboardId, allDashboards, loading, router, isModuleActiveOnDashboard]);

  // Show loading state while determining context
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show error state if no dashboard context
  if (!currentDashboard) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No Dashboard Available</h2>
          <p className="text-gray-600 mb-4">Please create a dashboard to access chat functionality.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Check if chat module is active on current dashboard
  if (currentDashboard && !isModuleActiveOnDashboard('chat', currentDashboard.id)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Chat Module Not Available</h2>
          <p className="text-gray-600 mb-4">
            The chat module is not enabled on the current dashboard "{currentDashboard.name}". 
            You can add it to this dashboard or switch to a dashboard that has chat enabled.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push(`/dashboard/${currentDashboard.id}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Chat to Dashboard
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Switch Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pass file reference to ChatContent if present in URL
  const fileId = searchParams?.get('fileId');
  const fileName = searchParams?.get('fileName');

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Use panel-based system with 94+ features including classification, governance, teams */}
      <ChatContent fileReference={fileId && fileName ? { fileId, fileName } : undefined} />
    </div>
  );
} 