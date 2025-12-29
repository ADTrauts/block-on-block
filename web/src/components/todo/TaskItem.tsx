'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Badge, Avatar } from 'shared/components';
import { 
  CheckSquare, 
  Square, 
  Calendar, 
  Flag, 
  Tag, 
  ListChecks, 
  MessageSquare,
  User,
  MoreVertical,
  Clock,
  CheckCircle2,
  RotateCcw,
  Edit,
  Trash2,
  Paperclip,
  Repeat,
  GitBranch,
  AlertCircle,
  GripVertical
} from 'lucide-react';
import type { Task } from '@/api/todo';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useGlobalTrash } from '@/contexts/GlobalTrashContext';

interface TaskItemProps {
  task: Task;
  onSelect: () => void;
  onComplete: () => void;
  onReopen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onViewAttachments?: (task: Task) => void;
  view?: 'list' | 'board' | 'compact';
  draggableId?: string;
  isDragging?: boolean;
}

export function TaskItem({ task, onSelect, onComplete, onReopen, onEdit, onDelete, onViewAttachments, view = 'list', draggableId, isDragging: externalIsDragging }: TaskItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const isCompleted = task.status === 'DONE';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
  const isCompact = view === 'compact' || view === 'board';
  const { trashItem } = useGlobalTrash();
  
  // Make task draggable if draggableId is provided (board view)
  const { attributes, listeners, setNodeRef, transform, isDragging: isDraggingInternal } = useDraggable({
    id: draggableId || task.id,
    disabled: !draggableId, // Only draggable in board view
  });

  const isDragging = externalIsDragging || isDraggingInternal;
  
  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  // Native HTML5 drag support for GlobalTrashBin (works in all views)
  // Make the entire card draggable for trash
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;

    const element = containerRef.current;
    
    const handleDragStart = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      
      // Set drag data for trash bin
      const trashItemData = {
        id: task.id,
        name: task.title,
        type: 'task' as const,
        moduleId: 'todo',
        moduleName: 'To-Do',
        metadata: {
          taskId: task.id,
          dashboardId: task.dashboardId,
        },
      };
      
      e.dataTransfer.setData('application/json', JSON.stringify(trashItemData));
      e.dataTransfer.setData('text/plain', task.title);
      e.dataTransfer.effectAllowed = 'move';
      
      // Visual feedback
      element.classList.add('dragging-to-trash');
    };

    const handleDragEnd = (e: DragEvent) => {
      // Remove visual feedback
      element.classList.remove('dragging-to-trash');
    };

    // Enable native drag for trash bin (works alongside dnd-kit in board view)
    element.setAttribute('draggable', 'true');
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);

    return () => {
      element.removeAttribute('draggable');
      element.removeEventListener('dragstart', handleDragStart);
      element.removeEventListener('dragend', handleDragEnd);
    };
  }, [task]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);
  
  const priorityColors: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-800 border-red-300',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    LOW: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const statusColors: Record<string, string> = {
    TODO: 'bg-gray-100 text-gray-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    BLOCKED: 'bg-red-100 text-red-800',
    REVIEW: 'bg-purple-100 text-purple-800',
    DONE: 'bg-green-100 text-green-800',
  };

  // Track if a drag occurred to prevent click events after drag
  const hasDraggedRef = useRef(false);
  
  useEffect(() => {
    if (isDragging) {
      hasDraggedRef.current = true;
    } else if (hasDraggedRef.current) {
      const timer = setTimeout(() => {
        hasDraggedRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDragging]);

  const handleClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    console.log('[TaskItem] Card clicked, calling onSelect');
    onSelect();
  };

  // Combine refs for both dnd-kit and native drag
  const combinedRef = (node: HTMLDivElement | null) => {
    if (draggableId) {
      setNodeRef(node);
    }
    containerRef.current = node;
  };

  return (
    <div
      ref={combinedRef}
      style={style}
      onClick={handleClick}
      className={`cursor-pointer ${isDragging ? 'z-50' : ''}`}
    >
      <Card 
        className={`
          ${isCompact ? 'p-2' : 'p-2.5'} hover:shadow-md transition-shadow
          ${isCompleted ? 'opacity-60' : ''}
          ${isOverdue ? 'border-l-4 border-l-red-500' : ''}
          ${isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}
        `}
      >
      <div className={`flex items-start ${isCompact ? 'gap-2' : 'gap-2'}`}>
        {/* Drag Handle - Only show in board view for column moves */}
        {draggableId && (
          <div
            ref={dragHandleRef}
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mt-1 text-gray-400 hover:text-gray-600"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <GripVertical className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
          </div>
        )}
        
        {/* Checkbox - Toggle between complete and reopen */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isCompleted && onReopen) {
              onReopen();
            } else {
              onComplete();
            }
          }}
          className={isCompact ? 'mt-0.5' : 'mt-0.5'}
          title={isCompleted ? 'Reopen task' : 'Complete task'}
        >
          {isCompleted ? (
            <CheckCircle2 className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-green-600 hover:text-green-700`} />
          ) : (
            <Square className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-gray-400 hover:text-gray-600`} />
          )}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={`
            font-semibold ${isCompact ? 'text-sm mb-0.5' : 'text-base mb-1'}
            ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}
          `}>
            {task.title}
          </h3>

          {/* Description - only show in list view */}
          {!isCompact && task.description && (
            <p className="text-xs text-gray-600 mb-1.5 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Metadata Row */}
          <div className={`flex items-center ${isCompact ? 'gap-2' : 'gap-2.5'} flex-wrap`}>
            {/* Due Date */}
            {task.dueDate && (
              <div className={`
                flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-xs'}
                ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}
              `}>
                <Calendar className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {new Date(task.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  ...(isOverdue || isCompact ? {} : { year: 'numeric' })
                })}
                {isOverdue && !isCompact && <span className="ml-1">(Overdue)</span>}
              </div>
            )}

            {/* Priority */}
            <Badge className={`${priorityColors[task.priority] || priorityColors.MEDIUM} ${isCompact ? 'text-xs px-1.5 py-0.5' : 'text-xs px-1.5 py-0.5'}`}>
              <Flag className={`${isCompact ? 'w-2.5 h-2.5' : 'w-2.5 h-2.5'} mr-0.5`} />
              {task.priority}
            </Badge>

            {/* Status - hide in compact view since it's shown in column header */}
            {!isCompact && (
              <Badge className={statusColors[task.status] || statusColors.TODO}>
                {task.status.replace('_', ' ')}
              </Badge>
            )}

            {/* Category/Tags */}
            {task.category && (
              <div className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-xs'} text-gray-600`}>
                <Tag className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {task.category}
              </div>
            )}

            {/* Subtasks Count */}
            {task._count && task._count.subtasks > 0 && (
              <div className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-xs'} text-gray-600`}>
                <ListChecks className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {task._count.subtasks}
              </div>
            )}

            {/* Comments Count */}
            {task._count && task._count.comments > 0 && (
              <div className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-xs'} text-gray-600`}>
                <MessageSquare className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {task._count.comments}
              </div>
            )}

            {/* Attachments Count */}
            {((task.attachments && task.attachments.length > 0) || (task._count && task._count.attachments && task._count.attachments > 0)) && (
              <div 
                className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-xs'} text-gray-600 cursor-pointer hover:text-blue-600`}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('[TaskItem] Attachment icon clicked, onViewAttachments:', !!onViewAttachments);
                  if (onViewAttachments) {
                    console.log('[TaskItem] Calling onViewAttachments');
                    onViewAttachments();
                  } else {
                    console.log('[TaskItem] onViewAttachments is not defined');
                  }
                }}
              >
                <Paperclip className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {task.attachments?.length || task._count?.attachments || 0}
              </div>
            )}

            {/* Project Badge */}
            {task.project && (
              <Badge
                className="text-xs"
                style={{
                  backgroundColor: task.project.color || '#3B82F6',
                  color: 'white',
                }}
              >
                {task.project.name}
              </Badge>
            )}

            {/* Recurring Task Indicator */}
            {task.recurrenceRule && !task.parentRecurringTaskId && (
              <div className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-sm'} text-purple-600`} title="Recurring task (parent)">
                <Repeat className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
              </div>
            )}
            {task.parentRecurringTaskId && (
              <div className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-sm'} text-purple-500`} title="Recurring instance">
                <Repeat className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
              </div>
            )}

            {/* Dependency Indicators */}
            {task.dependsOnTasks && task.dependsOnTasks.length > 0 && (
              <div className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-sm'} text-orange-600`} title={`Depends on ${task.dependsOnTasks.length} task(s)`}>
                <GitBranch className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
                {task.dependsOnTasks.length}
              </div>
            )}
            {task.status === 'BLOCKED' && (
              <div className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-sm'} text-red-600`} title="This task is blocked">
                <AlertCircle className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
              </div>
            )}

            {/* Assignee (Business) - only show in list view */}
            {!isCompact && task.assignedTo && (
              <div className="flex items-center gap-1">
                <Avatar 
                  src={task.assignedTo.image || undefined} 
                  name={task.assignedTo.name || task.assignedTo.email}
                  size="sm"
                />
                <span className="text-sm text-gray-600">{task.assignedTo.name || task.assignedTo.email}</span>
              </div>
            )}

            {/* Time Estimate */}
            {task.timeEstimate && (
              <div className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-xs'} text-gray-600`}>
                <Clock className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {task.timeEstimate}m
              </div>
            )}
          </div>
        </div>

        {/* Actions - hide in compact view */}
        {!isCompact && (
          <div className="flex items-center gap-2 relative" ref={menuRef}>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
            
            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                {isCompleted && onReopen && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReopen();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reopen Task</span>
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Task</span>
                  </button>
                )}
                {onDelete && (
                  <>
                    {(onEdit || (isCompleted && onReopen)) && (
                      <div className="my-1 border-t border-gray-200" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Task</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </Card>
    </div>
  );
}

