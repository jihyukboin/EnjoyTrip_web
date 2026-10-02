import { bearingDegrees, distanceMeters } from './navigation.js';

export const placeKey = place => `${place.lat},${place.lng}:${place.name}`;

export function nearbyPlaces(places, position, category = 'all') {
  return places.map(place => ({ ...place,
    distance: distanceMeters(position, place) / 1000,
    bearing: bearingDegrees(position, place)
  })).filter(place => place.distance <= 2 && (category === 'all' || place.category === category))
    .sort((a, b) => a.distance - b.distance);
}

export function shouldRefreshNearby({ position, lastPosition, elapsed, failed }) {
  if (!lastPosition) return true;
  if (failed) return elapsed >= 8000;
  return elapsed >= 300000 || (elapsed >= 8000 && distanceMeters(position, lastPosition) >= 400);
}
