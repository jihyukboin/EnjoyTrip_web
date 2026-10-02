import { readFile } from 'node:fs/promises';

const partials = [
  ['<!-- document-head -->', new URL('./document-head.html', import.meta.url)],
  ['<!-- site-header -->', new URL('./site-header.html', import.meta.url)]
];

// 로그인 상태에 따라 헤더의 계정 링크를 바꾼다
const accountLinks = {
  guest: { href: '/login', label: '로그인' },
  member: { href: '/mypage', label: '마이페이지' }
};

function renderHeader(header, currentPath, loggedIn) {
  const account = loggedIn ? accountLinks.member : accountLinks.guest;
  return header
    .replace(/ data-nav-link="([^"]+)"/g, (_, href) => href === currentPath ? ' aria-current="page"' : '')
    .replaceAll('{{account-href}}', account.href)
    .replaceAll('{{account-label}}', account.label);
}

export async function renderPage(source, pathname = '/', { loggedIn = false } = {}) {
  let html = source.toString('utf8');
  const required = partials.filter(([marker]) => html.includes(marker));
  if (!required.length) return source;

  const contents = await Promise.all(required.map(([, path]) => readFile(path, 'utf8')));
  const currentPath = pathname === '/index.html' ? '/' : pathname;
  required.forEach(([marker], index) => {
    const content = marker === '<!-- site-header -->'
      ? renderHeader(contents[index], currentPath, loggedIn)
      : contents[index];
    html = html.replaceAll(marker, () => content);
  });
  return Buffer.from(html);
}
