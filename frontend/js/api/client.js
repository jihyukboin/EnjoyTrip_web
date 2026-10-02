// 같은 서버의 JSON API를 호출한다. 로그인 쿠키는 브라우저가 관리한다.
export class ApiError extends Error {
  constructor(message, field, code, status) {
    super(message);
    this.name = 'ApiError';
    this.field = field;
    this.code = code;
    this.status = status;
  }
}

export async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : {
        'Content-Type': 'application/json',
        'X-EnjoyTrip-Request': '1'
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    throw new ApiError('서버에 연결하지 못했습니다. 다시 시도해주세요.');
  }
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = result?.error;
    const [field, message] = Object.entries(error?.fields ?? {})[0] ?? [];
    throw new ApiError(message ?? error?.message ?? '요청을 처리하지 못했습니다.',
      field, error?.code, response.status);
  }
  return result?.data;
}

