'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Conversation, Message } from 'shared/types/chat';
import { useChat } from '../../contexts/ChatContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { toast } from 'react-hot-toast';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import { chatAPI } from '../../api/chat';

interface ChatWindowState {
  activeChat: Conversation | null;
  minimizedChats: Conversation[];
  isSidebarOpen: boolean;
  sidebarWidth: 'thin' | 'expanded';
  searchQuery: string;
  selectedDashboardId: string | null;
  isDocked: boolean;
  isDockedExpanded: boolean;
}

const StackableChatContainer: React.FC = () => {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  
  const { 
    currentDashboardId,
    allDashboards,
    dashboards,
    getDashboardType,
    getDashboardDisplayName,
    isModuleActiveOnDashboard
  } = useDashboard();
  
  // Get all dashboards including business (allDashboards doesn't include business by default)
  const allDashboardsIncludingBusiness = useMemo(() => {
    // Include all business dashboards (they are already deduplicated in DashboardContext)
    const businessDashboards = dashboards.business || [];
    const combined = [...allDashboards, ...businessDashboards];
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('All dashboards including business:', {
        allDashboards: allDashboards.length,
        businessDashboards: businessDashboards.length,
        combined: combined.length,
        businessDashboardsList: businessDashboards.map(d => ({
          id: d.id,
          name: d.name,
          businessId: (d as any).business?.id,
          businessName: (d as any).business?.name,
          widgets: d.widgets?.map(w => w.type)
        }))
      });
    }
    
    return combined;
  }, [allDashboards, dashboards.business]);
  
  // Get dashboards with chat enabled, sorted: personal first, then business
  // NOTE: Chat is a core module that's always available - we don't need to check for widgets
  const chatDashboards = useMemo(() => {
    // Chat is always available on all dashboards - it's a core module
    // We just need to filter out any invalid dashboards
    const filtered = allDashboardsIncludingBusiness.filter(d => {
      // All dashboards have chat available - it's a core module
      return !!d.id;
    });
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Chat] All dashboards (chat always available):', {
        total: filtered.length,
        dashboards: filtered.map(d => ({
          id: d.id,
          name: d.name,
          type: getDashboardType(d),
          businessId: (d as any).business?.id
        }))
      });
    }
    
    // Sort: personal first, then by type (business, educational, household)
    return filtered.sort((a, b) => {
      const typeA = getDashboardType(a);
      const typeB = getDashboardType(b);
      
      // Personal always first
      if (typeA === 'personal' && typeB !== 'personal') return -1;
      if (typeA !== 'personal' && typeB === 'personal') return 1;
      
      // Within same type, maintain original order
      return 0;
    });
  }, [allDashboardsIncludingBusiness, getDashboardType]);
  
  // Use shared ChatContext for data
  const {
    conversations,
    activeConversation,
    messages,
    unreadCount,
    isConnected,
    isLoading,
    setActiveConversation: setActiveConversationInContext,
    sendMessage: sendMessageViaContext,
    addReaction,
    removeReaction,
    setDashboardOverride,
    clearDashboardOverride,
    loadConversations,
  } = useChat();

  // Local state for chat window management
  const [chatState, setChatState] = useState<ChatWindowState>({
    activeChat: null,
    minimizedChats: [],
    isSidebarOpen: true,
    sidebarWidth: 'expanded',
    searchQuery: '',
    selectedDashboardId: null,
    isDocked: true, // Use docked mode by default
    isDockedExpanded: false
  });
  
  const [dashboardUnreadCounts, setDashboardUnreadCounts] = useState<Record<string, number>>({});
  
  // Initialize selected dashboard to first personal dashboard
  useEffect(() => {
    if (chatDashboards.length > 0 && !chatState.selectedDashboardId) {
      const firstPersonal = chatDashboards.find(d => getDashboardType(d) === 'personal');
      if (firstPersonal) {
        setChatState(prev => ({ ...prev, selectedDashboardId: firstPersonal.id }));
        setDashboardOverride(firstPersonal.id);
        loadConversations();
      }
    }
  }, [chatDashboards, chatState.selectedDashboardId, getDashboardType, setDashboardOverride, loadConversations]);
  
  // Calculate unread counts per dashboard
  useEffect(() => {
    const calculateUnreadCounts = async () => {
      if (!session?.accessToken || chatDashboards.length === 0) return;
      
      const counts: Record<string, number> = {};
      
      for (const dashboard of chatDashboards) {
        try {
          const response = await chatAPI.getConversations(session.accessToken, dashboard.id);
          const dashboardConversations = Array.isArray(response) ? response : [];
          
          const unread = dashboardConversations.reduce((count, conv) => {
            const unreadMessages = conv.messages?.filter((msg: any) => 
              msg.senderId !== session.user?.id && 
              !msg.readReceipts?.some((receipt: any) => receipt.userId === session.user?.id)
            ).length || 0;
            return count + unreadMessages;
          }, 0);
          
          counts[dashboard.id] = unread;
        } catch (error) {
          console.error(`Failed to load conversations for dashboard ${dashboard.id}:`, error);
          counts[dashboard.id] = 0;
        }
      }
      
      setDashboardUnreadCounts(counts);
    };
    
    calculateUnreadCounts();
    // Recalculate periodically to catch new messages
    const interval = setInterval(calculateUnreadCounts, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [chatDashboards, session?.accessToken, session?.user?.id]);
  
  // Handle dashboard tab click
  const handleDashboardTabClick = (dashboardId: string | null) => {
    if (dashboardId) {
      setDashboardOverride(dashboardId);
      setChatState(prev => ({ ...prev, selectedDashboardId: dashboardId }));
      loadConversations();
    } else {
      clearDashboardOverride();
      setChatState(prev => ({ ...prev, selectedDashboardId: null }));
      loadConversations();
    }
  };

  // Don't render if user is not authenticated or on auth pages
  if (status === 'loading' || status === 'unauthenticated' || !session) {
    return null;
  }

  // Don't render on authentication pages
  if (pathname?.startsWith('/auth/') || pathname === '/auth' || pathname === '/login') {
    return null;
  }

  // Open a chat (main window)
  const openChat = (conversation: Conversation) => {
    setChatState(prev => {
      const newState = { ...prev };
      
      // If there's an active chat, minimize it
      if (prev.activeChat && prev.activeChat.id !== conversation.id) {
        newState.minimizedChats = [prev.activeChat, ...prev.minimizedChats];
      }
      
      // Set new active chat
      newState.activeChat = conversation;
      
      return newState;
    });

    // Update the global ChatContext
    setActiveConversationInContext(conversation);
  };

  // Minimize the active chat
  const minimizeChat = () => {
    if (!chatState.activeChat) return;
    
    setChatState(prev => ({
      ...prev,
      activeChat: null,
      minimizedChats: [prev.activeChat!, ...prev.minimizedChats]
    }));

    // Clear active conversation in context
    setActiveConversationInContext(null);
  };

  // Restore a chat from minimized stack
  const restoreChat = (conversation: Conversation) => {
    setChatState(prev => {
      // Remove from minimized stack
      const updatedMinimized = prev.minimizedChats.filter(c => c.id !== conversation.id);
      
      // If there's an active chat, minimize it
      const newMinimized = prev.activeChat 
        ? [prev.activeChat, ...updatedMinimized]
        : updatedMinimized;
      
      return {
        ...prev,
        activeChat: conversation,
        minimizedChats: newMinimized
      };
    });

    // Update the global ChatContext
    setActiveConversationInContext(conversation);
  };

  // Close a chat completely
  const closeChat = (conversation: Conversation) => {
    setChatState(prev => ({
      ...prev,
      activeChat: prev.activeChat?.id === conversation.id ? null : prev.activeChat,
      minimizedChats: prev.minimizedChats.filter(c => c.id !== conversation.id)
    }));

    // If this was the active chat, clear it in context
    if (chatState.activeChat?.id === conversation.id) {
      setActiveConversationInContext(null);
    }
  };

  // Toggle docked expanded state
  const toggleDockedExpanded = () => {
    setChatState(prev => ({
      ...prev,
      isDockedExpanded: !prev.isDockedExpanded
    }));
  };

  // Send message
  const handleSendMessage = async (content: string) => {
    if (!chatState.activeChat) return;

    try {
      await sendMessageViaContext(content);
      toast.success('Message sent');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  // Handle message deletion
  const handleDeleteMessage = async (messageId: string) => {
    try {
      // TODO: Implement message deletion
      console.log('Deleting message:', messageId);
      toast('Message deletion coming soon', { icon: 'ℹ️' });
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  };

  // Handle reactions
  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      await addReaction(messageId, emoji);
    } catch (error) {
      console.error('Failed to add reaction:', error);
      toast.error('Failed to add reaction');
    }
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    try {
      await removeReaction(messageId, emoji);
    } catch (error) {
      console.error('Failed to remove reaction:', error);
      toast.error('Failed to remove reaction');
    }
  };

  // Handle reply to message
  const handleReplyToMessage = (message: Message) => {
    // This would be handled by the ChatWindow component
    console.log('Replying to message:', message.id);
  };

  // Filter conversations by selected dashboard and search query
  const getFilteredConversations = () => {
    // Conversations are already filtered by effectiveDashboardId in ChatContext
    let filtered = conversations;

    // Filter by search query
    if (chatState.searchQuery) {
      filtered = filtered.filter(conversation => {
        const conversationName = conversation.name || 
          (conversation.type === 'DIRECT' && conversation.participants.length === 2
            ? conversation.participants.find(p => p.user.id !== conversation.id)?.user.name ||
              conversation.participants.find(p => p.user.id !== conversation.id)?.user.email ||
              'Unknown User'
            : `Group Chat (${conversation.participants.length} members)`);
        
        return conversationName.toLowerCase().includes(chatState.searchQuery.toLowerCase()) ||
          conversation.participants?.some(p => 
            p.user?.name?.toLowerCase().includes(chatState.searchQuery.toLowerCase()) ||
            p.user?.email?.toLowerCase().includes(chatState.searchQuery.toLowerCase())
          );
      });
    }

    return filtered;
  };

  // Calculate position for minimized chat bubbles (to the left of messaging panel)
  const getMinimizedChatPosition = (index: number) => ({
    x: 20 + (index * 10),
    y: 20 + (index * 10)
  });

  const filteredConversations = getFilteredConversations();

  return (
    <>
      {/* Docked Chat Sidebar */}
      <ChatSidebar
        conversations={filteredConversations}
        activeChat={chatState.activeChat}
        onChatSelect={openChat}
        onToggleSidebar={() => setChatState(prev => ({
          ...prev,
          sidebarWidth: prev.sidebarWidth === 'thin' ? 'expanded' : 'thin'
        }))}
        width={chatState.sidebarWidth}
        searchQuery={chatState.searchQuery}
        onSearchChange={(query) => setChatState(prev => ({ ...prev, searchQuery: query }))}
        selectedDashboardId={chatState.selectedDashboardId}
        currentDashboardId={currentDashboardId}
        chatDashboards={chatDashboards}
        dashboardUnreadCounts={dashboardUnreadCounts}
        onDashboardTabClick={handleDashboardTabClick}
        getDashboardType={getDashboardType}
        getDashboardDisplayName={getDashboardDisplayName}
        isDocked={chatState.isDocked}
        isExpanded={chatState.isDockedExpanded}
        onToggleExpanded={toggleDockedExpanded}
      />

      {/* Active Chat Window */}
      {chatState.activeChat && (
        <ChatWindow
          conversation={chatState.activeChat}
          isMinimized={false}
          onMinimize={minimizeChat}
          onRestore={() => {}} // Not needed for active chat
          onClose={() => closeChat(chatState.activeChat!)}
          messages={messages}
          onSendMessage={handleSendMessage}
          onReplyToMessage={handleReplyToMessage}
          onDeleteMessage={handleDeleteMessage}
          onAddReaction={handleAddReaction}
          onRemoveReaction={handleRemoveReaction}
          isLoading={isLoading}
          sidebarWidth={chatState.sidebarWidth}
        />
      )}

      {/* Minimized Chat Bubbles */}
      {chatState.minimizedChats.map((conversation, index) => (
        <ChatWindow
          key={conversation.id}
          conversation={conversation}
          isMinimized={true}
          onMinimize={() => {}} // Not needed for minimized
          onRestore={() => restoreChat(conversation)}
          onClose={() => closeChat(conversation)}
          position={getMinimizedChatPosition(index)}
          messages={[]} // Don't load messages for minimized chats
          onSendMessage={() => {}} // Not applicable for minimized
          onReplyToMessage={() => {}} // Not applicable for minimized
          onDeleteMessage={() => {}} // Not applicable for minimized
          onAddReaction={() => {}} // Not applicable for minimized
          onRemoveReaction={() => {}} // Not applicable for minimized
        />
      ))}
    </>
  );
};

export default StackableChatContainer;
