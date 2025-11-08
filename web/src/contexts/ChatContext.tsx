'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Conversation, Message, MessageReaction, Thread } from 'shared/types/chat';
import { chatAPI } from '../api/chat';
import { uploadFile } from '../api/drive';
import { useDashboard } from './DashboardContext';

interface ChatContextType {
  // State
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setActiveConversation: (conversation: Conversation | null) => void;
  sendMessage: (content: string, fileIds?: string[], replyToId?: string, threadId?: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  createConversation: (type: 'DIRECT' | 'GROUP', participantIds: string[], name?: string) => Promise<Conversation>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  uploadFile: (file: File) => Promise<string>;
  
  // Thread Management
  loadThreads: (conversationId: string) => Promise<Thread[]>;
  loadThreadMessages: (conversationId: string, threadId: string) => Promise<Message[]>;
  createThread: (conversationId: string, name: string, type?: string) => Promise<Thread>;
  
  // UI State
  replyToMessage: Message | null;
  setReplyToMessage: (message: Message | null) => void;
  attachments: Array<{ file: File; id: string; uploading: boolean; error?: string }>;
  addAttachment: (file: File) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  setDashboardOverride: (dashboardId: string) => void;
  clearDashboardOverride: (dashboardId?: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { currentDashboardId } = useDashboard();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [attachments, setAttachments] = useState<Array<{ file: File; id: string; uploading: boolean; error?: string }>>([]);
  const [dashboardOverride, setDashboardOverrideState] = useState<string | null>(null);
  
  const effectiveDashboardId = dashboardOverride ?? currentDashboardId ?? undefined;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      setIsLoading(true);
      setError(null);
      // Pass dashboardId to filter conversations by context
      const response = await chatAPI.getConversations(session.accessToken, effectiveDashboardId);
      const conversationsData = Array.isArray(response) ? response : [];
      setConversations(conversationsData);
      
      // Calculate unread count
      const totalUnread = conversationsData.reduce((count, conv) => {
        const unread = conv.messages?.filter(msg => 
          msg.senderId !== session.user?.id && 
          !msg.readReceipts?.some(receipt => receipt.userId === session.user?.id)
        ).length || 0;
        return count + unread;
      }, 0);
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, session?.user?.id, effectiveDashboardId]);

