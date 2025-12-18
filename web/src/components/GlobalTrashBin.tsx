'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, ChevronUp, ChevronDown, RotateCcw, X, Maximize2, Minimize2 } from 'lucide-react';
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
  const [isPanelExpanded, setIsPanelExpanded] = useState(false); // Whether panel is in large/expanded mode
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelPosition, setPanelPosition] = useState<{ bottom: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Track when component is mounted for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update panel position when expanded
  useEffect(() => {
    if (isExpanded && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position panel above the button with spacing
      // Use bottom positioning so panel bottom aligns with button top
      const spacing = 8; // 8px gap between button and panel
      
      setPanelPosition({
        bottom: window.innerHeight - rect.top + spacing, // Distance from bottom of viewport
        right: window.innerWidth - rect.right + 40, // Move 32px left from button edge
      });
    } else {
      setPanelPosition(null);
    }
  }, [isExpanded]);

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
      case 'ai_conversation':
        return '🤖';
      case 'event':
        return '📅';
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

  // Group items by module
  const itemsByModule = React.useMemo(() => {
    const grouped: Record<string, TrashedItem[]> = {};
    trashedItems.forEach((item) => {
      const moduleKey = item.moduleId || 'other';
      if (!grouped[moduleKey]) {
        grouped[moduleKey] = [];
      }
      grouped[moduleKey].push(item);
    });
    
    // Sort items within each module by trashed date (most recent first)
    Object.keys(grouped).forEach((moduleKey) => {
      grouped[moduleKey].sort((a, b) => {
        const dateA = new Date(a.trashedAt).getTime();
        const dateB = new Date(b.trashedAt).getTime();
        return dateB - dateA;
      });
    });
    
    return grouped;
  }, [trashedItems]);

  // Auto-expand all modules when panel opens
  useEffect(() => {
    if (isExpanded && trashedItems.length > 0) {
      const allModules = new Set(Object.keys(itemsByModule));
      setExpandedModules(allModules);
    }
  }, [isExpanded, trashedItems.length, itemsByModule]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
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
        
        // Dispatch event for drive items so DriveModule can update immediately
        if (itemData.moduleId === 'drive') {
          window.dispatchEvent(new CustomEvent('driveItemTrashed', { 
            detail: itemData
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
        ref={buttonRef}
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

      {/* Expandable Panel - Rendered via Portal to ensure it's above everything */}
      {mounted && isExpanded && panelPosition && createPortal(
        <>
          {/* Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsExpanded(false)}
          />
          {/* Panel */}
          <div
            className={`fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] overflow-hidden transition-all duration-200 ${
              isPanelExpanded 
                ? 'w-[600px] max-h-[600px]' 
                : 'w-80 max-h-96'
            }`}
            style={{
              bottom: `${panelPosition.bottom}px`,
              right: `${panelPosition.right}px`,
            }}
          >
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPanelExpanded(!isPanelExpanded);
                }}
                className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                title={isPanelExpanded ? "Minimize" : "Expand"}
              >
                {isPanelExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
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
          <div className={`overflow-y-auto ${isPanelExpanded ? 'max-h-[520px]' : 'max-h-64'}`}>
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
                {Object.entries(itemsByModule).map(([moduleId, items]) => {
                  const moduleName = items[0]?.moduleName || moduleId;
                  const isModuleExpanded = expandedModules.has(moduleId);
                  const moduleItemCount = items.length;
                  
                  return (
                    <div key={moduleId} className="mb-2 last:mb-0">
                      {/* Module Header */}
                      <button
                        onClick={() => toggleModule(moduleId)}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {isModuleExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                          </span>
                          <span className="text-sm font-semibold text-gray-700">{moduleName}</span>
                          <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
                            {moduleItemCount}
                          </span>
                        </div>
                      </button>
                      
                      {/* Module Items */}
                      {isModuleExpanded && (
                        <div className="ml-4 mt-1 space-y-1">
                          {items.map((item) => (
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
                                  {formatDate(item.trashedAt)}
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
                  );
                })}
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
        </>,
        document.body
      )}
    </div>
  );
} 