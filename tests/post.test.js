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
import { createPost, deletePost, getNotice, getPost, listPosts, updatePost } from '../frontend/js/api/post-api.js';
import { request } from '../frontend/js/api/client.js';
import { logIn, signUp, logOut } from '../frontend/js/api/member-api.js';

// 주소 검색으로 고른 시작점·도착점
const route = { origin: '서울 중구 세종대로 110', destination: '부산 해운대구 해운대해변로 264' };

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
  await assert.rejects(createPost({ title: '제목', content: '내용', ...route }), error => error.code === 'UNAUTHENTICATED');
  await api.register();
  const post = await createPost({ title: '  여행 후기  ', content: '첫 줄\n둘째 줄 <script>alert(1)</script>', ...route });
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
  assert.equal((await api.call({ title: '제목', content: '본문', ...route })).status, 401);
  await logIn({ id: 'writer', password: 'password1' });
  time += SESSION_MS;
  assert.equal((await api.call({ title: '제목', content: '본문', ...route })).status, 401);
  assert.equal(api.db.prepare('SELECT count(*) AS n FROM posts').get().n, 1);
});

test('빈 글·길이 초과·잘못된 필드와 작성자 위조·다른 출처 요청은 저장되지 않는다', async t => {
  const api = await fixture(t);
  await api.register();
  for (const body of [
    { title: ' ', content: '내용', ...route },
    { title: '제목', ...route, origin: ' ' }, { title: '제목', ...route, destination: '' },
    { title: '제목', content: null, ...route },
    { title: 'a'.repeat(101), content: '내용', ...route }, { title: '제목', content: 'a'.repeat(2001), ...route },
    { title: 123, content: '내용', ...route }, { title: '제목', content: '\ud800', ...route },
    { title: '제목', content: 'a\0b', ...route },
    { title: '제목', content: '내용', authorId: 99 }
  ]) {
    const result = await api.call(body);
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
  }
  const invalidOrigin = await api.call({ title: '제목', content: '내용', ...route }, { Origin: 'https://other.example' });
  assert.equal(invalidOrigin.status, 403);
  const missingHeader = await api.call({ title: '제목', content: '내용', ...route }, { 'X-EnjoyTrip-Request': '' });
  assert.equal(missingHeader.status, 403);
  assert.equal(api.db.prepare('SELECT count(*) AS n FROM posts').get().n, 0);
  const result = await api.call({ title: 'a'.repeat(100), content: '여'.repeat(2000), ...route });
  assert.equal(result.status, 201);
});

