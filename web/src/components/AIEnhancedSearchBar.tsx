'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Command, Brain, Send, Sparkles, Bot, User, Lightbulb } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useGlobalSearch } from '../contexts/GlobalSearchContext';
import { SearchResult, SearchSuggestion } from 'shared/types/search';
import { Button, Badge, Spinner } from 'shared/components';
import { authenticatedApiCall } from '../lib/apiUtils';
import ErrorBoundary from './ErrorBoundary';

interface AIEnhancedSearchBarProps {
  className?: string;
  dashboardId?: string;
  dashboardType?: 'personal' | 'business' | 'educational' | 'household';
  dashboardName?: string;
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
  type: 'user' | 'ai' | 'search_results';
  content: string;
  timestamp: Date;
  aiResponse?: AIResponse;
  searchResults?: SearchResult[];
  confidence?: number;
}

interface AIAction {
  type: string;
  module: string;
  operation: string;
  requiresApproval: boolean;
  reasoning: string;
}

interface AIInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  source?: string;
}

interface CrossModuleConnection {
  id: string;
  moduleId: string;
  moduleName: string;
  connectionType: string;
  description: string;
  relevance: number;
}

interface AIMetadata {
  processingTime: number;
  modelUsed: string;
  tokensUsed: number;
  contextWindow: number;
  [key: string]: unknown;
}

// Detect if input is a question/command vs search query
function detectIntentType(input: string): 'ai_query' | 'search' {
  const aiIndicators = [
    // Question words
    /^(what|how|when|where|why|who|which|can|could|would|should|will|do|does|did|is|are|was|were)/i,
    // Command words
    /^(help|show|find|create|make|schedule|send|delete|organize|remind|tell|explain)/i,
    // Conversational patterns
    /^(i need|i want|i would like|please|could you|can you)/i,
    // AI-specific requests
    /(schedule|meeting|email|remind|organize|analyze|summarize|explain)/i
  ];

  return aiIndicators.some(pattern => pattern.test(input.trim())) ? 'ai_query' : 'search';
}

// Utility: highlight search terms in text
function highlightText(text: string, query: string) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(regex).map((part, i) =>
    regex.test(part) ? <span key={i} className="bg-yellow-200 font-semibold">{part}</span> : part
  );
}

// Group results by module
function groupResultsByModule(results: SearchResult[]) {
  const groups: { [key: string]: SearchResult[] } = {};
  for (const result of results) {
    if (!groups[result.moduleId]) groups[result.moduleId] = [];
    groups[result.moduleId].push(result);
  }
  return groups;
}

