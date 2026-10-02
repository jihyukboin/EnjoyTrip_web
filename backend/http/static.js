import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendContent } from './response.js';

const root = fileURLToPath(new URL('../../frontend/', import.meta.url));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

export async function serveStatic(request, response, pathname) {
  const filePath = resolve(root, `.${pathname}`);
  if (!filePath.startsWith(resolve(root) + sep) || pathname.includes('\0')) {
    response.writeHead(403);
    response.end();
    return;
  }

  if (extname(filePath) === '.html') {
    response.writeHead(404);
    response.end();
    return;
  }

  let content;
  try {
    content = await readFile(filePath);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) {
      response.writeHead(404);
      response.end();
      return;
    }
    throw error;
  }

  // 버전이 경로에 명시된 원본 폰트만 장기 캐시한다.
  const cacheControl = pathname.startsWith('/assets/fonts/pretendard/1.3.9/')
    ? 'public, max-age=31536000, immutable'
    : 'public, no-cache';
  sendContent(request, response, content, contentTypes[extname(filePath)] ?? 'application/octet-stream', cacheControl);
}
