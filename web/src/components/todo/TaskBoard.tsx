'use client';

import React, { useState } from 'react';
import { Card, Badge } from 'shared/components';
import { TaskItem } from './TaskItem';
import { EmptyTaskState } from './EmptyTaskState';
import type { Task, TaskStatus, UpdateTaskInput } from '@/api/todo';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
  closestCenter,
} from '@dnd-kit/core';
import { toast } from 'react-hot-toast';

interface TaskBoardProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskUpdate: (taskId: string, data: UpdateTaskInput) => void;
  onTaskReopen?: (taskId: string) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  onViewAttachments?: (task: Task) => void;
  onCreateTask?: () => void;
}

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'TODO', label: 'To Do', color: 'bg-gray-100' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-100' },
  { id: 'BLOCKED', label: 'Blocked', color: 'bg-red-100' },
  { id: 'REVIEW', label: 'Review', color: 'bg-purple-100' },
  { id: 'DONE', label: 'Done', color: 'bg-green-100' },
];

// Droppable column component
function DroppableColumn({
  id,
  label,
  color,
  tasks,
  children,
}: {
  id: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${id}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 transition-all ${
        isOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
    >
      <Card className={`p-4 ${color} h-full ${isOver ? 'bg-opacity-80' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{label}</h3>
          <Badge>{tasks.length}</Badge>
        </div>
        <div className="space-y-3 min-h-[200px]">{children}</div>
      </Card>
    </div>
  );
}

export function TaskBoard({ tasks, onTaskSelect, onTaskUpdate, onTaskReopen, onTaskEdit, onTaskDelete, onViewAttachments, onCreateTask }: TaskBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const tasksByStatus = tasks.reduce((acc, task) => {
    if (!acc[task.status]) acc[task.status] = [];
    acc[task.status].push(task);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !active.id) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;

    // Check if dropped on global trash bin
    if (over.id === 'global-trash-bin') {
      if (onTaskDelete) {
        onTaskDelete(taskId);
        toast.success(`${task.title} moved to trash`);
      }
      return;
    }

    // Check if dropped on a column
    const columnId = over.id as string;
    if (columnId.startsWith('column-')) {
      const newStatus = columnId.replace('column-', '') as TaskStatus;
      
      // Only update if status actually changed
      if (task.status !== newStatus) {
        onTaskUpdate(taskId, { status: newStatus });
        toast.success(`Task moved to ${columns.find(c => c.id === newStatus)?.label || newStatus}`);
      }
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="h-full overflow-auto">
        <EmptyTaskState onCreateTask={onCreateTask || (() => {})} view="board" />
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto p-4 min-w-0">
        {columns.map((column) => {
          const columnTasks = tasksByStatus[column.id] || [];
          
          return (
            <DroppableColumn
              key={column.id}
              id={column.id}
              label={column.label}
              color={column.color}
              tasks={columnTasks}
            >
              {columnTasks.map((task) => (
                <div key={task.id}>
                  <TaskItem 
                    task={task} 
                    view="compact"
                    draggableId={task.id}
                    isDragging={activeId === task.id}
                    onComplete={() => onTaskUpdate(task.id, { status: 'DONE' })}
                    onReopen={onTaskReopen ? () => onTaskReopen(task.id) : undefined}
                    onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                    onDelete={onTaskDelete ? () => onTaskDelete(task.id) : undefined}
                    onViewAttachments={onViewAttachments ? () => onViewAttachments(task) : undefined}
                    onSelect={() => {
                      console.log('[TaskBoard] Task clicked:', task.id, task.title);
                      onTaskSelect(task);
                    }}
                  />
                </div>
              ))}
            </DroppableColumn>
          );
        })}
      </div>
    </DndContext>
  );
}

