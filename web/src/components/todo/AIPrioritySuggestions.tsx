'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Badge, Spinner, Card } from 'shared/components';
import { Sparkles, Check, X, ChevronDown, ChevronUp, Zap, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as todoAPI from '@/api/todo';
import type { PrioritySuggestion, TaskPriority } from '@/api/todo';

interface AIPrioritySuggestionsProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardId: string;
  businessId?: string | null;
  onPriorityChange?: () => void;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function AIPrioritySuggestions({
  isOpen,
  onClose,
  dashboardId,
  businessId,
  onPriorityChange,
}: AIPrioritySuggestionsProps) {
  const { data: session } = useSession();
  const [suggestions, setSuggestions] = useState<PrioritySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null); // taskId being applied
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && session?.accessToken) {
      loadSuggestions();
    }
  }, [isOpen, session?.accessToken, dashboardId, businessId]);

  const loadSuggestions = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const fetchedSuggestions = await todoAPI.getPrioritySuggestions(
        dashboardId,
        businessId || undefined,
        session.accessToken
      );
      setSuggestions(fetchedSuggestions);
      
      // Dispatch event for AI logo blinking
      if (fetchedSuggestions.length > 0) {
        window.dispatchEvent(new CustomEvent('todoAISuggestionsAvailable', {
          detail: { count: fetchedSuggestions.length }
        }));
      }
    } catch (error) {
      console.error('Failed to load priority suggestions:', error);
      toast.error('Failed to load priority suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = async (suggestion: PrioritySuggestion) => {
    if (!session?.accessToken || applying) return;
    
    setApplying(suggestion.taskId);
    try {
      await todoAPI.executePriorityChanges(
        [{ taskId: suggestion.taskId, newPriority: suggestion.suggestedPriority }],
        session.accessToken
      );
      
      toast.success(`Priority updated to ${PRIORITY_LABELS[suggestion.suggestedPriority]}`);
      
      // Remove suggestion from list
      setSuggestions(prev => prev.filter(s => s.taskId !== suggestion.taskId));
      
      // Dispatch event to update count
      window.dispatchEvent(new CustomEvent('todoAISuggestionsAvailable', {
        detail: { count: suggestions.length - 1 }
      }));
      
      if (onPriorityChange) {
        onPriorityChange();
      }
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
      toast.error('Failed to apply priority change');
    } finally {
      setApplying(null);
    }
  };

  const handleDismissSuggestion = (taskId: string) => {
    // Remove suggestion from list
    setSuggestions(prev => prev.filter(s => s.taskId !== taskId));
    
    // Dispatch event to update count
    window.dispatchEvent(new CustomEvent('todoAISuggestionsAvailable', {
      detail: { count: suggestions.length - 1 }
    }));
  };

  const handleApplyAll = async () => {
    if (!session?.accessToken || applying || suggestions.length === 0) return;
    
    setApplying('all');
    try {
      const changes = suggestions.map(s => ({
        taskId: s.taskId,
        newPriority: s.suggestedPriority,
      }));
      
      const result = await todoAPI.executePriorityChanges(changes, session.accessToken);
      
      toast.success(`Updated priorities for ${result.updated} task(s)`);
      
      // Clear suggestions
      setSuggestions([]);
      
      // Dispatch event to update count
      window.dispatchEvent(new CustomEvent('todoAISuggestionsAvailable', {
        detail: { count: 0 }
      }));
      
      if (onPriorityChange) {
        onPriorityChange();
      }
    } catch (error) {
      console.error('Failed to apply all suggestions:', error);
      toast.error('Failed to apply priority changes');
    } finally {
      setApplying(null);
    }
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return 'text-green-600';
    if (confidence >= 0.4) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getConfidenceBarWidth = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-blue-600 text-white">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold">AI Priority Suggestions</h3>
          {suggestions.length > 0 && (
            <Badge className="bg-white text-purple-600">{suggestions.length}</Badge>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              No priority suggestions available.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              AI will analyze your tasks and suggest priority changes when needed.
            </p>
          </div>
        ) : (
          <>
            {/* Bulk Actions */}
            {suggestions.length > 1 && (
              <div className="mb-4 space-y-2">
                <Button
                  onClick={handleApplyAll}
                  disabled={applying === 'all'}
                  variant="primary"
                  size="sm"
                  className="w-full"
                >
                  {applying === 'all' ? (
                    <>
                      <Spinner size={16} />
                      <span className="mr-2" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Apply All ({suggestions.length})
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Suggestions List */}
            <div className="space-y-3">
              {suggestions.map((suggestion) => {
                const isExpanded = expandedTasks.has(suggestion.taskId);
                const isApplying = applying === suggestion.taskId;
                
                return (
                  <Card key={suggestion.taskId} className="p-3">
                    <div className="space-y-2">
                      {/* Task Title */}
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-sm text-gray-900 flex-1">
                          {suggestion.taskTitle}
                        </h4>
                        <button
                          onClick={() => toggleExpanded(suggestion.taskId)}
                          className="text-gray-400 hover:text-gray-600 ml-2"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Priority Change */}
                      <div className="flex items-center space-x-2">
                        <Badge className={PRIORITY_COLORS[suggestion.currentPriority]}>
                          {PRIORITY_LABELS[suggestion.currentPriority]}
                        </Badge>
                        <span className="text-gray-400">→</span>
                        <Badge className={PRIORITY_COLORS[suggestion.suggestedPriority]}>
                          {PRIORITY_LABELS[suggestion.suggestedPriority]}
                        </Badge>
                      </div>

                      {/* Confidence Score */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Confidence</span>
                          <span className={getConfidenceColor(suggestion.confidence)}>
                            {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              suggestion.confidence >= 0.7
                                ? 'bg-green-500'
                                : suggestion.confidence >= 0.4
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                            }`}
                            style={{ width: getConfidenceBarWidth(suggestion.confidence) }}
                          />
                        </div>
                      </div>

                      {/* Reasoning (Expandable) */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-600 mb-2">{suggestion.reasoning}</p>
                          {suggestion.factors && suggestion.factors.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-700">Factors:</p>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {suggestion.factors.map((factor, idx) => (
                                  <li key={idx} className="flex items-start">
                                    <span className="mr-2">•</span>
                                    <span>{factor.description}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center space-x-2 pt-2">
                        <Button
                          onClick={() => handleApplySuggestion(suggestion)}
                          disabled={isApplying}
                          variant="primary"
                          size="sm"
                          className="flex-1"
                        >
                          {isApplying ? (
                            <>
                              <Spinner size={14} />
                              <span className="mr-1" />
                              Applying...
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Apply
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleDismissSuggestion(suggestion.taskId)}
                          disabled={isApplying}
                          variant="ghost"
                          size="sm"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <Button
          onClick={loadSuggestions}
          disabled={loading}
          variant="ghost"
          size="sm"
          className="w-full"
        >
          {loading ? (
            <>
              <Spinner size={14} />
              <span className="mr-2" />
              Refreshing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Refresh Suggestions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

