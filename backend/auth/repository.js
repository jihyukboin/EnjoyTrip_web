export function createAuthRepository(db) {
  const session = db.prepare(`SELECT m.* FROM sessions s JOIN members m ON m.id = s.member_id
    WHERE s.token_hash = ? AND s.expires_at > ?`);
  const reset = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ?');
  const insertSession = db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)');
  const removeSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const removeSessions = db.prepare('DELETE FROM sessions WHERE member_id = ?');
  const insertReset = db.prepare('INSERT INTO password_reset_tokens VALUES (?, ?, ?, ?)');
  const removeReset = db.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?');
  const removeResets = db.prepare('DELETE FROM password_reset_tokens WHERE member_id = ?');
  const expiredSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  const expiredResets = db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ?');
  return {
    sessionMember: (hash, time) => session.get(hash, time),
    reset: (hash, time) => reset.get(hash, time),
    insertSession: (hash, id, time, expires) => insertSession.run(hash, id, time, expires),
    removeSession: (hash) => removeSession.run(hash),
    insertReset: (hash, id, time, expires) => insertReset.run(hash, id, time, expires),
    removeReset: (hash) => removeReset.run(hash),
    removeResets: (id) => removeResets.run(id),
    revokeAll(id) { removeSessions.run(id); removeResets.run(id); },
    prune(time) { expiredSessions.run(time); expiredResets.run(time); }
  };
}
