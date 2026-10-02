import { ApiError } from '../http/api-response.js';
import { transaction } from '../db/database.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { publicMember } from './repository.js';

export function createMemberService({ db, members, authService, now = Date.now }) {
  return {
    async register({ email, name, password }) {
      const hash = await hashPassword(password);
      try { return publicMember(members.create(email, name, hash, now())); }
      catch (error) {
        if (error.code === 'ERR_SQLITE_ERROR' && error.errcode === 2067) {
          throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', '이미 가입된 이메일입니다.');
        }
        throw error;
      }
    },
    me(token) { return publicMember(authService.authenticate(token)); },
    rename(token, { name }) {
      const member = authService.authenticate(token);
      return publicMember(members.rename(member.id, name, now()));
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
