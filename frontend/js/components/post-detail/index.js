// /post/detail?id= 게시글, /post/detail?notice= 공지사항을 불러와 보여준다
import { getNotice, getPost } from '../../api/post-api.js';
import { createRouteMap } from '../route-map/index.js';

const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
const ID = /^[1-9]\d{0,15}$/;

// 주소에 따라 불러올 대상을 고른다. 공지는 작성자 대신 '공지사항'으로 표시한다
async function loadItem() {
  const params = new URLSearchParams(location.search);
  const noticeId = params.get('notice');
  const postId = params.get('id');
  if (ID.test(noticeId ?? '')) {
    const notice = await getNotice(noticeId);
    return { ...notice, type: 'notice', author: { name: '공지사항' } };
  }
  if (ID.test(postId ?? '')) return getPost(postId);
  throw new Error('잘못된 게시글 주소입니다.');
}

export async function initializePostDetail() {
  const root = document.querySelector('[data-post-detail]');
  if (!root) return;
  const status = root.querySelector('.post-detail__status');
  const body = root.querySelector('.post-detail__body');
  try {
    const item = await loadItem();
    document.title = `${item.title} | EnjoyTrip`;
    root.querySelector('.post-detail__title').textContent = item.title;
    const time = document.createElement('time');
    time.dateTime = item.createdAt;
    time.textContent = dateFormat.format(new Date(item.createdAt));
    root.querySelector('.post-detail__meta').replaceChildren(`${item.author.name} · `, time);
    root.querySelector('.post-detail__content').textContent = item.content;
    if (item.type !== 'notice') {
      const flightLink = root.querySelector('[data-flight-link]');
      flightLink.href = `/flight?${new URLSearchParams({ selected: item.id })}`;
      flightLink.hidden = false;
    }
    body.hidden = false;
    if (item.type !== 'notice') {
      if (item.origin && item.destination) document.body.classList.add('post-detail-page--map');
      void createRouteMap(root.querySelector('[data-route-map]'), {
        canvas: document.querySelector('[data-detail-map]')
      })(item.origin, item.destination);
    }
    status.textContent = '';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    root.removeAttribute('aria-busy');
  }
}
