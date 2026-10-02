const toNotice = row => row && ({
  id: row.id,
  title: row.title,
  content: row.content,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

export function createNoticeRepository(db) {
  const all = db.prepare('SELECT * FROM notices ORDER BY created_at DESC, id DESC');
  const latest = db.prepare('SELECT * FROM notices ORDER BY created_at DESC, id DESC LIMIT 1');
  const byId = db.prepare('SELECT * FROM notices WHERE id = ?');
  const insert = db.prepare('INSERT INTO notices(title, content, created_at, updated_at) VALUES (?, ?, ?, ?)');
  const update = db.prepare('UPDATE notices SET title = ?, content = ?, updated_at = ? WHERE id = ?');
  const remove = db.prepare('DELETE FROM notices WHERE id = ?');
  return {
    list: () => all.all().map(toNotice),
    latest: () => toNotice(latest.get()),
    create({ title, content }, time) {
      return toNotice(byId.get(Number(insert.run(title, content, time, time).lastInsertRowid)));
    },
    // 변경된 행이 없으면 null을 돌려준다
    update(id, { title, content }, time) {
      return update.run(title, content, time, id).changes ? toNotice(byId.get(id)) : null;
    },
    remove: id => remove.run(id).changes > 0
  };
}
