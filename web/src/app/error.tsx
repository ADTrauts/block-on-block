'use client';

import { useEffect } from 'react';

// Prevent static generation - this page must be dynamic
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  // Use window.location instead of Next.js router to avoid context issues
  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Something went wrong!
        </h2>
        <p className="text-gray-600 mb-6">
          An error occurred while loading this page.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={handleGoHome}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
