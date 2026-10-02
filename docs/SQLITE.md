# SQLite 설계 — 회원·인증

작성·갱신일: 2026-10-02 / 상태: **버전 1 스키마 및 저장 로직 구현**

F107·F108의 정보를 SQLite에 저장한다. 서버 첫 실행 시 DB 폴더·파일·버전 1 스키마가 자동 생성된다. API 공통 규칙은 [BACKEND_API.md](BACKEND_API.md), HTTP 계약은 [API_ENDPOINTS.md](API_ENDPOINTS.md)를 참조한다.

## 실행 환경과 저장 위치

| 항목 | 구현 |
| --- | --- |
| 런타임 | 기존 Node.js 24 계열, 확인 환경 24.21.0 |
| DB 접근 | Node.js 내장 `node:sqlite`, 준비된 문장과 바인딩 사용 |
| 확인된 SQLite | 현재 로컬 환경에서 3.53.4 |
| DB 경로 | 저장소 기준 `backend/data/enjoytrip.sqlite` |
| 테스트 DB | `:memory:` 또는 테스트별 임시 파일 |
| 스키마 관리 | `backend/db/schema.sql`, `PRAGMA user_version = 1`; 다음 변경 시 마이그레이션 추가 |

SQLite는 별도 DB 서버 없이 파일로 데이터를 저장한다. 팀원은 같은 스키마로 각자 로컬 DB를 생성한다. DB 버전은 Node.js 배포본에 따라 달라질 수 있으므로 구현 시 대상 런타임에서 확인한다. 내장 API 선택도 해당 Node.js 버전에서 지원되고 deprecated되지 않은 API를 기준으로 한다. [Node.js 24 SQLite 문서](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

실제 DB 파일과 `-wal`, `-shm`, `-journal` 파일, 백업 파일은 Git에 넣지 않는다. `.gitignore`에서 `backend/data/`와 SQLite 파일을 제외한다. 공유 대상은 스키마·마이그레이션·민감정보가 없는 테스트 데이터다. DB는 `frontend/`에 두거나 정적 파일로 제공하지 않는다. `DB_PATH`가 프런트엔드 경로를 가리키면 서버 시작을 거부한다.

## 공통 저장 규칙

- 시간은 UTC Unix epoch **밀리초 INTEGER**로 저장하고, API에서는 ISO 8601 UTC 문자열로 변환한다.
- 이메일은 trim 후 소문자로 정규화하여 저장·조회한다. 이는 서비스의 로그인 식별자 정책이다.
- 비밀번호 원문은 저장하지 않는다. `password_hash`에는 알고리즘·비용·salt·파생 키를 포함한 인코딩 문자열을 저장한다.
- 세션과 재설정 토큰은 32바이트 암호학적 난수를 base64url로 인코딩한다. DB에는 토큰 원문 대신 SHA-256 결과의 64자리 hex를 저장한다. 고엔트로피 토큰 해시와 비밀번호 해시는 목적이 다르다.
- SQL의 사용자 입력은 `prepare()`의 파라미터로 바인딩한다. 문자열 결합으로 SQL을 만들지 않는다.
- 모든 연결에서 `PRAGMA foreign_keys = ON`을 적용·확인한다. SQLite는 연결별 외래 키 설정이 필요하다. [SQLite 외래 키 문서](https://sqlite.org/foreignkeys.html)

## 테이블

| 테이블 | 목적 | 주요 관계 |
| --- | --- | --- |
| `members` | 회원 식별자·프로필·비밀번호 해시 | `id`가 회원 PK, `email`은 UNIQUE |
| `sessions` | 서버 저장형 로그인 세션 | `member_id` → `members.id`, 탈퇴 시 CASCADE |
| `password_reset_tokens` | 비밀번호 찾기용 일회성 토큰 | `member_id` → `members.id`, 탈퇴 시 CASCADE |

회원 공개 필드는 `id`, `email`, `name`, `createdAt`, `updatedAt`이다. `password_hash`, 세션·재설정 토큰 해시는 응답에 포함하지 않는다.

## 스키마

아래 SQL은 초기 DB 생성 구조다. `backend/db/database.js`는 초기 생성과 `user_version = 1` 설정을 하나의 트랜잭션으로 수행한다. 재실행 시 버전 1이면 유지하고 알 수 없는 버전이면 시작을 거부한다. 길이·이메일 형식·비밀번호 정책은 API 계층에서도 검증한다.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE members (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
) STRICT;

CREATE INDEX sessions_member_id_idx ON sessions(member_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE password_reset_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
) STRICT;

CREATE INDEX password_reset_member_id_idx ON password_reset_tokens(member_id);
CREATE INDEX password_reset_expires_at_idx ON password_reset_tokens(expires_at);
```

## 갱신·폐기 규칙

- 가입: 이메일 UNIQUE 충돌을 HTTP `409 EMAIL_ALREADY_EXISTS`로 변환한다.
- 로그인: 비밀번호 검증 후 새 세션을 저장한다. 클라이언트가 보낸 세션 값을 새 세션 ID로 재사용하지 않는다.
- 로그아웃: 현재 세션 행만 삭제한다.
- 비밀번호 변경·재설정: 회원의 해시와 `updated_at`을 갱신하고 해당 회원의 모든 세션·재설정 토큰을 삭제한다.
- 탈퇴: 회원을 물리 삭제한다. 현재 범위에서는 외래 키 CASCADE로 세션·재설정 토큰도 삭제한다. 향후 게시판 등에서 회원을 참조하면 삭제 정책을 재검토한다.
- 재설정 요청: 새 토큰 저장 시 해당 회원의 이전 재설정 토큰을 삭제한다.
- 만료: 조회 시 항상 `expires_at > 현재 시각`을 검사한다. 만료 행 정리 여부와 인증 유효성은 별개다.

비밀번호 변경·재설정의 여러 갱신은 하나의 트랜잭션으로 처리한다. 재설정에서는 만료 검증·토큰 소비·비밀번호 갱신·세션 폐기를 같은 트랜잭션에 넣어 동시 재사용을 막는다. 비밀번호 해시 계산은 트랜잭션 밖에서 먼저 수행하고, 적용 직전에 토큰과 회원 상태를 다시 확인한다.

## 검증 기준

이메일 중복 차단, 외래 키 위반 차단, 탈퇴 CASCADE, 트랜잭션 실패 시 롤백, 만료·소비된 토큰 거부, 파일 DB를 다시 열었을 때 회원 정보 유지 여부를 검증한다. 스키마·테스트는 공유하고 실제 회원 데이터는 공유하지 않는다.

`tests/database.test.js`와 `tests/api.test.js`에서 위 조건을 검증한다. DB는 단일 Node.js 서버에서 작은 동기 SQL 작업으로 접근하며, 비용이 큰 비밀번호 해시는 비동기로 계산한다. `PRAGMA foreign_keys`는 DB 연결에서 설정한다.
