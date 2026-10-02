import { request } from './client.js';

export async function getNearby(position) {
  const params = new URLSearchParams({ lat: String(position.lat), lng: String(position.lng) });
  const result = await request(`/api/nearby?${params}`);
  return result.places;
}
