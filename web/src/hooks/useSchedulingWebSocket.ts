'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Socket } from 'socket.io-client';
import { getWebSocketConfig, createWebSocketConnection } from '@/lib/websocketUtils';
import { ScheduleShift } from '@/api/scheduling';

interface SchedulingWebSocketEvents {
  onShiftCreated?: (data: { businessId: string; scheduleId: string; shift: ScheduleShift }) => void;
  onShiftUpdated?: (data: { businessId: string; scheduleId: string; shift: ScheduleShift }) => void;
  onShiftDeleted?: (data: { businessId: string; scheduleId: string; shiftId: string }) => void;
  onSchedulePublished?: (data: { businessId: string; scheduleId: string; schedule: Record<string, unknown> }) => void;
}

interface UseSchedulingWebSocketOptions {
  businessId?: string;
  scheduleId?: string;
  enabled?: boolean;
  events?: SchedulingWebSocketEvents;
}

export function useSchedulingWebSocket({
  businessId,
  scheduleId,
  enabled = true,
  events = {}
}: UseSchedulingWebSocketOptions) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryAttemptsRef = useRef<Map<string, number>>(new Map());

  // Helper function to safely emit with retry logic
  const safeEmit = useCallback((socket: Socket, event: string, data: string, maxRetries = 3) => {
    if (!socket || !socket.connected) {
      console.debug(`Cannot emit ${event}: socket not connected`);
      return false;
    }

    const retryKey = `${event}_${data}`;
    const attempts = retryAttemptsRef.current.get(retryKey) || 0;

    if (attempts >= maxRetries) {
      console.warn(`Max retries reached for ${event} with ${data}`);
      retryAttemptsRef.current.delete(retryKey);
      return false;
    }

    try {
      socket.emit(event, data);
      retryAttemptsRef.current.delete(retryKey);
      return true;
    } catch (error) {
      console.warn(`Failed to emit ${event} (attempt ${attempts + 1}/${maxRetries}):`, error);
      retryAttemptsRef.current.set(retryKey, attempts + 1);
      
      // Retry after a delay
      if (attempts < maxRetries - 1) {
        setTimeout(() => {
          if (socket.connected) {
            safeEmit(socket, event, data, maxRetries);
          }
        }, Math.min(100 * Math.pow(2, attempts), 1000)); // Exponential backoff, max 1s
      }
      return false;
    }
  }, []);

  // Helper function to join rooms with delay to ensure socket is ready
  const joinRooms = useCallback((socket: Socket, businessId?: string, scheduleId?: string, delay = 100) => {
    // Clear any pending join attempts
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
    }

    joinTimeoutRef.current = setTimeout(() => {
      if (!socket || !socket.connected) {
        console.debug('Cannot join rooms: socket not connected');
        return;
      }

      try {
        if (businessId) {
          safeEmit(socket, 'join_business', businessId);
        }
        if (scheduleId) {
          safeEmit(socket, 'join_schedule', scheduleId);
        }
      } catch (error) {
        console.error('Failed to join rooms:', error);
      }
    }, delay);
  }, [safeEmit]);

  // Store events in a ref so they don't cause re-renders
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const connect = useCallback(async () => {
    if (!enabled || !session?.accessToken) {
      return;
    }

    if (socketRef.current?.connected) {
      // Already connected, just update rooms if needed
      if (businessId || scheduleId) {
        joinRooms(socketRef.current, businessId, scheduleId, 0);
      }
      return;
    }

    try {
      const socket = await createWebSocketConnection(
        session.accessToken,
        () => {
          isConnectedRef.current = true;
          console.log('✅ Scheduling WebSocket connected');
        },
        () => {
          isConnectedRef.current = false;
          console.log('🔌 Scheduling WebSocket disconnected');
          
          // Clear any pending join attempts
          if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
          }
          
          // Reset retry attempts on disconnect
          retryAttemptsRef.current.clear();
        },
        (error) => {
          console.error('❌ Scheduling WebSocket error:', error);
          isConnectedRef.current = false;
          
          // Clear any pending join attempts
          if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
          }
        }
      );

      socketRef.current = socket;

      // Wait a bit for socket to be fully ready before joining rooms
      // Socket.IO may need a moment to fully initialize the connection
      joinRooms(socket, businessId, scheduleId, 150);

      // Set up event listeners (use ref to get latest events)
      socket.on('schedule:shift:created', (data: { businessId: string; scheduleId: string; shift: ScheduleShift }) => {
        console.log('📅 Shift created event:', data);
        eventsRef.current.onShiftCreated?.(data);
      });

      socket.on('schedule:shift:updated', (data: { businessId: string; scheduleId: string; shift: ScheduleShift }) => {
        console.log('📅 Shift updated event:', data);
        eventsRef.current.onShiftUpdated?.(data);
      });

      socket.on('schedule:shift:deleted', (data: { businessId: string; scheduleId: string; shiftId: string }) => {
        console.log('📅 Shift deleted event:', data);
        eventsRef.current.onShiftDeleted?.(data);
      });

      socket.on('schedule:published', (data: { businessId: string; scheduleId: string; schedule: Record<string, unknown> }) => {
        console.log('📅 Schedule published event:', data);
        eventsRef.current.onSchedulePublished?.(data);
      });

    } catch (error) {
      console.error('Failed to connect to scheduling WebSocket:', error);
      isConnectedRef.current = false;
    }
  }, [enabled, session?.accessToken, businessId, scheduleId, joinRooms]);

  const disconnect = useCallback(() => {
    // Clear any pending join attempts
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }

    if (socketRef.current) {
      const socket = socketRef.current;
      
      // Only leave rooms if socket is still connected
      if (socket.connected) {
        try {
          if (scheduleId) {
            socket.emit('leave_schedule', scheduleId);
          }
          if (businessId) {
            socket.emit('leave_business', businessId);
          }
        } catch (error) {
          // Ignore errors when leaving rooms (socket might already be disconnecting)
          // These are non-critical and expected during disconnect
          console.debug('Error leaving rooms (non-critical):', error);
        }
      }

      socket.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
      retryAttemptsRef.current.clear();
      console.log('🔌 Scheduling WebSocket disconnected');
    }
  }, [scheduleId, businessId]);

  // Connect on mount and when dependencies change
  useEffect(() => {
    if (enabled && session?.accessToken) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session?.accessToken, businessId, scheduleId]);

  // Update rooms when businessId or scheduleId changes (debounced)
  useEffect(() => {
    if (!socketRef.current || !socketRef.current.connected) {
      return;
    }

    // Debounce room updates to avoid rapid emit attempts
    const timeoutId = setTimeout(() => {
      if (socketRef.current?.connected) {
        joinRooms(socketRef.current, businessId, scheduleId, 0);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [businessId, scheduleId, joinRooms]);

  return {
    isConnected: isConnectedRef.current,
    connect,
    disconnect
  };
}

