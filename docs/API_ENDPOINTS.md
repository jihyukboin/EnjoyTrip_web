# F107·F108 엔드포인트 명세

작성·갱신일: 2026-10-02 / 상태: **8개 엔드포인트 구현, 프런트엔드 연결 완료**

접두어는 `/api`다. 서버 실행 후 아래 계약으로 호출할 수 있다. 인증·검증·헤더·캐시·오류 공통 정책은 [BACKEND_API.md](BACKEND_API.md), 저장 구조는 [SQLITE.md](SQLITE.md)를 따른다. 비밀번호 찾기는 아이디로 임시 비밀번호를 발급한다. 회원은 이메일을 저장하지 않는다.

## 목록

| 요구사항 | 메서드 | 경로 | 인증 | 성공 | 기능 |
| --- | --- | --- | --- | --- | --- |
| F107 | POST | `/api/members` | 불필요 | 201 | 회원가입 |
| F107 | GET | `/api/members/me` | 필요 | 200 | 본인 조회·로그인 상태 확인 |
| F107 | PATCH | `/api/members/me` | 필요 | 200 | 이름·선택적 비밀번호 수정 |
| F107 | PUT | `/api/members/me/password` | 필요 | 204 | 현재 비밀번호 확인 후 변경 |
| F107 | DELETE | `/api/members/me` | 필요 | 204 | 현재 비밀번호 확인 후 탈퇴 |
| F108 | POST | `/api/auth/login` | 불필요 | 200 | 로그인·세션 발급 |
| F108 | POST | `/api/auth/logout` | 불필요* | 204 | 현재 세션 폐기 |
| F108 | POST | `/api/auth/temporary-password` | 불필요 | 200 | 임시 비밀번호 발급 |

*로그아웃은 유효한 세션이 있으면 삭제하고, 없거나 만료되어도 204와 쿠키 삭제를 반환한다. 변경 요청 공통 보호는 동일하게 적용한다. `HEAD` 등 목록에 없는 메서드는 해당 API 경로의 `405`로 처리한다.

모든 변경 요청에 JSON Content-Type, `X-EnjoyTrip-Request: 1`, 올바른 Origin이 필요하다. 아래의 엔드포인트별 오류 외에도 공통 규칙의 403·413·415·429·500 등이 적용될 수 있다. 비밀번호 해시 작업을 포함하는 API는 IP당 합산 10분 20회 제한을 공유한다.

## 공통 객체

회원 공개 객체 예시:

```json
{
  "id": "traveler",
  "name": "여행자",
  "joinedAt": "2026-10-02T03:00:00.000Z",
  "createdAt": "2026-10-02T03:00:00.000Z",
  "updatedAt": "2026-10-02T03:00:00.000Z"
}
```

필드 오류 예시:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해주세요.",
    "fields": { "id": "아이디는 영문 소문자와 숫자 4~20자로 입력해주세요." }
  }
}
```

`fields`는 선택적이다. 비밀번호·토큰 해시는 응답에 포함하지 않는다. 임시 비밀번호 API만 생성한 원문 임시 비밀번호를 반환한다.

## 1. 회원가입 — POST /api/members

요청:

```json
{
  "id": "traveler",
  "name": "여행자",
  "password": "example-only-passphrase-2026"
}
```

세 필드는 모두 필수다. 성공 `201`의 본문은 `{ "data": { "member": <회원 공개 객체> } }`다. 가입 시 자동 로그인하지 않으며 새 세션을 발급하지 않는다. 프런트엔드는 가입 완료 후 로그인 화면으로 이동한다.

오류: `400 VALIDATION_ERROR` (`email` 등 미지원 필드 포함), `409 ID_ALREADY_EXISTS`.

## 2. 본인 조회 — GET /api/members/me

본문 없이 세션 쿠키로 호출한다. 성공 `200`:

```json
{
  "data": {
    "member": {
      "id": "traveler",
          "name": "여행자",
      "joinedAt": "2026-10-02T03:00:00.000Z",
      "createdAt": "2026-10-02T03:00:00.000Z",
      "updatedAt": "2026-10-02T03:00:00.000Z"
    }
  }
}
```

오류: 쿠키 누락·세션 만료·삭제된 회원은 모두 `401 UNAUTHENTICATED`. 다른 회원의 ID를 입력하는 조회 경로는 제공하지 않는다.

## 3. 본인 수정 — PATCH /api/members/me

요청:

```json
{ "name": "새 여행자", "password": "" }
```

`name`, `password`를 선택적으로 수정한다. 비밀번호는 생략하거나 빈 문자열이면 유지한다. 새 비밀번호가 있으면 현재 세션을 유지하고 다른 세션을 폐기한다. 성공 `200`은 `{ "data": { "member": <수정된 회원 공개 객체> } }`다. `updatedAt`을 갱신하고 현재 세션은 유지한다.

오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`. 아이디는 수정할 수 없다.

## 4. 비밀번호 변경 — PUT /api/members/me/password

요청:

```json
{
  "currentPassword": "example-only-passphrase-2026",
  "newPassword": "another-example-passphrase-2026"
}
```

두 필드는 필수다. 세션과 현재 비밀번호를 모두 확인하고 새 비밀번호 해시를 저장한다. 성공 `204`, 본문 없음. 현재 세션을 포함한 모든 세션을 폐기하고 쿠키를 삭제한다. 프런트엔드는 다시 로그인을 안내한다.

오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `401 INVALID_CURRENT_PASSWORD`.

## 5. 회원탈퇴 — DELETE /api/members/me

요청:

```json
{ "currentPassword": "example-only-passphrase-2026" }
```

