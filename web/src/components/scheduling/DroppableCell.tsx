'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ScheduleShift } from '@/api/scheduling';

interface DroppableCellProps {
  id: string;
  rowId: string;
  day: Date;
  isOver?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DroppableCell({ id, rowId, day, isOver, children, className = '', ...props }: DroppableCellProps & React.HTMLAttributes<HTMLDivElement>) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id,
    data: {
      type: 'cell',
      rowId,
      day,
    },
  });

  const isHighlighted = isOver || isDroppableOver;

  return (
    <div
      ref={setNodeRef}
      className={`relative border-r border-gray-200 ${isHighlighted ? 'bg-blue-50 ring-2 ring-blue-400' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

