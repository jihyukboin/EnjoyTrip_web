CREATE TABLE flight_records (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  itinerary TEXT NOT NULL CHECK (json_valid(itinerary)),
  routes TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(routes)),
  created_at INTEGER NOT NULL,
  UNIQUE(member_id, run_id)
) STRICT;
CREATE INDEX flight_records_post_member_idx ON flight_records(post_id, member_id, id DESC);
