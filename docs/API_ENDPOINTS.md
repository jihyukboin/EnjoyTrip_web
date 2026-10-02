# F107·F108 엔드포인트 명세

작성·갱신일: 2026-10-02 / 상태: **9개 엔드포인트 구현, 이메일 발송은 미연결**

접두어는 `/api`다. 서버 실행 후 아래 계약으로 호출할 수 있다. 인증·검증·헤더·캐시·오류 공통 정책은 [BACKEND_API.md](BACKEND_API.md), 저장 구조는 [SQLITE.md](SQLITE.md)를 따른다. 비밀번호 재설정 전달은 기본 disabled이며 로컬 console 모드만 제공한다.

## 목록

| 요구사항 | 메서드 | 경로 | 인증 | 성공 | 기능 |
| --- | --- | --- | --- | --- | --- |
| F107 | POST | `/api/members` | 불필요 | 201 | 회원가입 |
| F107 | GET | `/api/members/me` | 필요 | 200 | 본인 조회·로그인 상태 확인 |
| F107 | PATCH | `/api/members/me` | 필요 | 200 | 표시 이름 수정 |
| F107 | PUT | `/api/members/me/password` | 필요 | 204 | 현재 비밀번호 확인 후 변경 |
| F107 | DELETE | `/api/members/me` | 필요 | 204 | 현재 비밀번호 확인 후 탈퇴 |
| F108 | POST | `/api/auth/login` | 불필요 | 200 | 로그인·세션 발급 |
| F108 | POST | `/api/auth/logout` | 불필요* | 204 | 현재 세션 폐기 |
| F108 | POST | `/api/auth/password-reset-requests` | 불필요 | 202 | 재설정 토큰 발급·전달 요청 |
| F108 | POST | `/api/auth/password-resets` | 재설정 토큰 | 204 | 새 비밀번호 설정 |

*로그아웃은 유효한 세션이 있으면 삭제하고, 없거나 만료되어도 204와 쿠키 삭제를 반환한다. 변경 요청 공통 보호는 동일하게 적용한다. `HEAD` 등 목록에 없는 메서드는 해당 API 경로의 `405`로 처리한다.

모든 변경 요청에 JSON Content-Type, `X-EnjoyTrip-Request: 1`, 올바른 Origin이 필요하다. 아래의 엔드포인트별 오류 외에도 공통 규칙의 403·413·415·429·500 등이 적용될 수 있다. 비밀번호 해시 작업을 포함하는 API와 재설정 요청은 IP당 합산 10분 20회 제한을 공유한다.

## 공통 객체

회원 공개 객체 예시:

```json
{
  "id": 1,
  "email": "traveler@example.com",
  "name": "여행자",
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
    "fields": { "email": "올바른 이메일 형식이 필요합니다." }
  }
}
```

`fields`는 선택적이다. 비밀번호·토큰 원문 또는 해시는 어떤 응답에도 포함하지 않는다.

## 1. 회원가입 — POST /api/members

요청:

```json
{
  "email": "traveler@example.com",
  "name": "여행자",
  "password": "example-only-passphrase-2026"
}
```

세 필드는 필수다. 성공 `201`의 본문은 `{ "data": { "member": <회원 공개 객체> } }`다. 가입 시 자동 로그인하지 않으며 새 세션을 발급하지 않는다. 프런트엔드는 가입 완료 후 로그인 화면으로 이동한다.

오류: `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_EXISTS`.

## 2. 본인 조회 — GET /api/members/me

본문 없이 세션 쿠키로 호출한다. 성공 `200`:

```json
{
  "data": {
    "member": {
      "id": 1,
      "email": "traveler@example.com",
      "name": "여행자",
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
{ "name": "새 여행자" }
```

`name`은 필수이며 현재 계약에서 수정 가능한 유일한 필드다. 성공 `200`은 `{ "data": { "member": <수정된 회원 공개 객체> } }`다. `updatedAt`을 갱신하고 현재 세션은 유지한다.

오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`. `email`, `password`, `id`를 함께 보내면 검증 오류다.

## 4. 비밀번호 변경 — PUT /api/members/me/password

요청:

```json
{
  "currentPassword": "example-only-passphrase-2026",
  "newPassword": "another-example-passphrase-2026"
}
```

두 필드는 필수다. 세션과 현재 비밀번호를 모두 확인하고 새 비밀번호 해시를 저장한다. 성공 `204`, 본문 없음. 현재 세션을 포함한 모든 세션·재설정 토큰을 폐기하고 쿠키를 삭제한다. 프런트엔드는 다시 로그인을 안내한다.

오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `401 INVALID_CURRENT_PASSWORD`.

## 5. 회원탈퇴 — DELETE /api/members/me

요청:

```json
{ "currentPassword": "example-only-passphrase-2026" }
```

`currentPassword`는 필수다. 세션과 현재 비밀번호 검증 후 본인 회원·세션·재설정 토큰을 삭제한다. 성공 `204`, 본문 없음, 쿠키 삭제. 삭제한 이메일은 재가입할 수 있다. 탈퇴 확인 UI는 프런트엔드가 제공한다.

오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `401 INVALID_CURRENT_PASSWORD`.

## 6. 로그인 — POST /api/auth/login

요청:

```json
{
  "email": "traveler@example.com",
  "password": "example-only-passphrase-2026"
}
```

두 필드는 필수다. 성공 `200`:

```json
{
  "data": {
    "member": {
      "id": 1,
      "email": "traveler@example.com",
      "name": "여행자",
      "createdAt": "2026-10-02T03:00:00.000Z",
      "updatedAt": "2026-10-02T03:00:00.000Z"
    },
    "sessionExpiresAt": "2026-10-03T03:00:00.000Z"
  }
}
```

`Set-Cookie`로 세션을 발급한다. 응답에는 토큰을 포함하지 않는다. 현재 브라우저의 이전 세션은 폐기한다.

오류: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`. 미등록 이메일과 틀린 비밀번호 모두 같은 코드와 메시지 `이메일 또는 비밀번호를 확인해주세요.`를 반환한다.

