import { getCurrentMember } from '../../api/member-api.js';
import { deletePost, listPosts } from '../../api/post-api.js';
import { renderPagination } from './pagination.js';
import { renderPost } from './item.js';
import { bindSearch, readSearch } from './search.js';

function readPage() {
  const value = new URLSearchParams(location.search).get('page');
  return /^[1-9]\d{0,5}$/.test(value ?? '') ? Number(value) : 1;
}

// 비로그인·조회 실패 시 수정·삭제 버튼 없이 목록만 보여준다
const currentMemberId = async () => {
  try { return (await getCurrentMember())?.id ?? null; }
  catch { return null; }
};

export async function initializePostList() {
  const section = document.querySelector('[data-post-list]');
  if (!section) return;
  const list = section.querySelector('.post-list__items');
  const status = section.querySelector('.post-list__status');
  const nav = section.querySelector('.pagination');
  const syncSearch = bindSearch(section);
  const memberId = await currentMemberId();

  const load = async page => {
    section.setAttribute('aria-busy', 'true');
    syncSearch();
    try {
      const search = readSearch();
      const { posts, pagination } = await listPosts(page, search);
      list.replaceChildren(...posts.map(post => renderPost(post, memberId)));
      status.textContent = posts.length ? '' : search.q ? '검색 결과가 없습니다.' : '등록된 게시글이 없습니다.';
      renderPagination(nav, pagination);
      return pagination;
    } catch (error) {
      list.replaceChildren();
      nav.hidden = true;
      status.textContent = error.message;
      return null;
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

  list.addEventListener('click', async event => {
    const button = event.target.closest('button[data-delete-post]');
    if (!button) return;
    if (!confirm(`'${button.dataset.title}' 글을 삭제할까요?`)) return;
    button.disabled = true;
    let message = '게시글을 삭제했습니다.';
    try {
      await deletePost(button.dataset.deletePost);
    } catch (error) {
      if (error.code === 'UNAUTHENTICATED') {
        location.assign('/login?returnTo=%2Fpost');
        return;
      }
      message = error.message;
    }
    // 마지막 글을 지워 현재 페이지가 비면 마지막 페이지로 이동한다
    const page = readPage();
    const pagination = await load(page);
    if (pagination && page > pagination.totalPages) {
      const params = new URLSearchParams(location.search);
      params.set('page', pagination.totalPages);
      history.replaceState(null, '', `?${params}`);
      await load(pagination.totalPages);
    }
    status.textContent = message;
  });

  return load(readPage());
}
