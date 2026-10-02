import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInput, IDLE_AXES } from '../frontend/js/components/cockpit/input.js';

function setup(t) {
  class Element extends EventTarget {
    constructor(code) { super(); this.dataset = { key: code }; this.marked = false; }
    closest(selector) { return selector === 'button[data-key]' && this.dataset.key ? this : null; }
    matches(selector) { return Boolean(this.closest(selector)); }
    toggleAttribute(name, enabled) { this.marked = enabled; }
    setPointerCapture() {}
  }
  const document = new EventTarget();
  const window = new EventTarget();
  for (const [key, value] of Object.entries({ document, window, Element })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
  }
  const buttons = new Map(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].map(code => [code, new Element(code)]));
  const root = new Element();
  root.querySelectorAll = selector => [buttons.get(selector.match(/"(.*?)"/)[1])];
  const fire = (target, type, values = {}) => {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
    return event;
  };
  let flying = true;
  const input = createInput(root, () => flying);
  return { input, document, window, root, buttons, fire, pause: () => { flying = false; input.reset(); } };
}

test('동시 키 입력과 반대 입력, 창 포커스 해제 시 조작 상태를 처리한다', t => {
  const { input, document, window, fire } = setup(t);
  assert.equal(fire(document, 'keydown', { code: 'KeyD' }).defaultPrevented, true);
  fire(document, 'keydown', { code: 'ArrowUp' });
  assert.deepEqual(input.axes(), { roll: 1, pitch: 0, throttle: 1 });
  fire(document, 'keydown', { code: 'KeyA' });
  assert.equal(input.axes().roll, 0);
  fire(document, 'keyup', { code: 'KeyD' });
  assert.equal(input.axes().roll, -1);
  fire(window, 'blur');
  assert.deepEqual(input.axes(), IDLE_AXES);
});

test('방향·속도 동시 터치와 포인터 취소 시 해당 입력만 해제한다', t => {
  const { input, root, buttons, fire } = setup(t);
  fire(root, 'pointerdown', { target: buttons.get('KeyA'), pointerId: 1, button: 0 });
  fire(root, 'pointerdown', { target: buttons.get('ArrowUp'), pointerId: 2, button: 0 });
  assert.deepEqual(input.axes(), { roll: -1, pitch: 0, throttle: 1 });
  fire(root, 'pointercancel', { pointerId: 1 });
  assert.deepEqual(input.axes(), { roll: 0, pitch: 0, throttle: 1 });
  fire(root, 'lostpointercapture', { pointerId: 2 });
  assert.deepEqual(input.axes(), IDLE_AXES);
  assert.equal(buttons.get('ArrowUp').marked, false);
});

test('일시정지·안내창 상태에서는 키와 터치로 조작하지 않는다', t => {
  const { input, document, root, buttons, fire, pause } = setup(t);
  fire(document, 'keydown', { code: 'KeyW', ctrlKey: true });
  assert.deepEqual(input.axes(), IDLE_AXES);
  fire(document, 'keydown', { code: 'KeyW' });
  pause();
  assert.equal(fire(document, 'keydown', { code: 'ArrowUp' }).defaultPrevented, false);
  fire(root, 'pointerdown', { target: buttons.get('KeyD'), pointerId: 1, button: 0 });
  assert.deepEqual(input.axes(), IDLE_AXES);
});

test('화면 버튼은 키보드 Space로 누르고 놓을 수 있다', t => {
  const { input, document, buttons, fire } = setup(t);
  const target = buttons.get('ArrowDown');
  fire(document, 'keydown', { code: 'Space', target });
  assert.equal(input.axes().throttle, -1);
  fire(document, 'keyup', { code: 'Space', target });
  assert.deepEqual(input.axes(), IDLE_AXES);
});

test('좌우 방향키를 누르는 동안 선회하고 A·D와 함께 눌러도 개별 해제한다', t => {
  const { input, document, fire } = setup(t);
  fire(document, 'keydown', { code: 'ArrowLeft' });
  assert.equal(input.axes().roll, -1);
  fire(document, 'keyup', { code: 'ArrowLeft' });
  fire(document, 'keydown', { code: 'ArrowRight' });
  fire(document, 'keydown', { code: 'KeyD' });
  fire(document, 'keyup', { code: 'ArrowRight' });
  assert.equal(input.axes().roll, 1);
  fire(document, 'keyup', { code: 'KeyD' });
  assert.deepEqual(input.axes(), IDLE_AXES);
});
