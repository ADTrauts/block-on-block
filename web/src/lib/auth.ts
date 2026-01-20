import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { jwtDecode } from 'jwt-decode';

// User type is now defined in types/next-auth.d.ts

interface DecodedToken {
  sub: string;
  email: string;
  role: string;
  userNumber: string;
  exp: number;
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
        // In development, default to localhost if env var not set
        // In production, use environment variable or production fallback
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
                             process.env.NEXT_PUBLIC_API_URL || 
                             (isDevelopment ? 'http://localhost:5000' : 'https://vssyl-server-235369681725.us-central1.run.app');
        
        // Add timeout for token refresh
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        let response: Response;
        try {
          response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token.refreshToken }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          const isAborted = fetchError instanceof Error && fetchError.name === 'AbortError';
          
          if (isAborted) {
            console.error('Token refresh timeout');
            throw new Error('Token refresh timeout');
          }
          throw fetchError;
        }

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    const decoded = jwtDecode<DecodedToken>(data.token);

    return {
      ...token,
      accessToken: data.token,
      refreshToken: data.refreshToken,
      exp: decoded.exp,
      error: undefined,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'email@example.com' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        try {
          // In development, default to localhost if env var not set
          // In production, use environment variable or production fallback
          const isDevelopment = process.env.NODE_ENV !== 'production';
          // Try multiple env var names for compatibility
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
                               process.env.NEXT_PUBLIC_API_URL ||
                               process.env.BACKEND_URL ||
                               (isDevelopment ? 'http://localhost:5000' : 'https://vssyl-server-235369681725.us-central1.run.app');
          
          const loginUrl = `${API_BASE_URL}/api/auth/login`;
          console.log('NextAuth Authorize - Attempting login:', { 
            url: loginUrl, 
            email: credentials.email,
            isDevelopment,
            API_BASE_URL,
            // Log which env vars are available (for debugging, not values)
            envVars: {
              hasNextPublicApiBaseUrl: !!process.env.NEXT_PUBLIC_API_BASE_URL,
              hasNextPublicApiUrl: !!process.env.NEXT_PUBLIC_API_URL,
              hasBackendUrl: !!process.env.BACKEND_URL,
              nodeEnv: process.env.NODE_ENV,
            }
          });
          
          let response: Response;
          try {
            // Add timeout for fetch in case backend is slow or unreachable
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            response = await fetch(loginUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
          } catch (fetchError) {
            const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
            const isAborted = fetchError instanceof Error && fetchError.name === 'AbortError';
            const isNetworkError = errorMessage.includes('fetch') || 
                                  errorMessage.includes('ECONNREFUSED') ||
                                  errorMessage.includes('ENOTFOUND') ||
                                  errorMessage.includes('network');
            
            console.error('NextAuth Authorize - Fetch error:', {
              error: errorMessage,
              isAborted,
              isNetworkError,
              stack: fetchError instanceof Error ? fetchError.stack : undefined,
              url: loginUrl,
              isDevelopment,
              API_BASE_URL
            });
            
            if (isAborted) {
              throw new Error('Connection timeout. Please check if the backend server is running.');
            } else if (isNetworkError) {
              throw new Error(`Cannot connect to server at ${API_BASE_URL}. Please ensure the backend is running.`);
            } else {
              throw new Error(`Login failed: ${errorMessage}`);
            }
          }

          if (!response.ok) {
            let errorMessage = 'Invalid credentials';
            let errorData = null;
            try {
              errorData = await response.json();
              errorMessage = errorData?.message && typeof errorData.message === 'string' && errorData.message.trim()
                ? errorData.message
                : 'Invalid credentials';
            } catch (parseError) {
              // If response is not JSON, try to get text
              try {
                const text = await response.text();
                console.error('NextAuth Authorize - Non-JSON error response:', text);
              } catch (textError) {
                // Ignore if we can't read text either
              }
              errorMessage = `Login failed (${response.status})`;
            }
            console.error('NextAuth Authorize - Login failed:', {
              status: response.status,
              statusText: response.statusText,
              errorMessage,
              errorData,
              url: loginUrl,
              API_BASE_URL,
              isDevelopment,
              // Log environment for debugging (not secrets)
              hasEnvVar: !!process.env.NEXT_PUBLIC_API_BASE_URL,
            });
            throw new Error(errorMessage);
          }

          const data = await response.json();
          console.log('NextAuth Authorize - Backend response:', { 
            hasData: !!data, 
            hasToken: !!data?.token, 
            userId: data?.user?.id,
            userEmail: data?.user?.email 
          });
          
          if (data && data.token) {
            const user = {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              role: data.user.role,
              userNumber: data.user.userNumber,
              accessToken: data.token,
              refreshToken: data.refreshToken,
              emailVerified: !!data.user.emailVerified,
            } as any;
            
            console.log('NextAuth Authorize - Returning user:', { 
              id: user.id, 
              email: user.email, 
              hasAccessToken: !!user.accessToken 
            });
            
            return user;
          }
          
          console.log('NextAuth Authorize - No token in response');
          throw new Error('Invalid credentials. Please check your email and password.');
        } catch (error: unknown) {
          console.error('Auth error:', error);
          let errorMessage = 'Invalid credentials';
          if (error instanceof Error) {
            // Ensure we have a valid error message
            const message = error.message;
            if (message && typeof message === 'string' && message.trim() && message !== 'undefined' && message !== 'null') {
              errorMessage = message.trim();
            }
          } else if (error && typeof error === 'object' && 'message' in error) {
            const message = (error as { message?: unknown }).message;
            if (message && typeof message === 'string' && message.trim() && message !== 'undefined' && message !== 'null') {
              errorMessage = message.trim();
            }
          }
          // Always throw a proper Error object with a valid message
          throw new Error(errorMessage);
        }
      }
    })
  ],
  callbacks: {
      async jwt({ token, user }) {
        if (user) {
          const u = user as any;
          return {
            ...token,
            id: u.id,
            role: u.role,
            userNumber: u.userNumber,
            accessToken: u.accessToken,
            refreshToken: u.refreshToken,
            exp: token.exp,
          };
        }

        // If the token expiration is unknown or it has expired, refresh it.
        if (typeof token.exp !== 'number' || Date.now() >= token.exp * 1000) {
          return refreshAccessToken(token);
        }
        
        return token;
      },
    async session({ session, token }) {
      // Only log in debug mode to reduce console noise
      if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
        console.log('NextAuth Session callback:', { hasSession: !!session, hasToken: !!token, tokenId: token.id });
      }
      
      session.user.id = token.id as string;
      session.user.role = token.role as any;
      session.user.userNumber = token.userNumber as string;
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      
      // Only log in debug mode to reduce console noise
      if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
        console.log('NextAuth Session - Final session:', { 
          userId: session.user.id, 
          hasToken: !!session.accessToken,
          tokenLength: session.accessToken?.length,
          userRole: session.user.role
        });
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Only log in debug mode to reduce console noise
      if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
        console.log('NextAuth redirect callback:', { url, baseUrl });
      }
      
      // Handle signout - redirect to home page (which will show landing page)
      if (url.includes('/api/auth/signout') || url.includes('signOut')) {
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
          console.log('Logout detected, redirecting to home');
        }
        return baseUrl;
      }
      
      // If the user is coming from a protected route, redirect them back
      if (url.startsWith(baseUrl)) {
        return url;
      }
      
      // If they're coming from the root, let the home page handle the redirect
      if (url === baseUrl || url === baseUrl + '/') {
        return baseUrl;
      }
      
      // Default to dashboard for authenticated users
      return '/dashboard';
    }
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/',
    error: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}; 