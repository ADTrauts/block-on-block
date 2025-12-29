'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Conversation, Message } from 'shared/types/chat';
import { Avatar, Button, Spinner } from 'shared/components';
import { useDashboard } from '@/contexts/DashboardContext';
import * as todoAPI from '@/api/todo';
import { 
  X, 
  Minus, 
  MoreHorizontal, 
  Send, 
  Smile, 
  Paperclip,
  Reply,
  Trash2,
  Key,
  BarChart3,
  CheckSquare
} from 'lucide-react';
import { useFeatureGating } from '../../hooks/useFeatureGating';
import ChatFileUpload from '../../app/chat/ChatFileUpload';

interface ChatWindowProps {
  conversation: Conversation;
  isMinimized: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  onClose: () => void;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  messages: Message[];
  onSendMessage: (content: string) => void;
  onReplyToMessage: (message: Message) => void;
  onDeleteMessage: (messageId: string) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
  isLoading?: boolean;
  sidebarWidth?: 'thin' | 'expanded';
}

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  onReply: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
  hasEnterprise: boolean;
  conversationId?: string;
  dashboardId?: string;
  onCreateTask?: (messageId: string, conversationId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwn,
  onReply,
  onDelete,
  onAddReaction,
  onRemoveReaction,
  hasEnterprise,
  conversationId,
  dashboardId,
  onCreateTask
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReactionCount = (message: Message, emoji: string): number => {
    return message.reactions?.filter(r => r.emoji === emoji).length || 0;
  };

  const hasUserReacted = (message: Message, emoji: string): boolean => {
    return message.reactions?.some(r => r.emoji === emoji && r.userId === message.senderId) || false;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  };

  const handleDelete = () => {
    onDelete(message.id);
    setShowContextMenu(false);
  };

  const handleReply = () => {
    onReply(message);
    setShowContextMenu(false);
  };

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group mb-4`}
      onContextMenu={handleContextMenu}
    >
      <div className={`max-w-[80%] relative ${isOwn ? 'order-2' : 'order-1'}`}>
        {/* Sender info for other messages */}
        {!isOwn && (
          <div className="flex items-center space-x-2 mb-1">
            <Avatar 
              src={(message.sender as any)?.avatar || undefined} 
              nameOrEmail={message.sender?.name || message.sender?.email}
              size={24}
            />
            <span className="text-sm font-medium text-gray-900">
              {message.sender?.name || message.sender?.email}
            </span>
            {hasEnterprise && (message as any).encrypted && (
              <Key className="w-3 h-3 text-green-500" />
            )}
          </div>
        )}

        {/* Message bubble */}
        <div className={`px-4 py-2 rounded-lg ${
          isOwn 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 text-gray-900'
        }`}>
          <p className="text-sm">{message.content}</p>
          
          {/* Message timestamp */}
          <p className={`text-xs mt-1 ${
            isOwn ? 'text-blue-100' : 'text-gray-500'
          }`}>
            {formatTime(message.createdAt)}
          </p>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Array.from(new Set(message.reactions.map(r => r.emoji))).map(emoji => {
              const count = getReactionCount(message, emoji);
              const hasReacted = hasUserReacted(message, emoji);
              return (
                <button
                  key={emoji}
                  onClick={() => hasReacted 
                    ? onRemoveReaction(message.id, emoji)
                    : onAddReaction(message.id, emoji)
                  }
                  className={`px-2 py-1 rounded-full text-xs transition-colors ${
                    hasReacted 
                      ? 'bg-blue-200 text-blue-800' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {emoji} {count}
                </button>
              );
            })}
          </div>
        )}

        {/* Context Menu */}
        {showContextMenu && (
          <div className="absolute right-2 top-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-32">
            <button
              onClick={handleReply}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
            >
              <Reply className="w-4 h-4" />
              <span>Reply</span>
            </button>
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
            >
              <Smile className="w-4 h-4" />
              <span>React</span>
            </button>
            {onCreateTask && conversationId && dashboardId && (
              <button
                onClick={() => {
                  onCreateTask(message.id, conversationId);
                  setShowContextMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Create Task</span>
              </button>
            )}
            <button
              onClick={handleDelete}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2 text-red-600"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        )}

        {/* Reaction picker */}
        {showReactions && (
          <div className="absolute top-full left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 flex space-x-1">
            {commonEmojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  onAddReaction(message.id, emoji);
                  setShowReactions(false);
                }}
                className="p-1 hover:bg-gray-100 rounded text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  isMinimized,
  onMinimize,
  onRestore,
  onClose,
  position,
  size,
  messages,
  onSendMessage,
  onReplyToMessage,
  onDeleteMessage,
  onAddReaction,
  onRemoveReaction,
  isLoading = false,
  sidebarWidth = 'expanded'
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'threads'>('messages');
  const [isMinimizedToBottom, setIsMinimizedToBottom] = useState(false);
  const [windowHeight, setWindowHeight] = useState(size?.height || 500);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isResizing = useRef(false);

  // Check enterprise features
  const { hasBusiness: hasEnterprise } = useFeatureGating('chat') as any;
  const { data: session } = useSession();
  const { currentDashboardId } = useDashboard();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when window is restored
  useEffect(() => {
    if (!isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMinimized]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker && !(event.target as Element).closest('.emoji-picker')) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Handle resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      isResizing.current = true;
      const startY = e.clientY;
      const startHeight = windowHeight;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        const newHeight = startHeight + (e.clientY - startY);
        const minHeight = 200;
        const maxHeight = window.innerHeight - 100;
        setWindowHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  // Toggle minimize to bottom
  const toggleMinimizeToBottom = () => {
    setIsMinimizedToBottom(!isMinimizedToBottom);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    onSendMessage(newMessage.trim());
    setNewMessage('');
    setReplyToMessage(null);
  };

  const handleCreateTask = async (messageId: string, conversationId: string) => {
    if (!session?.accessToken || !currentDashboardId) {
      toast.error('Unable to create task. Please ensure you are logged in and have a dashboard selected.');
      return;
    }

    try {
      // Find the message to get its content
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        toast.error('Message not found');
        return;
      }

      // Parse the message to extract task details
      const parsed = await todoAPI.parseMessageForTask(message.content, session.accessToken);

      // Create the task
      await todoAPI.createTaskFromMessage({
        messageId,
        conversationId,
        dashboardId: currentDashboardId,
        title: parsed.parsed.title,
        description: parsed.parsed.description,
        priority: parsed.parsed.priority,
        dueDate: parsed.parsed.dueDate,
      }, session.accessToken);

      toast.success('Task created from message');
    } catch (error) {
      console.error('Failed to create task from message:', error);
      toast.error('Failed to create task from message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleFileSelect = (fileId: string, fileName: string) => {
    // Add file reference to message
    const fileMessage = `📎 ${fileName}`;
    setNewMessage(prev => prev + (prev ? ' ' : '') + fileMessage);
    setShowFileUpload(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const isOwnMessage = (message: Message): boolean => {
    // This would need to be passed from parent or use session
    return message.senderId === 'current-user-id'; // TODO: Get from session
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.type === 'DIRECT' && conv.participants.length === 2) {
      const otherParticipant = conv.participants.find(p => p.user.id !== conv.id);
      return otherParticipant?.user.name || otherParticipant?.user.email || 'Unknown User';
    }
    return `Group Chat (${conv.participants.length} members)`;
  };

  const getOtherParticipant = (conv: Conversation) => {
    if (conv.type === 'DIRECT' && conv.participants.length === 2) {
      return conv.participants.find(p => p.user.id !== conv.id)?.user;
    }
    return null;
  };

  const conversationName = getConversationName(conversation);
  const otherParticipant = getOtherParticipant(conversation);

  if (isMinimized) {
    // Minimized bubble - positioned to the left of messaging panel
    return (
      <div
        className="fixed w-16 h-16 bg-blue-500 rounded-full shadow-lg cursor-pointer z-50 flex items-center justify-center hover:scale-110 transition-transform"
        onClick={onRestore}
        style={{
          right: `${(position?.x || 20) + 320}px`, // Offset by messaging panel width
          bottom: `${position?.y || 0}px`
        }}
        title={`Restore ${conversationName}`}
      >
        <Avatar 
          src={(otherParticipant as any)?.avatar || undefined} 
          nameOrEmail={conversationName}
          size={40}
          className="w-10 h-10"
        />
        {/* Unread indicator */}
        {conversation.messages?.some(msg => 
          msg.senderId !== conversation.id && 
          !msg.readReceipts?.some(receipt => receipt.userId === conversation.id)
        ) && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {conversation.messages?.filter(msg => 
              msg.senderId !== conversation.id && 
              !msg.readReceipts?.some(receipt => receipt.userId === conversation.id)
            ).length || 1}
          </div>
        )}
      </div>
    );
  }

  // Minimized to bottom state
  if (isMinimizedToBottom) {
    return (
      <div
        className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-50 cursor-pointer"
        style={{
          right: '352px', // Positioned to the left of the 352px messaging panel
          bottom: '20px',
          width: size?.width || 400,
          height: '60px'
        }}
        onClick={toggleMinimizeToBottom}
      >
        <div className="flex items-center justify-between p-4 h-full">
          <div className="flex items-center space-x-3">
            <Avatar 
              src={(otherParticipant as any)?.avatar || undefined} 
              nameOrEmail={conversationName}
              size={32}
            />
            <div>
              <h3 className="font-medium text-gray-900">{conversationName}</h3>
              <p className="text-sm text-gray-500">Click to expand</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleMinimizeToBottom();
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Expand"
            >
              <Minus className="w-4 h-4 text-gray-600 rotate-180" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full chat window - positioned to the left of the messaging panel
  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col"
      style={{
        right: '320px', // Positioned to the left of the 320px messaging panel
        bottom: '20px', // Fixed distance from bottom
        width: size?.width || 400,
        height: windowHeight,
        maxHeight: 'calc(100vh - 104px)' // Account for header + margins
      }}
    >
      {/* Header */}
      <div className="border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Avatar 
              src={(otherParticipant as any)?.avatar || undefined} 
              nameOrEmail={conversationName}
              size={32}
            />
            <div>
              <h3 className="font-medium text-gray-900">{conversationName}</h3>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-500">Online</p>
                {hasEnterprise && (
                  <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                    Enterprise
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={toggleMinimizeToBottom} 
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Minimize to bottom"
            >
              <Minus className="w-4 h-4 text-gray-600" />
            </button>
            <button 
              onClick={onClose} 
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'messages'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveTab('threads')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'threads'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Threads
            {messages.filter(m => (m as any).parentMessageId).length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                {messages.filter(m => (m as any).parentMessageId).length}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size={24} />
          </div>
        ) : activeTab === 'messages' && messages.filter(m => !(m as any).parentMessageId).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Avatar 
                src={(otherParticipant as any)?.avatar || undefined} 
                nameOrEmail={conversationName}
                size={48}
              />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-500">Start the conversation with {conversationName}</p>
          </div>
        ) : activeTab === 'threads' && messages.filter(m => (m as any).parentMessageId).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Reply className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No threads yet</h3>
            <p className="text-gray-500">Reply to a message to start a thread</p>
          </div>
        ) : (
          <>
            {messages
              .filter(message => activeTab === 'messages' 
                ? !(message as any).parentMessageId 
                : (message as any).parentMessageId
              )
              .map(message => (
                <MessageItem
                  key={message.id}
                  message={message}
                  isOwn={isOwnMessage(message)}
                  onReply={handleReply}
                  onDelete={onDeleteMessage}
                  onAddReaction={onAddReaction}
                  onRemoveReaction={onRemoveReaction}
                  hasEnterprise={hasEnterprise}
                  conversationId={conversation.id}
                  dashboardId={currentDashboardId || undefined}
                  onCreateTask={handleCreateTask}
                />
              ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Reply indicator */}
      {replyToMessage && (
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Reply className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Replying to: {replyToMessage.content.substring(0, 50)}...
              </span>
            </div>
            <button
              onClick={() => setReplyToMessage(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Upload Files</h3>
              <button
                onClick={() => setShowFileUpload(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <ChatFileUpload onFileSelect={handleFileSelect} />
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="emoji-picker absolute bottom-20 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
          <div className="grid grid-cols-6 gap-1">
            {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'].slice(0, 48).map(emoji => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className="p-2 hover:bg-gray-100 rounded text-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            placeholder={`Write a message to ${conversationName}...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button 
            onClick={() => setShowFileUpload(true)}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4 text-gray-600" />
          </button>
          <button 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Add emoji"
          >
            <Smile className="w-4 h-4 text-gray-600" />
          </button>
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="px-4 py-2"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Resize Handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-200 transition-colors"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};

export default ChatWindow;
