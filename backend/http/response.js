import { createHash } from 'node:crypto';

export function sendContent(request, response, content, contentType, cacheControl = 'no-cache') {
  const etag = `"${createHash('sha256').update(content).digest('hex')}"`;
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    ETag: etag
  };
  const candidates = request.headers['if-none-match']?.split(',').map(value => value.trim().replace(/^W\//, ''));

  if (candidates?.includes(etag) || candidates?.includes('*')) {
    response.writeHead(304, headers);
    response.end();
    return;
  }

  response.writeHead(200, { ...headers, 'Content-Length': content.length });
  response.end(request.method === 'HEAD' ? undefined : content);
}
