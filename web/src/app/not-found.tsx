'use client';

import Link from 'next/link';

// Prevent static generation - this page must be dynamic
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function NotFound() {
  return (
    <div className="flex h-screen w-full bg-gray-50 items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          The page you're looking for doesn't exist.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
} 