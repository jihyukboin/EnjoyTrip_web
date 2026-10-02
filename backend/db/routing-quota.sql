CREATE TABLE routing_usage (
  day TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  mode TEXT NOT NULL,
  calls INTEGER NOT NULL CHECK(calls >= 0),
  PRIMARY KEY(day, key_hash, mode)
) STRICT;
