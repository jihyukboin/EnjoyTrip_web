import { createHash } from 'node:crypto';
import { transaction } from '../db/database.js';

export const ROUTING_LIMITS = { walk: 800, car: 8000, transit: 800 };
export function createRoutingQuota({ db, key, now = Date.now }) {
  const hash = createHash('sha256').update(key).digest('hex');
  return mode => transaction(db, () => {
    const day = new Date(now() + 9 * 3600000).toISOString().slice(0, 10);
    const row = db.prepare('SELECT calls FROM routing_usage WHERE day = ? AND key_hash = ? AND mode = ?').get(day, hash, mode);
    if ((row?.calls ?? 0) >= ROUTING_LIMITS[mode]) throw new Error('QUOTA_LIMIT');
    // Reserve before sending; failed requests also count conservatively.
    db.prepare('INSERT INTO routing_usage(day, key_hash, mode, calls) VALUES (?, ?, ?, 1) ON CONFLICT(day, key_hash, mode) DO UPDATE SET calls = calls + 1').run(day, hash, mode);
  });
}
