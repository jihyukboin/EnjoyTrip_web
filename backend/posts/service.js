export function createPostService({ posts, auth, now = Date.now }) {
  return {
    create(token, body) {
      const member = auth.authenticate(token);
      const post = posts.create(member.id, body, now());
      return { ...post, author: { id: member.username, name: member.name } };
    }
  };
}
