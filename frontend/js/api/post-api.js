import { request } from './client.js';

const postPath = id => `/api/posts/${encodeURIComponent(id)}`;

export const createPost = async ({ title, content }) =>
  (await request('/api/posts', { method: 'POST', body: { title, content } })).post;

export const listPosts = (page = 1) => request(`/api/posts?page=${encodeURIComponent(page)}`);

export const getPost = async id => (await request(postPath(id))).post;

export const getNotice = async id => (await request(`/api/notices/${encodeURIComponent(id)}`)).notice;

export const updatePost = async (id, { title, content }) =>
  (await request(postPath(id), { method: 'PUT', body: { title, content } })).post;

export const deletePost = id => request(postPath(id), { method: 'DELETE', body: {} });
