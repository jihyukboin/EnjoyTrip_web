import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { createApi } from '../backend/api.js';
import { createRequestHandler } from '../backend/app.js';
import { createSessionReader } from '../backend/auth/session-reader.js';
import { createNoticeBannerReader } from '../backend/notices/banner-reader.js';
import { kstPeriodStarts } from '../backend/admin/service.js';
import { openDatabase } from '../backend/db/database.js';

const password = 'example-only-passphrase-2026';

async function fixture(t, { now = Date.now } = {}) {
  const db = openDatabase(':memory:');
  const config = { origin: '', secureCookies: false };
  const server = createServer(createRequestHandler({
    apiHandler: createApi({ db, config, now, rateLimit: { limit: 1000 } }),
    readSession: createSessionReader({ db, now }),
    readNotice: createNoticeBannerReader({ db })
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  config.origin = origin;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  const call = async (path, { method = 'GET', body, cookie } = {}) => {
    const response = await fetch(origin + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json', 'X-EnjoyTrip-Request': '1' }),
        ...(cookie ? { Cookie: cookie } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    const json = response.headers.get('content-type')?.startsWith('application/json') && text ? JSON.parse(text) : null;
    return { status: response.status, headers: response.headers, text, json };
  };
  const member = async (id, admin = false) => {
    assert.equal((await call('/api/members', { method: 'POST', body: { id, name: `${id} 이름`, password } })).status, 201);
    if (admin) db.prepare('UPDATE members SET isAdmin = 1 WHERE username = ?').run(id);
    const login = await call('/api/auth/login', { method: 'POST', body: { id, password } });
    return login.headers.get('set-cookie').split(';', 1)[0];
  };
  return { db, call, member };
}

test('관리자 페이지는 비로그인을 로그인으로, 일반 회원을 홈으로 보내고 관리자에게만 렌더링한다', async t => {
  const api = await fixture(t);
  const user = await api.member('member1');
  const admin = await api.member('manager', true);
  for (const path of ['/admin', '/admin/notice']) {
    const guest = await api.call(path);
    assert.equal(guest.status, 302);
    assert.equal(guest.headers.get('location'), `/login?returnTo=${encodeURIComponent(path)}`);
    const denied = await api.call(path, { cookie: user });
    assert.equal(denied.status, 302);
    assert.equal(denied.headers.get('location'), '/');
    const page = await api.call(path, { cookie: admin });
    assert.equal(page.status, 200);
    assert.match(page.text, new RegExp(`<a class="admin__nav-link" href="${path}" aria-current="page">`));
    assert.ok(!page.text.includes('<!-- admin-nav -->'));
  }
  const notice = await api.call('/admin/notice', { cookie: admin });
  assert.match(notice.text, /<form class="admin-notice__form form" data-notice-form novalidate>/);
  assert.match(notice.text, /<textarea id="notice-content" name="content" required maxlength="300"/);
});

test('관리자 대시보드 API는 한국 시간 기준 회원·게시글 현황과 회원 목록을 관리자에게만 제공한다', async t => {
  let time = Date.parse('2026-10-01T14:30:00Z'); // 한국 시간 10월 1일 23:30
  const api = await fixture(t, { now: () => time });
  const user = await api.member('member1');
  time = Date.parse('2026-10-01T15:30:00Z'); // 한국 시간 10월 2일 00:30
  const admin = await api.member('manager', true);
  const authorId = api.db.prepare("SELECT id FROM members WHERE username = 'member1'").get().id;
  const insert = api.db.prepare('INSERT INTO posts(author_id, title, content, created_at) VALUES (?, ?, ?, ?)');
  insert.run(authorId, '지난달', '본문', Date.parse('2026-09-30T14:59:59Z'));
  insert.run(authorId, '이번 달', '본문', Date.parse('2026-09-30T15:00:00Z'));
  insert.run(authorId, '오늘', '본문', Date.parse('2026-10-01T15:00:00Z'));

  assert.equal((await api.call('/api/admin/dashboard')).status, 401);
  const forbidden = await api.call('/api/admin/dashboard', { cookie: user });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.json.error.code, 'FORBIDDEN');

  const { json } = await api.call('/api/admin/dashboard', { cookie: admin });
  assert.deepEqual(json.data.summary, {
    members: { total: 2, today: 1, active: 2 },
    posts: { total: 3, month: 2, today: 1 }
  });
  assert.deepEqual(json.data.members.map(({ id, isAdmin, postCount }) => ({ id, isAdmin, postCount })), [
    { id: 'manager', isAdmin: true, postCount: 0 },
    { id: 'member1', isAdmin: false, postCount: 3 }
  ]);
  assert.ok(!JSON.stringify(json).includes('password'));
});

test('한국 시간 기준 오늘·이번 달 시작 시각을 계산한다', () => {
  assert.deepEqual(kstPeriodStarts(Date.parse('2026-10-01T14:59:59Z')), {
    day: Date.parse('2026-09-30T15:00:00Z'), month: Date.parse('2026-09-30T15:00:00Z')
  });
  assert.deepEqual(kstPeriodStarts(Date.parse('2026-10-01T15:00:00Z')), {
    day: Date.parse('2026-10-01T15:00:00Z'), month: Date.parse('2026-09-30T15:00:00Z')
  });
});

test('공지사항 API는 관리자만 등록·조회·수정·삭제하고 입력을 검증한다', async t => {
  const api = await fixture(t);
  const user = await api.member('member1');
  const admin = await api.member('manager', true);
  const body = { title: ' 점검 안내 ', content: ' 10월 3일 점검합니다.\n이용에 참고하세요. ' };
  const count = () => api.db.prepare('SELECT count(*) AS n FROM notices').get().n;

  assert.equal((await api.call('/api/admin/notices', { method: 'POST', body })).status, 401);
  assert.equal((await api.call('/api/admin/notices', { method: 'POST', body, cookie: user })).status, 403);
  assert.equal((await api.call('/api/admin/notices', { cookie: user })).status, 403);
  assert.equal(count(), 0);

  for (const invalid of [
    { title: ' ', content: '내용' }, { title: '제목', content: '' },
    { title: 'a'.repeat(101), content: '내용' }, { title: '제목', content: 'a'.repeat(301) },
    { title: '제목', content: '탭\t문자' }, { title: '제목', content: '내용', pinned: true }, {}
  ]) {
    const result = await api.call('/api/admin/notices', { method: 'POST', body: invalid, cookie: admin });
    assert.equal(result.status, 400, JSON.stringify(invalid));
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
  }
  assert.equal(count(), 0);

  const created = await api.call('/api/admin/notices', { method: 'POST', body, cookie: admin });
  assert.equal(created.status, 201);
  const notice = created.json.data.notice;
  assert.equal(notice.title, '점검 안내');
  assert.equal(notice.content, '10월 3일 점검합니다.\n이용에 참고하세요.');
  assert.equal(notice.createdAt, notice.updatedAt);

  const listed = await api.call('/api/admin/notices', { cookie: admin });
  assert.deepEqual(listed.json.data.notices, [notice]);

  const path = `/api/admin/notices/${notice.id}`;
  assert.equal((await api.call(path, { method: 'PUT', body: { title: '변경', content: '변경' }, cookie: user })).status, 403);
  const updated = await api.call(path, { method: 'PUT', body: { title: '점검 변경', content: '10월 4일로 변경' }, cookie: admin });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.notice.title, '점검 변경');
  assert.equal(updated.json.data.notice.createdAt, notice.createdAt);

  assert.equal((await api.call(path, { method: 'DELETE', body: {}, cookie: user })).status, 403);
  assert.equal((await api.call(path, { method: 'DELETE', body: { id: 1 }, cookie: admin })).status, 400);
  assert.equal((await api.call(path, { method: 'DELETE', body: {}, cookie: admin })).status, 204);
  assert.equal(count(), 0);

  const missing = await api.call(path, { method: 'PUT', body: { title: '제목', content: '내용' }, cookie: admin });
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, 'NOTICE_NOT_FOUND');
  assert.equal((await api.call(path, { method: 'DELETE', body: {}, cookie: admin })).status, 404);
  for (const bad of ['/api/admin/notices/abc', '/api/admin/notices/0', '/api/admin/notices/1/extra']) {
    assert.equal((await api.call(bad, { method: 'DELETE', body: {}, cookie: admin })).json.error.code, 'API_NOT_FOUND');
  }
  const method = await api.call(path, { cookie: admin });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'PUT, DELETE');
});

test('최신 공지는 공통 헤더 하단에 닫기 버튼과 함께 표시되고 닫은 공지는 수정 전까지 숨긴다', async t => {
  let time = 1_000;
  const api = await fixture(t, { now: () => time });
  const admin = await api.member('manager', true);
  const header = async cookie => (await api.call('/', { cookie })).text.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
  assert.ok(!(await header()).includes('data-notice-banner'));

  const create = async body => (await api.call('/api/admin/notices', { method: 'POST', body, cookie: admin })).json.data.notice;
  await create({ title: '이전 공지', content: '이전 내용' });
  time = 2_000;
  const latest = await create({ title: '<b>새 공지</b> {{account-href}}', content: '첫 줄\n"둘째" 줄' });

  const banner = await header();
  assert.match(banner, /<\/nav>\s*<section class="notice-banner" aria-label="공지사항" data-notice-banner data-notice-key="\d+\.2000">/);
  // 한 줄 구조: 확성기 아이콘 → 제목 → 닫기 버튼, 본문은 표시하지 않는다
  assert.match(banner, new RegExp(String.raw`data-notice-banner[^>]*>\s*<svg class="notice-banner__icon"[^>]*aria-label="공지">[\s\S]*?<\/svg>\s*<a class="notice-banner__title" href="\/post\/detail\?notice=${latest.id}">&lt;b&gt;새 공지&lt;\/b&gt; {{account-href}}<\/a>\s*<button class="notice-banner__close"`));
  assert.ok(!banner.includes('둘째'));
  assert.ok(!banner.includes('notice-banner__badge'));
  assert.ok(!banner.includes('이전 공지'));
  assert.match(banner, /<button class="notice-banner__close" type="button" aria-label="공지 닫기" data-notice-close>/);

  const dismissed = `enjoytrip_notice_dismissed=${latest.id}.2000`;
  assert.ok(!(await header(dismissed)).includes('data-notice-banner'));
  assert.ok((await header('enjoytrip_notice_dismissed=1.2000')).includes('data-notice-banner'));

  time = 3_000;
  await api.call(`/api/admin/notices/${latest.id}`, { method: 'PUT', body: { title: '수정 공지', content: '수정 내용' }, cookie: admin });
  assert.match(await header(dismissed), /data-notice-key="\d+\.3000"[\s\S]*수정 공지/);

  // 공지 상세는 로그인 없이 공개 API로 조회한다
  const detail = await api.call(`/api/notices/${latest.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.data.notice.title, '수정 공지');
  assert.equal(detail.json.data.notice.content, '수정 내용');
  await api.call(`/api/admin/notices/${latest.id}`, { method: 'DELETE', body: {}, cookie: admin });
  assert.match(await header(), /이전 공지/);
  const removed = await api.call(`/api/notices/${latest.id}`);
  assert.equal(removed.status, 404);
  assert.equal(removed.json.error.code, 'NOTICE_NOT_FOUND');
});
