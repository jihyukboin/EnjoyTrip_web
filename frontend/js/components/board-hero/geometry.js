import { createRandom } from '../travel-hero/math.js';

/*
 * 사람 점 구름. 홈 히어로와 같은 aPos(3) + aSeed(4) 형식이다.
 * - 몸: 머리와 몸통. 단위는 사람 키이며 x는 좌우, y는 바닥(0)~머리(1)다.
 * - 팔다리: 길이 1의 점선. 매 프레임 어깨→손, 엉덩이→발 선분에 맞춰 늘려 그린다.
 */

export const PERSON_STEP = 0.036;
export const SHOULDER = [0.1, 0.7];
export const HIP_OFFSET = 0.04;
export const HAND_HEIGHT = 0.52;
const LIMB_POINTS = 14;

export function createBodyPoints() {
  const random = createRandom(2026);
  const values = [];
  const half = Math.ceil(0.15 / PERSON_STEP);
  const rows = Math.ceil(1 / PERSON_STEP);
  // 정수 인덱스로 좌우 대칭 격자를 만든다
  for (let row = 0; row <= rows; row += 1) {
    for (let column = -half; column <= half; column += 1) {
      const x = Math.abs(column * PERSON_STEP);
      const y = row * PERSON_STEP;
      const isHead = Math.hypot(x, y - 0.885) <= 0.11;
      const isTorso = y >= 0.4 && y <= 0.74 && x <= 0.07 + (0.05 * (y - 0.4)) / 0.34;
      if (isHead || isTorso) values.push(column * PERSON_STEP, y, 0, random(), random(), random(), 1);
    }
  }
  return new Float32Array(values);
}

/** x가 선분 시작(0)~끝(1)인 점선. */
export function createLimbPoints() {
  const random = createRandom(1004);
  const values = [];
  for (let index = 0; index <= LIMB_POINTS; index += 1) {
    values.push(index / LIMB_POINTS, 0, 0, random(), random(), random(), 0.9);
  }
  return new Float32Array(values);
}
