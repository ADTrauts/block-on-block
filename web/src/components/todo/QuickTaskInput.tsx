'use client';

import React, { useState, KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import type { CreateTaskInput } from '@/api/todo';

interface QuickTaskInputProps {
  dashboardId: string;
  businessId?: string;
  onCreateTask: (data: CreateTaskInput) => Promise<void>;
  disabled?: boolean;
}

/**
 * QuickTaskInput - Apple Reminders style quick add input
 * 
 * Features:
 * - Always visible input bar
 * - Press Enter to create task instantly
 * - Natural language parsing (optional): "Buy milk tomorrow" → creates task with due date
 * - Clears input after creation
 */
export function QuickTaskInput({ 
  dashboardId, 
  businessId, 
  onCreateTask, 
  disabled = false 
}: QuickTaskInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Parse natural language for due dates, priorities, etc.
   * Examples:
   * - "Buy milk tomorrow" → dueDate: tomorrow
   * - "Review proposal urgent" → priority: URGENT
   * - "Call John Friday" → dueDate: next Friday
   */
  const parseTaskInput = (text: string): Partial<CreateTaskInput> => {
    const trimmed = text.trim();
    if (!trimmed) return {};

    const result: Partial<CreateTaskInput> = {
      title: trimmed,
      priority: 'MEDIUM',
    };

    // Parse due date keywords
    const dateKeywords: Record<string, () => Date> = {
      'today': () => {
        const date = new Date();
        date.setHours(23, 59, 59, 999);
        return date;
      },
      'tomorrow': () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(23, 59, 59, 999);
        return date;
      },
      'next week': () => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        date.setHours(23, 59, 59, 999);
        return date;
      },
    };

    // Check for date keywords
    for (const [keyword, dateFn] of Object.entries(dateKeywords)) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(trimmed)) {
        result.dueDate = dateFn().toISOString();
        // Remove keyword from title
        result.title = trimmed.replace(regex, '').trim();
        break;
      }
    }

    // Parse priority keywords
    const priorityKeywords: Record<string, 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'> = {
      'urgent': 'URGENT',
      'high priority': 'HIGH',
      'high': 'HIGH',
      'low priority': 'LOW',
      'low': 'LOW',
    };

    for (const [keyword, priority] of Object.entries(priorityKeywords)) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(trimmed)) {
        result.priority = priority;
        // Remove keyword from title
        result.title = (result.title || trimmed).replace(regex, '').trim();
        break;
      }
    }

    // Parse day names (Monday, Tuesday, etc.)
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of dayNames) {
      const regex = new RegExp(`\\b${day}\\b`, 'i');
      if (regex.test(trimmed)) {
        const today = new Date();
        const currentDay = today.getDay();
        const targetDay = dayNames.indexOf(day);
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7; // Next occurrence
        
        const date = new Date();
        date.setDate(date.getDate() + daysUntil);
        date.setHours(23, 59, 59, 999);
        result.dueDate = date.toISOString();
        
        // Remove day name from title
        result.title = (result.title || trimmed).replace(regex, '').trim();
        break;
      }
    }

    // Ensure title is not empty after parsing
    if (!result.title || result.title.length === 0) {
      result.title = trimmed;
    }

    return result;
  };

  const handleSubmit = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || isCreating || disabled || !inputValue.trim()) {
      return;
    }

    e.preventDefault();
    setIsCreating(true);

    try {
      // Parse natural language input
      const parsed = parseTaskInput(inputValue);
      
      // Create task with parsed data
      await onCreateTask({
        title: parsed.title || inputValue.trim(),
        dashboardId,
        businessId,
        priority: parsed.priority || 'MEDIUM',
        dueDate: parsed.dueDate,
        status: 'TODO',
      });

      // Clear input after successful creation
      setInputValue('');
    } catch (error) {
      console.error('Failed to create quick task:', error);
      // Don't clear input on error so user can retry
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative w-full">
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
        <Plus className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleSubmit}
        placeholder="New task..."
        disabled={disabled || isCreating}
        className={`
          w-full pl-8 pr-8 py-1.5
          border border-gray-300 rounded-md
          text-sm text-gray-900 placeholder:text-gray-400
          focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-50 disabled:cursor-not-allowed
          transition-colors
        `}
      />
      {isCreating && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

