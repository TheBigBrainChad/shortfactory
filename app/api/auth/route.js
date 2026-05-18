import { NextResponse } from 'next/server';
import { verifyPassword, createToken } from '../../../lib/auth.js';

export async function POST(request) {
  try {
    const { password } = await request.json();
    if (!password || !verifyPassword(password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
    const token = createToken({ role: 'admin' });
    const response = NextResponse.json({ success: true });
    response.cookies.set('shortfactory_token', token, {
      httpOnly: true,
      maxAge: 86400,
      path: '/',
      sameSite: 'lax'
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}