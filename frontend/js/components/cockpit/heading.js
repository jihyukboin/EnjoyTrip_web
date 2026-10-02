// 방위계(HSI): 나침반 눈금이 기수 방향 반대로 돈다. 시안 표시는 목표 방위
import { svg, svgText } from './dom.js';
import { createInstrument } from './instrument.js';
import { formatHeading } from './format.js';

const RADIUS = 72;
const CARDINALS = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

const ownship = () => svg('path', {
  class: 'heading__ownship',
  d: 'M0 -16C1.6 -16 2.4 -14 2.4 -11V-4L15 3V6L2.4 2.4 2 10 6 13V15L0 13.6-6 15V13L-2 10-2.4 2.4-15 6V3L-2.4 -4V-11C-2.4 -14-1.6 -16 0 -16Z'
});

function rose() {
  const nodes = [];
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const long = degrees % 10 === 0;
    nodes.push(svg('line', {
      class: 'ink', x1: 0, x2: 0, y1: -RADIUS, y2: -RADIUS + (long ? 9 : 5),
      'stroke-width': long ? 1.6 : 1, transform: `rotate(${degrees})`
    }));
    if (degrees % 30 === 0) {
      const cardinal = CARDINALS[degrees];
      nodes.push(svgText({
        class: cardinal ? 'ink-text heading__cardinal' : 'ink-text', y: -RADIUS + 22, 'text-anchor': 'middle',
        'font-size': cardinal ? 12 : 10, transform: `rotate(${degrees})`
      }, cardinal ?? degrees / 10));
    }
  }
  return nodes;
}

export function createHeading() {
  const instrument = createInstrument({ name: 'heading', variant: 'round', viewBox: '-100 -100 200 200', caption: '방위' });
  const card = svg('g', {}, rose());
  const target = svg('path', { class: 'target', d: `M-7 ${-RADIUS - 7}H7V${-RADIUS}H3L0 ${-RADIUS + 4}-3 ${-RADIUS}H-7Z` });
  card.append(target);
  const value = svgText({ class: 'value', y: -84, 'text-anchor': 'middle' }, '');

  instrument.root.append(
    svg('circle', { class: 'bezel', r: 96 }),
    svg('circle', { r: RADIUS + 1, fill: '#05090d', stroke: 'rgb(255 255 255 / 0.12)' }),
    card,
    svg('line', { x1: 0, x2: 0, y1: -RADIUS + 26, y2: RADIUS - 6, stroke: 'rgb(255 255 255 / 0.18)', 'stroke-dasharray': '3 4' }),
    ownship(),
    svg('path', { class: 'ink-fill', d: `M0 ${-RADIUS + 1}l-5 -9h10z` }),
    svg('rect', { class: 'value-box', x: -21, y: -99, width: 42, height: 20, rx: 3 }),
    value
  );

  return {
    element: instrument.figure,
    update({ heading, targetHeading = heading }) {
      target.setAttribute('transform', `rotate(${targetHeading})`);
      card.setAttribute('transform', `rotate(${-heading})`);
      const text = formatHeading(heading);
      value.textContent = text;
      instrument.describe(`방위 ${text}도, 목적지 ${formatHeading(targetHeading)}도`);
    }
  };
}
