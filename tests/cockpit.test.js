import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockPosition, formatDistance, formatHeading } from '../frontend/js/components/cockpit/format.js';
import { createFlightModel } from '../frontend/js/components/cockpit/flight-model.js';

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
