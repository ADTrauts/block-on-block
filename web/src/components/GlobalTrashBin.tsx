'use client';

import React, { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown, RotateCcw, X } from 'lucide-react';
import { useGlobalTrash, TrashedItem } from '../contexts/GlobalTrashContext';
import { useDroppable } from '@dnd-kit/core';
import { toast } from 'react-hot-toast';

interface GlobalTrashBinProps {
  className?: string;
  onItemTrashed?: (item: TrashedItem) => void;
}

export default function GlobalTrashBin({ className = '', onItemTrashed }: GlobalTrashBinProps) {
  const { trashedItems, itemCount, loading, restoreItem, deleteItem, emptyTrash, trashItem } = useGlobalTrash();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const { setNodeRef } = useDroppable({
    id: 'global-trash-bin',
    disabled: false,
  });

  const handleRestore = async (item: TrashedItem) => {
    try {
      await restoreItem(item.id);
      toast.success(`${item.name} restored successfully`);
    } catch (error) {
      toast.error('Failed to restore item');
    }
  };

  const handleDelete = async (item: TrashedItem) => {
    try {
      await deleteItem(item.id);
      toast.success(`${item.name} deleted permanently`);
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const handleEmptyTrash = async () => {
    if (itemCount === 0) return;
    
    if (!confirm(`Are you sure you want to permanently delete all ${itemCount} items?`)) {
      return;
    }

    try {
      await emptyTrash();
      toast.success('Trash emptied successfully');
    } catch (error) {
      toast.error('Failed to empty trash');
    }
  };

  const getItemIcon = (type: TrashedItem['type']) => {
    switch (type) {
      case 'file':
        return '📄';
      case 'folder':
        return '📁';
      case 'conversation':
        return '💬';
      case 'dashboard_tab':
        return '📊';
      case 'module':
        return '🧩';
      case 'message':
        return '💭';
      default:
        return '📄';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Handle native HTML5 drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    try {
      const trashItemData = e.dataTransfer.getData('application/json');
      if (trashItemData) {
        const itemData = JSON.parse(trashItemData);
        
        // Check if this is a schedule (schedules don't use trash API, they're hard-deleted)
        if (itemData.type === 'module' && itemData.moduleId === 'scheduling' && itemData.metadata?.scheduleId) {
          // Dispatch event for schedule trashing (handled by scheduling component)
          window.dispatchEvent(new CustomEvent('scheduleTrashed', { 
            detail: { ...itemData, scheduleId: itemData.metadata.scheduleId }
          }));
          toast.success(`${itemData.name} will be deleted`);
          return;
        }
        
        // For other item types, use the trash API
        await trashItem(itemData);
        toast.success(`${itemData.name} moved to trash`);
        
        // Notify parent component that an item was trashed
        if (onItemTrashed) {
          onItemTrashed(itemData);
        }
        
        // Dispatch custom events for specific item types
        if (itemData.type === 'message') {
          window.dispatchEvent(new CustomEvent('messageTrashed', { 
            detail: { messageId: itemData.id, conversationId: itemData.metadata?.conversationId }
          }));
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      toast.error('Failed to move item to trash');
    }
  };

  return (
    <div 
      ref={setNodeRef}
      className={`relative ${className}`}
      onDragEnter={() => setIsDraggingOver(true)}
      onDragLeave={() => setIsDraggingOver(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Main Trash Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          relative w-10 h-10 rounded-lg transition-all duration-200 flex items-center justify-center
          ${isDraggingOver 
            ? 'bg-red-100 border-2 border-red-400 scale-110' 
            : 'bg-gray-700 hover:bg-gray-600'
          }
          ${itemCount > 0 ? 'text-red-400' : 'text-gray-300'}
        `}
        title={`Trash (${itemCount} items)`}
      >
        <Trash2 size={20} />
        
        {/* Item Count Badge */}
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
        
        {/* Drag Over Indicator */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-red-500 bg-opacity-20 rounded-lg animate-pulse" />
        )}
      </button>

      {/* Expandable Panel */}
      {isExpanded && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <Trash2 size={16} className="text-gray-600" />
              <h3 className="font-medium text-gray-900">Trash</h3>
              {itemCount > 0 && (
                <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                  {itemCount} items
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {itemCount > 0 && (
                <button
                  onClick={handleEmptyTrash}
                  className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                  title="Empty trash"
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                Loading...
              </div>
            ) : itemCount === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Trash2 size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Trash is empty</p>
                <p className="text-xs text-gray-400 mt-1">
                  Drag items here to trash them
                </p>
              </div>
            ) : (
              <div className="p-2">
                {trashedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    {/* Item Icon */}
                    <span className="text-lg">{getItemIcon(item.type)}</span>
                    
                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.moduleName} • {formatDate(item.trashedAt)}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRestore(item)}
                        className="p-1 text-gray-500 hover:text-green-600 transition-colors"
                        title="Restore"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                        title="Delete permanently"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {itemCount > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Items will be permanently deleted after 30 days
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 