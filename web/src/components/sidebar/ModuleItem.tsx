'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pin, PinOff } from 'lucide-react';
import type { ModuleConfig } from '../../config/modules';
import { LayoutDashboard, Folder, MessageSquare, Users, BarChart3, Brain, Calendar, CheckSquare } from 'lucide-react';

// Module icons mapping (mirrored from DashboardLayout)
const MODULE_ICONS: Record<string, React.ComponentType<any>> = {
  dashboard: LayoutDashboard,
  drive: Folder,
  chat: MessageSquare,
  members: Users,
  analytics: BarChart3,
  connections: Users,
  ai: Brain,
  calendar: Calendar,
  todo: CheckSquare,
};

interface ModuleItemProps {
  module: ModuleConfig;
  isDragging: boolean;
  isInFolder?: boolean;
  isAvailable?: boolean; // True if this is from the available modules list
  isPinned?: boolean; // True if module is pinned to right sidebar
  onTogglePin?: (moduleId: string) => void; // Callback to toggle pin state
}

export function ModuleItem({ 
  module, 
  isDragging, 
  isInFolder = false, 
  isAvailable = false,
  isPinned = false,
  onTogglePin
}: ModuleItemProps) {
  const sortableId = isAvailable ? `available-module-${module.id}` : `module-${module.id}`;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: sortableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = MODULE_ICONS[module.id] || LayoutDashboard;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded hover:bg-gray-50 ${
        isInFolder ? 'pl-4' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical size={14} />
      </div>

      {/* Module Icon */}
      <Icon size={18} className="text-gray-600" />

      {/* Module Name */}
      <span className="flex-1 text-sm text-gray-700">{module.name}</span>
      
      {/* Pin Button - only show if not from available modules list */}
      {!isAvailable && onTogglePin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(module.id);
          }}
          className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-blue-600 transition-colors"
          title={isPinned ? 'Unpin from right sidebar' : 'Pin to right sidebar'}
          aria-label={isPinned ? 'Unpin from right sidebar' : 'Pin to right sidebar'}
        >
          {isPinned ? (
            <Pin size={14} className="fill-blue-600 text-blue-600" />
          ) : (
            <PinOff size={14} />
          )}
        </button>
      )}
    </div>
  );
}

