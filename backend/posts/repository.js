export function createPostRepository(db) {
  const insert = db.prepare('INSERT INTO posts(author_id, title, content, created_at) VALUES (?, ?, ?, ?)');
  return {
    create(authorId, { title, content }, time) {
      const id = Number(insert.run(authorId, title, content, time).lastInsertRowid);
      return { id, title, content, createdAt: new Date(time).toISOString() };
    }
  };
}
