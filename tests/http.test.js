import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { handleRequest } from '../backend/app.js';

const server = createServer(handleRequest);
let origin;

before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('최초 HTML 응답에 공통 헤더와 폰트 preload가 포함된다', async () => {
  for (const path of ['/', '/index.html']) {
    const response = await fetch(origin + path);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes('<header class="site-header">'));
    assert.ok(html.includes('<span>EnjoyTrip</span>'));
    assert.ok(html.includes('aria-current="page">홈</a>'));
    assert.ok(!html.includes('<!-- site-header -->'));
    assert.ok(!html.includes('<!-- document-head -->'));
    assert.equal([...html.matchAll(/rel="preload"/g)].length, 3);
    assert.equal(Number(response.headers.get('content-length')), Buffer.byteLength(html));
    assert.equal(response.headers.get('cache-control'), 'no-cache');
  }
});

test('공통 헤더의 로그인 링크는 로그인·회원가입·비밀번호 찾기 화면이 있는 /login으로 이동한다', async () => {
  const home = await fetch(origin + '/');
  const homeHtml = await home.text();
  assert.match(homeHtml, /class="site-header__login site-header__desktop-login" href="\/login">로그인<\/a>/);
  assert.match(homeHtml, /class="site-header__mobile-account">[\s\S]*?href="\/login"/);

  const response = await fetch(origin + '/login');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes('<header class="site-header">'));
  assert.ok(html.includes('<title>로그인 | EnjoyTrip</title>'));
  for (const view of ['login', 'signup', 'find-password', 'account']) {
    assert.ok(html.includes(`data-auth-view="${view}"`), view);
  }
  assert.match(html, /<input id="login-id" name="id"[^>]*required/);
  assert.match(html, /<input id="login-password" name="password" type="password"/);
  assert.ok(html.includes('data-logout'));
  assert.ok(html.includes('href="/css/components/auth.css"'));
  assert.ok(!html.includes('aria-current="page"'));
  assert.ok(!html.includes('data-home-link'));
  assert.ok(!html.includes('data-nav-link'));
});

test('/mypage는 내 정보 조회, 정보 수정, 회원 탈퇴 화면을 제공한다', async () => {
  const response = await fetch(origin + '/mypage');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes('<header class="site-header">'));
  assert.ok(html.includes('<title>마이페이지 | EnjoyTrip</title>'));
  for (const slot of ['avatar', 'name', 'id', 'joinedAt']) {
    assert.ok(html.includes(`data-profile="${slot}"`), slot);
  }
  assert.match(html, /<input id="edit-id" name="id"[^>]*readonly/);
  assert.ok(html.includes('data-edit-form'));
  assert.ok(!html.includes('email'));
  assert.match(html, /<dialog class="mypage__dialog"[\s\S]*?data-withdraw-form/);
  assert.ok(!html.includes('aria-current="page"'));

  for (const path of [
    '/css/components/form.css',
    '/css/components/mypage.css',
    '/js/components/mypage/index.js',
    '/js/components/auth/index.js',
    '/js/api/member-api.js'
  ]) {
    const asset = await fetch(origin + path);
    assert.equal(asset.status, 200, path);
    await asset.arrayBuffer();
  }
});

test('게시판 메뉴는 공통 헤더가 있는 /post 페이지로 이동한다', async () => {
  const home = await fetch(origin + '/');
  const homeHtml = await home.text();
  assert.equal([...homeHtml.matchAll(/href="\/post">게시판<\/a>/g)].length, 2);

  const response = await fetch(origin + '/post');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes('<header class="site-header">'));
  assert.ok(html.includes('<title>게시판 | EnjoyTrip</title>'));
  assert.equal([...html.matchAll(/href="\/post" aria-current="page">게시판<\/a>/g)].length, 2);
  assert.ok(!html.includes('href="/" aria-current="page"'));
  assert.ok(!html.includes('data-nav-link'));
});

test('게시판 히어로는 두 줄 제목과 /post/write로 가는 글쓰기 버튼을 서버 HTML에 포함한다', async () => {
  const response = await fetch(origin + '/post');
  const html = await response.text();
  assert.match(html, /<h1 [^>]*class="board-hero__title">\s*<span>EnjoyTrip 게시판<\/span>\s*<span>어디로 떠나볼까요\?<\/span>/);
  assert.match(html, /<canvas class="board-hero__canvas" aria-hidden="true"><\/canvas>/);
  assert.match(html, /href="\/post\/write">[\s\S]*?글쓰기\s*<\/a>/);
  assert.ok(html.includes('href="/css/components/board-hero.css"'));
  assert.ok(!html.includes('travel-hero'));

  for (const path of ['/css/components/board-hero.css', '/js/components/board-hero/index.js']) {
    const asset = await fetch(origin + path);
    assert.equal(asset.status, 200, path);
    await asset.arrayBuffer();
  }
});

