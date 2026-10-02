-- 버전 7 → 8: 게시글 본문을 선택 입력으로 변경하고 기존 글·주소를 보존한다.
CREATE TABLE posts_v8 (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 0 AND 2000),
  created_at INTEGER NOT NULL,
  origin TEXT NOT NULL DEFAULT '' CHECK (length(origin) <= 200),
  destination TEXT NOT NULL DEFAULT '' CHECK (length(destination) <= 200)
) STRICT;
INSERT INTO posts_v8 (id, author_id, title, content, created_at, origin, destination)
  SELECT id, author_id, title, content, created_at, origin, destination FROM posts;
DROP TABLE posts;
ALTER TABLE posts_v8 RENAME TO posts;
