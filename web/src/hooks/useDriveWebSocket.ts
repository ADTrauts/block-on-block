'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Socket } from 'socket.io-client';
import { createWebSocketConnection } from '@/lib/websocketUtils';

interface DriveWebSocketEvents {
  onItemCreated?: (data: Record<string, unknown>) => void;
  onItemUpdated?: (data: Record<string, unknown>) => void;
  onItemDeleted?: (data: Record<string, unknown>) => void;
  onItemMoved?: (data: Record<string, unknown>) => void;
  onItemPinned?: (data: Record<string, unknown>) => void;
}

interface UseDriveWebSocketOptions {
  enabled?: boolean;
  events?: DriveWebSocketEvents;
}

export function useDriveWebSocket({
  enabled = true,
  events = {},
}: UseDriveWebSocketOptions) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef(events);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const connect = useCallback(async () => {
    if (!enabled || !session?.accessToken) {
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    try {
      const socket = await createWebSocketConnection(
        session.accessToken,
        () => {
          console.log('✅ Drive WebSocket connected');
        },
        () => {
          console.log('🔌 Drive WebSocket disconnected');
        },
        (error) => {
          console.error('❌ Drive WebSocket error:', error);
        }
      );

      socketRef.current = socket;

      socket.on('drive:item:created', (data: Record<string, unknown>) => {
        eventsRef.current.onItemCreated?.(data);
      });
      socket.on('drive:item:updated', (data: Record<string, unknown>) => {
        eventsRef.current.onItemUpdated?.(data);
      });
      socket.on('drive:item:deleted', (data: Record<string, unknown>) => {
        eventsRef.current.onItemDeleted?.(data);
      });
      socket.on('drive:item:moved', (data: Record<string, unknown>) => {
        eventsRef.current.onItemMoved?.(data);
      });
      socket.on('drive:item:pinned', (data: Record<string, unknown>) => {
        eventsRef.current.onItemPinned?.(data);
      });
    } catch (error) {
      console.error('Failed to connect to Drive WebSocket:', error);
    }
  }, [enabled, session?.accessToken]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled && session?.accessToken) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session?.accessToken]);

  return {
    connect,
    disconnect,
  };
}

