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

test('공통 헤더의 로그인 링크는 공통 헤더와 빈 메인이 있는 페이지로 이동한다', async () => {
  const home = await fetch(origin + '/');
  const homeHtml = await home.text();
  assert.match(homeHtml, /class="site-header__login site-header__desktop-login" href="\/login">로그인<\/a>/);
  assert.match(homeHtml, /class="site-header__mobile-account">[\s\S]*?href="\/login"/);

  const response = await fetch(origin + '/login');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes('<header class="site-header">'));
  assert.ok(html.includes('<title>로그인 | EnjoyTrip</title>'));
  assert.match(html, /<main>\s*<\/main>/);
  assert.ok(!html.includes('aria-current="page"'));
  assert.ok(!html.includes('data-home-link'));
  assert.ok(!html.includes('data-nav-link'));
});

test('게시판 메뉴는 공통 헤더와 빈 메인이 있는 /post 페이지로 이동한다', async () => {
  const home = await fetch(origin + '/');
  const homeHtml = await home.text();
  assert.equal([...homeHtml.matchAll(/href="\/post">게시판<\/a>/g)].length, 2);

  const response = await fetch(origin + '/post');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes('<header class="site-header">'));
  assert.ok(html.includes('<title>게시판 | EnjoyTrip</title>'));
  assert.match(html, /<main>\s*<\/main>/);
  assert.equal([...html.matchAll(/href="\/post" aria-current="page">게시판<\/a>/g)].length, 2);
  assert.ok(!html.includes('href="/" aria-current="page"'));
  assert.ok(!html.includes('data-nav-link'));
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
