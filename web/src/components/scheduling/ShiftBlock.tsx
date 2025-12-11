'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';
import { ScheduleShift } from '@/api/scheduling';
import { Edit, Trash2, Clock, User, AlertCircle } from 'lucide-react';

interface ShiftBlockProps {
  shift: ScheduleShift;
  position: {
    top: number;
    height: number;
    left: number;
    width: number;
  };
  isDragging?: boolean;
  hasConflict?: boolean;
  isOvertime?: boolean;
  onClick?: (shift: ScheduleShift) => void;
  onEdit?: (shift: ScheduleShift) => void;
  onDelete?: (shiftId: string) => void;
  onContextMenu?: (e: React.MouseEvent, shift: ScheduleShift) => void;
  color?: string;
}

export default function ShiftBlock({
  shift,
  position,
  isDragging = false,
  hasConflict = false,
  isOvertime = false,
  onClick,
  onEdit,
  onDelete,
  onContextMenu,
  color = '#3b82f6',
}: ShiftBlockProps) {
  const shiftStart = parseISO(shift.startTime);
  const shiftEnd = parseISO(shift.endTime);
  const duration = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60); // minutes

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(shift);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(e, shift);
    }
  };

  const blockStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${position.top}%`,
    left: `${position.left}%`,
    width: `${position.width}%`,
    height: `${Math.max(position.height, 40)}px`, // Minimum height
    minHeight: '40px',
    backgroundColor: hasConflict ? '#ef4444' : isOvertime ? '#f59e0b' : color,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'move',
    zIndex: isDragging ? 1000 : 'auto',
  };

  const statusBadge = shift.status === 'OPEN' ? (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
      Open
    </span>
  ) : shift.status === 'FILLED' ? (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
      Filled
    </span>
  ) : null;

  const positionLabel = shift.position?.title || shift.employeePosition?.position.title;
  const displayLabel = positionLabel || shift.employeePosition?.user.name || 'Shift';

  return (
    <div
      className={`rounded-lg border-2 shadow-sm hover:shadow-md transition-all ${
        hasConflict ? 'border-red-500' : isOvertime ? 'border-orange-500' : 'border-transparent'
      } ${isDragging ? 'opacity-50 scale-95' : ''}`}
      style={blockStyle}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      draggable
      title={`${displayLabel} - ${format(shiftStart, 'h:mm a')} to ${format(shiftEnd, 'h:mm a')}${hasConflict ? ' (Conflict)' : ''}${isOvertime ? ' (Overtime)' : ''}`}
    >
      <div className="h-full p-2 flex flex-col text-white text-xs overflow-hidden">
        {/* Shift Header */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate flex items-center gap-1">
              {displayLabel}
              {hasConflict && (
                <span title="Warning: Conflicts with employee availability">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-white" />
                </span>
              )}
            </div>
            {shift.stationName && (
              <div className="text-xs opacity-90 truncate mt-0.5">{shift.stationName}</div>
            )}
          </div>
          {isOvertime && (
            <AlertCircle className="w-3 h-3 flex-shrink-0 ml-1" />
          )}
        </div>

        {/* Time */}
        <div className="flex items-center space-x-1 mt-1">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">
            {format(shiftStart, 'h:mm a')} - {format(shiftEnd, 'h:mm a')}
          </span>
        </div>

        {/* Employee/Station Name */}
        {(shift.employeePosition?.user || shift.stationName) && (
          <div className="flex items-center space-x-1 mt-1 flex-1">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {shift.employeePosition?.user?.name || shift.stationName || 'Unassigned'}
            </span>
          </div>
        )}

        {/* Status Badge */}
        {statusBadge && (
          <div className="mt-1">
            {statusBadge}
          </div>
        )}

        {/* Duration */}
        {duration > 0 && (
          <div className="text-xs opacity-75 mt-1">
            {Math.floor(duration / 60)}h {duration % 60}m
          </div>
        )}

        {/* Actions (hover) */}
        <div className="absolute top-1 right-1 flex space-x-1 opacity-0 hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(shift);
              }}
              className="p-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30"
              title="Edit shift"
            >
              <Edit className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this shift?')) {
                  onDelete(shift.id);
                }
              }}
              className="p-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30"
              title="Delete shift"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

