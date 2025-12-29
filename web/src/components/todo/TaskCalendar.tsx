'use client';

import React, { useState, useMemo } from 'react';
import { Card, Button, Badge } from 'shared/components';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Flag, Clock } from 'lucide-react';
import type { Task } from '@/api/todo';
import type { EventItem } from '@/api/calendar';

interface TaskCalendarProps {
  tasks: Task[];
  calendarEvents?: EventItem[];
  onTaskSelect: (task: Task) => void;
  onEventSelect?: (event: EventItem) => void;
  onTaskCreate: (dueDate: Date) => void;
  viewMode: 'month' | 'week' | 'day';
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewModeChange: (mode: 'month' | 'week' | 'day') => void;
}

export function TaskCalendar({
  tasks,
  calendarEvents = [],
  onTaskSelect,
  onEventSelect,
  onTaskCreate,
  viewMode,
  currentDate,
  onDateChange,
  onViewModeChange,
}: TaskCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get days in month for month view
  const getDaysInMonth = (date: Date): (Date | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  // Get days in week for week view
  const getDaysInWeek = (date: Date): Date[] => {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start from Sunday
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Get tasks and events for a specific date
  const getItemsForDate = (date: Date | null) => {
    if (!date) return { tasks: [], events: [] };

    // Compare dates in local timezone to avoid timezone conversion issues
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();
    
    const dayTasks = tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return (
        taskDate.getFullYear() === targetYear &&
        taskDate.getMonth() === targetMonth &&
        taskDate.getDate() === targetDay
      );
    });

    const dayEvents = calendarEvents.filter(event => {
      const eventDate = new Date(event.startAt);
      return (
        eventDate.getFullYear() === targetYear &&
        eventDate.getMonth() === targetMonth &&
        eventDate.getDate() === targetDay
      );
    });

    return { tasks: dayTasks, events: dayEvents };
  };

  // Get priority color
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 border-red-300 text-red-800';
      case 'HIGH': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'LOW': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    onDateChange(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    onDateChange(newDate);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  // Format date for display
  const formatDateHeader = (date: Date): string => {
    if (viewMode === 'month') {
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const weekStart = getDaysInWeek(date)[0];
      const weekEnd = getDaysInWeek(date)[6];
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Render month view
  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 gap-px bg-gray-100 border-b border-gray-200">
          {weekDays.map(day => (
            <div key={day} className="bg-white p-3 text-center">
              <span className="text-sm font-semibold text-gray-700">{day}</span>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-100">
          {days.map((date, index) => {
            const { tasks: dayTasks, events: dayEvents } = getItemsForDate(date);
            const isCurrentDay = isToday(date);
            const isCurrentMonth = date && date.getMonth() === currentDate.getMonth();

            return (
              <div
                key={index}
                className={`
                  min-h-[120px] bg-white p-2
                  ${!isCurrentMonth ? 'opacity-40' : ''}
                  ${isCurrentDay ? 'bg-blue-50 border-2 border-blue-500' : ''}
                  hover:bg-gray-50 cursor-pointer
                `}
                onClick={() => {
                  if (date) {
                    setSelectedDate(date);
                    onTaskCreate(date);
                  }
                }}
              >
                {date && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${isCurrentDay ? 'text-blue-700' : 'text-gray-900'}`}>
                        {date.getDate()}
                      </span>
                      {(dayTasks.length > 0 || dayEvents.length > 0) && (
                        <Badge size="sm" color="blue">
                          {dayTasks.length + dayEvents.length}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {/* Tasks */}
                      {dayTasks.slice(0, 3).map(task => (
                        <div
                          key={task.id}
                          className={`
                            text-xs p-1 rounded border cursor-pointer
                            ${getPriorityColor(task.priority)}
                            hover:shadow-sm
                          `}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskSelect(task);
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <Flag className="w-3 h-3" />
                            <span className="truncate font-medium">{task.title}</span>
                          </div>
                        </div>
                      ))}
                      {/* Calendar Events */}
                      {dayEvents.slice(0, Math.max(0, 3 - dayTasks.length)).map(event => (
                        <div
                          key={event.id}
                          className="text-xs p-1 rounded border border-purple-300 bg-purple-50 text-purple-800 cursor-pointer hover:shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onEventSelect) {
                              onEventSelect(event);
                            } else {
                              // Default: navigate to calendar module
                              window.location.href = `/calendar?eventId=${event.id}`;
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            <span className="truncate font-medium">{event.title}</span>
                          </div>
                        </div>
                      ))}
                      {(dayTasks.length + dayEvents.length) > 3 && (
                        <div className="text-xs text-gray-500 text-center pt-1">
                          +{dayTasks.length + dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const days = getDaysInWeek(currentDate);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Week Header */}
        <div className="grid grid-cols-7 gap-px bg-gray-100 border-b border-gray-200">
          {weekDays.map((day, index) => {
            const dayDate = days[index];
            const isCurrentDay = isToday(dayDate);
            const { tasks: dayTasks, events: dayEvents } = getItemsForDate(dayDate);

            return (
              <div
                key={day}
                className={`
                  bg-white p-3 text-center
                  ${isCurrentDay ? 'bg-blue-50 border-b-2 border-blue-500' : ''}
                `}
              >
                <div className="text-xs font-medium text-gray-500 mb-1">{day}</div>
                <div className={`text-lg font-semibold ${isCurrentDay ? 'text-blue-700' : 'text-gray-900'}`}>
                  {dayDate.getDate()}
                </div>
                {(dayTasks.length > 0 || dayEvents.length > 0) && (
                  <Badge size="sm" color="blue" className="mt-1">
                    {dayTasks.length + dayEvents.length}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Week Content */}
        <div className="grid grid-cols-7 gap-px bg-gray-100 min-h-[400px]">
          {days.map((day, index) => {
            const { tasks: dayTasks, events: dayEvents } = getItemsForDate(day);
            const isCurrentDay = isToday(day);
            const allItems = [...dayTasks, ...dayEvents];

            return (
              <div
                key={index}
                className={`
                  bg-white p-2 min-h-[400px]
                  ${isCurrentDay ? 'bg-blue-50' : ''}
                `}
                onClick={() => {
                  setSelectedDate(day);
                  onTaskCreate(day);
                }}
              >
                <div className="space-y-2">
                  {allItems.map((item, itemIndex) => {
                    if ('eventId' in item) {
                      // Calendar event
                      const event = item as unknown as EventItem;
                      return (
                        <div
                          key={event.id}
                          className="text-xs p-2 rounded border border-purple-300 bg-purple-50 text-purple-800 cursor-pointer hover:shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onEventSelect) onEventSelect(event);
                          }}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <CalendarIcon className="w-3 h-3" />
                            <span className="font-medium truncate">{event.title}</span>
                          </div>
                          {!event.allDay && (
                            <div className="text-xs text-purple-600">
                              {new Date(event.startAt).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      // Task
                      const task = item as Task;
                      return (
                        <div
                          key={task.id}
                          className={`
                            text-xs p-2 rounded border cursor-pointer hover:shadow-sm
                            ${getPriorityColor(task.priority)}
                          `}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskSelect(task);
                          }}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <Flag className="w-3 h-3" />
                            <span className="font-medium truncate">{task.title}</span>
                          </div>
                          {task.dueDate && (
                            <div className="text-xs opacity-75 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render day view
  const renderDayView = () => {
    const { tasks: dayTasks, events: dayEvents } = getItemsForDate(currentDate);
    const allItems = [...dayTasks, ...dayEvents].sort((a, b) => {
      const aDate = 'dueDate' in a ? new Date(a.dueDate || 0) : new Date((a as EventItem).startAt);
      const bDate = 'dueDate' in b ? new Date(b.dueDate || 0) : new Date((b as EventItem).startAt);
      return aDate.getTime() - bDate.getTime();
    });

    // Generate time slots (hourly)
    const timeSlots: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      timeSlots.push(hour);
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Day Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {dayTasks.length} tasks, {dayEvents.length} events
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onTaskCreate(currentDate)}
            >
              Add Task
            </Button>
          </div>
        </div>

        {/* Day Timeline */}
        <div className="overflow-y-auto max-h-[600px]">
          <div className="grid grid-cols-[80px_1fr]">
            {/* Time Column */}
            <div className="border-r border-gray-200">
              {timeSlots.map(hour => (
                <div
                  key={hour}
                  className="h-16 border-b border-gray-100 flex items-start justify-end pr-2 pt-1"
                >
                  <span className="text-xs text-gray-500">
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Events Column */}
            <div className="relative">
              {allItems.map((item, index) => {
                if ('eventId' in item) {
                  // Calendar event
                  const event = item as unknown as EventItem;
                  const startTime = new Date(event.startAt);
                  const endTime = new Date(event.endAt);
                  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
                  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours
                  const top = startHour * 64; // 64px per hour
                  const height = duration * 64;

                  return (
                    <div
                      key={event.id}
                      className="absolute left-2 right-2 border border-purple-300 bg-purple-50 text-purple-800 rounded p-2 cursor-pointer hover:shadow-md z-10"
                      style={{ top: `${top}px`, height: `${Math.max(height, 40)}px` }}
                      onClick={() => {
                        if (onEventSelect) onEventSelect(event);
                      }}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <CalendarIcon className="w-3 h-3" />
                        <span className="font-medium text-sm truncate">{event.title}</span>
                      </div>
                      <div className="text-xs text-purple-600">
                        {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                } else {
                  // Task
                  const task = item as Task;
                  if (!task.dueDate) return null;
                  
                  const taskTime = new Date(task.dueDate);
                  const taskHour = taskTime.getHours() + taskTime.getMinutes() / 60;
                  const top = taskHour * 64;

                  return (
                    <div
                      key={task.id}
                      className={`
                        absolute left-2 right-2 border rounded p-2 cursor-pointer hover:shadow-md z-10
                        ${getPriorityColor(task.priority)}
                      `}
                      style={{ top: `${top}px`, height: '40px' }}
                      onClick={() => onTaskSelect(task)}
                    >
                      <div className="flex items-center gap-1">
                        <Flag className="w-3 h-3" />
                        <span className="font-medium text-sm truncate">{task.title}</span>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Controls */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handlePrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold text-gray-900 ml-4">
            {formatDateHeader(currentDate)}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'month' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('month')}
          >
            Month
          </Button>
          <Button
            variant={viewMode === 'week' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('week')}
          >
            Week
          </Button>
          <Button
            variant={viewMode === 'day' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('day')}
          >
            Day
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </div>
    </div>
  );
}

