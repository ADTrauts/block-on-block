import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Force dynamic rendering to ensure route is always handled
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Ensure all HTTP methods are handled
export const dynamicParams = true;

// In development, default to localhost if env var not set
// In production, use environment variable or production fallback
const isDevelopment = process.env.NODE_ENV !== 'production';
const backendUrl = process.env.BACKEND_URL || 
                   process.env.NEXT_PUBLIC_API_BASE_URL || 
                   (isDevelopment ? 'http://localhost:5000' : 'https://vssyl-server-235369681725.us-central1.run.app');

async function handler(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const url = `${backendUrl}${pathname}${search}`;
  
  // Always log requests, especially for debugging
  console.log('API Proxy - Request:', {
    method: req.method,
    pathname,
    search,
    backendUrl,
    fullUrl: url
  });

  // Special logging for file download requests
  if (req.method === 'GET' && pathname.includes('/drive/files/') && (pathname.includes('/download') || pathname.match(/\/drive\/files\/[^/]+$/))) {
    console.log('📥 [API PROXY] File download request detected:', {
      method: req.method,
      pathname,
      fullUrl: url,
      backendUrl,
      timestamp: new Date().toISOString()
    });
  }
  
  // Special logging for scheduling availability routes
  if (req.method === 'POST' && pathname.includes('/scheduling/me/availability')) {
    console.log('🚨 [API PROXY] POST /scheduling/me/availability detected at handler entry', {
      method: req.method,
      pathname,
      search,
      url,
      backendUrl,
      timestamp: new Date().toISOString()
    });
  }
  


  // Clone headers and add authorization
  const headers = new Headers(req.headers);
  const impersonationCookie = req.cookies.get('vssyl_impersonation')?.value;
  let authToken = req.headers.get('authorization');
  
  // Check for token in query parameters (for file preview with direct URLs)
  if (!authToken) {
    const urlParams = new URLSearchParams(search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      authToken = `Bearer ${tokenParam}`;
    }
  }
  
  if (!authToken) {
    // If no Authorization header from the client, try to read the NextAuth session token
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const accessToken = (token as any)?.accessToken as string | undefined;
    if (accessToken) {
      authToken = `Bearer ${accessToken}`;
    }
  }

  if (authToken) {
    headers.set('authorization', authToken);
    console.log('API Proxy - Setting auth header:', { 
      hasToken: !!authToken, 
      tokenLength: authToken?.length,
      path: pathname 
    });
  } else {
    console.log('API Proxy - No auth token found for path:', pathname);
  }

  if (impersonationCookie && !pathname.startsWith('/api/admin-portal')) {
    headers.set('x-impersonation-token', impersonationCookie);
  }

  try {
    // Handle request body for non-GET/HEAD/DELETE requests BEFORE building fetch options
    // DELETE requests should never have a body
    let requestBody: BodyInit | undefined;
    let contentType: string | null = null;
    
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
      contentType = req.headers.get('content-type');
      
      if (contentType?.includes('multipart/form-data')) {
        // For file uploads with multipart/form-data:
        // We need to pass the stream directly and preserve the boundary
        // Don't modify the content-type header - it contains the boundary parameter
        requestBody = req.body as BodyInit;
      } else if (contentType?.includes('application/json') || contentType?.includes('application/x-www-form-urlencoded')) {
        // For JSON and form-urlencoded, read the body as text and pass it
        const bodyText = await req.text();
        // Only set body if it's not empty
        if (bodyText && bodyText.trim().length > 0) {
          requestBody = bodyText;
          // Ensure Content-Type is preserved
          if (contentType) {
            headers.set('content-type', contentType);
          }
          // Remove any existing content-length header - let fetch set it automatically
          headers.delete('content-length');
          console.log('API Proxy - Body:', { 
            pathname, 
            bodyLength: bodyText.length, 
            bodyPreview: bodyText.substring(0, 200),
            contentType,
            hasBody: !!bodyText
          });
        }
      } else if (req.body) {
        // For other body types, try to pass the stream directly
        requestBody = req.body as BodyInit;
      }
    }

    // Build fetch options with all headers and body
    // Use Headers object directly - fetch should handle it correctly in Node.js environment
    const headersForFetch: HeadersInit = headers;

    const fetchOptions: RequestInit & { duplex?: string } = {
      method: req.method,
      headers: headersForFetch,
      redirect: 'manual'
    };

    // Set body if we have one
    if (requestBody) {
      fetchOptions.body = requestBody;
      // Node.js 18+ requires duplex option for all POST requests with a body
      // Set it for multipart/form-data (file uploads) and any other body types
      if (contentType?.includes('multipart/form-data') || req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        fetchOptions.duplex = 'half';
      }
    }

    // Debug logging for POST requests that are failing
    if (req.method === 'POST' && pathname.includes('/scheduling/me/availability')) {
      const debugHeaders = headersForFetch instanceof Headers 
        ? Object.fromEntries(headersForFetch.entries())
        : headersForFetch;
      console.log('API Proxy - DEBUG POST Request:', {
        url,
        method: fetchOptions.method,
        headers: debugHeaders,
        bodyType: typeof requestBody,
        bodyLength: requestBody ? (typeof requestBody === 'string' ? requestBody.length : 'stream') : 0,
        hasBody: !!requestBody,
        contentType: headers.get('content-type'),
        authorization: headers.get('authorization') ? 'present' : 'missing'
      });
    }

    // Log 404 requests to help debug routing issues
    if (req.method === 'POST' && pathname.includes('/scheduling/me/availability')) {
      console.log('🚨 [API PROXY] About to fetch:', {
        url,
        method: fetchOptions.method,
        headers: Object.fromEntries(headers.entries()),
        bodyLength: requestBody ? (typeof requestBody === 'string' ? requestBody.length : 'stream') : 0,
        hasBody: !!requestBody,
        backendUrl
      });
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutDuration = contentType?.includes('multipart/form-data') ? 120000 : 30000; // 2 min for uploads, 30 sec for others
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    
    // Add signal to fetch options if not already present
    if (!fetchOptions.signal) {
      fetchOptions.signal = controller.signal;
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      const isAborted = fetchError instanceof Error && fetchError.name === 'AbortError';
      
      console.error('🚨 [API PROXY] Fetch failed:', {
        error: errorMessage,
        isAborted,
        url,
        backendUrl,
        pathname
      });
      
      if (isAborted) {
        throw new Error(`Request timeout after ${timeoutDuration / 1000} seconds`);
      }
      throw fetchError;
    }

    // Log 404 responses to help debug
    if (response.status === 404) {
      const responseText = await response.clone().text().catch(() => 'Unable to read response');
      console.error('🚨 [API PROXY] 404 Response from backend:', {
        url,
        pathname,
        status: response.status,
        responseText: responseText.substring(0, 200),
        backendUrl,
        hasAuth: !!authToken,
        isDownloadRequest: pathname.includes('/drive/files/') && (pathname.includes('/download') || pathname.match(/\/drive\/files\/[^/]+$/))
      });
    }

    console.log('API Proxy - Response:', {
      status: response.status,
      statusText: response.statusText,
      pathname,
      hasAuth: !!authToken,
      backendUrl
    });

    // Log authentication issues for debugging
    if (response.status === 401 || response.status === 403) {
      console.warn('API Proxy - Authentication error:', {
        status: response.status,
        pathname,
        hasAuthToken: !!authToken,
        tokenLength: authToken?.length,
        backendUrl
      });
    }

    // Log server errors for debugging
    if (response.status >= 500) {
      console.error('API Proxy - Server error:', {
        status: response.status,
        statusText: response.statusText,
        pathname,
        backendUrl
      });
    }

    // For file downloads, we need to preserve the content properly
    // Handle both /download and direct file access
    if (pathname.includes('/drive/files/') && req.method === 'GET' && 
        (pathname.includes('/download') || pathname.match(/\/drive\/files\/[^/]+$/))) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  } catch (error) {
    console.error('API proxy error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      url,
      method: req.method,
      pathname,
      hasAuthToken: !!authToken,
      backendUrl
    });
    
    // Determine error type and appropriate status code
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        statusCode = 503; // Service unavailable
        errorMessage = 'Backend service unavailable';
      } else if (error.message.includes('timeout')) {
        statusCode = 504; // Gateway timeout
        errorMessage = 'Request timeout';
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        statusCode = 503; // Service unavailable
        errorMessage = 'Backend service unavailable';
      }
    }
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'Proxy error', 
        message: errorMessage,
        path: pathname,
        status: statusCode
      }), 
      { 
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler; 