// 키보드와 화면 버튼이 같은 조작 축을 공유한다. 포인터별로 추적해 동시 터치를 지원한다.
const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown']);
const KEY_ALIASES = { ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };
export const IDLE_AXES = Object.freeze({ roll: 0, pitch: 0, throttle: 0 });

export function createInput(root, isFlying) {
  const keyboard = new Set();
  const pointers = new Map();
  const pressed = code => [...keyboard].some(key => (KEY_ALIASES[key] ?? key) === code) || [...pointers.values()].includes(code);
  const paint = () => {
    for (const code of KEYS) {
      root.querySelectorAll(`[data-key="${code}"]`).forEach(node => {
        node.toggleAttribute('data-pressed', pressed(code));
      });
    }
  };
  const reset = () => {
    if (!keyboard.size && !pointers.size) return;
    keyboard.clear();
    pointers.clear();
    paint();
  };
  const editable = target => target instanceof Element && target.closest('input, select, textarea, [contenteditable="true"]');
  const eventCode = event => ['Space', 'Enter'].includes(event.code)
    ? event.target.closest?.('button[data-key]')?.dataset.key : event.code;

  document.addEventListener('keydown', event => {
    const code = eventCode(event);
    if (!isFlying() || !KEYS.has(KEY_ALIASES[code] ?? code) || editable(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    keyboard.add(code);
    paint();
  });
  document.addEventListener('keyup', event => {
    const code = eventCode(event);
    if (KEYS.has(KEY_ALIASES[code] ?? code)) { keyboard.delete(code); paint(); }
    if (['Space', 'Enter'].includes(event.code)) reset();
  });
  root.addEventListener('pointerdown', event => {
    const button = event.target.closest('button[data-key]');
    if (!button || !isFlying() || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, button.dataset.key);
    paint();
  });
  const releasePointer = event => { pointers.delete(event.pointerId); paint(); };
  root.addEventListener('pointerup', releasePointer);
  root.addEventListener('pointercancel', releasePointer);
  root.addEventListener('lostpointercapture', releasePointer);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  root.addEventListener('focusout', event => {
    if (event.target.matches('button[data-key]')) { keyboard.delete(event.target.dataset.key); paint(); }
  });

  const axis = (positive, negative) => Number(pressed(positive)) - Number(pressed(negative));
  return { reset, axes: () => ({
    roll: axis('KeyD', 'KeyA'), pitch: axis('KeyS', 'KeyW'), throttle: axis('ArrowUp', 'ArrowDown')
  }) };
}
