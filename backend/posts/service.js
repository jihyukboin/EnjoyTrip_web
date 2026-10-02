import { ApiError } from '../http/api-response.js';

export const PAGE_SIZE = 20;

const notFound = () => new ApiError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');

export function createPostService({ posts, auth, now = Date.now }) {
  // 로그인 회원이 작성한 글인지 확인한다. 없는 글은 404, 다른 회원의 글은 403
  const ownPost = (token, id) => {
    const member = auth.authenticate(token);
    const found = posts.byId(id);
    if (!found) throw notFound();
    if (found.authorId !== member.id) throw new ApiError(403, 'FORBIDDEN', '본인이 작성한 글만 수정·삭제할 수 있습니다.');
    return found.post;
  };

  return {
    create(token, body) {
      const member = auth.authenticate(token);
      const post = posts.create(member.id, body, now());
      return { ...post, author: { id: member.username, name: member.name } };
    },
    get(id) {
      const found = posts.byId(id);
      if (!found) throw notFound();
      return found.post;
    },
    // 최신 글부터 20개씩 나눠 요청한 페이지를 돌려준다
    list(page, search = {}) {
      const total = posts.count(search);
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      return {
        posts: posts.list(PAGE_SIZE, (page - 1) * PAGE_SIZE, search),
        pagination: { page, pageSize: PAGE_SIZE, total, totalPages }
      };
    },
    update(token, id, body) {
      const post = ownPost(token, id);
      posts.update(id, body);
      return { ...post, ...body };
    },
    remove(token, id) {
      ownPost(token, id);
      posts.remove(id);
    }
  };
}
