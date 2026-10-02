-- 버전 3 → 4: 회원 이메일 열과 이메일 기반 재설정 토큰 테이블을 제거한다
-- UNIQUE 열은 DROP COLUMN이 불가하므로 members 테이블을 재생성한다
CREATE TABLE members_v4 (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE CHECK (length(username) BETWEEN 4 AND 20),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
INSERT INTO members_v4 (id, username, name, password_hash, created_at, updated_at)
  SELECT id, username, name, password_hash, created_at, updated_at FROM members;
DROP TABLE members;
ALTER TABLE members_v4 RENAME TO members;
DROP TABLE password_reset_tokens;
