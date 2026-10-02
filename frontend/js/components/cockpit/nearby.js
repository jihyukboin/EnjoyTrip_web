// 중앙 디스플레이: 지나가는 곳 주변의 관광명소·음식점·숙소(MOCK)
// 나중에 주변 정보 API 결과를 같은 모양({ name, category, bearing, distance })으로 넣는다
import { element, writer } from './dom.js';
import { clockPosition, formatDistance } from './format.js';
import { MOCK_PLACES, PLACE_CATEGORIES } from './mock.js';
import { createRadar } from './radar.js';

const LIST_LIMIT = 5;

function placeItem(place) {
  const category = PLACE_CATEGORIES[place.category];
  const item = element('li', 'place');
  item.style.setProperty('--place-color', `var(--place-${place.category})`);

  const marker = element('span', 'place__marker', category.glyph);
  marker.setAttribute('aria-hidden', 'true');
  const text = element('span', 'place__text');
  const meta = element('span', 'place__meta');
  meta.append(element('span', 'place__category', category.label), ` · ${formatDistance(place.distance)}`);
  text.append(element('span', 'place__name', place.name), meta);
  const clock = element('span', 'place__clock');
  item.append(marker, text, clock);

  const setClock = writer(hour => {
    clock.textContent = `${hour}시`;
    clock.setAttribute('aria-label', `${hour}시 방향`);
  });
  return { item, update: heading => setClock(clockPosition(place.bearing, heading)) };
}

export function createNearby(section) {
  const places = [...MOCK_PLACES].sort((a, b) => a.distance - b.distance);
  const radar = createRadar(places);
  const list = section.querySelector('[data-nearby-list]');
  const filters = section.querySelectorAll('[data-filter]');
  let items = [];
  let heading = 0;

  section.querySelector('[data-nearby-radar]').append(radar.element);

  function show(category) {
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    radar.filter(category);
    items = places.filter(place => category === 'all' || place.category === category)
      .slice(0, LIST_LIMIT).map(placeItem);
    items.forEach(entry => entry.update(heading));
    list.replaceChildren(...items.map(entry => entry.item));
    if (!items.length) list.append(element('li', 'mfd__empty', '주변에 표시할 장소가 없습니다.'));
  }

  section.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (button) show(button.dataset.filter);
  });
  show('all');

  return {
    update(state) {
      heading = state.heading;
      radar.update(heading);
      items.forEach(entry => entry.update(heading));
    }
  };
}
