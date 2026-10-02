import { sendJson } from '../http/api-response.js';
import { validateEmpty } from '../http/json-body.js';
import { validatePage, validatePost, validateSearch } from './validation.js';

export function createPostRoutes({ posts, auth }) {
  // 변경 요청은 본문을 읽기 전에 로그인 세션을 확인한다
  const mutation = (validate, action) => ({
    limited: true, authorize: token => auth.authenticate(token), validate, action
  });
  return new Map([
    ['/api/posts', new Map([
      ['GET', {
        action(body, token, response, request) {
          const params = new URL(request.url, 'http://localhost').searchParams;
          sendJson(response, 200, { data: posts.list(validatePage(params), validateSearch(params)) });
        }
      }],
      ['POST', mutation(validatePost, (body, token, response) => {
        sendJson(response, 201, { data: { post: posts.create(token, body) } });
      })]
    ])],
    ['/api/posts/:id', new Map([
      ['GET', {
        action(body, token, response, request, { id }) {
          sendJson(response, 200, { data: { post: posts.get(id) } });
        }
      }],
      ['PUT', mutation(validatePost, (body, token, response, request, { id }) => {
        sendJson(response, 200, { data: { post: posts.update(token, id, body) } });
      })],
      ['DELETE', mutation(validateEmpty, (body, token, response, request, { id }) => {
        posts.remove(token, id);
        sendJson(response, 204);
      })]
    ])]
  ]);
}
