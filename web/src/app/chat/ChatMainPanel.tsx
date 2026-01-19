'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Message, Conversation, FileReference as SharedFileReference, Thread } from 'shared/types/chat';
import { chatAPI } from '../../api/chat';
import { getMessages } from '../../api/chat';
import { Button, Input, Avatar, Badge, Spinner } from 'shared/components';
import { Send, Paperclip, Smile, MoreVertical, Download, Trash2, Share2, Users, MessageSquare, Reply, Plus, CheckCircle, Search, X, ChevronLeft, ChevronRight, Shield, FileText, Folder } from 'lucide-react';
import ChatFileUpload from './ChatFileUpload';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useChat } from '../../contexts/ChatContext';
import { useGlobalTrash } from '../../contexts/GlobalTrashContext';
import { useTrashDrop } from '../../utils/trashUtils';
import ClassificationBadge from '../../components/ClassificationBadge';
import { getDataClassifications } from '../../api/retention';
import type { DataClassification } from '../../api/retention';
import ClassificationModal from '../../components/ClassificationModal';
import { enforceGovernancePolicies } from '../../api/governance';
import { useModuleFeatures } from '../../hooks/useFeatureGating';
import { useDashboard } from '../../contexts/DashboardContext';
import { toast } from 'react-hot-toast';
import { useNotificationSocket, NotificationEvent } from '../../lib/notificationSocket';
import { useRouter } from 'next/navigation';

// Test if emoji packages are working
// Emoji data loaded: !!data
// Emoji Picker component: !!Picker

interface LocalFileReference {
  fileId: string;
  fileName: string;
}

interface ChatMainPanelProps {
  panelState: {
    activeConversationId: string | null;
    activeThreadId: string | null;
  };
  onThreadSelect: (threadId: string | null) => void;
  onToggleRightPanel?: () => void;
  fileReference?: LocalFileReference;
}

// Quick reaction emojis for common reactions
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