## 7. 로그아웃 — POST /api/auth/logout

요청:

```json
{}
```

성공 `204`, 본문 없음. 현재 세션만 삭제하고 쿠키를 만료시킨다. 쿠키가 없거나 세션이 만료된 요청에도 같은 결과를 반환한다. 프런트엔드는 메모리의 회원 상태를 지운다.

오류: 공통 요청 검증 오류만 적용한다. 세션 부재 자체는 오류가 아니다.

## 8. 비밀번호 찾기 요청 — POST /api/auth/password-reset-requests

요청:

```json
{ "email": "traveler@example.com" }
```

`email`은 필수다. 전달 수단이 사용 가능한 상태에서 성공 `202`:

```json
{
  "data": {
    "message": "등록된 계정이라면 비밀번호 재설정 안내가 전달됩니다."
  }
}
```

이메일 존재 여부는 응답으로 구분하지 않는다. 등록된 계정에는 15분 유효한 일회성 토큰을 저장하고 설정된 전달 수단으로 전달한다. 현재 제공하는 수단은 명시적으로 활성화한 로컬 콘솔이며, 실제 등록 이메일 전달은 추후 연동한다. 이전 재설정 토큰은 폐기한다. 아직 비밀번호·로그인 세션을 변경하지 않는다. 토큰은 API 본문으로 반환하지 않는다.

오류: 이메일 형식 오류 `400 VALIDATION_ERROR`, 전달 수단 미설정·실패 `503 RESET_DELIVERY_UNAVAILABLE`. 503의 계정 존재 여부 비노출 정책과 로컬 데모 대안은 공통 규칙을 따른다. 이메일 발송 수단은 아직 미결정이다.

## 9. 비밀번호 재설정 완료 — POST /api/auth/password-resets

요청:

```json
{
  "token": "<전달받은-일회성-토큰>",
  "newPassword": "another-example-passphrase-2026"
}
```

두 필드는 필수다. 세션 쿠키는 요구하지 않으며 토큰 자체를 검증한다. 성공 `204`, 본문 없음. 비밀번호를 변경하고 회원의 모든 세션·재설정 토큰을 폐기한다. 현재 브라우저 세션 쿠키도 삭제한다. 자동 로그인하지 않는다.

오류: 입력 오류 `400 VALIDATION_ERROR`; 만료·재사용·잘못된 토큰은 모두 `400 INVALID_RESET_TOKEN`과 메시지 `재설정 링크가 유효하지 않거나 만료되었습니다.`를 반환한다.

## 연동 순서와 확인 항목

1. 가입 → 로그인 → 본인 조회 → 이름 수정.
2. 로그아웃 후 본인 조회가 401인지 확인.
3. 재로그인 → 비밀번호 변경 → 기존 세션이 401인지 확인 → 새 비밀번호 로그인.
4. 재설정 요청 → 별도 전달받은 토큰으로 완료 → 토큰 재사용 거부 확인.
5. 탈퇴 → 기존 세션·비밀번호로 접근 불가 확인.

프런트엔드는 401이면 로그인 상태를 해제하고, 400의 필드 오류를 폼에 표시하며, 409는 이메일 중복을 안내한다. 429는 `Retry-After` 이후 재시도를 안내한다. 204에는 JSON 파싱을 하지 않는다. `INVALID_CURRENT_PASSWORD`는 입력 재시도를 안내할 수 있으며 세션 자체가 폐기된 것은 아니다. 위 흐름은 `tests/api.test.js`에서 검증한다.

## CLI 호출 예시 (PowerShell)

같은 서버 주소로 Origin을 설정한다. 로그인 시 받은 세션을 다음 요청에 전달한다.

```powershell
$apiHeaders = @{ Origin = 'http://127.0.0.1:3000'; 'X-EnjoyTrip-Request' = '1' }
$signupBody = @{ email = 'traveler@example.com'; name = '여행자'; password = 'example-only-passphrase-2026' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/members' -Method Post -Headers $apiHeaders -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($signupBody))
$loginBody = @{ email = 'traveler@example.com'; password = 'example-only-passphrase-2026' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/auth/login' -Method Post -Headers $apiHeaders -ContentType 'application/json' -Body $loginBody -SessionVariable enjoyTripSession
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/members/me' -WebSession $enjoyTripSession
```

위 계정은 예시이며 미리 생성되어 있지 않다. 예시 비밀번호는 실제 계정에서 사용하지 않는다.
