import { sendJson } from '../http/api-response.js';
import { validatePage, validatePost } from './validation.js';

export function createPostRoutes({ posts, auth }) {
  return new Map([['/api/posts', new Map([
    ['GET', {
      action(body, token, response, request) {
        const page = validatePage(new URL(request.url, 'http://localhost').searchParams);
        sendJson(response, 200, { data: posts.list(page) });
      }
    }],
    ['POST', {
      limited: true,
      authorize: token => auth.authenticate(token),
      validate: validatePost,
      action(body, token, response) {
        sendJson(response, 201, { data: { post: posts.create(token, body) } });
      }
    }]
  ])]]);
}
