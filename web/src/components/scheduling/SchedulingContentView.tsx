'use client';

import React from 'react';
import SchedulingDashboard from './SchedulingDashboard';
import SchedulingAdminContent from './SchedulingAdminContent';
import SchedulingTeamContent from './SchedulingTeamContent';
import SchedulingEmployeeContent from './SchedulingEmployeeContent';

interface SchedulingContentViewProps {
  view: string;
  businessId: string;
  userRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  onCreateSchedule?: () => void;
  onRequestSwap?: () => void;
  onSetAvailability?: () => void;
  onViewChange?: (view: string) => void;
  onEditingTemplateChange?: (isEditing: boolean) => void;
}

export default function SchedulingContentView({
  view,
  businessId,
  userRole,
  onCreateSchedule,
  onRequestSwap,
  onSetAvailability,
  onViewChange,
  onEditingTemplateChange,
}: SchedulingContentViewProps) {
  // Dashboard is the default view
  if (view === 'dashboard' || !view) {
    return (
      <SchedulingDashboard
        businessId={businessId}
        userRole={userRole}
        onCreateSchedule={onCreateSchedule}
        onRequestSwap={onRequestSwap}
        onSetAvailability={onSetAvailability}
      />
    );
  }

  // Admin views
  if (userRole === 'ADMIN') {
    if (view === 'builder' || view === 'templates' || view === 'analytics' || view === 'settings') {
      return (
        <SchedulingAdminContent
          businessId={businessId}
          view={view}
          onViewChange={onViewChange}
          onEditingTemplateChange={onEditingTemplateChange}
        />
      );
    }
    if (view === 'team' || view === 'swaps') {
      return (
        <SchedulingTeamContent
          businessId={businessId}
          view={view}
        />
      );
    }
    if (view === 'my-schedule' || view === 'availability' || view === 'shift-swaps' || view === 'open-shifts') {
      return (
        <SchedulingEmployeeContent
          businessId={businessId}
          view={view}
        />
      );
    }
  }

  // Manager views
  if (userRole === 'MANAGER') {
    if (view === 'team' || view === 'swaps') {
      return (
        <SchedulingTeamContent
          businessId={businessId}
          view={view}
        />
      );
    }
    if (view === 'my-schedule' || view === 'availability' || view === 'shift-swaps' || view === 'open-shifts') {
      return (
        <SchedulingEmployeeContent
          businessId={businessId}
          view={view}
        />
      );
    }
  }

  // Employee views
  if (userRole === 'EMPLOYEE') {
    if (view === 'my-schedule' || view === 'availability' || view === 'shift-swaps' || view === 'open-shifts') {
      return (
        <SchedulingEmployeeContent
          businessId={businessId}
          view={view}
        />
      );
    }
  }

  // Fallback to dashboard
  return (
    <SchedulingDashboard
      businessId={businessId}
      userRole={userRole}
      onCreateSchedule={onCreateSchedule}
      onRequestSwap={onRequestSwap}
      onSetAvailability={onSetAvailability}
    />
  );
}

