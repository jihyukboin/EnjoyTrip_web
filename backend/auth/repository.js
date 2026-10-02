export function createAuthRepository(db) {
  const session = db.prepare(`SELECT m.* FROM sessions s JOIN members m ON m.id = s.member_id
    WHERE s.token_hash = ? AND s.expires_at > ?`);
  const insertSession = db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)');
  const removeSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const removeSessions = db.prepare('DELETE FROM sessions WHERE member_id = ?');
  const removeOtherSessions = db.prepare('DELETE FROM sessions WHERE member_id = ? AND token_hash <> ?');
  const expiredSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  return {
    sessionMember: (hash, time) => session.get(hash, time),
    insertSession: (hash, id, time, expires) => insertSession.run(hash, id, time, expires),
    removeSession: (hash) => removeSession.run(hash),
    revokeOthers: (id, hash) => removeOtherSessions.run(id, hash),
    revokeAll: (id) => removeSessions.run(id),
    prune: (time) => expiredSessions.run(time)
  };
}
