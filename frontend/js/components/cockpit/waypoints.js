import { distanceMeters } from './navigation.js';

export const WAYPOINT_RANGE_METERS = 200;
export function createWaypoints() {
  const places = [];
  const key = place => `${place.lat},${place.lng}`;
  return {
    list: () => places.map(place => ({ ...place })),
    nearest(position, visible) {
      return visible.filter(place => !places.some(added => key(added) === key(place)))
        .map(place => ({ ...place, meters: distanceMeters(position, place) }))
        .filter(place => place.meters <= WAYPOINT_RANGE_METERS)
        .sort((a, b) => a.meters - b.meters)[0] ?? null;
    },
    add(place) {
      if (places.length >= 5 || places.some(added => key(added) === key(place))) return false;
      places.push({ name: place.name, lat: place.lat, lng: place.lng });
      return true;
    },
    remove(index) { places.splice(index, 1); }
  };
}
