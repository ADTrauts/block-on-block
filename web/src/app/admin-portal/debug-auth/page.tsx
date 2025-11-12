'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { adminApiService } from '../../../lib/adminApiService';
import { useImpersonation } from '../../../contexts/ImpersonationContext';

export default function DebugAuthPage() {
  const { data: session, status } = useSession();
  const { isImpersonating, currentSession, startImpersonation, endImpersonation } = useImpersonation();
  const [testResults, setTestResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const results: any = {};

    try {
      // Test 1: Check session
      results.session = {
        status,
        hasSession: !!session,
        user: session?.user,
        hasToken: !!session?.accessToken,
        tokenLength: session?.accessToken?.length
      };

      // Test 2: Test admin API service
      try {
        const usersResponse = await adminApiService.getUsers({ page: 1, limit: 5 });
        results.adminApi = {
          success: !usersResponse.error,
          error: usersResponse.error,
          data: usersResponse.data
        };
      } catch (error) {
        results.adminApi = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      // Test 3: Test impersonation API directly
      try {
        const impersonationResponse = await adminApiService.getCurrentImpersonation();
        results.impersonation = {
          success: !impersonationResponse.error,
          error: impersonationResponse.error,
          data: impersonationResponse.data
        };
      } catch (error) {
        results.impersonation = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      // Test 4: Test starting impersonation
      try {
        const startResponse = await adminApiService.startImpersonation('af4d32fc-6ef7-4ce8-a8ba-e5ad6369f0ae', {
          reason: 'Debug test'
        });
        results.startImpersonation = {
          success: !startResponse.error,
          error: startResponse.error,
          data: startResponse.data
        };
      } catch (error) {
        results.startImpersonation = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

    } catch (error) {
      results.generalError = error instanceof Error ? error.message : 'Unknown error';
    }

    setTestResults(results);
    setLoading(false);
  };

  const handleStartImpersonation = async () => {
    // Redirect to the proper impersonation page
    window.location.href = '/admin-portal/impersonate';
  };

  const handleEndImpersonation = async () => {
    const success = await endImpersonation();
    if (success) {
      alert('Impersonation ended successfully!');
    } else {
      alert('Failed to end impersonation');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Authentication Debug</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Session Status</h2>
            <div className="bg-gray-50 p-4 rounded">
              <p><strong>Status:</strong> {status}</p>
              <p><strong>Has Session:</strong> {session ? 'Yes' : 'No'}</p>
              <p><strong>User Email:</strong> {session?.user?.email || 'None'}</p>
              <p><strong>User Role:</strong> {session?.user?.role || 'None'}</p>
              <p><strong>Has Token:</strong> {session?.accessToken ? 'Yes' : 'No'}</p>
              <p><strong>Token Length:</strong> {session?.accessToken?.length || 0}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Impersonation Status</h2>
            <div className="bg-gray-50 p-4 rounded">
              <p><strong>Is Impersonating:</strong> {isImpersonating ? 'Yes' : 'No'}</p>
              <p><strong>Target User:</strong> {currentSession?.targetUser?.name || 'None'}</p>
              <p><strong>Target Email:</strong> {currentSession?.targetUser?.email || 'None'}</p>
              <p><strong>Started At:</strong> {currentSession?.startedAt || 'None'}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Actions</h2>
          <div className="flex space-x-4">
            <button
              onClick={runTests}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Running Tests...' : 'Run API Tests'}
            </button>
            <button
              onClick={handleStartImpersonation}
              disabled={isImpersonating}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isImpersonating ? 'Already Impersonating' : 'Go to Impersonation'}
            </button>
            <button
              onClick={handleEndImpersonation}
              disabled={!isImpersonating}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              End Impersonation
            </button>
          </div>
        </div>

        {Object.keys(testResults).length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-4">Test Results</h2>
            <div className="bg-gray-50 p-4 rounded">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
