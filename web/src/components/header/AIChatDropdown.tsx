'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Brain, Send, X, Sparkles, Bot, User, Search, Plus, Settings, History, ExternalLink, Zap, Lightbulb, TrendingUp, Clock } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { authenticatedApiCall } from '../../lib/apiUtils';
import { Button, Spinner } from 'shared/components';
import { generateAISchedule } from '../../api/scheduling';
import * as todoAPI from '../../api/todo';
import type { SchedulingSuggestion } from '../../api/todo';
import { 
  getConversations, 
  getConversation,
  createConversation, 
  addMessage, 
  type AIConversation as AIConversationType,
  type AIMessage as AIMessageType 
} from '../../api/aiConversations';

interface ModuleContext {
  module: string;
  businessId?: string;
  scheduleId?: string;
}

interface AIChatDropdownProps {
  className?: string;
  dashboardId?: string;
  dashboardType?: 'personal' | 'business' | 'educational' | 'household';
  dashboardName?: string;
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number; width: number };
  moduleContext?: ModuleContext;
}

interface AIResponse {
  id: string;
  response: string;
  confidence: number;
  reasoning?: string;
  actions?: Array<{
    type: string;
    module: string;
    operation: string;
    requiresApproval: boolean;
    reasoning: string;
  }>;
}

interface ConversationItem {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  aiResponse?: AIResponse;
  confidence?: number;
}

// Scheduling-specific prompts
const SCHEDULING_PROMPTS = [
  { icon: Zap, text: 'Generate schedule for this week', action: 'generate' },
  { icon: Lightbulb, text: 'Suggest employees for open shifts', action: 'suggest' },
  { icon: TrendingUp, text: 'Optimize schedule for availability', action: 'optimize' },
  { icon: Sparkles, text: 'Find scheduling conflicts', action: 'conflicts' },
];

// To-Do module-specific prompts
const TODO_PROMPTS = [
  { icon: Zap, text: 'Prioritize my tasks', action: 'prioritize' },
  { icon: Clock, text: 'Optimize task scheduling', action: 'schedule' },
  { icon: Lightbulb, text: 'What should I focus on today?', action: 'focus' },
  { icon: Sparkles, text: 'Show overdue tasks', action: 'overdue' },
];

