import { io, Socket } from 'socket.io-client';
import { getSession } from 'next-auth/react';
import { getWebSocketConfig } from '../lib/websocketUtils';
import {
  Conversation,
  Message,
  Thread,
  MessageReaction,
  CreateConversationRequest,
  CreateMessageRequest,
  CreateThreadRequest,
  AddReactionRequest
} from 'shared/types/chat';

// Use relative URLs to go through Next.js API proxy
// This ensures all API calls go through the Next.js API proxy which handles authentication
const API_BASE = '/api/chat';

// Helper function to make authenticated API calls
async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}, 
  token?: string
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Legacy API functions (for backward compatibility)
export const getConversations = async (token: string, dashboardId?: string): Promise<{ success: boolean; data: Conversation[] }> => {
  const params = new URLSearchParams();
  if (dashboardId) {
    params.append('dashboardId', dashboardId);
  }
  
  const queryString = params.toString();
  const endpoint = `/conversations${queryString ? `?${queryString}` : ''}`;
  
  return apiCall(endpoint, { method: 'GET' }, token);
};

export const getConversation = async (id: string, token: string): Promise<{ success: boolean; data: Conversation }> => {
  return apiCall(`/conversations/${id}`, { method: 'GET' }, token);
};

export const createConversation = async (
  conversationData: CreateConversationRequest, 
  token: string
): Promise<{ success: boolean; data: Conversation }> => {
  return apiCall('/conversations', {
    method: 'POST',
    body: JSON.stringify(conversationData),
  }, token);
};

export const getMessages = async (
  conversationId: string, 
  token: string, 
  options: { page?: number; limit?: number; threadId?: string } = {}
): Promise<{ 
  success: boolean; 
  data: Message[]; 
  pagination: { page: number; limit: number; total: number; hasMore: boolean } 
}> => {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.threadId) params.append('threadId', options.threadId);

  const queryString = params.toString();
  const endpoint = `/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`;
  
  return apiCall(endpoint, { method: 'GET' }, token);
};

export const createMessage = async (
  conversationId: string, 
  messageData: CreateMessageRequest, 
  token: string
): Promise<{ success: boolean; data: Message }> => {
  return apiCall(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(messageData),
  }, token);
};

// MessageReaction is imported from shared/types/chat

export interface ReactionResponse {
  messageId: string;
  reaction: MessageReaction;
  action: 'added' | 'removed';
}

