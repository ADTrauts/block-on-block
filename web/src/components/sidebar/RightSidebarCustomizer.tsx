'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { LayoutDashboard, Brain, Puzzle, Trash2, Lock, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSidebarCustomization } from '../../contexts/SidebarCustomizationContext';
import type { RightSidebarConfig } from '../../types/sidebar';
import type { ModuleConfig } from '../../config/modules';
import { MODULE_ICONS } from '../../app/dashboard/DashboardLayout';

interface RightSidebarCustomizerProps {
  context: 'personal' | string; // 'personal' or businessId
  availableModules: ModuleConfig[];
}

// Fixed module IDs that cannot be moved
const FIXED_TOP_MODULES = ['dashboard'];
const FIXED_BOTTOM_MODULES = ['ai', 'modules', 'trash'];

export function RightSidebarCustomizer({
  context,
  availableModules,
}: RightSidebarCustomizerProps) {
  const { config, updateConfig, getConfigForContext } = useSidebarCustomization();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Get or create config for this context
  const rightConfig: RightSidebarConfig = useMemo(() => {
    const existing = getConfigForContext(context);
    if (existing) return existing;

    // Create default config
    const defaultPinned = availableModules
      .filter(m => !FIXED_TOP_MODULES.includes(m.id) && !FIXED_BOTTOM_MODULES.includes(m.id))
      .slice(0, 6) // Limit to 6 default pinned modules
      .map((m, idx) => ({ id: m.id, order: idx }));

    return {
      context,
      pinnedModules: defaultPinned,
    };
  }, [context, getConfigForContext, availableModules]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Only allow dragging within pinned modules section
    if (!activeId.startsWith('pinned-module-') || !overId.startsWith('pinned-module-')) {
      return;
    }

    const activeModuleId = activeId.replace('pinned-module-', '');
    const overModuleId = overId.replace('pinned-module-', '');

    updateConfig((current) => {
      const rightConfig = current.rightSidebar[context] || {
        context,
        pinnedModules: [],
      };

      const moduleIndex = rightConfig.pinnedModules.findIndex(m => m.id === activeModuleId);
      const overIndex = rightConfig.pinnedModules.findIndex(m => m.id === overModuleId);

      if (moduleIndex !== -1 && overIndex !== -1) {
        const newPinnedModules = arrayMove(rightConfig.pinnedModules, moduleIndex, overIndex);
        newPinnedModules.forEach((m, idx) => {
          m.order = idx;
        });

        return {
          ...current,
          rightSidebar: {
            ...current.rightSidebar,
            [context]: {
              ...rightConfig,
              pinnedModules: newPinnedModules,
            },
          },
        };
      }

      return current;
    });
  };

  const handleRemoveModule = useCallback((moduleId: string) => {
    updateConfig((current) => {
      const rightConfig = current.rightSidebar[context] || {
        context,
        pinnedModules: [],
      };

      // Fix: Only remove the specific module, not all modules
      const newPinnedModules = rightConfig.pinnedModules
        .filter(m => m.id !== moduleId) // Only filter out the specific module
        .map((m, idx) => ({ ...m, order: idx })); // Re-order after removal

      return {
        ...current,
        rightSidebar: {
          ...current.rightSidebar,
          [context]: {
            ...rightConfig,
            pinnedModules: newPinnedModules,
          },
        },
      };
    });
  }, [context, updateConfig]);

  // Get module details
  const getModuleDetails = (moduleId: string): ModuleConfig | undefined => {
    return availableModules.find(m => m.id === moduleId);
  };

  // Sort pinned modules by order
  const sortedPinnedModules = [...rightConfig.pinnedModules].sort((a, b) => a.order - b.order);

  // Get all pinned module IDs for sortable context
  const pinnedModuleSortableIds = sortedPinnedModules.map(m => `pinned-module-${m.id}`);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Fixed Top Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Lock size={12} />
            <span>Fixed (Top)</span>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              <LayoutDashboard size={18} className="text-gray-600" />
              <span className="text-sm text-gray-700">Dashboard</span>
            </div>
          </div>
        </div>

        {/* Customizable Pinned Modules Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Pinned Modules (Customizable)</span>
            </div>
          </div>
          <SortableContext items={pinnedModuleSortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 p-3 border-2 border-dashed border-gray-200 rounded-lg min-h-[200px]">
              {sortedPinnedModules.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No pinned modules. Pin modules from the left sidebar customizer.
                </div>
              ) : (
                sortedPinnedModules.map((moduleRef) => {
                  const module = getModuleDetails(moduleRef.id);
                  if (!module) return null;
                  return (
                    <PinnedModuleItem
                      key={moduleRef.id}
                      module={module}
                      isDragging={draggingId === `pinned-module-${moduleRef.id}`}
                      onRemove={() => handleRemoveModule(moduleRef.id)}
                    />
                  );
                })
              )}
            </div>
          </SortableContext>
        </div>

        {/* Fixed Bottom Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Lock size={12} />
            <span>Fixed (Bottom)</span>
          </div>
          <div className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              <Brain size={18} className="text-gray-600" />
              <span className="text-sm text-gray-700">AI Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              <Puzzle size={18} className="text-gray-600" />
              <span className="text-sm text-gray-700">Modules</span>
            </div>
            <div className="flex items-center gap-2">
              <Trash2 size={18} className="text-gray-600" />
              <span className="text-sm text-gray-700">Trash</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          💡 Drag pinned modules to reorder. Pin modules from the left sidebar customizer.
        </p>
      </div>

      {/* Drag Overlay - shows shadow/ghost image while dragging */}
      <DragOverlay>
        {draggingId ? (
          (() => {
            const moduleId = draggingId.replace('pinned-module-', '');
            const module = getModuleDetails(moduleId);
            if (!module) return null;
            const Icon = MODULE_ICONS[module.id as keyof typeof MODULE_ICONS] || LayoutDashboard;
            return (
              <div className="bg-white border-2 border-blue-400 rounded-lg p-3 shadow-xl opacity-95 flex items-center gap-2 rotate-2">
                <Icon size={18} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">{module.name}</span>
              </div>
            );
          })()
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Pinned module item component (draggable)
function PinnedModuleItem({
  module,
  isDragging,
  onRemove,
}: {
  module: ModuleConfig;
  isDragging: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `pinned-module-${module.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = MODULE_ICONS[module.id as keyof typeof MODULE_ICONS] || LayoutDashboard;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border border-gray-200 rounded bg-white hover:bg-gray-50"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical size={14} />
      </div>
      <Icon size={18} className="text-gray-600" />
      <span className="flex-1 text-sm text-gray-700">{module.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-red-500 hover:text-red-700 text-xs px-2"
        aria-label="Remove module"
      >
        ×
      </button>
    </div>
  );
}