export default function AIChatDropdown({ 
  className = '', 
  dashboardId, 
  dashboardType = 'personal', 
  dashboardName = 'Dashboard',
  isOpen, 
  onClose, 
  position,
  moduleContext
}: AIChatDropdownProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  
  // Fallback: Detect module from pathname if moduleContext not provided
  const effectiveModuleContext = moduleContext || (pathname?.includes('/todo') || pathname?.includes('/tasks') ? {
    module: 'todo' as const,
    dashboardId,
    businessId: undefined,
  } : undefined);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [conversations, setConversations] = useState<AIConversationType[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ensure component is mounted for portal
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Debug: Log moduleContext when it changes
  useEffect(() => {
    if (moduleContext) {
      console.log('[AIChatDropdown] ModuleContext:', moduleContext);
    }
  }, [moduleContext]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Load conversation history
  useEffect(() => {
    if (isOpen && session?.accessToken) {
      loadConversations();
    }
  }, [isOpen, session?.accessToken]);

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
        dashboardId
      });

      const response = await getConversations({
        limit: 20,
        archived: false,
        dashboardId,
      }, session.accessToken);

      if (response.success) {
        setConversations(response.data.conversations);
        console.log('Successfully loaded conversations:', response.data.conversations.length);
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

  // Handle AI query submission
  const handleAIQuery = async (queryText?: string) => {
    const query = queryText || inputValue.trim();
    if (!query || isAILoading) return;

    // Validate session and token
    if (!session) {
      setAuthError('Please log in to use AI features');
      return;
    }

    if (!session.accessToken) {
      setAuthError('Authentication token not available. Please refresh the page.');
      return;
    }

    const userQuery = query;
    
    // Clear previous errors
    setAuthError(null);
    
    // Add user message to conversation
    const userItem: ConversationItem = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: userQuery,
      timestamp: new Date()
    };
    
    setConversation(prev => [...prev, userItem]);
    if (!queryText) {
      setInputValue('');
    }
    setIsAILoading(true);

    try {
      // Create conversation if it doesn't exist
      let conversationId = currentConversationId;
      if (!conversationId) {
        const conversationResponse = await createConversation({
          title: generateTitle(userQuery),
          dashboardId,
        }, session.accessToken);
        
        if (conversationResponse.success) {
          conversationId = conversationResponse.data.id;
          setCurrentConversationId(conversationId);
          // Reload conversations to include the new one
          loadConversations();
        }
      }

      // Add user message to database
      if (conversationId) {
        await addMessage(conversationId, {
          role: 'user',
          content: userQuery,
        }, session.accessToken);
      }

      // Use existing Digital Life Twin endpoint
      const response = await authenticatedApiCall<{ 
        success: boolean;
        data: {
          response: string;
          confidence: number;
          reasoning?: string;
          actions?: Array<{
            type: string;
            module: string;
            operation: string;
            requiresApproval: boolean;
            reasoning: string;
          }>;
        }
      }>(
        '/api/ai/twin',
        {
          method: 'POST',
          body: JSON.stringify({
            query: userQuery,
            context: {
              currentModule: effectiveModuleContext?.module || 'search',
              dashboardType,
              dashboardName,
              moduleContext: effectiveModuleContext ? {
                module: effectiveModuleContext.module,
                businessId: effectiveModuleContext.businessId,
                scheduleId: (effectiveModuleContext as any).scheduleId,
              } : undefined,
              urgency: userQuery.toLowerCase().includes('urgent') || userQuery.toLowerCase().includes('asap') ? 'high' : 'medium'
            }
          })
        },
        session.accessToken
      );

      // Validate response structure
      if (!response.success || !response.data) {
        throw new Error('Invalid response structure from AI service');
      }

      // Add AI response to conversation
      const aiItem: ConversationItem = {
        id: `ai_${Date.now()}`,
        type: 'ai',
        content: response.data.response || 'I apologize, but I couldn\'t generate a proper response.',
        timestamp: new Date(),
        aiResponse: {
          id: `ai-res-${Date.now()}`,
          response: response.data.response || 'No response generated',
          confidence: response.data.confidence || 0.5,
          reasoning: response.data.reasoning,
          actions: response.data.actions || []
        },
        confidence: response.data.confidence || 0.5
      };

      setConversation(prev => [...prev, aiItem]);

      // Add AI message to database
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

  // Helper function to generate conversation title
  const generateTitle = (content: string): string => {
    const title = content.substring(0, 50).trim();
    return title.length < content.length ? `${title}...` : title;
  };

  // Handle scheduling prompt click
  const handleSchedulingPrompt = async (prompt: typeof SCHEDULING_PROMPTS[0]) => {
    if (!session?.accessToken || !moduleContext?.businessId) return;
    
    // Handle generate schedule action (requires scheduleId)
    if (prompt.action === 'generate' && moduleContext.scheduleId) {
      try {
        setIsAILoading(true);
        
        // Add user message
        const userItem: ConversationItem = {
          id: `user_${Date.now()}`,
          type: 'user',
          content: prompt.text,
          timestamp: new Date()
        };
        setConversation([userItem]);
        
        const response = await generateAISchedule({
          businessId: moduleContext.businessId,
          scheduleId: moduleContext.scheduleId,
        }, session.accessToken);
        
        if (response.success) {
          const aiItem: ConversationItem = {
            id: `ai_${Date.now()}`,
            type: 'ai',
            content: `✅ ${response.message}\n\nI've generated ${response.created} shifts based on employee availability and your business's scheduling strategy. The schedule has been updated and you can see the changes in the calendar view.`,
            timestamp: new Date(),
          };
          setConversation(prev => [...prev, aiItem]);
        }
      } catch (error) {
        const errorItem: ConversationItem = {
          id: `error_${Date.now()}`,
          type: 'ai',
          content: `I'm sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        };
        setConversation(prev => [...prev, errorItem]);
      } finally {
        setIsAILoading(false);
      }
    } else {
      // For other prompts, use regular AI query with prompt text
      handleAIQuery(prompt.text);
    }
  };

  const handleTodoPrompt = async (prompt: typeof TODO_PROMPTS[0]) => {
    if (!session?.accessToken || !dashboardId) return;
    
    try {
      setIsAILoading(true);
      
      // Add user message
      const userItem: ConversationItem = {
        id: `user_${Date.now()}`,
        type: 'user',
        content: prompt.text,
        timestamp: new Date()
      };
      setConversation([userItem]);
      
      if (prompt.action === 'prioritize') {
        // Fetch priority suggestions
        const suggestions = await todoAPI.getPrioritySuggestions(
          dashboardId || '',
          effectiveModuleContext?.businessId || undefined,
          session.accessToken
        );
        
        if (suggestions.length === 0) {
          const aiItem: ConversationItem = {
            id: `ai_${Date.now()}`,
            type: 'ai',
            content: '✅ All your tasks are already well-prioritized! I don\'t have any priority suggestions at this time.',
            timestamp: new Date(),
          };
          setConversation(prev => [...prev, aiItem]);
        } else {
          // Format suggestions for display
          const suggestionsText = suggestions.map((s, idx) => 
            `${idx + 1}. **${s.taskTitle}**\n   - Current: ${s.currentPriority}\n   - Suggested: ${s.suggestedPriority}\n   - Confidence: ${Math.round(s.confidence * 100)}%\n   - Reasoning: ${s.reasoning}`
          ).join('\n\n');
          
          const aiItem: ConversationItem = {
            id: `ai_${Date.now()}`,
            type: 'ai',
            content: `📊 **Priority Suggestions**\n\nI found ${suggestions.length} task${suggestions.length > 1 ? 's' : ''} that could benefit from priority adjustments:\n\n${suggestionsText}\n\nWould you like me to apply these suggestions?`,
            timestamp: new Date(),
            aiResponse: {
              id: `ai-res-${Date.now()}`,
              response: `Found ${suggestions.length} priority suggestions`,
              confidence: 0.8,
              actions: suggestions.map(s => ({
                type: 'update_priority',
                module: 'todo',
                operation: `update_priority`,
                requiresApproval: true,
                reasoning: s.reasoning
              }))
            }
          };
          setConversation(prev => [...prev, aiItem]);
        }
      } else if (prompt.action === 'schedule') {
        // Fetch scheduling suggestions
        const result = await todoAPI.getSchedulingSuggestions(
          dashboardId || 'default',
          effectiveModuleContext?.businessId || undefined,
          session.accessToken
        );
        
        if (result.length === 0) {
          const aiItem: ConversationItem = {
            id: `ai_${Date.now()}`,
            type: 'ai',
            content: '✅ All your tasks are already well-scheduled! I don\'t have any scheduling suggestions at this time.',
            timestamp: new Date(),
          };
          setConversation(prev => [...prev, aiItem]);
        } else {
          // Format suggestions for display
          const suggestionsText = result.map((s: SchedulingSuggestion, idx: number) => {
            const currentDate = s.currentDueDate ? new Date(s.currentDueDate).toLocaleDateString() : 'No due date';
            const suggestedDate = new Date(s.suggestedDueDate).toLocaleDateString();
            const conflicts = s.conflicts && s.conflicts.length > 0 
              ? `\n   - ⚠️ Conflicts: ${s.conflicts.map((c: { eventTitle: string }) => c.eventTitle).join(', ')}`
              : '';
            return `${idx + 1}. **${s.taskTitle}**\n   - Current: ${currentDate}\n   - Suggested: ${suggestedDate}\n   - Confidence: ${Math.round(s.confidence * 100)}%\n   - Reasoning: ${s.reasoning}${conflicts}`;
          }).join('\n\n');
          
          const aiItem: ConversationItem = {
            id: `ai_${Date.now()}`,
            type: 'ai',
            content: `📅 **Scheduling Suggestions**\n\nI found ${result.length} task${result.length > 1 ? 's' : ''} that could benefit from better scheduling:\n\n${suggestionsText}\n\nWould you like me to apply these suggestions?`,
            timestamp: new Date(),
            aiResponse: {
              id: `ai-res-${Date.now()}`,
              response: `Found ${result.length} scheduling suggestions`,
              confidence: 0.8,
              actions: result.map((s: SchedulingSuggestion) => ({
                type: 'update_schedule',
                module: 'todo',
                operation: `update_task_duedate`,
                requiresApproval: true,
                reasoning: s.reasoning
              }))
            }
          };
          setConversation(prev => [...prev, aiItem]);
        }
      } else {
        // For other prompts (focus, overdue), use regular AI query
        handleAIQuery(prompt.text);
        return; // handleAIQuery manages its own loading state
      }
    } catch (error) {
      const errorItem: ConversationItem = {
        id: `error_${Date.now()}`,
        type: 'ai',
        content: `I'm sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, errorItem]);
    } finally {
      setIsAILoading(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAIQuery();
    }
    
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Start new conversation
  const handleNewConversation = () => {
    setConversation([]);
    setCurrentConversationId(null);
    setInputValue('');
    inputRef.current?.focus();
  };

  // Load conversation
  const handleLoadConversation = async (conversationId: string) => {
    if (!session?.accessToken) return;

    try {
      const response = await getConversation(conversationId, session.accessToken);
      
      if (response.success) {
        // Convert API messages to conversation items
        const conversationItems: ConversationItem[] = response.data.messages.map((msg: AIMessageType) => ({
          id: msg.id,
          type: msg.role === 'assistant' ? 'ai' : 'user',
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          confidence: msg.confidence,
          aiResponse: msg.role === 'assistant' ? {
            id: msg.id,
            response: msg.content,
            confidence: msg.confidence || 0.5,
            reasoning: msg.metadata?.reasoning,
            actions: msg.metadata?.actions || []
          } : undefined
        }));

        setConversation(conversationItems);
        setCurrentConversationId(conversationId);
        setShowHistory(false);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  if (!isOpen || !isMounted) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: '70vh',
        maxHeight: '600px',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">AI Assistant</span>
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="px-2 py-1 text-xs"
            >
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewConversation}
              className="px-2 py-1 text-xs"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/ai')}
              className="px-2 py-1 text-xs text-purple-600 hover:text-purple-700"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Full Chat
            </Button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
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

      {/* Content Area */}
      <div className="flex h-full">
        {/* Main Chat Area */}
        <div className={`flex-1 flex flex-col ${showHistory ? 'w-3/5' : 'w-full'} transition-all duration-300`}>
          {/* Quick Actions for To-Do Module - Always visible */}
          {effectiveModuleContext?.module === 'todo' && conversation.length > 0 && (
            <div className="px-4 pt-4 pb-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-700 mb-2">Quick actions:</p>
              <div className="flex flex-wrap gap-2">
                {TODO_PROMPTS.map((prompt, idx) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleTodoPrompt(prompt)}
                      disabled={isAILoading}
                      className="text-xs px-3 py-1.5 bg-white rounded-md border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-gray-900 flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon className="w-3 h-3 text-purple-500" />
                      <span>{prompt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Conversation */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingConversations ? (
              <div className="text-center py-8">
                <div className="h-8 w-8 mx-auto text-purple-600 mb-3">
                  <Spinner size={32} />
                </div>
                <p className="text-gray-500 text-sm">Loading conversations...</p>
              </div>
            ) : conversation.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Ask me anything about your digital life</p>
                <p className="text-gray-400 text-xs mt-1">
                  I can help schedule meetings, organize files, analyze data, and more
                </p>
                
                {/* Scheduling-specific prompts */}
                {moduleContext?.module === 'scheduling' && (
                  <div className="mt-6 space-y-2">
                    <p className="text-xs text-gray-500 mb-3">Quick actions for scheduling:</p>
                    {SCHEDULING_PROMPTS.map((prompt, idx) => {
                      const Icon = prompt.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSchedulingPrompt(prompt)}
                          disabled={isAILoading}
                          className="w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm text-gray-900 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Icon className="w-4 h-4 text-purple-500" />
                          <span className="text-gray-900">{prompt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* To-Do module-specific prompts */}
                {effectiveModuleContext?.module === 'todo' && (
                  <div className="mt-6 space-y-2">
                    <p className="text-xs font-medium text-gray-700 mb-3">Quick actions for tasks:</p>
                    {/* Debug: Uncomment to verify moduleContext */}
                    {/* {console.log('TODO Module detected, showing prompts', moduleContext)} */}
                    {TODO_PROMPTS.map((prompt, idx) => {
                      const Icon = prompt.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleTodoPrompt(prompt)}
                          disabled={isAILoading}
                          className="w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm text-gray-900 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Icon className="w-4 h-4 text-purple-500" />
                          <span className="text-gray-900">{prompt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
                {conversation.map((item) => (
                  <div key={item.id} className="space-y-2">
                    {item.type === 'user' && (
                      <div className="flex justify-end">
                        <div className="bg-blue-600 text-white rounded-lg px-3 py-2 max-w-xs">
                          <p className="text-sm">{item.content}</p>
                        </div>
                      </div>
                    )}
                    
                    {item.type === 'ai' && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-sm">
                          <div className="flex items-start space-x-2">
                            <Bot className="h-4 w-4 text-purple-600 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-gray-800">{item.content}</p>
                              
                              {/* Actions */}
                              {item.aiResponse?.actions && item.aiResponse.actions.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {item.aiResponse.actions.map((action, index) => (
                                    <div key={index} className="bg-purple-50 rounded px-2 py-1">
                                      <span className="text-xs text-purple-700">
                                        {action.type}: {action.operation}
                                      </span>
                                      {action.requiresApproval && (
                                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1 rounded">
                                          Approval Required
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Confidence */}
                              {item.confidence !== undefined && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Confidence: {Math.round(item.confidence * 100)}%
                                </p>
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
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <div className="flex items-center space-x-2">
                    <Spinner size={16} />
                    <span className="text-sm text-gray-600">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask your AI assistant anything..."
                className="flex-1 py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={isAILoading}
              />
              <Button
                onClick={() => handleAIQuery()}
                disabled={!inputValue.trim() || isAILoading}
                size="sm"
                variant="primary"
                className="px-3 py-2"
              >
                {isAILoading ? <Spinner size={12} /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div className="w-2/5 border-l border-gray-200 bg-gray-50">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Conversations</h3>
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleLoadConversation(conv.id)}
                    className="w-full text-left p-2 rounded hover:bg-gray-100 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{conv.title}</p>
                    <p className="text-xs text-gray-500">
                      {conv.messageCount} messages • {new Date(conv.lastMessageAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
