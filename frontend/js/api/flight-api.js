import { request } from './client.js';

export const saveFlight = async (postId, body) =>
  (await request(`/api/posts/${encodeURIComponent(postId)}/flight-records`, { method: 'POST', body })).record;
export const listFlights = async postId =>
  (await request(`/api/posts/${encodeURIComponent(postId)}/flight-records`)).records;
