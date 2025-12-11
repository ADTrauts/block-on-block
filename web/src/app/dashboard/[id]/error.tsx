'use client';

import React from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  const errorMessage = error instanceof Error ? error.message : 'An error occurred while loading the dashboard.';
  const errorStack = error instanceof Error ? error.stack : undefined;

  return (
    <div className="flex h-full w-full bg-gray-50 items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Dashboard Error</h2>
        <p className="text-gray-600 mb-4">
          {errorMessage}
        </p>
        {errorStack && process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
              Show error details (development only)
            </summary>
            <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-64 text-gray-800">
              {errorStack}
            </pre>
          </details>
        )}
        <div className="flex gap-4 justify-center mt-6">
          <button
            onClick={reset}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Go to Dashboards
          </a>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
} 