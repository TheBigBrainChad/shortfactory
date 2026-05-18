import crypto from 'crypto';

function getSecret() {
  return process.env.JWT_SECRET || 'shortfactory-secret-change-me';
}

export function verifyPassword(password) {
  const adminPw = process.env.ADMIN_PASSWORD || 'changeme';
  return password === adminPw;
}

export function createToken(payload) {
  const secret = getSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 86400000 })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  try {
    const secret = getSecret();
    const [header, body, signature] = token.split('.');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request) {
  const auth = request.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/shortfactory_token=([^;]+)/);
  return match ? match[1] : null;
}

export function authenticate(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}