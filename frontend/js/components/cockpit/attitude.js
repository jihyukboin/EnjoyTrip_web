// 자세계: 기울기(뱅크)와 기수각(피치). 하늘·땅 경계가 기체 반대로 돈다
import { svg, svgText, uniqueId } from './dom.js';
import { createInstrument } from './instrument.js';

const RADIUS = 80;
const PX_PER_DEGREE = 3;
const BANK_MARKS = [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60];
const PITCH_MARKS = [-20, -15, -10, -5, 5, 10, 15, 20];

function gradient(id, from, to, y1, y2) {
  return svg('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1, y2 }, [
    svg('stop', { offset: 0, 'stop-color': from }),
    svg('stop', { offset: 1, 'stop-color': to })
  ]);
}

function pitchLadder() {
  return PITCH_MARKS.flatMap(degrees => {
    const half = degrees % 10 === 0 ? 22 : 10;
    const y = -degrees * PX_PER_DEGREE;
    const line = svg('line', { class: 'ink', x1: -half, x2: half, y1: y, y2: y, 'stroke-width': 1.4 });
    if (degrees % 10) return [line];
    const label = { class: 'ink-text', y: y + 3.5, 'font-size': 9 };
    return [line,
      svgText({ ...label, x: -half - 5, 'text-anchor': 'end' }, Math.abs(degrees)),
      svgText({ ...label, x: half + 5 }, Math.abs(degrees))];
  });
}

const bankScale = () => BANK_MARKS.map(degrees => svg('line', {
  class: 'ink', x1: 0, x2: 0, y1: -RADIUS, y2: -RADIUS + (degrees % 30 === 0 ? 10 : 6),
  'stroke-width': 1.6, transform: `rotate(${degrees})`
}));

// 기체 기준 표시(노란 날개)는 움직이지 않는다
const aircraftSymbol = () => svg('g', { class: 'attitude__aircraft' }, [
  svg('path', { d: 'M-58 -2.5H-24V9H-30V3.5H-58Z' }),
  svg('path', { d: 'M58 -2.5H24V9H30V3.5H58Z' }),
  svg('rect', { x: -3.5, y: -3.5, width: 7, height: 7 })
]);

export function createAttitude() {
  const instrument = createInstrument({ name: 'attitude', variant: 'round', viewBox: '-100 -100 200 200', caption: '자세' });
  const [clipId, skyId, groundId] = ['attitude-clip', 'attitude-sky', 'attitude-ground'].map(uniqueId);

  const horizon = svg('g', {}, [
    svg('rect', { x: -300, y: -600, width: 600, height: 600, fill: `url(#${skyId})` }),
    svg('rect', { x: -300, y: 0, width: 600, height: 600, fill: `url(#${groundId})` }),
    svg('line', { x1: -300, x2: 300, y1: 0, y2: 0, stroke: '#fff', 'stroke-width': 1.6 }),
    ...pitchLadder()
  ]);
  const pointer = svg('path', { class: 'ink-fill', d: `M0 ${-RADIUS + 11}l-6 9h12z` });

  instrument.root.append(
    svg('defs', {}, [
      svg('clipPath', { id: clipId }, [svg('circle', { r: RADIUS })]),
      gradient(skyId, '#123d73', '#3c86d1', -110, 0),
      gradient(groundId, '#8a5427', '#3d220e', 0, 110)
    ]),
    svg('circle', { class: 'bezel', r: 96 }),
    svg('g', { 'clip-path': `url(#${clipId})` }, [horizon]),
    svg('circle', { r: RADIUS, fill: 'none', stroke: 'rgb(0 0 0 / 0.55)', 'stroke-width': 3 }),
    ...bankScale(),
    svg('path', { class: 'ink-fill', d: `M0 ${-RADIUS - 1}l-6 -9h12z` }),
    pointer,
    aircraftSymbol()
  );

  return {
    element: instrument.figure,
    update({ bank, pitch }) {
      horizon.setAttribute('transform', `rotate(${-bank}) translate(0 ${pitch * PX_PER_DEGREE})`);
      pointer.setAttribute('transform', `rotate(${-bank})`);
      const side = Math.round(bank) === 0 ? '수평' : `${bank > 0 ? '오른쪽' : '왼쪽'} ${Math.abs(Math.round(bank))}도`;
      instrument.describe(`자세: 기울기 ${side}, 기수 ${Math.round(pitch)}도`);
    }
  };
}
