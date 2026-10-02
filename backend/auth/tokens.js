import { createHash, randomBytes } from 'node:crypto';

export const SESSION_MS = 24 * 60 * 60 * 1000;
export const createToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export function sessionToken(request) {
  const values = (request.headers.cookie ?? '').split(';')
    .map(part => part.trim()).filter(part => part.startsWith('enjoytrip_session='));
  if (values.length !== 1) return null;
  const value = values[0].slice('enjoytrip_session='.length);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function sessionCookie(token, secure, clear = false) {
  return `enjoytrip_session=${clear ? '' : token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
}
