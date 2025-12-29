'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Input, Textarea } from 'shared/components';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as todoAPI from '@/api/todo';

interface ManualTimeEntryProps {
  taskId: string;
  onSave: () => void;
  onCancel: () => void;
}

export function ManualTimeEntry({ taskId, onSave, onCancel }: ManualTimeEntryProps) {
  const { data: session } = useSession();
  const [startedAt, setStartedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - 60); // Default to 1 hour ago
    return now.toISOString().slice(0, 16); // Format for datetime-local input
  });
  const [duration, setDuration] = useState('60'); // minutes
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.accessToken) {
      toast.error('Authentication required');
      return;
    }

    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      toast.error('Please enter a valid duration');
      return;
    }

    try {
      const startedAtDate = new Date(startedAt);
      await todoAPI.logTime(
        taskId,
        {
          startedAt: startedAtDate.toISOString(),
          duration: durationNum,
          description: description || undefined,
        },
        session.accessToken
      );
      
      toast.success('Time logged successfully');
      onSave();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to log time';
      toast.error(message);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Add Manual Time Entry</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="p-1"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Started At
          </label>
          <Input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration (minutes)
          </label>
          <Input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min="1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you work on?"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
          >
            Log Time
          </Button>
        </div>
      </form>
    </Card>
  );
}