export const addReaction = async (
  messageId: string, 
  reactionData: AddReactionRequest, 
  token: string
): Promise<{ success: boolean; data: ReactionResponse; action: 'added' | 'removed' }> => {
  return apiCall(`/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify(reactionData),
  }, token);
};

export const markAsRead = async (
  messageId: string, 
  token: string
): Promise<{ success: boolean; data: { messageId: string; readAt: string } }> => {
  return apiCall(`/messages/${messageId}/read`, {
    method: 'POST',
  }, token);
};

export const getThreads = async (
  conversationId: string, 
  token: string
): Promise<{ success: boolean; data: Thread[] }> => {
  return apiCall(`/conversations/${conversationId}/threads`, { method: 'GET' }, token);
};

export const createThread = async (
  conversationId: string, 
  threadData: CreateThreadRequest, 
  token: string
): Promise<{ success: boolean; data: Thread }> => {
  return apiCall(`/conversations/${conversationId}/threads`, {
    method: 'POST',
    body: JSON.stringify(threadData),
  }, token);
};

// WebSocket Events
export interface ChatSocketEvents {
  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
  
  // Message events
  'message:new': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (messageId: string) => void;
  
  // Typing events
  'typing:start': (data: { conversationId: string; userId: string; userName: string }) => void;
  'typing:stop': (data: { conversationId: string; userId: string }) => void;
  
  // Presence events
  'presence:online': (userId: string) => void;
  'presence:offline': (userId: string) => void;
  
  // Conversation events
  'conversation:joined': (conversationId: string) => void;
  'conversation:left': (conversationId: string) => void;
  
  // Thread events
  'thread:new': (thread: Thread) => void;
  'thread:updated': (thread: Thread) => void;
  
  // Reaction events
  'message_reaction': (data: { messageId: string; reaction: MessageReaction; action: 'added' | 'removed' }) => void;
  
  // Error events
  'error': (error: { message: string; code?: string }) => void;
}

// Chat API Client with WebSocket support
class ChatAPI {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  // WebSocket Management
  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const session = await getSession();
    if (!session?.accessToken) {
      console.warn('No access token available for WebSocket connection');
      return;
    }

    try {
      // Use centralized WebSocket configuration
      const config = getWebSocketConfig();
      
      this.socket = io(config.url, {
        ...config.options,
        auth: {
          token: session.accessToken
        },
        forceNew: true
      });

      this.setupSocketListeners();
    } catch (_error) {
      // Failed to initialize WebSocket connection - non-critical, silent fail
      // Don't throw - let the application continue without WebSocket
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      // Connected to chat server
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (_reason: string) => {
      // Disconnected from chat server
      this.handleReconnect();
    });

    this.socket.on('error', (error: { message: string; code?: string }) => {
      console.error('❌ Chat socket error:', error);
    });

    // Handle specific events with proper typing
    this.socket.on('message_received', (message: Message) => {
      this.emitToListeners('message:new', message);
    });

    this.socket.on('user_typing', (data: { conversationId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (data.isTyping) {
        this.emitToListeners('typing:start', data);
      } else {
        this.emitToListeners('typing:stop', { conversationId: data.conversationId, userId: data.userId });
      }
    });

    this.socket.on('message_reaction', (data: { messageId: string; reaction: MessageReaction; action: 'added' | 'removed' }) => {
      this.emitToListeners('message_reaction', data);
    });

    // Forward other events to listeners
    const otherEvents = [
      'message:updated', 'message:deleted', 'presence:online', 'presence:offline',
      'conversation:joined', 'conversation:left', 'thread:new', 'thread:updated'
    ];

    otherEvents.forEach(event => {
      this.socket!.on(event, (...args) => {
        this.emitToListeners(event, ...args);
      });
    });
  }

  private emitToListeners(event: string, ...args: unknown[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Event Listeners
  on<T extends keyof ChatSocketEvents>(event: T, listener: ChatSocketEvents[T]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners
      .get(event)!
      .add(listener as unknown as (...args: unknown[]) => void);
    
    if (this.socket) {
      this.socket.on(event as string, listener as (...args: any[]) => void);
    }
  }

  off<T extends keyof ChatSocketEvents>(event: T, listener: ChatSocketEvents[T]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener as unknown as (...args: unknown[]) => void);
    }
    
    if (this.socket) {
      this.socket.off(event as string, listener as (...args: any[]) => void);
    }
  }

  // Real-time Actions
  joinConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_conversation', conversationId);
    }
  }

  leaveConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_conversation', conversationId);
    }
  }

  startTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing_start', { conversationId, isTyping: true });
    }
  }

  stopTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing_stop', { conversationId, isTyping: false });
    }
  }

  // REST API Methods
  async getConversations(token?: string, dashboardId?: string): Promise<Conversation[]> {
    const params = new URLSearchParams();
    if (dashboardId) {
      params.append('dashboardId', dashboardId);
    }
    
    const queryString = params.toString();
    const endpoint = `/conversations${queryString ? `?${queryString}` : ''}`;

    const result = await apiCall<{ success: boolean; data: Conversation[] }>(endpoint, { method: 'GET' }, token);
    return result.data || result; // Handle both { success, data } and direct response
  }

  async getConversation(id: string, token?: string): Promise<Conversation> {
    const result = await apiCall<{ success: boolean; data: Conversation }>(`/conversations/${id}`, { method: 'GET' }, token);
    return result.data || result; // Handle both { success, data } and direct response
  }

  async getMessages(conversationId: string, token?: string, page = 1, limit = 50, threadId?: string): Promise<Message[]> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (threadId) {
      params.append('threadId', threadId);
    }

    const endpoint = `/conversations/${conversationId}/messages?${params.toString()}`;
    const result = await apiCall<{ success: boolean; data: Message[] }>(endpoint, { method: 'GET' }, token);
    return result.data || result; // Handle both { success, data } and direct response
  }

  async sendMessage(conversationId: string, content: string, token?: string, threadId?: string, replyToId?: string, fileIds?: string[]): Promise<Message> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('Adding authorization header:', `Bearer ${token.substring(0, 20)}...`);
    } else {
      console.log('No token provided for sendMessage');
    }

    const requestBody = {
      content,
      threadId,
      replyToId,
      fileIds,
    };

    console.log('Sending message request:', {
      url: `/api/chat/conversations/${conversationId}/messages`,
      method: 'POST',
      headers,
      body: requestBody
    });

    const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error('Failed to send message');
    }

    const result = await response.json();
    return result.data || result; // Handle both { success, data } and direct response
  }

  async updateMessage(messageId: string, content: string, token?: string): Promise<Message> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/chat/messages/${messageId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to update message');
    }

    const result = await response.json();
    return result.data || result; // Handle both { success, data } and direct response
  }

  async deleteMessage(messageId: string, token?: string): Promise<void> {
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/chat/messages/${messageId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to delete message');
    }
  }

  async createConversation(type: 'DIRECT' | 'GROUP' | 'CHANNEL', participantIds: string[], token?: string, name?: string, dashboardId?: string): Promise<Conversation> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type,
        participantIds,
        name,
        dashboardId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }

    const result = await response.json();
    return result.data || result; // Handle both { success, data } and direct response
  }

  async getThreads(conversationId: string, token?: string): Promise<Thread[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/chat/conversations/${conversationId}/threads`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch threads');
    }

    const result = await response.json();
    return result.data || result; // Handle both { success, data } and direct response
  }

  async createThread(conversationId: string, name: string, token?: string, type: 'MESSAGE' | 'TOPIC' | 'PROJECT' | 'DECISION' | 'DOCUMENTATION' = 'TOPIC'): Promise<Thread> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/chat/conversations/${conversationId}/threads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        type,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create thread');
    }

    const result = await response.json();
    return result.data || result; // Handle both { success, data } and direct response
  }

  async addReaction(messageId: string, emoji: string, token?: string): Promise<MessageReaction> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('Adding authorization header for reaction:', `Bearer ${token.substring(0, 20)}...`);
    } else {
      console.log('No token provided for addReaction');
    }

    const requestBody = { emoji };
    console.log('Adding reaction request:', {
      url: `/api/chat/messages/${messageId}/reactions`,
      method: 'POST',
      headers,
      body: requestBody
    });

    const response = await fetch(`/api/chat/messages/${messageId}/reactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log('Reaction response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Reaction API error response:', errorText);
      throw new Error('Failed to add reaction');
    }

    const result = await response.json();
    return result.data || result; // Handle both { success, data } and direct response
  }

  async removeReaction(messageId: string, emoji: string, token?: string): Promise<void> {
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/chat/messages/${messageId}/reactions/${emoji}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to remove reaction');
    }
  }

  async markAsRead(messageId: string, token?: string): Promise<void> {
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/chat/messages/${messageId}/read`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to mark message as read');
    }
  }

  // Utility Methods
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    return 'connecting';
  }
}

// Export singleton instance
export const chatAPI = new ChatAPI();
export default chatAPI;