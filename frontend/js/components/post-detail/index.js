// /post/detail?id=: 게시글 하나를 불러와 보여준다
import { getPost } from '../../api/post-api.js';

const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

export async function initializePostDetail() {
  const root = document.querySelector('[data-post-detail]');
  if (!root) return;
  const status = root.querySelector('.post-detail__status');
  const body = root.querySelector('.post-detail__body');
  const id = new URLSearchParams(location.search).get('id');
  try {
    if (!/^[1-9]\d{0,15}$/.test(id ?? '')) throw new Error('잘못된 게시글 주소입니다.');
    const post = await getPost(id);
    document.title = `${post.title} | EnjoyTrip`;
    root.querySelector('.post-detail__title').textContent = post.title;
    const time = document.createElement('time');
    time.dateTime = post.createdAt;
    time.textContent = dateFormat.format(new Date(post.createdAt));
    root.querySelector('.post-detail__meta').replaceChildren(`${post.author.name} · `, time);
    root.querySelector('.post-detail__content').textContent = post.content;
    body.hidden = false;
    status.textContent = '';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    root.removeAttribute('aria-busy');
  }
}
