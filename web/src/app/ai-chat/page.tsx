'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Brain, Send, Plus, Archive, Pin, Trash2, MessageSquare, Sparkles, Bot, User, Search, MoreVertical, Check, X } from 'lucide-react';
import { Button, Spinner } from 'shared/components';
import { 
  getConversations, 
  getConversation,
  createConversation, 
  updateConversation,
  deleteConversation,
  addMessage, 
  type AIConversation,
  type AIMessage 
} from '../../api/aiConversations';
import { authenticatedApiCall } from '../../lib/apiUtils';
import { useDashboard } from '../../contexts/DashboardContext';
import { useGlobalTrash } from '../../contexts/GlobalTrashContext';
import { toast } from 'react-hot-toast';

interface ConversationItem {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export default function AIChat() {
  const { data: session } = useSession();
  const { currentDashboard } = useDashboard();
  const { trashItem } = useGlobalTrash();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<AIConversation | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  // Load conversations on mount
  useEffect(() => {
    if (session?.accessToken) {
      loadConversations();
    }
  }, [session?.accessToken, showArchived]);

  const loadConversations = async () => {
    // Clear previous errors
    setConversationError(null);
    setAuthError(null);

    // Validate session and token
    if (!session) {
      setAuthError('Please log in to access AI conversations');
      return;
    }

    if (!session.accessToken) {
      setAuthError('Authentication token not available. Please refresh the page.');
      return;
    }

    setIsLoadingConversations(true);

    try {
      console.log('Loading AI conversations with token:', {
        hasToken: !!session.accessToken,
        tokenLength: session.accessToken?.length,
        dashboardId: currentDashboard?.id
      });

      const response = await getConversations({
        limit: 50,
        archived: showArchived,
        dashboardId: currentDashboard?.id,
      }, session.accessToken);

      if (response.success) {
        setConversations(response.data.conversations);
        console.log('Successfully loaded conversations:', response.data.conversations.length);
        
        // Auto-select first conversation if none selected
        if (!currentConversationId && response.data.conversations.length > 0) {
          loadConversationMessages(response.data.conversations[0].id);
        }
      } else {
        setConversationError('Failed to load conversations. Please try again.');
        console.error('API returned error:', response);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      
      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes('authentication')) {
        setAuthError('Authentication failed. Please log in again.');
      } else if (error instanceof Error && error.message.includes('token')) {
        setAuthError('Session expired. Please refresh the page.');
      } else {
        setConversationError('Failed to load conversations. Please try again.');
      }
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Load conversation messages
  const loadConversationMessages = async (conversationId: string) => {
    // Validate session and token
    if (!session) {
      setAuthError('Please log in to access AI conversations');
      return;
    }

    if (!session.accessToken) {
      setAuthError('Authentication token not available. Please refresh the page.');
      return;
    }

    try {
      const response = await getConversation(conversationId, session.accessToken);
      
      if (response.success) {
        const conversationItems: ConversationItem[] = response.data.messages.map((msg: AIMessage) => ({
          id: msg.id,
          type: msg.role === 'assistant' ? 'ai' : 'user',
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          confidence: msg.confidence,
          metadata: msg.metadata
        }));

        setConversation(conversationItems);
        setCurrentConversationId(conversationId);
        setSelectedConversation(response.data);
      } else {
        setConversationError('Failed to load conversation messages. Please try again.');
        console.error('API returned error:', response);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      
      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes('authentication')) {
        setAuthError('Authentication failed. Please log in again.');
      } else if (error instanceof Error && error.message.includes('token')) {
        setAuthError('Session expired. Please refresh the page.');
      } else {
        setConversationError('Failed to load conversation messages. Please try again.');
      }
    }
  };

  // Handle AI query submission
  const handleAIQuery = async () => {
    if (!inputValue.trim() || isAILoading) return;

    // Validate session and token
    if (!session) {
      setAuthError('Please log in to use AI features');
      return;
    }

    if (!session.accessToken) {
      setAuthError('Authentication token not available. Please refresh the page.');
      return;
    }

    const userQuery = inputValue.trim();
    
    // Clear previous errors
    setAuthError(null);
    
    const userItem: ConversationItem = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: userQuery,
      timestamp: new Date()
    };
    
    setConversation(prev => [...prev, userItem]);
    setInputValue('');
    setIsAILoading(true);

    try {
      let conversationId = currentConversationId;
      if (!conversationId) {
        const conversationResponse = await createConversation({
          title: generateTitle(userQuery),
          dashboardId: currentDashboard?.id,
        }, session.accessToken);
        
        if (conversationResponse.success) {
          conversationId = conversationResponse.data.id;
          setCurrentConversationId(conversationId);
          loadConversations();
        }
      }

      if (conversationId) {
        await addMessage(conversationId, {
          role: 'user',
          content: userQuery,
        }, session.accessToken);
      }

      const response = await authenticatedApiCall<{ 
        success: boolean;
        data: {
          response: string;
          confidence: number;
          reasoning?: string;
          actions?: Array<Record<string, unknown>>;
        }
      }>(
        '/api/ai/twin',
        {
          method: 'POST',
          body: JSON.stringify({
            query: userQuery,
            context: {
              currentModule: 'ai-chat',
              dashboardType: 'personal',
              urgency: userQuery.toLowerCase().includes('urgent') || userQuery.toLowerCase().includes('asap') ? 'high' : 'medium'
            }
          })
        },
        session.accessToken
      );

      if (!response.success || !response.data) {
        throw new Error('Invalid response structure from AI service');
      }

      const aiItem: ConversationItem = {
        id: `ai_${Date.now()}`,
        type: 'ai',
        content: response.data.response || 'I apologize, but I couldn\'t generate a proper response.',
        timestamp: new Date(),
        confidence: response.data.confidence || 0.5,
        metadata: {
          reasoning: response.data.reasoning,
          actions: response.data.actions || []
        }
      };

      setConversation(prev => [...prev, aiItem]);

      if (conversationId) {
        await addMessage(conversationId, {
          role: 'assistant',
          content: response.data.response || 'No response generated',
          confidence: response.data.confidence || 0.5,
          metadata: {
            reasoning: response.data.reasoning,
            actions: response.data.actions || []
          }
        }, session.accessToken);
      }

    } catch (error) {
      console.error('AI query failed:', error);
      
      let errorMessage = 'I apologize, but I encountered an error processing your request. Please try again.';
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('authentication') || error.message.includes('token')) {
          setAuthError('Authentication failed. Please log in again.');
          errorMessage = 'Authentication error. Please refresh the page and try again.';
        } else if (error.message.includes('Invalid response structure')) {
          errorMessage = 'I encountered an issue with the AI service response. Please try again.';
        } else if (error.message.includes('No authentication token available')) {
          setAuthError('Please log in to use AI features');
          errorMessage = 'Please log in to use AI features.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      const errorItem: ConversationItem = {
        id: `error_${Date.now()}`,
        type: 'ai',
        content: errorMessage,
        timestamp: new Date(),
        confidence: 0
      };
      
      setConversation(prev => [...prev, errorItem]);
    } finally {
      setIsAILoading(false);
    }
  };

