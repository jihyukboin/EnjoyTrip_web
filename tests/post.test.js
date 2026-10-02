import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../backend/api.js';
import { createRequestHandler } from '../backend/app.js';
import { openDatabase } from '../backend/db/database.js';
import { SESSION_MS } from '../backend/auth/tokens.js';
import { createPost, listPosts } from '../frontend/js/api/post-api.js';
import { logIn, signUp, logOut } from '../frontend/js/api/member-api.js';

async function fixture(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'enjoytrip-post-'));
  const path = join(directory, 'posts.sqlite');
  const db = openDatabase(path);
  const config = { origin: '', secureCookies: false };
  const server = createServer(createRequestHandler({ apiHandler: createApi({ db, config, ...options }) }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  const nativeFetch = globalThis.fetch;
  let cookie = '';
  const call = async (body, overrides = {}) => {
    const response = await nativeFetch(config.origin + '/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-EnjoyTrip-Request': '1',
        Origin: config.origin, Cookie: cookie, ...overrides }, body: JSON.stringify(body)
    });
    return { status: response.status, json: await response.json() };
  };
  globalThis.fetch = async (url, options) => {
    const response = await nativeFetch(config.origin + url, {
      ...options, headers: { ...options.headers, Origin: config.origin, Cookie: cookie }
    });
    const newCookie = response.headers.get('set-cookie');
    if (newCookie) cookie = newCookie.split(';', 1)[0];
    return response;
  };
  t.after(async () => {
    globalThis.fetch = nativeFetch;
    await new Promise(resolve => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const register = async () => {
    await signUp({ id: 'writer', name: '작성자', password: 'password1' });
    await logIn({ id: 'writer', password: 'password1' });
  };
  return { db, path, register, call };
}

test('프론트 게시글 API는 로그인 작성자의 글을 저장하고 로그아웃·만료 세션을 거부한다', async t => {
  let time = Date.now();
  const api = await fixture(t, { now: () => time });
  await assert.rejects(createPost({ title: '제목', content: '내용' }), error => error.code === 'UNAUTHENTICATED');
  await api.register();
  const post = await createPost({ title: '  여행 후기  ', content: '첫 줄\n둘째 줄 <script>alert(1)</script>' });
  assert.equal(post.title, '여행 후기');
  assert.deepEqual(post.author, { id: 'writer', name: '작성자' });
  assert.equal(post.createdAt, new Date(time).toISOString());
  const stored = api.db.prepare('SELECT * FROM posts').get();
  assert.equal(stored.author_id, api.db.prepare('SELECT id FROM members').get().id);
  assert.equal(stored.content, post.content);
  assert.equal(stored.id, post.id);
  const reopened = openDatabase(api.path);
  try { assert.equal(reopened.prepare('SELECT title FROM posts').get().title, post.title); }
  finally { reopened.close(); }
  await logOut();
  assert.equal((await api.call({ title: '제목', content: '본문' })).status, 401);
  await logIn({ id: 'writer', password: 'password1' });
  time += SESSION_MS;
  assert.equal((await api.call({ title: '제목', content: '본문' })).status, 401);
  assert.equal(api.db.prepare('SELECT count(*) AS n FROM posts').get().n, 1);
});

test('빈 글·길이 초과·잘못된 필드와 작성자 위조·다른 출처 요청은 저장되지 않는다', async t => {
  const api = await fixture(t);
  await api.register();
  for (const body of [
    { title: ' ', content: '내용' }, { title: '제목', content: '\n ' },
    { title: 'a'.repeat(101), content: '내용' }, { title: '제목', content: 'a'.repeat(2001) },
    { title: 123, content: '내용' }, { title: '제목', content: '\ud800' },
    { title: '제목', content: 'a\0b' },
    { title: '제목', content: '내용', authorId: 99 }
  ]) {
    const result = await api.call(body);
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
  }
  const invalidOrigin = await api.call({ title: '제목', content: '내용' }, { Origin: 'https://other.example' });
  assert.equal(invalidOrigin.status, 403);
  const missingHeader = await api.call({ title: '제목', content: '내용' }, { 'X-EnjoyTrip-Request': '' });
  assert.equal(missingHeader.status, 403);
  assert.equal(api.db.prepare('SELECT count(*) AS n FROM posts').get().n, 0);
  const result = await api.call({ title: 'a'.repeat(100), content: '여'.repeat(2000) });
  assert.equal(result.status, 201);
});

test('게시글 목록은 최신 글부터 20개씩 나누고 잘못된 페이지 값을 거부한다', async t => {
  const api = await fixture(t);
  assert.deepEqual(await listPosts(), { posts: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
  await api.register();
  const authorId = api.db.prepare('SELECT id FROM members').get().id;
  const insert = api.db.prepare('INSERT INTO posts(author_id, title, content, created_at) VALUES (?, ?, ?, ?)');
  for (let index = 1; index <= 41; index += 1) insert.run(authorId, `글 ${index}`, `본문 ${index}`, 1_000 * index);
  const first = await listPosts(1);
  assert.equal(first.posts.length, 20);
  assert.equal(first.posts[0].title, '글 41');
  assert.equal(first.posts[19].title, '글 22');
  assert.deepEqual(first.posts[0].author, { id: 'writer', name: '작성자' });
  assert.equal(first.posts[0].createdAt, new Date(41_000).toISOString());
  assert.deepEqual(first.pagination, { page: 1, pageSize: 20, total: 41, totalPages: 3 });
  assert.deepEqual((await listPosts(3)).posts.map(post => post.title), ['글 1']);
  assert.equal((await listPosts(4)).posts.length, 0);
  await logOut();
  assert.equal((await listPosts(2)).posts[0].title, '글 21');
  for (const page of ['0', '-1', '1.5', 'abc', '']) {
    await assert.rejects(listPosts(page), error => error.status === 400 && error.field === 'page');
  }
});
