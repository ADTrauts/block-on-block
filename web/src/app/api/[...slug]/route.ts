import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vssyl-server-235369681725.us-central1.run.app';

async function handler(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const url = `${backendUrl}${pathname}${search}`;
  
  console.log('API Proxy - Request:', {
    method: req.method,
    pathname,
    search,
    backendUrl,
    fullUrl: url
  });
  


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
    // Build fetch options
    let fetchOptions: RequestInit & { duplex?: string } = {
      method: req.method,
      headers: headers,
      redirect: 'manual'
    };

    // Handle request body for non-GET/HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type');
      
      if (contentType?.includes('multipart/form-data')) {
        // For file uploads with multipart/form-data:
        // We need to pass the stream directly and preserve the boundary
        // Don't modify the content-type header - it contains the boundary parameter
        fetchOptions.body = req.body;
        fetchOptions.duplex = 'half';
      } else {
        // For other POST/PUT/PATCH requests (JSON, form-urlencoded, etc.)
        fetchOptions.body = req.body;
        fetchOptions.duplex = 'half';
      }
    }

    const response = await fetch(url, fetchOptions);

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
    if (pathname.includes('/drive/files/') && req.method === 'GET') {
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