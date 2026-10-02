import { ApiError, sendApiError, sendJson } from './api-response.js';
import { readJson, validateMutation } from './json-body.js';
import { createRateLimiter } from './rate-limit.js';
import { validateFields } from '../members/validation.js';
import { sessionCookie, sessionToken } from '../auth/tokens.js';

export function createApiRouter({ config, members, auth, now = Date.now, rateLimit }) {
  const limit = createRateLimiter({ now, ...rateLimit });
  const cookie = (token, clear = false) => ({ 'Set-Cookie': sessionCookie(token, config.secureCookies, clear) });
  const routes = new Map();
  const add = (path, method, fields, action, limited = false) => {
    if (!routes.has(path)) routes.set(path, new Map());
    routes.get(path).set(method, { fields, action, limited });
  };
  add('/api/members', 'POST', ['email', 'name', 'password'], async (body, token, response) => {
    sendJson(response, 201, { data: { member: await members.register(body) } });
  }, true);
  add('/api/members/me', 'GET', [], (body, token, response) => {
    sendJson(response, 200, { data: { member: members.me(token) } });
  });
  add('/api/members/me', 'PATCH', ['name'], (body, token, response) => {
    sendJson(response, 200, { data: { member: members.rename(token, body) } });
  });
  add('/api/members/me', 'DELETE', ['currentPassword'], async (body, token, response) => {
    await members.remove(token, body);
    sendJson(response, 204, undefined, cookie('', true));
  }, true);
  add('/api/members/me/password', 'PUT', ['currentPassword', 'newPassword'], async (body, token, response) => {
    await auth.changePassword(token, body);
    sendJson(response, 204, undefined, cookie('', true));
  }, true);
  add('/api/auth/login', 'POST', ['email', 'password'], async (body, token, response) => {
    const { token: newToken, ...data } = await auth.login(body, token);
    sendJson(response, 200, { data }, cookie(newToken));
  }, true);
  add('/api/auth/logout', 'POST', [], (body, token, response) => {
    auth.logout(token);
    sendJson(response, 204, undefined, cookie('', true));
  });
  add('/api/auth/password-reset-requests', 'POST', ['email'], async (body, token, response) => {
    await auth.requestReset(body);
    sendJson(response, 202, { data: { message: '등록된 계정이라면 비밀번호 재설정 안내가 전달됩니다.' } });
  }, true);
  add('/api/auth/password-resets', 'POST', ['token', 'newPassword'], async (body, token, response) => {
    await auth.completeReset(body);
    sendJson(response, 204, undefined, cookie('', true));
  }, true);

  return async (request, response, path) => {
    try {
      const methods = routes.get(path);
      if (!methods) throw new ApiError(404, 'API_NOT_FOUND', 'API 경로를 찾을 수 없습니다.');
      const route = methods.get(request.method);
      if (!route) throw new ApiError(405, 'METHOD_NOT_ALLOWED', '지원하지 않는 메서드입니다.', undefined,
        { Allow: [...methods.keys()].join(', ') });
      let body = {};
      if (request.method !== 'GET') {
        validateMutation(request, config.origin);
        // Check the limit before buffering or hashing a request.
        if (route.limited) limit(request);
        body = validateFields(await readJson(request), route.fields);
      }
      await route.action(body, sessionToken(request), response);
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('API 처리 실패:', error.name);
      if (!response.destroyed && !response.headersSent) sendApiError(response, error);
      // Discard unread request bytes so errors do not retain body buffers.
      request.resume();
    }
  };
}
