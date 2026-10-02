import { sendJson } from '../http/api-response.js';
import { validateEmpty, validateNotice } from './validation.js';

// 관리자 공지사항 등록·조회·수정·삭제. 변경 요청은 본문을 읽기 전에 관리자 권한을 확인한다.
export function createNoticeRoutes({ notices }) {
  const mutation = (validate, action) => ({ limited: true, authorize: notices.authorize, validate, action });
  return new Map([
    ['/api/admin/notices', new Map([
      ['GET', {
        action(body, token, response) {
          sendJson(response, 200, { data: { notices: notices.list(token) } });
        }
      }],
      ['POST', mutation(validateNotice, (body, token, response) => {
        sendJson(response, 201, { data: { notice: notices.create(body) } });
      })]
    ])],
    ['/api/admin/notices/:id', new Map([
      ['PUT', mutation(validateNotice, (body, token, response, request, { id }) => {
        sendJson(response, 200, { data: { notice: notices.update(id, body) } });
      })],
      ['DELETE', mutation(validateEmpty, (body, token, response, request, { id }) => {
        notices.remove(id);
        sendJson(response, 204);
      })]
    ])]
  ]);
}
