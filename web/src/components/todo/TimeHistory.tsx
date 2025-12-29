'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Badge } from 'shared/components';
import { Clock, Edit, Trash2, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { TaskTimeLog, TimeLogsResponse } from '@/api/todo';
import * as todoAPI from '@/api/todo';
import { ManualTimeEntry } from './ManualTimeEntry';

interface TimeHistoryProps {
  taskId: string;
  timeData: TimeLogsResponse;
  onRefresh: () => void;
  onUpdate: (totalTimeSpent: number) => void;
}

export function TimeHistory({ taskId, timeData, onRefresh, onUpdate }: TimeHistoryProps) {
  const { data: session } = useSession();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const formatDuration = (minutes: number | null | undefined): string => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = async (logId: string) => {
    if (!session?.accessToken) {
      toast.error('Authentication required');
      return;
    }

    if (!confirm('Are you sure you want to delete this time log?')) {
      return;
    }

    try {
      const result = await todoAPI.deleteTimeLog(taskId, logId, session.accessToken);
      onUpdate(result.totalTimeSpent);
      onRefresh();
      toast.success('Time log deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete time log';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Time Tracking</h3>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Total:</span> {formatDuration(timeData.totalTime)}
            </div>
            {timeData.task.timeEstimate && (
              <div>
                <span className="font-medium">Estimate:</span> {formatDuration(timeData.task.timeEstimate)}
              </div>
            )}
            {timeData.task.actualTimeSpent && timeData.task.timeEstimate && (
              <div className={timeData.task.actualTimeSpent > timeData.task.timeEstimate ? 'text-red-600' : 'text-green-600'}>
                <span className="font-medium">
                  {timeData.task.actualTimeSpent > timeData.task.timeEstimate ? 'Over' : 'Under'}:
                </span>{' '}
                {formatDuration(Math.abs(timeData.task.actualTimeSpent - timeData.task.timeEstimate))}
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowManualEntry(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Time
        </Button>
      </div>

      {/* Manual Entry Form */}
      {showManualEntry && (
        <ManualTimeEntry
          taskId={taskId}
          onSave={() => {
            setShowManualEntry(false);
            onRefresh();
          }}
          onCancel={() => setShowManualEntry(false)}
        />
      )}

      {/* Time Logs List */}
      {timeData.timeLogs.length > 0 ? (
        <div className="space-y-2">
          {timeData.timeLogs.map((log) => (
            <Card key={log.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {formatDuration(log.duration)}
                      </span>
                      {log.isActive && (
                        <Badge className="bg-red-100 text-red-700 text-xs">Active</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(log.startedAt)}
                      {log.user && (
                        <span className="ml-2">by {log.user.name || log.user.email}</span>
                      )}
                    </div>
                    {log.description && (
                      <div className="text-sm text-gray-600 mt-1">{log.description}</div>
                    )}
                  </div>
                </div>
                {!log.isActive && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingLogId(log.id)}
                      className="p-1"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(log.id)}
                      className="p-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-4 text-center text-sm text-gray-500">
          No time logged yet. Start a timer or add manual time entry.
        </Card>
      )}
    </div>
  );
}

