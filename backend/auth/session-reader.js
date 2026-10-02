// 페이지 렌더링용: 요청의 세션 쿠키가 유효한 로그인 세션인지 확인한다
import { createAuthRepository } from './repository.js';
import { sessionToken, tokenHash } from './tokens.js';

export function createSessionReader({ db, now = Date.now }) {
  const auth = createAuthRepository(db);
  return (request) => {
    const token = sessionToken(request);
    return Boolean(token && auth.sessionMember(tokenHash(token), now()));
  };
}
