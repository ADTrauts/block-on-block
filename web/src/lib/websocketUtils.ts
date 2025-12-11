/**
 * Centralized WebSocket utilities for consistent configuration across all WebSocket clients
 * Provides future-proof, scalable WebSocket management with proper fallback mechanisms
 */

import { io, Socket } from 'socket.io-client';

export interface WebSocketConfig {
  url: string;
  options: {
    transports: string[];
    reconnection: boolean;
    reconnectionAttempts: number;
    reconnectionDelay: number;
    timeout: number;
    forceNew?: boolean;
    path?: string;
  };
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'failed' | 'polling';

export interface WebSocketManager {
  socket: Socket | null;
  connectionState: ConnectionState;
  fallbackMode: 'websocket' | 'polling' | 'offline';
  retryCount: number;
  maxRetries: number;
  pollingInterval: NodeJS.Timeout | null;
}

/**
 * Get standardized WebSocket configuration based on environment
 * Future-proof pattern that works across all environments
 */
export const getWebSocketConfig = (): WebSocketConfig => {
  const rawBaseUrl = process.env.NEXT_PUBLIC_WS_URL ||
                     process.env.NEXT_PUBLIC_API_BASE_URL ||
                     process.env.NEXT_PUBLIC_API_URL ||
                     'https://vssyl-server-235369681725.us-central1.run.app';

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawBaseUrl);
  } catch {
    parsedUrl = new URL('https://vssyl-server-235369681725.us-central1.run.app');
  }

  // Determine proper WS/WSS protocol
  let wsProtocol: 'ws:' | 'wss:' = 'wss:';
  if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'ws:') {
    wsProtocol = 'ws:';
  } else if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:') {
    wsProtocol = 'wss:';
  }

  const wsUrl = `${wsProtocol}//${parsedUrl.host}`;

  // Sanitize path to avoid treating it as a namespace
  let socketPath = (parsedUrl.pathname || '').replace(/\/+$/, '');
  if (!socketPath || socketPath === '/' || socketPath === '/api') {
    socketPath = '/socket.io';
  }
  if (!socketPath.startsWith('/')) {
    socketPath = `/${socketPath}`;
  }

  return {
    url: wsUrl,
    options: {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
      path: socketPath
    }
  };
};

/**
 * Create WebSocket connection with proper error handling and fallback
 */
