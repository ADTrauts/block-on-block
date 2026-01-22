'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Spinner, Alert } from 'shared/components';
import { Sparkles, Zap, Brain, Info } from 'lucide-react';
import { authenticatedApiCall } from '../../lib/apiUtils';
import AIServicePicker, { type AIProvider } from './AIServicePicker';

export default function ProviderSettings() {
  const { data: session } = useSession();
  const [preferredProvider, setPreferredProvider] = useState<AIProvider>('auto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (session?.accessToken) {
      loadPreferences();
    }
  }, [session?.accessToken]);

  const loadPreferences = async () => {
    if (!session?.accessToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await authenticatedApiCall<{
        success: boolean;
        data: { preferredProvider: AIProvider };
      }>('/api/ai/preferences', {
        method: 'GET',
      }, session.accessToken);
      
      if (response.success && response.data?.preferredProvider) {
        setPreferredProvider(response.data.preferredProvider);
      }
    } catch (err) {
      console.error('Failed to load provider preferences:', err);
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!session?.accessToken) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      const response = await authenticatedApiCall<{
        success: boolean;
        data: { preferredProvider: AIProvider };
      }>('/api/ai/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          preferredProvider
        })
      }, session.accessToken);
      
      if (response.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError('Failed to save preferences');
      }
    } catch (err) {
      console.error('Failed to save provider preferences:', err);
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <Spinner size={32} />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">AI Provider Selection</h2>
          <p className="text-gray-600">
            Choose your default AI provider. You can override this selection per conversation in the AI chat interface.
          </p>
        </div>

        {error && (
          <Alert className="mb-4" variant="error">
            {error}
          </Alert>
        )}

        {success && (
          <Alert className="mb-4" variant="success">
            Preferences saved successfully!
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Provider
            </label>
            <AIServicePicker
              value={preferredProvider}
              onChange={setPreferredProvider}
              compact={false}
              showLabel={true}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900 mb-2">How Provider Selection Works</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>
                    <strong>Auto:</strong> The system intelligently selects the best provider based on query complexity and content. 
                    Sensitive content (passwords, SSN, etc.) always uses local processing for security.
                  </li>
                  <li>
                    <strong>OpenAI:</strong> Best for general queries, conversations, and decision-making tasks.
                  </li>
                  <li>
                    <strong>Anthropic:</strong> Best for complex analysis, reasoning, and understanding tasks.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={savePreferences}
              disabled={saving}
              variant="primary"
            >
              {saving ? <Spinner size={16} /> : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <h4 className="font-medium text-gray-900">OpenAI</h4>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• General purpose queries</li>
              <li>• Conversational tasks</li>
              <li>• Decision-making</li>
              <li>• Fast responses</li>
            </ul>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <h4 className="font-medium text-gray-900">Anthropic</h4>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Complex analysis</li>
              <li>• Deep reasoning</li>
              <li>• Understanding tasks</li>
              <li>• Detailed responses</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
