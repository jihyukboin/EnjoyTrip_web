import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { createApi } from '../backend/api.js';
import { createRequestHandler } from '../backend/app.js';
import { openDatabase } from '../backend/db/database.js';
import * as api from '../frontend/js/api/member-api.js';
import { guestViewFromHash } from '../frontend/js/components/auth/views.js';

test('프론트 API로 가입·로그인·수정·임시 비밀번호·탈퇴를 실제 서버에 연결한다', async t => {
  const db = openDatabase(':memory:');
  const config = { origin: '', secureCookies: false };
  const server = createServer(createRequestHandler({ apiHandler: createApi({ db, config }) }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  const nativeFetch = globalThis.fetch;
  let cookie = '';
  // Node에는 브라우저 쿠키 저장소가 없으므로 HTTP의 Origin과 쿠키 처리만 보완한다.
  globalThis.fetch = async (path, options) => {
    assert.equal(options.credentials, 'same-origin');
    const response = await nativeFetch(config.origin + path, {
      ...options, headers: { ...options.headers, Origin: config.origin, ...(cookie ? { Cookie: cookie } : {}) }
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';', 1)[0];
    return response;
  };
  t.after(async () => {
    globalThis.fetch = nativeFetch;
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  const member = { id: 'trip01', password: 'password1', name: '여행자' };
  const rejects = (promise, code, field) => assert.rejects(promise,
    error => error instanceof api.MemberApiError && error.code === code && error.field === field);
  assert.equal(await api.getCurrentMember(), null);
  await api.signUp(member);
  await rejects(api.signUp(member), 'ID_ALREADY_EXISTS', 'id');
  await rejects(api.signUp({ ...member, id: 'trip02', email: 'trip@example.com' }), 'VALIDATION_ERROR', 'email');
  await api.signUp({ ...member, id: 'trip02' });
  await rejects(api.logIn({ id: member.id, password: 'wrong' }), 'INVALID_CREDENTIALS');
  const profile = await api.logIn({ id: member.id, password: member.password });
  assert.equal(profile.id, member.id);
  assert.ok(profile.joinedAt);
  assert.ok(!('password' in profile));
  assert.deepEqual(await api.getCurrentMember(), profile);
  const firstCookie = cookie;
  await api.logIn({ id: member.id, password: member.password });
  const updated = await api.updateCurrentMember({ name: '새 이름', password: '' });
  assert.equal(updated.name, '새 이름');
  assert.ok(!('email' in updated));
  await api.logOut();
  assert.equal(await api.getCurrentMember(), null);
  await api.logIn({ id: member.id, password: member.password });
  const otherDevice = cookie;
  await api.logIn({ id: member.id, password: member.password });
  await api.updateCurrentMember({ name: '새 이름', password: 'changed123' });
  assert.equal((await api.getCurrentMember()).name, '새 이름');
  for (const oldCookie of [firstCookie, otherDevice]) {
    const result = await nativeFetch(config.origin + '/api/members/me', { headers: { Cookie: oldCookie } });
    assert.equal(result.status, 401);
  }
  await rejects(api.logIn({ id: member.id, password: member.password }), 'INVALID_CREDENTIALS');
  const beforeReset = cookie;
  await rejects(api.issueTemporaryPassword({ id: 'nobody' }), 'MEMBER_NOT_FOUND', 'id');
  const temporary = await api.issueTemporaryPassword({ id: member.id });
  assert.match(temporary, /^[a-z2-9]{10}$/);
  assert.equal(await api.getCurrentMember(), null);
  assert.equal((await nativeFetch(config.origin + '/api/members/me', { headers: { Cookie: beforeReset } })).status, 401);
  const stored = db.prepare('SELECT password_hash FROM members WHERE username = ?').get(member.id);
  assert.ok(!stored.password_hash.includes(temporary));
  await rejects(api.logIn({ id: member.id, password: 'changed123' }), 'INVALID_CREDENTIALS');
  await api.logIn({ id: member.id, password: temporary });
  await rejects(api.withdrawCurrentMember({ password: 'wrong' }), 'INVALID_CURRENT_PASSWORD', 'password');
  await api.withdrawCurrentMember({ password: temporary });
  assert.equal(await api.getCurrentMember(), null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM members').get().n, 1);
});

test('연결 오류를 안내하고 세션 만료만 비로그인으로 처리한다', async t => {
  const nativeFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = nativeFetch; });
  globalThis.fetch = async () => { throw new TypeError('network'); };
  await assert.rejects(api.getCurrentMember(), /서버에 연결하지 못했습니다/);
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '서버 오류' } }), { status: 500 });
  await assert.rejects(api.getCurrentMember(), error => error.status === 500);
});

test('/login 해시는 비로그인 화면만 고르고 나머지는 로그인 화면으로 처리한다', () => {
  assert.equal(guestViewFromHash(''), 'login');
  assert.equal(guestViewFromHash('#signup'), 'signup');
  assert.equal(guestViewFromHash('#find-password'), 'find-password');
  assert.equal(guestViewFromHash('#account'), 'login');
});
