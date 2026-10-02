import { randomInt } from 'node:crypto';
import { ApiError } from '../http/api-response.js';
import { transaction } from '../db/database.js';
import { publicMember } from '../members/repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { createToken, tokenHash, SESSION_MS } from './tokens.js';

const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
const invalidCredentials = () => new ApiError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.');

export function createAuthService({ db, members, auth, now = Date.now }) {
  const authenticate = (token) => {
    const member = token && auth.sessionMember(tokenHash(token), now());
    if (!member) throw unauthenticated();
    return member;
  };
  const revalidate = (token, earlierMember) => {
    const current = authenticate(token);
    if (current.password_hash !== earlierMember.password_hash) throw unauthenticated();
    return current;
  };

  return {
    authenticate,
    revalidate,
    revokeOtherSessions(token, id) { auth.revokeOthers(id, tokenHash(token)); },
    async issueTemporaryPassword({ id }) {
      const member = members.byUsername(id);
      if (!member) throw new ApiError(404, 'MEMBER_NOT_FOUND', '가입되지 않은 아이디입니다.', { id: '가입되지 않은 아이디입니다.' });
      const characters = 'abcdefghjkmnpqrstuvwxyz23456789';
      const password = Array.from({ length: 10 }, () => characters[randomInt(characters.length)]).join('');
      const hash = await hashPassword(password);
      transaction(db, () => {
        const current = members.byId(member.id);
        if (!current || current.password_hash !== member.password_hash) {
          throw new ApiError(409, 'MEMBER_CHANGED', '계정 정보가 변경되었습니다. 다시 시도해주세요.');
        }
        members.changePassword(member.id, hash, now());
        auth.revokeAll(member.id);
      });
      return password;
    },
    async login({ id, password }, oldToken) {
      const member = members.byUsername(id);
      const verified = await verifyPassword(password, member?.password_hash);
      if (!member || !verified) throw invalidCredentials();
      return transaction(db, () => {
        // Password hashing yields to other requests; re-read before granting a session.
        const current = members.byId(member.id);
        if (!current || current.password_hash !== member.password_hash) throw invalidCredentials();
        const time = now();
        const token = createToken();
        const expires = time + SESSION_MS;
        auth.prune(time);
        if (oldToken) auth.removeSession(tokenHash(oldToken));
        auth.insertSession(tokenHash(token), member.id, time, expires);
        return { token, member: publicMember(current), sessionExpiresAt: new Date(expires).toISOString() };
      });
    },
    logout(token) { if (token) auth.removeSession(tokenHash(token)); },
    async changePassword(token, { currentPassword, newPassword }) {
      const member = authenticate(token);
      if (!await verifyPassword(currentPassword, member.password_hash)) {
        throw new ApiError(401, 'INVALID_CURRENT_PASSWORD', '현재 비밀번호를 확인해주세요.');
      }
      const hash = await hashPassword(newPassword);
      transaction(db, () => {
        revalidate(token, member);
        members.changePassword(member.id, hash, now());
        auth.revokeAll(member.id);
      });
    }
  };
}