  // Load messages for active conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!session?.accessToken) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await chatAPI.getMessages(conversationId, session.accessToken);
      const messagesData = Array.isArray(response) ? response : [];
      setMessages(messagesData);
      // Scroll to bottom is now handled by individual components
    } catch (error) {
      console.error('Failed to load messages:', error);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken]);

  // Attachment management
  const addAttachment = useCallback((file: File) => {
    const id = Math.random().toString(36).substr(2, 9);
    setAttachments(prev => [...prev, { file, id, uploading: false }]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const setDashboardOverride = useCallback((dashboardId: string) => {
    setDashboardOverrideState(previous => (previous === dashboardId ? previous : dashboardId));
  }, []);

  const clearDashboardOverride = useCallback((dashboardId?: string) => {
    setDashboardOverrideState(previous => {
      if (!previous) {
        return previous;
      }

      if (dashboardId && previous !== dashboardId) {
        return previous;
      }

      return null;
    });
  }, []);

  // Send message
  const sendMessage = useCallback(async (content: string, fileIds?: string[], replyToId?: string, threadId?: string) => {
    if (!activeConversation?.id || !session?.accessToken) return;

    try {
      // Determine the threadId based on the context
      let finalThreadId: string | undefined = threadId;
      
      if (replyToId && !threadId) {
        // If replying to a message and no threadId provided, get the threadId of the replied message
        const repliedMessage = messages.find(m => m.id === replyToId);
        finalThreadId = repliedMessage?.threadId || undefined;
      }
      
      await chatAPI.sendMessage(
        activeConversation.id,
        content,
        session.accessToken,
        finalThreadId, // threadId - either provided directly or from replied message
        replyToId, // replyToId - the message being replied to
        fileIds
      );
      setReplyToMessage(null);
      clearAttachments();
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message');
    }
  }, [activeConversation?.id, session?.accessToken, clearAttachments, setReplyToMessage, messages]);

  // Add reaction
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!session?.accessToken) return;

    try {
      await chatAPI.addReaction(messageId, emoji, session.accessToken);
    } catch (error) {
      console.error('Failed to add reaction:', error);
      setError('Failed to add reaction');
    }
  }, [session?.accessToken]);

  // Remove reaction
  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!session?.accessToken) return;

    try {
      await chatAPI.removeReaction(messageId, emoji, session.accessToken);
    } catch (error) {
      console.error('Failed to remove reaction:', error);
      setError('Failed to remove reaction');
    }
  }, [session?.accessToken]);

  // Create conversation
  const createConversation = useCallback(async (type: 'DIRECT' | 'GROUP', participantIds: string[], name?: string) => {
    if (!session?.accessToken) throw new Error('No access token');

    try {
      const newConversation = await chatAPI.createConversation(
        type,
        participantIds,
        session.accessToken,
        name,
        effectiveDashboardId
      );
      
      setConversations(prev => [newConversation, ...prev]);
      return newConversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }, [session?.accessToken, effectiveDashboardId]);

  // Upload file
  const uploadFileToChat = useCallback(async (file: File): Promise<string> => {
    if (!session?.accessToken) throw new Error('No access token');

    try {
      const uploadedFile = await uploadFile(
        session.accessToken,
        file,
        undefined,
        true // isChatFile
      );
      return uploadedFile.id;
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }, [session?.accessToken]);

  // Thread Management Functions
  const loadThreads = useCallback(async (conversationId: string): Promise<Thread[]> => {
    if (!session?.accessToken) throw new Error('No access token');

    try {
      const threads = await chatAPI.getThreads(conversationId, session.accessToken);
      return threads;
    } catch (error) {
      console.error('Failed to load threads:', error);
      throw error;
    }
  }, [session?.accessToken]);

  const loadThreadMessages = useCallback(async (conversationId: string, threadId: string): Promise<Message[]> => {
    if (!session?.accessToken) throw new Error('No access token');

    try {
      // Use the getMessages API with threadId parameter
      const messages = await chatAPI.getMessages(conversationId, session.accessToken, 1, 50, threadId);
      return messages;
    } catch (error) {
      console.error('Failed to load thread messages:', error);
      throw error;
    }
  }, [session?.accessToken]);

  const createThread = useCallback(async (conversationId: string, name: string, type: string = 'MESSAGE'): Promise<Thread> => {
    if (!session?.accessToken) throw new Error('No access token');

    try {
      const thread = await chatAPI.createThread(conversationId, name, session.accessToken, type as 'MESSAGE' | 'TOPIC' | 'PROJECT' | 'DECISION' | 'DOCUMENTATION');
      return thread;
    } catch (error) {
      console.error('Failed to create thread:', error);
      throw error;
    }
  }, [session?.accessToken]);

  // WebSocket event handlers
  const handleNewMessage = useCallback((message: Message) => {
    if (message.conversationId === activeConversation?.id) {
      setMessages(prev => {
        const exists = prev.some(m => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
      // Scroll to bottom is now handled by individual components
    }
    
    // Update conversations with new message
    setConversations(prev => prev.map(conv => {
      if (conv.id === message.conversationId) {
        return {
          ...conv,
          messages: [...(conv.messages || []), message],
          lastMessageAt: message.createdAt
        };
      }
      return conv;
    }));
  }, [activeConversation?.id]);

  const handleReactionUpdate = useCallback((data: { messageId: string; reaction: MessageReaction; action: 'added' | 'removed' }) => {
    setMessages(prev => prev.map(message => {
      if (message.id === data.messageId) {
        if (data.action === 'added') {
          return {
            ...message,
            reactions: [...(message.reactions || []), data.reaction]
          };
        } else {
          return {
            ...message,
            reactions: (message.reactions || []).filter(r => 
              !(r.emoji === data.reaction.emoji && r.userId === data.reaction.userId)
            )
          };
        }
      }
      return message;
    }));
  }, []);

  // Connect to WebSocket and set up event listeners
  useEffect(() => {
    const connectToChat = async () => {
      if (!session?.accessToken) return;

      try {
        await chatAPI.connect();
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to connect to chat:', error);
        setIsConnected(false);
      }
    };

    connectToChat();

    // Set up event listeners
    chatAPI.on('message:new', handleNewMessage);
    chatAPI.on('message_reaction', handleReactionUpdate);

    return () => {
      chatAPI.off('message:new', handleNewMessage);
      chatAPI.off('message_reaction', handleReactionUpdate);
    };
  }, [session?.accessToken]);

  // Load conversations on mount and when session changes
  useEffect(() => {
    if (session?.accessToken) {
      loadConversations();
    }
  }, [session?.accessToken, loadConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversation?.id) {
      loadMessages(activeConversation.id);
    } else {
      setMessages([]);
    }
  }, [activeConversation?.id, loadMessages]);

  // Join conversation when it changes
  useEffect(() => {
    if (activeConversation?.id && isConnected) {
      chatAPI.joinConversation(activeConversation.id);
    }
  }, [activeConversation?.id, isConnected]);

  const value: ChatContextType = {
    // State
    conversations,
    activeConversation,
    messages,
    unreadCount,
    isConnected,
    isLoading,
    error,
    
    // Actions
    setActiveConversation,
    sendMessage,
    addReaction,
    removeReaction,
    createConversation,
    loadConversations,
    loadMessages,
    uploadFile: uploadFileToChat,
    
    // Thread Management
    loadThreads,
    loadThreadMessages,
    createThread,
    
    // UI State
    replyToMessage,
    setReplyToMessage,
    attachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    setDashboardOverride,
    clearDashboardOverride,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
} 