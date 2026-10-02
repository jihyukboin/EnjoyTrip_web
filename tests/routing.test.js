import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../backend/db/database.js';
import { createRoutingService } from '../backend/flights/routing.js';
import { createRoutingQuota, ROUTING_LIMITS } from '../backend/flights/routing-quota.js';

const itinerary = { start: { name: '출발', lng: 127, lat: 37 }, end: { name: '도착', lng: 128, lat: 38 }, waypoints: [{ name: '경유', lng: 127.5, lat: 37.5 }] };
const path = [[127, 37], [127.5, 37.5]];
test('교통수단별 요청과 경유 순서·좌표·거리·시간을 정규화한다', async t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const calls = [];
  const service = createRoutingService({ db, key: 'server-only-key', fetcher: async (url, options) => {
    const request = new URL(url); calls.push(request);
    assert.equal(options.headers.Authorization, 'KakaoAK server-only-key');
    assert.ok(!url.includes('server-only-key'));
    const data = request.pathname.endsWith('directions') ? { routes: [{ result_code: 0, summary: { distance: 100, duration: 20 }, sections: [{ roads: [{ vertexes: path.flat() }] }] }] }
      : request.pathname.endsWith('walk') ? { status: 'OK', route: { properties: { totalDistance: 200, totalTime: 120 }, legs: [{ steps: [{ path: { points: path } }] }] } }
      : { status: 'OK', routes: [600, 300].map(time => ({ properties: { totalDistance: 400, totalTime: time }, steps: [{ path: { points: path } }] })) };
    return Response.json(data);
  } });
  const results = await service.calculateAll(itinerary);
  assert.deepEqual(results.map(r => r.status), ['ready', 'ready', 'ready']);
  assert.equal(calls.find(c => c.pathname.endsWith('walk')).searchParams.get('via_x'), '127.5');
  assert.equal(calls.find(c => c.pathname.endsWith('directions')).searchParams.get('waypoints'), '127.5,37.5');
  const transit = calls.filter(c => c.pathname.endsWith('publictraffic'));
  assert.equal(transit.length, 2);
  assert.equal(transit[0].searchParams.get('end_x'), '127.5');
  assert.equal(transit[1].searchParams.get('start_x'), '127.5');
  assert.equal(results[2].durationSeconds, 600);
  assert.equal(results[2].distanceMeters, 800);
  assert.deepEqual(results[0].lines, [path]);
  assert.equal(db.prepare("SELECT calls FROM routing_usage WHERE mode='transit'").get().calls, 2);
});
test('호출 한도는 정확히 80%에서 차단하고 한국 날짜 변경 후 초기화한다', t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  let time = Date.parse('2026-10-02T14:59:59Z');
  const reserve = createRoutingQuota({ db, key: 'test', now: () => time });
  for (let i = 0; i < ROUTING_LIMITS.walk; i++) reserve('walk');
  assert.throws(() => reserve('walk'), /QUOTA_LIMIT/);
  assert.equal(db.prepare('SELECT calls FROM routing_usage').get().calls, 800);
  time += 1000; reserve('walk');
  assert.equal(db.prepare("SELECT calls FROM routing_usage WHERE day='2026-10-03'").get().calls, 1);
});
test('미설정·권한·통신·경로 없음은 안전한 오류로 반환하고 한도 도달 시 외부 호출을 막는다', async t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  let calls = 0;
  const fetcher = async () => { calls++; return new Response('', { status: 403 }); };
  assert.equal((await createRoutingService({ db, fetcher }).calculate('walk', itinerary)).code, 'NOT_CONFIGURED');
  assert.equal(calls, 0);
  const service = createRoutingService({ db, key: 'test', fetcher });
  assert.equal((await service.calculate('walk', itinerary)).code, 'PERMISSION_REQUIRED');
  db.prepare("UPDATE routing_usage SET calls=800 WHERE mode='walk'").run();
  assert.equal((await service.calculate('walk', itinerary)).code, 'QUOTA_LIMIT');
  assert.equal(calls, 1);
  assert.equal((await createRoutingService({ db, key: 'test', fetcher: async () => Response.json({ status: 'NO_RESULTS' }) }).calculate('transit', itinerary)).code, 'NO_ROUTE');
  const failed = await createRoutingService({ db, key: 'test', fetcher: async () => { throw new Error('sensitive-key'); } }).calculate('car', itinerary);
  assert.equal(failed.code, 'UPSTREAM_ERROR'); assert.ok(!JSON.stringify(failed).includes('sensitive-key'));
});
