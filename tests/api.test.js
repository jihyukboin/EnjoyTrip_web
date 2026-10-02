import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { test } from 'node:test';
import { createApi } from '../backend/api.js';
import { createRequestHandler } from '../backend/app.js';
import { openDatabase } from '../backend/db/database.js';
import { tokenHash, SESSION_MS, RESET_MS } from '../backend/auth/tokens.js';

const password = 'example-only-passphrase-2026';
const newPassword = 'another-example-passphrase-2026';
const signup = { email: 'traveler@example.com', name: '여행자', password };

async function fixture(t, options = {}) {
  const db = options.db ?? openDatabase(':memory:');
  const config = { origin: '', secureCookies: false, resetDeliveryMode: 'disabled', ...options.config };
  const server = createServer(createRequestHandler({ apiHandler: createApi({ ...options, db, config }) }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  config.origin = origin;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  async function call(path, { method = 'GET', body, cookie, headers = {} } = {}) {
    const response = await fetch(origin + path, {
      method,
      headers: {
        ...(method !== 'GET' && method !== 'HEAD' ? {
          Origin: origin, 'Content-Type': 'application/json', 'X-EnjoyTrip-Request': '1'
        } : {}),
        ...(cookie ? { Cookie: cookie } : {}), ...headers
      },
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
    });
    const text = await response.text();
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, json: text ? JSON.parse(text) : null, headers: response.headers, text };
  }
  const register = async (body = signup) => {
    const result = await call('/api/members', { method: 'POST', body });
    assert.equal(result.status, 201);
    return result;
  };
  const login = async (body = { email: signup.email, password }, cookie) => {
    const result = await call('/api/auth/login', { method: 'POST', body, cookie });
    assert.equal(result.status, 200);
    return { ...result, cookie: result.headers.get('set-cookie').split(';', 1)[0] };
  };
  return { db, config, origin, call, register, login };
}

test('가입·정규화·중복·로그인·본인 조회·수정·로그아웃과 비밀정보 비노출', async t => {
  const api = await fixture(t);
  const registered = await api.register({ ...signup, email: ' Traveler@Example.com ', name: ' 여행자 ' });
  assert.equal(registered.json.data.member.email, signup.email);
  assert.equal(registered.json.data.member.name, signup.name);
  assert.equal(registered.headers.get('set-cookie'), null);
  assert.deepEqual(Object.keys(registered.json.data.member).sort(), ['createdAt', 'email', 'id', 'name', 'updatedAt']);
  const stored = api.db.prepare('SELECT * FROM members').get();
  assert.match(stored.password_hash, /^scrypt\$131072\$8\$1\$/);
  assert.ok(!stored.password_hash.includes(password));
  const duplicate = await api.call('/api/members', { method: 'POST', body: signup });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error.code, 'EMAIL_ALREADY_EXISTS');
  const missing = await api.call('/api/members/me');
  assert.equal(missing.status, 401);
  const logged = await api.login();
  assert.match(logged.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Path=\/; Max-Age=86400/);
  assert.ok(!logged.text.includes(logged.cookie.split('=')[1]));
  assert.equal(api.db.prepare('SELECT token_hash FROM sessions').get().token_hash, tokenHash(logged.cookie.split('=')[1]));
  assert.equal((await api.call('/api/members/me', { cookie: logged.cookie })).json.data.member.id, stored.id);
  const renamed = await api.call('/api/members/me', { method: 'PATCH', body: { name: "SQL'; -- 여행자" }, cookie: logged.cookie });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.json.data.member.name, "SQL'; -- 여행자");
  const logout = await api.call('/api/auth/logout', { method: 'POST', body: {}, cookie: logged.cookie });
  assert.equal(logout.status, 204);
  assert.equal(logout.text, '');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await api.call('/api/members/me', { cookie: logged.cookie })).status, 401);
  assert.equal((await api.call('/api/auth/logout', { method: 'POST', body: {} })).status, 204);
});

test('잘못된 로그인은 같은 오류이고 로그인 회전·다른 기기·세션 만료를 검증한다', async t => {
  let clock = Date.now();
  const api = await fixture(t, { now: () => clock, config: { secureCookies: true } });
  await api.register();
  const wrong = await api.call('/api/auth/login', { method: 'POST', body: { email: signup.email, password: newPassword } });
  const absent = await api.call('/api/auth/login', { method: 'POST', body: { email: 'missing@example.com', password } });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, absent.json);
  const first = await api.login();
  const secondDevice = await api.login();
  const rotated = await api.login(undefined, first.cookie);
  assert.match(rotated.headers.get('set-cookie'), /; Secure/);
  assert.notEqual(rotated.cookie, first.cookie);
  assert.equal((await api.call('/api/members/me', { cookie: first.cookie })).status, 401);
  assert.equal((await api.call('/api/members/me', { cookie: secondDevice.cookie })).status, 200);
  clock += SESSION_MS;
  assert.equal((await api.call('/api/members/me', { cookie: rotated.cookie })).status, 401);
});

