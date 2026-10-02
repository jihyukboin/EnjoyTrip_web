// 유리창 HUD: 상단 방위 테이프와 속도·고도, 지도 중앙의 내 비행기와 선회 예측선
// 지도는 북쪽이 위이므로 비행기 아이콘이 기수 방향으로 돈다
import { element, svg, svgText } from './dom.js';
import { formatHeading, formatNumber, normalizeDegrees } from './format.js';
import { MOCK_TARGET } from './mock.js';

const RAD = Math.PI / 180;
const TAPE_WIDTH = 360;
const PX_PER_DEGREE = 4;
const TREND_SECONDS = 20;
const TREND_STEPS = 16;

const tapeX = degrees => TAPE_WIDTH / 2 + degrees * PX_PER_DEGREE;
const tapeLabel = degrees => ({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' })[degrees] ?? formatHeading(degrees);

function headingTape() {
  const marks = [];
  // 0~360을 넘나들 때 끊기지 않도록 앞뒤로 60도씩 더 그린다
  for (let degrees = -60; degrees <= 420; degrees += 5) {
    const long = degrees % 10 === 0;
    marks.push(svg('line', { x1: tapeX(degrees), x2: tapeX(degrees), y1: 24, y2: long ? 34 : 29, 'stroke-width': long ? 1.6 : 1 }));
    if (degrees % 30 === 0) {
      marks.push(svgText({ x: tapeX(degrees), y: 47, 'text-anchor': 'middle' }, tapeLabel(normalizeDegrees(degrees))));
    }
  }
  for (const offset of [-360, 0, 360]) {
    const x = tapeX(MOCK_TARGET.heading + offset);
    marks.push(svg('path', { class: 'hud__target', d: `M${x - 6} 18H${x + 6}V24H${x + 3}L${x} 27 ${x - 3} 24H${x - 6}Z` }));
  }
  const moving = svg('g', {}, marks);
  const value = svgText({ x: TAPE_WIDTH / 2, y: 13, 'text-anchor': 'middle', 'font-size': 14 }, '');
  const root = svg('svg', { class: 'hud__tape', viewBox: `0 0 ${TAPE_WIDTH} 48` }, [
    moving,
    svg('rect', { class: 'hud__box', x: TAPE_WIDTH / 2 - 22, y: 0, width: 44, height: 18, rx: 3 }),
    value,
    svg('path', { d: `M${TAPE_WIDTH / 2} 24l-4 -5h8z`, fill: 'currentColor' })
  ]);
  return {
    root,
    update(heading) {
      moving.setAttribute('transform', `translate(${-heading * PX_PER_DEGREE} 0)`);
      value.textContent = formatHeading(heading);
    }
  };
}

function readout(label, unit, modifier = '') {
  const box = element('div', `hud__readout${modifier}`);
  const line = element('span');
  const value = element('span', 'hud__value');
  line.append(value, element('span', 'hud__unit', unit));
  box.append(element('span', 'hud__label', label), line);
  return { box, value };
}

// 지금 선회율이 유지될 때 앞으로 지나갈 길
function trendPoints({ heading, turnRate, speed }) {
  const length = 40 + speed / 4;
  const segment = length / TREND_STEPS;
  const step = TREND_SECONDS / TREND_STEPS;
  let x = 0;
  let y = 0;
  let direction = heading;
  const points = ['0,0'];
  for (let index = 0; index < TREND_STEPS; index += 1) {
    direction += turnRate * step;
    x += Math.sin(direction * RAD) * segment;
    y -= Math.cos(direction * RAD) * segment;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

function ownship() {
  const trend = svg('polyline', { class: 'hud__trend' });
  const plane = svg('path', {
    class: 'hud__plane',
    d: 'M0 -16C1.6 -16 2.4 -14 2.4 -11V-4L15 3V6L2.4 2.4 2 10 6 13V15L0 13.6-6 15V13L-2 10-2.4 2.4-15 6V3L-2.4 -4V-11C-2.4 -14-1.6 -16 0 -16Z'
  });
  const root = svg('svg', { class: 'hud__ownship', viewBox: '-100 -100 200 200' }, [
    svg('circle', { class: 'hud__ring', r: 88 }),
    svg('path', { d: 'M0 -88V-80', class: 'hud__tick' }),
    svgText({ y: -92, 'text-anchor': 'middle', 'font-size': 10 }, 'N'),
    trend,
    plane
  ]);
  return {
    root,
    update(state) {
      trend.setAttribute('points', trendPoints(state));
      plane.setAttribute('transform', `rotate(${state.heading}) scale(1.5)`);
    }
  };
}

export function createHud(container) {
  const tape = headingTape();
  const speed = readout('SPD', 'KT');
  const altitude = readout('ALT', 'FT', ' hud__readout--right');
  const top = element('div', 'hud__top');
  const plane = ownship();
  top.append(speed.box, tape.root, altitude.box);
  container.append(top, plane.root);

  return {
    update(state) {
      tape.update(state.heading);
      plane.update(state);
      speed.value.textContent = Math.round(state.speed);
      altitude.value.textContent = formatNumber(Math.round(state.altitude / 10) * 10);
    }
  };
}
