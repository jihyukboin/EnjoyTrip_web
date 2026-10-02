export function createMemberRepository(db) {
  const byId = db.prepare('SELECT * FROM members WHERE id = ?');
  const byEmail = db.prepare('SELECT * FROM members WHERE email = ?');
  const insert = db.prepare('INSERT INTO members(email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
  const rename = db.prepare('UPDATE members SET name = ?, updated_at = ? WHERE id = ?');
  const changePassword = db.prepare('UPDATE members SET password_hash = ?, updated_at = ? WHERE id = ?');
  const remove = db.prepare('DELETE FROM members WHERE id = ?');
  return {
    byId: (id) => byId.get(id),
    byEmail: (email) => byEmail.get(email),
    create(email, name, hash, time) { return byId.get(Number(insert.run(email, name, hash, time, time).lastInsertRowid)); },
    rename(id, name, time) { rename.run(name, time, id); return byId.get(id); },
    changePassword: (id, hash, time) => changePassword.run(hash, time, id),
    remove: (id) => remove.run(id)
  };
}

export function publicMember(member) {
  return {
    id: member.id, email: member.email, name: member.name,
    createdAt: new Date(member.created_at).toISOString(), updatedAt: new Date(member.updated_at).toISOString()
  };
}
