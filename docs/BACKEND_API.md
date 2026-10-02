# 회원·로그인 백엔드 API 공통 규칙

작성·갱신일: 2026-10-02 / 상태: **아이디 기반 API와 프런트엔드 연결 완료**

F107 회원관리와 F108 로그인관리를 SQLite 기반 API로 제공한다. 프런트엔드와 기획은 팀원 A, 이 API와 데이터 저장은 백엔드 담당자가 맡는다. 과제에서 요구하는 프런트엔드 기능에 실제 데이터 저장·인증을 추가하는 방향이다.

`npm start` 또는 `npm run dev`로 서버를 실행하면 `/api/*`와 SQLite 저장을 사용할 수 있다. [SQLite 설계](SQLITE.md), [엔드포인트 명세](API_ENDPOINTS.md)를 함께 참조한다. 프런트엔드 화면은 실제 API를 호출하며 비밀번호 찾기는 임시 비밀번호 발급을 사용한다.

## 범위와 연동 기준

- F107: 회원가입, 본인 정보 조회·수정, 비밀번호 변경, 회원탈퇴.
- F108: 로그인, 로그아웃, 임시 비밀번호 발급.
- 기본 연동은 기존 Node.js 서버가 프런트엔드와 API를 같은 origin으로 제공하는 방식이다.
- 개발 기준 주소: `http://127.0.0.1:3000`, API 접두어: `/api`.
- `/login` 같은 HTML 페이지 경로와 `/api/auth/login` 같은 API 경로는 구분한다.
- 프런트엔드는 상대 경로로 호출한다. `localhost`와 `127.0.0.1`을 섞어 쓰지 않는다.
- 별도 프런트엔드 개발 서버가 필요하면 정확한 origin을 합의하고 쿠키·CORS·OPTIONS 계약을 추가한다. 기본 설계에서는 CORS를 허용하지 않는다.

## 필드·검증 정책

| 필드 | 정책 |
| --- | --- |
| `id` | 로그인 아이디; 영문 소문자·숫자 4~20자, 변경 불가 |
| `name` | 표시 이름; trim 후 1~30 Unicode 코드 포인트, 제어문자 거부, 중복 허용 |
| `password`, `newPassword` | 8~128 Unicode 코드 포인트; 공백·Unicode 허용, trim·대소문자 변환·묵시적 잘림 금지 |
| `currentPassword` | 1~128자; 로그인 비밀번호도 기존 원문 검증을 위해 1~128자를 허용 |

프런트엔드 방식에 맞춰 별도 아이디로 로그인하고 이름·선택적 새 비밀번호를 한 번에 수정한다. 회원 이메일은 받지 않으며, `email` 필드는 미지원 필드로 거부한다. 소셜 로그인·관리자 회원목록은 현재 범위에 포함하지 않는다.

본문은 UTF-8 JSON 객체이며 명세에 없는 필드와 잘못된 타입·잘못된 Unicode 문자열을 `400 VALIDATION_ERROR`로 거부한다. 파싱할 수 없는 JSON·UTF-8은 `400 INVALID_JSON`이다. 원시 본문은 최대 16 KiB, 초과하면 `413 PAYLOAD_TOO_LARGE`다. 비밀번호 확인 입력은 화면에서 비교하며 API는 확정된 비밀번호 하나만 받는다.

## 응답 계약

성공은 `{ "data": ... }`, 실패는 `{ "error": { "code": "...", "message": "..." } }`다. 필드 오류에는 선택적으로 `fields`를 포함한다. 예시는 [엔드포인트 명세](API_ENDPOINTS.md)에 있다.

JSON 응답의 `Content-Type`은 `application/json; charset=utf-8`, 모든 API 응답의 캐시는 `Cache-Control: no-store`다. `204`에는 JSON 본문이 없다. SQL·스택·비밀번호·토큰·해시는 오류 응답에 노출하지 않는다. 인증 실패를 HTML 리다이렉트로 바꾸지 않는다.

| 상태 | 용도 |
| --- | --- |
| 200 / 201 | 조회·수정·로그인·임시 비밀번호 / 가입 |
| 204 | 로그아웃·탈퇴·비밀번호 변경 |
| 400 | JSON 파싱·유효성 오류 |
| 401 | 미인증·만료된 세션, 잘못된 로그인·현재 비밀번호 |
| 403 | 요청 origin 또는 사용자 지정 요청 헤더 검증 실패 |
| 404 / 405 | 없는 API / 등록 경로의 미지원 메서드 (`Allow` 포함) |
| 409 | 아이디 중복, 임시 비밀번호 발급 중 계정 변경 |
| 413 / 415 | 본문 크기 초과 / 지원하지 않는 Content-Type |
| 429 / 500 | 요청 제한 / 내부 오류 |

## 세션 인증

서버가 발급한 난수 토큰을 `enjoytrip_session` 쿠키로 전달하고, SQLite의 해시와 비교한다. 회원 ID는 쿠키나 요청 본문에서 신뢰하지 않고 세션에서 찾는다. 본인 리소스는 `/members/me`로 접근한다.

