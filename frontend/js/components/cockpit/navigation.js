// 구면 위 이동: 속도는 노트, 시간은 초, 위·경도와 방위는 도 단위다.
const RAD = Math.PI / 180;
const EARTH_RADIUS_METERS = 6371008.8;
const KNOT_TO_METERS_PER_SECOND = 1852 / 3600;

export const DEPARTURE = Object.freeze({ lat: 37.566826, lng: 126.9786567 });

export function distanceMeters(a, b) {
  const lat = (b.lat - a.lat) * RAD;
  const lng = (b.lng - a.lng) * RAD;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(lng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function bearingDegrees(a, b) {
  const delta = (b.lng - a.lng) * RAD;
  return (Math.atan2(Math.sin(delta) * Math.cos(b.lat * RAD),
    Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos(delta)) / RAD + 360) % 360;
}

// 무한 직선이 아니라 출발~도착 구간에서 가장 가까운 지점까지의 거리다.
export function routeDistanceMeters(position, start, end) {
  const length = distanceMeters(start, end);
  if (length < 1) return distanceMeters(position, start);
  const angular = distanceMeters(start, position) / EARTH_RADIUS_METERS;
  const difference = (bearingDegrees(start, position) - bearingDegrees(start, end)) * RAD;
  const along = Math.atan2(Math.sin(angular) * Math.cos(difference), Math.cos(angular)) * EARTH_RADIUS_METERS;
  if (along <= 0) return distanceMeters(position, start);
  if (along >= length) return distanceMeters(position, end);
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.sin(angular) * Math.sin(difference))))) * EARTH_RADIUS_METERS;
}

export function advancePosition(position, heading, speed, seconds) {
  const distance = Math.max(0, speed) * KNOT_TO_METERS_PER_SECOND * Math.max(0, seconds);
  const angular = distance / EARTH_RADIUS_METERS;
  const bearing = heading * RAD;
  const latitude = position.lat * RAD;
  const longitude = position.lng * RAD;
  const nextLatitude = Math.asin(Math.max(-1, Math.min(1,
    Math.sin(latitude) * Math.cos(angular) + Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing))));
  const nextLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude),
    Math.cos(angular) - Math.sin(latitude) * Math.sin(nextLatitude));
  return { lat: nextLatitude / RAD, lng: ((nextLongitude / RAD + 540) % 360) - 180 };
}
