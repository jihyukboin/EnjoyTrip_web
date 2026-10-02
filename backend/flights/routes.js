import { ApiError, sendJson } from '../http/api-response.js';
import { validateFlight } from './validation.js';

export function createFlightRoutes({ db, auth, posts, now }) {
  const read = row => ({ id: row.id, postId: row.post_id, createdAt: new Date(row.created_at).toISOString(),
    ...JSON.parse(row.itinerary) });
  const mutation = (validate, action) => ({ limited: true, authorize: token => auth.authenticate(token), validate, action });
  return new Map([
    ['/api/posts/:id/flight-records', new Map([
      ['GET', { action(body, token, response, request, { id }) {
        const member = auth.authenticate(token);
        posts.get(id);
        const records = db.prepare('SELECT * FROM flight_records WHERE post_id = ? AND member_id = ? ORDER BY id DESC LIMIT 20').all(id, member.id).map(read);
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
    ])]
  ]);
}
