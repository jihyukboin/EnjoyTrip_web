import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { openDatabase, transaction } from '../backend/db/database.js';
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
    db.prepare('INSERT INTO members VALUES (?, ?, ?, ?, ?, ?)').run(1, 'test@example.com', '테스트', 'test-hash', 1, 1);
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
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  } finally { if (db.isOpen) db.close(); }
});

test('환경설정은 DB 공개 경로·운영 HTTP·운영 콘솔 복구를 거부한다', () => {
  const config = readConfig({});
  assert.equal(config.origin, 'http://127.0.0.1:3000');
  assert.equal(config.resetDeliveryMode, 'disabled');
  for (const env of [
    { PORT: '0' }, { COOKIE_SECURE: 'yes' },
    { APP_ORIGIN: 'http://127.0.0.1:3000/login' },
    { DB_PATH: 'frontend/leaked.sqlite' },
    { NODE_ENV: 'production' },
    { APP_ORIGIN: 'http://example.com' },
    { APP_ORIGIN: 'https://example.com', COOKIE_SECURE: 'false' },
    { NODE_ENV: 'production', APP_ORIGIN: 'https://example.com', RESET_DELIVERY_MODE: 'console' },
    { HOST: '0.0.0.0', RESET_DELIVERY_MODE: 'console' }
  ]) assert.throws(() => readConfig(env));
  assert.equal(readConfig({ APP_ORIGIN: 'https://example.com' }).secureCookies, true);
});
