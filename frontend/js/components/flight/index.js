import { listPosts } from '../../api/post-api.js';
import { renderPagination } from '../post-list/pagination.js';
import { renderTicket } from './ticket.js';

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

  section.setAttribute('aria-busy', 'true');
  try {
    const { posts, pagination } = await listPosts(readPage());
    const userPosts = posts.filter(post => post.type === 'post');
    list.replaceChildren(...userPosts.map(renderTicket));
    status.textContent = userPosts.length ? '' : '등록된 게시글이 없습니다.';
    renderPagination(nav, pagination);
  } catch (error) {
    list.replaceChildren();
    nav.hidden = true;
    status.textContent = error.message;
  } finally {
    section.removeAttribute('aria-busy');
  }
}
