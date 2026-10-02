import { getPost, listPosts } from '../../api/post-api.js';
import { renderPagination } from '../post-list/pagination.js';
import { renderTicket } from './ticket.js';
import { bindSearch, readSearch } from '../post-list/search.js';

function readPage() {
  const value = new URLSearchParams(location.search).get('page');
  return /^[1-9]\d{0,5}$/.test(value ?? '') ? Number(value) : 1;
}

// 게시판 목록 API에서 공지사항을 빼고 회원 게시글만 항공권으로 보여준다
export async function initializeFlight() {
  const section = document.querySelector('[data-flight-list]');
  if (!section) return;
  const list = section.querySelector('.flight__items');
  const status = section.querySelector('.flight__status');
  const nav = section.querySelector('.pagination');
  bindSearch(section);
  const search = readSearch();

  section.setAttribute('aria-busy', 'true');
  try {
    const { posts, pagination } = await listPosts(readPage(), { ...search, scope: 'post' });
    const userPosts = posts.filter(post => post.type === 'post');
    const selectedParam = new URLSearchParams(location.search).get('selected');
    const selectedId = /^[1-9]\d{0,15}$/.test(selectedParam ?? '') ? selectedParam : null;
    let selectedPost = userPosts.find(post => String(post.id) === selectedId);
    // 현재 목록 페이지에 없는 글도 상세 API로 불러와 가장 위에 표시한다.
    if (selectedId && !selectedPost && !search.q) {
      try {
        selectedPost = await getPost(selectedId);
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }
    const orderedPosts = selectedPost
      ? [selectedPost, ...userPosts.filter(post => String(post.id) !== selectedId)]
      : userPosts;
    list.replaceChildren(...orderedPosts.map(post => {
      const ticket = renderTicket(post);
      if (String(post.id) === selectedId) {
        ticket.classList.add('flight-ticket--selected');
        ticket.querySelector('article').setAttribute('aria-label', `선택한 항공권 · ${post.title}`);
      }
      return ticket;
    }));
    status.textContent = orderedPosts.length ? '' : search.q ? '검색 결과가 없습니다.' : '등록된 게시글이 없습니다.';
    renderPagination(nav, pagination);
    if (selectedPost) {
      for (const link of nav.querySelectorAll('a')) {
        const params = new URLSearchParams(link.search);
        params.set('selected', selectedId);
        link.search = params.toString();
      }
    }
  } catch (error) {
    list.replaceChildren();
    nav.hidden = true;
    status.textContent = error.message;
  } finally {
    section.removeAttribute('aria-busy');
  }
}
