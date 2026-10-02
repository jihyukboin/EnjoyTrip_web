// P1 핸들: 좌우(A·D)로 돌고 앞뒤(W·S)로 밀고 당긴다
import { svg } from './dom.js';

const wheel = () => svg('g', { class: 'yoke__wheel' }, [
  // 양쪽 손잡이가 위로 솟은 항공기 조종간 모양
  svg('path', { class: 'yoke__frame', d: 'M-54 -26C-60 -4-50 16-30 16H30C50 16 60 -4 54 -26' }),
  svg('rect', { class: 'yoke__grip', x: -62, y: -40, width: 15, height: 30, rx: 7 }),
  svg('rect', { class: 'yoke__grip', x: 47, y: -40, width: 15, height: 30, rx: 7 }),
  svg('rect', { class: 'yoke__hub', x: -20, y: 2, width: 40, height: 22, rx: 7 }),
  svg('circle', { class: 'yoke__mark', cy: 13, r: 3 })
]);

export function createYoke() {
  const root = svg('svg', { class: 'yoke', viewBox: '-70 -48 140 110', 'aria-hidden': 'true' }, [
    svg('rect', { class: 'yoke__column', x: -6, y: 18, width: 12, height: 44, rx: 3 }),
    wheel()
  ]);

  return {
    element: root,
    // 입력은 -1·0·1이므로 CSS 전환으로 부드럽게 움직인다
    update(state, { roll, pitch }) {
      root.style.setProperty('--yoke-roll', roll);
      root.style.setProperty('--yoke-pitch', pitch);
    }
  };
}
