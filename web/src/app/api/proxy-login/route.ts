import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Login proxy: forwards credentials to backend /api/auth/login.
 * Used by NextAuth CredentialsProvider authorize() to avoid direct backend fetch
 * (same-origin request, no CORS, consistent with API proxy pattern).
 */
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV !== 'production'
    ? 'http://localhost:5000'
    : 'https://vssyl-server-235369681725.us-central1.run.app');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    const message = (data && typeof data.message === 'string' && data.message.trim()) || undefined;

    if (!res.ok) {
      return NextResponse.json(
        { message: message || 'Invalid credentials' },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const isAborted = err instanceof Error && err.name === 'AbortError';
    const isNetwork =
      msg.includes('fetch') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('network');

    if (isAborted) {
      return NextResponse.json(
        { message: 'Connection timeout. Please try again.' },
        { status: 504 }
      );
    }
    if (isNetwork) {
      return NextResponse.json(
        { message: `Cannot connect to server at ${BACKEND_URL}. Please try again later.` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { message: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
