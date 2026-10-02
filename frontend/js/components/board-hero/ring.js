/*
 * 손잡고 원을 그리며 걷는 사람들의 배치.
 * 바닥은 xz 평면이고 y가 위쪽이다. 발은 반지름 1 원 위에 놓이고 원의 접선 방향으로 걷는다.
 * 몸은 화면을 바라보도록 세우므로(scene.js) 여기서는 발 위치와 걷는 방향만 정한다.
 */

export const PEOPLE_COUNT = 16;
export const PERSON_HEIGHT = 0.3; // 원 반지름 대비 키
export const FLOOR_Y = -0.05; // 원이 문구를 가운데 두고 위아래로 고르게 보이도록 바닥 높이를 맞춘다

/** index번째 사람의 발 위치와 걷는 방향. angle은 원 전체 회전각이다. */
export function personPose(index, angle) {
  const theta = angle + (index / PEOPLE_COUNT) * Math.PI * 2;
  const sine = Math.sin(theta);
  const cosine = Math.cos(theta);
  return { feet: [sine, FLOOR_Y, cosine], tangent: [cosine, 0, -sine] };
}

/** 원 회전각 angle만큼 돌았을 때 걸은 거리(사람 키 단위). */
export const walkedDistance = (angle) => angle / PERSON_HEIGHT;
