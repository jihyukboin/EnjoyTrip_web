// 페이지 렌더링용: 유효한 세션에서 로그인 상태와 관리자 여부를 확인한다
import { createAuthRepository } from './repository.js';
import { sessionToken, tokenHash } from './tokens.js';

export function createSessionReader({ db, now = Date.now }) {
  const auth = createAuthRepository(db);
  return (request) => {
    const token = sessionToken(request);
    const member = token ? auth.sessionMember(tokenHash(token), now()) : null;
    return { loggedIn: Boolean(member), isAdmin: member?.isAdmin === 1 };
  };
}
