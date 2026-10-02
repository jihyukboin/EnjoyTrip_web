import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeFlightMap } from '../frontend/js/components/flight-map/index.js';

function setup(t, { sdk = true, deferred = false } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const container = { dataset: {} };
  const status = { textContent: '' };
  const retry = { hidden: true, addEventListener() {} };
  const points = [];
  const routes = [];
  const markers = [];
  let load;
  let resize;
  let layoutCount = 0;
  class LatLng { constructor(lat, lng) { this.lat = lat; this.lng = lng; } }
  class Map {
    constructor(node, options) { assert.equal(node, container); points.push(options.center); }
    setCenter(point) { points.push(point); }
    addControl() {}
    relayout() { layoutCount++; }
  }
  const globals = {
    document: { createElement: () => ({}), querySelector: selector => ({ '[data-flight-map]': container, '.flight-map__status': status, '[data-map-retry]': retry })[selector] },
    window: { addEventListener() {} },
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} disconnect() {} },
    kakao: sdk ? { maps: { load(callback) { load = callback; if (!deferred) callback(); }, Map, LatLng,
      MapTypeId: { SKYVIEW: 2 }, ControlPosition: { RIGHT: 2 }, ZoomControl: class {},
      Polyline: class { constructor(options) { routes.push(options.path); } },
      Marker: class { constructor(options) { markers.push(options); } }, CustomOverlay: class {} } } : undefined
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
  }
  return { container, status, retry, points, routes, markers, load: () => load(), resize: () => resize(), layouts: () => layoutCount };
}

test('게시글의 출발 좌표에서 지도를 열고 출발·도착 경로와 마커를 표시한다', t => {
  const env = setup(t);
  const start = { lat: 35.1, lng: 129.1 };
  const end = { lat: 37.5, lng: 127 };
  const map = initializeFlightMap({ start, end });
  assert.equal(map.isReady(), true);
  assert.deepEqual({ ...env.points[0] }, start);
  assert.deepEqual(env.routes[0].map(point => ({ ...point })), [start, end]);
  assert.deepEqual(env.markers.map(marker => marker.title), ['출발', '도착']);
});

test('비행 좌표를 Kakao 지도 중심에 반영하고 크기 변경 후에도 위치를 유지한다', t => {
  const env = setup(t);
  const map = initializeFlightMap();
  assert.equal(map.isReady(), true);
  assert.equal(env.container.dataset.state, 'ready');
  assert.equal(env.status.textContent, '');
  const state = { position: { lat: 37.5, lng: 127 } };
  map.update(state, 100);
  assert.deepEqual({ ...env.points.at(-1) }, state.position);
  const count = env.points.length;
  map.update(state, 110);
  assert.equal(env.points.length, count, '지도 갱신은 초당 30회 이내로 제한한다');
  env.resize();
  assert.equal(env.layouts(), 1);
  assert.deepEqual({ ...env.points.at(-1) }, state.position);
});

test('SDK 로딩 실패 시 비행 준비 상태가 되지 않고 재시도 안내를 표시한다', t => {
  const env = setup(t, { sdk: false });
  const map = initializeFlightMap();
  assert.equal(map.isReady(), false);
  assert.equal(env.container.dataset.state, 'error');
  assert.equal(env.retry.hidden, false);
  assert.match(env.status.textContent, /다시 시도/);
  assert.doesNotThrow(() => map.update({ position: { lat: 0, lng: 0 } }, 100));
});

test('지도 초기화가 지연되면 대기를 종료하고 뒤늦은 콜백을 무시한다', t => {
  const env = setup(t, { deferred: true });
  const map = initializeFlightMap();
  assert.equal(env.container.dataset.state, 'loading');
  t.mock.timers.tick(15000);
  assert.equal(env.container.dataset.state, 'error');
  env.load();
  assert.equal(map.isReady(), false);
});
