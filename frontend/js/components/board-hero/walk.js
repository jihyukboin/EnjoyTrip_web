/*
 * 걷기 동작. 두 다리를 앞뒤로 엇갈려 흔들고, 보폭이 벌어진 만큼 몸을 내려 발이 바닥에 닿게 한다.
 * 단위는 사람 키다.
 */

export const HIP_HEIGHT = 0.42;
export const LEG_LENGTH = HIP_HEIGHT; // 다리를 모으면 발끝이 바닥에 닿는다
const STRIDE_ANGLE = 0.38;

// 두 걸음(한 주기) 동안 나아가는 거리. 디딘 발이 미끄러지지 않도록 걷는 속도와 다리 흔들림을 맞춘다
export const CYCLE_DISTANCE = 4 * LEG_LENGTH * Math.sin(STRIDE_ANGLE);

/** 걸은 거리에서 다리 각도(swing)와 몸이 내려간 높이(drop). */
export function walkPose(distance) {
  const swing = STRIDE_ANGLE * Math.sin((distance / CYCLE_DISTANCE) * Math.PI * 2);
  return { swing, drop: LEG_LENGTH * (1 - Math.cos(swing)) };
}
