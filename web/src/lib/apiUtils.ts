import { getSession, signOut } from 'next-auth/react';

// Use relative URLs to go through Next.js API proxy instead of direct backend calls
// This ensures all API calls go through the Next.js API proxy which handles authentication
const API_BASE_URL = '';

export interface ApiError extends Error {
  status?: number;
  isAuthError?: boolean;
}

// Global auth error dispatcher - set by AuthErrorContext
let authErrorDispatcher: ((message?: string) => void) | null = null;

export function setAuthErrorDispatcher(dispatcher: (message?: string) => void) {
  authErrorDispatcher = dispatcher;
}

export function clearAuthErrorDispatcher() {
  authErrorDispatcher = null;
}

// Helper function to check if an error is an auth error
export function isAuthError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    'isAuthError' in error &&
    (error as ApiError).isAuthError === true
  );
}

// Helper function to make authenticated API calls with automatic token refresh
export async function authenticatedApiCall<T>(
  endpoint: string, 
  options: RequestInit = {}, 
  token?: string
): Promise<T> {
  let session = token ? null : await getSession();
  let accessToken = token || session?.accessToken;
  
  if (!accessToken) {
    // Dispatch to global error handler if available
    if (authErrorDispatcher) {
      authErrorDispatcher('Please log in to continue');
    }
    const error = new Error('No authentication token available') as ApiError;
    error.isAuthError = true;
    throw error;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  // Debug logging only in debug mode to reduce console noise
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_API === 'true') {
    console.log('API Call Debug:', {
      endpoint,
      API_BASE_URL: 'relative (using Next.js proxy)',
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      finalUrl: url,
      isRelative: !url.startsWith('http'),
      note: 'Using Next.js API proxy for authentication'
    });
  }
  
  const makeRequest = async (token: string): Promise<Response> => {
    // IMPORTANT:
    // - For JSON requests, we default Content-Type to application/json
    // - For FormData (multipart), we MUST NOT set Content-Type manually because the browser
    //   will add the required boundary. If we force application/json, Express will try to
    //   parse the upload as JSON and can throw 413 PayloadTooLarge before multer runs.
    const isFormDataBody =
      typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // Only set JSON Content-Type when caller didn't specify one and body isn't FormData.
    const hasContentTypeHeader = Object.keys(headers).some(
      (k) => k.toLowerCase() === 'content-type'
    );
    if (!hasContentTypeHeader && !isFormDataBody) {
      headers['Content-Type'] = 'application/json';
    }

    headers.Authorization = `Bearer ${token}`;

    // Add timeout for API calls (30 seconds for most requests, longer for file uploads and AI queries)
    const controller = new AbortController();
    const isAIQuery = endpoint.includes('/api/ai/twin') || endpoint.includes('/api/ai/chat') || endpoint.includes('/api/business-ai/');
    const timeoutDuration = isFormDataBody || isAIQuery ? 120000 : 30000; // 2 min for uploads/AI, 30 sec for others
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      const isAborted = fetchError instanceof Error && fetchError.name === 'AbortError';
      
      if (isAborted) {
        throw new Error(`Request timeout after ${timeoutDuration / 1000} seconds`);
      }
      throw fetchError;
    }
  };

  let response = await makeRequest(accessToken);

  // If we get a 401 and we're using NextAuth (not a direct token), try to refresh
  // Note: 403 can be either auth error OR permission/tier error - we'll check the response body
  if (response.status === 401 && !token) {
    console.log('Authentication error detected, attempting token refresh...', {
      status: response.status,
      endpoint,
      hasToken: !!accessToken,
      tokenLength: accessToken?.length
    });
    
    try {
      // Get a fresh session (NextAuth will automatically refresh if needed)
      const refreshedSession = await getSession();
      
      if (refreshedSession?.accessToken && refreshedSession.accessToken !== accessToken) {
        console.log('Token refreshed successfully, retrying request...', {
          oldTokenLength: accessToken?.length,
          newTokenLength: refreshedSession.accessToken?.length
        });
        accessToken = refreshedSession.accessToken;
        response = await makeRequest(accessToken);
      } else {
        console.log('Token refresh failed or no new token available', {
          hasRefreshedSession: !!refreshedSession,
          hasNewToken: !!refreshedSession?.accessToken,
          tokensMatch: refreshedSession?.accessToken === accessToken
        });
      }
    } catch (refreshError) {
      console.error('Error during token refresh:', refreshError);
      // Continue with the original response to let the error handling below deal with it
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Handle authentication errors (401) - always an auth issue
    if (response.status === 401) {
      console.log('Authentication error after refresh attempt:', {
        status: response.status,
        endpoint,
        errorData,
        hasToken: !!accessToken,
        tokenLength: accessToken?.length
      });
      
      // If refresh failed, the session is completely expired
      // Dispatch to global error handler if available
      if (authErrorDispatcher) {
        console.log('Dispatching auth error to modal...');
        authErrorDispatcher('Your session has expired. Please log in to continue.');
      } else {
        console.warn('Auth error dispatcher not available - modal may not appear');
      }
      const error = new Error('Session expired. Please refresh the page to log in again.') as ApiError;
      error.status = response.status;
      error.isAuthError = true;
      throw error;
    }
    
    // Handle 403 errors - could be auth OR permission/tier issue
    if (response.status === 403) {
      // Check if this is actually a permission/tier error (not auth)
      // Permission/tier errors have specific error messages like "Business tier upgrade required" or "Insufficient permissions"
      const isPermissionError = errorData.error && (
        errorData.error.includes('tier') ||
        errorData.error.includes('permission') ||
        errorData.error.includes('upgrade') ||
        errorData.error.includes('Insufficient') ||
        errorData.error.includes('Access denied')
      );
      
      if (isPermissionError) {
        // This is a permission/tier error, not an auth error
        // Return the actual error message from the backend
        console.log('Permission/tier error detected:', {
          status: response.status,
          endpoint,
          errorData
        });
        
        const errorMessage = errorData.message || errorData.error || errorData.details || 'Access denied';
        const error = new Error(errorMessage) as ApiError;
        error.status = response.status;
        error.isAuthError = false;
        // Attach additional error data for the UI to use
        (error as any).errorData = errorData;
        throw error;
      }
      
      // If it's not a permission error, treat it as auth error
      console.log('403 error treated as authentication error:', {
        status: response.status,
        endpoint,
        errorData,
        hasToken: !!accessToken,
        tokenLength: accessToken?.length
      });
      
      if (authErrorDispatcher) {
        console.log('Dispatching auth error to modal...');
        authErrorDispatcher('Your session has expired. Please log in to continue.');
      } else {
        console.warn('Auth error dispatcher not available - modal may not appear');
      }
      const error = new Error('Session expired. Please refresh the page to log in again.') as ApiError;
      error.status = response.status;
      error.isAuthError = true;
      throw error;
    }
    
    // Handle server errors (500)
    if (response.status >= 500) {
      console.error('Server error:', {
        status: response.status,
        endpoint,
        errorData,
        // Include full error details in development
        ...(process.env.NODE_ENV === 'development' && { fullError: errorData })
      });
      
      // Prefer error message from backend, fallback to generic message
      const errorMessage = errorData.error || errorData.message || errorData.details || 'Server error. Please try again later.';
      const error = new Error(errorMessage) as ApiError;
      error.status = response.status;
      // Attach error data for the UI to use
      (error as any).errorData = errorData;
      throw error;
    }
    
    // Handle other errors
    const errorMessage = errorData.error || errorData.message || errorData.details || `HTTP error! status: ${response.status}`;
    const error = new Error(errorMessage) as ApiError;
    error.status = response.status;
    // Attach error data for the UI to use
    (error as any).errorData = errorData;
    throw error;
  }

  const data = await response.json();
  return data;
}

// Helper function for business API calls specifically
export async function businessApiCall<T>(
  endpoint: string, 
  options: RequestInit = {}, 
  token?: string
): Promise<T> {
  return authenticatedApiCall<T>(`/api/business${endpoint}`, options, token);
} 