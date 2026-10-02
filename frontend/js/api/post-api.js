import { request } from './client.js';

const postPath = id => `/api/posts/${encodeURIComponent(id)}`;

export const createPost = async ({ title, content, origin, destination }) =>
  (await request('/api/posts', { method: 'POST', body: { title, content, origin, destination } })).post;

export const listPosts = (page = 1, { field = 'title', q = '', scope = '' } = {}) =>
  request(`/api/posts?${new URLSearchParams({ page, field, q, scope })}`);

export const getPost = async id => (await request(postPath(id))).post;

export const getNotice = async id => (await request(`/api/notices/${encodeURIComponent(id)}`)).notice;

export const updatePost = async (id, { title, content, origin, destination }) =>
  (await request(postPath(id), { method: 'PUT', body: { title, content, origin, destination } })).post;

export const deletePost = id => request(postPath(id), { method: 'DELETE', body: {} });
