'use client';

import React from 'react';
import { TodoModule } from '@/components/todo/TodoModule';
import { useDashboard } from '@/contexts/DashboardContext';

export default function TodoPage() {
  const { currentDashboardId } = useDashboard();

  return (
    <div className="flex flex-col h-full">
      <TodoModule dashboardId={currentDashboardId} />
    </div>
  );
}

