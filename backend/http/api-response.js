export class ApiError extends Error {
  constructor(status, code, message, fields, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.headers = headers;
  }
}

export function sendJson(response, status, data, headers = {}) {
  const content = status === 204 ? null : Buffer.from(JSON.stringify(data));
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(content ? { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': content.length } : {}),
    ...headers
  });
  response.end(content ?? undefined);
}

export function sendApiError(response, error) {
  const known = error instanceof ApiError;
  sendJson(response, known ? error.status : 500, {
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : '요청을 처리하지 못했습니다.',
      ...(known && error.fields ? { fields: error.fields } : {})
    }
  }, known ? error.headers : {});
}
