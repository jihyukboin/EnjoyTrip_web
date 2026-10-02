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

목록 검색은 `GET /api/posts?page=1&field=title&q=부산`으로 요청합니다. `field`는 `title`(제목, 기본값), `content`(내용), `origin`(출발지), `destination`(도착지) 중 하나이며 `q`는 최대 200자입니다. 선택한 항목에 검색어가 포함된 결과만 반환하며 빈 검색어는 전체 목록을 반환합니다. `%`, `_`는 일반 문자로 검색합니다. `scope=post`를 추가하면 공지사항을 제외한 항공권 대상 게시글만 조회합니다. 검색 결과 기준으로 전체 개수와 페이지 수를 계산합니다.

## 항공권 플레이 기록

| 메서드 | 경로 | 요청 | 성공 응답 |
| --- | --- | --- | --- |
| POST | `/api/posts/:id/flight-records` | `runId`, `start`, `end`, `waypoints`, `flightSeconds`, `distanceMeters` | 201, `data.record`; 같은 비행 재저장은 200 |
| GET | `/api/posts/:id/flight-records` | 없음 | 200, `data.records` (일반 회원은 본인의 최신 20개, 관리자는 해당 항공권 전체 기록 중 최신 20개) |
| DELETE | `/api/posts/:id/flight-records/:recordId` | `{}` | 204 |
| POST | `/api/posts/:id/flight-records/:recordId/routes` | `{}` | 200, `data.record`; 실패·미계산 교통수단만 다시 계산 |

모든 API에 로그인이 필요합니다. 공개 게시글의 항공권으로 비행한 회원이 자기 기록을 저장·조회합니다. 관리자는 해당 항공권의 다른 회원 기록도 조회·삭제할 수 있습니다. 목록에는 플레이한 회원의 `player`(`id`, `name`)를 함께 반환합니다. 삭제는 해당 기록을 플레이한 회원 또는 관리자에게만 허용하며, 게시글 작성자라는 이유만으로 다른 회원 기록을 삭제할 수 없습니다. 권한이 없으면 403 `FORBIDDEN`, 해당 항공권에 기록이 없으면 404 `FLIGHT_RECORD_NOT_FOUND`를 반환합니다. 화면의 ‘경로 삭제’에서 확인 후 삭제하며 실패하면 카드가 유지됩니다.

`runId`는 비행마다 생성한 UUID로, 재시도에는 같은 값을 보내 중복 저장을 방지합니다. 같은 UUID를 다른 항공권에 재사용하면 409 `FLIGHT_RUN_CONFLICT`를 반환합니다.

`start`, `end`, `waypoints`의 각 지점은 `{ name, lat, lng }`입니다. 이름은 1~200자, 위도는 -90~90, 경도는 -180~180이며 경유지는 중복 좌표 없이 최대 5개입니다. 출발·도착 이름은 저장 시 게시글의 주소로 확정합니다. 비행 시간은 초 단위(0~604800), 이동 거리는 미터 단위(0~50000000)이며 반올림해 저장합니다. 기록은 요청 정보와 `id`, `postId`, `createdAt`을 반환합니다.

비행 중 표시된 주변 장소 중 200m 이내의 가장 가까운 미추가 장소를 Space 또는 지도 위 안내 버튼으로 경유지에 추가할 수 있습니다. 지도 마커·장소 이름이나 주변 둘러보기 목록을 클릭하면 거리와 관계없이 클릭한 장소의 추가 확인창을 엽니다. 이미 추가한 장소와 최대 5곳 제한은 안내하고 추가 버튼을 비활성화합니다. 종료 버튼과 ESC는 저장 확인창을 엽니다. 저장 후 `/flight/records?post=:id`에서 출발지 → 경유지 → 도착지 방문 순서와 비행 시간·거리를 확인합니다. 항공권 카드의 ‘플레이 기록’에서도 접근할 수 있습니다.

저장 시 서버에서 카카오 도보·자동차·대중교통 길찾기를 계산합니다. 결과는 `routes`에 저장하고 플레이 기록에서 교통수단별 거리·예상 시간과 지도를 표시합니다. 실패해도 방문 순서와 플레이 기록은 보존하며, ‘미계산 경로 계산’으로 재시도합니다. 재계산은 해당 플레이어 또는 관리자만 가능합니다. 조회·탭 전환은 저장된 결과를 사용하며 외부 길찾기 API를 호출하지 않습니다. 동일 `runId` 재저장과 진행 중인 동일 기록의 재계산은 중복 계산하지 않습니다.

