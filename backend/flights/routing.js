import { createRoutingQuota } from './routing-quota.js';

export const ROUTING_MODES = ['walk', 'car', 'transit'];
const messages = {
  NOT_CONFIGURED: '서버의 카카오 REST API 키 설정이 필요합니다.',
  QUOTA_LIMIT: '오늘의 경로 계산 한도에 도달했습니다. 내일 다시 시도해주세요.',
  PERMISSION_REQUIRED: '카카오 앱의 길찾기 API 사용 권한을 확인해주세요.',
  NO_ROUTE: '이 구간의 경로를 찾을 수 없습니다.',
  UPSTREAM_ERROR: '경로 계산에 실패했습니다. 잠시 후 다시 시도해주세요.'
};
function normalize(distanceMeters, durationSeconds, paths) {
  if (![distanceMeters, durationSeconds].every(n => Number.isFinite(n) && n >= 0)) throw new Error('UPSTREAM_ERROR');
  const lines = paths.filter(Array.isArray).map(path => path.filter(p => Array.isArray(p) && p.length === 2 &&
    Number.isFinite(p[0]) && Math.abs(p[0]) <= 180 && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90)).filter(path => path.length > 1);
  if (distanceMeters > 0 && !lines.length) throw new Error('UPSTREAM_ERROR');
  return { distanceMeters, durationSeconds, lines };
}
const xy = p => `${p.lng},${p.lat}`;
const params = (start, end) => ({ start_x: start.lng, start_y: start.lat, end_x: end.lng, end_y: end.lat, input_coord: 'WGS84', output_coord: 'WGS84' });

export function createRoutingService({ db, key = '', now = Date.now, fetcher = fetch }) {
  const reserve = createRoutingQuota({ db, key, now });
  async function query(mode, endpoint, parameters) {
    reserve(mode);
    const response = await fetcher(`${endpoint}?${new URLSearchParams(parameters)}`, {
      headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(8000), redirect: 'error'
    });
    if (!response.ok) throw new Error([401, 403].includes(response.status) ? 'PERMISSION_REQUIRED' : 'UPSTREAM_ERROR');
    return response.json();
  }
  async function calculate(mode, itinerary) {
    const base = { mode, calculatedAt: new Date(now()).toISOString() };
    try {
      if (!key) throw new Error('NOT_CONFIGURED');
      const { start, end, waypoints } = itinerary;
      let result;
      if (mode === 'car') {
        const data = await query(mode, 'https://apis-navi.kakaomobility.com/v1/directions', {
          origin: xy(start), destination: xy(end), ...(waypoints.length ? { waypoints: waypoints.map(xy).join('|') } : {}), alternatives: 'false', summary: 'false'
        });
        const route = data.routes?.[0];
        if (route?.result_code !== 0) throw new Error('NO_ROUTE');
        const paths = (route.sections ?? []).flatMap(section => (section.roads ?? []).map(road => {
          const flat = road.vertexes ?? []; const pairs = [];
          for (let i = 0; i + 1 < flat.length; i += 2) pairs.push([flat[i], flat[i + 1]]);
          return pairs;
        }));
        result = normalize(route.summary?.distance, route.summary?.duration, paths);
      } else if (mode === 'walk') {
        const data = await query(mode, 'https://dapi.kakao.com/v2/routing/walk', {
          ...params(start, end), ...(waypoints.length ? { via_x: waypoints.map(p => p.lng).join(','), via_y: waypoints.map(p => p.lat).join(',') } : {})
        });
        if (data.status !== 'OK') throw new Error('NO_ROUTE');
        result = normalize(data.route?.properties?.totalDistance, data.route?.properties?.totalTime,
          (data.route?.legs ?? []).flatMap(leg => (leg.steps ?? []).map(step => step.path?.points)));
      } else {
        const points = [start, ...waypoints, end];
        result = { distanceMeters: 0, durationSeconds: 0, lines: [], segments: [] };
        for (let i = 1; i < points.length; i++) {
          if (xy(points[i - 1]) === xy(points[i])) continue;
          const data = await query(mode, 'https://dapi.kakao.com/v2/routing/publictraffic', params(points[i - 1], points[i]));
          if (data.status !== 'OK') throw new Error('NO_ROUTE');
          const route = data.routes?.filter(r => Number.isFinite(r.properties?.totalTime)).sort((a, b) => a.properties.totalTime - b.properties.totalTime)[0];
          if (!route) throw new Error('NO_ROUTE');
          const segment = normalize(route.properties.totalDistance, route.properties.totalTime, (route.steps ?? []).map(step => step.path?.points));
          result.distanceMeters += segment.distanceMeters; result.durationSeconds += segment.durationSeconds;
          result.lines.push(...segment.lines);
          result.segments.push({ start: points[i - 1].name, end: points[i].name, distanceMeters: segment.distanceMeters, durationSeconds: segment.durationSeconds });
        }
      }
      return { ...base, status: 'ready', ...result };
    } catch (error) {
      const code = Object.hasOwn(messages, error.message) ? error.message : 'UPSTREAM_ERROR';
      return { ...base, status: 'unavailable', code, message: messages[code] };
    }
  }
  return { calculate, calculateAll: itinerary => Promise.all(ROUTING_MODES.map(mode => calculate(mode, itinerary))) };
}
