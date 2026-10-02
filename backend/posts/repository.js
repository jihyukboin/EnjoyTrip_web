export function createPostRepository(db) {
  const insert = db.prepare('INSERT INTO posts(author_id, title, content, created_at) VALUES (?, ?, ?, ?)');
  const count = db.prepare('SELECT count(*) AS total FROM posts');
  const page = db.prepare(`SELECT p.id, p.title, p.content, p.created_at, m.username, m.name
    FROM posts p JOIN members m ON m.id = p.author_id
    ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`);
  return {
    create(authorId, { title, content }, time) {
      const id = Number(insert.run(authorId, title, content, time).lastInsertRowid);
      return { id, title, content, createdAt: new Date(time).toISOString() };
    },
    count: () => count.get().total,
    list(limit, offset) {
      return page.all(limit, offset).map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: { id: row.username, name: row.name },
        createdAt: new Date(row.created_at).toISOString()
      }));
    }
  };
}
