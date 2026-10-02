import { ApiError } from '../http/api-response.js';

const invalid = () => new ApiError(400, 'VALIDATION_ERROR', '올바른 비행 기록이 필요합니다.');
function point(value) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200 ||
      !value.name.isWellFormed() || /\p{Cc}/u.test(value.name) ||
      !Number.isFinite(value.lat) || value.lat < -90 || value.lat > 90 ||
      !Number.isFinite(value.lng) || value.lng < -180 || value.lng > 180) throw invalid();
  return { name: value.name.trim(), lat: value.lat, lng: value.lng };
}
export function validateFlight(body) {
  if (Object.keys(body).some(key => !['runId', 'start', 'end', 'waypoints', 'flightSeconds', 'distanceMeters'].includes(key)) ||
      typeof body.runId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.runId) ||
      !Array.isArray(body.waypoints) || body.waypoints.length > 5 ||
      !Number.isFinite(body.flightSeconds) || body.flightSeconds < 0 || body.flightSeconds > 604800 ||
      !Number.isFinite(body.distanceMeters) || body.distanceMeters < 0 || body.distanceMeters > 50000000) throw invalid();
  const waypoints = body.waypoints.map(point);
  if (new Set(waypoints.map(place => `${place.lat},${place.lng}`)).size !== waypoints.length) throw invalid();
  return { runId: body.runId, start: point(body.start), end: point(body.end), waypoints,
    flightSeconds: Math.round(body.flightSeconds), distanceMeters: Math.round(body.distanceMeters) };
}
