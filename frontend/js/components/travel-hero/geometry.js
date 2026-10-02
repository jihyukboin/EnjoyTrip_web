import { createRandom, lonLatToVector, radians } from './math.js';
import { routePosition } from './routes.js';
import { isLand } from './world-map.js';

/*
 * 점 구름 생성.
 * 모든 점은 aPos(3) + aSeed(4) 로 구성한다. aSeed.xyz는 점마다 고정된 난수, aSeed.w는 밝기 가중치
 * (항로는 진행도 t)다.
 */

export const FLOATS_PER_POINT = 7;
export const GLOBE_STEP = radians(1.7);
export const PLANE_STEP = 0.036;
export const ROUTE_SPACING = 0.02;
const OCEAN_DENSITY = 0.3;
const RING_POINTS = 18;

function pushPoint(values, random, x, y, z, weight) {
  values.push(x, y, z, random(), random(), random(), weight);
}

/** 위도 줄마다 같은 간격으로 점을 놓아 구 표면을 고르게 채운다. 육지는 진하게, 바다는 드문드문. */
export function createGlobePoints() {
  const random = createRandom(20261002);
  const stepDegrees = (GLOBE_STEP * 180) / Math.PI;
  const land = [];
  const ocean = [];

  for (let lat = -90 + stepDegrees / 2; lat < 90; lat += stepDegrees) {
    const count = Math.max(1, Math.round((360 * Math.cos(radians(lat))) / stepDegrees));
    for (let index = 0; index < count; index += 1) {
      const lon = -180 + ((index + 0.5) * 360) / count;
      const [x, y, z] = lonLatToVector(lon, lat);
      if (isLand(lon, lat)) pushPoint(land, random, x, y, z, 0.75 + 0.25 * random());
      else if (random() < OCEAN_DENSITY) pushPoint(ocean, random, x, y, z, 0.12);
    }
  }

  return { land: new Float32Array(land), ocean: new Float32Array(ocean) };
}

/** 위에서 본 여객기 실루엣. x가 기수 방향, y가 날개 방향이며 -0.5~0.5 범위다. */
function planeWeight(x, y) {
  const span = Math.abs(y);

  // 동체: 둥근 기수와 가늘어지는 꼬리
  if (x >= -0.46 && x <= 0.46) {
    let half = 0.052;
    if (x > 0.3) half *= Math.sqrt(Math.max(0, 1 - ((x - 0.3) / 0.16) ** 2));
    else if (x < -0.28) half *= 1 - ((-0.28 - x) / 0.18) * 0.55;
    if (span <= half) return 1;
  }

  // 엔진
  if (Math.abs(span - 0.17) <= 0.028 && x >= 0 && x <= 0.13) return 1;

  // 뒤로 젖혀진 주날개
  if (span <= 0.47) {
    const k = span / 0.47;
    const lead = 0.1 - 0.26 * k;
    if (x <= lead && x >= lead - (0.19 - 0.12 * k)) return 0.9;
  }

  // 수평 꼬리날개
  if (span <= 0.18) {
    const k = span / 0.18;
    const lead = -0.3 - 0.09 * k;
    if (x <= lead && x >= lead - (0.1 - 0.05 * k)) return 0.9;
  }

  return 0;
}

export function createPlanePoints() {
  const random = createRandom(7471);
  const values = [];
  // 정수 인덱스로 원점 대칭 격자를 만들어 좌우 날개가 똑같이 찍히게 한다
  const half = Math.floor(0.5 / PLANE_STEP);
  for (let row = -half; row <= half; row += 1) {
    for (let column = -half; column <= half; column += 1) {
      const x = column * PLANE_STEP;
      const y = row * PLANE_STEP;
      const weight = planeWeight(x, y);
      if (weight > 0) pushPoint(values, random, x, y, 0, weight);
    }
  }
  return new Float32Array(values);
}

/** 도시 표식과 이착륙 파문에 쓰는 반지름 1 원. */
export function createRingPoints() {
  const random = createRandom(1004);
  const values = [];
  for (let index = 0; index < RING_POINTS; index += 1) {
    const angle = (index / RING_POINTS) * Math.PI * 2;
    pushPoint(values, random, Math.cos(angle), Math.sin(angle), 0, 1);
  }
  return new Float32Array(values);
}

/** 한 구간의 점선 항로. aSeed.w에 진행도 t를 담아 비행기가 지나간 부분만 밝힌다. */
export function createRoutePoints(leg) {
  const random = createRandom(Math.round(leg.angle * 1e6));
  const count = Math.max(8, Math.ceil(leg.angle / ROUTE_SPACING));
  const values = [];
  for (let index = 0; index <= count; index += 1) {
    const t = index / count;
    const [x, y, z] = routePosition(leg, t);
    pushPoint(values, random, x, y, z, t);
  }
  return new Float32Array(values);
}
