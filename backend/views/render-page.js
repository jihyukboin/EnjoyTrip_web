import { readFile } from 'node:fs/promises';

const partials = [
  ['<!-- document-head -->', new URL('./document-head.html', import.meta.url)],
  ['<!-- site-header -->', new URL('./site-header.html', import.meta.url)]
];

export async function renderPage(source, pathname = '/') {
  let html = source.toString('utf8');
  const required = partials.filter(([marker]) => html.includes(marker));
  if (!required.length) return source;

  const contents = await Promise.all(required.map(([, path]) => readFile(path, 'utf8')));
  const currentPath = pathname === '/index.html' ? '/' : pathname;
  required.forEach(([marker], index) => {
    const content = marker === '<!-- site-header -->'
      ? contents[index].replace(/ data-nav-link="([^"]+)"/g, (_, href) => href === currentPath ? ' aria-current="page"' : '')
      : contents[index];
    html = html.replaceAll(marker, () => content);
  });
  return Buffer.from(html);
}
