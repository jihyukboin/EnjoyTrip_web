import { ApiError } from '../http/api-response.js';
import { transaction } from '../db/database.js';
import { publicMember } from '../members/repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { createToken, tokenHash, SESSION_MS, RESET_MS } from './tokens.js';

const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
const invalidCredentials = () => new ApiError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호를 확인해주세요.');
const invalidReset = () => new ApiError(400, 'INVALID_RESET_TOKEN', '재설정 링크가 유효하지 않거나 만료되었습니다.');
const deliveryUnavailable = () => new ApiError(503, 'RESET_DELIVERY_UNAVAILABLE', '비밀번호 재설정 전달 수단을 사용할 수 없습니다.');

export function createAuthService({ db, members, auth, now = Date.now, deliverReset = null }) {
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
    async login({ email, password }, oldToken) {
      const member = members.byEmail(email);
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
    },
    async requestReset({ email }) {
      // Reject every address uniformly when there is no delivery mechanism.
      if (!deliverReset) throw deliveryUnavailable();
      const member = members.byEmail(email);
      const token = createToken();
      const hash = tokenHash(token);
      if (member) transaction(db, () => {
        const time = now();
        auth.prune(time);
        auth.removeResets(member.id);
        auth.insertReset(hash, member.id, time, time + RESET_MS);
      });
      try {
        // Invoke the delivery adapter for both outcomes; its availability must not expose accounts.
        await deliverReset({ email, token, memberExists: Boolean(member) });
      } catch {
        auth.removeReset(hash);
        throw deliveryUnavailable();
      }
    },
    async completeReset({ token, newPassword }) {
      const hash = tokenHash(token);
      if (!auth.reset(hash, now())) throw invalidReset();
      const passwordHash = await hashPassword(newPassword);
      transaction(db, () => {
        const reset = auth.reset(hash, now());
        if (!reset) throw invalidReset();
        members.changePassword(reset.member_id, passwordHash, now());
        auth.revokeAll(reset.member_id);
      });
    }
  };
}
