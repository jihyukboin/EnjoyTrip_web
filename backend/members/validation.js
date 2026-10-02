import { ApiError } from '../http/api-response.js';

const passwordFields = new Set(['password', 'newPassword', 'currentPassword']);

export function validateFields(body, expected, optional = [], passwordMinimum = 8) {
  const errors = new Map();
  const result = {};
  for (const key of Object.keys(body)) if (!expected.includes(key)) errors.set(key, '지원하지 않는 필드입니다.');
  for (const key of expected) {
    if (optional.includes(key) && !(key in body)) continue;
    let value = body[key];
    if (typeof value !== 'string' || !value.isWellFormed()) {
      errors.set(key, '올바른 문자열이 필요합니다.');
      continue;
    }
    if (key === 'id') {
      if (!/^[a-z0-9]{4,20}$/.test(value)) errors.set(key, '아이디는 영문 소문자와 숫자 4~20자로 입력해주세요.');
    } else if (key === 'name') {
      value = value.trim();
      if ([...value].length < 1 || [...value].length > 30 || /\p{Cc}/u.test(value)) errors.set(key, '이름은 제어문자 없이 1~30자로 입력해주세요.');
    } else if (passwordFields.has(key)) {
      if (key === 'password' && optional.includes(key) && value === '') { result[key] = value; continue; }
      const minimum = key === 'currentPassword' ? 1 : passwordMinimum;
      if ([...value].length < minimum || [...value].length > 128) errors.set(key, `비밀번호는 ${minimum}~128자로 입력해주세요.`);
    }
    result[key] = value;
  }
  if (errors.size) throw new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해주세요.', Object.fromEntries(errors));
  return result;
}
