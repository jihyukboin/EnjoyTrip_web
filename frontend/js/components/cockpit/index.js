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
import { distanceMeters, bearingDegrees } from './navigation.js';
import { formatDistance } from './format.js';

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
  let nearby;
  const map = initializeFlightMap(route, place => nearby?.select(place));
  const journey = createJourney(cockpit, route);
  let paused = false;
  const available = () => boarding.hasBoarded() && !boarding.isOpen() && !journey.isOpen() && !paused && !document.hidden && map.isReady();
  const isFlying = () => available() && journey.started();
  const input = createInput(cockpit, isFlying);
  const pauseBanner = cockpit.querySelector('[data-pause-banner]');
  const pauseMessage = cockpit.querySelector('[data-pause-message]');
  const expand = cockpit.querySelector('[data-map-expand]');
  expand.addEventListener('click', () => {
    const expanded = cockpit.dataset.expanded !== 'true';
    cockpit.dataset.expanded = String(expanded);
    expand.setAttribute('aria-pressed', String(expanded));
    expand.textContent = expanded ? '조작 패널 보기' : '지도 넓게';
  });
  function setPaused(value) {
    paused = value;
    pause.textContent = paused ? '비행 재개' : '일시정지';
    pause.setAttribute('aria-pressed', String(paused));
    pauseBanner.hidden = !paused;
    pauseMessage.textContent = '일시정지 중 · 준비되면 다시 출발하세요';
    if (!paused) {
      map.focusPlace(null);
      nearby?.clearSelection();
      cockpit.dataset.exploring = 'false';
    }
    input.reset();
  }
  pause.addEventListener('click', () => setPaused(!paused));
  cockpit.querySelector('[data-flight-resume]').addEventListener('click', () => setPaused(false));
  window.addEventListener('blur', () => { if (journey.started()) setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && journey.started()) setPaused(true); });
  nearby = createNearby(cockpit.querySelector('[data-nearby]'), map.setPlaces, place => {
    if (place) setPaused(true);
    map.focusPlace(place);
    cockpit.dataset.exploring = String(Boolean(place));
    pauseMessage.textContent = place ? `${place.name} · 둘러보는 동안 비행이 멈춥니다` : '일시정지 중';
    if (place) cockpit.querySelector('.cockpit__windshield').scrollIntoView({ block: 'nearest' });
  });
  const model = createFlightModel({ ...MOCK_FLIGHT, position: route.start, heading: route.heading });
  const views = [
    createHud(cockpit.querySelector('[data-hud]'), distanceMeters(route.start, route.end)),
    ...mount(cockpit.querySelector('[data-yoke]'), [createYoke()], 'prepend'),
    ...mount(cockpit.querySelector('[data-pfd]'), [createAttitude(), createHeading()]),
    ...mount(cockpit.querySelector('[data-engine]'), [createSpeed(), createThrust()]),
    nearby
  ];

  let last = performance.now();
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    input.reset();
  });
  let previousStatus;
  const destinationDistance = cockpit.querySelector('[data-destination-distance]');
  const destinationDirection = cockpit.querySelector('[data-destination-direction]');
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
    const targetHeading = bearingDegrees(model.state.position, route.end);
    const remaining = distanceMeters(model.state.position, route.end);
    const distanceText = `도착까지 ${formatDistance(remaining / 1000)}`;
    if (destinationDistance.textContent !== distanceText) destinationDistance.textContent = distanceText;
    const turn = (targetHeading - model.state.heading + 540) % 360 - 180;
    const directionText = remaining <= 100 ? '목적지 도착' : Math.abs(turn) < 5 ? '↑ 목적지 방향으로 비행 중' : `${turn > 0 ? '→ 오른쪽' : '← 왼쪽'} ${Math.round(Math.abs(turn))}° 선회하면 목적지 방향`;
    if (destinationDirection.textContent !== directionText) destinationDirection.textContent = directionText;
    const label = !map.isReady() ? '지도 연결 대기' : boarding.isOpen() ? '탑승 대기'
      : journey.isOpen() ? '도착 확인' : paused || document.hidden ? '일시정지'
      : !journey.started() ? '출발 준비' : '비행 중';
    if (label !== previousStatus) {
      status.textContent = label;
      previousStatus = label;
    }
    cockpit.dataset.flying = String(isFlying());
    for (const view of views) view.update({ ...model.state, targetHeading }, axes);
    animation = requestAnimationFrame(frame);
  };
  animation = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => cancelAnimationFrame(animation));
  window.addEventListener('pageshow', event => {
    if (event.persisted) { last = performance.now(); animation = requestAnimationFrame(frame); }
  });
}
