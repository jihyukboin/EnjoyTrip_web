# EnjoyTrip

HTML5, CSS3, JavaScript, Node.js와 내장 SQLite를 사용하는 웹 프로젝트입니다. 외부 패키지 설치 없이 실행할 수 있습니다.

## 실행

Node.js 24 이상이 필요합니다.

```sh
npm run dev
```

기본 주소는 http://127.0.0.1:3000 입니다. 개발 서버는 백엔드 변경 시 재시작하며, 프런트엔드 변경은 브라우저 새로고침으로 확인합니다.

`npm start`는 `.env.production`, `npm run dev`는 `.env.local`을 사용합니다.

## 환경변수

프로젝트 루트의 `.env.local` 설정 예시입니다.

```dotenv
HOST=127.0.0.1
PORT=3000
APP_ORIGIN=http://127.0.0.1:3000
DB_PATH=backend/data/enjoytrip.sqlite
COOKIE_SECURE=false
KAKAO_MAP_JAVASCRIPT_KEY=발급받은_JavaScript_키
```

`HOST`·`PORT`를 바꾸면 `APP_ORIGIN`도 맞춥니다. 운영 환경은 HTTPS와 `COOKIE_SECURE=true`가 필요합니다. 프런트엔드는 같은 서버의 상대 경로로 API를 호출합니다.

게시글 작성·수정·조회 화면은 두 주소를 카카오 지도에서 직선 여행 경로로 표시합니다. 카카오 개발자 콘솔에서 **카카오맵 사용 설정**을 활성화하고 JavaScript 키의 웹 도메인에 실제 접속 주소(예: `http://localhost:3000`, `http://127.0.0.1:3000`)를 등록합니다. JavaScript 키는 브라우저 지도 SDK에 전달되는 공개 키이며, REST API 키를 입력하지 않습니다. 지도 설정이 없거나 주소 검색이 실패해도 게시글 작성·조회는 가능합니다.

DB는 첫 실행 시 생성되며 기존 DB는 자동 변환합니다. DB 파일과 환경변수 파일은 Git에 포함하지 않습니다. 회원 테이블은 `members`이며 `isAdmin`은 0 또는 1, 가입 기본값은 0입니다.

## 주요 기능

- `/login`: 회원가입, 로그인, 아이디로 임시 비밀번호 발급.
- `/mypage`: 본인 정보 조회·수정·탈퇴.
- `/post`: 게시글 목록과 페이지 이동, 본인 글 수정·삭제. `/post/write`: 로그인 사용자 글쓰기, 등록 후 상세 페이지로 이동. `/post/detail?id=`: 게시글 상세, `/post/detail?notice=`: 공지사항 상세. 목록 항목과 헤더 하단 공지 제목을 누르면 상세로 이동. `/post/edit?id=`: 본인 글 수정.
- `/flight` (MOCK): 회원 게시글을 항공권 카드로 나열하고 카드 우측에 비행시작 버튼 배치. 버튼을 누르면 `/flight/{게시글 ID}`로 이동(이동할 페이지는 아직 없음).
- 공통 헤더: 로그인 후 사람 아이콘의 드롭다운에서 마이페이지 이동·로그아웃. 관리자에게는 `/admin` 링크 표시.

## 코드 위치

- `frontend/pages/`: 페이지 HTML, `frontend/css/`: 스타일.
- `frontend/js/components/`: 화면 동작, `frontend/js/api/`: API 호출.
- `backend/`: 서버와 도메인별 업무 로직, `backend/db/`: SQLite 스키마·변환.
- `backend/views/`: 공통 헤더와 서버 렌더링.

API 요청·응답은 [API 명세](docs/API_ENDPOINTS.md)를 참조합니다.

## 테스트

```sh
npm test
```

회원·세션·게시글 API, DB 제약조건·기존 DB 변환, 페이지와 정적 파일 응답을 검증합니다. 실제 회원 DB 대신 임시 DB를 사용합니다.
