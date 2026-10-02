import { readFile } from 'node:fs/promises';
import { renderPage } from '../views/render-page.js';
import { sendContent } from './response.js';

const pages = new Map([
  ['/', new URL('../../frontend/index.html', import.meta.url)],
  ['/index.html', new URL('../../frontend/index.html', import.meta.url)],
  ['/login', new URL('../../frontend/pages/login.html', import.meta.url)],
  ['/post', new URL('../../frontend/pages/post.html', import.meta.url)]
]);

export async function servePage(request, response, pathname) {
  const pagePath = pages.get(pathname);
  if (!pagePath) return false;

  const source = await readFile(pagePath);
  const content = await renderPage(source, pathname);
  sendContent(request, response, content, 'text/html; charset=utf-8');
  return true;
}
