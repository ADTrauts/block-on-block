'use client';

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';

/**
 * ErrorFallback component - MUST NOT use any Next.js hooks (usePathname, useRouter, etc.)
 * This is because it may be rendered when React context is not available
 */
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Use window.location instead of useRouter to avoid context issues
  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
        <div className="text-red-500 mb-6">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Something went wrong
        </h1>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          We encountered an error while loading your workspace. This might be due to a temporary issue or a configuration problem.
        </p>

        {isDevelopment && error && (
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Development Error Details:</h3>
            <div className="text-sm text-gray-700 dark:text-gray-300 font-mono overflow-auto">
              <div className="mb-2">
                <strong>Error:</strong> {error.message}
              </div>
              {error.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="whitespace-pre-wrap text-xs mt-1">{error.stack}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={resetErrorBoundary}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </button>
          
          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Go Home
          </button>
        </div>

        {isDevelopment && (
          <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            <p>If this error persists, try:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Refreshing the page</li>
              <li>Clearing browser cache</li>
              <li>Restarting the development server</li>
              <li>Checking the console for additional errors</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error);
      console.error('Error Info:', errorInfo);
    }
    
    // In production, you might want to send this to an error reporting service
    // reportError(error, errorInfo);
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Clear any error state and try to recover
        // Don't automatically reload to prevent infinite loops
        console.log('Error boundary reset - not reloading to prevent loops');
      }}
    >
      {children}
    </ErrorBoundary>
  );
} 