"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import { signIn, useSession, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { COLORS } from "shared/styles/theme";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  
  // Get return URL from query params, fallback to dashboard
  const returnUrl = searchParams ? searchParams.get('returnUrl') || '/dashboard' : '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false, // Prevent NextAuth from handling redirect automatically
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result?.ok) {
        // Successful login - wait for session to be fully established before redirecting
        console.log('Login successful, waiting for session to be established...');
        setRedirecting(true);
        
        // Add delay to ensure NextAuth session cookie is fully propagated
        // This prevents 403 errors on initial dashboard load
        await waitForSession();
        
        console.log('Session established, redirecting to', returnUrl);
        router.push(returnUrl);
        return;
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'An unexpected error occurred');
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
        const session = await getSession();
        if (session?.accessToken) {
          console.log('Session confirmed with access token, redirecting...');
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

  return (
    <div 
      className="w-full space-y-6"
      style={{ '--focus-ring-color': COLORS.infoBlue } as React.CSSProperties}
    >
      <div>
        <h2 className="text-center text-2xl font-extrabold mb-1" style={{ color: COLORS.neutralDark }}>
          Sign in to your account
        </h2>
        <p className="text-center text-base text-gray-600">
          Or{" "}
          <Link
            href="/auth/register"
            className="font-semibold hover:underline"
            style={{ color: COLORS.infoBlue }}
          >
            create a new account
          </Link>
        </p>
      </div>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="rounded-lg shadow-sm space-y-4">
          <div>
            <label htmlFor="email" className="block text-base font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none rounded-md block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 text-base"
              style={{
                '--tw-ring-color': COLORS.infoBlue,
                '--tw-border-opacity': '1',
                borderColor: COLORS.infoBlue,
              } as React.CSSProperties}
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-base font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="appearance-none rounded-md block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 text-base"
              style={{
                '--tw-ring-color': COLORS.infoBlue,
                '--tw-border-opacity': '1',
                borderColor: COLORS.infoBlue,
              } as React.CSSProperties}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-1">
          <Link
            href="/auth/forgot-password"
            className="font-medium hover:underline text-sm"
            style={{ color: COLORS.infoBlue }}
          >
            Forgot your password?
          </Link>
          <Link
            href="/auth/verify-email"
            className="font-medium hover:underline text-sm"
            style={{ color: COLORS.infoBlue }}
          >
            Verify your email
          </Link>
        </div>

        {error && (
          <div className="text-red-500 text-sm text-center font-semibold mt-1">{error}</div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={loading || redirecting}
            className="w-full flex justify-center py-3 px-4 border border-transparent text-base font-bold rounded-lg text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-all"
            style={{ 
              backgroundColor: COLORS.infoBlue,
              '--tw-ring-color': COLORS.infoBlue,
            } as React.CSSProperties}
          >
            {redirecting ? "Redirecting..." : loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
} 