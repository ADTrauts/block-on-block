'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Card } from 'shared/components';
import { Play, Square, Pause } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as todoAPI from '@/api/todo';
import type { TaskTimeLog } from '@/api/todo';

interface TaskTimerProps {
  taskId: string;
  activeTimer?: TaskTimeLog | null;
  onTimerStart?: (timeLog: TaskTimeLog) => void;
  onTimerStop?: (timeLog: TaskTimeLog, totalTimeSpent: number) => void;
}

export function TaskTimer({ taskId, activeTimer, onTimerStart, onTimerStop }: TaskTimerProps) {
  const { data: session } = useSession();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Initialize from active timer
  useEffect(() => {
    if (activeTimer && activeTimer.isActive && activeTimer.taskId === taskId) {
      setIsRunning(true);
      const startTime = new Date(activeTimer.startedAt);
      startTimeRef.current = startTime;
      updateElapsedTime();
    } else {
      setIsRunning(false);
      setElapsedSeconds(0);
      startTimeRef.current = null;
    }
  }, [activeTimer, taskId]);

  // Timer interval
  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        updateElapsedTime();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const updateElapsedTime = () => {
    if (startTimeRef.current) {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
      setElapsedSeconds(elapsed);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    if (!session?.accessToken) {
      toast.error('Authentication required');
      return;
    }

    // Check if there's an active timer for a different task
    if (activeTimer && activeTimer.isActive && activeTimer.taskId !== taskId) {
      toast.error(`You have an active timer on another task. Please stop it first.`);
      return;
    }

    try {
      const result = await todoAPI.startTimer(taskId, session.accessToken);
      setIsRunning(true);
      startTimeRef.current = new Date(result.timeLog.startedAt);
      setElapsedSeconds(0);
      onTimerStart?.(result.timeLog);
      toast.success('Timer started');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start timer';
      toast.error(message);
    }
  };

  const handleStop = async () => {
    if (!session?.accessToken) {
      toast.error('Authentication required');
      return;
    }

    try {
      const result = await todoAPI.stopTimer(taskId, session.accessToken);
      setIsRunning(false);
      setElapsedSeconds(0);
      startTimeRef.current = null;
      onTimerStop?.(result.timeLog, result.totalTimeSpent);
      toast.success('Timer stopped');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop timer';
      toast.error(message);
    }
  };

  const hasActiveTimerOnOtherTask = !!(activeTimer && activeTimer.isActive && activeTimer.taskId !== taskId);

  return (
    <Card className="p-4">
      {hasActiveTimerOnOtherTask && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          You have an active timer on another task. Stop it first to start a new timer.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-2xl font-mono font-semibold text-gray-900">
            {formatTime(elapsedSeconds)}
          </div>
          {isRunning && (
            <div className="flex items-center gap-1 text-sm text-red-600">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
              <span>Running</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStart}
              className="flex items-center gap-2"
              disabled={hasActiveTimerOnOtherTask}
            >
              <Play className="w-4 h-4" />
              Start
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStop}
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

