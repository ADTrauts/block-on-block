'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { setAuthErrorDispatcher, clearAuthErrorDispatcher } from '@/lib/apiUtils';

interface AuthErrorContextType {
  showLoginModal: (message?: string) => void;
  hideLoginModal: () => void;
  isLoginModalOpen: boolean;
  loginMessage: string | null;
  returnUrl: string | null;
}

const AuthErrorContext = createContext<AuthErrorContextType | undefined>(undefined);

export function AuthErrorProvider({ children }: { children: React.ReactNode }) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [pathname, setPathname] = useState<string>('/');
  
  // Call usePathname unconditionally (required by React hooks rules)
  // It may return null during SSR, which we handle gracefully
  const nextPathname = usePathname();
  
  // Initialize pathname from window.location on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPathname(window.location.pathname);
    }
  }, []);

  // Update pathname when Next.js pathname changes (only if valid)
  useEffect(() => {
    if (nextPathname && typeof window !== 'undefined') {
      setPathname(nextPathname);
    }
  }, [nextPathname]);

  const showLoginModal = useCallback((message?: string) => {
    // Store current URL for return after login - always use window.location for accuracy
    const currentUrl = typeof window !== 'undefined' 
      ? window.location.pathname + window.location.search 
      : pathname || '/';
    setReturnUrl(currentUrl);
    setLoginMessage(message || 'Your session has expired. Please log in to continue.');
    setIsLoginModalOpen(true);
  }, [pathname]);

  const hideLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
    setLoginMessage(null);
    // Don't clear returnUrl - we might need it after successful login
  }, []);

  // Clear returnUrl after a delay to prevent stale URLs
  useEffect(() => {
    if (!isLoginModalOpen && returnUrl) {
      const timer = setTimeout(() => {
        setReturnUrl(null);
      }, 5000); // Clear after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [isLoginModalOpen, returnUrl]);

  // Register global auth error dispatcher
  useEffect(() => {
    setAuthErrorDispatcher(showLoginModal);
    return () => {
      clearAuthErrorDispatcher();
    };
  }, [showLoginModal]);

  return (
    <AuthErrorContext.Provider
      value={{
        showLoginModal,
        hideLoginModal,
        isLoginModalOpen,
        loginMessage,
        returnUrl,
      }}
    >
      {children}
    </AuthErrorContext.Provider>
  );
}

export function useAuthError() {
  const context = useContext(AuthErrorContext);
  if (context === undefined) {
    throw new Error('useAuthError must be used within an AuthErrorProvider');
  }
  return context;
}

