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

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  try {
    db.exec('PRAGMA foreign_keys = ON');
    if (db.prepare('PRAGMA foreign_keys').get().foreign_keys !== 1) throw new Error('Foreign keys are required.');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version === 0) {
      transaction(db, () => {
        db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
        db.exec('PRAGMA user_version = 1');
      });
    } else if (version !== 1) {
      throw new Error('Unsupported database schema version.');
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
