'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Modal } from 'shared/components';
import type { CreateTaskInput, Task, TaskStatus, TaskPriority, TaskProject } from '@/api/todo';
import * as todoAPI from '@/api/todo';
import { RecurrenceRuleBuilder } from './RecurrenceRuleBuilder';

interface TaskFormProps {
  task?: Task | null;
  dashboardId: string;
  businessId?: string;
  initialDueDate?: Date;
  onSave: (data: CreateTaskInput & { createCalendarEvent?: boolean }) => void | Promise<void>;
  onClose: () => void;
}

export function TaskForm({ task, dashboardId, businessId, initialDueDate, onSave, onClose }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('');
  const [timeEstimate, setTimeEstimate] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [createCalendarEvent, setCreateCalendarEvent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  const [recurrenceEndAt, setRecurrenceEndAt] = useState<string | null>(null);
  const { data: session } = useSession();

  // Helper to format datetime for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Get local date/time components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      // Preserve full datetime including time
      setDueDate(task.dueDate ? formatDateTimeLocal(task.dueDate) : '');
      setCategory(task.category || '');
      setTimeEstimate(task.timeEstimate?.toString() || '');
      setProjectId(task.projectId || null);
      setRecurrenceRule(task.recurrenceRule || null);
      setRecurrenceEndAt(task.recurrenceEndAt || null);
    } else if (initialDueDate) {
      // Pre-fill due date from calendar click
      setDueDate(formatDateTimeLocal(initialDueDate.toISOString()));
      setCreateCalendarEvent(true); // Auto-check if due date is provided
    }
  }, [task, initialDueDate]);

  useEffect(() => {
    if (session?.accessToken && dashboardId) {
      loadProjects();
    }
  }, [session?.accessToken, dashboardId, businessId]);

  const loadProjects = async () => {
    if (!session?.accessToken) return;
    try {
      const fetchedProjects = await todoAPI.getProjects(
        session.accessToken,
        dashboardId,
        businessId
      );
      setProjects(fetchedProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || isSubmitting) {
      return;
    }

    // Validate: due date is required for recurring tasks
    if (recurrenceRule && !dueDate) {
      alert('Due date is required for recurring tasks');
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO string for backend
      let dueDateISO: string | undefined = undefined;
      if (dueDate) {
        // datetime-local gives us YYYY-MM-DDTHH:mm in local time
        // Convert to ISO string (backend expects ISO format)
        const localDate = new Date(dueDate);
        // Check if date is valid
        if (!isNaN(localDate.getTime())) {
          dueDateISO = localDate.toISOString();
        }
      }

      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        dashboardId,
        businessId,
        dueDate: dueDateISO,
        category: category.trim() || undefined,
        timeEstimate: timeEstimate ? parseInt(timeEstimate) : undefined,
        projectId: projectId || undefined,
        recurrenceRule: recurrenceRule || undefined,
        recurrenceEndAt: recurrenceEndAt || undefined,
        createCalendarEvent: createCalendarEvent && !!dueDate,
      });
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={task ? 'Edit Task' : 'Create New Task'} size="xlarge">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter task title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Add task description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="REVIEW">Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Due Date {recurrenceRule && <span className="text-red-500">*</span>}
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => {
                  // Keep the full datetime-local value (includes time)
                  setDueDate(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={!!recurrenceRule}
              />
              {recurrenceRule && !dueDate && (
                <p className="mt-1 text-sm text-red-600">Due date is required for recurring tasks</p>
              )}
              {dueDate && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="createCalendarEvent"
                    checked={createCalendarEvent}
                    onChange={(e) => setCreateCalendarEvent(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="createCalendarEvent" className="text-sm font-medium text-gray-900 cursor-pointer">
                    Create calendar event for this task
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Project</label>
              <select
                value={projectId || ''}
                onChange={(e) => setProjectId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <RecurrenceRuleBuilder
                value={recurrenceRule}
                recurrenceEndAt={recurrenceEndAt}
                onChange={(rrule, endAt) => {
                  setRecurrenceRule(rrule);
                  setRecurrenceEndAt(endAt);
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Work, Personal"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Time Estimate (minutes)</label>
                <input
                  type="number"
                  value={timeEstimate}
                  onChange={(e) => setTimeEstimate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 120"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {task ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

