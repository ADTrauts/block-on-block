'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Badge, Avatar } from 'shared/components';
import { useSession } from 'next-auth/react';
import { 
  Brain, 
  Send, 
  ThumbsUp, 
  ThumbsDown, 
  Bot, 
  User, 
  Sparkles, 
  FileText, 
  Mail, 
  Calendar,
  BarChart,
  Settings,
  Shield,
  AlertCircle
} from 'lucide-react';

interface AIChat {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  confidence?: number;
  reasoning?: string;
  suggestedActions?: string[];
  feedback?: 'helpful' | 'not_helpful';
}

interface BusinessAI {
  id: string;
  name: string;
  description: string;
  securityLevel: string;
  allowEmployeeInteraction: boolean;
  status: string;
}

interface AICapability {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
  enabled: boolean;
}

interface AllowedCapability {
  id: string;
  name: string;
  description: string;
  iconName: string;
  enabled: boolean;
}

interface EmployeeAIAssistantProps {
  businessId: string;
}

export const EmployeeAIAssistant: React.FC<EmployeeAIAssistantProps> = ({ businessId }) => {
  const { data: session } = useSession();
  const [businessAI, setBusinessAI] = useState<BusinessAI | null>(null);
  const [chatHistory, setChatHistory] = useState<AIChat[]>([]);
  const [capabilities, setCapabilities] = useState<AICapability[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (businessId) {
      loadEmployeeAIAccess();
    }
  }, [businessId]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const loadEmployeeAIAccess = async () => {
    try {
      const response = await fetch(`/api/business-ai/${businessId}/employee-access`, {
        headers: session?.accessToken ? { 'Authorization': `Bearer ${session.accessToken}` } : undefined
      });
      if (response.ok) {
        const data = await response.json();
        
        // Safely handle the response data
        if (data?.data) {
          setBusinessAI(data.data.businessAI || null);
          setCapabilities(transformCapabilities(data.data.allowedCapabilities));
        } else {
          console.warn('Unexpected API response structure:', data);
          setBusinessAI(null);
          setCapabilities([]);
        }
        setError(null);
      } else if (response.status === 404) {
        setError('Business AI not configured');
        setBusinessAI(null);
        setCapabilities([]);
      } else if (response.status === 403) {
        setError('Access denied to business AI');
        setBusinessAI(null);
        setCapabilities([]);
      } else {
        setError('Failed to load business AI access');
        setBusinessAI(null);
        setCapabilities([]);
      }
    } catch (error) {
      console.error('Failed to load business AI access:', error);
      setError('Failed to connect to business AI');
      setBusinessAI(null);
      setCapabilities([]);
    }
  };

  const handleAIQuery = async (query: string, quickAction?: string) => {
    if (!query.trim() || isLoading) return;

    const finalQuery = quickAction ? `${quickAction}: ${query}` : query;
    
    setIsLoading(true);
    setIsTyping(true);
    setCurrentQuery('');

    // Add user message to chat
    const userMessage: AIChat = {
      id: Date.now().toString(),
      type: 'user',
      content: finalQuery,
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`/api/business-ai/${businessId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.accessToken ? { 'Authorization': `Bearer ${session.accessToken}` } : {}) },
        body: JSON.stringify({
          query: finalQuery,
          context: {
            currentModule: getCurrentModule(),
            recentActivity: [],
            userRole: getUserRole(),
            activeProjects: [],
            permissions: []
          }
        })
      });

      if (response.ok) {
        const aiResponse = await response.json();
        
        // Simulate typing delay
        setTimeout(() => {
          setIsTyping(false);
          
          const aiMessage: AIChat = {
            id: (Date.now() + 1).toString(),
            type: 'ai',
            content: aiResponse.data.message,
            timestamp: new Date(),
            confidence: aiResponse.data.confidence,
            reasoning: aiResponse.data.reasoning,
            suggestedActions: aiResponse.data.suggestedActions
          };
          
          setChatHistory(prev => [...prev, aiMessage]);
        }, 1000 + Math.random() * 1000); // 1-2 second delay
        
      } else {
        const error = await response.json();
        setIsTyping(false);
        setError(error.message || 'AI interaction failed');
      }
    } catch (error) {
      console.error('AI interaction failed:', error);
      setIsTyping(false);
      setError('Failed to communicate with AI assistant');
    } finally {
      setIsLoading(false);
    }
  };

  const provideFeedback = async (messageId: string, helpful: boolean) => {
    // Update the message with feedback
    setChatHistory(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, feedback: helpful ? 'helpful' : 'not_helpful' }
          : msg
      )
    );

    // Could send feedback to backend here for learning
  };

  const handleQuickAction = (action: string, placeholder: string) => {
    const query = prompt(`${action}\n\nPlease provide details:`) || '';
    if (query.trim()) {
      handleAIQuery(query, action);
    }
  };

  const transformCapabilities = (allowedCapabilities: AllowedCapability[] | null | undefined): AICapability[] => {
    // Handle null, undefined, or non-array values
    if (!allowedCapabilities || !Array.isArray(allowedCapabilities)) {
      console.warn('allowedCapabilities is not an array:', allowedCapabilities);
      return [];
    }

    const iconMap: Record<string, React.ComponentType<{ size?: string | number; className?: string }>> = {
      'brain': Brain,
      'shield': Shield,
      'user': User,
      'users': User,
      'trending-up': Sparkles,
      'calendar': Calendar,
      'file-text': FileText,
      'bar-chart-3': BarChart,
      'mail': Mail,
      'lightbulb': Brain,
      'target': Brain,
      'clock': Brain,
      'check-circle': Brain,
      'alert-circle': AlertCircle
    };

    return allowedCapabilities.map(cap => ({
      id: cap.id,
      name: cap.name,
      description: cap.description,
      icon: iconMap[cap.iconName] || Brain,
      enabled: cap.enabled
    }));
  };

  if (error) {
    return (
      <Card className="w-full max-w-2xl">
        <div className="text-center p-4">
          <Bot className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <h3 className="text-gray-600 font-semibold">AI Assistant Unavailable</h3>
          <p className="text-gray-500">{error}</p>
        </div>
      </Card>
    );
  }

  if (!businessAI) {
    return (
      <Card className="w-full max-w-2xl">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <h3 className="font-semibold">Loading AI Assistant...</h3>
        </div>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl space-y-4">
      {/* AI Assistant Header */}
      <Card>
        <div className="pb-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10" nameOrEmail="AI Assistant" />
              <div>
                <h3 className="text-lg font-semibold">{businessAI.name}</h3>
                <p className="text-gray-600">{businessAI.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={businessAI.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {businessAI.status}
              </Badge>
              <Badge className="bg-blue-100 text-blue-800">{businessAI.securityLevel}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {capabilities.map((capability) => {
              const IconComponent = capability.icon;
              return (
                <Button
                  key={capability.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleQuickAction(capability.name, capability.description)}
                  className="h-auto flex-col gap-1 p-3"
                >
                  <IconComponent className="h-4 w-4" />
                  <span className="text-xs">{capability.name}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Chat Interface */}
      <Card className="flex flex-col h-96">
        <div className="pb-3 p-4">
          <h3 className="text-sm font-medium">AI Chat</h3>
        </div>
        
        {/* Chat Messages */}
        <div className="flex-1 p-0">
          <div ref={chatScrollRef} className="h-64 px-4 overflow-y-auto">
            <div className="space-y-4">
              {chatHistory.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <Bot className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>Start a conversation with your AI assistant</p>
                  <p className="text-sm">Try asking about documents, emails, or project help</p>
                </div>
              )}
              
              {chatHistory.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'ai' && (
                    <Avatar className="h-8 w-8" nameOrEmail="AI" />
                  )}
                  
                  <div className={`max-w-xs lg:max-w-md ${message.type === 'user' ? 'order-1' : ''}`}>
                    <div
                      className={`rounded-lg px-3 py-2 text-sm ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.content}
                    </div>
                    
                    {message.type === 'ai' && (
                      <div className="mt-2 space-y-2">
                        {message.confidence && (
                          <div className="text-xs text-gray-500">
                            Confidence: {(message.confidence * 100).toFixed(0)}%
                          </div>
                        )}
                        
                        {message.suggestedActions && message.suggestedActions.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">Suggested actions:</p>
                            {message.suggestedActions.map((action, index) => (
                              <div key={index} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                {action}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Feedback buttons */}
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => provideFeedback(message.id, true)}
                            className={`h-6 w-6 p-0 ${
                              message.feedback === 'helpful' ? 'text-green-600' : 'text-gray-400'
                            }`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => provideFeedback(message.id, false)}
                            className={`h-6 w-6 p-0 ${
                              message.feedback === 'not_helpful' ? 'text-red-600' : 'text-gray-400'
                            }`}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {message.type === 'user' && (
                    <Avatar className="h-8 w-8" nameOrEmail="User" />
                  )}
                </div>
              ))}
              
              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8" nameOrEmail="AI" />
                  <div className="bg-gray-100 rounded-lg px-3 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Chat Input */}
        <div className="pt-3 p-4">
          <div className="flex gap-2">
            <Input
              value={currentQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentQuery(e.target.value)}
              placeholder="Ask your AI assistant anything..."
              onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAIQuery(currentQuery);
                }
              }}
              disabled={isLoading}
            />
            <Button
              onClick={() => handleAIQuery(currentQuery)}
              disabled={!currentQuery.trim() || isLoading}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {/* Character counter */}
          <div className="text-xs text-gray-500 mt-1 text-right">
            {currentQuery.length} characters
          </div>
        </div>
      </Card>
    </div>
  );
};

// Helper functions
function getCurrentModule(): string {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    const segments = path.split('/');
    return segments[segments.length - 1] || 'dashboard';
  }
  return 'dashboard';
}

function getUserRole(): string {
  // This would typically come from session or context
  return 'employee';
}

function getCapabilityDescription(capability: string): string {
  const descriptions: Record<string, string> = {
    documentAnalysis: 'Analyze and summarize documents',
    emailDrafting: 'Help draft professional emails',
    meetingSummarization: 'Create meeting summaries and action items',
    workflowOptimization: 'Suggest process improvements',
    dataAnalysis: 'Analyze business data and trends',
    projectManagement: 'Assist with project planning and tracking',
    employeeAssistance: 'General employee support and guidance',
    complianceMonitoring: 'Monitor for compliance issues'
  };
  
  return descriptions[capability] || 'AI assistance feature';
}
