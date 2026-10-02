import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeBoarding } from '../frontend/js/components/cockpit/boarding.js';

test('탑승을 명시적으로 제출하기 전에는 닫기만으로 출발할 수 없다', () => {
  const dialogEvents = {}, formEvents = {};
  const start = {};
  const form = { elements: { crew: { value: 'solo' } }, addEventListener: (name, fn) => { formEvents[name] = fn; } };
  const dialog = { open: false, querySelector: () => form, showModal() { this.open = true; },
    addEventListener: (name, fn) => { dialogEvents[name] = fn; } };
  const cockpit = { dataset: {}, querySelector: selector => selector === '[data-boarding]' ? dialog
    : selector === '[data-flight-start]' ? start : { addEventListener() {} } };
  const boarding = initializeBoarding(cockpit);
  let prevented = false;
  dialogEvents.cancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  dialog.open = false;
  dialogEvents.close();
  assert.equal(boarding.isOpen(), true);
  assert.equal(boarding.hasBoarded(), false);
  formEvents.submit();
  dialog.open = false;
  dialogEvents.close();
  assert.equal(boarding.hasBoarded(), true);
  assert.equal(boarding.isOpen(), false);
  assert.match(start.textContent, /돌아가기/);
});
