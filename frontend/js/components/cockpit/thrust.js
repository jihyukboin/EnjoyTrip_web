// 추력계: P2 페달로 올리고 내리는 추력(%)을 막대로 보여준다
import { svg, svgText, writer } from './dom.js';
import { createInstrument } from './instrument.js';

const TOP = 36;
const HEIGHT = 150;
const MARKS = [0, 25, 50, 75, 100];
const y = ratio => TOP + HEIGHT * (1 - ratio);

const scale = () => MARKS.flatMap(percent => {
  const line = svg('line', { class: 'ink', x1: 22, x2: 27, y1: y(percent / 100), y2: y(percent / 100), 'stroke-width': 1.2 });
  if (percent % 50) return [line];
  return [line, svgText({ class: 'ink-text', x: 20, y: y(percent / 100) + 3.5, 'text-anchor': 'end', 'font-size': 9 }, percent)];
});

export function createThrust() {
  const instrument = createInstrument({ name: 'thrust', variant: 'bar', viewBox: '0 0 64 200', caption: '추력 %' });
  const fill = svg('rect', { class: 'thrust__fill', x: 30, width: 14, rx: 2 });
  const value = svgText({ class: 'value', x: 32, y: 18, 'text-anchor': 'middle', 'font-size': 16 }, '');
  // 페달을 밟는 방향(가속 ▲ / 감속 ▼)
  const trend = svg('path', { class: 'target thrust__trend' });
  const setTrend = writer(direction => {
    trend.setAttribute('visibility', direction ? 'visible' : 'hidden');
    trend.setAttribute('d', direction > 0 ? 'M0 -6L5 2H-5Z' : 'M0 6L5 -2H-5Z');
  });

  instrument.root.append(
    svg('rect', { class: 'value-box', x: 6, y: 1, width: 52, height: 24, rx: 4 }),
    value,
    svg('rect', { x: 29, y: TOP - 1, width: 16, height: HEIGHT + 2, rx: 3, fill: 'rgb(255 255 255 / 0.05)', stroke: 'rgb(255 255 255 / 0.18)' }),
    fill,
    ...scale(),
    trend
  );

  return {
    element: instrument.figure,
    update({ thrust }, { throttle }) {
      const percent = Math.round(thrust * 100);
      fill.setAttribute('y', y(thrust));
      fill.setAttribute('height', HEIGHT * thrust);
      trend.setAttribute('transform', `translate(53 ${y(thrust)})`);
      setTrend(throttle);
      value.textContent = `${percent}%`;
      instrument.describe(`추력 ${percent}퍼센트`);
    }
  };
}