  const generateTitle = (content: string): string => {
    const title = content.substring(0, 50).trim();
    return title.length < content.length ? `${title}...` : title;
  };

  const handleNewConversation = () => {
    setConversation([]);
    setCurrentConversationId(null);
    setSelectedConversation(null);
    inputRef.current?.focus();
  };

  const handleArchiveConversation = async () => {
    if (!currentConversationId || !session?.accessToken) return;

    try {
      await updateConversation(currentConversationId, {
        isArchived: !selectedConversation?.isArchived
      }, session.accessToken);
      
      loadConversations();
      handleNewConversation();
      setShowMoreMenu(false);
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const handlePinConversation = async () => {
    if (!currentConversationId || !session?.accessToken) return;

    try {
      await updateConversation(currentConversationId, {
        isPinned: !selectedConversation?.isPinned
      }, session.accessToken);
      
      loadConversations();
      setShowMoreMenu(false);
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  };

  const handleDeleteConversation = async () => {
    if (!currentConversationId || !session?.accessToken) return;
    
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) return;
    
    if (!confirm(`Are you sure you want to move "${conversation.title || 'this conversation'}" to trash?`)) return;

    try {
      // Use global trash API
      await trashItem({
        id: conversation.id,
        name: conversation.title || 'Untitled Conversation',
        type: 'ai_conversation',
        moduleId: 'ai-chat',
        moduleName: 'AI Chat',
        metadata: {
          dashboardId: currentDashboard?.id,
        },
      });

      toast.success(`${conversation.title || 'Conversation'} moved to trash`);
      loadConversations();
      handleNewConversation();
      setShowMoreMenu(false);
    } catch (error) {
      console.error('Failed to move conversation to trash:', error);
      toast.error('Failed to move conversation to trash');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAIQuery();
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedConversations = filteredConversations.filter(c => c.isPinned);
  const regularConversations = filteredConversations.filter(c => !c.isPinned);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar - Conversations List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl font-bold text-gray-900">AI Assistant</h1>
            </div>
            <Button
              onClick={handleNewConversation}
              size="sm"
              variant="primary"
              className="px-3 py-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Archive Toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="mt-3 w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Archive className="h-4 w-4" />
            <span>{showArchived ? 'Show Active' : 'Show Archived'}</span>
          </button>
        </div>

        {/* Error Messages */}
        {authError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              <p className="text-sm text-red-700">{authError}</p>
              <button
                onClick={() => setAuthError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {conversationError && (
          <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
              <p className="text-sm text-yellow-700">{conversationError}</p>
              <button
                onClick={() => setConversationError(null)}
                className="ml-auto text-yellow-400 hover:text-yellow-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="flex justify-center items-center h-32">
              <Spinner size={24} />
            </div>
          ) : (
            <>
              {/* Pinned Conversations */}
              {pinnedConversations.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Pinned
                  </div>
                  {pinnedConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversationMessages(conv.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
                        currentConversationId === conv.id
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <Pin className="h-3 w-3 text-purple-600 flex-shrink-0" />
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {conv.title}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {conv.messageCount} messages • {new Date(conv.lastMessageAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Regular Conversations */}
              {regularConversations.length > 0 && (
                <div className="py-2">
                  {pinnedConversations.length > 0 && (
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                      Recent
                    </div>
                  )}
                  {regularConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversationMessages(conv.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
                        currentConversationId === conv.id
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-transparent'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conv.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {conv.messageCount} messages • {new Date(conv.lastMessageAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {filteredConversations.length === 0 && !isLoadingConversations && (
                <div className="text-center py-12 px-4">
                  <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {!searchQuery && 'Start a new conversation to get started'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        {selectedConversation && (
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedConversation.title}</h2>
              <p className="text-sm text-gray-500">
                {selectedConversation.messageCount} messages
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MoreVertical className="h-5 w-5 text-gray-600" />
              </button>
              
              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <button
                    onClick={handlePinConversation}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Pin className="h-4 w-4" />
                    <span>{selectedConversation.isPinned ? 'Unpin' : 'Pin'}</span>
                  </button>
                  <button
                    onClick={handleArchiveConversation}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Archive className="h-4 w-4" />
                    <span>{selectedConversation.isArchived ? 'Unarchive' : 'Archive'}</span>
                  </button>
                  <button
                    onClick={handleDeleteConversation}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {conversation.length === 0 && !selectedConversation ? (
            <div className="text-center py-16">
              <Brain className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Welcome to AI Assistant
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Ask me anything about your digital life. I can help you schedule meetings, 
                organize files, analyze data, and much more.
              </p>
            </div>
          ) : (
            <>
              {conversation.map((item) => (
                <div key={item.id} className="space-y-2">
                  {item.type === 'user' && (
                    <div className="flex justify-end">
                      <div className="bg-blue-600 text-white rounded-2xl px-4 py-3 max-w-2xl">
                        <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                      </div>
                    </div>
                  )}
                  
                  {item.type === 'ai' && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 max-w-2xl">
                        <div className="flex items-start space-x-3">
                          <Bot className="h-5 w-5 text-purple-600 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.content}</p>
                            
                            {item.confidence !== undefined && (
                              <div className="flex items-center space-x-2 mt-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className={`h-1.5 rounded-full ${
                                      item.confidence > 0.7 ? 'bg-green-500' :
                                      item.confidence > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${item.confidence * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">
                                  {Math.round(item.confidence * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={conversationEndRef} />
            </>
          )}
          
          {isAILoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-center space-x-3">
                  <Spinner size={16} />
                  <span className="text-sm text-gray-600">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-4">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask your AI assistant anything..."
                  className="w-full py-3 px-4 text-sm border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  rows={3}
                  disabled={isAILoading}
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                  Press Enter to send, Shift+Enter for new line
                </div>
              </div>
              <Button
                onClick={handleAIQuery}
                disabled={!inputValue.trim() || isAILoading}
                size="lg"
                variant="primary"
                className="px-6 py-3 rounded-2xl"
              >
                {isAILoading ? <Spinner size={16} /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
