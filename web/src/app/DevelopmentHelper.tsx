'use client';

import React, { useEffect, useState } from 'react';
import { useAuthError } from '../contexts/AuthErrorContext';
import { authenticatedApiCall } from '../lib/apiUtils';

// Development helper component to improve stability
export default function DevelopmentHelper() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const { showLoginModal } = useAuthError();
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
    if (!isDevelopment) return;

    // Add development-specific error handling
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.warn('Unhandled promise rejection:', event.reason);
      // Prevent the error from crashing the app in development
      event.preventDefault();
    };

    const handleError = (event: ErrorEvent) => {
      console.warn('Unhandled error:', event.error);
      // Prevent the error from crashing the app in development
      event.preventDefault();
    };

    // Add global error handlers for development
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Expose test functions to window for console testing
    (window as any).__testAuthError = () => {
      showLoginModal('Test: Simulated session expiration');
    };
    
    (window as any).__simulateAuthError = async () => {
      // Simulate an auth error by making a request with an invalid token
      // This will trigger the auth error handler in authenticatedApiCall
      try {
        await authenticatedApiCall('/api/dashboard', {}, 'invalid_token_for_testing');
      } catch (error) {
        // Error is expected - the modal should have been triggered
        console.log('Auth error simulation triggered - modal should appear');
      }
    };

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
      delete (window as any).__testAuthError;
      delete (window as any).__simulateAuthError;
    };
  }, [isDevelopment, showLoginModal]);

  // Only render in development
  if (!isDevelopment) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded text-xs">
        <button
          onClick={() => setShowDevTools(!showDevTools)}
          className="font-semibold hover:underline"
        >
          Dev Mode {showDevTools ? '▼' : '▶'}
        </button>
        {showDevTools && (
          <div className="mt-2 space-y-1">
            <button
              onClick={() => {
                showLoginModal('Test: Simulated session expiration');
                setShowDevTools(false);
              }}
              className="block w-full text-left px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-xs"
            >
              Test Login Modal (Direct)
            </button>
            <button
              onClick={async () => {
                // Simulate an auth error via API call using authenticatedApiCall
                try {
                  await authenticatedApiCall('/api/dashboard', {}, 'invalid_token_for_testing');
                } catch (error) {
                  // Error is expected - the modal should have been triggered
                  console.log('Auth error simulation triggered - modal should appear');
                }
                setShowDevTools(false);
              }}
              className="block w-full text-left px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-xs mt-1"
            >
              Test Login Modal (Via API)
            </button>
            <div className="text-xs text-yellow-700 px-2 pt-1 border-t border-yellow-300 mt-1">
              Console: <code className="bg-yellow-200 px-1 rounded">__testAuthError()</code> or <code className="bg-yellow-200 px-1 rounded">__simulateAuthError()</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
