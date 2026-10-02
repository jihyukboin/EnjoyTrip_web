import { ApiError } from './api-response.js';

const MAX_BODY = 16 * 1024;

export function validateMutation(request, origin) {
  if (request.headers.origin !== origin) {
    throw new ApiError(403, 'REQUEST_ORIGIN_REJECTED', '허용되지 않은 요청 출처입니다.');
  }
  if (request.headers['x-enjoytrip-request'] !== '1') {
    throw new ApiError(403, 'REQUEST_HEADER_REQUIRED', '요청 확인 헤더가 필요합니다.');
  }
  if (request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON 형식으로 요청해주세요.');
  }
}

export async function readJson(request) {
  // Use data events so rejecting a body does not destroy the socket before the error response.
  const text = await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const cleanup = () => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAbort);
    };
    const fail = (error) => { cleanup(); request.resume(); reject(error); };
    const onData = (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) return fail(new ApiError(413, 'PAYLOAD_TOO_LARGE', '요청 본문이 너무 큽니다.'));
      chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { reject(new ApiError(400, 'INVALID_JSON', '올바른 UTF-8 JSON 본문이 필요합니다.')); }
    };
    const onError = () => fail(new ApiError(400, 'INVALID_JSON', '요청 본문을 읽지 못했습니다.'));
    const onAbort = onError;
    request.on('data', onData);
    request.on('end', onEnd);
    request.on('error', onError);
    request.on('aborted', onAbort);
    if (Number(request.headers['content-length']) > MAX_BODY) {
      fail(new ApiError(413, 'PAYLOAD_TOO_LARGE', '요청 본문이 너무 큽니다.'));
    }
  });
  let body;
  try { body = JSON.parse(text); }
  catch { throw new ApiError(400, 'INVALID_JSON', '올바른 JSON 본문이 필요합니다.'); }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'JSON 객체가 필요합니다.');
  }
  return body;
}

// 본문이 필요 없는 변경 요청(DELETE 등)은 빈 객체만 허용한다
export function validateEmpty(body) {
  if (Object.keys(body).length) {
    throw new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해주세요.',
      Object.fromEntries(Object.keys(body).map(key => [key, '지원하지 않는 필드입니다.'])));
  }
  return {};
}
