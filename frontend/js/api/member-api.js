import { request } from './client.js';
export { ApiError as MemberApiError } from './client.js';

export const signUp = async body => (await request('/api/members', { method: 'POST', body })).member;
export const logIn = async body => (await request('/api/auth/login', { method: 'POST', body })).member;
export const logOut = () => request('/api/auth/logout', { method: 'POST', body: {} });
export async function getCurrentMember() {
  try { return (await request('/api/members/me')).member; }
  catch (error) {
    if (error.code === 'UNAUTHENTICATED') return null;
    throw error;
  }
}
export const updateCurrentMember = async ({ name, password = '' }) =>
  (await request('/api/members/me', { method: 'PATCH', body: { name, password } })).member;
export const withdrawCurrentMember = async ({ password }) => {
  try { await request('/api/members/me', { method: 'DELETE', body: { currentPassword: password } }); }
  catch (error) {
    if (error.field === 'currentPassword' || error.code === 'INVALID_CURRENT_PASSWORD') error.field = 'password';
    throw error;
  }
};
export const issueTemporaryPassword = async body =>
  (await request('/api/auth/temporary-password', { method: 'POST', body })).temporaryPassword;
