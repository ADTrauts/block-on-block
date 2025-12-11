'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Brain, Send, Sparkles, User, Bot, X, Zap, Lightbulb, TrendingUp } from 'lucide-react';
import { Button, Spinner, Card, Badge } from 'shared/components';
import { authenticatedApiCall } from '@/lib/apiUtils';
import { generateAISchedule, suggestShiftAssignments } from '@/api/scheduling';

interface SchedulingAIAssistantProps {
  scheduleId: string;
  businessId: string;
  onScheduleGenerated?: () => void;
  onSuggestionsReceived?: (suggestions: any[]) => void;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  metadata?: {
    action?: string;
    result?: any;
  };
}

const SUGGESTED_PROMPTS = [
  { icon: Zap, text: 'Generate schedule for this week', action: 'generate' },
  { icon: Lightbulb, text: 'Suggest employees for open shifts', action: 'suggest' },
  { icon: TrendingUp, text: 'Optimize schedule for availability', action: 'optimize' },
  { icon: Sparkles, text: 'Find scheduling conflicts', action: 'conflicts' },
];

export default function SchedulingAIAssistant({
  scheduleId,
  businessId,
  onScheduleGenerated,
  onSuggestionsReceived,
}: SchedulingAIAssistantProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !session?.accessToken) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Detect if this is a generation request
      const lowerInput = inputValue.toLowerCase();
      const isGenerateRequest = lowerInput.includes('generate') || 
                                lowerInput.includes('create') || 
                                lowerInput.includes('build') ||
                                lowerInput.includes('make a schedule');

      if (isGenerateRequest && scheduleId) {
        // Call AI schedule generation
        await handleGenerateSchedule(userMessage.content);
      } else if (lowerInput.includes('suggest') || lowerInput.includes('who can')) {
        // Call suggestion endpoint (would need shiftId)
        const aiMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          type: 'ai',
          content: 'To suggest employees for a shift, please click on a specific shift first, then ask me to suggest assignments.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Regular AI query using Digital Life Twin
        await handleAIQuery(userMessage.content);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        type: 'ai',
        content: `I'm sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSchedule = async (prompt: string) => {
    if (!session?.accessToken || !scheduleId || !businessId) return;

    try {
      // Extract strategy from prompt if mentioned
      let strategy: string | undefined;
      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.includes('budget') || lowerPrompt.includes('cost')) {
        strategy = 'BUDGET_FIRST';
      } else if (lowerPrompt.includes('availability') || lowerPrompt.includes('preferences')) {
        strategy = 'AVAILABILITY_FIRST';
      } else if (lowerPrompt.includes('compliance') || lowerPrompt.includes('legal')) {
        strategy = 'COMPLIANCE_FIRST';
      }

      // Call the AI schedule generation endpoint
      const response = await generateAISchedule({
        businessId,
        scheduleId,
        strategy: strategy as any,
      }, session.accessToken);

      if (response.success) {
        const aiMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          type: 'ai',
          content: `✅ ${response.message}\n\nI've generated ${response.created} shifts based on employee availability and your business's scheduling strategy. The schedule has been updated and you can see the changes in the calendar view.`,
          timestamp: new Date(),
          metadata: {
            action: 'generate_schedule',
            result: response,
          },
        };
        setMessages(prev => [...prev, aiMessage]);
        
        if (onScheduleGenerated) {
          onScheduleGenerated();
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const handleAIQuery = async (query: string) => {
    if (!session?.accessToken) return;

    try {
      // Use the main AI endpoint
      const response = await authenticatedApiCall<{
        response: string;
        actions?: Array<{ module: string; action: string }>;
      }>('/api/ai/twin', {
        method: 'POST',
        body: JSON.stringify({
          query,
          context: {
            currentModule: 'scheduling',
            moduleContext: {
              scheduleId,
              businessId,
            },
          },
        }),
      }, session.accessToken);

      const aiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        type: 'ai',
        content: response.response || 'I processed your request, but received an empty response.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      throw error;
    }
  };

  const handleSuggestedPrompt = (prompt: string, action: string) => {
    setInputValue(prompt);
    if (action === 'generate') {
      // Auto-send generate requests
      setTimeout(() => {
        handleSend();
      }, 100);
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Open AI Assistant"
      >
        <Brain className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold">Schedule AI Assistant</h3>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-white hover:bg-white/20 rounded p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="w-12 h-12 text-blue-500 mx-auto mb-3 opacity-50" />
            <p className="text-sm text-gray-600 mb-4">
              Ask me to generate schedules, suggest assignments, or optimize your schedule!
            </p>
            
            {/* Suggested Prompts */}
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((prompt, idx) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedPrompt(prompt.text, prompt.action)}
                    className="w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm flex items-center space-x-2"
                  >
                    <Icon className="w-4 h-4 text-blue-500" />
                    <span>{prompt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-2 ${
                msg.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-purple-100 text-purple-600'
                }`}
              >
                {msg.type === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div
                className={`flex-1 rounded-lg p-3 ${
                  msg.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.metadata?.action === 'generate_schedule' && msg.metadata?.result && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <Badge color="blue">
                      {msg.metadata.result.created} shifts created
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex items-start space-x-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <Spinner size={16} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
        <div className="flex items-end space-x-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask me to generate a schedule, suggest assignments..."
            className="flex-1 py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
            rows={1}
            style={{ minHeight: '36px', maxHeight: '100px' }}
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            size="sm"
            variant="primary"
            className="flex-shrink-0"
          >
            {isLoading ? (
              <Spinner size={16} />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

