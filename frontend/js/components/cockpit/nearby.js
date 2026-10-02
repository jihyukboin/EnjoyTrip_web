// API 조회와 현재 비행 위치에 따른 거리·방향 갱신은 별도로 처리한다.
import { getNearby } from '../../api/nearby-api.js';
import { element } from './dom.js';
import { clockPosition, formatDistance } from './format.js';
import { PLACE_CATEGORIES } from './mock.js';
import { createRadar } from './radar.js';
import { nearbyPlaces, placeKey, shouldRefreshNearby } from './nearby-state.js';

export function createNearby(section, onVisiblePlaces = () => {}, onSelect = () => {}) {
  const list = section.querySelector('[data-nearby-list]');
  const meta = section.querySelector('.mfd__meta');
  const radarHost = section.querySelector('[data-nearby-radar]');
  const filters = section.querySelectorAll('[data-filter]');
  const refreshButton = section.querySelector('[data-nearby-refresh]');
  const hint = section.querySelector('[data-nearby-hint]');
  let places = [], visible = [], rows = [];
  let radar = createRadar([]);
  let position, lastPosition, lastRequest = 0, lastPaint = -Infinity;
  let heading = 0, selected = 'all', selectedKey = '', signature = '';
  let pending = false, failed = false, loaded = false;
  radarHost.append(radar.element);

  function select(key) {
    const place = visible.find(entry => placeKey(entry) === key);
    if (!place) return;
    selectedKey = key;
    rows.forEach(row => row.button.setAttribute('aria-pressed', String(row.key === key)));
    onSelect(place);
  }

  function paint() {
    if (!position) return;
    const all = nearbyPlaces(places, position);
    const matching = all.filter(place => selected === 'all' || place.category === selected);
    visible = matching.slice(0, 5);
    filters.forEach(button => {
      const category = button.dataset.filter;
      const count = all.filter(place => category === 'all' || place.category === category).length;
      button.setAttribute('aria-pressed', String(category === selected));
      button.textContent = `${({ all: '전체', AT4: '관광', FD6: '음식', AD5: '숙소' })[category]}`;
      button.title = `${count}곳`;
    });
    const nextSignature = visible.map(placeKey).join('|');
    if (signature !== nextSignature || !rows.length) {
      signature = nextSignature;
      if (selectedKey && !visible.some(place => placeKey(place) === selectedKey)) {
        selectedKey = '';
        onSelect(null);
      }
      rows = visible.map(place => {
        const item = element('li');
        const button = element('button', 'place');
        button.type = 'button';
        button.style.setProperty('--place-color', `var(--place-${place.category})`);
        button.setAttribute('aria-pressed', String(placeKey(place) === selectedKey));
        const text = element('span', 'place__text');
        const detail = element('span', 'place__meta');
        const clock = element('span', 'place__clock');
        text.append(element('span', 'place__name', place.name), detail);
        button.title = place.name;
        button.append(element('span', 'place__marker', PLACE_CATEGORIES[place.category].glyph), text, clock);
        button.addEventListener('click', () => select(placeKey(place)));
        item.append(button);
        return { item, button, detail, clock, key: placeKey(place) };
      });
      list.replaceChildren(...rows.map(row => row.item));
      onVisiblePlaces(visible);
    }
    rows.forEach((row, index) => {
      const place = visible[index];
      row.detail.textContent = `${PLACE_CATEGORIES[place.category].label} · ${formatDistance(place.distance)}`;
      row.clock.textContent = `${clockPosition(place.bearing, heading)}시`;
    });
    if (!rows.length) list.replaceChildren(element('li', 'mfd__empty',
      !loaded && pending ? '주변 장소를 찾고 있습니다…' : failed ? '연결을 확인한 뒤 새로고침해주세요.' : '현재 반경 2km 안에 해당 장소가 없습니다.'));
    radar = createRadar(visible);
    radarHost.replaceChildren(radar.element);
    radar.update(heading);
    meta.textContent = pending ? '새로운 주변 장소를 찾는 중…' : failed ? '연결 지연 · 자동 재시도 중' : '내 위치 반경 2km · 이동에 따라 갱신';
    hint.textContent = `${visible.length}곳 표시${matching.length > 5 ? ` / ${matching.length}곳 중 가까운 순` : ''} · 장소를 눌러 경유지 추가`;
  }

  async function refresh() {
    if (pending || !position) return;
    pending = true;
    lastRequest = performance.now();
    lastPosition = { ...position };
    refreshButton.disabled = true;
    paint();
    try { places = await getNearby(lastPosition); loaded = true; failed = false; }
    catch { failed = true; }
    finally { pending = false; refreshButton.disabled = false; paint(); }
  }

  section.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (button) { selected = button.dataset.filter; paint(); }
  });
  refreshButton.addEventListener('click', () => void refresh());
  return {
    select: place => select(placeKey(place)),
    clearSelection() {
      selectedKey = '';
      rows.forEach(row => row.button.setAttribute('aria-pressed', 'false'));
    },
    update(state) {
      position = state.position;
      heading = state.heading;
      radar.update(heading);
      const now = performance.now();
      if (now - lastPaint >= 1000) { lastPaint = now; paint(); }
      if (!document.hidden && !pending && shouldRefreshNearby({ position, lastPosition, elapsed: now - lastRequest, failed })) void refresh();
    }
  };
}
