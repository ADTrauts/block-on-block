'use client';

import React from 'react';

interface OnboardingProgressBarProps {
  completed: number;
  total: number;
  showCount?: boolean;
  className?: string;
}

export default function OnboardingProgressBar({
  completed,
  total,
  showCount = true,
  className = '',
}: OnboardingProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      {showCount && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 font-medium">
            {completed} of {total} tasks completed
          </span>
          <span className="text-gray-600 font-semibold">{percentage}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percentage}% complete`}
        />
      </div>
    </div>
  );
}

