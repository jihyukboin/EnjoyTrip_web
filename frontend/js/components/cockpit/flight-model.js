// 계기를 움직이기 위한 간단한 예시 비행 모델(MOCK). 지도는 움직이지 않는다
const RAD = Math.PI / 180;
const MAX_BANK = 30;
const MAX_PITCH = 8;
const THRUST_RATE = 0.35;
const MIN_SPEED = 90;
const SPEED_RANGE = 220;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// 프레임 간격과 무관하게 목표 값으로 부드럽게 다가간다
const approach = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

export function createFlightModel(initial) {
  const state = { ...initial, turnRate: 0, verticalSpeed: 0 };

  function step(dt, { roll, pitch, throttle }) {
    state.bank = approach(state.bank, roll * MAX_BANK, 2.2, dt);
    state.pitch = approach(state.pitch, pitch * MAX_PITCH, 2, dt);
    state.thrust = clamp(state.thrust + throttle * THRUST_RATE * dt, 0, 1);
    state.speed = approach(state.speed, MIN_SPEED + state.thrust * SPEED_RANGE - state.pitch * 4, 0.5, dt);
    // 선회율(도/초) = 1091 × tan(경사각) / 속도(노트)
    state.turnRate = 1091 * Math.tan(state.bank * RAD) / Math.max(state.speed, 60);
    state.heading = (state.heading + state.turnRate * dt + 360) % 360;
    // 상승률(피트/분) ≈ 속도(노트) × 101.27 × sin(기수각)
    state.verticalSpeed = state.speed * 101.27 * Math.sin(state.pitch * RAD);
    state.altitude = clamp(state.altitude + state.verticalSpeed / 60 * dt, 500, 12000);
  }

  return { state, step };
}