test('본문 없이 글을 등록·조회하고 본문 삭제와 출발·도착 변경을 저장한다', async t => {
  const api = await fixture(t);
  await api.register();
  for (const content of [undefined, '', '\n ']) {
    const post = await createPost({ title: '여행 제목', content, ...route });
    assert.equal(post.content, '');
    assert.equal(post.origin, route.origin);
    assert.equal(post.destination, route.destination);
    assert.deepEqual(await getPost(post.id), post);
    assert.equal((await listPosts()).posts.find(item => item.id === post.id).content, '');
  }
  const post = await createPost({ title: '수정할 글', content: '기존 본문', ...route });
  const updated = await updatePost(post.id, {
    title: post.title, origin: route.destination, destination: route.origin
  });
  assert.equal(updated.content, '');
  assert.equal(updated.origin, route.destination);
  assert.equal(updated.destination, route.origin);
  assert.deepEqual(await getPost(post.id), updated);
  assert.equal(api.db.prepare('SELECT content FROM posts WHERE id = ?').get(post.id).content, '');
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
  api.db.prepare('INSERT INTO notices(title, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run('여행 안내', '안내 내용', 21_500, 21_500);
  const mixed = await listPosts(2);
  assert.equal(mixed.posts.length, 20);
  assert.equal(mixed.posts[0].title, '여행 안내');
  assert.equal(mixed.posts[0].content, '안내 내용');
  assert.equal(mixed.posts[0].author.name, '공지사항');
  assert.equal(mixed.posts[0].type, 'notice');
  assert.equal(mixed.posts[1].type, 'post');
  assert.equal(mixed.posts[1].title, '글 21');
  assert.equal(mixed.pagination.total, 42);
  assert.deepEqual((await listPosts(3)).posts.map(post => post.title), ['글 2', '글 1']);
  for (const page of ['0', '-1', '1.5', 'abc', '']) {
    await assert.rejects(listPosts(page), error => error.status === 400 && error.field === 'page');
  }
});

test('게시글 상세·수정·삭제는 작성자 본인만 변경할 수 있고 없는 글은 404를 반환한다', async t => {
  const api = await fixture(t);
  await assert.rejects(getPost(1), error => error.status === 404 && error.code === 'POST_NOT_FOUND');
  await api.register();
  const post = await createPost({ title: '원래 제목', content: '원래 본문', ...route });
  assert.deepEqual(await getPost(post.id), { ...post, author: { id: 'writer', name: '작성자' } });

  const updated = await updatePost(post.id, { title: '  바뀐 제목 ', content: '바뀐\n본문', ...route });
  assert.deepEqual(updated, { ...post, title: '바뀐 제목', content: '바뀐\n본문', author: { id: 'writer', name: '작성자' } });
  assert.equal(api.db.prepare('SELECT title FROM posts WHERE id = ?').get(post.id).title, '바뀐 제목');
  await assert.rejects(updatePost(post.id, { title: ' ', content: '본문', ...route }), error => error.status === 400 && error.field === 'title');
  await assert.rejects(updatePost(999, { title: '제목', content: '본문', ...route }), error => error.status === 404);
  await assert.rejects(deletePost(999), error => error.status === 404);

  // 다른 회원은 수정·삭제할 수 없다
  await logOut();
  await signUp({ id: 'other', name: '다른회원', password: 'password1' });
  await logIn({ id: 'other', password: 'password1' });
  await assert.rejects(updatePost(post.id, { title: '탈취', content: '탈취', ...route }), error => error.status === 403 && error.code === 'FORBIDDEN');
  await assert.rejects(deletePost(post.id), error => error.status === 403);
  assert.equal(api.db.prepare('SELECT title FROM posts WHERE id = ?').get(post.id).title, '바뀐 제목');

  // 비로그인은 401, 삭제 본문에 필드가 있으면 400
  await logOut();
  await assert.rejects(updatePost(post.id, { title: '제목', content: '본문', ...route }), error => error.status === 401);
  await assert.rejects(deletePost(post.id), error => error.status === 401);
  await logIn({ id: 'writer', password: 'password1' });
  await assert.rejects(request(`/api/posts/${post.id}`, { method: 'DELETE', body: { force: true } }),
    error => error.status === 400 && error.field === 'force');

  assert.equal(await deletePost(post.id), undefined);
  assert.equal(api.db.prepare('SELECT count(*) AS n FROM posts').get().n, 0);
  await assert.rejects(getPost(post.id), error => error.status === 404);
});

test('로그인 없이 게시글 목록·게시글 상세·공지 상세와 해당 페이지를 조회할 수 있다', async t => {
  const api = await fixture(t);
  await api.register();
  const post = await createPost({ title: '공개 글', content: '공개 본문', ...route });
  const noticeId = Number(api.db.prepare('INSERT INTO notices(title, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run('공개 공지', '공지 본문', 1_000, 1_000).lastInsertRowid);
  await logOut();

  const { posts } = await listPosts();
  assert.deepEqual(posts.map(item => [item.type, item.title]), [['post', '공개 글'], ['notice', '공개 공지']]);
  assert.equal((await getPost(post.id)).content, '공개 본문');
  assert.equal((await getNotice(noticeId)).content, '공지 본문');

  // 세션 쿠키 없이 페이지가 리다이렉트 없이 열린다
  for (const path of ['/post', `/post/detail?id=${post.id}`, `/post/detail?notice=${noticeId}`]) {
    const response = await globalThis.fetch(path, { redirect: 'manual', headers: {} });
    assert.equal(response.status, 200, path);
    assert.ok((await response.text()).includes('<header class="site-header">'), path);
  }
});
