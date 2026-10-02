import { loadKakaoMaps } from './sdk.js';

function locate(maps, address) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('주소 위치 조회가 지연되고 있습니다. 다시 시도해주세요.')), 15000);
    new maps.services.Geocoder().addressSearch(address, (results, status) => {
      clearTimeout(timeout);
      if (status !== maps.services.Status.OK || !results.length) {
        reject(new Error('선택한 주소의 위치를 찾지 못했습니다. 주소를 다시 확인해주세요.'));
        return;
      }
      resolve(new maps.LatLng(Number(results[0].y), Number(results[0].x)));
    });
  });
}

// 작성·수정·조회 화면이 같은 지도 표시를 사용한다. 주소 변경 시 이전 결과는 버린다.
export function createRouteMap(root, { canvas = root.querySelector('[data-map-canvas]') } = {}) {
  const status = root.querySelector('[data-map-status]');
  const addresses = root.querySelector('[data-map-addresses]');
  let map;
  let overlays = [];
  let revision = 0;

  return async (origin, destination) => {
    const current = ++revision;
    overlays.forEach(overlay => overlay.setMap(null));
    overlays = [];
    canvas.hidden = true;
    root.hidden = !origin || !destination;
    if (root.hidden) {
      root.removeAttribute('aria-busy');
      return;
    }
    addresses.textContent = `${origin} → ${destination}`;
    status.textContent = '비행 경로를 불러오는 중입니다.';
    root.setAttribute('aria-busy', 'true');
    try {
      const maps = await loadKakaoMaps();
      if (current !== revision) return;
      const points = await Promise.all([locate(maps, origin), locate(maps, destination)]);
      if (current !== revision) return;
      canvas.hidden = false;
      map ??= new maps.Map(canvas, { center: points[0], level: 4, scrollwheel: false });
      map.relayout();
      const samePoint = points[0].equals(points[1]);
      const labels = samePoint ? ['출발 · 도착'] : ['출발', '도착'];
      labels.forEach((label, index) => {
        const content = document.createElement('span');
        content.className = 'route-map__marker';
        content.textContent = label;
        overlays.push(new maps.CustomOverlay({ map, position: points[index], content, yAnchor: 2.6, zIndex: 3 }));
        overlays.push(new maps.Marker({ map, position: points[index], title: label }));
      });
      overlays.push(new maps.Polyline({ map, path: points, strokeWeight: 4,
        strokeColor: '#3182f6', strokeOpacity: 0.8, strokeStyle: 'shortdash', endArrow: true }));
      if (samePoint) {
        map.setCenter(points[0]);
        map.setLevel(6);
      } else {
        const bounds = new maps.LatLngBounds();
        points.forEach(point => bounds.extend(point));
        map.setBounds(bounds, 56, 48, 48, 48);
        // 두 지점을 맞춘 배율보다 두 단계 멀리서 주변 지역까지 보여준다.
        map.setLevel(Math.min(map.getLevel() + 2, 14));
      }
      status.textContent = '두 지점을 직선으로 연결한 비행 경로입니다.';
    } catch (error) {
      if (current === revision) status.textContent = error.message;
    } finally {
      if (current === revision) root.removeAttribute('aria-busy');
    }
  };
}
