// 조종석 화면(MOCK): 키 입력 → 예시 비행 모델 → 계기·HUD·주변 정보를 매 프레임 그린다
import { createAttitude } from './attitude.js';
import { initializeBoarding } from './boarding.js';
import { createFlightModel } from './flight-model.js';
import { createHeading } from './heading.js';
import { createHud } from './hud.js';
import { createInput, IDLE_AXES } from './input.js';
import { MOCK_FLIGHT } from './mock.js';
import { createNearby } from './nearby.js';
import { createSpeed } from './speed.js';
import { createThrust } from './thrust.js';
import { createYoke } from './yoke.js';

const MAX_FRAME_SECONDS = 0.1;

function mount(container, parts, position = 'append') {
  container[position](...parts.map(part => part.element));
  return parts;
}

export function initializeCockpit() {
  const cockpit = document.querySelector('[data-cockpit]');
  if (!cockpit) return;

  const boarding = initializeBoarding(cockpit);
  const input = createInput(cockpit, () => !boarding.isOpen());
  const model = createFlightModel(MOCK_FLIGHT);
  const views = [
    createHud(cockpit.querySelector('[data-hud]')),
    ...mount(cockpit.querySelector('[data-yoke]'), [createYoke()], 'prepend'),
    ...mount(cockpit.querySelector('[data-pfd]'), [createAttitude(), createHeading()]),
    ...mount(cockpit.querySelector('[data-engine]'), [createSpeed(), createThrust()]),
    createNearby(cockpit.querySelector('[data-nearby]'))
  ];

  let last = performance.now();
  const frame = now => {
    const dt = Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
    last = now;
    // 탑승 안내가 열려 있는 동안에는 조작을 비행에 반영하지 않는다
    const axes = boarding.isOpen() ? IDLE_AXES : input.axes();
    model.step(dt, axes);
    for (const view of views) view.update(model.state, axes);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
