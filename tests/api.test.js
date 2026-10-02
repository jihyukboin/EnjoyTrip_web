import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { test } from 'node:test';
import { createApi } from '../backend/api.js';
import { createRequestHandler } from '../backend/app.js';
import { createSessionReader } from '../backend/auth/session-reader.js';
import { openDatabase } from '../backend/db/database.js';
import { tokenHash, SESSION_MS } from '../backend/auth/tokens.js';

const password = 'example-only-passphrase-2026';
const newPassword = 'another-example-passphrase-2026';
const signup = { id: 'traveler', name: '여행자', password };

test('지도 설정 API는 공개 JavaScript 키만 제공하고 미설정이면 503을 반환한다', async t => {
  const missing = await fixture(t);
  const unavailable = await missing.call('/api/maps/config');
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.json.error.code, 'MAP_NOT_CONFIGURED');
  const configured = await fixture(t, { config: {
    kakaoMapJavascriptKey: 'example-javascript-key', kakaoRestApiKey: 'must-not-be-exposed'
  } });
  const result = await configured.call('/api/maps/config');
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { data: { javascriptKey: 'example-javascript-key' } });
});

test('주변 조회 API는 좌표를 검증하고 서비스 결과만 반환한다', async t => {
  const calls = [];
  const api = await fixture(t, { nearby: async position => {
    calls.push(position);
    return [{ name: '실제 장소', category: 'AT4', distance: 0.2, bearing: 90 }];
  } });
  assert.equal((await api.call('/api/nearby?lat=&lng=127')).status, 400);
  assert.equal((await api.call('/api/nearby?lat=91&lng=127')).status, 400);
  const result = await api.call('/api/nearby?lat=37.5&lng=127');
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [{ lat: 37.5, lng: 127 }]);
  assert.deepEqual(result.json.data.places[0].name, '실제 장소');
});

async function fixture(t, options = {}) {
  const db = options.db ?? openDatabase(':memory:');
  const config = { origin: '', secureCookies: false, ...options.config };
  const server = createServer(createRequestHandler({
    apiHandler: createApi({ ...options, db, config }),
    readSession: createSessionReader({ db, now: options.now })
  }));
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
  const login = async (body = { id: signup.id, password }, cookie) => {
    const result = await call('/api/auth/login', { method: 'POST', body, cookie });
    assert.equal(result.status, 200);
    return { ...result, cookie: result.headers.get('set-cookie').split(';', 1)[0] };
  };
  return { db, config, origin, call, register, login };
}

test('가입·정규화·중복·로그인·본인 조회·수정·로그아웃과 비밀정보 비노출', async t => {
  const api = await fixture(t);
  const registered = await api.register({ ...signup, name: ' 여행자 ' });
  assert.equal(registered.json.data.member.name, signup.name);
  assert.equal(registered.headers.get('set-cookie'), null);
  assert.deepEqual(Object.keys(registered.json.data.member).sort(), ['createdAt', 'id', 'joinedAt', 'name', 'updatedAt']);
  const stored = api.db.prepare('SELECT * FROM members').get();
  assert.equal(stored.isAdmin, 0);
  assert.match(stored.password_hash, /^scrypt\$131072\$8\$1\$/);
  assert.ok(!stored.password_hash.includes(password));
  const duplicate = await api.call('/api/members', { method: 'POST', body: signup });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error.code, 'ID_ALREADY_EXISTS');
  const missing = await api.call('/api/members/me');
  assert.equal(missing.status, 401);
  const logged = await api.login();
  assert.match(logged.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Path=\/; Max-Age=86400/);
  assert.ok(!logged.text.includes(logged.cookie.split('=')[1]));
  assert.equal(api.db.prepare('SELECT token_hash FROM sessions').get().token_hash, tokenHash(logged.cookie.split('=')[1]));
  assert.equal((await api.call('/api/members/me', { cookie: logged.cookie })).json.data.member.id, signup.id);
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
  const wrong = await api.call('/api/auth/login', { method: 'POST', body: { id: signup.id, password: newPassword } });
  const absent = await api.call('/api/auth/login', { method: 'POST', body: { id: 'missing', password } });
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
  assert.equal((await api.call('/api/auth/login', { method: 'POST', body: { id: signup.id, password } })).status, 401);
  await api.login({ id: signup.id, password: newPassword });
});

