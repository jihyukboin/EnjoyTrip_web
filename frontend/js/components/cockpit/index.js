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
import { loadTrip } from './trip.js';
import { createJourney } from './journey.js';
import { distanceMeters } from './navigation.js';

const MAX_FRAME_SECONDS = 0.1;

function mount(container, parts, position = 'append') {
  container[position](...parts.map(part => part.element));
  return parts;
}

export async function initializeCockpit() {
  const cockpit = document.querySelector('[data-cockpit]');
  if (!cockpit) return;

  const boarding = initializeBoarding(cockpit);
  const pause = cockpit.querySelector('[data-flight-pause]');
  const status = cockpit.querySelector('[data-flight-status]');
  let route;
  try {
    route = await loadTrip();
  } catch (error) {
    cockpit.querySelector('#boarding-title').textContent = '비행을 준비하지 못했습니다.';
    cockpit.querySelector('#boarding-description').textContent = error.message;
    status.textContent = '경로 확인 실패';
    pause.disabled = true;
    return;
  }
  document.title = `${route.post.title} · 비행 | EnjoyTrip`;
  cockpit.querySelector('[data-flight-title]').textContent = route.post.title;
  cockpit.querySelector('[data-flight-origin]').textContent = `${route.post.origin}에서 출발`;
  cockpit.querySelector('#boarding-title').textContent = route.post.title;
  cockpit.querySelector('#boarding-description').textContent = `${route.post.origin} → ${route.post.destination}. 탑승 후 3초 카운트다운 뒤 출발합니다.`;
  cockpit.querySelector('[data-flight-start]').disabled = false;
  const map = initializeFlightMap(route);
  const journey = createJourney(cockpit, route);
  let paused = false;
  const available = () => !boarding.isOpen() && !journey.isOpen() && !paused && !document.hidden && map.isReady();
  const isFlying = () => available() && journey.started();
  const input = createInput(cockpit, isFlying);
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.textContent = paused ? '비행 재개' : '일시정지';
    pause.setAttribute('aria-pressed', String(paused));
    input.reset();
  });
  const model = createFlightModel({ ...MOCK_FLIGHT, position: route.start, heading: route.heading });
  const views = [
    createHud(cockpit.querySelector('[data-hud]'), distanceMeters(route.start, route.end)),
    ...mount(cockpit.querySelector('[data-yoke]'), [createYoke()], 'prepend'),
    ...mount(cockpit.querySelector('[data-pfd]'), [createAttitude(), createHeading()]),
    ...mount(cockpit.querySelector('[data-engine]'), [createSpeed(), createThrust()]),
    createNearby(cockpit.querySelector('[data-nearby]'), map.setPlaces)
  ];

  let last = performance.now();
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    input.reset();
  });
  let previousStatus;
  let animation;
  const frame = now => {
    const elapsed = Math.max(0, (now - last) / 1000);
    const dt = Math.min(elapsed, MAX_FRAME_SECONDS);
    last = now;
    journey.tick(elapsed, available());
    const flying = isFlying();
    const axes = flying ? input.axes() : IDLE_AXES;
    if (flying) {
      model.step(dt, axes);
      journey.inspect(model.state.position);
    }
    else input.reset();
    map.update(model.state, now);
    const label = !map.isReady() ? '지도 연결 대기' : boarding.isOpen() ? '탑승 대기'
      : journey.isOpen() ? '도착 확인' : paused || document.hidden ? '일시정지'
      : !journey.started() ? '출발 준비' : '비행 중';
    if (label !== previousStatus) {
      status.textContent = label;
      previousStatus = label;
    }
    cockpit.dataset.flying = String(isFlying());
    for (const view of views) view.update(model.state, axes);
    animation = requestAnimationFrame(frame);
  };
  animation = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => cancelAnimationFrame(animation));
  window.addEventListener('pageshow', event => {
    if (event.persisted) { last = performance.now(); animation = requestAnimationFrame(frame); }
  });
}
