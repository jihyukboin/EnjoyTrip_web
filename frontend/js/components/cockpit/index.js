// 입력 → 비행 모델 → 지도·계기를 하나의 프레임 주기로 갱신한다.
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
import { initializeFlightMap } from '../flight-map/index.js';

const MAX_FRAME_SECONDS = 0.1;

function mount(container, parts, position = 'append') {
  container[position](...parts.map(part => part.element));
  return parts;
}

export function initializeCockpit() {
  const cockpit = document.querySelector('[data-cockpit]');
  if (!cockpit) return;

  const boarding = initializeBoarding(cockpit);
  const map = initializeFlightMap();
  const pause = cockpit.querySelector('[data-flight-pause]');
  const status = cockpit.querySelector('[data-flight-status]');
  let paused = false;
  const isFlying = () => !boarding.isOpen() && !paused && !document.hidden && map.isReady();
  const input = createInput(cockpit, isFlying);
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.textContent = paused ? '비행 재개' : '일시정지';
    pause.setAttribute('aria-pressed', String(paused));
    input.reset();
  });
  const model = createFlightModel(MOCK_FLIGHT);
  const views = [
    createHud(cockpit.querySelector('[data-hud]')),
    ...mount(cockpit.querySelector('[data-yoke]'), [createYoke()], 'prepend'),
    ...mount(cockpit.querySelector('[data-pfd]'), [createAttitude(), createHeading()]),
    ...mount(cockpit.querySelector('[data-engine]'), [createSpeed(), createThrust()]),
    createNearby(cockpit.querySelector('[data-nearby]'))
  ];

  let last = performance.now();
  let previousStatus;
  let animation;
  const frame = now => {
    const dt = Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
    last = now;
    const flying = isFlying();
    const axes = flying ? input.axes() : IDLE_AXES;
    if (flying) model.step(dt, axes);
    else input.reset();
    map.update(model.state, now);
    const label = !map.isReady() ? '지도 연결 대기' : boarding.isOpen() ? '탑승 대기' : paused ? '일시정지' : '비행 중';
    if (label !== previousStatus) {
      status.textContent = label;
      cockpit.dataset.flying = String(flying);
      previousStatus = label;
    }
    for (const view of views) view.update(model.state, axes);
    animation = requestAnimationFrame(frame);
  };
  animation = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => cancelAnimationFrame(animation));
  window.addEventListener('pageshow', event => {
    if (event.persisted) { last = performance.now(); animation = requestAnimationFrame(frame); }
  });
}
