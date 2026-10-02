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
