import { svg } from './dom.js';

// 북쪽을 향한 쌍발 여객기 평면도. 동체, 후퇴익, 엔진, 꼬리날개를 구분한다.
export function createAircraft() {
  return svg('g', { class: 'hud__aircraft' }, [
    svg('path', { class: 'aircraft__wing', d: 'M-4 -12-45 13-46 20-5 9H5L46 20 45 13 4-12Z' }),
    svg('path', { class: 'aircraft__tail', d: 'M-3 25-18 36V40L0 35 18 40V36L3 25Z' }),
    ...[-19, 19].map(x => svg('rect', { class: 'aircraft__engine', x: x - 3, y: 0, width: 6, height: 15, rx: 3 })),
    svg('path', { class: 'aircraft__body', d: 'M0-44C-4-42-6-33-6-23V12L-3 33 0 42 3 33 6 12V-23C6-33 4-42 0-44Z' }),
    svg('path', { class: 'aircraft__cockpit', d: 'M-4-30Q0-34 4-30L3-26Q0-28-3-26Z' }),
    svg('path', { class: 'aircraft__stripe', d: 'M0 17V36', 'stroke-width': 2.5 }),
    svg('path', { class: 'aircraft__seam', d: 'M-8 6-38 16M8 6 38 16' })
  ]);
}
