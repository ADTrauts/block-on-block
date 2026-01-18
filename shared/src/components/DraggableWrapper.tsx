"use client";

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type DraggableWrapperProps<T> = {
  items: T[];
  onDragEnd: (result: DragEndEvent) => void;
  onDragStart?: (result: DragStartEvent) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode;
  droppableId?: string;
};

function SortableItem<T extends { id: string }>({ 
  item, 
  index, 
  renderItem 
}: { 
  item: T; 
  index: number; 
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      {...listeners}
      className={`sortable-item ${isDragging ? 'dragging' : ''}`}
      onMouseDown={(e) => {
        // Prevent button clicks from triggering drag
        if ((e.target as HTMLElement).tagName === 'BUTTON' || 
            (e.target as HTMLElement).closest('button')) {
          return;
        }
      }}
    >
      {renderItem(item, index, isDragging)}
    </div>
  );
}

export function DraggableWrapper<T extends { id: string }>({ 
  items, 
  onDragEnd, 
  onDragStart, 
  renderItem, 
  droppableId = 'droppable' 
}: DraggableWrapperProps<T>) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    onDragStart?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over?.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      // Note: We're not updating the items here since that should be handled by the parent
      // We just call the onDragEnd callback with the event
    }
    
    onDragEnd(event);
  };

  const activeItem = activeId ? items.find(item => item.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={horizontalListSortingStrategy}>
        <div 
          style={{ 
            display: 'flex', 
            gap: 16,
            minHeight: '40px', // Ensure drop zone is always visible
          }}
          className="sortable-container"
        >
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              item={item}
              index={index}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
      
      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.8',
              },
            },
          }),
        }}
      >
        {activeItem ? (
          <div className="drag-overlay">
            {renderItem(activeItem, items.findIndex(item => item.id === activeId), true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
} 