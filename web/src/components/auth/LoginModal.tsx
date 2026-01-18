'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Modal } from 'shared/components';
import { Button, Input } from 'shared/components';
import { COLORS } from 'shared/styles/theme';
import { useAuthError } from '@/contexts/AuthErrorContext';

export function LoginModal() {
  const { isLoginModalOpen, hideLoginModal, loginMessage, returnUrl } = useAuthError();
  const { data: session } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [hadSessionWhenOpened, setHadSessionWhenOpened] = useState(false);

  // Track if user had a session when modal opened (for testing scenarios)
  useEffect(() => {
    if (isLoginModalOpen) {
      setHadSessionWhenOpened(!!session?.accessToken);
    }
  }, [isLoginModalOpen, session?.accessToken]);

  // Close modal if user becomes authenticated AFTER modal was opened
  useEffect(() => {
    if (isLoginModalOpen && session?.accessToken && !hadSessionWhenOpened) {
      // Session was established after modal opened - this is a real login
      // Wait a moment for session to fully establish
      const timer = setTimeout(() => {
        hideLoginModal();
        // Navigate to return URL if available and different from current location
        if (returnUrl) {
          const currentUrl = typeof window !== 'undefined' 
            ? window.location.pathname + window.location.search 
            : '';
          if (returnUrl !== currentUrl) {
            router.push(returnUrl);
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    // If user already had a session when modal opened, don't auto-close (testing scenario)
  }, [isLoginModalOpen, session?.accessToken, hadSessionWhenOpened, hideLoginModal, returnUrl, router]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isLoginModalOpen) {
      setEmail('');
      setPassword('');
      setError(null);
      setLoading(false);
      setRedirecting(false);
    }
  }, [isLoginModalOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });


      // Handle error case - but check if ok is also true (NextAuth quirk)
      if (result?.error && !result?.ok) {
        // Handle the case where error is the string 'undefined' or other invalid values
        let errorMsg = 'An error occurred during login';
        if (typeof result.error === 'string' && result.error.trim()) {
          const trimmedError = result.error.trim();
          // Filter out invalid error strings
          if (trimmedError !== 'undefined' && trimmedError !== 'null' && trimmedError !== '') {
            errorMsg = trimmedError;
          }
        }
        setError(errorMsg);
        setLoading(false);
        return;
      }

      if (result?.ok) {
        setRedirecting(true);
        // Wait for session to be established
        await waitForSession();
        // Close modal after successful login
        // If user was already logged in, close immediately; otherwise useEffect will handle it
        if (hadSessionWhenOpened) {
          hideLoginModal();
        }
        // Otherwise, the useEffect will handle closing when session is established
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
      setRedirecting(false);
    }
  }

  // Helper function to wait for session to be available
  async function waitForSession() {
    const maxWait = 5000; // 5 seconds max
    const checkInterval = 100; // Check every 100ms
    const minDelay = 300; // Minimum 300ms for cookie propagation
    const startTime = Date.now();
    
    // First, wait minimum delay for cookie propagation
    await new Promise(resolve => setTimeout(resolve, minDelay));
    
    // Then poll for actual session availability
    while (Date.now() - startTime < maxWait) {
      try {
        const { getSession } = await import('next-auth/react');
        const session = await getSession();
        if (session?.accessToken) {
          return; // Session is ready
        }
      } catch (error) {
        console.warn('Error checking session:', error);
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    console.warn('Session wait timeout reached, proceeding anyway');
  }

  // Handle closing modal - allow closing even when already logged in (for testing)
  const handleClose = () => {
    if (!loading && !redirecting) {
      hideLoginModal();
    }
  };

  // Also allow closing if user is already authenticated (testing scenario)
  // This gives users a way to dismiss the modal if they're just testing
  const canClose = !loading && !redirecting;

  return (
    <Modal
      open={isLoginModalOpen}
      onClose={handleClose}
      title="Session Expired"
      size="medium"
      closeOnEscape={canClose}
      closeOnOverlayClick={canClose}
    >
      <div className="space-y-6">
        {loginMessage && (
          <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            {loginMessage}
          </div>
        )}

        {/* Show close option if user is already logged in (testing scenario) */}
        {session?.accessToken && hadSessionWhenOpened && (
          <div className="text-xs text-gray-500 text-center">
            You're already logged in. This is a test modal.
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="modal-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <Input
              id="modal-email"
              type="email"
              autoComplete="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || redirecting}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="modal-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <Input
              id="modal-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || redirecting}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link
              href="/auth/forgot-password"
              className="font-medium hover:underline"
              style={{ color: COLORS.infoBlue }}
              onClick={(e) => {
                e.preventDefault();
                hideLoginModal();
                router.push('/auth/forgot-password');
              }}
            >
              Forgot password?
            </Link>
            <Link
              href="/auth/register"
              className="font-medium hover:underline"
              style={{ color: COLORS.infoBlue }}
              onClick={(e) => {
                e.preventDefault();
                hideLoginModal();
                router.push('/auth/register');
              }}
            >
              Create account
            </Link>
          </div>

          {error && typeof error === 'string' && error.trim() && error !== 'undefined' && (
            <div className="text-red-600 text-sm font-medium text-center bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}

          <div className="pt-2 space-y-2">
            <Button
              type="submit"
              variant="primary"
              disabled={loading || redirecting}
              className="w-full"
            >
              {redirecting ? 'Signing in...' : loading ? 'Signing in...' : 'Sign in'}
            </Button>
            {canClose && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                className="w-full"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
}

