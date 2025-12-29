'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Badge, Spinner, Card } from 'shared/components';
import { Calendar, Check, X, ChevronDown, ChevronUp, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as todoAPI from '@/api/todo';
import type { SchedulingSuggestion } from '@/api/todo';

interface AISchedulingSuggestionsProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardId: string;
  businessId?: string | null;
  onSchedulingChange?: () => void;
}

export function AISchedulingSuggestions({
  isOpen,
  onClose,
  dashboardId,
  businessId,
  onSchedulingChange,
}: AISchedulingSuggestionsProps) {
  const { data: session } = useSession();
  const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([]);
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
      const fetchedSuggestions = await todoAPI.getSchedulingSuggestions(
        dashboardId,
        businessId || undefined,
        session.accessToken
      );
      setSuggestions(fetchedSuggestions);
    } catch (error) {
      console.error('Failed to load scheduling suggestions:', error);
      toast.error('Failed to load scheduling suggestions');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: date.getHours() > 0 ? 'numeric' : undefined,
      minute: date.getMinutes() > 0 ? '2-digit' : undefined,
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDaysUntil = (dateString: string): number => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleApplySuggestion = async (suggestion: SchedulingSuggestion) => {
    if (!session?.accessToken || applying) return;
    
    setApplying(suggestion.taskId);
    try {
      await todoAPI.executeSchedulingChanges(
        [{
          taskId: suggestion.taskId,
          suggestedDueDate: suggestion.suggestedDueDate,
          suggestedStartDate: suggestion.suggestedStartDate,
        }],
        session.accessToken
      );
      
      toast.success('Due date updated');
      
      // Remove suggestion from list
      setSuggestions(prev => prev.filter(s => s.taskId !== suggestion.taskId));
      
      if (onSchedulingChange) {
        onSchedulingChange();
      }
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
      toast.error('Failed to apply scheduling change');
    } finally {
      setApplying(null);
    }
  };

  const handleDismissSuggestion = (taskId: string) => {
    // Remove suggestion from list
    setSuggestions(prev => prev.filter(s => s.taskId !== taskId));
  };

  const handleApplyAll = async () => {
    if (!session?.accessToken || applying || suggestions.length === 0) return;
    
    setApplying('all');
    try {
      const changes = suggestions.map(s => ({
        taskId: s.taskId,
        suggestedDueDate: s.suggestedDueDate,
        suggestedStartDate: s.suggestedStartDate,
      }));
      
      const result = await todoAPI.executeSchedulingChanges(changes, session.accessToken);
      
      toast.success(`Updated due dates for ${result.updated} task(s)`);
      
      // Clear suggestions
      setSuggestions([]);
      
      if (onSchedulingChange) {
        onSchedulingChange();
      }
    } catch (error) {
      console.error('Failed to apply all suggestions:', error);
      toast.error('Failed to apply scheduling changes');
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
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5" />
          <h3 className="font-semibold">AI Scheduling Suggestions</h3>
          {suggestions.length > 0 && (
            <Badge className="bg-white text-blue-600">{suggestions.length}</Badge>
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
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              No scheduling suggestions available.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              AI will analyze your tasks and calendar to suggest optimal due dates.
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
                      <Spinner size={16} className="mr-2" />
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
                const daysUntil = getDaysUntil(suggestion.suggestedDueDate);
                
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

                      {/* Date Change */}
                      <div className="space-y-1">
                        {suggestion.currentDueDate && (
                          <div className="flex items-center text-xs text-gray-600">
                            <span className="line-through mr-2">
                              {formatDate(suggestion.currentDueDate)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3 h-3 text-blue-500" />
                          <span className="font-medium text-sm text-gray-900">
                            {formatDate(suggestion.suggestedDueDate)}
                          </span>
                          {suggestion.suggestedStartDate && (
                            <span className="text-xs text-gray-500">
                              at {formatTime(suggestion.suggestedStartDate)}
                            </span>
                          )}
                        </div>
                        {daysUntil >= 0 && (
                          <div className="text-xs text-gray-500">
                            {daysUntil === 0 ? 'Today' : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} from now`}
                          </div>
                        )}
                      </div>

                      {/* Conflicts Warning */}
                      {suggestion.conflicts && suggestion.conflicts.length > 0 && (
                        <div className="flex items-start space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-800">
                              {suggestion.conflicts.length} potential conflict{suggestion.conflicts.length !== 1 ? 's' : ''}
                            </p>
                            {isExpanded && (
                              <ul className="mt-1 space-y-1">
                                {suggestion.conflicts.map((conflict, idx) => (
                                  <li key={idx} className="text-yellow-700">
                                    • {conflict.eventTitle} ({formatTime(conflict.startAt)})
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}

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
                              <Spinner size={14} className="mr-1" />
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
              <Spinner size={14} className="mr-2" />
              Refreshing...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              Refresh Suggestions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

