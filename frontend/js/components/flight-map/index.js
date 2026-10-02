import { DEPARTURE } from '../cockpit/navigation.js';
import { placeKey } from '../cockpit/nearby-state.js';

// 비행기가 화면 중앙에 머물도록 지도 중심을 실제 비행 좌표에 맞춘다.
// setCenter는 애니메이션을 누적하지 않아 연속적인 위치 갱신에 적합하다.
export function initializeFlightMap(route, onSelectPlace = () => {}) {
  const container = document.querySelector('[data-flight-map]');
  const status = document.querySelector('.flight-map__status');
  const retry = document.querySelector('[data-map-retry]');
  let map;
  let lastUpdate = 0;
  let position = route?.start ?? DEPARTURE;
  let failed = false;
  let places = [];
  let placePins = [];
  let focusedPlace = null;
  const center = () => focusedPlace ?? position;
  const renderPlaces = () => {
    placePins.forEach(pin => pin.setMap(null));
    placePins = [];
    if (!map) return;
    for (const place of places) {
      const point = new kakao.maps.LatLng(place.lat, place.lng);
      const marker = new kakao.maps.Marker({ map, position: point, title: place.name });
      kakao.maps.event.addListener(marker, 'click', () => onSelectPlace(place));
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'flight-map__place';
      label.dataset.category = place.category;
      label.setAttribute('aria-label', `${place.name} 지도에서 확인`);
      const active = focusedPlace && placeKey(focusedPlace) === placeKey(place);
      label.setAttribute('aria-pressed', String(Boolean(active)));
      label.textContent = place.name;
      label.title = place.name;
      label.addEventListener('click', () => onSelectPlace(place));
      const overlay = new kakao.maps.CustomOverlay({ map, position: point, content: label, yAnchor: 2.6, zIndex: active ? 4 : 2 });
      placePins.push(marker, overlay);
    }
  };
  container.dataset.state = 'loading';
  status.textContent = '지도를 불러오는 중입니다.';

  const fail = () => {
    failed = true;
    container.dataset.state = 'error';
    status.textContent = '지도를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.';
    retry.hidden = false;
  };
  retry.addEventListener('click', () => location.reload());
  const timeout = setTimeout(fail, 15000);
  if (!globalThis.kakao?.maps?.load) {
    clearTimeout(timeout);
    fail();
  } else {
    kakao.maps.load(() => {
      if (failed) return;
      clearTimeout(timeout);
      try {
        map = new kakao.maps.Map(container, {
          center: new kakao.maps.LatLng(position.lat, position.lng),
          level: 4,
          mapTypeId: kakao.maps.MapTypeId.SKYVIEW,
          draggable: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          keyboardShortcuts: false
        });
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        if (route) {
          const path = [route.start, route.end].map(point => new kakao.maps.LatLng(point.lat, point.lng));
          new kakao.maps.Polyline({ map, path, strokeWeight: 4, strokeColor: '#8bcfff',
            strokeOpacity: 0.95, strokeStyle: 'shortdash', endArrow: true });
          path.forEach((point, index) => {
            new kakao.maps.Marker({ map, position: point, title: index ? '도착' : '출발' });
            const label = document.createElement('span');
            label.className = 'flight-map__endpoint';
            label.textContent = index ? '도착' : '출발';
            new kakao.maps.CustomOverlay({ map, position: point, content: label, yAnchor: 2.6, zIndex: 3 });
          });
        }
        renderPlaces();
        container.dataset.state = 'ready';
        status.textContent = '';
        const resize = new ResizeObserver(() => {
          map.relayout();
          map.setCenter(new kakao.maps.LatLng(center().lat, center().lng));
        });
        resize.observe(container);
        window.addEventListener('pagehide', event => { if (!event.persisted) resize.disconnect(); });
      } catch {
        map = undefined;
        fail();
      }
    });
  }

  return {
    isReady: () => Boolean(map),
    focusPlace(place) {
      focusedPlace = place;
      renderPlaces();
      if (map) map.setCenter(new kakao.maps.LatLng(center().lat, center().lng));
    },
    setPlaces(visiblePlaces) {
      places = visiblePlaces;
      renderPlaces();
    },
    update(state, now) {
      position = state.position;
      if (!map || now - lastUpdate < 1000 / 30) return;
      lastUpdate = now;
      map.setCenter(new kakao.maps.LatLng(center().lat, center().lng));
    }
  };
}
