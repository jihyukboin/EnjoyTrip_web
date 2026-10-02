import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advancePosition, bearingDegrees, distanceMeters, routeDistanceMeters } from '../frontend/js/components/cockpit/navigation.js';
import { createJourneyState, OFF_ROUTE_METERS } from '../frontend/js/components/cockpit/journey.js';

const start = { lat: 37.5, lng: 127 };
const end = { lat: 37.5, lng: 128 };

test('직선 경로의 구간 안·밖 거리와 같은 출발·도착 지점을 계산한다', () => {
  assert.ok(routeDistanceMeters(start, start, end) < 1);
  const middle = advancePosition(start, bearingDegrees(start, end), distanceMeters(start, end) / 1852, 1800);
  assert.ok(routeDistanceMeters(middle, start, end) < 1);
  const off = advancePosition(middle, 0, 20 / 1.852, 3600);
  assert.ok(routeDistanceMeters(off, start, end) > 19000);
  const before = advancePosition(start, 270, 20 / 1.852, 3600);
  assert.ok(Math.abs(routeDistanceMeters(before, start, end) - distanceMeters(before, start)) < 1);
  const after = advancePosition(end, bearingDegrees(start, end), 20 / 1.852, 3600);
  assert.ok(Math.abs(routeDistanceMeters(after, start, end) - distanceMeters(after, end)) < 1);
  assert.equal(routeDistanceMeters(end, start, start), distanceMeters(end, start));
});

test('활성 상태에서만 3초 카운트한다', () => {
  const state = createJourneyState({ start, end });
  assert.equal(state.countdown(), 3);
  state.tick(10, false);
  assert.equal(state.countdown(), 3);
  state.tick(1, true);
  assert.equal(state.countdown(), 2);
  state.tick(1, true);
  assert.equal(state.countdown(), 1);
  assert.equal(state.started(), false);
  state.tick(1, true);
  assert.equal(state.started(), true);
  assert.equal(state.countdown(), 0);
});

test('10km 이탈 경고는 복귀하면 해제되고 도착해도 비행 상태를 유지한다', () => {
  const state = createJourneyState({ start, end });
  state.tick(3, true);
  assert.equal(OFF_ROUTE_METERS, 10000);
  assert.equal(state.inspect(advancePosition(start, 0, 9.99 / 1.852, 3600)).offRoute, false);
  assert.equal(state.inspect(advancePosition(start, 0, 10.01 / 1.852, 3600)).offRoute, true);
  assert.equal(state.inspect(start).offRoute, false);
  assert.deepEqual(state.inspect(end), { distance: 0, offRoute: false });
  assert.equal(state.started(), true);
});
