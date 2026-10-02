import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FLOATS_PER_POINT,
  createGlobePoints,
  createPlanePoints,
  createRoutePoints
} from '../frontend/js/components/travel-hero/geometry.js';
import { FLIGHTS, createSchedule, flightStatus, planePose, routePosition } from '../frontend/js/components/travel-hero/routes.js';
import { isLand } from '../frontend/js/components/travel-hero/world-map.js';

const length = (v) => Math.hypot(...v);

test('세계 지도는 주요 도시를 육지로, 대양과 내해를 바다로 판정한다', () => {
  for (const [lon, lat] of [[126.98, 37.57], [2.35, 48.86], [-74.5, 40.9], [151, -33.7], [-47, -15], [20, 0]]) {
    assert.ok(isLand(lon, lat), `${lon}, ${lat}`);
  }
  for (const [lon, lat] of [[-150, 0], [-30, 30], [80, -20], [-85, 60], [34, 43], [51, 41]]) {
    assert.ok(!isLand(lon, lat), `${lon}, ${lat}`);
  }
});

test('지구본 점은 단위 구 위에 있고 육지 점이 바다 점보다 진하다', () => {
  const { land, ocean } = createGlobePoints();
  assert.equal(land.length % FLOATS_PER_POINT, 0);
  assert.equal(ocean.length % FLOATS_PER_POINT, 0);
  assert.ok(land.length / FLOATS_PER_POINT > 3000);

  for (const [points, minWeight, maxWeight] of [[land, 0.75, 1], [ocean, 0.12, 0.12]]) {
    for (let i = 0; i < points.length; i += FLOATS_PER_POINT) {
      assert.ok(Math.abs(length(points.subarray(i, i + 3)) - 1) < 1e-5);
      const weight = points[i + 6];
      assert.ok(weight >= minWeight - 1e-6 && weight <= maxWeight + 1e-6);
    }
  }
});

test('비행기 점은 날개가 좌우 대칭인 실루엣을 이룬다', () => {
  const points = createPlanePoints();
  const keys = new Set();
  for (let i = 0; i < points.length; i += FLOATS_PER_POINT) keys.add(`${points[i].toFixed(3)},${points[i + 1].toFixed(3)}`);
  assert.ok(keys.size > 60);
  for (const key of keys) {
    const [x, y] = key.split(',');
    assert.ok(keys.has(`${x},${(-Number(y)).toFixed(3)}`), key);
  }
});

test('항공편은 세 도시를 순환하고 항로는 지표면 위로 떠올랐다 내려앉는다', () => {
  for (const flight of FLIGHTS) {
    const schedule = createSchedule(flight);
    assert.deepEqual(schedule.legs.map((leg) => leg.from), flight.stops);
    assert.equal(schedule.legs.at(-1).to, flight.stops[0]);

    for (const leg of schedule.legs) {
      assert.ok(Math.abs(length(routePosition(leg, 0)) - 1) < 1e-9);
      assert.ok(Math.abs(length(routePosition(leg, 1)) - 1) < 1e-9);
      assert.ok(length(routePosition(leg, 0.5)) > 1.04);

      const route = createRoutePoints(leg);
      assert.equal(route[6], 0);
      assert.equal(route.at(-1), 1);

      const pose = planePose(leg, 0.5);
      assert.ok(Math.abs(length(pose.forward) - 1) < 1e-9);
      assert.ok(Math.abs(pose.forward.reduce((sum, value, index) => sum + value * pose.normal[index], 0)) < 1e-9);
    }

    const first = flightStatus(schedule, schedule.legs[1].departure - schedule.offset + 0.01);
    assert.equal(first.index, 1);
    assert.ok(first.flying > 0 && first.flying < 0.01);
    const wrapped = flightStatus(schedule, schedule.cycle * 3 + schedule.legs[1].departure - schedule.offset + 0.01);
    assert.equal(wrapped.index, 1);
  }
});
