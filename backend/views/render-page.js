import { readFile } from 'node:fs/promises';

const headerPath = new URL('./site-header.html', import.meta.url);
const headerMarker = '<!-- site-header -->';

export async function renderPage(source) {
  const html = source.toString('utf8');
  if (!html.includes(headerMarker)) return source;

  const header = await readFile(headerPath, 'utf8');
  return Buffer.from(html.replaceAll(headerMarker, () => header));
}
