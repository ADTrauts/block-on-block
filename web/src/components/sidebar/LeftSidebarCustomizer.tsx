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
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Plus, Folder, LayoutDashboard, MessageSquare, Users, BarChart3, Brain, Calendar as CalendarIcon, CheckSquare } from 'lucide-react';
import { Button } from 'shared/components';
import { FolderItem } from './FolderItem';
import { ModuleItem } from './ModuleItem';
import { useSidebarCustomization } from '../../contexts/SidebarCustomizationContext';
import type { LeftSidebarConfig, SidebarFolder } from '../../types/sidebar';
import type { ModuleConfig } from '../../config/modules';

// Module icons mapping (same as DashboardLayout)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODULE_ICONS: Record<string, React.ComponentType<any>> = {
  dashboard: LayoutDashboard,
  drive: Folder,
  chat: MessageSquare,
  members: Users,
  analytics: BarChart3,
  connections: Users,
  ai: Brain,
  calendar: CalendarIcon,
  todo: CheckSquare,
  hr: Users, // Add more as needed
  scheduling: CalendarIcon,
  admin: Users,
  modules: Users,
};

interface LeftSidebarCustomizerProps {
  dashboardTabId: string;
  availableModules: ModuleConfig[];
  context: 'personal' | string; // 'personal' or businessId
}

