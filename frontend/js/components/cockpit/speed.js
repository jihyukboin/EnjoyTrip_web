// 속도계: 세로 테이프가 움직이고 가운데 창에 현재 속도(노트)를 보여준다
import { svg, svgText, writer } from './dom.js';
import { createInstrument } from './instrument.js';
import { MOCK_TARGET } from './mock.js';

const CENTER = 100;
const PX_PER_KNOT = 2.4;
const MAX_KNOTS = 400;
const CAUTION_SPEED = 120;
const WARNING_SPEED = 100;
const at = knots => CENTER - knots * PX_PER_KNOT;

function tape() {
  const nodes = [
    // 저속 경고 띠: 빨강(실속 위험), 앰버(주의)
    svg('rect', { x: 92, y: at(WARNING_SPEED), width: 4, height: WARNING_SPEED * PX_PER_KNOT, fill: 'var(--ck-red)' }),
    svg('rect', { x: 92, y: at(CAUTION_SPEED), width: 4, height: (CAUTION_SPEED - WARNING_SPEED) * PX_PER_KNOT, fill: 'var(--ck-amber)' })
  ];
  for (let knots = 0; knots <= MAX_KNOTS; knots += 10) {
    const long = knots % 20 === 0;
    nodes.push(svg('line', { class: 'ink', x1: long ? 78 : 84, x2: 91, y1: at(knots), y2: at(knots), 'stroke-width': 1.4 }));
    if (long) nodes.push(svgText({ class: 'ink-text', x: 72, y: at(knots) + 4, 'text-anchor': 'end', 'font-size': 12 }, knots));
  }
  const target = at(MOCK_TARGET.speed);
  nodes.push(svg('path', { class: 'target', d: `M80 ${target}L91 ${target - 6}V${target + 6}Z` }));
  return nodes;
}

const levelOf = speed => (speed < WARNING_SPEED ? 'warning' : speed < CAUTION_SPEED ? 'caution' : 'normal');

export function createSpeed() {
  const instrument = createInstrument({ name: 'speed', variant: 'tape', viewBox: '0 0 96 200', caption: '속도 KT' });
  const moving = svg('g', {}, tape());
  const value = svgText({ class: 'value', x: 60, y: CENTER + 6.5, 'text-anchor': 'end', 'font-size': 19 }, '');
  const setLevel = writer(level => value.setAttribute('data-level', level));

  instrument.root.append(
    svg('rect', { x: 0, y: 0, width: 96, height: 200, rx: 8, fill: 'rgb(255 255 255 / 0.025)' }),
    moving,
    svg('path', { class: 'value-box', d: `M4 ${CENTER - 15}H64V${CENTER - 7}L74 ${CENTER}L64 ${CENTER + 7}V${CENTER + 15}H4Z` }),
    value
  );

  return {
    element: instrument.figure,
    update({ speed }) {
      moving.setAttribute('transform', `translate(0 ${speed * PX_PER_KNOT})`);
      const knots = Math.round(speed);
      value.textContent = knots;
      const level = levelOf(speed);
      setLevel(level);
      instrument.describe(`속도 ${knots}노트${level === 'normal' ? '' : ', 저속 주의'}`);
    }
  };
}
