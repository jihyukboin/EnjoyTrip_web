import { ApiError } from '../http/api-response.js';

const emailPattern = /^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const passwordFields = new Set(['password', 'newPassword', 'currentPassword']);

export function validateFields(body, expected) {
  const errors = new Map();
  const result = {};
  for (const key of Object.keys(body)) if (!expected.includes(key)) errors.set(key, '지원하지 않는 필드입니다.');
  for (const key of expected) {
    let value = body[key];
    if (typeof value !== 'string' || !value.isWellFormed()) {
      errors.set(key, '올바른 문자열이 필요합니다.');
      continue;
    }
    if (key === 'email') {
      value = value.trim().toLowerCase();
      if (value.length > 254 || value.split('@')[0].length > 64 || !emailPattern.test(value)) {
        errors.set(key, '올바른 이메일 형식이 필요합니다.');
      }
    } else if (key === 'name') {
      value = value.trim();
      if ([...value].length < 1 || [...value].length > 50 || /\p{Cc}/u.test(value)) errors.set(key, '이름은 제어문자 없이 1~50자로 입력해주세요.');
    } else if (passwordFields.has(key)) {
      if ([...value].length < 15 || [...value].length > 128) errors.set(key, '비밀번호는 15~128자로 입력해주세요.');
    } else if (key === 'token' && !/^[A-Za-z0-9_-]{43}$/.test(value)) {
      // A malformed token is still a token failure, not an account lookup.
      throw new ApiError(400, 'INVALID_RESET_TOKEN', '재설정 링크가 유효하지 않거나 만료되었습니다.');
    }
    result[key] = value;
  }
  if (errors.size) throw new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해주세요.', Object.fromEntries(errors));
  return result;
}
