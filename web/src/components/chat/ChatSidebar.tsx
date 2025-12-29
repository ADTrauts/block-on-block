'use client';

import React from 'react';
import { Conversation } from 'shared/types/chat';
import { Avatar, Badge } from 'shared/components';
import { Search, MessageSquare, Filter, ChevronLeft, MoreHorizontal, Plus, ChevronUp, Shield } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useModuleFeatures } from '../../hooks/useFeatureGating';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useGlobalBranding } from '../../contexts/GlobalBrandingContext';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeChat: Conversation | null;
  onChatSelect: (conversation: Conversation) => void;
  onToggleSidebar: () => void;
  width: 'thin' | 'expanded';
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedDashboardId: string | null;
  currentDashboardId: string | null;
  chatDashboards: Array<{ id: string; [key: string]: unknown }>;
  dashboardUnreadCounts: Record<string, number>;
  onDashboardTabClick: (dashboardId: string | null) => void;
  getDashboardType: (dashboard: { id: string; [key: string]: unknown }) => string;
  getDashboardDisplayName: (dashboard: { id: string; [key: string]: unknown }) => string;
  isDocked?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

interface ChatSidebarItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  isThinMode?: boolean;
}

const ChatSidebarItem: React.FC<ChatSidebarItemProps> = ({
  conversation,
  isActive,
  onClick,
  isThinMode = false
}) => {
  const getOtherParticipant = (conv: Conversation) => {
    if (conv.type === 'DIRECT' && conv.participants.length === 2) {
      return conv.participants.find(p => p.user.id !== conversation.id)?.user;
    }
    return null;
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.type === 'DIRECT' && conv.participants.length === 2) {
      const otherParticipant = conv.participants.find(p => p.user.id !== conv.id);
      return otherParticipant?.user.name || otherParticipant?.user.email || 'Unknown User';
    }
    return `Group Chat (${conv.participants.length} members)`;
  };

  const getLastMessage = (conv: Conversation) => {
    return conv.messages?.[0] || null;
  };

  const hasUnreadMessages = (conv: Conversation) => {
    return conv.messages?.some(msg => 
      msg.senderId !== conv.id && 
      !msg.readReceipts?.some(receipt => receipt.userId === conv.id)
    ) || false;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const otherParticipant = getOtherParticipant(conversation);
  const conversationName = getConversationName(conversation);
  const lastMessage = getLastMessage(conversation);
  const hasUnread = hasUnreadMessages(conversation);

  if (isThinMode) {
    return (
      <button
        onClick={onClick}
        className={`w-12 h-12 rounded-full relative transition-all duration-200 ${
          isActive ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105'
        }`}
        title={conversationName}
      >
        <Avatar 
          src={(otherParticipant as any)?.avatar || undefined} 
          nameOrEmail={conversationName}
          size={48}
          className="w-full h-full"
        />
        {hasUnread && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {conversation.messages?.filter(msg => 
              msg.senderId !== conversation.id && 
              !msg.readReceipts?.some(receipt => receipt.userId === conversation.id)
            ).length || 1}
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-lg transition-all duration-200 text-left ${
        isActive 
          ? 'bg-blue-900/20 border-l-4 border-blue-400' 
          : 'hover:bg-white/10'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="relative">
          <Avatar 
            src={(otherParticipant as any)?.avatar || undefined} 
            nameOrEmail={conversationName}
            size={40}
          />
          {hasUnread && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {conversation.messages?.filter(msg => 
                msg.senderId !== conversation.id && 
                !msg.readReceipts?.some(receipt => receipt.userId === conversation.id)
              ).length || 1}
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium truncate ${
              isActive ? 'text-blue-300' : 'text-gray-200'
            }`}>
              {conversationName}
            </h3>
            {lastMessage && (
              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                {formatTime(lastMessage.createdAt)}
              </span>
            )}
          </div>
          
          {lastMessage && (
            <p className={`text-sm truncate mt-1 ${
              hasUnread ? 'text-gray-200 font-medium' : 'text-gray-400'
            }`}>
              {lastMessage.content.length > 50 
                ? `${lastMessage.content.substring(0, 50)}...`
                : lastMessage.content
              }
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeChat,
  onChatSelect,
  onToggleSidebar,
  width,
  searchQuery,
  onSearchChange,
  selectedDashboardId,
  currentDashboardId,
  chatDashboards,
  dashboardUnreadCounts,
  onDashboardTabClick,
  getDashboardType,
  getDashboardDisplayName,
  isDocked = false,
  isExpanded = false,
  onToggleExpanded
}) => {
  const { data: session } = useSession();
  const { getSidebarStyle } = useThemeColors();
  const { isBusinessContext, getSidebarStyles } = useGlobalBranding();
  
  const effectiveDashboardId = selectedDashboardId || currentDashboardId;
  
  // Get business ID for enterprise feature checking
  const selectedDashboard = effectiveDashboardId 
    ? chatDashboards.find(d => d.id === effectiveDashboardId)
    : null;
  const dashboardType = selectedDashboard ? getDashboardType(selectedDashboard) : 'personal';
  const businessId = dashboardType === 'business' ? (selectedDashboard as any)?.business?.id : undefined;
  const { hasBusiness: hasEnterprise } = useModuleFeatures('chat', businessId);
  
  // Get sidebar color for chat (matches sidebar styling)
  const sidebarColorStyle = getSidebarStyle(
    isBusinessContext && dashboardType === 'business',
    isBusinessContext && dashboardType === 'business' ? getSidebarStyles().backgroundColor : undefined
  );
  const sidebarBackgroundColor = sidebarColorStyle.backgroundColor;
  const filteredConversations = conversations.filter(conversation => {
    if (!searchQuery) return true;
    
    const conversationName = conversation.name || 
      (conversation.type === 'DIRECT' && conversation.participants.length === 2
        ? conversation.participants.find(p => p.user.id !== conversation.id)?.user.name ||
          conversation.participants.find(p => p.user.id !== conversation.id)?.user.email ||
          'Unknown User'
        : `Group Chat (${conversation.participants.length} members)`);
    
    return conversationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.participants?.some(p => 
        p.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
  });

  // LinkedIn-style docked chat - unified minimized/expanded
  if (isDocked) {
    return (
      <div className="fixed bottom-0 z-30" style={{ width: '320px', right: '40px' }}>
        <div className="shadow-lg transition-all duration-300 rounded-tl-lg" style={{ backgroundColor: sidebarBackgroundColor }}>
          {/* Minimized Bar - Always visible */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-gray-300" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
              </div>
              <span className="font-medium text-white">Messaging</span>
              {conversations.length > 0 && (
                <div className="flex -space-x-2">
                  {conversations.slice(0, 3).map((conv, index) => {
                    const otherParticipant = conv.type === 'DIRECT' && conv.participants.length === 2
                      ? conv.participants.find(p => p.user.id !== conv.id)?.user
                      : null;
                    
                    // Check if this is the current user's conversation
                    const isCurrentUser = otherParticipant?.id === session?.user?.id;
                    const avatarUrl = isCurrentUser ? session?.user?.image : null;
                    const initials = otherParticipant?.name?.charAt(0) || otherParticipant?.email?.charAt(0) || '?';
                    
                    return (
                      <div key={conv.id} className="relative">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={otherParticipant?.name || otherParticipant?.email || 'User'}
                            className="w-6 h-6 rounded-full border-2 border-gray-800 object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-gray-800">
                            {initials}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {conversations.length > 3 && (
                    <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-gray-800">
                      +{conversations.length - 3}
                    </div>
                  )}
                </div>
              )}
              {conversations.some(conv => 
                conv.messages?.some(msg => 
                  msg.senderId !== conv.id && 
                  !msg.readReceipts?.some(receipt => receipt.userId === conv.id)
                )
              ) && (
                <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {conversations.reduce((total, conv) => 
                    total + (conv.messages?.filter(msg => 
                      msg.senderId !== conv.id && 
                      !msg.readReceipts?.some(receipt => receipt.userId === conv.id)
                    ).length || 0), 0
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button 
                className="p-1 rounded transition-colors hover:opacity-80"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
                title="More options"
              >
                <MoreHorizontal className="w-4 h-4 text-gray-300" />
              </button>
              <button 
                className="p-1 rounded transition-colors hover:opacity-80"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
                title="New chat"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement new chat functionality
                  console.log('New chat clicked');
                }}
              >
                <div className="w-4 h-4 border border-gray-300 rounded flex items-center justify-center">
                  <Plus className="w-3 h-3 text-gray-300" />
                </div>
              </button>
              <button 
                className="p-1 rounded transition-colors hover:opacity-80"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
                title={isExpanded ? "Minimize messaging" : "Expand messaging"}
                onClick={onToggleExpanded}
              >
                <ChevronUp className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Expanded Content - Grows upward from minimized bar */}
          {isExpanded && (
            <div className="border-t border-gray-600 max-h-96 overflow-hidden" style={{ backgroundColor: sidebarBackgroundColor }}>
              <div className="p-4 flex flex-col">
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search messages"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-white placeholder-gray-400"
                  />
                  <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>

                {/* Dashboard Tabs */}
                {chatDashboards.length > 0 && (
                  <div className="mb-4">
                    <div 
                      className="flex items-center space-x-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                    >
                      {chatDashboards.map((dashboard) => {
                        const isActive = effectiveDashboardId === dashboard.id;
                        const dashboardType = getDashboardType(dashboard);
                        const displayName = getDashboardDisplayName(dashboard);
                        const unreadCount = dashboardUnreadCounts[dashboard.id] || 0;
                        const isBusiness = dashboardType === 'business';
                        
                        return (
                          <button
                            key={dashboard.id}
                            onClick={() => onDashboardTabClick(dashboard.id)}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
                              isActive
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                            title={displayName}
                          >
                            <span className="truncate max-w-[80px]">{displayName}</span>
                            {isBusiness && hasEnterprise && (
                              <Shield className="w-3 h-3 flex-shrink-0" />
                            )}
                            {unreadCount > 0 && (
                              <span 
                                className={`text-xs flex-shrink-0 px-1.5 py-0.5 rounded-full font-medium ${
                                  isActive 
                                    ? 'bg-white/20 text-white border border-white/30' 
                                    : 'bg-blue-500 text-white border border-blue-400'
                                }`}
                              >
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Conversations */}
                <div className="flex-1 overflow-y-auto">
                  {filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="w-12 h-12 text-gray-500 mb-3" />
                      <p className="text-sm text-gray-400">
                        {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredConversations.map(conv => (
                        <ChatSidebarItem
                          key={conv.id}
                          conversation={conv}
                          isActive={activeChat?.id === conv.id}
                          onClick={() => onChatSelect(conv)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (width === 'thin') {
    return (
      <div className="fixed right-0 top-16 bg-white border-l border-gray-200 z-30 w-16 transition-all duration-300" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="p-2 space-y-2">
          <button
            onClick={onToggleSidebar}
            className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            title="Expand sidebar"
          >
            <MessageSquare className="w-5 h-5 text-gray-600" />
          </button>
          
          {filteredConversations.map(conv => (
            <ChatSidebarItem
              key={conv.id}
              conversation={conv}
              isActive={activeChat?.id === conv.id}
              onClick={() => onChatSelect(conv)}
              isThinMode={true}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-16 h-full bg-white border-l border-gray-200 z-30 w-80 transition-all duration-300">
      <div className="p-4 h-full flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Messaging</h2>
          <button
            onClick={onToggleSidebar}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search messages"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard Tabs */}
        {chatDashboards.length > 0 && (
          <div className="mb-4">
            <div 
              className="flex items-center space-x-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {chatDashboards.map((dashboard) => {
                const isActive = effectiveDashboardId === dashboard.id;
                const dashboardType = getDashboardType(dashboard);
                const displayName = getDashboardDisplayName(dashboard);
                const unreadCount = dashboardUnreadCounts[dashboard.id] || 0;
                const isBusiness = dashboardType === 'business';
                
                return (
                  <button
                    key={dashboard.id}
                    onClick={() => onDashboardTabClick(dashboard.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={displayName}
                  >
                    <span className="truncate max-w-[100px]">{displayName}</span>
                    {isBusiness && hasEnterprise && (
                      <Shield className="w-3 h-3 flex-shrink-0" />
                    )}
                    {unreadCount > 0 && (
                      <span 
                        className={`text-xs flex-shrink-0 px-1.5 py-0.5 rounded-full font-medium ${
                          isActive 
                            ? 'bg-white/20 text-white border border-white/30' 
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">
                {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map(conv => (
                <ChatSidebarItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeChat?.id === conv.id}
                  onClick={() => onChatSelect(conv)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;