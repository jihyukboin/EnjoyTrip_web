/** 히어로 캔버스에서 쓰는 벡터·회전·난수 계산. */

export const radians = (degrees) => (degrees * Math.PI) / 180;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 경도·위도를 단위 구 좌표로 바꾼다. 경도 0°가 화면(+z)을 향한다. */
export function lonLatToVector(lon, lat) {
  const lambda = radians(lon);
  const phi = radians(lat);
  return [Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda)];
}

export const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];

export function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

export const angleBetween = (a, b) => Math.acos(clamp(dot(a, b), -1, 1));

/** 두 단위 벡터 사이 대원(great circle) 위의 점. */
export function slerp(a, b, angle, t) {
  const sine = Math.sin(angle);
  const wa = Math.sin((1 - t) * angle) / sine;
  const wb = Math.sin(t * angle) / sine;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
}

/** Rz(roll) · Rx(tilt) · Ry(yaw) 를 WebGL 열 우선 순서로 돌려준다. */
export function rotationMatrix(yaw, tilt, roll) {
  const [cy, sy] = [Math.cos(yaw), Math.sin(yaw)];
  const [cx, sx] = [Math.cos(tilt), Math.sin(tilt)];
  const [cz, sz] = [Math.cos(roll), Math.sin(roll)];

  // 행 우선 Rx · Ry
  const a = [cy, 0, sy, sx * sy, cx, -sx * cy, -cx * sy, sx, cx * cy];
  // 행 우선 Rz · (Rx · Ry)
  const m = [
    cz * a[0] - sz * a[3], cz * a[1] - sz * a[4], cz * a[2] - sz * a[5],
    sz * a[0] + cz * a[3], sz * a[1] + cz * a[4], sz * a[2] + cz * a[5],
    a[6], a[7], a[8]
  ];

  return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
}

/** 매번 같은 점 배치가 나오도록 시드 고정 난수를 쓴다. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
