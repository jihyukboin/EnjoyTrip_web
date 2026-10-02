export function createMemberRepository(db) {
  const byId = db.prepare('SELECT * FROM members WHERE id = ?');
  const byUsername = db.prepare('SELECT * FROM members WHERE username = ?');
  const insert = db.prepare('INSERT INTO members(username, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
  const update = db.prepare('UPDATE members SET name = ?, password_hash = ?, updated_at = ? WHERE id = ?');
  const changePassword = db.prepare('UPDATE members SET password_hash = ?, updated_at = ? WHERE id = ?');
  const remove = db.prepare('DELETE FROM members WHERE id = ?');
  return {
    byId: (id) => byId.get(id),
    byUsername: (username) => byUsername.get(username),
    create(username, name, hash, time) { return byId.get(Number(insert.run(username, name, hash, time, time).lastInsertRowid)); },
    update(id, name, hash, time) { update.run(name, hash, time, id); return byId.get(id); },
    changePassword: (id, hash, time) => changePassword.run(hash, time, id),
    remove: (id) => remove.run(id)
  };
}

export function publicMember(member) {
  return {
    id: member.username, name: member.name,
    joinedAt: new Date(member.created_at).toISOString(),
    createdAt: new Date(member.created_at).toISOString(), updatedAt: new Date(member.updated_at).toISOString()
  };
}
