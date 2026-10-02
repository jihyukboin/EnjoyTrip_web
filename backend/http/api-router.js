import { ApiError, sendApiError, sendJson } from './api-response.js';
import { readJson, validateMutation } from './json-body.js';
import { createRateLimiter } from './rate-limit.js';
import { validateFields } from '../members/validation.js';
import { sessionCookie, sessionToken } from '../auth/tokens.js';

export function createApiRouter({ config, members, auth, now = Date.now, rateLimit, extraRoutes = new Map() }) {
  const limit = createRateLimiter({ now, ...rateLimit });
  const cookie = (token, clear = false) => ({ 'Set-Cookie': sessionCookie(token, config.secureCookies, clear) });
  const routes = new Map();
  const add = (path, method, fields, action, limited = false, optional = [], passwordMinimum = 8) => {
    if (!routes.has(path)) routes.set(path, new Map());
    routes.get(path).set(method, { fields, action, limited, optional, passwordMinimum });
  };
  add('/api/members', 'POST', ['id', 'name', 'password'], async (body, token, response) => {
    sendJson(response, 201, { data: { member: await members.register(body) } });
  }, true);
  add('/api/members/me', 'GET', [], (body, token, response) => {
    sendJson(response, 200, { data: { member: members.me(token) } });
  });
  add('/api/members/me', 'PATCH', ['name', 'password'], async (body, token, response) => {
    sendJson(response, 200, { data: { member: await members.update(token, body) } });
  }, true, ['name', 'password']);
  add('/api/members/me', 'DELETE', ['currentPassword'], async (body, token, response) => {
    await members.remove(token, body);
    sendJson(response, 204, undefined, cookie('', true));
  }, true);
  add('/api/members/me/password', 'PUT', ['currentPassword', 'newPassword'], async (body, token, response) => {
    await auth.changePassword(token, body);
    sendJson(response, 204, undefined, cookie('', true));
  }, true);
  add('/api/auth/login', 'POST', ['id', 'password'], async (body, token, response) => {
    const { token: newToken, ...data } = await auth.login(body, token);
    sendJson(response, 200, { data }, cookie(newToken));
  }, true, [], 1);
  add('/api/auth/logout', 'POST', [], (body, token, response) => {
    auth.logout(token);
    sendJson(response, 204, undefined, cookie('', true));
  });
  add('/api/auth/temporary-password', 'POST', ['id'], async (body, token, response) => {
    sendJson(response, 200, { data: { temporaryPassword: await auth.issueTemporaryPassword(body) } });
  }, true);

  for (const [path, methods] of extraRoutes) routes.set(path, methods);

  // '/api/x/:id' 형태의 경로는 숫자 id를 params로 넘긴다
  const patterns = [...routes].filter(([pattern]) => pattern.includes('/:'))
    .map(([pattern, methods]) => {
      const names = [];
      const source = pattern.replace(/:([a-z]+)/gi, (_, name) => { names.push(name); return '([1-9][0-9]{0,15})'; });
      return { regex: new RegExp(`^${source}$`), names, methods };
    });
  const findRoute = (path) => {
    if (routes.has(path)) return { methods: routes.get(path), params: {} };
    for (const { regex, names, methods } of patterns) {
      const match = regex.exec(path);
      if (match) return { methods, params: Object.fromEntries(names.map((name, index) => [name, Number(match[index + 1])])) };
    }
    return { methods: undefined, params: {} };
  };

  return async (request, response, path) => {
    try {
      const { methods, params } = findRoute(path);
      if (!methods) throw new ApiError(404, 'API_NOT_FOUND', 'API 경로를 찾을 수 없습니다.');
      const route = methods.get(request.method);
      if (!route) throw new ApiError(405, 'METHOD_NOT_ALLOWED', '지원하지 않는 메서드입니다.', undefined,
        { Allow: [...methods.keys()].join(', ') });
      const token = sessionToken(request);
      let body = {};
      if (request.method !== 'GET') {
        validateMutation(request, config.origin);
        // Check the limit before buffering or hashing a request.
        if (route.limited) limit(request);
        route.authorize?.(token);
        const input = await readJson(request);
        body = route.validate ? route.validate(input) : validateFields(input, route.fields, route.optional, route.passwordMinimum);
      }
      await route.action(body, token, response, request, params);
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('API 처리 실패:', error.name);
      if (!response.destroyed && !response.headersSent) sendApiError(response, error);
      // Discard unread request bytes so errors do not retain body buffers.
      request.resume();
    }
  };
}