test('비밀번호 변경은 모든 세션을 폐기하고 새 비밀번호로만 로그인된다', async t => {
  const api = await fixture(t);
  await api.register();
  const a = await api.login();
  const b = await api.login();
  const denied = await api.call('/api/members/me/password', {
    method: 'PUT', cookie: a.cookie, body: { currentPassword: newPassword, newPassword }
  });
  assert.equal(denied.status, 401);
  assert.equal(denied.json.error.code, 'INVALID_CURRENT_PASSWORD');
  const changed = await api.call('/api/members/me/password', {
    method: 'PUT', cookie: a.cookie, body: { currentPassword: password, newPassword }
  });
  assert.equal(changed.status, 204);
  for (const cookie of [a.cookie, b.cookie]) assert.equal((await api.call('/api/members/me', { cookie })).status, 401);
  assert.equal((await api.call('/api/auth/login', { method: 'POST', body: { email: signup.email, password } })).status, 401);
  await api.login({ email: signup.email, password: newPassword });
});

test('탈퇴는 현재 비밀번호를 확인하고 다른 회원을 보존하며 세션·토큰을 삭제한다', async t => {
  const delivered = [];
  const api = await fixture(t, { deliverReset: item => delivered.push(item) });
  await api.register();
  await api.register({ ...signup, email: 'other@example.com' });
  const logged = await api.login();
  await api.call('/api/auth/password-reset-requests', { method: 'POST', body: { email: signup.email } });
  const denied = await api.call('/api/members/me', { method: 'DELETE', cookie: logged.cookie, body: { currentPassword: newPassword } });
  assert.equal(denied.status, 401);
  const removed = await api.call('/api/members/me', { method: 'DELETE', cookie: logged.cookie, body: { currentPassword: password } });
  assert.equal(removed.status, 204);
  assert.equal(api.db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
  assert.equal(api.db.prepare('SELECT count(*) AS n FROM password_reset_tokens').get().n, 0);
  assert.equal(api.db.prepare('SELECT email FROM members').get().email, 'other@example.com');
  assert.equal((await api.call('/api/members/me', { cookie: logged.cookie })).status, 401);
  await api.register();
});

test('재설정은 이전·만료·재사용 토큰을 거부하고 동시 요청에서도 한 번만 소비한다', async t => {
  let clock = Date.now();
  const delivered = [];
  const api = await fixture(t, { now: () => clock, deliverReset: item => delivered.push(item) });
  await api.register();
  const logged = await api.login();
  const requestReset = email => api.call('/api/auth/password-reset-requests', { method: 'POST', body: { email } });
  const known = await requestReset(signup.email);
  const unknown = await requestReset('missing@example.com');
  assert.equal(known.status, 202);
  assert.deepEqual(known.json, unknown.json);
  assert.ok(!known.text.includes(delivered[0].token));
  const firstToken = delivered[0].token;
  assert.equal(api.db.prepare('SELECT token_hash FROM password_reset_tokens').get().token_hash, tokenHash(firstToken));
  await requestReset(signup.email);
  const reset = token => api.call('/api/auth/password-resets', { method: 'POST', body: { token, newPassword } });
  assert.equal((await reset(firstToken)).status, 400);
  clock += RESET_MS;
  assert.equal((await reset(delivered.at(-1).token)).status, 400);
  await requestReset(signup.email);
  const token = delivered.at(-1).token;
  const results = await Promise.all([reset(token), reset(token)]);
  assert.deepEqual(results.map(result => result.status).sort(), [204, 400]);
  assert.equal((await reset(token)).json.error.code, 'INVALID_RESET_TOKEN');
  assert.equal((await api.call('/api/members/me', { cookie: logged.cookie })).status, 401);
  await api.login({ email: signup.email, password: newPassword });
});

test('재설정 전달 미설정·실패는 계정 여부와 무관한 503이며 실패 토큰은 제거된다', async t => {
  const api = await fixture(t);
  await api.register();
  for (const email of [signup.email, 'missing@example.com']) {
    const result = await api.call('/api/auth/password-reset-requests', { method: 'POST', body: { email } });
    assert.equal(result.status, 503);
    assert.equal(result.json.error.code, 'RESET_DELIVERY_UNAVAILABLE');
  }
  assert.equal(api.db.prepare('SELECT count(*) AS n FROM password_reset_tokens').get().n, 0);
  const failedApi = await fixture(t, { deliverReset: () => { throw new Error('delivery failure'); } });
  await failedApi.register();
  for (const email of [signup.email, 'missing@example.com']) {
    assert.equal((await failedApi.call('/api/auth/password-reset-requests', { method: 'POST', body: { email } })).status, 503);
  }
  assert.equal(failedApi.db.prepare('SELECT count(*) AS n FROM password_reset_tokens').get().n, 0);
});

test('JSON·필드·크기·Origin·헤더·미지원 메서드 검증과 API 오류 형식', async t => {
  const api = await fixture(t);
  const path = '/api/members';
  const cases = [
    [{ body: '{' }, 400, 'INVALID_JSON'],
    [{ body: 'null' }, 400, 'VALIDATION_ERROR'],
    [{ body: [] }, 400, 'VALIDATION_ERROR'],
    [{ body: { ...signup, password: 'short' } }, 400, 'VALIDATION_ERROR'],
    [{ body: { ...signup, id: 99 } }, 400, 'VALIDATION_ERROR'],
    [{ body: { ...signup, name: 'a\0b' } }, 400, 'VALIDATION_ERROR'],
    [{ body: { ...signup, email: 'not-an-email' } }, 400, 'VALIDATION_ERROR'],
    [{ body: signup, headers: { Origin: 'https://untrusted.example' } }, 403, 'REQUEST_ORIGIN_REJECTED'],
    [{ body: signup, headers: { Origin: '' } }, 403, 'REQUEST_ORIGIN_REJECTED'],
    [{ body: signup, headers: { 'X-EnjoyTrip-Request': '' } }, 403, 'REQUEST_HEADER_REQUIRED'],
    [{ body: signup, headers: { 'Content-Type': 'text/plain' } }, 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [{ body: JSON.stringify({ name: 'x'.repeat(17000) }) }, 413, 'PAYLOAD_TOO_LARGE']
  ];
  for (const [options, status, code] of cases) {
    const result = await api.call(path, { method: 'POST', ...options });
    assert.equal(result.status, status, code);
    assert.equal(result.json.error.code, code);
  }
  assert.equal((await api.call('/api/missing')).status, 404);
  assert.equal((await api.call('/api/%ZZ')).status, 400);
  const unsupported = await api.call('/api/members/me', { method: 'POST', body: {} });
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('allow'), 'GET, PATCH, DELETE');
  const head = await api.call('/api/members/me', { method: 'HEAD' });
  assert.equal(head.status, 405);
  assert.equal(head.text, '');
});

test('청크 전송 본문도 16 KiB 제한을 적용하고 JSON 오류로 응답한다', async t => {
  const api = await fixture(t);
  const result = await new Promise((resolve, reject) => {
    const request = httpRequest(api.origin + '/api/members', {
      method: 'POST', headers: { Origin: api.origin, 'Content-Type': 'application/json', 'X-EnjoyTrip-Request': '1' }
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, json: JSON.parse(text) }));
    });
    request.on('error', reject);
    request.write('{"name":"');
    request.write('x'.repeat(17000));
    request.end('"}');
  });
  assert.equal(result.status, 413);
  assert.equal(result.json.error.code, 'PAYLOAD_TOO_LARGE');
});

