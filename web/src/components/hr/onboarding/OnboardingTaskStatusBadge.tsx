'use client';

import React from 'react';
import { Badge } from 'shared/components';
import type { OnboardingTaskStatus } from '@/api/hrOnboarding';

interface OnboardingTaskStatusBadgeProps {
  status: OnboardingTaskStatus;
  className?: string;
}

const STATUS_CONFIG: Record<OnboardingTaskStatus, { color: 'gray' | 'blue' | 'red' | 'green'; label: string }> = {
  PENDING: { color: 'gray', label: 'Pending' },
  IN_PROGRESS: { color: 'blue', label: 'In Progress' },
  BLOCKED: { color: 'red', label: 'Blocked' },
  COMPLETED: { color: 'green', label: 'Completed' },
  CANCELLED: { color: 'gray', label: 'Cancelled' },
};

export default function OnboardingTaskStatusBadge({ status, className = '' }: OnboardingTaskStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge color={config.color} className={className}>
      {config.label}
    </Badge>
  );
}

