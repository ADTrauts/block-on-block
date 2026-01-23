'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Zap, Brain, ChevronDown } from 'lucide-react';
import { Button } from 'shared/components';

export type AIProvider = 'auto' | 'openai' | 'anthropic';

interface AIServicePickerProps {
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

const PROVIDER_OPTIONS: Array<{
  value: AIProvider;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
}> = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Let AI choose based on query complexity',
    icon: Sparkles,
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'Best for general queries and conversations',
    icon: Zap,
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    description: 'Best for complex analysis and reasoning',
    icon: Brain,
  },
];

export default function AIServicePicker({
  value,
  onChange,
  compact = false,
  showLabel = true,
  className = '',
}: AIServicePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const selectedProvider = PROVIDER_OPTIONS.find(p => p.value === value) || PROVIDER_OPTIONS[0];
  const Icon = selectedProvider.icon;

  if (compact) {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title={selectedProvider.description}
        >
          <Icon className="h-3.5 w-3.5" />
          {showLabel && <span className="font-medium">{selectedProvider.label}</span>}
          <ChevronDown className="h-3 w-3" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px]">
            {PROVIDER_OPTIONS.map((option) => {
              const OptionIcon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    value === option.value
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <OptionIcon className="h-4 w-4" />
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                  {value === option.value && (
                    <div className="h-2 w-2 rounded-full bg-purple-600" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Icon className="h-4 w-4" />
        <span>{selectedProvider.label}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[220px]">
          {PROVIDER_OPTIONS.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  value === option.value
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <OptionIcon className="h-5 w-5" />
                <div className="flex-1">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                </div>
                {value === option.value && (
                  <div className="h-2 w-2 rounded-full bg-purple-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
