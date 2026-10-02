import { request } from './client.js';

export const createPost = async ({ title, content }) =>
  (await request('/api/posts', { method: 'POST', body: { title, content } })).post;
