import { request } from './client.js';

export const createPost = async ({ title, content }) =>
  (await request('/api/posts', { method: 'POST', body: { title, content } })).post;

export const listPosts = (page = 1) => request(`/api/posts?page=${encodeURIComponent(page)}`);
