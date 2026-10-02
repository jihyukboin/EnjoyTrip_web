import { ApiError } from '../http/api-response.js';
import { transaction } from '../db/database.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { publicMember } from './repository.js';

export function createMemberService({ db, members, authService, now = Date.now }) {
  return {
    async register({ id, name, password }) {
      const hash = await hashPassword(password);
      try { return publicMember(members.create(id, name, hash, now())); }
      catch (error) {
        if (error.code === 'ERR_SQLITE_ERROR' && error.errcode === 2067) {
          throw new ApiError(409, 'ID_ALREADY_EXISTS', '이미 사용 중인 아이디입니다.', { id: '이미 사용 중인 아이디입니다.' });
        }
        throw error;
      }
    },
    me(token) { return publicMember(authService.authenticate(token)); },
    async update(token, { name, password }) {
      const member = authService.authenticate(token);
      const hash = password ? await hashPassword(password) : null;
      return transaction(db, () => {
        const current = authService.revalidate(token, member);
        const updated = members.update(member.id, name ?? current.name, hash ?? current.password_hash, now());
        if (hash) authService.revokeOtherSessions(token, member.id);
        return publicMember(updated);
      });
    },
    async remove(token, { currentPassword }) {
      const member = authService.authenticate(token);
      if (!await verifyPassword(currentPassword, member.password_hash)) {
        throw new ApiError(401, 'INVALID_CURRENT_PASSWORD', '현재 비밀번호를 확인해주세요.');
      }
      transaction(db, () => {
        authService.revalidate(token, member);
        members.remove(member.id);
      });
    }
  };
}