export default function AIEnhancedSearchBar({ 
  className = '',
  dashboardId,
  dashboardType = 'personal',
  dashboardName = 'Dashboard'
}: AIEnhancedSearchBarProps) {
  const { data: session } = useSession();
  const { state, search, getSuggestions, clearResults } = useGlobalSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [isAIMode, setIsAIMode] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [selectedProvider, setSelectedProvider] = useState<'auto' | 'openai' | 'anthropic'>('auto');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component is mounted for portal
  useEffect(() => {
    setIsMounted(true);
    loadProviderPreference();
  }, []);

  // Load user's provider preference
  const loadProviderPreference = async () => {
    if (!session?.accessToken) return;
    
    try {
      const response = await authenticatedApiCall<{
        success: boolean;
        data: { preferredProvider: 'auto' | 'openai' | 'anthropic' };
      }>('/api/ai/preferences', {
        method: 'GET',
      }, session.accessToken);
      
      if (response.success && response.data?.preferredProvider) {
        setSelectedProvider(response.data.preferredProvider);
      }
    } catch (error) {
      console.warn('Failed to load provider preference:', error);
    }
  };

  useEffect(() => {
    if (isAIMode && conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, isAIMode]);

  // Update dropdown position
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
    }
  }, [isOpen]);

  // Handle input change with AI intent detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (!value.trim()) {
      clearResults();
      setIsAIMode(false);
      setIsOpen(false);
      return;
    }

    // Detect intent and switch modes
    const intentType = detectIntentType(value);
    const shouldShowAI = intentType === 'ai_query' && !!session?.accessToken;
    
    setIsAIMode(shouldShowAI);
    setIsOpen(true);

    if (shouldShowAI) {
      // AI mode - show conversation interface
    } else {
      // Search mode - perform traditional search
      handleSearch(value);
      getSuggestions(value);
    }
  };

  // Handle search submission
  const handleSearch = async (query?: string) => {
    const searchQuery = query || inputValue.trim();
    if (searchQuery) {
      await search(searchQuery);
      
      // Add search results to conversation if in AI mode
      if (isAIMode && state.results.length > 0) {
        const searchItem: ConversationItem = {
          id: `search_${Date.now()}`,
          type: 'search_results',
          content: `Search results for "${searchQuery}"`,
          timestamp: new Date(),
          searchResults: state.results
        };
        setConversation(prev => [...prev, searchItem]);
      }
    }
  };

  // Handle AI query submission
  const handleAIQuery = async () => {
    if (!inputValue.trim() || isAILoading || !session?.accessToken) return;

    const userQuery = inputValue.trim();
    
    // Add user message to conversation
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
      // 🚀 Use Revolutionary Digital Life Twin endpoint
      const response = await authenticatedApiCall<{ 
        success: boolean;
        data: {
          response: string;
          confidence: number;
          reasoning?: string;
          actions?: AIAction[];
          insights?: AIInsight[];
          personalityAlignment?: number;
          crossModuleConnections?: CrossModuleConnection[];
          metadata?: AIMetadata;
        }
      }>(
        '/api/ai/twin',
        {
          method: 'POST',
          body: JSON.stringify({
            query: userQuery,
            provider: selectedProvider,
            context: {
              currentModule: 'search',
              dashboardType,
              dashboardName,
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

    } catch (error) {
      console.error('AI query failed:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // Add error message with more details
      const errorMessage = error instanceof Error && error.message.includes('Invalid response structure') 
        ? 'I encountered an issue with the AI service response. Please try again.'
        : 'I apologize, but I encountered an error processing your request. Please try again.';
        
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

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isAIMode) {
        handleAIQuery();
      } else {
        handleSearch();
      }
    }
    
    if (e.key === 'Escape') {
      setIsOpen(false);
      setIsAIMode(false);
      setInputValue('');
      clearResults();
    }
  };

  // Clear everything
  const handleClear = () => {
    setInputValue('');
    setIsOpen(false);
    setIsAIMode(false);
    setConversation([]);
    clearResults();
    inputRef.current?.focus();
  };

  // Switch to AI mode manually
  const switchToAIMode = () => {
    setIsAIMode(true);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  // Switch to search mode manually
  const switchToSearchMode = () => {
    setIsAIMode(false);
    if (inputValue.trim()) {
      handleSearch();
    }
  };

  // Render dropdown content
  const renderDropdownContent = () => {
    if (!isOpen) return null;

    const maxHeight = window.innerHeight * 0.6;

    return (
      <div
        ref={resultsRef}
        className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
        style={{
          top: dropdownPosition.top + 8,
          left: dropdownPosition.left,
          width: Math.max(dropdownPosition.width, 400),
          maxHeight,
        }}
      >
        {/* Mode switcher */}
        <div className="p-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isAIMode ? (
                <>
                  <Brain className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">AI Assistant</span>
                  <Sparkles className="h-3 w-3 text-yellow-500" />
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">Search Results</span>
                </>
              )}
            </div>
            
            <div className="flex items-center space-x-1">
              <Button
                variant={isAIMode ? 'ghost' : 'primary'}
                size="sm"
                onClick={switchToSearchMode}
                className="px-2 py-1 text-xs"
              >
                Search
              </Button>
              <Button
                variant={isAIMode ? 'primary' : 'ghost'}
                size="sm"
                onClick={switchToAIMode}
                className="px-2 py-1 text-xs"
                disabled={!session?.accessToken}
              >
                AI
              </Button>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="max-h-96 overflow-y-auto">
          {isAIMode ? (
            // AI Conversation Mode
            <div className="p-4 space-y-4">
              {conversation.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">Ask me anything about your digital life</p>
                  <p className="text-gray-400 text-xs mt-1">
                    I can help schedule meetings, organize files, analyze data, and more
                  </p>
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
                              <Bot className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                              <div>
                                <p className="text-sm text-gray-800">{item.content}</p>
                                
                                {/* Actions */}
                                {item.aiResponse?.actions && item.aiResponse.actions.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {item.aiResponse.actions.map((action, index) => (
                                      <div key={index} className="bg-blue-50 rounded px-2 py-1">
                                        <span className="text-xs text-blue-700">
                                          {action.type}: {action.operation}
                                        </span>
                                        {action.requiresApproval && (
                                          <Badge size="sm" className="ml-2 bg-yellow-100 text-yellow-800">
                                            Approval Required
                                          </Badge>
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
                      
                      {item.type === 'search_results' && item.searchResults && (
                        <div className="border border-gray-200 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Search className="h-4 w-4 mr-1" />
                            {item.content}
                          </h4>
                          <div className="space-y-2">
                            {item.searchResults.slice(0, 3).map((result) => (
                              <div key={result.id} className="text-xs">
                                <p className="font-medium text-gray-900">{result.title}</p>
                                <p className="text-gray-600">{result.description}</p>
                              </div>
                            ))}
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
          ) : (
            // Traditional Search Mode
            <div className="p-4">
              {state.loading ? (
                <div className="text-center py-8">
                  <Spinner size={24} />
                  <p className="text-sm text-gray-500 mt-2">Searching...</p>
                </div>
              ) : state.results.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(groupResultsByModule(state.results)).map(([moduleId, results]) => (
                    <div key={moduleId} className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 capitalize">{moduleId}</h3>
                      {results.slice(0, 3).map((result) => (
                        <div key={result.id} className="p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <p className="text-sm font-medium text-gray-900">
                            {highlightText(result.title, inputValue)}
                          </p>
                          <p className="text-xs text-gray-600">
                            {highlightText(result.description || '', inputValue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : inputValue && !state.loading ? (
                <div className="text-center py-8">
                  <Search className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No results found</p>
                  {session?.accessToken && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={switchToAIMode}
                      className="mt-2"
                    >
                      <Brain className="h-4 w-4 mr-1" />
                      Ask AI instead
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <div className={`relative ${className}`}>
        {/* Search Input */}
        <div className="relative">
          <div className={`flex items-center bg-white border rounded-lg shadow-sm focus-within:ring-2 focus-within:border-blue-500 ${
            isAIMode ? 'border-blue-300 focus-within:ring-blue-500' : 'border-gray-300 focus-within:ring-blue-500'
          }`}>
            <div className="pl-3 pr-2">
              {isAIMode ? (
                <Brain className="w-5 h-5 text-blue-600" />
              ) : (
                <Search className="w-5 h-5 text-gray-400" />
              )}
            </div>
            
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              onFocus={() => inputValue && setIsOpen(true)}
              placeholder={isAIMode ? "Ask your AI assistant anything..." : "Search across all modules..."}
              className="flex-1 py-3 px-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none"
            />
            
            <div className="flex items-center pr-2 space-x-2">
              {inputValue && (
                <button
                  onClick={handleClear}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              
              {isAIMode && (
                <Button
                  onClick={handleAIQuery}
                  disabled={!inputValue.trim() || isAILoading}
                  size="sm"
                  variant="primary"
                >
                  {isAILoading ? <Spinner size={12} /> : <Send className="w-4 h-4" />}
                </Button>
              )}
              
              <div className="flex items-center text-xs text-gray-400">
                <Command className="w-3 h-3 mr-1" />
                <span>K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dropdown Results - Rendered via Portal */}
        {isOpen && isMounted && createPortal(
          renderDropdownContent(),
          document.body
        )}
      </div>
    </ErrorBoundary>
  );
}