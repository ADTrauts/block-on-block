'use client';

import React from 'react';
import {
  FileText,
  Package,
  GraduationCap,
  Calendar,
  Clipboard,
  CheckSquare,
} from 'lucide-react';
import type { OnboardingTaskType } from '@/api/hrOnboarding';

interface OnboardingTaskTypeIconProps {
  type: OnboardingTaskType;
  className?: string;
  size?: number;
}

const TYPE_ICONS: Record<OnboardingTaskType, React.ComponentType<any>> = {
  DOCUMENT: FileText,
  EQUIPMENT: Package,
  TRAINING: GraduationCap,
  MEETING: Calendar,
  FORM: Clipboard,
  CUSTOM: CheckSquare,
};

export default function OnboardingTaskTypeIcon({ type, className = '', size = 20 }: OnboardingTaskTypeIconProps) {
  const Icon = TYPE_ICONS[type] || CheckSquare;

  return <Icon className={className} size={size} />;
}