test('탈퇴는 현재 비밀번호를 확인하고 다른 회원을 보존하며 세션을 삭제한다', async t => {
  const api = await fixture(t);
  await api.register();
  await api.register({ ...signup, id: 'other' });
  const logged = await api.login();
  const denied = await api.call('/api/members/me', { method: 'DELETE', cookie: logged.cookie, body: { currentPassword: newPassword } });
  assert.equal(denied.status, 401);
  const removed = await api.call('/api/members/me', { method: 'DELETE', cookie: logged.cookie, body: { currentPassword: password } });
  assert.equal(removed.status, 204);
  assert.equal(api.db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
  assert.equal(api.db.prepare('SELECT username FROM members').get().username, 'other');
  assert.equal((await api.call('/api/members/me', { cookie: logged.cookie })).status, 401);
  await api.register();
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
    [{ body: { ...signup, email: 'traveler@example.com' } }, 400, 'VALIDATION_ERROR'],
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
  await api.register({ ...signup, id: 'another' });
  const own = await api.login({ id: signup.id, password: unicodePassword });
  const other = await api.login({ id: 'another', password });
  const trimmed = await api.call('/api/auth/login', { method: 'POST', body: { id: signup.id, password: unicodePassword.trim() } });
  assert.equal(trimmed.status, 401);
  assert.notEqual((await api.call('/api/members/me', { cookie: own.cookie })).json.data.member.id,
    (await api.call('/api/members/me', { cookie: other.cookie })).json.data.member.id);
  assert.equal((await api.call('/api/members/1', { cookie: other.cookie })).status, 404);
});

test('헤더는 유효한 로그인 세션에 계정 드롭다운을 표시하고 관리자 링크를 구분한다', async t => {
  const api = await fixture(t);
  const header = async (cookie) => {
    const response = await fetch(api.origin + '/post', cookie ? { headers: { Cookie: cookie } } : {});
    return (await response.text()).match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
  };
  const desktop = (html) => html.match(/class="site-header__login site-header__desktop-login" href="([^"]+)">([^<]+)<\/a>/).slice(1);
  const mobile = (html) => html.match(/class="site-header__login" href="([^"]+)">[\s\S]*?<span data-account-label>([^<]+)<\/span>/).slice(1);
  const assertAccount = (html, expected) => {
    if (expected[0] === '/mypage') {
      assert.match(html, /class="site-header__account-toggle"[\s\S]*?aria-expanded="false"[\s\S]*?<svg/);
      assert.match(html, /id="site-account-panel" class="site-header__account-panel" hidden/);
      assert.match(html, /href="\/mypage">마이페이지<\/a>/);
      assert.match(html, /<button type="button" data-header-logout>로그아웃<\/button>/);
      assert.ok(!html.includes('site-header__login'));
      return;
    }
    assert.deepEqual(desktop(html), expected);
    assert.deepEqual(mobile(html), expected);
    assert.ok(!html.includes('data-account-menu'));
  };

  const guest = await header();
  assertAccount(guest, ['/login', '로그인']);
  assert.ok(!guest.includes('{{'));
  assert.ok(!guest.includes('href="/admin"'));

  await api.register();
  const { cookie } = await api.login();
  assertAccount(await header(cookie), ['/mypage', '마이페이지']);
  assert.ok(!(await header(cookie)).includes('href="/admin"'));

  api.db.prepare('UPDATE members SET isAdmin = 1 WHERE username = ?').run(signup.id);
  const admin = await header(cookie);
  assertAccount(admin, ['/mypage', '마이페이지']);
  assert.match(admin, /<nav class="site-header__navigation"[\s\S]*?<a href="\/admin" data-admin-link>관리자<\/a>[\s\S]*?<\/nav>/);
  assert.match(admin, /<nav id="site-mobile-menu"[\s\S]*?<a href="\/admin" data-admin-link>관리자<\/a>[\s\S]*?<\/nav>/);

  api.db.prepare('UPDATE members SET isAdmin = 0 WHERE username = ?').run(signup.id);
  assert.ok(!(await header(cookie)).includes('href="/admin"'));
  api.db.prepare('UPDATE members SET isAdmin = 1 WHERE username = ?').run(signup.id);

  await api.call('/api/auth/logout', { method: 'POST', body: {}, cookie });
  assertAccount(await header(cookie), ['/login', '로그인']);
  assertAccount(await header('enjoytrip_session=invalid'), ['/login', '로그인']);
  assert.ok(!(await header(cookie)).includes('href="/admin"'));
  assert.ok(!(await header('enjoytrip_session=invalid')).includes('href="/admin"'));

  const expired = await api.login();
  api.db.prepare('UPDATE sessions SET created_at = 1, expires_at = 2').run();
  assert.ok(!(await header(expired.cookie)).includes('href="/admin"'));
});
