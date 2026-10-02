import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockPosition, formatDistance, formatHeading } from '../frontend/js/components/cockpit/format.js';
import { createFlightModel } from '../frontend/js/components/cockpit/flight-model.js';
import { advancePosition, DEPARTURE } from '../frontend/js/components/cockpit/navigation.js';

test('조종석 방위는 세 자리로, 장소 방향은 기수 기준 시계 방향으로 표시한다', () => {
  assert.equal(formatHeading(0), '360');
  assert.equal(formatHeading(7.4), '007');
  assert.equal(formatHeading(-90), '270');
  assert.equal(clockPosition(90, 90), 12);
  assert.equal(clockPosition(150, 90), 2);
  assert.equal(clockPosition(0, 90), 9);
  assert.equal(formatDistance(0.3), '300m');
  assert.equal(formatDistance(1.55), '1.6km');
});

test('예시 비행 모델은 핸들로 선회하고 페달로 추력을 0~100% 안에서 바꾼다', () => {
  const model = createFlightModel({ heading: 90, bank: 0, pitch: 0, thrust: 0.5, speed: 200, altitude: 3000 });
  for (let index = 0; index < 60; index += 1) model.step(0.05, { roll: 1, pitch: 0, throttle: 1 });
  assert.ok(model.state.bank > 20, '오른쪽으로 기운다');
  assert.ok(model.state.heading > 90, '오른쪽으로 선회한다');
  assert.ok(model.state.thrust > 0.5 && model.state.thrust <= 1);

  for (let index = 0; index < 200; index += 1) model.step(0.05, { roll: -1, pitch: 0, throttle: -1 });
  assert.ok(model.state.bank < -20, '왼쪽으로 기운다');
  assert.equal(model.state.thrust, 0);
});



test('지도 이동은 노트를 거리로 변환하고 북·동·남·서 방위를 따른다', () => {
  const origin = { lat: 0, lng: 0 };
  const north = advancePosition(origin, 0, 60, 60);
  // 60kt로 1분간 비행하면 1해리(1,852m)를 이동한다.
  assert.ok(Math.abs(north.lat * Math.PI / 180 * 6371008.8 - 1852) < 0.001);
  assert.ok(Math.abs(north.lng) < 1e-10);
  const east = advancePosition(origin, 90, 60, 60);
  assert.ok(east.lng > 0 && Math.abs(east.lat) < 1e-10);
  assert.ok(advancePosition(origin, 180, 60, 60).lat < 0);
  assert.ok(advancePosition(origin, 270, 60, 60).lng < 0);
  assert.deepEqual(advancePosition(origin, 90, 0, 60), origin);
  assert.ok(advancePosition({ lat: 0, lng: 179.999 }, 90, 600, 60).lng < 0);
});

test('비행 모델은 좌표를 이동시키며 가속·선회와 프레임 간격을 반영한다', () => {
  const initial = { position: { lat: 0, lng: 0 }, heading: 90, bank: 0, pitch: 0, thrust: 0.5, speed: 200, altitude: 3000 };
  const idle = { roll: 0, pitch: 0, throttle: 0 };
  const slow = createFlightModel(initial);
  const fast = createFlightModel(initial);
  const turn = createFlightModel(initial);
  const fine = createFlightModel(initial);
  for (let i = 0; i < 600; i++) {
    slow.step(1 / 60, { ...idle, throttle: -1 });
    fast.step(1 / 60, { ...idle, throttle: 1 });
    turn.step(1 / 60, { ...idle, roll: 1 });
  }
  for (let i = 0; i < 1200; i++) fine.step(1 / 120, { ...idle, throttle: 1 });
  assert.ok(fast.state.position.lng > slow.state.position.lng * 1.5);
  assert.ok(turn.state.position.lat < 0, '오른쪽 선회 시 동쪽에서 남쪽으로 이동한다');
  assert.ok(Math.abs(fine.state.position.lng - fast.state.position.lng) * 111195 < 1, '60Hz와 120Hz의 10초 비행 거리 차이는 1m 미만이다');
  assert.deepEqual(initial.position, { lat: 0, lng: 0 }, '초기 좌표를 변경하지 않는다');
  assert.deepEqual(createFlightModel({ ...initial, position: undefined }).state.position, DEPARTURE);
});
