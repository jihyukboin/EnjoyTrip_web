// 주변 정보 레이더: 기수 방향이 위(heading-up). 장소는 진북 방위로 놓고 판 전체를 돌린다
import { svg, svgText } from './dom.js';
import { formatHeading } from './format.js';
import { NEARBY_RANGE_KM, PLACE_CATEGORIES } from './mock.js';

const RADIUS = 82;
const PX_PER_KM = RADIUS / NEARBY_RANGE_KM;
const RAD = Math.PI / 180;

function compass() {
  const nodes = [];
  for (let degrees = 0; degrees < 360; degrees += 10) {
    const long = degrees % 30 === 0;
    nodes.push(svg('line', {
      class: 'radar__tick', x1: 0, x2: 0, y1: -RADIUS, y2: -RADIUS + (long ? 7 : 4), transform: `rotate(${degrees})`
    }));
  }
  nodes.push(svgText({ class: 'radar__north', y: -RADIUS + 18, 'text-anchor': 'middle' }, 'N'));
  return nodes;
}

function rangeRings() {
  return [1, 2].flatMap(km => {
    const radius = km * PX_PER_KM;
    const offset = radius * Math.SQRT1_2;
    return [
      svg('circle', { class: km === NEARBY_RANGE_KM ? 'radar__ring radar__ring--outer' : 'radar__ring', r: radius }),
      svgText({ class: 'radar__range', x: offset + 3, y: offset + 3 }, km === NEARBY_RANGE_KM ? `${km}km` : km)
    ];
  });
}

function marker(place) {
  const upright = svg('g', {}, [
    svg('circle', { r: 7 }),
    svgText({ y: 2.7, 'text-anchor': 'middle' }, PLACE_CATEGORIES[place.category].glyph)
  ]);
  const x = Math.sin(place.bearing * RAD) * place.distance * PX_PER_KM;
  const y = -Math.cos(place.bearing * RAD) * place.distance * PX_PER_KM;
  const group = svg('g', {
    class: 'radar__place', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
    style: `--place-color: var(--place-${place.category})`
  }, [upright]);
  return { group, upright, place };
}

export function createRadar(places) {
  const markers = places.map(marker);
  const card = svg('g', {}, [...compass(), ...markers.map(item => item.group)]);
  const value = svgText({ class: 'radar__heading', y: -88, 'text-anchor': 'middle' }, '');
  const root = svg('svg', { class: 'radar', viewBox: '-100 -100 200 200', 'aria-hidden': 'true' }, [
    ...rangeRings(),
    svg('line', { x1: 0, x2: 0, y1: -10, y2: -RADIUS, stroke: 'rgb(255 255 255 / 0.18)', 'stroke-dasharray': '3 4' }),
    card,
    svg('path', { class: 'radar__ownship', d: 'M0 -8L6 7L0 4L-6 7Z' }),
    svg('rect', { class: 'value-box', x: -17, y: -100, width: 34, height: 16, rx: 3, fill: '#000', stroke: 'rgb(255 255 255 / 0.4)' }),
    value,
    svg('path', { d: `M0 ${-RADIUS + 1}l-4 -6h8z`, fill: '#fff' })
  ]);

  return {
    element: root,
    filter(category) {
      for (const item of markers) {
        item.group.setAttribute('display', category === 'all' || item.place.category === category ? 'inline' : 'none');
      }
    },
    update(heading) {
      card.setAttribute('transform', `rotate(${-heading})`);
      // 글자는 바로 서 있도록 판의 회전을 되돌린다
      for (const item of markers) item.upright.setAttribute('transform', `rotate(${heading})`);
      value.textContent = formatHeading(heading);
    }
  };
}
