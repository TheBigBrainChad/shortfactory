import { NextResponse } from 'next/server';
import { handleCallback } from '../../../../lib/youtube.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL('/?youtube=error', 'http://localhost:3000'));
    }

    if (!code) {
      return NextResponse.json({ error: 'No authorization code' }, { status: 400 });
    }

    await handleCallback(code);
    return NextResponse.redirect(new URL('/?youtube=connected', 'http://localhost:3000'));
  } catch (err) {
    console.error('YouTube callback error:', err);
    return NextResponse.redirect(new URL('/?youtube=error', 'http://localhost:3000'));
  }
}