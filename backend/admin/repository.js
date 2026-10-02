// 관리자 대시보드용 집계·회원 목록 조회
export function createAdminRepository(db) {
  const memberCount = db.prepare('SELECT count(*) AS n FROM members WHERE created_at >= ?');
  const activeMembers = db.prepare('SELECT count(DISTINCT member_id) AS n FROM sessions WHERE expires_at > ?');
  const postCount = db.prepare('SELECT count(*) AS n FROM posts WHERE created_at >= ?');
  const members = db.prepare(`SELECT m.username, m.name, m.isAdmin, m.created_at,
      (SELECT count(*) FROM posts p WHERE p.author_id = m.id) AS post_count
    FROM members m ORDER BY m.created_at DESC, m.id DESC`);
  return {
    countMembers: (since = 0) => memberCount.get(since).n,
    countActiveMembers: (time) => activeMembers.get(time).n,
    countPosts: (since = 0) => postCount.get(since).n,
    members: () => members.all().map(row => ({
      id: row.username,
      name: row.name,
      isAdmin: row.isAdmin === 1,
      postCount: row.post_count,
      joinedAt: new Date(row.created_at).toISOString()
    }))
  };
}
