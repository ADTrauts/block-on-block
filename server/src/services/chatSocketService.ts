import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../utils/tokenUtils';
import { logger } from '../lib/logger';

interface AuthenticatedSocket {
  userId: string;
  userEmail: string;
  userName?: string;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'FILE' | 'SYSTEM' | 'REACTION';
  createdAt: string;
}

interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

interface PresenceEvent {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: string;
}

interface AuthenticatedSocketData {
  user: AuthenticatedSocket;
}

interface SocketWithData extends Socket {
  data: AuthenticatedSocketData;
}

interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  createdAt: string;
  read: boolean;
}

export class ChatSocketService {
  private io: SocketIOServer;
  private userSockets: Map<string, string> = new Map(); // userId -> socketId
  private socketUsers: Map<string, AuthenticatedSocket> = new Map(); // socketId -> user
  private typingUsers: Map<string, Set<string>> = new Map(); // conversationId -> Set of userIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
              cors: {
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowed = [
          process.env.FRONTEND_URL || 'https://vssyl.com',
          'https://vssyl.com',
          'https://vssyl-web-235369681725.us-central1.run.app', // Cloud Run web service
          'wss://vssyl.com', // WebSocket origin
          'wss://vssyl-web-235369681725.us-central1.run.app', // WebSocket origin
          'http://localhost:3000', // Dev: browser Origin from Next.js
          'http://localhost:3002', // Dev: alternate Next.js port
          'ws://localhost:3000', // Development WebSocket
          'ws://localhost:3002' // Development WebSocket
        ];
          if (!origin || allowed.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS not allowed for origin: ${origin}`));
          }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          await logger.warn('Socket auth failed: No token provided', {
            operation: 'socket_auth_no_token'
          });
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = await verifyToken(token);
        if (!decoded) {
          await logger.warn('Socket auth failed: Invalid token', {
            operation: 'socket_auth_invalid_token'
          });
          return next(new Error('Authentication error: Invalid token'));
        }

        // Get user details from database
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, name: true }
        });

        if (!user) {
          await logger.warn('Socket auth failed: User not found', {
            operation: 'socket_auth_user_not_found',
            userId: decoded.userId
          });
          return next(new Error('Authentication error: User not found'));
        }

        socket.data.user = {
          userId: user.id,
          userEmail: user.email,
          userName: user.name || undefined
        };

        next();
      } catch (error) {
        await logger.error('Socket auth error', {
          operation: 'socket_auth_error',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        next(new Error('Authentication error: ' + error));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const user = socket.data.user as AuthenticatedSocket;
      
      logger.info('User connected to socket', {
        operation: 'socket_user_connected',
        userId: user.userId,
        userEmail: user.userEmail
      });
      
      // Store socket mappings
      this.userSockets.set(user.userId, socket.id);
      this.socketUsers.set(socket.id, user);

      // Add a reference to the io server on the socket for external use
      socket.data.io = this.io;

      // Join user to their conversations
      this.joinUserToConversations(socket, user.userId);

      // Handle conversation join
      socket.on('join_conversation', (conversationId: string) => {
        this.joinConversation(socket, conversationId);
      });

      // Handle conversation leave
      socket.on('leave_conversation', (conversationId: string) => {
        this.leaveConversation(socket, conversationId);
      });

      // Handle typing events
      socket.on('typing_start', (data: TypingEvent) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data: TypingEvent) => {
        this.handleTypingStop(socket, data);
      });

      // Handle new message
      socket.on('new_message', async (message: ChatMessage) => {
        await this.handleNewMessage(socket, message);
      });

      // Handle message reactions
      socket.on('message_reaction', async (data: { messageId: string; emoji: string }) => {
        await this.handleMessageReaction(socket, data);
      });

      // Handle read receipts
      socket.on('mark_read', async (messageId: string) => {
        await this.handleMarkAsRead(socket, messageId);
      });

      // Handle presence updates
      socket.on('presence_update', (data: PresenceEvent) => {
        this.handlePresenceUpdate(socket, data);
      });

      // Handle scheduling room joins
      socket.on('join_business', (businessId: string) => {
        socket.join(`business_${businessId}`);
        logger.debug('User joined business room', {
          operation: 'socket_join_business',
          businessId,
          userId: user.userId
        });
      });

      socket.on('join_schedule', (scheduleId: string) => {
        socket.join(`schedule_${scheduleId}`);
        logger.debug('User joined schedule room', {
          operation: 'socket_join_schedule',
          scheduleId,
          userId: user.userId
        });
      });

      socket.on('leave_schedule', (scheduleId: string) => {
        socket.leave(`schedule_${scheduleId}`);
        logger.debug('User left schedule room', {
          operation: 'socket_leave_schedule',
          scheduleId,
          userId: user.userId
        });
      });

      socket.on('leave_business', (businessId: string) => {
        socket.leave(`business_${businessId}`);
        logger.debug('User left business room', {
          operation: 'socket_leave_business',
          businessId,
          userId: user.userId
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async joinUserToConversations(socket: SocketWithData, userId: string) {
    try {
      // Get all conversations where user is a participant
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              userId: userId,
              isActive: true
            }
          }
        },
        select: { id: true }
      });

      // Join socket to all conversations
      conversations.forEach((conversation: { id: string }) => {
        socket.join(`conversation_${conversation.id}`);
      });

      // Join user to their personal room for direct messages
      socket.join(`user_${userId}`);

      await logger.info('User joined conversations', {
        operation: 'socket_user_joined_conversations',
        userId,
        count: conversations.length
      });
    } catch (error) {
      await logger.error('Failed to join user to conversations', {
        operation: 'socket_join_conversations_error',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    }
  }

  private joinConversation(socket: SocketWithData, conversationId: string) {
    socket.join(`conversation_${conversationId}`);
    logger.debug('User joined conversation', {
      operation: 'socket_join_conversation',
      conversationId
    });
  }

  private leaveConversation(socket: SocketWithData, conversationId: string) {
    socket.leave(`conversation_${conversationId}`);
    logger.debug('User left conversation', {
      operation: 'socket_leave_conversation',
      conversationId
    });
  }

  private handleTypingStart(socket: SocketWithData, data: TypingEvent) {
    const user = socket.data.user as AuthenticatedSocket;
    
    if (!this.typingUsers.has(data.conversationId)) {
      this.typingUsers.set(data.conversationId, new Set());
    }
    
    this.typingUsers.get(data.conversationId)!.add(user.userId);
    
    socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      userId: user.userId,
      userName: user.userName,
      isTyping: true
    });
  }

  private handleTypingStop(socket: SocketWithData, data: TypingEvent) {
    const user = socket.data.user as AuthenticatedSocket;
    
    const typingSet = this.typingUsers.get(data.conversationId);
    if (typingSet) {
      typingSet.delete(user.userId);
      if (typingSet.size === 0) {
        this.typingUsers.delete(data.conversationId);
      }
    }
    
    socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      userId: user.userId,
      userName: user.userName,
      isTyping: false
    });
  }

  private async handleNewMessage(socket: SocketWithData, message: ChatMessage) {
    const user = socket.data.user as AuthenticatedSocket;
    
    try {
      // Verify user is part of the conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: message.conversationId,
          userId: user.userId,
          isActive: true
        }
      });

      if (!participant) {
        socket.emit('error', { message: 'Not a member of this conversation' });
        return;
      }

      // Broadcast message to conversation
      this.io.to(`conversation_${message.conversationId}`).emit('message_received', {
        ...message,
        sender: {
          id: user.userId,
          name: user.userName,
          email: user.userEmail
        }
      });

      // Update conversation's last message timestamp
      await prisma.conversation.update({
        where: { id: message.conversationId },
        data: { lastMessageAt: new Date() }
      });

      await logger.info('Message broadcasted in conversation', {
        operation: 'socket_message_broadcasted',
        conversationId: message.conversationId
      });
    } catch (error) {
      await logger.error('Failed to handle new message', {
        operation: 'socket_handle_new_message',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private async handleMessageReaction(socket: SocketWithData, data: { messageId: string; emoji: string }) {
    const user = socket.data.user as AuthenticatedSocket;
    
    try {
      // Save reaction to database
      const reaction = await prisma.messageReaction.upsert({
        where: {
          messageId_userId_emoji: {
            messageId: data.messageId,
            userId: user.userId,
            emoji: data.emoji
          }
        },
        update: {
          emoji: data.emoji
        },
        create: {
          messageId: data.messageId,
          userId: user.userId,
          emoji: data.emoji
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Get message to find conversation
      const message = await prisma.message.findUnique({
        where: { id: data.messageId },
        select: { conversationId: true }
      });

      if (message) {
        // Broadcast reaction to conversation
        this.io.to(`conversation_${message.conversationId}`).emit('message_reaction', {
          messageId: data.messageId,
          reaction: {
            id: reaction.id,
            messageId: reaction.messageId,
            userId: reaction.userId,
            emoji: reaction.emoji,
            createdAt: reaction.createdAt,
            user: reaction.user
          }
        });
      }
    } catch (error) {
      await logger.error('Failed to handle message reaction', {
        operation: 'socket_handle_reaction',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  }

  private async handleMarkAsRead(socket: SocketWithData, messageId: string) {
    const user = socket.data.user as AuthenticatedSocket;
    
    try {
      // Save read receipt to database
      const readReceipt = await prisma.readReceipt.upsert({
        where: {
          messageId_userId: {
            messageId: messageId,
            userId: user.userId
          }
        },
        update: {
          readAt: new Date()
        },
        create: {
          messageId: messageId,
          userId: user.userId,
          readAt: new Date()
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Get message to find conversation
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true }
      });

      if (message) {
        // Broadcast read receipt to conversation
        this.io.to(`conversation_${message.conversationId}`).emit('message_read', {
          messageId: messageId,
          readReceipt: {
            id: readReceipt.id,
            messageId: readReceipt.messageId,
            userId: readReceipt.userId,
            readAt: readReceipt.readAt,
            user: readReceipt.user
          }
        });
      }
    } catch (error) {
      await logger.error('Failed to handle mark as read', {
        operation: 'socket_handle_mark_read',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      socket.emit('error', { message: 'Failed to mark as read' });
    }
  }

  private handlePresenceUpdate(socket: SocketWithData, data: PresenceEvent) {
    const user = socket.data.user as AuthenticatedSocket;
    
    // Broadcast presence update to all connected users
    this.io.emit('user_presence', {
      userId: user.userId,
      userName: user.userName,
      status: data.status,
      lastSeen: data.lastSeen
    });
  }

  private handleDisconnect(socket: SocketWithData) {
    const user = this.socketUsers.get(socket.id);
    if (user) {
      this.userSockets.delete(user.userId);
      this.socketUsers.delete(socket.id);
      logger.info('User disconnected from socket', {
        operation: 'socket_user_disconnected',
        userId: user.userId,
        userEmail: user.userEmail
      });

      // Clean up typing status
      this.typingUsers.forEach((users, conversationId) => {
        if (users.has(user.userId)) {
          users.delete(user.userId);
          this.io.to(`conversation_${conversationId}`).emit('user_typing', {
            conversationId: conversationId,
            userId: user.userId,
            userName: user.userName,
            isTyping: false
          });
        }
      });
    }
  }

  // Public methods for external use
  public broadcastMessage(conversationId: string, message: Record<string, unknown>) {
    this.io.to(`conversation_${conversationId}`).emit('message_received', message);
  }

  public broadcastToUser(userId: string, event: string, data: Record<string, unknown>) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  public broadcastNotification(userId: string, notification: NotificationEvent) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('new_notification', notification);
    }
  }

  public broadcastNotificationToMultipleUsers(userIds: string[], notification: NotificationEvent) {
    userIds.forEach(userId => {
      this.broadcastNotification(userId, notification);
    });
  }

  public broadcastNotificationUpdate(userId: string, notificationId: string, updates: Record<string, unknown>) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('notification_updated', {
        id: notificationId,
        ...updates
      });
    }
  }

  public broadcastNotificationDelete(userId: string, notificationId: string) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('notification_deleted', { id: notificationId });
    }
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  // ============================================================================
  // DRIVE MODULE BROADCASTS
  // ============================================================================

  /**
   * Broadcast a drive event to a specific user.
   * Used for real-time updates in the Drive module (file/folder changes).
   */
  public broadcastDriveEvent(
    userId: string,
    event: 'drive:item:created' | 'drive:item:updated' | 'drive:item:deleted' | 'drive:item:moved' | 'drive:item:pinned',
    data: Record<string, unknown>
  ) {
    const payload = {
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.broadcastToUser(userId, event, payload);
    logger.debug('Drive event broadcasted to user', {
      operation: 'socket_drive_broadcast',
      userId,
      event,
    });
  }

  // ============================================================================
  // SCHEDULING MODULE BROADCASTS
  // ============================================================================

  /**
   * Broadcast scheduling event to all users in a business
   */
  public broadcastToBusiness(businessId: string, event: string, data: Record<string, unknown>) {
    this.io.to(`business_${businessId}`).emit(event, data);
    logger.debug('Scheduling event broadcasted to business', {
      operation: 'socket_scheduling_broadcast',
      businessId,
      event
    });
  }

  /**
   * Broadcast scheduling event to all users viewing a specific schedule
   */
  public broadcastToSchedule(scheduleId: string, event: string, data: Record<string, unknown>) {
    this.io.to(`schedule_${scheduleId}`).emit(event, data);
    logger.debug('Scheduling event broadcasted to schedule', {
      operation: 'socket_scheduling_broadcast',
      scheduleId,
      event
    });
  }

  /**
   * Broadcast shift created event
   */
  public broadcastShiftCreated(businessId: string, scheduleId: string, shift: Record<string, unknown>) {
    const eventData = {
      businessId,
      scheduleId,
      shift,
      timestamp: new Date().toISOString()
    };
    this.broadcastToSchedule(scheduleId, 'schedule:shift:created', eventData);
    this.broadcastToBusiness(businessId, 'schedule:shift:created', eventData);
  }

  /**
   * Broadcast shift updated event
   */
  public broadcastShiftUpdated(businessId: string, scheduleId: string, shift: Record<string, unknown>) {
    const eventData = {
      businessId,
      scheduleId,
      shift,
      timestamp: new Date().toISOString()
    };
    this.broadcastToSchedule(scheduleId, 'schedule:shift:updated', eventData);
    this.broadcastToBusiness(businessId, 'schedule:shift:updated', eventData);
  }

  /**
   * Broadcast shift deleted event
   */
  public broadcastShiftDeleted(businessId: string, scheduleId: string, shiftId: string) {
    const eventData = {
      businessId,
      scheduleId,
      shiftId,
      timestamp: new Date().toISOString()
    };
    this.broadcastToSchedule(scheduleId, 'schedule:shift:deleted', eventData);
    this.broadcastToBusiness(businessId, 'schedule:shift:deleted', eventData);
  }

  /**
   * Broadcast schedule published event
   */
  public broadcastSchedulePublished(businessId: string, scheduleId: string, schedule: Record<string, unknown>) {
    const eventData = {
      businessId,
      scheduleId,
      schedule,
      timestamp: new Date().toISOString()
    };
    this.broadcastToBusiness(businessId, 'schedule:published', eventData);
  }

  /**
   * Join user to business and schedule rooms for scheduling updates
   */
  public joinSchedulingRooms(socket: SocketWithData, businessId: string, scheduleId?: string) {
    socket.join(`business_${businessId}`);
    if (scheduleId) {
      socket.join(`schedule_${scheduleId}`);
    }
    logger.debug('User joined scheduling rooms', {
      operation: 'socket_join_scheduling',
      businessId,
      scheduleId
    });
  }
}

let chatSocketServiceInstance: ChatSocketService;

export const initializeChatSocketService = (server: HTTPServer): ChatSocketService => {
  if (!chatSocketServiceInstance) {
    chatSocketServiceInstance = new ChatSocketService(server);
  }
  return chatSocketServiceInstance;
};

export const getChatSocketService = (): ChatSocketService => {
  if (!chatSocketServiceInstance) {
    throw new Error("ChatSocketService has not been initialized. Call initializeChatSocketService first.");
  }
  return chatSocketServiceInstance;
}; 