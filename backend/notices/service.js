import { ApiError } from '../http/api-response.js';
import { requireAdmin } from '../admin/access.js';

const notFound = () => new ApiError(404, 'NOTICE_NOT_FOUND', '공지사항을 찾을 수 없습니다.');

export function createNoticeService({ notices, auth, now = Date.now }) {
  return {
    authorize: token => requireAdmin(auth, token),
    list(token) {
      requireAdmin(auth, token);
      return notices.list();
    },
    // 공지 상세는 로그인 없이 조회할 수 있다
    get(id) {
      const notice = notices.byId(id);
      if (!notice) throw notFound();
      return notice;
    },
    create: body => notices.create(body, now()),
    update(id, body) {
      const notice = notices.update(id, body, now());
      if (!notice) throw notFound();
      return notice;
    },
    remove(id) {
      if (!notices.remove(id)) throw notFound();
    }
  };
}
