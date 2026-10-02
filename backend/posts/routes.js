import { sendJson } from '../http/api-response.js';
import { validatePost } from './validation.js';

export function createPostRoutes({ posts, auth }) {
  return new Map([['/api/posts', new Map([['POST', {
    limited: true,
    authorize: token => auth.authenticate(token),
    validate: validatePost,
    action(body, token, response) {
      sendJson(response, 201, { data: { post: posts.create(token, body) } });
    }
  }]])]]);
}