test('/post/write는 제목·본문 입력란과 API 제출 폼을 제공한다', async () => {
  const response = await fetch(origin + '/post/write');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes('<header class="site-header">'));
  assert.ok(html.includes('<title>글쓰기 | EnjoyTrip</title>'));
  assert.match(html, /<input id="post-title" name="title"[^>]*maxlength="100"/);
  assert.match(html, /<textarea id="post-content" name="content"/);
  assert.match(html, /href="\/post">취소<\/a>/);
  assert.match(html, /<button class="button button--primary" type="submit">등록<\/button>/);
  assert.ok(html.includes('data-post-form'));
  assert.ok(html.includes('post-title-error'));
  assert.ok(html.includes('post-content-error'));
  assert.ok(html.includes('maxlength="2000"'));
  assert.ok(html.includes('href="/css/components/post-write.css"'));

  const asset = await fetch(origin + '/css/components/post-write.css');
  assert.equal(asset.status, 200);
  await asset.arrayBuffer();
});

test('홈 히어로는 두 줄 제목과 /flight, /post로 가는 CTA를 서버 HTML에 포함한다', async () => {
  const response = await fetch(origin + '/');
  const html = await response.text();
  assert.match(html, /<h1 [^>]*class="travel-hero__title">\s*<span>EnjoyTrip<\/span>\s*<span>여행을 떠나보세요<\/span>/);
  assert.match(html, /<canvas class="travel-hero__canvas" aria-hidden="true"><\/canvas>/);
  assert.match(html, /href="\/flight">[\s\S]*?직접 비행하기\s*<\/a>/);
  assert.match(html, /href="\/post">여행 신청하기<\/a>/);
  assert.ok(html.includes('href="/css/components/travel-hero.css"'));

  for (const path of ['/css/components/travel-hero.css', '/js/components/travel-hero/index.js']) {
    const asset = await fetch(origin + path);
    assert.equal(asset.status, 200, path);
    await asset.arrayBuffer();
  }
});

test('HTML과 정적 파일은 ETag가 일치하면 본문 없이 304를 반환한다', async () => {
  for (const path of ['/', '/css/main.css', '/js/components/site-header.js', '/assets/logo.svg']) {
    const first = await fetch(origin + path);
    await first.arrayBuffer();
    const etag = first.headers.get('etag');
    assert.ok(etag);
    const cached = await fetch(origin + path, { headers: { 'If-None-Match': `"other", W/${etag}` } });
    assert.equal(cached.status, 304);
    assert.equal(await cached.text(), '');
    const stale = await fetch(origin + path, { headers: { 'If-None-Match': '"old"' } });
    assert.equal(stale.status, 200);
    await stale.arrayBuffer();
  }
});

test('HEAD 응답은 GET과 같은 길이를 제공하고 본문을 전송하지 않는다', async () => {
  for (const path of ['/', '/assets/logo.svg']) {
    const get = await fetch(origin + path);
    await get.arrayBuffer();
    const head = await fetch(origin + path, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), get.headers.get('content-length'));
    assert.equal(head.headers.get('etag'), get.headers.get('etag'));
    assert.equal(await head.text(), '');
  }
});

test('미리 로드하는 버전별 폰트는 올바른 MIME과 장기 캐시로 제공된다', async () => {
  const page = await fetch(origin + '/');
  const html = await page.text();
  const paths = [...html.matchAll(/rel="preload" href="([^"]+)"/g)].map(match => match[1]);
  for (const path of paths) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'font/woff2');
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
});

test('잘못된 요청과 없는 페이지는 적절한 상태로 응답한다', async () => {
  for (const [path, status] of [['/missing.html', 404], ['/missing.js', 404], ['/%ZZ', 400], ['/%00', 403], ['/%2e%2e%2fpackage.json', 403]]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, status, path);
    await response.arrayBuffer();
  }
  const response = await fetch(origin + '/', { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
  await response.arrayBuffer();
});
