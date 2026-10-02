import { ApiError } from './api-response.js';

export function createRateLimiter({ now = Date.now, limit = 20, windowMs = 600_000 } = {}) {
  const clients = new Map();
  return (request) => {
    const time = now();
    for (const [key, entry] of clients) if (entry.until <= time) clients.delete(key);
    // The peer address is trusted; unconfigured proxy headers are not.
    const key = request.socket.remoteAddress;
    let entry = clients.get(key);
    if (!entry) {
      if (clients.size >= 10_000) throw new ApiError(429, 'RATE_LIMITED', '잠시 후 다시 시도해주세요.', undefined, { 'Retry-After': '60' });
      entry = { count: 0, until: time + windowMs };
      clients.set(key, entry);
    }
    if (++entry.count > limit) {
      throw new ApiError(429, 'RATE_LIMITED', '잠시 후 다시 시도해주세요.', undefined,
        { 'Retry-After': String(Math.max(1, Math.ceil((entry.until - time) / 1000))) });
    }
  };
}
