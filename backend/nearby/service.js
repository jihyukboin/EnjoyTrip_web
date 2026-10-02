import { ApiError } from '../http/api-response.js';

const ENDPOINT = 'https://apis.data.go.kr/B551011/KorService2/locationBasedList2';
const TYPES = new Map([['12', 'AT4'], ['39', 'FD6'], ['32', 'AD5']]);
const RADIUS_METERS = 2000;
const RAD = Math.PI / 180;

function distanceAndBearing(origin, target) {
  const lat1 = origin.lat * RAD;
  const lat2 = target.lat * RAD;
  const deltaLat = lat2 - lat1;
  const deltaLng = (target.lng - origin.lng) * RAD;
  const arc = 2 * Math.asin(Math.min(1, Math.sqrt(
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  )));
  const bearing = (Math.atan2(Math.sin(deltaLng) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)) / RAD + 360) % 360;
  return { distance: arc * 6371.0088, bearing };
}

export function createNearbyService({ key, fetchImpl = fetch, now = Date.now }) {
  let cached;

  async function query(position) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('serviceKey', decodeURIComponent(key));
    for (const [name, value] of Object.entries({ numOfRows: '500', pageNo: '1', MobileOS: 'ETC',
      MobileApp: 'EnjoyTrip', _type: 'json', mapX: String(position.lng), mapY: String(position.lat),
      radius: String(RADIUS_METERS) })) url.searchParams.set(name, value);
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Tour API HTTP error');
    const payload = await response.json();
    if (payload?.response?.header?.resultCode !== '0000') throw new Error('Tour API result error');
    const items = payload.response.body?.items?.item;
    return Array.isArray(items) ? items : items && typeof items === 'object' ? [items] : [];
  }

  return async position => {
    if (!key) throw new ApiError(503, 'NEARBY_NOT_CONFIGURED', '공공데이터 API 설정이 필요합니다.');
    if (cached && now() - cached.time < 20000 && distanceAndBearing(cached.position, position).distance < 0.4) {
      return cached.places;
    }
    try {
      const items = await query(position);
      const allPlaces = items.map(item => {
        const lat = Number(item.mapy);
        const lng = Number(item.mapx);
        const category = TYPES.get(String(item.contenttypeid));
        if (!category || !item.title || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const location = distanceAndBearing(position, { lat, lng });
        return { name: String(item.title), category, lat, lng, ...location };
      }).filter(place => place && place.distance <= RADIUS_METERS / 1000)
        .sort((a, b) => a.distance - b.distance);
      const counts = new Map();
      const places = allPlaces.filter(place => {
        const count = counts.get(place.category) ?? 0;
        counts.set(place.category, count + 1);
        return count < 12;
      });
      cached = { position, places, time: now() };
      return places;
    } catch {
      throw new ApiError(502, 'NEARBY_UNAVAILABLE', '주변 장소를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };
}
