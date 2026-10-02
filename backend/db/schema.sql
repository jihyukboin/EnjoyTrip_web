CREATE TABLE members (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE CHECK (length(username) BETWEEN 4 AND 20),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
) STRICT;
CREATE INDEX sessions_member_id_idx ON sessions(member_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
