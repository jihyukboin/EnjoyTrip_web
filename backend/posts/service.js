export const PAGE_SIZE = 20;

export function createPostService({ posts, auth, now = Date.now }) {
  return {
    create(token, body) {
      const member = auth.authenticate(token);
      const post = posts.create(member.id, body, now());
      return { ...post, author: { id: member.username, name: member.name } };
    },
    // 최신 글부터 20개씩 나눠 요청한 페이지를 돌려준다
    list(page) {
      const total = posts.count();
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      return {
        posts: posts.list(PAGE_SIZE, (page - 1) * PAGE_SIZE),
        pagination: { page, pageSize: PAGE_SIZE, total, totalPages }
      };
    }
  };
}
