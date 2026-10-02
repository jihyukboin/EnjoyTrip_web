import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNearby } from '../frontend/js/components/cockpit/nearby.js';

class Node {
  constructor() { this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.style = { setProperty() {} }; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}

test('목록·핀·레이더가 함께 바뀌고 조회 실패 시 기존 장소 유지 및 재시도가 가능하다', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    hidden: false, createElement: () => new Node(), createElementNS: () => new Node()
  } });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'document', original); else delete globalThis.document; });
  let now = 1000, requests = 0, fail = false;
  t.mock.method(performance, 'now', () => now);
  const places = Array.from({ length: 7 }, (_, index) => ({ name: `장소${index}`, lat: 37.5 + index * 0.001, lng: 127, category: index % 2 ? 'FD6' : 'AT4' }));
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    if (fail) throw new Error('offline');
    return { ok: true, status: 200, json: async () => ({ data: { places } }) };
  });
  const nodes = Object.fromEntries(['[data-nearby-list]', '.mfd__meta', '[data-nearby-radar]', '[data-nearby-refresh]', '[data-nearby-hint]'].map(key => [key, new Node()]));
  const filters = ['all', 'AT4', 'FD6', 'AD5'].map(filter => Object.assign(new Node(), { dataset: { filter } }));
  const section = new Node();
  section.querySelector = key => nodes[key];
  section.querySelectorAll = () => filters;
  let pins = [], selected;
  const nearby = createNearby(section, places => { pins = places; }, place => { selected = place; });
  const state = { position: { lat: 37.5, lng: 127 }, heading: 0 };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  nearby.update(state);
  nearby.update(state);
  await flush();
  assert.equal(requests, 1, '진행 중인 요청은 중복하지 않는다');
  assert.equal(pins.length, 5);
  assert.equal(nodes['[data-nearby-list]'].children.length, 5);
  const firstRow = nodes['[data-nearby-list]'].children[0];
  now += 1000;
  nearby.update(state);
  assert.equal(nodes['[data-nearby-list]'].children[0], firstRow, '변화 없는 목록은 다시 만들지 않는다');
  section.listeners.click({ target: { closest: () => filters[1] } });
  assert.equal(pins.length, 4);
  assert.ok(pins.every(place => place.category === 'AT4'));
  nearby.select(pins[0]);
  assert.equal(selected.name, pins[0].name);
  fail = true;
  nodes['[data-nearby-refresh]'].listeners.click();
  await flush();
  assert.equal(pins.length, 4, '일시적 실패로 유효한 장소를 지우지 않는다');
  assert.match(nodes['.mfd__meta'].textContent, /재시도/);
  fail = false;
  now += 8000;
  nearby.update(state);
  await flush();
  assert.equal(requests, 3);
  section.listeners.click({ target: { closest: () => filters[3] } });
  assert.deepEqual(pins, []);
  assert.equal(selected, null);
  assert.match(nodes['[data-nearby-list]'].children[0].textContent, /해당 장소가 없습니다/);
});
