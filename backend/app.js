import { serveStatic } from './http/static.js';
import { servePage } from './http/pages.js';
import { ApiError, sendApiError } from './http/api-response.js';

export function createRequestHandler({ apiHandler, readSession = () => ({}), readNotice = () => null } = {}) {
  return async function handleRequest(request, response) {
    let pathname;
    try {
      try {
        pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      } catch {
        if (request.url?.startsWith('/api/') || request.url === '/api') {
          sendApiError(response, new ApiError(400, 'INVALID_PATH', '올바른 요청 경로가 필요합니다.'));
          return;
        }
        response.writeHead(400);
        response.end();
        return;
      }

      if (pathname === '/api' || pathname.startsWith('/api/')) {
        if (!apiHandler) sendApiError(response, new ApiError(503, 'API_UNAVAILABLE', 'API가 초기화되지 않았습니다.'));
        else await apiHandler(request, response, pathname);
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
      }

      const view = () => ({ ...readSession(request), notice: readNotice(request) });
      if (await servePage(request, response, pathname, view)) return;
      await serveStatic(request, response, pathname);
    } catch (error) {
      console.error('요청 처리 실패:', error.name);
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Internal Server Error');
    }
  };
}

// Page-only handler keeps existing HTTP tests independent of the persistent database.
export const handleRequest = createRequestHandler();