test('요청 제한은 IP 단위로 적용되며 대기시간 이후 해제된다', async t => {
  let clock = Date.now();
  const api = await fixture(t, { now: () => clock, rateLimit: { limit: 2 } });
  for (let i = 0; i < 2; i += 1) {
    assert.equal((await api.call('/api/auth/login', { method: 'POST', body: {} })).status, 400);
  }
  const limited = await api.call('/api/auth/login', { method: 'POST', body: {} });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '600');
  clock += 600_000;
  assert.equal((await api.call('/api/auth/login', { method: 'POST', body: {} })).status, 400);
});

test('비밀번호의 공백·Unicode를 보존하고 사용자 간 접근을 세션으로 분리한다', async t => {
  const api = await fixture(t);
  const unicodePassword = '  여행 비밀번호 🔐 즐거운여행 2026  ';
  await api.register({ ...signup, password: unicodePassword });
  await api.register({ ...signup, email: 'another@example.com' });
  const own = await api.login({ email: signup.email, password: unicodePassword });
  const other = await api.login({ email: 'another@example.com', password });
  const trimmed = await api.call('/api/auth/login', { method: 'POST', body: { email: signup.email, password: unicodePassword.trim() } });
  assert.equal(trimmed.status, 401);
  assert.notEqual((await api.call('/api/members/me', { cookie: own.cookie })).json.data.member.id,
    (await api.call('/api/members/me', { cookie: other.cookie })).json.data.member.id);
  assert.equal((await api.call('/api/members/1', { cookie: other.cookie })).status, 404);
});
