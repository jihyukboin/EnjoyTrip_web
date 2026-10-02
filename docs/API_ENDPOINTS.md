# API 명세

같은 서버의 `/api` 경로를 사용합니다. 변경 요청은 JSON 본문과 `Content-Type: application/json`, `X-EnjoyTrip-Request: 1`, 서비스 주소와 일치하는 `Origin`이 필요합니다. 로그아웃은 빈 객체 `{}`를 보냅니다.

인증은 브라우저의 `enjoytrip_session` 쿠키로 처리합니다. 성공 응답은 `{ "data": ... }`, 오류 응답은 `{ "error": { "code": "...", "message": "...", "fields": {} } }`입니다. `fields`는 선택적이며 204 응답에는 본문이 없습니다.

## 회원·로그인

| 메서드 | 경로 | 요청 본문 | 성공 응답 |
| --- | --- | --- | --- |
| POST | `/api/members` | `id`, `name`, `password` | 201, `data.member` |
| GET | `/api/members/me` | 없음 | 200, `data.member` |
| PATCH | `/api/members/me` | 선택적 `name`, `password` | 200, `data.member` |
| PUT | `/api/members/me/password` | `currentPassword`, `newPassword` | 204 |
| DELETE | `/api/members/me` | `currentPassword` | 204 |
| POST | `/api/auth/login` | `id`, `password` | 200, `data.member`, `data.sessionExpiresAt` |
| POST | `/api/auth/logout` | `{}` | 204 |
| POST | `/api/auth/temporary-password` | `id` | 200, `data.temporaryPassword` |

아이디는 영문 소문자·숫자 4~20자, 이름은 1~30자, 새 비밀번호는 8~128자입니다. 회원 공개 필드는 `id`, `name`, `joinedAt`, `createdAt`, `updatedAt`입니다. 이메일은 저장하지 않습니다.

`/api/members/me`와 하위 경로는 로그인이 필요합니다. PATCH의 비밀번호는 생략하거나 빈 문자열이면 유지하며, 변경 시 다른 세션만 폐기합니다. PUT 비밀번호 변경·임시 비밀번호 발급·탈퇴는 모든 세션을 폐기합니다. 로그아웃은 현재 세션만 폐기하고 유효한 세션이 없어도 204를 반환합니다.

## 게시글

| 메서드 | 경로 | 요청 | 성공 응답 |
| --- | --- | --- | --- |
| POST | `/api/posts` | 필수 `title`, `origin`, `destination`; 선택 `content` | 201, `data.post` |
| GET | `/api/posts?page=1` | `page`: 1 이상의 정수, 기본값 1 | 200, `data.posts`, `data.pagination` |
| GET | `/api/posts/:id` | 없음 | 200, `data.post` |
| PUT | `/api/posts/:id` | 필수 `title`, `origin`, `destination`; 선택 `content` | 200, `data.post` |
| DELETE | `/api/posts/:id` | `{}` | 204 |
| GET | `/api/notices/:id` | 없음 | 200, `data.notice` |

등록·수정·삭제에는 로그인이 필요하며 작성자는 세션에서 확인합니다. 수정·삭제는 작성자 본인만 가능하며 다른 회원의 글은 403 `FORBIDDEN`, 없는 글은 404 `POST_NOT_FOUND`를 반환합니다. 제목은 1~100자, 시작점·도착점은 각 1~200자이며 필수입니다. 본문은 선택 입력으로 최대 2,000자이며, 생략하거나 공백만 입력하면 빈 문자열로 저장합니다. 게시글은 `id`, `title`, `content`, `origin`, `destination`, `author`(`id`, `name`), `createdAt`을 반환합니다.

`/flight` 티켓 상단에는 글 제목, 출발·도착 위치에는 등록한 시작점·도착점, 중앙에는 본문을 표시합니다. 주소가 없는 기존 글은 `미지정`으로 표시합니다.

게시글 작성·수정·상세 조회 화면은 저장된 두 주소를 카카오 지도에서 좌표로 변환하고 출발·도착 마커와 직선 여행 경로를 표시합니다. 자동차 길찾기 경로가 아닙니다. 주소가 없는 기존 글과 공지사항에는 지도를 표시하지 않습니다.

`GET /api/maps/config`는 로그인 없이 지도 SDK용 공개 JavaScript 키를 `data.javascriptKey`로 반환합니다. 서버의 `KAKAO_MAP_JAVASCRIPT_KEY`가 미설정이면 503 `MAP_NOT_CONFIGURED`를 반환합니다. REST API 키는 반환하지 않습니다.

목록은 공지사항을 포함해 최신순으로 20개씩 반환하며 각 항목의 `type`은 `post` 또는 `notice`입니다. 공지 상세 조회는 로그인 없이 가능합니다. `pagination`은 `page`, `pageSize`, `total`, `totalPages`를 포함하며 마지막 페이지를 넘으면 빈 목록을 반환합니다.
