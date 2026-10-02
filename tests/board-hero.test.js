import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBodyPoints, createLimbPoints } from '../frontend/js/components/board-hero/geometry.js';
import { FLOOR_Y, PEOPLE_COUNT, personPose, walkedDistance } from '../frontend/js/components/board-hero/ring.js';
import { CYCLE_DISTANCE, HIP_HEIGHT, LEG_LENGTH, walkPose } from '../frontend/js/components/board-hero/walk.js';
import { FLOATS_PER_POINT } from '../frontend/js/components/travel-hero/geometry.js';

test('사람 몸 점은 좌우 대칭이고 머리가 키 안에 들어온다', () => {
  const points = createBodyPoints();
  assert.equal(points.length % FLOATS_PER_POINT, 0);

  const keys = new Set();
  let maxY = 0;
  for (let i = 0; i < points.length; i += FLOATS_PER_POINT) {
    keys.add(`${points[i].toFixed(3)},${points[i + 1].toFixed(3)}`);
    maxY = Math.max(maxY, points[i + 1]);
  }
  assert.ok(keys.size > 60);
  for (const key of keys) {
    const [x, y] = key.split(',');
    assert.ok(keys.has(`${(-Number(x) || 0).toFixed(3)},${y}`), key);
  }
  assert.ok(maxY > 0.9 && maxY <= 1);

  const limb = createLimbPoints();
  assert.equal(limb[0], 0);
  assert.equal(limb.at(-FLOATS_PER_POINT), 1);
});

test('사람들은 바닥 위 같은 원에 고르게 서고 원의 접선 방향으로 걷는다', () => {
  for (const angle of [0, 1.3, -2]) {
    const step = 1e-6;
    for (let index = 0; index < PEOPLE_COUNT; index += 1) {
      const { feet, tangent } = personPose(index, angle);
      assert.equal(feet[1], FLOOR_Y);
      assert.ok(Math.abs(Math.hypot(feet[0], feet[2]) - 1) < 1e-12);

      // 회전각이 늘면 발이 tangent 방향으로 움직인다
      const ahead = personPose(index, angle + step).feet;
      const moved = [(ahead[0] - feet[0]) / step, (ahead[2] - feet[2]) / step];
      assert.ok(Math.abs(moved[0] - tangent[0]) < 1e-5 && Math.abs(moved[1] - tangent[2]) < 1e-5);

      const next = personPose((index + 1) % PEOPLE_COUNT, angle).feet;
      const gap = Math.hypot(next[0] - feet[0], next[2] - feet[2]);
      assert.ok(Math.abs(gap - 2 * Math.sin(Math.PI / PEOPLE_COUNT)) < 1e-12);
    }
  }
});

test('걷는 동안 두 발은 항상 바닥에 닿고 한 주기마다 같은 자세로 돌아온다', () => {
  for (let distance = -3; distance <= 3; distance += 0.07) {
    const { swing, drop } = walkPose(distance);
    for (const side of [-1, 1]) {
      const footY = HIP_HEIGHT - drop - LEG_LENGTH * Math.cos(side * swing);
      assert.ok(Math.abs(footY) < 1e-12);
    }
    assert.ok(Math.abs(walkPose(distance + CYCLE_DISTANCE).swing - swing) < 1e-9);
  }
  assert.ok(walkedDistance(1) > walkedDistance(0));
});
