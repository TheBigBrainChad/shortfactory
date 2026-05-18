import { NextResponse } from 'next/server';
import { getAuthUrl } from '../../../../lib/youtube.js';

export async function GET() {
  try {
    const url = getAuthUrl();
    if (!url) return NextResponse.json({ error: 'YouTube OAuth not configured' }, { status: 400 });
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}