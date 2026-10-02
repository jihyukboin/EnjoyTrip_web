import { listPosts } from '../../api/post-api.js';
import { renderPagination } from './pagination.js';

const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' });

function readPage() {
  const value = new URLSearchParams(location.search).get('page');
  return /^[1-9]\d{0,5}$/.test(value ?? '') ? Number(value) : 1;
}

function renderPost(post) {
  const item = document.createElement('li');
  item.className = 'post-list__item';
  const title = document.createElement('h3');
  title.className = 'post-list__item-title';
  title.textContent = post.title;
  const content = document.createElement('p');
  content.className = 'post-list__excerpt';
  content.textContent = post.content;
  const meta = document.createElement('p');
  meta.className = 'post-list__meta';
  const time = document.createElement('time');
  time.dateTime = post.createdAt;
  time.textContent = dateFormat.format(new Date(post.createdAt));
  meta.append(`${post.author.name} · `, time);
  item.append(title, content, meta);
  return item;
}

export function initializePostList() {
  const section = document.querySelector('[data-post-list]');
  if (!section) return;
  const list = section.querySelector('.post-list__items');
  const status = section.querySelector('.post-list__status');
  const nav = section.querySelector('.pagination');

  const load = async page => {
    section.setAttribute('aria-busy', 'true');
    try {
      const { posts, pagination } = await listPosts(page);
      list.replaceChildren(...posts.map(renderPost));
      status.textContent = posts.length ? '' : '등록된 게시글이 없습니다.';
      renderPagination(nav, pagination);
    } catch (error) {
      list.replaceChildren();
      nav.hidden = true;
      status.textContent = error.message;
    } finally {
      section.removeAttribute('aria-busy');
    }
  };

  // 페이지 이동은 새로고침 없이 처리하고 주소에 ?page=를 남긴다
  nav.addEventListener('click', async event => {
    const link = event.target.closest('a[data-page]');
    if (!link) return;
    event.preventDefault();
    history.pushState(null, '', link.href);
    await load(Number(link.dataset.page));
    section.scrollIntoView({ block: 'start' });
  });
  addEventListener('popstate', () => load(readPage()));

  return load(readPage());
}
