// 비행 위치 반경 2km의 관광명소·음식점·숙소를 표시한다.
import { getNearby } from '../../api/nearby-api.js';
import { element, writer } from './dom.js';
import { clockPosition, formatDistance } from './format.js';
import { PLACE_CATEGORIES } from './mock.js';
import { createRadar } from './radar.js';

const LIST_LIMIT = 5;
const REFRESH_MS = 20000;
const STATIONARY_REFRESH_MS = 300000;
const MOVE_KM = 0.4;
const RAD = Math.PI / 180;

function traveled(a, b) {
  const north = (a.lat - b.lat) * 111.2;
  const east = (a.lng - b.lng) * 111.2 * Math.cos(a.lat * RAD);
  return Math.hypot(north, east);
}

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

export function createNearby(section, onVisiblePlaces = () => {}) {
  let places = [];
  let radar = createRadar(places);
  const radarHost = section.querySelector('[data-nearby-radar]');
  const meta = section.querySelector('.mfd__meta');
  const list = section.querySelector('[data-nearby-list]');
  const filters = section.querySelectorAll('[data-filter]');
  let items = [];
  let heading = 0;
  let selected = 'all';
  let lastRequest = 0;
  let lastPosition;
  let pending = false;

  radarHost.append(radar.element);

  function show(category) {
    selected = category;
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    radar.filter(category);
    const visiblePlaces = places.filter(place => category === 'all' || place.category === category)
      .slice(0, LIST_LIMIT);
    items = visiblePlaces.map(placeItem);
    items.forEach(entry => entry.update(heading));
    list.replaceChildren(...items.map(entry => entry.item));
    onVisiblePlaces(visiblePlaces);
    if (!items.length) list.append(element('li', 'mfd__empty', '반경 2km 안에 표시할 장소가 없습니다.'));
  }

  async function refresh(position) {
    pending = true;
    lastRequest = performance.now();
    lastPosition = { ...position };
    meta.textContent = '현재 위치 기준 · 조회 중';
    try {
      places = await getNearby(position);
      radar = createRadar(places);
      radarHost.replaceChildren(radar.element);
      show(selected);
      radar.update(heading);
      meta.textContent = '현재 위치 기준 · 2km';
    } catch {
      places = [];
      radar = createRadar(places);
      radarHost.replaceChildren(radar.element);
      show(selected);
      radar.update(heading);
      meta.textContent = '주변 장소 조회 실패';
      list.replaceChildren(element('li', 'mfd__empty', '주변 장소를 불러오지 못했습니다. 잠시 후 다시 시도합니다.'));
    } finally {
      pending = false;
    }
  }

  section.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (button) show(button.dataset.filter);
  });
  list.replaceChildren(element('li', 'mfd__empty', '주변 장소를 불러오는 중입니다.'));

  return {
    update(state) {
      heading = state.heading;
      radar.update(heading);
      items.forEach(entry => entry.update(heading));
      const now = performance.now();
      if (!pending && (!lastPosition || (now - lastRequest >= REFRESH_MS && traveled(lastPosition, state.position) >= MOVE_KM) ||
          now - lastRequest >= STATIONARY_REFRESH_MS)) {
        void refresh(state.position);
      }
    }
  };
}