`currentPassword`는 필수다. 세션과 현재 비밀번호 검증 후 본인 회원·세션·게시글을 삭제한다. 성공 `204`, 본문 없음, 쿠키 삭제. 삭제한 아이디는 재가입할 수 있다. 탈퇴 확인 UI는 프런트엔드가 제공한다.

오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `401 INVALID_CURRENT_PASSWORD`.

## 6. 로그인 — POST /api/auth/login

요청:

```json
{
  "id": "traveler",
  "password": "example-only-passphrase-2026"
}
```

두 필드는 필수다. 성공 `200`:

```json
{
  "data": {
    "member": {
      "id": "traveler",
          "name": "여행자",
      "joinedAt": "2026-10-02T03:00:00.000Z",
      "createdAt": "2026-10-02T03:00:00.000Z",
      "updatedAt": "2026-10-02T03:00:00.000Z"
    },
    "sessionExpiresAt": "2026-10-03T03:00:00.000Z"
  }
}
```

`Set-Cookie`로 세션을 발급한다. 응답에는 토큰을 포함하지 않는다. 현재 브라우저의 이전 세션은 폐기한다.

오류: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`. 미등록 아이디와 틀린 비밀번호 모두 같은 코드와 메시지 `아이디 또는 비밀번호가 올바르지 않습니다.`를 반환한다.

## 7. 로그아웃 — POST /api/auth/logout

요청:

```json
{}
```

성공 `204`, 본문 없음. 현재 세션만 삭제하고 쿠키를 만료시킨다. 쿠키가 없거나 세션이 만료된 요청에도 같은 결과를 반환한다. 프런트엔드는 메모리의 회원 상태를 지운다.

오류: 공통 요청 검증 오류만 적용한다. 세션 부재 자체는 오류가 아니다.

## 임시 비밀번호 — POST /api/auth/temporary-password

요청: `{ "id": "traveler" }`. 성공 200: `{ "data": { "temporaryPassword": "<10자 임시 비밀번호>" } }`.

원문은 이 응답에서만 반환하고 DB에는 해시를 저장한다. 기존 비밀번호와 모든 세션은 무효화된다. 프런트엔드에서 임시 비밀번호를 표시한 뒤 로그인 화면으로 이동한다.

오류: `400 VALIDATION_ERROR`, `404 MEMBER_NOT_FOUND` (id 필드 오류), 동시 계정 변경 시 `409 MEMBER_CHANGED`.

## 연동 순서와 확인 항목

1. 가입 → 로그인 → 본인 조회 → 이름 수정.
2. 로그아웃 후 본인 조회가 401인지 확인.
3. 재로그인 → 비밀번호 변경 → 기존 세션이 401인지 확인 → 새 비밀번호 로그인.
4. 임시 비밀번호 발급 → 기존 세션이 401인지 확인 → 임시 비밀번호로 로그인.
5. 탈퇴 → 기존 세션·비밀번호로 접근 불가 확인.

프런트엔드는 401이면 로그인 상태를 해제하고, 400의 필드 오류를 폼에 표시하며, 409는 아이디 중복을 안내한다. 429는 `Retry-After` 이후 재시도를 안내한다. 204에는 JSON 파싱을 하지 않는다. `INVALID_CURRENT_PASSWORD`는 입력 재시도를 안내할 수 있으며 세션 자체가 폐기된 것은 아니다. 위 흐름은 `tests/api.test.js`에서 검증한다.

## CLI 호출 예시 (PowerShell)

같은 서버 주소로 Origin을 설정한다. 로그인 시 받은 세션을 다음 요청에 전달한다.

```powershell
$apiHeaders = @{ Origin = 'http://127.0.0.1:3000'; 'X-EnjoyTrip-Request' = '1' }
$signupBody = @{ id = 'traveler'; name = '여행자'; password = 'example-only-passphrase-2026' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/members' -Method Post -Headers $apiHeaders -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($signupBody))
$loginBody = @{ id = 'traveler'; password = 'example-only-passphrase-2026' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/auth/login' -Method Post -Headers $apiHeaders -ContentType 'application/json' -Body $loginBody -SessionVariable enjoyTripSession
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/members/me' -WebSession $enjoyTripSession
```

위 계정은 예시이며 미리 생성되어 있지 않다. 예시 비밀번호는 실제 계정에서 사용하지 않는다.

## 게시글 등록 — POST /api/posts

로그인 세션이 필요합니다. 요청: `{ "title": "여행 후기", "content": "여행 이야기" }`.

제목은 trim 후 1~100자, 본문은 trim 후 1~2,000자입니다. 본문의 줄바꿈·탭은 유지합니다. 작성자 필드는 받지 않고 세션에서 확인합니다. 공통 JSON·Origin·사용자 지정 헤더·16 KiB 본문 제한과 요청 횟수 제한을 적용합니다.

성공 201:

```json
{
  "data": {
    "post": {
      "id": 1,
      "title": "여행 후기",
      "content": "여행 이야기",
      "author": { "id": "writer", "name": "작성자" },
      "createdAt": "2026-10-02T03:00:00.000Z"
    }
  }
}
```

오류: 비로그인·만료 세션 `401 UNAUTHENTICATED`, 입력 오류·미지원 필드 `400 VALIDATION_ERROR` (title/content 필드 오류), 공통 403·413·415·429 오류. 회원 탈퇴 시 작성글도 삭제합니다.

`frontend/js/api/post-api.js`에서 호출하며 `/post/write`에 성공·실패를 표시합니다. 비로그인 사용자는 `/login?returnTo=%2Fpost%2Fwrite`로 이동하고 로그인 성공 후 글쓰기 화면으로 돌아옵니다. `tests/post.test.js`에서 실제 프런트 API와 서버를 연결해 저장·작성자 확인·입력 검증·세션 만료·파일 DB 영속성을 검증합니다.
