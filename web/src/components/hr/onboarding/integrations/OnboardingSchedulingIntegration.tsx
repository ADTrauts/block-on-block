'use client';

import React from 'react';
import { Alert, Badge } from 'shared/components';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useModuleIntegration } from '@/hooks/useModuleIntegration';

interface OnboardingSchedulingIntegrationProps {
  businessId: string;
  employeePositionId?: string;
  startDate?: string;
  endDate?: string;
  className?: string;
}

/**
 * Component to show scheduling integration status
 * Note: Scheduling module requires HR module to be installed
 */
export default function OnboardingSchedulingIntegration({
  businessId,
  employeePositionId,
  startDate,
  endDate,
  className = '',
}: OnboardingSchedulingIntegrationProps) {
  const { hasScheduling, loading: moduleLoading } = useModuleIntegration(businessId);

  if (moduleLoading) {
    return null;
  }

  if (!hasScheduling) {
    return (
      <Alert type="info" title="Scheduling module not installed" className={className}>
        <p className="text-sm text-gray-600">
          Install the Scheduling module to sync time-off requests and check employee availability during onboarding.
        </p>
      </Alert>
    );
  }

  // Show scheduling sync status
  return (
    <div className={`flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
      <CalendarIcon className="w-4 h-4 text-blue-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">Scheduling Sync Active</p>
        <p className="text-xs text-blue-700">
          Time-off requests will automatically sync with the scheduling calendar.
        </p>
      </div>
      <Badge color="blue" size="sm">
        Synced
      </Badge>
    </div>
  );
}

