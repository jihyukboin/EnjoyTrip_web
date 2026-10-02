import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nearbyPlaces, shouldRefreshNearby } from '../frontend/js/components/cockpit/nearby-state.js';
import { advancePosition } from '../frontend/js/components/cockpit/navigation.js';

const origin = { lat: 37.5, lng: 127 };
const north = km => advancePosition(origin, 0, km / 1.852, 3600);

test('이동한 위치로 거리·방향·가까운 순서를 계산하고 2km 밖 장소를 제거한다', () => {
  const places = [
    { ...north(0.2), name: 'A', category: 'AT4' },
    { ...north(1.8), name: 'B', category: 'FD6' }
  ];
  const first = nearbyPlaces(places, origin);
  assert.deepEqual(first.map(place => place.name), ['A', 'B']);
  const moved = nearbyPlaces(places, north(2.3));
  assert.deepEqual(moved.map(place => place.name), ['B']);
  assert.ok(Math.abs(moved[0].distance - 0.5) < 0.01);
  assert.ok(Math.abs(moved[0].bearing - 180) < 1);
  assert.equal(nearbyPlaces(places, origin, 'AD5').length, 0);
});

test('첫 조회, 이동 갱신, 정지 갱신, 실패 후 재시도를 구분한다', () => {
  const input = { position: north(0.8), lastPosition: origin, elapsed: 7999, failed: false };
  assert.equal(shouldRefreshNearby({ ...input, lastPosition: undefined }), true);
  assert.equal(shouldRefreshNearby(input), false);
  assert.equal(shouldRefreshNearby({ ...input, elapsed: 8000 }), true);
  assert.equal(shouldRefreshNearby({ ...input, position: origin, elapsed: 8000 }), false);
  assert.equal(shouldRefreshNearby({ ...input, position: origin, elapsed: 300000 }), true);
  assert.equal(shouldRefreshNearby({ ...input, position: origin, elapsed: 8000, failed: true }), true);
});