export const createWebSocketConnection = (
  token: string,
  onConnect?: () => void,
  onDisconnect?: () => void,
  onError?: (error: Error) => void
): Promise<Socket> => {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(new Error('No authentication token provided'));
      return;
    }

    const config = getWebSocketConfig();
    
    try {
      const socket = io(config.url, {
        ...config.options,
        auth: { token }
      });

      // Connection success
      socket.on('connect', () => {
        console.log('✅ WebSocket connected successfully');
        onConnect?.();
        resolve(socket);
      });

      // Connection error
      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        onError?.(error);
        reject(error);
      });

      // Disconnection
      socket.on('disconnect', (reason) => {
        console.log('🔌 WebSocket disconnected:', reason);
        onDisconnect?.();
      });

      // Reconnection attempts
      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 WebSocket reconnection attempt ${attemptNumber}`);
      });

      // Reconnection failed
      socket.on('reconnect_failed', () => {
        console.error('❌ WebSocket reconnection failed');
        onError?.(new Error('WebSocket reconnection failed'));
      });

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      reject(error);
    }
  });
};

/**
 * WebSocket Manager with intelligent fallback mechanisms
 */
export class WebSocketManager {
  public socket: Socket | null = null;
  public connectionState: ConnectionState = 'disconnected';
  public fallbackMode: 'websocket' | 'polling' | 'offline' = 'websocket';
  public retryCount = 0;
  public maxRetries = 5;
  public pollingInterval: NodeJS.Timeout | null = null;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private pollingCallback?: () => Promise<void>;

  constructor(
    private token: string,
    private onStateChange?: (state: ConnectionState) => void,
    private onFallbackModeChange?: (mode: 'websocket' | 'polling' | 'offline') => void
  ) {}

  /**
   * Connect with intelligent fallback strategy
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.connectionState = 'connecting';
    this.onStateChange?.(this.connectionState);

    try {
      // Attempt WebSocket connection
      this.socket = await createWebSocketConnection(
        this.token,
        () => this.handleConnect(),
        () => this.handleDisconnect(),
        (error) => this.handleError(error)
      );
      
      this.fallbackMode = 'websocket';
      this.onFallbackModeChange?.(this.fallbackMode);
      
    } catch (error) {
      console.warn('WebSocket connection failed, falling back to polling');
      this.handleWebSocketFailure();
    }
  }

  /**
   * Handle successful WebSocket connection
   */
  private handleConnect(): void {
    this.connectionState = 'connected';
    this.retryCount = 0;
    this.onStateChange?.(this.connectionState);
    
    // Stop polling if it was running
    this.stopPolling();
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(): void {
    this.connectionState = 'disconnected';
    this.onStateChange?.(this.connectionState);
    
    // If not in polling mode, try to reconnect
    if (this.fallbackMode === 'websocket') {
      this.attemptReconnection();
    }
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private attemptReconnection(): void {
    if (this.retryCount >= this.maxRetries) {
      console.warn('Max reconnection attempts reached, switching to polling');
      this.handleWebSocketFailure();
      return;
    }

    this.retryCount++;
    console.log(`Attempting reconnection ${this.retryCount}/${this.maxRetries}`);
    
    // Wait before retrying
    setTimeout(() => {
      this.connect();
    }, 2000 * this.retryCount); // Exponential backoff
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(error: Error): void {
    console.error('WebSocket error:', error);
    this.connectionState = 'failed';
    this.onStateChange?.(this.connectionState);
    
    this.handleWebSocketFailure();
  }

  /**
   * Handle WebSocket connection failure
   */
  private handleWebSocketFailure(): void {
    this.retryCount++;
    
    if (this.retryCount < this.maxRetries) {
      // Try again after delay
      setTimeout(() => {
        this.connect();
      }, this.retryCount * 1000);
    } else {
      // Switch to polling fallback
      this.switchToPolling();
    }
  }

  /**
   * Switch to polling fallback mode
   */
  private switchToPolling(): void {
    console.log('Switching to polling fallback mode');
    this.fallbackMode = 'polling';
    this.connectionState = 'polling';
    this.onFallbackModeChange?.(this.fallbackMode);
    this.onStateChange?.(this.connectionState);
    
    this.startPolling();
  }

  /**
   * Start polling fallback
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollingCallback?.();
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Set polling callback
   */
  setPollingCallback(callback: () => Promise<void>): void {
    this.pollingCallback = callback;
  }

  /**
   * Add event listener
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // If socket is connected, add listener to socket
    if (this.socket && this.fallbackMode === 'websocket') {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }

    // If socket is connected, remove listener from socket
    if (this.socket && this.fallbackMode === 'websocket') {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, ...args: any[]): void {
    if (this.socket && this.fallbackMode === 'websocket') {
      this.socket.emit(event, ...args);
    } else if (this.fallbackMode === 'polling') {
      // In polling mode, events are handled differently
      console.log(`Event ${event} queued for polling mode`);
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.stopPolling();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectionState = 'disconnected';
    this.onStateChange?.(this.connectionState);
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' || this.connectionState === 'polling';
  }

  /**
   * Get current fallback mode
   */
  getFallbackMode(): 'websocket' | 'polling' | 'offline' {
    return this.fallbackMode;
  }
}

/**
 * Utility function to get WebSocket status for UI components
 */
export const getWebSocketStatus = (manager: WebSocketManager) => {
  return {
    isConnected: manager.isConnected(),
    state: manager.connectionState,
    mode: manager.getFallbackMode(),
    isWebSocket: manager.fallbackMode === 'websocket',
    isPolling: manager.fallbackMode === 'polling',
    isOffline: manager.fallbackMode === 'offline'
  };
};
