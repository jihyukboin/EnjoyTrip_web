import { readFile } from 'node:fs/promises';
import { escapeHtml } from './escape-html.js';
import { noticeKey } from '../notices/banner-reader.js';

const partials = [
  ['<!-- document-head -->', new URL('./document-head.html', import.meta.url)],
  ['<!-- site-header -->', new URL('./site-header.html', import.meta.url)],
  ['<!-- admin-nav -->', new URL('./admin-nav.html', import.meta.url)]
];

// 현재 경로와 같은 메뉴 링크에 aria-current를 붙인다
const markCurrent = (html, currentPath) =>
  html.replace(/ data-nav-link="([^"]+)"/g, (_, href) => href === currentPath ? ' aria-current="page"' : '');

async function renderNoticeBanner(notice) {
  if (!notice) return '';
  const template = await readFile(new URL('./notice-banner.html', import.meta.url), 'utf8');
  const values = { key: noticeKey(notice), id: notice.id, title: notice.title };
  return template.replace(/{{(key|id|title)}}/g, (_, name) => escapeHtml(values[name]));
}

// 로그인 상태에 따라 헤더의 계정 링크를 바꾼다
const accountLinks = {
  guest: { href: '/login', label: '로그인' },
  member: { href: '/mypage', label: '마이페이지' }
};

function renderHeader(header, currentPath, loggedIn, isAdmin, accountMenu, banner) {
  const account = loggedIn ? accountLinks.member : accountLinks.guest;
  const rendered = markCurrent(header
    .replace(/<!-- guest-account-start -->([\s\S]*?)<!-- guest-account-end -->/g,
      (_, content) => loggedIn ? '' : content)
    .replace('<!-- account-menu -->', loggedIn ? accountMenu : '')
    .replaceAll('<!-- admin-link -->', loggedIn && isAdmin
      ? '<a href="/admin" data-nav-link="/admin" data-admin-link>관리자</a>' : ''), currentPath)
    .replaceAll('{{account-href}}', account.href)
    .replaceAll('{{account-label}}', account.label);
  // 관리자 입력이 템플릿 치환에 섞이지 않도록 공지는 마지막에 넣는다
  return rendered.replace('<!-- notice-banner -->', () => banner);
}

export async function renderPage(source, pathname = '/', { loggedIn = false, isAdmin = false, notice = null } = {}) {
  let html = source.toString('utf8');
  const required = partials.filter(([marker]) => html.includes(marker));
  if (!required.length) return source;

  const contents = await Promise.all(required.map(([, path]) => readFile(path, 'utf8')));
  const accountMenu = loggedIn && required.some(([marker]) => marker === '<!-- site-header -->')
    ? await readFile(new URL('./account-menu.html', import.meta.url), 'utf8') : '';
  const banner = required.some(([marker]) => marker === '<!-- site-header -->') ? await renderNoticeBanner(notice) : '';
  const currentPath = pathname === '/index.html' ? '/' : pathname;
  const render = {
    '<!-- site-header -->': header => renderHeader(header, currentPath, loggedIn, isAdmin, accountMenu, banner),
    '<!-- admin-nav -->': nav => markCurrent(nav, currentPath)
  };
  required.forEach(([marker], index) => {
    const content = render[marker]?.(contents[index]) ?? contents[index];
    html = html.replaceAll(marker, () => content);
  });
  return Buffer.from(html);
}
