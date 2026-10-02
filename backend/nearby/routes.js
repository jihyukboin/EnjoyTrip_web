import { ApiError, sendJson } from '../http/api-response.js';

export function createNearbyRoutes({ nearby }) {
  return new Map([['/api/nearby', new Map([['GET', {
    async action(body, token, response, request) {
      const params = new URL(request.url, 'http://localhost').searchParams;
      const latValue = params.get('lat');
      const lngValue = params.get('lng');
      const lat = Number(latValue);
      const lng = Number(lngValue);
      if (!latValue?.trim() || !lngValue?.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new ApiError(400, 'INVALID_POSITION', '올바른 위도와 경도가 필요합니다.');
      }
      sendJson(response, 200, { data: { places: await nearby({ lat, lng }) } });
    }
  }]])]]);
}
