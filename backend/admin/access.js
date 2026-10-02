import { ApiError } from '../http/api-response.js';

// 로그인 세션을 확인한 뒤 관리자 권한이 없으면 403으로 거부한다
export function requireAdmin(auth, token) {
  const member = auth.authenticate(token);
  if (member.isAdmin !== 1) throw new ApiError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.');
  return member;
}