각 결과는 `{ mode: "walk" | "car" | "transit", status: "ready" | "unavailable", calculatedAt }`입니다. 성공 결과는 `distanceMeters`, `durationSeconds`, `lines`(`[경도, 위도]` 좌표 배열들의 배열)를 포함합니다. 실패 결과는 `code`, `message`를 포함합니다. API 원본 오류·REST 키는 반환하지 않습니다. 대중교통은 경유지 지원이 없어 출발→경유1→…→도착 순서로 각 구간을 계산하며, 구간별 최단 시간 결과를 합산합니다. 전체 여정의 최적 경로나 실제 환승 연결·대기시간을 보장하지 않으며, 방문 체류시간은 포함하지 않습니다. 실패한 구간이 있으면 해당 교통수단 전체가 실패로 표시됩니다.

### 경로 계산 환경변수와 배포

- 로컬 `.env.local`, 운영 `.env.production`에 `KAKAO_REST_API_KEY`를 설정합니다. JavaScript 지도 키와 별도이며 서버에서만 읽습니다. `/api/maps/config`는 공개 JavaScript 키만 반환합니다.
- [카카오맵 REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api)의 도보·대중교통, [카카오모빌리티 자동차 길찾기](https://developers.kakaomobility.com/guide/navi-api/directions)를 사용합니다. 도보·자동차는 최대 5개 경유지를 한 번에 요청하며, 대중교통은 최대 6번 요청합니다. 각 요청은 8초 후 취소합니다.
- [공식 일일 무료량](https://developers.kakao.com/docs/ko/getting-started/quota)의 80% 기준으로 서버 호출을 차단합니다: 도보 800회, 대중교통 800회, 자동차 8,000회. 실패한 요청도 보수적으로 집계하며, 한국 시간 자정에 날짜별 집계가 바뀝니다. 한도에 도달하면 `QUOTA_LIMIT`을 저장하고 플레이 기록은 유지합니다.
- 카운터는 SQLite `routing_usage`에 키의 SHA-256 해시·날짜·교통수단별로 영속 저장합니다. 운영 DB를 영속 디스크에 보관하고, 여러 서버가 각각 다른 DB를 쓰면 한도가 각각 적용됨에 유의합니다.
- 이 한도는 **이 서버에서 발생한 호출만** 집계합니다. 팀원의 다른 서비스·테스트 호출과 기존 카카오 앱 사용량은 알 수 없습니다. 첫 지도 앱 무료 혜택 여부 및 유료 API 활성화 상태도 자동 판별하지 않습니다. 과금 방지가 필요하면 해당 앱의 무료 혜택과 유료 API 설정을 콘솔에서 확인하고 같은 키를 사용하는 서비스 전체의 한도를 관리해야 합니다. 배포 도메인은 지도 JavaScript 키의 허용 도메인에 등록합니다.

### SQLite 저장

스키마 버전 9에서 `flight_records`, 버전 10에서 `routing_usage`를 추가합니다. 기존 데이터는 보존하고 서버 시작 시 자동 적용합니다. 기존 기록의 빈 `routes`는 재계산 버튼으로 계산할 수 있습니다.

| 열 | 용도 |
| --- | --- |
| `id` | 기록 PK |
| `post_id`, `member_id` | 게시글·회원 FK, 삭제 시 해당 기록 함께 삭제 |
| `run_id` | 비행 UUID, 회원과 묶어 UNIQUE |
| `itinerary` | 출발·도착·경유지 및 비행 수치 JSON |
| `routes` | 교통수단별 성공 경로 또는 실패 상태 JSON 배열 |
| `created_at` | 저장 시각 (Unix 밀리초) |

회원·항공권별 조회 인덱스는 `(post_id, member_id, id DESC)`입니다. 개인 DB 파일과 API 키는 Git에 추가하지 않습니다.

### 경로 저장 결과 화면

저장 후 /flight/records?post=:id&record=:recordId로 이동하면 해당 기록의 결과 바텀 시트를 자동으로 엽니다. 목록의 이동 경로 보기 버튼으로도 열 수 있습니다. 시트 안에서 도보·자동차·대중교통을 전환하고 거리·예상 시간·실제 경로를 확인합니다. 지도 핀과 항상 표시되는 라벨에 출발·도착 이름 및 경유 번호·이름을 표시하고, 아래 목록에 전체 방문 순서를 제공합니다. 닫기 버튼·ESC·바깥 영역 클릭 또는 상단 손잡이를 아래로 끌어서 닫습니다. 재계산은 실패·미계산 결과에만 적용합니다.
