import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNearbyService } from '../backend/nearby/service.js';

test('공공데이터 위치 조회는 현재 좌표 반경 2km를 요청하고 세 분류를 가까운 순으로 변환한다', async () => {
  const calls = [];
  const data = [
    { title: '관광지', contenttypeid: '12', mapx: '126.98', mapy: '37.566826' },
    { title: '음식점', contenttypeid: '39', mapx: '126.9786567', mapy: '37.5669' },
    { title: '먼 숙소', contenttypeid: '32', mapx: '127.2', mapy: '37.566826' }
  ];
  const nearby = createNearbyService({ key: 'encoded%2Bkey', now: () => 1000,
    fetchImpl: async url => {
      calls.push(url);
      return { ok: true, json: async () => ({ response: { header: { resultCode: '0000' },
        body: { items: { item: data } } } }) };
    } });
  const position = { lat: 37.566826, lng: 126.9786567 };
  const places = await nearby(position);
  assert.equal(calls.length, 1);
  for (const url of calls) {
    assert.equal(url.searchParams.get('serviceKey'), 'encoded+key');
    assert.equal(url.searchParams.get('radius'), '2000');
    assert.equal(url.searchParams.get('numOfRows'), '500');
    assert.equal(url.searchParams.get('mapX'), String(position.lng));
    assert.equal(url.searchParams.get('mapY'), String(position.lat));
  }
  assert.deepEqual(places.map(place => place.category), ['FD6', 'AT4']);
  assert.ok(places[0].distance < places[1].distance);
  assert.ok(places[1].bearing > 80 && places[1].bearing < 100);
  assert.equal((await nearby(position)).length, 2);
  assert.equal(calls.length, 1, '가까운 중복 요청에는 캐시를 사용한다');
  assert.ok(!JSON.stringify(places).includes('encoded'));
});
