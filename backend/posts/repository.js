const toPost = row => ({
  id: row.id,
  title: row.title,
  content: row.content,
  author: { id: row.username, name: row.name },
  createdAt: new Date(row.created_at).toISOString()
});

export function createPostRepository(db) {
  const insert = db.prepare('INSERT INTO posts(author_id, title, content, created_at) VALUES (?, ?, ?, ?)');
  const count = db.prepare('SELECT (SELECT count(*) FROM posts) + (SELECT count(*) FROM notices) AS total');
  const page = db.prepare(`SELECT 'post' AS type, p.id, p.title, p.content, p.created_at, m.username, m.name
    FROM posts p JOIN members m ON m.id = p.author_id
    UNION ALL
    SELECT 'notice' AS type, id, title, content, created_at, NULL AS username, '공지사항' AS name FROM notices
    ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`);
  const byId = db.prepare(`SELECT p.id, p.author_id, p.title, p.content, p.created_at, m.username, m.name
    FROM posts p JOIN members m ON m.id = p.author_id WHERE p.id = ?`);
  const update = db.prepare('UPDATE posts SET title = ?, content = ? WHERE id = ?');
  const remove = db.prepare('DELETE FROM posts WHERE id = ?');
  return {
    create(authorId, { title, content }, time) {
      const id = Number(insert.run(authorId, title, content, time).lastInsertRowid);
      return { id, title, content, createdAt: new Date(time).toISOString() };
    },
    count: () => count.get().total,
    // type은 'post' 또는 'notice'. 상세 페이지 주소를 고르는 데 쓴다
    list: (limit, offset) => page.all(limit, offset).map(row => ({ type: row.type, ...toPost(row) })),
    // 권한 확인용으로 작성자 회원 번호(authorId)를 함께 돌려준다
    byId(id) {
      const row = byId.get(id);
      return row ? { authorId: row.author_id, post: toPost(row) } : null;
    },
    update(id, { title, content }) { update.run(title, content, id); },
    remove(id) { remove.run(id); }
  };
}
