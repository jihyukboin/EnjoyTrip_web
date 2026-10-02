import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../backend/db/database.js';
import { createApi } from '../backend/api.js';
import { createRequestHandler } from '../backend/app.js';
import { validateFlight } from '../backend/flights/validation.js';
import { createWaypoints } from '../frontend/js/components/cockpit/waypoints.js';
import { advancePosition } from '../frontend/js/components/cockpit/navigation.js';

const start = { name: '출발지', lat: 37.5, lng: 127 };
const end = { name: '도착지', lat: 37.6, lng: 127.1 };
const body = () => ({ runId: randomUUID(), start, end, waypoints: [{ name: '식당', lat: 37.51, lng: 127.01 }], flightSeconds: 30, distanceMeters: 3000 });

test('200m 안의 가장 가까운 미추가 장소만 선택하고 중복·최대 개수·제거를 처리한다', () => {
  const state = createWaypoints();
  const near = { ...advancePosition(start, 0, 199 / 1852, 3600), name: '가까운 곳' };
  const far = { ...advancePosition(start, 0, 201 / 1852, 3600), name: '먼 곳' };
  assert.equal(state.nearest(start, [far, near]).name, near.name);
  assert.equal(state.add(near), true);
  assert.equal(state.add(near), false);
  assert.equal(state.nearest(start, [near, far]), null);
  for (let i = 1; i <= 4; i++) assert.equal(state.add({ ...near, lat: near.lat + i * 0.001 }), true);
  assert.equal(state.add(far), false);
  state.remove(0);
  assert.equal(state.add(near), true);
});

test('비행 기록은 좌표·경유지·플레이 수치와 허용 필드만 받는다', () => {
  assert.equal(validateFlight(body()).waypoints.length, 1);
  for (const change of [{ waypoints: null }, { waypoints: [start, start] }, { start: { ...start, lat: 91 } },
    { runId: [randomUUID()] }, { flightSeconds: -1 }, { distanceMeters: '1' }, { memberId: 1 },
    { waypoints: Array.from({ length: 6 }, (_, i) => ({ ...start, lat: 37 + i / 100 })) }]) {
    assert.throws(() => validateFlight({ ...body(), ...change }), error => error.status === 400);
  }
});

test('항공권 기록은 로그인별로 저장·조회하고 같은 비행의 재저장을 중복하지 않는다', async t => {
  const db = openDatabase(':memory:');
  const config = { origin: '', secureCookies: false };
  const server = createServer(createRequestHandler({ apiHandler: createApi({ db, config }) }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  async function call(path, method = 'GET', value, cookie = '') {
    const response = await fetch(config.origin + path, { method, headers: {
      Cookie: cookie, Origin: config.origin, 'X-EnjoyTrip-Request': '1', 'Content-Type': 'application/json'
    }, ...(value ? { body: JSON.stringify(value) } : {}) });
    return { status: response.status, json: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function member(id) {
    assert.equal((await call('/api/members', 'POST', { id, name: id, password: 'password1' })).status, 201);
    return (await call('/api/auth/login', 'POST', { id, password: 'password1' })).cookie;
  }
  const first = await member('pilotone');
  const post = (await call('/api/posts', 'POST', { title: '여행', origin: start.name, destination: end.name }, first)).json.data.post;
  const path = `/api/posts/${post.id}/flight-records`;
  assert.equal((await call(path)).status, 401);
  assert.equal((await call(path, 'POST', body())).status, 401);
  const flight = body();
  const saved = await call(path, 'POST', flight, first);
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.json.data.record.waypoints, flight.waypoints);
  assert.equal((await call(path, 'POST', flight, first)).json.data.record.id, saved.json.data.record.id);
  assert.equal(db.prepare('SELECT count(*) AS n FROM flight_records').get().n, 1);
  const second = await member('pilottwo');
  assert.equal((await call(path, 'GET', undefined, second)).json.data.records.length, 0);
  assert.equal((await call(path, 'POST', body(), second)).status, 201);
  assert.equal((await call(path, 'GET', undefined, first)).json.data.records.length, 1);
  assert.equal((await call(`/api/posts/${post.id}`, 'DELETE', {}, first)).status, 204);
  assert.equal(db.prepare('SELECT count(*) AS n FROM flight_records').get().n, 0);
});
