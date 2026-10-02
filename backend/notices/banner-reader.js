// 페이지 렌더링용: 최신 공지를 읽고, 사용자가 닫은 공지면 표시하지 않는다
import { createNoticeRepository } from './repository.js';

export const NOTICE_COOKIE = 'enjoytrip_notice_dismissed';

// 공지 수정 시 다시 표시되도록 id와 수정 시각으로 닫음 여부를 구분한다
export const noticeKey = notice => `${notice.id}.${Date.parse(notice.updatedAt)}`;

function dismissedKey(request) {
  const prefix = `${NOTICE_COOKIE}=`;
  const value = (request.headers.cookie ?? '').split(';').map(part => part.trim())
    .find(part => part.startsWith(prefix))?.slice(prefix.length);
  return value && /^\d+\.\d+$/.test(value) ? value : null;
}

export function createNoticeBannerReader({ db }) {
  const notices = createNoticeRepository(db);
  return request => {
    const notice = notices.latest();
    return notice && noticeKey(notice) !== dismissedKey(request) ? notice : null;
  };
}
