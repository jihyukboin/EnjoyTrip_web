// Kakao 지도 SDK(flight-map.html, autoload=false)로 화면 전체에 지도를 그린다
// https://apis.map.kakao.com/web/guide/
const DEFAULT_CENTER = { lat: 37.566826, lng: 126.9786567 }; // 서울시청
const DEFAULT_LEVEL = 3;

export function initializeFlightMap() {
  const container = document.querySelector('[data-flight-map]');
  if (!container) return;
  const status = document.querySelector('.flight-map__status');

  if (!globalThis.kakao?.maps) {
    status.textContent = '지도를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
    return;
  }
  kakao.maps.load(() => {
    new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      level: DEFAULT_LEVEL
    });
  });
}
