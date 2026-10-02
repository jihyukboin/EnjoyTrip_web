import { ApiError } from '../http/api-response.js';

const LIMITS = [['title', '제목', 100, /\p{Cc}/u], ['content', '내용', 300, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u]];

// 제목·내용은 trim 후 검사한다. 내용은 줄바꿈만 허용한다.
export function validateNotice(body) {
  const fields = {};
  for (const key of Object.keys(body)) {
    if (!LIMITS.some(([name]) => name === key)) fields[key] = '지원하지 않는 필드입니다.';
  }
  const result = {};
  for (const [key, label, maximum, controls] of LIMITS) {
    const value = body[key];
    if (typeof value !== 'string' || !value.isWellFormed()) {
      fields[key] = '올바른 문자열이 필요합니다.';
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || [...trimmed].length > maximum || controls.test(trimmed)) {
      fields[key] = `${label}은 1~${maximum}자로 입력해주세요.`;
    }
    result[key] = trimmed;
  }
  if (Object.keys(fields).length) throw new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해주세요.', fields);
  return result;
}

export function validateEmpty(body) {
  if (Object.keys(body).length) {
    throw new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해주세요.',
      Object.fromEntries(Object.keys(body).map(key => [key, '지원하지 않는 필드입니다.'])));
  }
  return {};
}
