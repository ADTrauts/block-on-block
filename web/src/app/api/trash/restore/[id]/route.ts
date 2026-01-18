import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // In development, default to localhost if env var not set
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const baseUrl = process.env.BACKEND_URL || 
                    process.env.NEXT_PUBLIC_API_BASE_URL || 
                    (isDevelopment ? 'http://localhost:5000' : 'https://vssyl-server-235369681725.us-central1.run.app');
    const response = await fetch(`${baseUrl}/api/trash/restore/${params.id}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error restoring item:', error);
    return NextResponse.json({ error: 'Failed to restore item' }, { status: 500 });
  }
} 