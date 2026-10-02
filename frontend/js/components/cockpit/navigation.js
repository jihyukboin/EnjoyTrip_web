// 구면 위 이동: 속도는 노트, 시간은 초, 위·경도와 방위는 도 단위다.
const RAD = Math.PI / 180;
const EARTH_RADIUS_METERS = 6371008.8;
const KNOT_TO_METERS_PER_SECOND = 1852 / 3600;

export const DEPARTURE = Object.freeze({ lat: 37.566826, lng: 126.9786567 });

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
