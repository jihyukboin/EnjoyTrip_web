// 키보드 입력. 혼자일 때 왼손 WASD(핸들), 오른손 ↑↓(페달)을 쓴다
// event.code는 키보드 배열·한글 입력 상태와 관계없이 같은 물리 키를 가리킨다
const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown']);

export const IDLE_AXES = Object.freeze({ roll: 0, pitch: 0, throttle: 0 });

export function createInput(root, isFlying) {
  const pressed = new Set();
  const mark = (code, on) =>
    root.querySelectorAll(`[data-key="${code}"]`).forEach(node => node.toggleAttribute('data-pressed', on));
  const release = code => {
    pressed.delete(code);
    mark(code, false);
  };

  document.addEventListener('keydown', event => {
    if (!KEYS.has(event.code) || event.altKey || event.ctrlKey || event.metaKey) return;
    // 탑승 안내 중에는 키 표시만 켜고, 방향키의 기본 동작(라디오 이동)은 막지 않는다
    if (isFlying()) event.preventDefault();
    if (pressed.has(event.code)) return;
    pressed.add(event.code);
    mark(event.code, true);
  });
  document.addEventListener('keyup', event => {
    if (KEYS.has(event.code)) release(event.code);
  });
  // 창을 벗어나면 keyup을 받지 못하므로 모두 뗀 것으로 본다
  window.addEventListener('blur', () => [...pressed].forEach(release));

  const axis = (positive, negative) => Number(pressed.has(positive)) - Number(pressed.has(negative));
  return {
    axes: () => ({
      roll: axis('KeyD', 'KeyA'),
      pitch: axis('KeyS', 'KeyW'),
      throttle: axis('ArrowUp', 'ArrowDown')
    })
  };
}
