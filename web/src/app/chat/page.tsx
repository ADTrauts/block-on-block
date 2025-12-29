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
      // Chat is always available - no need to check for widgets
      // If dashboard parameter is provided, ensure we're in the right context
      const targetDashboard = allDashboards.find(d => d.id === dashboardParam);
      if (targetDashboard && currentDashboardId !== dashboardParam) {
        // We're in the right context, no need to redirect
        return;
      }
    } else if (allDashboards.length > 0 && !currentDashboardId) {
      // No dashboard specified, use first available dashboard (chat is always available)
      const firstDashboard = allDashboards[0];
      if (firstDashboard) {
        router.replace(`/chat?dashboard=${firstDashboard.id}`);
        return;
      } else {
        // No dashboards available, redirect to dashboard management
        router.replace('/dashboard');
        return;
      }
    } else if (allDashboards.length === 0) {
      // No dashboards available, redirect to dashboard creation
      router.replace('/dashboard');
      return;
    }
  }, [searchParams, currentDashboardId, allDashboards, loading, router]);

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

  // Chat is always available - no need to check for widgets

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