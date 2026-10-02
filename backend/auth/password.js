import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from '../http/api-response.js';

const scryptAsync = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const prefix = 'scrypt$131072$8$1';
const dummyHash = `${prefix}$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;
let running = 0;
const waiting = [];

async function derive(password, salt) {
  if (running >= 2) {
    if (waiting.length >= 20) {
      throw new ApiError(429, 'RATE_LIMITED', '잠시 후 다시 시도해주세요.', undefined, { 'Retry-After': '1' });
    }
    await new Promise(resolve => waiting.push(resolve));
  } else {
    running += 1;
  }
  try { return await scryptAsync(password, salt, 64, options); }
  finally {
    // Transfer the occupied slot directly to the next waiter.
    if (waiting.length) waiting.shift()();
    else running -= 1;
  }
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${prefix}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password, encoded = dummyHash) {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts.slice(0, 4).join('$') !== prefix) throw new Error('Unsupported stored password hash.');
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  if (salt.length !== 16 || expected.length !== 64) throw new Error('Invalid stored password hash.');
  const key = await derive(password, salt);
  return timingSafeEqual(key, expected);
}
