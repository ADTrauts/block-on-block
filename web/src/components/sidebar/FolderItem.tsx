'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder, ChevronRight, ChevronDown, Edit2, Trash2, GripVertical } from 'lucide-react';
import type { SidebarFolder } from '../../types/sidebar';

interface FolderItemProps {
  folder: SidebarFolder;
  isDragging: boolean;
  onToggleCollapse: (folderId: string) => void;
  onRename: (folderId: string, newName: string) => void;
  onDelete: (folderId: string) => void;
  children?: React.ReactNode; // Modules inside folder
}

export function FolderItem({
  folder,
  isDragging,
  onToggleCollapse,
  onRename,
  onDelete,
  children,
}: FolderItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showActions, setShowActions] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `folder-${folder.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleRename = () => {
    if (editName.trim() && editName !== folder.name) {
      onRename(folder.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditName(folder.name);
      setIsEditing(false);
    }
  };

  const FolderIcon = folder.icon ? 
    (() => {
      // Map icon names to lucide-react icons (simplified - you may want a proper mapping)
      const iconMap: Record<string, React.ComponentType<any>> = {
        grid: Folder,
        users: Folder,
        messageSquare: Folder,
        briefcase: Folder,
        building: Folder,
      };
      return iconMap[folder.icon] || Folder;
    })() : Folder;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-2 border border-gray-200 rounded-lg bg-white"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center gap-2 p-2">
        {/* Drag Handle - stop propagation to prevent module drags when dragging folder */}
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical size={16} />
        </div>

        {/* Collapse/Expand Button */}
        <button
          onClick={() => onToggleCollapse(folder.id)}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label={folder.collapsed ? 'Expand folder' : 'Collapse folder'}
        >
          {folder.collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </button>

        {/* Folder Icon */}
        <FolderIcon size={18} className="text-gray-600" />

        {/* Folder Name */}
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 border border-blue-500 rounded text-sm"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium text-gray-700 cursor-pointer"
            onDoubleClick={() => setIsEditing(true)}
          >
            {folder.name}
          </span>
        )}

        {/* Actions */}
        {showActions && !isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
              aria-label="Rename folder"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onDelete(folder.id)}
              className="p-1 hover:bg-gray-100 rounded text-red-500 hover:text-red-700"
              aria-label="Delete folder"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Modules inside folder */}
      {!folder.collapsed && children && (
        <div className="pl-8 pr-2 pb-2 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

