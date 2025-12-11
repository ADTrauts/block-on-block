'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ScheduleShift } from '@/api/scheduling';
import { format, parseISO } from 'date-fns';
import { MapPin } from 'lucide-react';

interface DraggableShiftProps {
  shift: ScheduleShift;
  style?: React.CSSProperties;
  onClick?: (shift: ScheduleShift) => void;
  children?: React.ReactNode;
  title?: string;
  hasConflict?: boolean;
  layoutMode?: 'employee' | 'position' | 'station';
}

// Format time in When I Work style: "9a ~ 5p"
function formatWhenIWorkTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'p' : 'a';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  
  if (minutes === 0) {
    return `${displayHour}${period}`;
  }
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHour}:${displayMinutes}${period}`;
}

export function DraggableShift({ shift, style, onClick, children, title, hasConflict = false, layoutMode = 'employee' }: DraggableShiftProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `shift-${shift.id}`,
    data: {
      type: 'shift',
      shift,
    },
  });

  const dragStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    ...style,
  };

  // Extract relevant data
  const positionLabel = shift.position?.title || shift.employeePosition?.position.title;
  const employeeName = shift.employeePosition?.user.name || 'Unassigned';
  const stationName = shift.stationName; // stationName is a string, not an object
  const locationName = shift.location?.name;
  
  // Determine what to display based on layout mode
  let primaryLabel = '';
  let secondaryLabel = '';
  
  if (layoutMode === 'employee') {
    // Employee view: Show position/station
    primaryLabel = positionLabel || stationName || 'Shift';
    secondaryLabel = stationName && positionLabel ? stationName : '';
  } else if (layoutMode === 'position') {
    // Position view: Show employee name
    primaryLabel = employeeName;
    secondaryLabel = stationName || '';
  } else if (layoutMode === 'station') {
    // Station view: Show employee name
    primaryLabel = employeeName;
    secondaryLabel = positionLabel || '';
  }
  
  // Determine if this is an open shift
  const isOpenShift = shift.employeePositionId === null || shift.status === 'OPEN';

  // Determine shift color based on status and conflicts
  // When I Work uses: gray with stripes (unconfirmed/conflicts), green (one type), purple/blue (confirmed)
  const shiftStart = parseISO(shift.startTime);
  const shiftEnd = parseISO(shift.endTime);
  const timeText = `${formatWhenIWorkTime(shiftStart)} ~ ${formatWhenIWorkTime(shiftEnd)}`;

  // Build tooltip with all details
  const tooltipText = title || (() => {
    let parts = [employeeName, positionLabel, stationName, timeText].filter(Boolean);
    if (locationName) parts.push(`@ ${locationName}`);
    return parts.join(' - ');
  })();

  // Determine background color and stripe pattern
  // First check if shift has a custom color set
  const customColor = shift.color;
  let bgColor = 'bg-gray-400'; // Default gray
  let textColor = 'text-white';
  let hasStripes = hasConflict || isOpenShift; // Stripes for conflicts or open shifts
  let backgroundColorStyle: React.CSSProperties | undefined;
  
  if (customColor) {
    // Use custom color if set - convert hex to inline style
    backgroundColorStyle = { backgroundColor: customColor };
    // Adjust text color based on brightness for readability
    const hex = customColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    textColor = brightness > 128 ? 'text-gray-900' : 'text-white';
  } else {
    // Fall back to status-based colors if no custom color
    if (!hasConflict && !isOpenShift) {
      // Confirmed shift - use purple/blue
      bgColor = 'bg-indigo-600';
    } else if (isOpenShift) {
      // Open shift - orange/amber
      bgColor = 'bg-amber-500';
    } else if (hasConflict) {
      // Conflict - red
      bgColor = 'bg-red-500';
    }
  }

  // Handle click separately from drag to avoid conflicts
  const handleClick = (e: React.MouseEvent) => {
    // Only trigger onClick if not dragging
    if (!isDragging && onClick) {
      e.stopPropagation();
      onClick(shift);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...dragStyle,
        ...(backgroundColorStyle && backgroundColorStyle)
      }}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      title={tooltipText}
      className={`absolute rounded px-2 py-1 text-xs cursor-pointer transition-colors relative overflow-hidden ${!customColor ? bgColor : ''} ${textColor} ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Diagonal stripe pattern overlay */}
      {hasStripes && (
        <div 
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)',
          }}
        />
      )}
      
      {/* Red triangle warning indicator (top-left corner) */}
      {hasConflict && (
        <div className="absolute top-0 left-0 w-0 h-0 border-l-[12px] border-l-red-700 border-t-[12px] border-t-transparent z-10" />
      )}
      
      {children || (
        <div className="relative z-10">
          {/* Time at the top */}
          <div className="font-semibold truncate text-xs">
            {timeText}
          </div>
          
          {/* Primary label (position/station in employee view, employee name in position/station view) */}
          {primaryLabel && (
            <div className="font-medium truncate text-xs mt-0.5">
              {primaryLabel.toUpperCase()}
            </div>
          )}
          
          {/* Secondary label (additional context) */}
          {secondaryLabel && (
            <div className="text-xs opacity-90 truncate mt-0.5">
              {secondaryLabel}
            </div>
          )}
          
          {/* Location (optional) */}
          {locationName && (
            <div className="flex items-center gap-1 mt-0.5 text-xs opacity-75">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{locationName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