// Memoized message component for better performance
const MessageItem = React.memo(({ 
  message, 
  isOwnMessage, 
  onReply, 
  onReaction, 
  onQuickReaction, 
  onFileDownload, 
  onFilePreview,
  showQuickReactionsFor,
  setShowQuickReactionsFor,
  formatTime,
  getFileIcon,
  getMessageStatus,
  getThreadIndicator,
  getGroupedReactions,
  hasUserReacted,
  replyingTo,
  onDeleteMessage,
  accessToken,
  hasEnterprise
}: {
  message: Message;
  isOwnMessage: boolean;
  onReply: (message: Message) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onQuickReaction: (messageId: string, emoji: string) => void;
  onFileDownload: (file: SharedFileReference) => void;
  onFilePreview: (file: SharedFileReference) => void;
  showQuickReactionsFor: string | null;
  setShowQuickReactionsFor: (messageId: string | null) => void;
  formatTime: (timestamp: string) => string;
  getFileIcon: (type: string) => string;
  getMessageStatus: (message: Message) => React.ReactNode;
  getThreadIndicator: (message: Message) => React.ReactNode;
  getGroupedReactions: (message: Message) => Array<{ emoji: string; count: number; hasReacted: boolean }>;
  hasUserReacted: (message: Message, emoji: string) => boolean;
  replyingTo: Message | null;
  onDeleteMessage: (message: Message) => void;
  accessToken: string;
  hasEnterprise: boolean;
}) => {
  const isReplyingTo = replyingTo && replyingTo.id === message.id;
  const { handleTrashDrop } = useTrashDrop();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [classification, setClassification] = useState<DataClassification | null>(null);
  const [loadingClassification, setLoadingClassification] = useState(false);
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  // Load classification for this message (Enterprise feature only)
  useEffect(() => {
    const loadClassification = async () => {
      // Only load classification for enterprise users
      if (!accessToken || !hasEnterprise) return;
      
      try {
        setLoadingClassification(true);
        const response = await getDataClassifications(accessToken, {
          resourceType: 'message'
        });
        // Find classification for this specific message
        const messageClassification = response.data.classifications.find(c => c.resourceId === message.id);
        if (messageClassification) {
          setClassification(messageClassification);
        }
      } catch (err: any) {
        // Only log errors that aren't authentication-related
        if (err?.status !== 401 && err?.status !== 403) {
          console.error('Error loading message classification:', err);
        }
      } finally {
        setLoadingClassification(false);
      }
    };

    loadClassification();
  }, [message.id, accessToken, hasEnterprise]);

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Handle drag to trash
  const handleDragStart = (e: React.DragEvent) => {
    const trashItem = {
      id: message.id,
      name: message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content,
      type: 'message' as const,
      moduleId: 'chat',
      moduleName: 'Chat',
      metadata: {
        conversationId: message.conversationId,
        senderId: message.senderId,
      }
    };
    
    e.dataTransfer.setData('application/json', JSON.stringify(trashItem));
    e.dataTransfer.setData('text/plain', message.content);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Reset any drag state if needed
    // The actual drop handling is done by the GlobalTrashBin component
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);
  
  return (
    <div 
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onContextMenu={handleContextMenu}
      ref={messageRef}
    >
      <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'order-2' : 'order-1'}`}>
        {!isOwnMessage && (
          <div className="flex items-center space-x-2 mb-1">
            <Avatar
              nameOrEmail={message.sender?.name || message.sender?.email || 'Unknown'}
              size={24}
            />
            <span className="text-sm font-medium text-gray-900">
              {message.sender?.name || 'Unknown'}
            </span>
            <span className="text-xs text-gray-500">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}
        
        <div className={`relative group ${isOwnMessage ? 'text-right' : 'text-left'}`}>
          {/* Reply Indicator */}
          {isReplyingTo && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
              <span className="font-medium">Replying to:</span> {message.content?.substring(0, 50)}...
            </div>
          )}
          
          <div
            className={`inline-block px-2 py-1.5 rounded-lg ${
              isOwnMessage
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
            role="article"
            aria-label={`Message from ${message.sender?.name || 'Unknown'}: ${message.content}`}
          >
            {/* Thread Indicator */}
            {getThreadIndicator(message)}
            
            <p className="text-sm">{message.content}</p>
            
            {/* Classification Badge (Enterprise only) */}
            {hasEnterprise && classification && (
              <div className="mt-2">
                <ClassificationBadge
                  sensitivity={classification.sensitivity}
                  expiresAt={classification.expiresAt}
                  showExpiration={true}
                  size="sm"
                />
              </div>
            )}
            
            {/* File Attachments with Rich Previews */}
            {message.fileReferences && message.fileReferences.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.fileReferences.map((file) => {
                  const isImage = file.file.type.startsWith('image/');
                  const isPDF = file.file.type.includes('pdf');
                  const isDocument = file.file.type.includes('word') || 
                                    file.file.type.includes('document') ||
                                    file.file.type.includes('excel') ||
                                    file.file.type.includes('spreadsheet') ||
                                    file.file.type.includes('presentation') ||
                                    file.file.type.includes('powerpoint');
                  
                  return (
                    <div
                      key={file.id}
                      className={`rounded-lg overflow-hidden border ${
                        isImage ? 'bg-gray-50' : 'bg-white bg-opacity-20'
                      }`}
                    >
                      {/* Image Preview */}
                      {isImage && (
                        <div className="relative group">
                          <img
                            src={file.file.url || `/api/drive/files/${file.fileId}/download`}
                            alt={file.file.name}
                            className="w-full max-w-md max-h-64 object-contain cursor-pointer"
                            onClick={() => onFilePreview(file)}
                            onError={(e) => {
                              // Fallback to download endpoint if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.src = `/api/drive/files/${file.fileId}/download`;
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 flex space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFilePreview(file);
                                }}
                                className="p-2 bg-white bg-opacity-90 rounded-full shadow-lg hover:bg-opacity-100"
                                aria-label={`Preview image: ${file.file.name}`}
                              >
                                <Search className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFileDownload(file);
                                }}
                                className="p-2 bg-white bg-opacity-90 rounded-full shadow-lg hover:bg-opacity-100"
                                aria-label={`Download image: ${file.file.name}`}
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="px-3 py-2 bg-white bg-opacity-90">
                            <p className="text-xs font-medium text-gray-900 truncate">{file.file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* PDF/Document Preview Card */}
                      {(isPDF || isDocument) && (
                        <div className="p-3">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                              {isPDF ? (
                                <FileText className="w-6 h-6 text-blue-600" />
                              ) : (
                                <FileText className="w-6 h-6 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {file.file.name}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {isPDF ? 'PDF Document' : 'Document'} • {(file.file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => onFilePreview(file)}
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                aria-label={`Preview file: ${file.file.name}`}
                              >
                                <Search className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                onClick={() => onFileDownload(file)}
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                aria-label={`Download file: ${file.file.name}`}
                              >
                                <Download className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Generic File Preview */}
                      {!isImage && !isPDF && !isDocument && (
                        <div className="flex items-center space-x-2 p-2">
                          <span className="text-lg">{getFileIcon(file.file.type)}</span>
                          <span className="text-xs flex-1 truncate">{file.file.name}</span>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => onFilePreview(file)}
                              className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
                              aria-label={`Preview file: ${file.file.name}`}
                            >
                              <Search className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => onFileDownload(file)}
                              className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
                              aria-label={`Download file: ${file.file.name}`}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {getGroupedReactions(message).map((reaction, index) => (
                  <button
                    key={`${reaction.emoji}-${index}`}
                    onClick={() => reaction.hasReacted 
                      ? onReaction(message.id, reaction.emoji)
                      : onQuickReaction(message.id, reaction.emoji)
                    }
                    className={`px-2 py-1 rounded-full text-xs transition-colors ${
                      reaction.hasReacted
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-1">{reaction.emoji}</span>
                    <span>{reaction.count}</span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Quick Reactions */}
            {showQuickReactionsFor === message.id && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                <div className="flex space-x-1">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onQuickReaction(message.id, emoji)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <span className="text-lg">{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Message Actions */}
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex space-x-1">
                <button
                  onClick={() => onReply(message)}
                  className="p-1 bg-white bg-opacity-90 rounded shadow-sm hover:bg-opacity-100"
                  aria-label="Reply to message"
                >
                  <Reply className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setShowQuickReactionsFor(showQuickReactionsFor === message.id ? null : message.id)}
                  className="p-1 bg-white bg-opacity-90 rounded shadow-sm hover:bg-opacity-100"
                  aria-label="Add reaction"
                >
                  <Smile className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {isOwnMessage && (
          <div className="flex items-center justify-end space-x-2 mt-1">
            <span className="text-xs text-gray-500">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div 
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ 
            left: contextMenuPosition.x, 
            top: contextMenuPosition.y,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <button
            onClick={() => {
              onReply(message);
              setShowContextMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2"
          >
            <Reply className="w-4 h-4" />
            <span>Reply</span>
          </button>
          {/* Classify option - Enterprise only */}
          {hasEnterprise && (
            <button
              onClick={() => {
                setShowClassificationModal(true);
                setShowContextMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2"
            >
              <Shield className="w-4 h-4" />
              <span>Classify</span>
            </button>
          )}
          <button
            onClick={() => {
              onDeleteMessage(message);
              setShowContextMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2 text-red-600"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Classification Modal (Enterprise only) */}
      {hasEnterprise && (
        <ClassificationModal
          isOpen={showClassificationModal}
          onClose={() => setShowClassificationModal(false)}
          resourceType="message"
          resourceId={message.id}
          content={message.content}
          currentClassification={classification || undefined}
          onClassify={(newClassification) => {
            setClassification(newClassification);
            setShowClassificationModal(false);
          }}
        />
      )}
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export default function ChatMainPanel({ panelState, onThreadSelect, onToggleRightPanel, fileReference: fileReferenceProp }: ChatMainPanelProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { currentDashboard, getDashboardType } = useDashboard();
  const notificationSocket = useNotificationSocket();
  const [fileNotifications, setFileNotifications] = useState<NotificationEvent[]>([]);
  const {
    activeConversation,
    messages,
    isLoading,
    error,
    sendMessage,
    addReaction,
    removeReaction,
    replyToMessage,
    setReplyToMessage,
    attachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    uploadFile: uploadFileToChat,
    loadThreads,
    loadThreadMessages,
    loadMessages
  } = useChat();
  
  const { trashItem } = useGlobalTrash();
  
  // Enterprise feature gating
  const dashboardType = currentDashboard ? getDashboardType(currentDashboard) : 'personal';
  const businessId = dashboardType === 'business' ? currentDashboard?.id : undefined;
  const { hasBusiness: hasEnterprise } = useModuleFeatures('chat', businessId);
  
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ id: string; name: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const [showMessageEmojiPicker, setShowMessageEmojiPicker] = useState(false);
  const [showQuickReactionsFor, setShowQuickReactionsFor] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingThreadMessages, setLoadingThreadMessages] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [fileReference, setFileReference] = useState<LocalFileReference | undefined>(fileReferenceProp);

  // Handle file reference from Drive "Discuss in chat"
  useEffect(() => {
    if (fileReferenceProp) {
      setFileReference(fileReferenceProp);
      // Auto-attach file when a conversation is selected
      if (activeConversation?.id && selectedFiles.length === 0) {
        setSelectedFiles([{ id: fileReferenceProp.fileId, name: fileReferenceProp.fileName }]);
        // Clear file reference after attaching
        setTimeout(() => setFileReference(undefined), 3000);
      }
    }
  }, [fileReferenceProp, activeConversation?.id, selectedFiles.length]);

  // Listen for file activity notifications (when files are shared)
  useEffect(() => {
    const handleNotification = (notification: NotificationEvent) => {
      // Only show drive_permission notifications in chat
      if (notification.type === 'drive_permission' || notification.type === 'drive_shared') {
        setFileNotifications(prev => [notification, ...prev].slice(0, 5)); // Keep last 5
        
        // Show toast notification with action to open file
        const fileId = (notification.data as any)?.fileId;
        const folderId = (notification.data as any)?.folderId;
        const fileName = (notification.data as any)?.fileName || (notification.data as any)?.folderName || 'item';
        
        if (fileId) {
          toast.success(
            (t) => (
              <div className="flex items-center space-x-2">
                <span>{notification.title}</span>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    router.push(`/drive/shared?file=${fileId}`);
                  }}
                  className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
                >
                  Open file
                </button>
              </div>
            ),
            { duration: 5000 }
          );
        } else if (folderId) {
          toast.success(
            (t) => (
              <div className="flex items-center space-x-2">
                <span>{notification.title}</span>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    router.push(`/drive/shared?folder=${folderId}`);
                  }}
                  className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
                >
                  Open folder
                </button>
              </div>
            ),
            { duration: 5000 }
          );
        } else {
          toast.success(notification.title, { duration: 3000 });
        }
      }
    };

    notificationSocket.onNotification(handleNotification);

    return () => {
      // Cleanup handled by notificationSocket
    };
  }, [notificationSocket, router]);

  // Load threads when conversation changes
  useEffect(() => {
    if (panelState.activeConversationId) {
      setLoadingThreads(true);
      loadThreads(panelState.activeConversationId)
        .then(setThreads)
        .catch(() => setThreadError('Failed to load threads'))
        .finally(() => setLoadingThreads(false));
    } else {
      setThreads([]);
    }
  }, [panelState.activeConversationId, loadThreads]);

  // Load thread messages when a thread is selected
  useEffect(() => {
    if (panelState.activeConversationId && panelState.activeThreadId) {
      setLoadingThreadMessages(true);
      loadThreadMessages(panelState.activeConversationId, panelState.activeThreadId)
        .then(setThreadMessages)
        .catch(() => setThreadError('Failed to load thread messages'))
        .finally(() => setLoadingThreadMessages(false));
    } else {
      setThreadMessages([]);
    }
  }, [panelState.activeConversationId, panelState.activeThreadId, loadThreadMessages]);

  // Listen for message trashing events
  useEffect(() => {
    const handleMessageTrashed = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { messageId, conversationId } = customEvent.detail;
      
      // If the trashed message was from the current conversation, reload messages
      if (activeConversation?.id === conversationId) {
        await loadMessages(conversationId);
      }
    };

    window.addEventListener('messageTrashed', handleMessageTrashed);
    
    return () => {
      window.removeEventListener('messageTrashed', handleMessageTrashed);
    };
  }, [activeConversation?.id, loadMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Scroll to bottom when conversation changes
  useEffect(() => {
    if (activeConversation && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeConversation?.id]);

  // Memoized values for performance
  const currentUserId = useMemo(() => session?.user?.id, [session?.user?.id]);
  const accessToken = useMemo(() => session?.accessToken, [session?.accessToken]);
  const conversationId = useMemo(() => panelState.activeConversationId, [panelState.activeConversationId]);
  const threadId = useMemo(() => panelState.activeThreadId, [panelState.activeThreadId]);

  // Clear errors when conversation changes
  useEffect(() => {
    setConnectionError(null);
    setRetryCount(0);
  }, [conversationId]);

  // Memoized functions
  const isOwnMessage = useCallback((message: Message) => {
    return message.senderId === currentUserId;
  }, [currentUserId]);

  const formatTime = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const getFileIcon = useCallback((type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return '📦';
    return '📎';
  }, []);

  const getGroupedReactions = useCallback((message: Message) => {
    if (!message.reactions) return [];
    
    const grouped = message.reactions.reduce((acc, reaction) => {
      const existing = acc.find(g => g.emoji === reaction.emoji);
      if (existing) {
        existing.count++;
        if (reaction.userId === currentUserId) {
          existing.hasReacted = true;
        }
      } else {
        acc.push({
          emoji: reaction.emoji,
          count: 1,
          hasReacted: reaction.userId === currentUserId
        });
      }
      return acc;
    }, [] as Array<{ emoji: string; count: number; hasReacted: boolean }>);
    
    return grouped.sort((a, b) => b.count - a.count);
  }, [currentUserId]);

  const hasUserReacted = useCallback((message: Message, emoji: string) => {
    return message.reactions?.some(r => r.emoji === emoji && r.userId === currentUserId) || false;
  }, [currentUserId]);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // WebSocket event handlers
  const handleNewMessage = useCallback((message: Message) => {
    if (message.conversationId === activeConversation?.id) {
      setTimeout(scrollToBottom, 100);
    }
  }, [activeConversation?.id, scrollToBottom]);

  const handleTypingStart = useCallback((data: { conversationId: string; userId: string; userName: string }) => {
    if (data.conversationId === activeConversation?.id && data.userId !== currentUserId) {
      const userName = data.userName || data.userId;
      setTypingUsers(prev => prev.includes(userName) ? prev : [...prev, userName]);
    }
  }, [activeConversation?.id, currentUserId]);

  const handleTypingStop = useCallback((data: { conversationId: string; userId: string }) => {
    if (data.conversationId === activeConversation?.id && data.userId !== currentUserId) {
      setTypingUsers(prev => prev.filter(user => user !== data.userId));
    }
  }, [activeConversation?.id, currentUserId]);

  const handleReactionUpdate = useCallback((data: { messageId: string; reaction: any; action: 'added' | 'removed' }) => {
    // This is now handled by the context
  }, []);

  const handleConnectionChange = useCallback(() => {
    setIsConnected(true);
    setConnectionError(null);
  }, []);

  const handleDisconnect = useCallback((reason: string) => {
    setIsConnected(false);
    setConnectionError(`Connection lost: ${reason}. Attempting to reconnect...`);
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('Chat WebSocket error:', error);
    setConnectionError('Connection error. Please check your internet connection.');
  }, []);

  // Connect to WebSocket and set up event listeners
  useEffect(() => {
    const connectToChat = async () => {
      try {
        setConnectionError(null);
        await chatAPI.connect();
        setIsConnected(true);
      } catch (error) {
        console.error('❌ Failed to connect to chat WebSocket:', error);
        setConnectionError('Failed to connect to chat server. Messages may not be real-time.');
        setIsConnected(false);
      }
    };

    // Connect to WebSocket
    if (accessToken) {
      connectToChat();
    }

    // Set up event listeners
    chatAPI.on('message:new', handleNewMessage);
    chatAPI.on('typing:start', handleTypingStart);
    chatAPI.on('typing:stop', handleTypingStop);
    chatAPI.on('message_reaction', handleReactionUpdate);
    chatAPI.on('connect', handleConnectionChange);
    chatAPI.on('disconnect', handleDisconnect);
    chatAPI.on('error', handleError);

    // Join conversation when it changes
    if (activeConversation?.id) {
      chatAPI.joinConversation(activeConversation.id);
    }

    return () => {
      chatAPI.off('message:new', handleNewMessage);
      chatAPI.off('typing:start', handleTypingStart);
      chatAPI.off('typing:stop', handleTypingStop);
      chatAPI.off('message_reaction', handleReactionUpdate);
      chatAPI.off('connect', handleConnectionChange);
      chatAPI.off('disconnect', handleDisconnect);
      chatAPI.off('error', handleError);
    };
  }, [accessToken, activeConversation?.id, handleNewMessage, handleTypingStart, handleTypingStop, handleReactionUpdate, handleConnectionChange, handleDisconnect, handleError]);

  // Handle send message (thread-aware)
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() && selectedFiles.length === 0 || !activeConversation?.id || !accessToken) return;

    try {
      setIsSending(true);
      
      // Upload files first if any
      const uploadedFileIds: string[] = [];
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            const fileId = await uploadFileToChat(file as any);
            uploadedFileIds.push(fileId);
          } catch (error) {
            console.error('Failed to upload file:', error);
          }
        }
      }

      // Enforce governance policies before sending
      const governanceResult = await enforceGovernancePolicies(accessToken, {
        resourceType: 'message',
        resourceId: `temp-${Date.now()}`, // Use a temporary ID for governance check
        content: newMessage.trim(),
        metadata: {
          conversationId: activeConversation.id,
          senderId: currentUserId,
          timestamp: new Date().toISOString()
        }
      });

      // Check for violations
      if (governanceResult.data.violations.length > 0) {
        console.warn('Governance policy violations detected:', governanceResult.data.violations);
        // You could show a warning to the user here
        toast.error('Message violated governance policies. Please adjust your message.');
        setIsSending(false);
        return;
      }

      await sendMessage(
        newMessage,
        uploadedFileIds.length > 0 ? uploadedFileIds : undefined,
        replyToMessage?.id,
        panelState.activeThreadId || undefined
      );

      setNewMessage('');
      setSelectedFiles([]);
      setReplyToMessage(null);
      
      // Optionally reload thread messages
      if (panelState.activeConversationId && panelState.activeThreadId) {
        const msgs = await loadThreadMessages(panelState.activeConversationId, panelState.activeThreadId);
        setThreadMessages(msgs);
      }
    } catch (err) {
      setThreadError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [newMessage, selectedFiles, activeConversation?.id, accessToken, replyToMessage, scrollToBottom, isConnected, sendMessage, setReplyToMessage, panelState.activeThreadId, panelState.activeConversationId, loadThreadMessages, uploadFileToChat]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }, []);

  // Handle reply
  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
  }, [setReplyToMessage]);

  // Handle reaction
  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      if (hasUserReacted(messages.find(m => m.id === messageId)!, emoji)) {
        await removeReaction(messageId, emoji);
      } else {
        await addReaction(messageId, emoji);
      }
    } catch (error) {
      console.error('Failed to handle reaction:', error);
    }
  }, [addReaction, removeReaction, hasUserReacted, messages]);

  // Handle quick reaction
  const handleQuickReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await addReaction(messageId, emoji);
      setShowQuickReactionsFor(null);
    } catch (error) {
      console.error('Failed to handle quick reaction:', error);
    }
  }, [addReaction]);

  // Handle file download
  const handleFileDownload = useCallback(async (file: SharedFileReference) => {
    try {
      const response = await fetch(`/api/drive/download/${file.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  }, [accessToken]);

  // Handle file preview
  const handleFilePreview = useCallback((file: SharedFileReference) => {
    // For now, just download the file
    // In the future, this could open a preview modal
    handleFileDownload(file);
  }, [handleFileDownload]);

  // Handle message deletion
  const handleDeleteMessage = useCallback(async (message: Message) => {
    try {
      // Move message to trash
      await trashItem({
        id: message.id,
        name: message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content,
        type: 'message',
        moduleId: 'chat',
        moduleName: 'Chat',
        metadata: {
          conversationId: message.conversationId,
          senderId: message.senderId,
        }
      });
      
      // Reload messages to reflect the deletion
      if (activeConversation?.id) {
        await loadMessages(activeConversation.id);
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, [trashItem, activeConversation?.id, loadMessages]);

  // Handle file selection
  const handleFileSelect = useCallback((fileId: string, fileName: string) => {
    setSelectedFiles(prev => [...prev, { id: fileId, name: fileName }]);
    setShowFileUpload(false);
  }, []);

  // Remove selected file
  const removeSelectedFile = useCallback((fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Get message status
  const getMessageStatus = useCallback((message: Message) => {
    if (message.senderId !== currentUserId) return null;
    
    if (message.readReceipts && message.readReceipts.length > 0) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    return <CheckCircle className="w-4 h-4 text-gray-400" />;
  }, [currentUserId]);

  // Get thread indicator
  const getThreadIndicator = useCallback((message: Message) => {
    if (message.replyToId) {
      return (
        <div className="text-xs text-gray-500 mb-1">
          <Reply className="w-3 h-3 inline mr-1" />
          Replying to message
        </div>
      );
    }
    return null;
  }, []);

  // Handle search
  const handleSearch = useCallback(async () => {
    // Search functionality not implemented yet
    console.log('Search functionality not implemented');
  }, []);

  if (!panelState.activeConversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/30 border-l border-border">
        <MessageSquare className="h-16 w-16 text-muted-foreground" />
        <h2 className="mt-4 text-2xl font-semibold">Select a conversation</h2>
        <p className="mt-2 text-muted-foreground">Choose from your existing conversations or start a new one.</p>
      </div>
    );
  }

  // UI: If a thread is selected, show thread view
  if (panelState.activeThreadId) {
    const thread = threads.find(t => t.id === panelState.activeThreadId);
    return (
      <div className="flex flex-col h-full">
        {/* Thread Header */}
        <div className="flex items-center p-4 border-b bg-white flex-shrink-0">
          <button onClick={() => onThreadSelect(null)} className="mr-2 p-1 rounded hover:bg-gray-100" title="Back to conversation">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="font-semibold text-lg">{thread?.name || `Thread ${thread?.id?.slice(0, 8)}`}</div>
            <div className="text-xs text-gray-500">
              {thread?.participants?.length || 0} participants • Last activity: {thread?.lastMessageAt ? formatTime(thread.lastMessageAt) : ''}
            </div>
          </div>
        </div>
        {/* Thread Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {loadingThreadMessages ? <Spinner /> :
            threadMessages.length === 0 ? <p className="text-gray-500">No messages in this thread.</p> :
            threadMessages.map(message => (
              <MessageItem
                key={message.id}
                message={message}
                isOwnMessage={isOwnMessage(message)}
                onReply={handleReply}
                onReaction={handleReaction}
                onQuickReaction={handleQuickReaction}
                onFileDownload={handleFileDownload}
                onFilePreview={handleFilePreview}
                showQuickReactionsFor={showQuickReactionsFor}
                setShowQuickReactionsFor={setShowQuickReactionsFor}
                formatTime={formatTime}
                getFileIcon={getFileIcon}
                getMessageStatus={getMessageStatus}
                getThreadIndicator={getThreadIndicator}
                getGroupedReactions={getGroupedReactions}
                hasUserReacted={hasUserReacted}
                replyingTo={replyToMessage}
                onDeleteMessage={handleDeleteMessage}
                accessToken={session?.accessToken || ''}
                hasEnterprise={hasEnterprise}
              />
            ))
          }
          <div ref={messagesEndRef} />
        </div>
        {/* Thread Input */}
        <div className="p-4 border-t bg-white flex-shrink-0">
          {/* File Reference Banner from Drive */}
          {fileReference && !selectedFiles.some(f => f.id === fileReference.fileId) && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">File from Drive</p>
                    <p className="text-xs text-blue-700">{fileReference.fileName}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedFiles([{ id: fileReference.fileId, name: fileReference.fileName }]);
                      setFileReference(undefined);
                    }}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Attach
                  </button>
                  <button
                    onClick={() => setFileReference(undefined)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Reply Indicator */}
          {replyToMessage && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
              <div className="flex items-center justify-between">
                <span className="font-medium">Replying to: {replyToMessage.content?.substring(0, 50)}...</span>
                <button onClick={() => setReplyToMessage(null)} className="text-blue-600 hover:text-blue-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Attachments ({selectedFiles.length})</span>
                <button
                  onClick={() => setSelectedFiles([])}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {selectedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-2 bg-white rounded border">
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <button
                      onClick={() => removeSelectedFile(file.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end space-x-2">
            <div className="flex-1 relative">
              <textarea
                value={newMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                aria-label="Message input"
                aria-describedby="message-help"
                disabled={isSending}
              />
              <div id="message-help" className="sr-only">
                Press Enter to send, Shift+Enter for new line
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              {/* File Upload Button */}
              <button
                onClick={() => setShowFileUpload(!showFileUpload)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Attach files"
                aria-expanded={showFileUpload}
                aria-controls="file-upload-panel"
                disabled={isSending}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              {/* Emoji Picker Button */}
              <button
                onClick={() => setShowMessageEmojiPicker(!showMessageEmojiPicker)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Add emoji"
                disabled={isSending}
              >
                <Smile className="w-5 h-5" />
              </button>
              
              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={(!newMessage.trim() && selectedFiles.length === 0) || isSending}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Emoji Picker */}
          {showMessageEmojiPicker && (
            <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
              <div className="grid grid-cols-8 gap-1">
                {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setNewMessage(prev => prev + emoji);
                      setShowMessageEmojiPicker(false);
                    }}
                    className="p-1 hover:bg-gray-100 rounded text-center transition-colors"
                  >
                    <span className="text-lg">{emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showFileUpload && (
            <div id="file-upload-panel" className="mt-3">
              <ChatFileUpload
                onFileSelect={handleFileSelect}
              />
            </div>
          )}
          
          {threadError && <div className="text-red-500 text-xs mt-1">{threadError}</div>}
        </div>
      </div>
    );
  }

  // UI: If no thread is selected, show main conversation messages only
  return (
    <div className="flex flex-col h-full">
      {/* Main Conversation Header */}
      <div className="flex items-center p-4 border-b bg-white flex-shrink-0">
        <div className="flex-1 font-semibold text-lg">{activeConversation?.name || 'Conversation'}</div>
        {onToggleRightPanel && (
          <button onClick={onToggleRightPanel} className="ml-2 p-1 rounded hover:bg-gray-100" title="Show details">
            <ChevronRight size={20} />
          </button>
        )}
      </div>
      
      {/* File Activity Notifications Banner */}
      {fileNotifications.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Recent file activity</span>
            </div>
            <button
              onClick={() => setFileNotifications([])}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {fileNotifications.slice(0, 3).map((notification) => {
            const fileId = (notification.data as any)?.fileId;
            const folderId = (notification.data as any)?.folderId;
            return (
              <div
                key={notification.id || notification.createdAt}
                className="flex items-center justify-between p-2 bg-white rounded border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{notification.title}</p>
                  {notification.body && (
                    <p className="text-xs text-gray-600 truncate">{notification.body}</p>
                  )}
                </div>
                {(fileId || folderId) && (
                  <button
                    onClick={() => {
                      if (fileId) {
                        router.push(`/drive/shared?file=${fileId}`);
                      } else if (folderId) {
                        router.push(`/drive/shared?folder=${folderId}`);
                      }
                      setFileNotifications(prev => prev.filter(n => n.id !== notification.id && n.createdAt !== notification.createdAt));
                    }}
                    className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                  >
                    Open
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
        {/* File Reference Banner from Drive */}
        {fileReference && !selectedFiles.some(f => f.id === fileReference.fileId) && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">File from Drive</p>
                  <p className="text-xs text-blue-700">{fileReference.fileName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSelectedFiles([{ id: fileReference.fileId, name: fileReference.fileName }]);
                    setFileReference(undefined);
                  }}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Attach to message
                </button>
                <button
                  onClick={() => setFileReference(undefined)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Main Conversation Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {isLoading ? <Spinner /> :
          messages.length === 0 ? <p className="text-gray-500">No messages yet.</p> :
          messages.map(message => (
            <MessageItem
              key={message.id}
              message={message}
              isOwnMessage={isOwnMessage(message)}
              onReply={handleReply}
              onReaction={handleReaction}
              onQuickReaction={handleQuickReaction}
              onFileDownload={handleFileDownload}
              onFilePreview={handleFilePreview}
              showQuickReactionsFor={showQuickReactionsFor}
              setShowQuickReactionsFor={setShowQuickReactionsFor}
              formatTime={formatTime}
              getFileIcon={getFileIcon}
              getMessageStatus={getMessageStatus}
              getThreadIndicator={getThreadIndicator}
              getGroupedReactions={getGroupedReactions}
              hasUserReacted={hasUserReacted}
              replyingTo={replyToMessage}
              onDeleteMessage={handleDeleteMessage}
              accessToken={session?.accessToken || ''}
              hasEnterprise={hasEnterprise}
            />
          ))
        }
        <div ref={messagesEndRef} />
      </div>
      {/* Main Conversation Input - Fixed at bottom */}
      <div className="p-4 border-t bg-white flex-shrink-0">
        {/* Reply Indicator */}
        {replyToMessage && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            <div className="flex items-center justify-between">
              <span className="font-medium">Replying to: {replyToMessage.content?.substring(0, 50)}...</span>
              <button onClick={() => setReplyToMessage(null)} className="text-blue-600 hover:text-blue-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Attachments ({selectedFiles.length})</span>
              <button
                onClick={() => setSelectedFiles([])}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {selectedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <button
                    onClick={() => removeSelectedFile(file.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              aria-label="Message input"
              aria-describedby="message-help"
              disabled={isSending}
            />
            <div id="message-help" className="sr-only">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* File Upload Button */}
            <button
              onClick={() => setShowFileUpload(!showFileUpload)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Attach files"
              aria-expanded={showFileUpload}
              aria-controls="file-upload-panel"
              disabled={isSending}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            
            {/* Emoji Picker Button */}
            <button
              onClick={() => setShowMessageEmojiPicker(!showMessageEmojiPicker)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Add emoji"
              disabled={isSending}
            >
              <Smile className="w-5 h-5" />
            </button>
            
            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={(!newMessage.trim() && selectedFiles.length === 0) || isSending}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Emoji Picker */}
        {showMessageEmojiPicker && (
          <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
            <div className="grid grid-cols-8 gap-1">
              {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setNewMessage(prev => prev + emoji);
                    setShowMessageEmojiPicker(false);
                  }}
                  className="p-1 hover:bg-gray-100 rounded text-center transition-colors"
                >
                  <span className="text-lg">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showFileUpload && (
          <div id="file-upload-panel" className="mt-3">
            <ChatFileUpload
              onFileSelect={handleFileSelect}
            />
          </div>
        )}
        
        {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
      </div>
    </div>
  );
}