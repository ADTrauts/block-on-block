'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

interface SessionReadyGateProps {
  children: ReactNode;
}

/**
 * Prevents authenticated sections of the app from rendering until
 * NextAuth has finished hydrating the session and we have a usable access token.
 * This avoids cascades of 403 errors immediately after login.
 */
export function SessionReadyGate({ children }: SessionReadyGateProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [timeoutReached, setTimeoutReached] = useState(false);

  // Public routes that don't need authentication
  const publicRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/verify-email', '/landing', '/'];
  const isPublicRoute = publicRoutes.some(route => pathname?.startsWith(route));

  useEffect(() => {
    const timer = setTimeout(() => setTimeoutReached(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const isReady = useMemo(() => {
    // Public routes always render immediately
    if (isPublicRoute) {
      return true;
    }

    // For protected routes, wait for session
    if (status === 'loading') {
      return false;
    }

    if (status === 'unauthenticated') {
      // User is not authenticated on a protected route - let the route protection handle this
      return true;
    }

    // For authenticated state, wait until we have a token from NextAuth
    return Boolean(session?.accessToken);
  }, [status, session?.accessToken, pathname, isPublicRoute]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center text-gray-600">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <div>
          <p className="font-semibold text-gray-800">Establishing secure session…</p>
          <p className="text-sm text-gray-500 mt-1">
            We&apos;re finalizing your authentication before loading your workspace.
          </p>
          {timeoutReached && (
            <p className="text-xs text-gray-400 mt-3">
              This is taking longer than expected. Try refreshing the page if the issue persists.
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useSessionReady(): { ready: boolean; status: 'loading' | 'authenticated' | 'unauthenticated' } {
  const { data: session, status } = useSession();

  const ready =
    status === 'unauthenticated'
      ? true
      : status === 'authenticated'
        ? Boolean(session?.accessToken)
        : false;

  return { ready, status };
}

