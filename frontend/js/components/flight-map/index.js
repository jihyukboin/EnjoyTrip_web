import { DEPARTURE } from '../cockpit/navigation.js';

// 비행기가 화면 중앙에 머물도록 지도 중심을 실제 비행 좌표에 맞춘다.
// setCenter는 애니메이션을 누적하지 않아 연속적인 위치 갱신에 적합하다.
export function initializeFlightMap() {
  const container = document.querySelector('[data-flight-map]');
  const status = document.querySelector('.flight-map__status');
  const retry = document.querySelector('[data-map-retry]');
  let map;
  let lastUpdate = 0;
  let position = DEPARTURE;
  let failed = false;
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
        container.dataset.state = 'ready';
        status.textContent = '';
        const resize = new ResizeObserver(() => {
          map.relayout();
          map.setCenter(new kakao.maps.LatLng(position.lat, position.lng));
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
    update(state, now) {
      position = state.position;
      if (!map || now - lastUpdate < 1000 / 30) return;
      lastUpdate = now;
      map.setCenter(new kakao.maps.LatLng(position.lat, position.lng));
    }
  };
}
