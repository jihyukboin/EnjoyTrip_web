import { request } from './client.js';

export const getAdminDashboard = () => request('/api/admin/dashboard');

export const listNotices = async () => (await request('/api/admin/notices')).notices;

export const createNotice = async ({ title, content }) =>
  (await request('/api/admin/notices', { method: 'POST', body: { title, content } })).notice;

export const updateNotice = async (id, { title, content }) =>
  (await request(`/api/admin/notices/${encodeURIComponent(id)}`, { method: 'PUT', body: { title, content } })).notice;

export const deleteNotice = id => request(`/api/admin/notices/${encodeURIComponent(id)}`, { method: 'DELETE', body: {} });
