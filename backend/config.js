import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const loopback = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function readConfig(env = process.env) {
  const host = env.HOST ?? '127.0.0.1';
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535.');
  const originUrl = new URL(env.APP_ORIGIN ?? `http://${host.includes(':') ? `[${host}]` : host}:${port}`);
  if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.href !== `${originUrl.origin}/`) {
    throw new Error('APP_ORIGIN must be an HTTP(S) origin without a path, query or credentials.');
  }
  if (originUrl.username || originUrl.password) throw new Error('APP_ORIGIN cannot contain credentials.');
  const secureValue = env.COOKIE_SECURE ?? String(originUrl.protocol === 'https:');
  if (!['true', 'false'].includes(secureValue)) throw new Error('COOKIE_SECURE must be true or false.');
  const secureCookies = secureValue === 'true';
  if ((!loopback.has(originUrl.hostname) || env.NODE_ENV === 'production') &&
      (originUrl.protocol !== 'https:' || !secureCookies)) {
    throw new Error('Non-local and production authentication requires HTTPS and secure cookies.');
  }
  const databasePath = env.DB_PATH === ':memory:' ? ':memory:' : resolve(root, env.DB_PATH ?? 'backend/data/enjoytrip.sqlite');
  const publicRoot = resolve(root, 'frontend').toLowerCase();
  if (databasePath !== ':memory:' &&
      (databasePath.toLowerCase() === publicRoot || databasePath.toLowerCase().startsWith(publicRoot + sep))) {
    throw new Error('DB_PATH must be outside the public frontend directory.');
  }
  const kakaoMapJavascriptKey = env.KAKAO_MAP_JAVASCRIPT_KEY?.trim() || env.KAKAO_MAP_KEY?.trim() || '';
  const kakaoMapKey = kakaoMapJavascriptKey;
  const tourApiServiceKey = env.TOUR_API_SERVICE_KEY?.trim() || '';
  return { host, port, origin: originUrl.origin, databasePath, secureCookies, kakaoMapJavascriptKey, kakaoMapKey, tourApiServiceKey };
}
