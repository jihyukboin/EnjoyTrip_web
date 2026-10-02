import { readFile } from 'node:fs/promises';
import { renderPage } from '../views/render-page.js';
import { sendContent } from './response.js';

const pages = new Map([
  ['/', new URL('../../frontend/index.html', import.meta.url)],
  ['/index.html', new URL('../../frontend/index.html', import.meta.url)],
  ['/login', new URL('../../frontend/pages/login.html', import.meta.url)],
  ['/mypage', new URL('../../frontend/pages/mypage.html', import.meta.url)],
  ['/post', new URL('../../frontend/pages/post.html', import.meta.url)],
  ['/post/write', new URL('../../frontend/pages/post-write.html', import.meta.url)],
  ['/post/detail', new URL('../../frontend/pages/post-detail.html', import.meta.url)],
  ['/post/edit', new URL('../../frontend/pages/post-write.html', import.meta.url)],
  ['/flight', new URL('../../frontend/pages/flight.html', import.meta.url)],
  ['/flight/records', new URL('../../frontend/pages/flight-records.html', import.meta.url)],
  ['/admin', new URL('../../frontend/pages/admin.html', import.meta.url)],
  ['/admin/notice', new URL('../../frontend/pages/admin-notice.html', import.meta.url)]
]);

// 관리자 전용 페이지: 비로그인은 로그인 화면, 일반 회원은 홈으로 보낸다
const adminPages = new Set(['/admin', '/admin/notice']);

function adminRedirect(pathname, loggedIn, isAdmin) {
  if (!adminPages.has(pathname) || isAdmin) return null;
  return loggedIn ? '/' : `/login?returnTo=${encodeURIComponent(pathname)}`;
}

// /flight/{게시글 ID}는 하나의 지도 페이지를 함께 쓴다
const flightMapPage = new URL('../../frontend/pages/flight-map.html', import.meta.url);
const findPage = pathname => pages.get(pathname) ?? (/^\/flight\/[1-9]\d*$/.test(pathname) ? flightMapPage : null);

// view는 페이지 요청일 때만 세션·공지를 읽도록 함수로 받는다
export async function servePage(request, response, pathname, view = () => ({})) {
  const pagePath = findPage(pathname);
  if (!pagePath) return false;

  const { loggedIn = false, isAdmin = false, notice = null, kakaoMapKey = '' } = view();
  const location = adminRedirect(pathname, loggedIn, isAdmin);
  if (location) {
    response.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
    response.end();
    return true;
  }

  const source = await readFile(pagePath);
  const content = await renderPage(source, pathname, { loggedIn, isAdmin, notice, kakaoMapKey });
  sendContent(request, response, content, 'text/html; charset=utf-8');
  return true;
}
