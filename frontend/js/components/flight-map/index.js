// Kakao 지도 SDK(flight-map.html, autoload=false)로 유리창 너머 지도를 그린다
// https://apis.map.kakao.com/web/documentation/
// 지도 이동은 앞으로 비행 로직이 맡으므로 마우스·키보드로는 움직이지 않게 잠근다
const DEFAULT_CENTER = { lat: 37.566826, lng: 126.9786567 }; // 서울시청
const DEFAULT_LEVEL = 5;

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
      level: DEFAULT_LEVEL,
      // 위성 사진 + 지명: 상공에서 내려다보는 느낌
      mapTypeId: kakao.maps.MapTypeId.HYBRID,
      draggable: false,
      scrollwheel: false,
      disableDoubleClickZoom: true,
      keyboardShortcuts: false
    });
  });
}
