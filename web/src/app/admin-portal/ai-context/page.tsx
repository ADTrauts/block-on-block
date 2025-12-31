'use client';

import React, { useState } from 'react';
import { Brain, Search, BarChart3, Activity, Settings, Monitor } from 'lucide-react';
import UserContextInspector from '../../../components/admin-portal/UserContextInspector';
import AIReasoningViewer from '../../../components/admin-portal/AIReasoningViewer';
import ContextValidationTools from '../../../components/admin-portal/ContextValidationTools';
import CrossModuleContextMap from '../../../components/admin-portal/CrossModuleContextMap';
import RealTimeContextMonitor from '../../../components/admin-portal/RealTimeContextMonitor';

export default function AIContextDebugPage() {
  const [activeTab, setActiveTab] = useState('user-context');

  const tabs = [
    {
      id: 'user-context',
      label: 'User Context Inspector',
      icon: Search,
      description: 'Inspect AI context for specific users'
    },
    {
      id: 'ai-reasoning',
      label: 'AI Reasoning Viewer',
      icon: Brain,
      description: 'View AI decision-making process'
    },
    {
      id: 'context-validation',
      label: 'Context Validation',
      icon: Settings,
      description: 'Validate AI context integrity'
    },
    {
      id: 'cross-module',
      label: 'Cross-Module Map',
      icon: Activity,
      description: 'Visualize cross-module context'
    },
    {
      id: 'real-time',
      label: 'Real-Time Monitor',
      icon: Monitor,
      description: 'Live AI context monitoring'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Context Debugging</h1>
                <p className="text-gray-600">Debug and monitor AI context across all modules</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'user-context' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">User Context Inspector</h3>
              <p className="text-blue-800 text-sm">
                Search for any user by ID, email, or name to inspect their AI context, 
                including personality profile, autonomy settings, recent conversations, 
                and module installations.
              </p>
            </div>
            <UserContextInspector />
          </div>
        )}

        {activeTab === 'ai-reasoning' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-2">AI Reasoning Viewer</h3>
              <p className="text-green-800 text-sm">
                View the complete AI decision-making process for any session, including 
                user queries, AI responses, reasoning chains, confidence scores, and 
                user feedback.
              </p>
            </div>
            <AIReasoningViewer />
          </div>
        )}

        {activeTab === 'context-validation' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Context Validation Tools</h3>
              <p className="text-yellow-800 text-sm">
                Validate AI context integrity for any user, checking personality profiles, 
                autonomy settings, recent activity, and module installations to ensure 
                proper AI functionality.
              </p>
            </div>
            <ContextValidationTools />
          </div>
        )}

        {activeTab === 'cross-module' && (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">Cross-Module Context Map</h3>
              <p className="text-purple-800 text-sm">
                Visualize how data flows between modules for any user, showing connections 
                between Drive, Chat, Business, Calendar, and Household modules to understand 
                the complete user context.
              </p>
            </div>
            <CrossModuleContextMap />
          </div>
        )}

        {activeTab === 'real-time' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-2">Real-Time AI Context Monitor</h3>
              <p className="text-green-800 text-sm">
                Monitor AI context system performance in real-time, including user adoption, 
                conversation metrics, module usage, and system health status.
              </p>
            </div>
            <RealTimeContextMonitor />
          </div>
        )}
      </div>
    </div>
  );
}
