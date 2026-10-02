import { ApiError } from '../http/api-response.js';

// 필드별 최대 길이·허용 제어문자·오류 문구. 본문만 줄바꿈과 탭을 허용한다
const singleLine = /\p{Cc}/u;
const rules = {
  title: { maximum: 100, controls: singleLine, label: '제목은' },
  content: { maximum: 2000, controls: /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u, label: '본문은', optional: true },
  origin: { maximum: 200, controls: singleLine, label: '시작점은' },
  destination: { maximum: 200, controls: singleLine, label: '도착점은' }
};

export function validatePost(body) {
  const fields = {};
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(rules, key)) fields[key] = '지원하지 않는 필드입니다.';
  }
  const result = {};
  for (const [key, { maximum, controls, label, optional }] of Object.entries(rules)) {
    const value = optional && body[key] === undefined ? '' : body[key];
    if (typeof value !== 'string' || !value.isWellFormed()) {
      fields[key] = '올바른 문자열이 필요합니다.';
      continue;
    }
    const trimmed = value.trim();
    if ((!optional && !trimmed) || [...trimmed].length > maximum || controls.test(trimmed)) {
      fields[key] = `${label} ${optional ? 0 : 1}~${maximum}자로 입력해주세요.`;
    }
    result[key] = trimmed;
  }
  if (Object.keys(fields).length) throw new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해주세요.', fields);
  return result;
}

// ?page= 값이 없으면 1페이지, 있으면 1 이상의 정수만 허용한다
export function validatePage(searchParams) {
  const value = searchParams.get('page');
  if (value === null) return 1;
  if (!/^[1-9]\d{0,5}$/.test(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해주세요.', { page: '페이지는 1 이상의 정수여야 합니다.' });
  }
  return Number(value);
}

export function validateSearch(params) {
  const field = params.get('field') ?? 'title';
  const q = (params.get('q') ?? '').trim();
  const scope = params.get('scope') ?? '';
  const fields = {};
  if (!['title', 'content', 'origin', 'destination'].includes(field)) fields.field = '올바른 검색 항목을 선택해주세요.';
  if (!q.isWellFormed() || [...q].length > 200 || singleLine.test(q)) fields.q = '검색어는 200자 이내로 입력해주세요.';
  if (!['', 'post'].includes(scope)) fields.scope = '올바른 목록 범위가 필요합니다.';
  if (Object.keys(fields).length) throw new ApiError(400, 'VALIDATION_ERROR', '검색 조건을 확인해주세요.', fields);
  return { field, q, scope };
}
