import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    // Transactions are synchronous; never hold a SQLite lock across an await.
    const result = action();
    if (result && typeof result.then === 'function') throw new Error('Async transaction callbacks are not supported.');
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const readSql = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

// members 재생성 중 DROP TABLE이 세션·게시글을 CASCADE 삭제하지 않도록 외래 키를 잠시 끈다.
// PRAGMA foreign_keys는 트랜잭션 안에서 바뀌지 않으므로 트랜잭션 밖에서 설정한다.
function dropEmail(db) {
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    transaction(db, () => {
      db.exec(readSql('drop-email.sql'));
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed.');
      db.exec('PRAGMA user_version = 4');
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys = ON');
    if (db.prepare('PRAGMA foreign_keys').get().foreign_keys !== 1) throw new Error('Foreign keys are required.');
    let version = db.prepare('PRAGMA user_version').get().user_version;
    if (version === 0) {
      transaction(db, () => {
        db.exec(readSql('schema.sql'));
        db.exec(readSql('posts-schema.sql'));
        db.exec(readSql('notices-schema.sql'));
        db.exec('PRAGMA user_version = 6');
      });
      version = 6;
    }
    if (version === 1) {
      transaction(db, () => {
        db.exec("ALTER TABLE members ADD COLUMN username TEXT NOT NULL DEFAULT ''");
        db.exec("UPDATE members SET username = 'member' || id");
        db.exec('CREATE UNIQUE INDEX members_username_idx ON members(username)');
        db.exec('PRAGMA user_version = 2');
      });
      version = 2;
    }
    if (version === 2) {
      transaction(db, () => {
        db.exec(readSql('posts-schema.sql'));
        db.exec('PRAGMA user_version = 3');
      });
      version = 3;
    }
    if (version === 3) {
      dropEmail(db);
      version = 4;
    }
    if (version === 4) {
      transaction(db, () => {
        db.exec('ALTER TABLE members ADD COLUMN isAdmin INTEGER NOT NULL DEFAULT 0 CHECK (isAdmin IN (0, 1))');
        db.exec('PRAGMA user_version = 5');
      });
      version = 5;
    }
    if (version === 5) {
      transaction(db, () => {
        db.exec(readSql('notices-schema.sql'));
        db.exec('PRAGMA user_version = 6');
      });
      version = 6;
    }
    if (version === 6) {
      transaction(db, () => {
        db.exec(readSql('posts-route.sql'));
        db.exec('PRAGMA user_version = 7');
      });
      version = 7;
    }
    if (version !== 7) throw new Error('Unsupported database schema version.');
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