export function LeftSidebarCustomizer({
  dashboardTabId,
  availableModules,
  context,
}: LeftSidebarCustomizerProps) {
  const { config, updateConfig, getConfigForTab, getConfigForContext } = useSidebarCustomization();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Get or create config for this tab
  const tabConfig: LeftSidebarConfig = useMemo(() => {
    const existing = getConfigForTab(dashboardTabId);
    if (existing) return existing;

    // Create default config
    const defaultFolders: SidebarFolder[] = context === 'personal'
      ? [
          {
            id: 'core-apps',
            name: 'Core Apps',
            icon: 'grid',
            modules: [
              { id: 'drive', order: 0 },
              { id: 'chat', order: 1 },
              { id: 'calendar', order: 2 },
            ],
            collapsed: false,
            order: 0,
          },
        ]
      : [
          {
            id: 'communication',
            name: 'Communication',
            icon: 'message-square',
            modules: [
              { id: 'chat', order: 0 },
              { id: 'calendar', order: 1 },
            ],
            collapsed: false,
            order: 0,
          },
        ];

    // Get modules not in folders, ensuring dashboard is first
    const modulesNotInFolders = availableModules.filter(m => !defaultFolders.some(f => f.modules.some(fm => fm.id === m.id)));
    
    // Separate dashboard and other modules
    const dashboardModule = modulesNotInFolders.find(m => m.id === 'dashboard');
    const otherModules = modulesNotInFolders.filter(m => m.id !== 'dashboard');
    
    // Build loose modules with dashboard first
    const looseModules = [];
    if (dashboardModule) {
      looseModules.push({ id: dashboardModule.id, order: 0 });
    }
    otherModules.forEach((m, idx) => {
      looseModules.push({ id: m.id, order: idx + 1 });
    });

    return {
      folders: defaultFolders,
      looseModules,
    };
  }, [dashboardTabId, getConfigForTab, context, availableModules]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine what's being dragged
    const isModule = activeId.startsWith('module-');
    const isAvailableModule = activeId.startsWith('available-module-');
    const moduleId = isModule 
      ? activeId.replace('module-', '') 
      : isAvailableModule 
        ? activeId.replace('available-module-', '') 
        : null;
    const isFolder = activeId.startsWith('folder-');
    const folderId = isFolder ? activeId.replace('folder-', '') : null;

    // Determine drop target
    const isDroppingOnFolder = overId.startsWith('folder-drop-');
    const targetFolderId = isDroppingOnFolder ? overId.replace('folder-drop-', '') : null;
    const isDroppingOnLoose = overId === 'loose-modules' || overId.startsWith('loose-module-drop-');

    updateConfig((current) => {
      const tabConfig = current.leftSidebar[dashboardTabId] || {
        folders: [],
        looseModules: [],
      };

      // Handle folder reordering - MUST be handled first and return early to prevent module handling
      if (isFolder) {
        // Check if dropping on another folder (for reordering)
        if (overId.startsWith('folder-')) {
          const folderIndex = tabConfig.folders.findIndex(f => f.id === folderId);
          const overFolderId = overId.replace('folder-', '');
          const overFolderIndex = tabConfig.folders.findIndex(f => f.id === overFolderId);
          
          if (folderIndex !== -1 && overFolderIndex !== -1 && folderIndex !== overFolderIndex) {
            // Create a deep copy of folders to preserve modules inside
            const foldersCopy = tabConfig.folders.map(f => ({
              ...f,
              modules: f.modules.map(m => ({ ...m })), // Deep copy modules
            }));
            const newFolders = arrayMove(foldersCopy, folderIndex, overFolderIndex);
            newFolders.forEach((f, idx) => {
              f.order = idx;
            });
            return {
              ...current,
              leftSidebar: {
                ...current.leftSidebar,
                [dashboardTabId]: {
                  folders: newFolders,
                  looseModules: [...tabConfig.looseModules], // Preserve loose modules
                },
              },
            };
          }
        }
        // If dropping on anything else (module, drop zone, etc.), don't do anything
        // Folders can only be reordered by dropping on other folders
        return current;
      }

      // Handle module movement (including adding new modules from available list)
      if ((isModule || isAvailableModule) && moduleId) {
        // Find where the module currently is
        const sourceFolder = tabConfig.folders.find(f => f.modules.some(m => m.id === moduleId));
        const isInLooseModules = tabConfig.looseModules.some(m => m.id === moduleId);
        
        console.log('[Drag] Module movement:', {
          moduleId,
          sourceFolder: sourceFolder?.id,
          isInLooseModules,
          overId,
          isDroppingOnLoose,
          targetFolderId
        });
        
        // Remove module from current location
        let newFolders = tabConfig.folders.map(folder => ({
          ...folder,
          modules: folder.modules.filter(m => m.id !== moduleId),
        }));
        let newLooseModules = tabConfig.looseModules.filter(m => m.id !== moduleId);

        // Determine where to move the module
        // Priority 1: Dropping on folder drop zone (move into folder)
        if (targetFolderId) {
          console.log('[Drag] Priority 1: Moving to folder:', targetFolderId);
          const targetFolder = newFolders.find(f => f.id === targetFolderId);
          if (targetFolder) {
            // Check if dropping on a module inside the folder (for positioning)
            const overModuleId = overId.startsWith('module-') ? overId.replace('module-', '') : null;
            if (overModuleId && targetFolder.modules.some(m => m.id === overModuleId)) {
              // Insert at specific position
              const overIndex = targetFolder.modules.findIndex(m => m.id === overModuleId);
              targetFolder.modules.splice(overIndex, 0, { id: moduleId, order: overIndex });
            } else {
              // Add to end
              targetFolder.modules.push({ id: moduleId, order: targetFolder.modules.length });
            }
            targetFolder.modules.forEach((m, idx) => {
              m.order = idx;
            });
          }
        }
        // Priority 2: Dropping on a folder itself (place loose module before the folder)
        else if (overId.startsWith('folder-') && !overId.startsWith('folder-drop-')) {
          // Dropping a module on a folder (not the drop zone) - place it as loose module before the folder
          const overFolderId = overId.replace('folder-', '');
          const targetFolder = tabConfig.folders.find(f => f.id === overFolderId);
          if (targetFolder) {
            // Calculate position: place before this folder
            // Use folder's order with a fractional offset to ensure it renders before
            const folderOrder = targetFolder.order;
            // Set order to be just before the folder (folderOrder - 0.1)
            const insertOrder = Math.max(-1, folderOrder - 0.1);
            newLooseModules.push({ id: moduleId, order: insertOrder });
          }
        }
        // Priority 3: Dropping on a module inside a folder (move to that folder)
        else if (overId.startsWith('module-')) {
          const overModuleId = overId.replace('module-', '');
          const targetFolder = newFolders.find(f => f.modules.some(m => m.id === overModuleId));
          
          if (targetFolder) {
            // Moving to a folder (dropping on a module inside it)
            const overIndex = targetFolder.modules.findIndex(m => m.id === overModuleId);
            targetFolder.modules.splice(overIndex, 0, { id: moduleId, order: overIndex });
            targetFolder.modules.forEach((m, idx) => {
              m.order = idx;
            });
          }
          // Priority 4: Reordering within same container (folder or loose)
          else if (sourceFolder) {
            // Reordering within folder
            const moduleIndex = sourceFolder.modules.findIndex(m => m.id === moduleId);
            const overModuleIndex = sourceFolder.modules.findIndex(m => m.id === overModuleId);
            if (moduleIndex !== -1 && overModuleIndex !== -1 && moduleIndex !== overModuleIndex) {
              const newModules = arrayMove(sourceFolder.modules, moduleIndex, overModuleIndex);
              newModules.forEach((m, idx) => {
                m.order = idx;
              });
              const folderToUpdate = newFolders.find(f => f.id === sourceFolder.id);
              if (folderToUpdate) {
                folderToUpdate.modules = newModules;
              }
            }
          } else {
            // Dropping on another loose module - reorder or place between folders
            const overIsLoose = tabConfig.looseModules.some(m => m.id === overModuleId);
            if (overIsLoose) {
              // Reordering within loose modules
              const moduleIndex = tabConfig.looseModules.findIndex(m => m.id === moduleId);
              const overModuleIndex = tabConfig.looseModules.findIndex(m => m.id === overModuleId);
              if (moduleIndex !== -1 && overModuleIndex !== -1 && moduleIndex !== overModuleIndex) {
                newLooseModules = arrayMove(tabConfig.looseModules, moduleIndex, overModuleIndex);
              } else {
                // Module not in loose modules yet (coming from folder) - add it at the target position
                const overModule = tabConfig.looseModules.find(m => m.id === overModuleId);
                if (overModule) {
                  const insertIndex = tabConfig.looseModules.findIndex(m => m.id === overModuleId);
                  newLooseModules.splice(insertIndex, 0, { id: moduleId, order: overModule.order });
                } else {
                  newLooseModules.push({ id: moduleId, order: newLooseModules.length });
                }
              }
            } else {
              // Dropping on a folder's module - move to loose modules at a position before that folder
              const folderWithModule = tabConfig.folders.find(f => f.modules.some(m => m.id === overModuleId));
              if (folderWithModule) {
                const folderOrder = folderWithModule.order;
                newLooseModules.push({ id: moduleId, order: Math.max(-1, folderOrder - 0.1) });
              } else {
                // Fallback: add to end
                newLooseModules.push({ id: moduleId, order: newLooseModules.length });
              }
            }
          }
        }
        // Priority 5: Dropping on loose modules drop zone (general area - makes module loose)
        else if (isDroppingOnLoose) {
          console.log('[Drag] Priority 5: Dropping on loose modules drop zone');
          // If dropping on a specific loose module drop zone, place it at that position
          if (overId.startsWith('loose-module-drop-')) {
            const targetModuleId = overId.replace('loose-module-drop-', '');
            const targetModule = tabConfig.looseModules.find(m => m.id === targetModuleId);
            if (targetModule) {
              const insertIndex = tabConfig.looseModules.findIndex(m => m.id === targetModuleId);
              newLooseModules.splice(insertIndex, 0, { id: moduleId, order: targetModule.order });
              console.log('[Drag] Inserted at position of module:', targetModuleId);
            } else {
              // Add at the beginning (after dashboard if it exists)
              const dashboardIndex = newLooseModules.findIndex(m => m.id === 'dashboard');
              if (dashboardIndex >= 0) {
                newLooseModules.splice(dashboardIndex + 1, 0, { id: moduleId, order: 0 });
              } else {
                newLooseModules.unshift({ id: moduleId, order: 0 });
              }
              console.log('[Drag] Added to beginning of loose modules');
            }
          } else {
            // Dropping on the general loose modules area - add at the beginning (after dashboard)
            console.log('[Drag] Dropping on general loose modules area');
            const dashboardIndex = newLooseModules.findIndex(m => m.id === 'dashboard');
            if (dashboardIndex >= 0) {
              newLooseModules.splice(dashboardIndex + 1, 0, { id: moduleId, order: 0 });
            } else {
              newLooseModules.unshift({ id: moduleId, order: 0 });
            }
            console.log('[Drag] Added to loose modules at position:', dashboardIndex >= 0 ? dashboardIndex + 1 : 0);
          }
        }
        // If none of the above, add to loose modules (safety fallback)
        else {
          newLooseModules.push({ id: moduleId, order: newLooseModules.length });
        }
        
        // Ensure dashboard is always first in loose modules (if it exists)
        const dashboardIndex = newLooseModules.findIndex(m => m.id === 'dashboard');
        if (dashboardIndex >= 0) {
          const dashboard = newLooseModules.splice(dashboardIndex, 1)[0];
          newLooseModules.unshift(dashboard);
        }
        
        // Reorder loose modules (dashboard gets -1, others get sequential orders starting from 0)
        newLooseModules.forEach((m, idx) => {
          if (m.id === 'dashboard') {
            m.order = -1; // Dashboard always at -1 to ensure it's first
          } else {
            // For other modules, use their current order if it's valid, otherwise assign sequential
            // This preserves positions between folders
            if (m.order < 0 && m.id !== 'dashboard') {
              m.order = idx;
            }
          }
        });

        return {
          ...current,
          leftSidebar: {
            ...current.leftSidebar,
            [dashboardTabId]: {
              folders: newFolders,
              looseModules: newLooseModules,
            },
          },
        };
      }

      return current;
    });
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;

    updateConfig((current) => {
      const tabConfig = current.leftSidebar[dashboardTabId] || {
        folders: [],
        looseModules: [],
      };

      const newFolder: SidebarFolder = {
        id: `folder-${Date.now()}`,
        name: newFolderName.trim(),
        icon: 'folder',
        modules: [],
        collapsed: false,
        order: tabConfig.folders.length,
      };

      return {
        ...current,
        leftSidebar: {
          ...current.leftSidebar,
          [dashboardTabId]: {
            ...tabConfig,
            folders: [...tabConfig.folders, newFolder],
          },
        },
      };
    });

    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const handleToggleCollapse = (folderId: string) => {
    updateConfig((current) => {
      const tabConfig = current.leftSidebar[dashboardTabId] || {
        folders: [],
        looseModules: [],
      };

      return {
        ...current,
        leftSidebar: {
          ...current.leftSidebar,
          [dashboardTabId]: {
            ...tabConfig,
            folders: tabConfig.folders.map(f =>
              f.id === folderId ? { ...f, collapsed: !f.collapsed } : f
            ),
          },
        },
      };
    });
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    updateConfig((current) => {
      const tabConfig = current.leftSidebar[dashboardTabId] || {
        folders: [],
        looseModules: [],
      };

      return {
        ...current,
        leftSidebar: {
          ...current.leftSidebar,
          [dashboardTabId]: {
            ...tabConfig,
            folders: tabConfig.folders.map(f =>
              f.id === folderId ? { ...f, name: newName } : f
            ),
          },
        },
      };
    });
  };

  const handleDeleteFolder = (folderId: string) => {
    if (!confirm('Delete this folder? Modules inside will be moved to loose modules.')) {
      return;
    }

    updateConfig((current) => {
      const tabConfig = current.leftSidebar[dashboardTabId] || {
        folders: [],
        looseModules: [],
      };

      const folderToDelete = tabConfig.folders.find(f => f.id === folderId);
      if (!folderToDelete) return current;

      // Move modules from folder to loose modules
      const modulesToMove = folderToDelete.modules.map(m => ({
        id: m.id,
        order: tabConfig.looseModules.length + m.order,
      }));

      return {
        ...current,
        leftSidebar: {
          ...current.leftSidebar,
          [dashboardTabId]: {
            folders: tabConfig.folders
              .filter(f => f.id !== folderId)
              .map((f, idx) => ({ ...f, order: idx })),
            looseModules: [...tabConfig.looseModules, ...modulesToMove]
              .sort((a, b) => a.order - b.order)
              .map((m, idx) => ({ ...m, order: idx })),
          },
        },
      };
    });
  };

  // Get module details for display
  const getModuleDetails = (moduleId: string): ModuleConfig | undefined => {
    return availableModules.find(m => m.id === moduleId);
  };

  // Get right sidebar config to check pin state
  const rightSidebarConfig = getConfigForContext(context);
  const pinnedModuleIds = useMemo(() => {
    return new Set(rightSidebarConfig?.pinnedModules.map(m => m.id) || []);
  }, [rightSidebarConfig, getConfigForContext]);

  // Check if a module is pinned
  const isModulePinned = useCallback((moduleId: string): boolean => {
    return pinnedModuleIds.has(moduleId);
  }, [pinnedModuleIds]);

  // Handle pin/unpin toggle
  const handleTogglePin = useCallback((moduleId: string) => {
    updateConfig((current) => {
      const rightConfig = current.rightSidebar[context] || {
        context,
        pinnedModules: [],
      };

      const isPinned = rightConfig.pinnedModules.some(m => m.id === moduleId);

      if (isPinned) {
        // Unpin: remove from right sidebar
        const newPinnedModules = rightConfig.pinnedModules
          .filter(m => m.id !== moduleId)
          .map((m, idx) => ({ ...m, order: idx }));
        
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
      } else {
        // Pin: add to right sidebar
        const newPinnedModule = {
          id: moduleId,
          order: rightConfig.pinnedModules.length,
        };
        
        return {
          ...current,
          rightSidebar: {
            ...current.rightSidebar,
            [context]: {
              ...rightConfig,
              pinnedModules: [...rightConfig.pinnedModules, newPinnedModule],
            },
          },
        };
      }
    });
  }, [context, updateConfig]);

  // Sort folders and modules by order
  const sortedFolders = [...tabConfig.folders].sort((a, b) => a.order - b.order);
  
  // Sort loose modules, ensuring dashboard is always first
  const sortedLooseModules = [...tabConfig.looseModules].sort((a, b) => {
    // Dashboard always comes first
    if (a.id === 'dashboard') return -1;
    if (b.id === 'dashboard') return 1;
    // Then sort by order
    return a.order - b.order;
  });

  // Get modules that are in the config
  const modulesInConfig = new Set([
    ...sortedFolders.flatMap(f => f.modules.map(m => m.id)),
    ...sortedLooseModules.map(m => m.id),
  ]);

  // Get available modules (not yet in config)
  const availableModulesList = availableModules.filter(m => !modulesInConfig.has(m.id));

  // Get all module IDs for sortable context (including available modules)
  // Loose modules can be placed between folders, so include them in the main sortable context
  const allModuleIds = [
    ...sortedFolders.flatMap(f => f.modules.map(m => `module-${m.id}`)),
    ...sortedLooseModules.map(m => `module-${m.id}`),
    ...availableModulesList.map(m => `available-module-${m.id}`),
  ];
  const allFolderIds = sortedFolders.map(f => `folder-${f.id}`);
  
  // Combined list for interleaving folders and loose modules
  // We'll use a simple approach: loose modules can be placed before/after folders based on their order
  // For now, we'll render folders first, then loose modules, but allow dragging between them

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Left Sidebar</h3>
          {!showNewFolderInput && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewFolderInput(true)}
              className="flex items-center gap-1"
            >
              <Plus size={14} />
              New Folder
            </Button>
          )}
        </div>

        {showNewFolderInput && (
          <div className="flex items-center gap-2 p-2 border border-gray-200 rounded">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder();
                } else if (e.key === 'Escape') {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }
              }}
              placeholder="Folder name"
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              autoFocus
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateFolder}
            >
              Create
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNewFolderInput(false);
                setNewFolderName('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {/* Top drop zone for moving modules out of folders */}
          <LooseModulesDropZone>
            <div className="text-xs text-gray-400 text-center py-2 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
              Drop modules here to remove from folders
            </div>
          </LooseModulesDropZone>
          
          <SortableContext items={[...allFolderIds, ...sortedLooseModules.map(m => `module-${m.id}`)]} strategy={verticalListSortingStrategy}>
            {/* Render folders and loose modules interleaved based on order */}
            {(() => {
              // Create a combined list of items (folders and loose modules) for interleaving
              type CombinedItem = 
                | { type: 'folder'; folder: typeof sortedFolders[0]; order: number } 
                | { type: 'loose-module'; module: typeof sortedLooseModules[0]; order: number };
              
              const combinedItems: CombinedItem[] = [];
              
              // Add folders with their order
              sortedFolders.forEach(folder => {
                combinedItems.push({ type: 'folder', folder, order: folder.order });
              });
              
              // Add loose modules with their order
              // Loose modules with order < folder.order will render before that folder
              sortedLooseModules.forEach(module => {
                combinedItems.push({ type: 'loose-module', module, order: module.order });
              });
              
              // Sort combined items by order
              combinedItems.sort((a, b) => {
                // Dashboard always first (order -1)
                if (a.type === 'loose-module' && a.module.id === 'dashboard') return -1;
                if (b.type === 'loose-module' && b.module.id === 'dashboard') return 1;
                // Then sort by order
                return a.order - b.order;
              });
              
              // Render combined items with drop zones for loose modules
              return combinedItems.map((item, index) => {
                if (item.type === 'folder') {
                  return (
                    <FolderDropZone key={item.folder.id} folderId={item.folder.id}>
                      <FolderItem
                        folder={item.folder}
                        isDragging={draggingId === `folder-${item.folder.id}`}
                        onToggleCollapse={handleToggleCollapse}
                        onRename={handleRenameFolder}
                        onDelete={handleDeleteFolder}
                      >
                        <SortableContext
                          items={item.folder.modules.map(m => `module-${m.id}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          {item.folder.modules
                            .sort((a, b) => a.order - b.order)
                            .map((moduleRef) => {
                              const module = getModuleDetails(moduleRef.id);
                              if (!module) return null;
                              return (
                                <ModuleItem
                                  key={moduleRef.id}
                                  module={module}
                                  isDragging={draggingId === `module-${moduleRef.id}`}
                                  isInFolder
                                  isPinned={isModulePinned(moduleRef.id)}
                                  onTogglePin={handleTogglePin}
                                />
                              );
                            })}
                        </SortableContext>
                      </FolderItem>
                    </FolderDropZone>
                  );
                } else {
                  // Loose module - wrap in a drop zone so it can accept drops
                  const module = getModuleDetails(item.module.id);
                  if (!module) return null;
                  return (
                    <LooseModuleDropZone key={item.module.id} moduleId={item.module.id}>
                      <ModuleItem
                        module={module}
                        isDragging={draggingId === `module-${item.module.id}`}
                        isInFolder={false}
                        isPinned={isModulePinned(item.module.id)}
                        onTogglePin={handleTogglePin}
                      />
                    </LooseModuleDropZone>
                  );
                }
              });
            })()}
          </SortableContext>

          {/* Available Modules Section */}
          {availableModulesList.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-gray-500 px-2 py-1">Available Modules</div>
              <div className="p-2 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                <SortableContext
                  items={availableModulesList.map(m => `available-module-${m.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {availableModulesList.map((module) => (
                    <ModuleItem
                      key={module.id}
                      module={module}
                      isDragging={draggingId === `available-module-${module.id}`}
                      isInFolder={false}
                      isAvailable={true}
                    />
                  ))}
                </SortableContext>
              </div>
              <p className="text-xs text-gray-400 px-2">
                Drag modules from here to add them to your sidebar
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-4">
          💡 Drag modules to reorder or move into folders
        </p>
      </div>

      {/* Drag Overlay - shows shadow/ghost image while dragging */}
      <DragOverlay>
        {draggingId ? (
          (() => {
            // Get current tab config for lookup
            const currentTabConfig = getConfigForTab(dashboardTabId) || {
              folders: [],
              looseModules: [],
            };
            
            // Determine what's being dragged
            const isFolder = draggingId.startsWith('folder-');
            const isModule = draggingId.startsWith('module-') || draggingId.startsWith('available-module-');
            
            if (isFolder) {
              const folderId = draggingId.replace('folder-', '');
              const folder = currentTabConfig.folders.find(f => f.id === folderId);
              if (folder) {
                return (
                  <div className="bg-white border-2 border-blue-400 rounded-lg p-3 shadow-xl opacity-95 flex items-center gap-2 rotate-2">
                    <Folder size={18} className="text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">{folder.name}</span>
                  </div>
                );
              }
            } else if (isModule) {
              const moduleId = draggingId.replace(/^(module|available-module)-/, '');
              const module = getModuleDetails(moduleId);
              if (module) {
                const Icon = MODULE_ICONS[module.id] || LayoutDashboard;
                return (
                  <div className="bg-white border-2 border-blue-400 rounded-lg p-3 shadow-xl opacity-95 flex items-center gap-2 rotate-2">
                    <Icon size={18} className="text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">{module.name}</span>
                  </div>
                );
              }
            }
            return null;
          })()
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Drop zone component for folders
function FolderDropZone({ folderId, children }: { folderId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-drop-${folderId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={isOver ? 'ring-2 ring-blue-500 rounded-lg' : ''}
    >
      {children}
    </div>
  );
}

// Drop zone component for loose modules (entire section)
// This is used for the top drop zone where users can drop modules to make them loose
function LooseModulesDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'loose-modules',
  });

  return (
    <div
      ref={setNodeRef}
      className={`mb-2 p-2 rounded-lg border-2 border-dashed transition-colors ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      {children}
    </div>
  );
}

// Drop zone component for individual loose modules (allows dropping between them)
function LooseModuleDropZone({ moduleId, children }: { moduleId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `loose-module-drop-${moduleId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={isOver ? 'ring-2 ring-blue-500 rounded-lg' : ''}
    >
      {children}
    </div>
  );
}

