-- 게시글 시작점·도착점 주소. 기존 글은 빈 문자열로 남는다
ALTER TABLE posts ADD COLUMN origin TEXT NOT NULL DEFAULT '' CHECK (length(origin) <= 200);
ALTER TABLE posts ADD COLUMN destination TEXT NOT NULL DEFAULT '' CHECK (length(destination) <= 200);