- 세션은 발급 시점부터 24시간 유효한 고정 만료다. 자동 연장과 로그인 유지 옵션은 없다.
- 쿠키: `HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`, `Domain` 생략.
- HTTPS 운영 환경에서는 `Secure`를 적용한다. 로컬 HTTP 개발 환경에서만 생략한다.
- 로그인마다 새 세션을 발급하고 현재 브라우저의 이전 세션은 폐기한다. 다른 기기의 세션은 유지한다.
- 로그아웃은 현재 세션을 폐기한다. 마이페이지 PATCH의 비밀번호 변경은 현재 세션을 유지하고 다른 세션을 폐기한다. 별도 PUT 비밀번호 변경·임시 비밀번호·탈퇴는 모든 세션을 폐기한다.
- 쿠키 삭제는 동일한 이름·경로로 `Max-Age=0`을 설정한다.
- 세션 토큰을 JSON으로 반환하거나 localStorage/sessionStorage에 저장하지 않는다.

쿠키 속성과 세션 폐기는 [OWASP 세션 관리 지침](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)을 참고했다.

## 변경 요청 보호와 암호화

모든 POST·PATCH·PUT·DELETE 요청은 `Content-Type: application/json`과 `X-EnjoyTrip-Request: 1`을 요구한다. 서버는 설정된 서비스 origin과 `Origin`의 정확한 일치를 검사한다. 누락·`null`·다른 origin은 `403 REQUEST_ORIGIN_REJECTED`, 사용자 지정 헤더 오류는 `403 REQUEST_HEADER_REQUIRED`로 거부한다. 로그아웃도 `{}` JSON을 보낸다. GET은 상태를 바꾸지 않는다. CLI 테스트에서는 `Origin`을 명시한다. 이 정책은 로그인·가입·임시 비밀번호 요청에도 적용한다. [OWASP CSRF 지침](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

비밀번호는 Node.js `node:crypto`의 비동기 `scrypt`를 사용한다. 비용은 `N=131072`, `r=8`, `p=1`, `maxmem=256 MiB`, 난수 salt 16바이트, 파생 키 64바이트다. 해시 문자열 형식은 `scrypt$131072$8$1$<salt-base64url>$<key-base64url>`다. 비교에는 동일 길이 버퍼의 `timingSafeEqual`을 사용한다. 로그인 실패는 아이디 존재 여부와 무관하게 같은 오류를 반환하고, 미등록 계정에도 같은 비용의 더미 검증을 수행한다. [OWASP 비밀번호 저장 지침](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

단일 서버의 가입·로그인·회원 수정·비밀번호 변경·탈퇴·임시 비밀번호는 IP당 합산 10분 20회로 제한한다. 초과 시 `429 RATE_LIMITED`와 `Retry-After` 초 단위를 반환한다. 메모리 제한기는 서버 재시작 시 초기화된다. 해시 작업은 동시에 최대 2개, 대기는 최대 20개이며 대기 한도 초과도 429로 응답한다. IP는 실제 연결 상대 주소를 사용하며 `X-Forwarded-For`를 신뢰하지 않는다. 프록시 운영 시 신뢰할 프록시 범위와 IP 처리 정책을 별도로 설정해야 한다.

## 비밀번호 찾기

프런트엔드는 `POST /api/auth/temporary-password`로 아이디를 보내고 응답의 `temporaryPassword`를 화면에 표시한다. 10자 암호학적 난수 비밀번호를 생성하여 해시로 저장하고 모든 세션을 폐기한다. 미등록 아이디는 필드 오류가 포함된 404다. API 응답만 원문 임시 비밀번호를 포함하며 DB·로그에는 저장하지 않는다.

## 코드 구조와 설정

```text
backend/
  app.js                   /api 요청을 기존 페이지 처리보다 먼저 분기
  http/                    JSON 본문·응답·공통 요청 검증
  db/                      DB 연결·스키마
  members/                 회원 HTTP 처리·업무 로직·저장 로직
  auth/                    로그인·세션·임시 비밀번호·비밀번호 해시
  data/                    로컬 DB 파일 (Git 제외)
```

프로젝트 루트 `.env.local`의 `DB_PATH`, `APP_ORIGIN`, `COOKIE_SECURE`로 설정한다. DB 경로는 저장소 기준이며 프런트엔드 공개 경로는 거부한다. 환경변수 파일이 없으면 HOST·PORT로 로컬 origin을 계산한다. `.env.local`에서 HOST·PORT를 바꾸면 APP_ORIGIN도 맞춘다. 운영 및 비로컬 origin에는 HTTPS·Secure 쿠키가 필요하다. 로컬은 `.env.local`, 운영은 `.env.production`으로 관리한다.

## 프런트엔드 호출 예시

아래 예시는 같은 origin에서 서버를 실행한 뒤 사용한다.

```js
const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    'X-EnjoyTrip-Request': '1'
  },
  body: JSON.stringify({ id: 'traveler', password })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error.message);
// result.data.member를 화면 상태에 반영한다. 쿠키는 브라우저가 관리한다.
```

새로고침 시 `GET /api/members/me`로 로그인 상태를 복원한다. 401이면 비로그인 상태를 표시한다. 204 응답에는 `response.json()`을 호출하지 않는다. 화면 경로와 폼 디자인은 프런트엔드 담당자가 정한다.
