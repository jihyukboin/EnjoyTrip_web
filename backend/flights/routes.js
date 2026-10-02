import { ApiError, sendJson } from '../http/api-response.js';
import { validateFlight } from './validation.js';
import { validateEmpty } from '../http/json-body.js';

export function createFlightRoutes({ db, auth, posts, now }) {
  const read = row => ({ id: row.id, postId: row.post_id, createdAt: new Date(row.created_at).toISOString(),
    ...JSON.parse(row.itinerary) });
  const mutation = (validate, action) => ({ limited: true, authorize: token => auth.authenticate(token), validate, action });
  return new Map([
    ['/api/posts/:id/flight-records', new Map([
      ['GET', { action(body, token, response, request, { id }) {
        const member = auth.authenticate(token);
        posts.get(id);
        const records = db.prepare(`SELECT f.*, m.username, m.name AS player_name FROM flight_records f
          JOIN members m ON m.id = f.member_id
          WHERE f.post_id = ? AND (? = 1 OR f.member_id = ?) ORDER BY f.id DESC LIMIT 20`)
          .all(id, member.isAdmin, member.id).map(row => ({ ...read(row), player: { id: row.username, name: row.player_name } }));
        sendJson(response, 200, { data: { records } });
      } }],
      ['POST', mutation(validateFlight, (body, token, response, request, { id }) => {
        const member = auth.authenticate(token);
        const post = posts.get(id);
        const found = db.prepare('SELECT * FROM flight_records WHERE member_id = ? AND run_id = ?').get(member.id, body.runId);
        if (found) {
          if (String(found.post_id) !== String(id)) throw new ApiError(409, 'FLIGHT_RUN_CONFLICT', '이미 다른 항공권에 저장된 비행입니다.');
          return sendJson(response, 200, { data: { record: read(found) } });
        }
        const itinerary = { ...body, start: { ...body.start, name: post.origin }, end: { ...body.end, name: post.destination } };
        const result = db.prepare('INSERT INTO flight_records(post_id, member_id, run_id, itinerary, routes, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(member_id, run_id) DO NOTHING')
          .run(id, member.id, body.runId, JSON.stringify(itinerary), '[]', now());
        const row = db.prepare('SELECT * FROM flight_records WHERE member_id = ? AND run_id = ?').get(member.id, body.runId);
        if (!result.changes) return sendJson(response, 200, { data: { record: read(row) } });
        sendJson(response, 201, { data: { record: read(row) } });
      })]
    ])],
    ['/api/posts/:id/flight-records/:recordId', new Map([
      ['DELETE', mutation(validateEmpty, (body, token, response, request, { id, recordId }) => {
        const member = auth.authenticate(token);
        const record = db.prepare('SELECT member_id FROM flight_records WHERE id = ? AND post_id = ?').get(recordId, id);
        if (!record) throw new ApiError(404, 'FLIGHT_RECORD_NOT_FOUND', '플레이 기록을 찾을 수 없습니다.');
        if (record.member_id !== member.id && member.isAdmin !== 1) {
          throw new ApiError(403, 'FORBIDDEN', '이 경로를 플레이한 사용자 또는 관리자만 삭제할 수 있습니다.');
        }
        db.prepare('DELETE FROM flight_records WHERE id = ? AND post_id = ?').run(recordId, id);
        sendJson(response, 204);
      })]
    ])]
  ]);
}
