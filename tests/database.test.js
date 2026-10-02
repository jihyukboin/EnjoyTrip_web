import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { openDatabase, transaction } from '../backend/db/database.js';

// 이전 버전 DB를 재현하는 스키마 (버전 3까지 이메일·재설정 토큰을 보유했다)
const legacyMembers = (username) => `CREATE TABLE members (
  id INTEGER PRIMARY KEY,
  ${username ? 'username TEXT NOT NULL UNIQUE CHECK (length(username) BETWEEN 4 AND 20),' : ''}
  email TEXT NOT NULL UNIQUE,
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
CREATE TABLE password_reset_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
) STRICT;`;
const postsSchema = readFileSync(new URL('../backend/db/posts-schema.sql', import.meta.url), 'utf8');
import { readConfig } from '../backend/config.js';

test('파일 DB 재시작·스키마 버전·외래 키·롤백을 검증한다', t => {
  const directory = mkdtempSync(join(tmpdir(), 'enjoytrip-db-'));
  t.after(() => {
    assert.equal(resolve(dirname(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('enjoytrip-db-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const path = join(directory, 'enjoytrip.sqlite');
  let db = openDatabase(path);
  try {
    db.prepare('INSERT INTO members (id, username, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(1, 'testuser', '테스트', 'test-hash', 1, 1);
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('a'.repeat(64), 1, 1, 2);
    assert.throws(() => db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('b'.repeat(64), 999, 1, 2));
    assert.throws(() => transaction(db, () => {
      db.prepare('DELETE FROM members WHERE id = ?').run(1);
      throw new Error('rollback');
    }));
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 1);
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT name FROM members WHERE id = ?').get(1).name, '테스트');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  } finally { if (db.isOpen) db.close(); }
});

test('환경설정은 DB 공개 경로·운영 HTTP를 거부한다', () => {
  const config = readConfig({});
  assert.equal(config.origin, 'http://127.0.0.1:3000');
  assert.ok(!('resetDeliveryMode' in config));
  for (const env of [
    { PORT: '0' }, { COOKIE_SECURE: 'yes' },
    { APP_ORIGIN: 'http://127.0.0.1:3000/login' },
    { DB_PATH: 'frontend/leaked.sqlite' },
    { NODE_ENV: 'production' },
    { APP_ORIGIN: 'http://example.com' },
    { APP_ORIGIN: 'https://example.com', COOKIE_SECURE: 'false' }
  ]) assert.throws(() => readConfig(env));
  assert.equal(readConfig({ APP_ORIGIN: 'https://example.com' }).secureCookies, true);
});

test('버전 1 DB를 기존 회원·세션을 유지하며 아이디·게시글이 있고 이메일이 없고 관리자 여부가 있는 버전 5로 변환한다', t => {
  const directory = mkdtempSync(join(tmpdir(), 'enjoytrip-db-'));
  const path = join(directory, 'legacy.sqlite');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const legacy = new DatabaseSync(path);
  legacy.exec(legacyMembers(false));
  legacy.exec('PRAGMA user_version = 1');
  legacy.prepare('INSERT INTO members VALUES (?, ?, ?, ?, ?, ?)').run(1, 'legacy@example.com', '기존 회원', 'hash', 1, 1);
  legacy.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('a'.repeat(64), 1, 1, 2);
  legacy.close();
  const db = openDatabase(path);
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
    assert.equal(db.prepare('SELECT username FROM members').get().username, 'member1');
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 1);
    assert.throws(() => db.prepare('INSERT INTO members (id, username, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(2, 'member1', '중복', 'hash', 1, 1));
  } finally { db.close(); }
});

test('버전 2 회원 DB에 게시글 테이블을 추가하고 탈퇴 시 작성글을 삭제한다', t => {
  const directory = mkdtempSync(join(tmpdir(), 'enjoytrip-db-'));
  const path = join(directory, 'version2.sqlite');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const legacy = new DatabaseSync(path);
  legacy.exec(legacyMembers(true));
  legacy.exec('PRAGMA user_version = 2');
  legacy.prepare('INSERT INTO members VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(1, 'writer', 'writer@example.com', '작성자', 'hash', 1, 1);
  legacy.close();
  const db = openDatabase(path);
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
    assert.equal(db.prepare('SELECT username FROM members').get().username, 'writer');
    db.prepare('INSERT INTO posts VALUES (?, ?, ?, ?, ?)').run(1, 1, '제목', '본문', 1);
    db.prepare('DELETE FROM members WHERE id = ?').run(1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM posts').get().n, 0);
  } finally { db.close(); }
});

test('버전 3 DB에서 이메일 열·재설정 토큰 테이블을 제거하고 회원·세션·게시글을 유지한다', t => {
  const directory = mkdtempSync(join(tmpdir(), 'enjoytrip-db-'));
  const path = join(directory, 'version3.sqlite');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const legacy = new DatabaseSync(path);
  legacy.exec('PRAGMA foreign_keys = ON');
  legacy.exec(legacyMembers(true));
  legacy.exec(postsSchema);
  legacy.exec('PRAGMA user_version = 3');
  legacy.prepare('INSERT INTO members VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 'writer', 'writer@example.com', '작성자', 'hash', 1, 2);
  legacy.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('a'.repeat(64), 1, 1, 2);
  legacy.prepare('INSERT INTO password_reset_tokens VALUES (?, ?, ?, ?)').run('b'.repeat(64), 1, 1, 2);
  legacy.prepare('INSERT INTO posts VALUES (?, ?, ?, ?, ?)').run(1, 1, '제목', '본문', 1);
  legacy.close();
  const db = openDatabase(path);
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.deepEqual(db.prepare('PRAGMA table_info(members)').all().map(column => column.name),
      ['id', 'username', 'name', 'password_hash', 'created_at', 'updated_at', 'isAdmin']);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name = 'password_reset_tokens'").get().n, 0);
    assert.deepEqual({ ...db.prepare('SELECT * FROM members').get() },
      { id: 1, username: 'writer', name: '작성자', password_hash: 'hash', created_at: 1, updated_at: 2, isAdmin: 0 });
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM posts').get().n, 1);
    // 재생성된 members를 sessions·posts가 계속 참조하며 탈퇴 시 CASCADE 된다
    db.prepare('DELETE FROM members WHERE id = ?').run(1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM posts').get().n, 0);
  } finally { db.close(); }
});


test('버전 4 회원의 관리자 기본값·0/1 제약·재시작 후 권한 보존을 검증한다', t => {
  const directory = mkdtempSync(join(tmpdir(), 'enjoytrip-db-'));
  const path = join(directory, 'version4.sqlite');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const legacy = new DatabaseSync(path);
  const schema = readFileSync(new URL('../backend/db/schema.sql', import.meta.url), 'utf8');
  legacy.exec(schema.replace(',\n  isAdmin INTEGER NOT NULL DEFAULT 0 CHECK (isAdmin IN (0, 1))', ''));
  legacy.exec(postsSchema);
  legacy.exec('PRAGMA user_version = 4');
  legacy.prepare('INSERT INTO members VALUES (?, ?, ?, ?, ?, ?)').run(1, 'writer', '작성자', 'hash', 1, 2);
  legacy.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('a'.repeat(64), 1, 1, 2);
  legacy.prepare('INSERT INTO posts VALUES (?, ?, ?, ?, ?)').run(1, 1, '제목', '본문', 1);
  legacy.close();
  let db = openDatabase(path);
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
    assert.equal(db.prepare('SELECT isAdmin FROM members WHERE id = 1').get().isAdmin, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM posts').get().n, 1);
    for (const value of [-1, 2, null]) {
      assert.throws(() => db.prepare('UPDATE members SET isAdmin = ? WHERE id = 1').run(value));
    }
    db.prepare('UPDATE members SET isAdmin = 1 WHERE id = 1').run();
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT isAdmin FROM members WHERE id = 1').get().isAdmin, 1);
  } finally { if (db.isOpen) db.close(); }
});

test('버전 5 DB에 공지사항 테이블을 추가하고 기존 회원·게시글을 유지한다', t => {
  const directory = mkdtempSync(join(tmpdir(), 'enjoytrip-db-'));
  const path = join(directory, 'version5.sqlite');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const legacy = new DatabaseSync(path);
  legacy.exec(readFileSync(new URL('../backend/db/schema.sql', import.meta.url), 'utf8'));
  legacy.exec(postsSchema);
  legacy.exec('PRAGMA user_version = 5');
  legacy.prepare('INSERT INTO members VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 'manager', '관리자', 'hash', 1, 2, 1);
  legacy.prepare('INSERT INTO posts VALUES (?, ?, ?, ?, ?)').run(1, 1, '제목', '본문', 1);
  legacy.close();
  const db = openDatabase(path);
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
    assert.equal(db.prepare('SELECT isAdmin FROM members WHERE id = 1').get().isAdmin, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM posts').get().n, 1);
    db.prepare('INSERT INTO notices(title, content, created_at, updated_at) VALUES (?, ?, ?, ?)').run('공지', '내용', 1, 1);
    assert.throws(() => db.prepare('INSERT INTO notices(title, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('', '내용', 1, 1));
    assert.throws(() => db.prepare('INSERT INTO notices(title, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('공지', 'a'.repeat(301), 1, 1));
  } finally { db.close(); }
});
