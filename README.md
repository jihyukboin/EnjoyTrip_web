# EnjoyTrip

HTML5, CSS3, JavaScript, Node.js 기반 서버 렌더링 프로젝트입니다.
외부 패키지 없이 Node.js 내장 SQLite와 암호화 모듈로 F107 회원관리·F108 로그인관리 API를 제공합니다.
프런트엔드의 로그인·게시판 화면은 아직 빈 본문이며, 회원 API와 화면 연동은 추후 진행합니다.

## 실행

Node.js 24 이상이 필요합니다. 패키지 설치 없이 실행할 수 있습니다.

```sh
npm run dev
```

브라우저에서 http://127.0.0.1:3000 에 접속합니다.
백엔드 파일을 수정하면 서버가 자동으로 재시작합니다.
HTML, CSS, 프런트엔드 JavaScript 수정은 브라우저를 새로고침해서 확인합니다.

파일 감시 없이 실행하려면 `npm start`를 사용합니다.

현재 작업 환경의 Node.js `24.21.0`에서는 개발 서버 실행과 자동 재시작을 확인했지만,
`Ctrl+C` 종료 시 Node.js 내장 파일 감시기의 내부 오류가 재현되었습니다.

## 환경변수

기본 호스트는 `127.0.0.1`, 포트는 `3000`입니다.
변경이 필요하면 `.env.example`을 `.env`로 복사하고 값을 수정합니다.
`.env`는 Node.js 내장 기능으로 로드하며 Git에서 제외됩니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `APP_ORIGIN` | `http://127.0.0.1:3000` | 프런트엔드와 API의 정확한 origin; HOST·PORT 변경 시 함께 수정 |
| `DB_PATH` | `backend/data/enjoytrip.sqlite` | 저장소 기준 SQLite 경로; 첫 실행 시 폴더·스키마 자동 생성 |
| `COOKIE_SECURE` | 로컬 HTTP에서는 `false` | HTTPS에서는 `true`; 운영에서는 HTTPS·Secure 필수 |
| `RESET_DELIVERY_MODE` | `disabled` | `console`이면 로컬 개발 서버 터미널에 재설정 토큰 출력 |

`.env` 파일을 만들려면 `Copy-Item .env.example .env`를 실행합니다(기존 `.env`가 있으면 덮어쓰지 말고 필요한 항목만 수정합니다).
DB는 재시작 후에도 유지되며 DB 파일·사이드카와 `.env`는 Git에서 제외됩니다. 회원 데이터가 담긴 DB는 팀 공유 대상이 아닙니다.

실제 이메일 발송은 아직 연결되지 않았습니다. 기본 모드에서 재설정 요청은 모든 이메일에 `503 RESET_DELIVERY_UNAVAILABLE`을 반환합니다.
로컬 데모에서는 `.env`의 `RESET_DELIVERY_MODE=console`로 설정하고 서버를 재시작한 뒤, 요청 시 터미널에 출력된 토큰을 재설정 완료 API에 입력합니다.
콘솔 모드는 운영 환경 및 외부에 바인딩된 서버에서 사용할 수 없습니다. 실제 사용자 대상 비밀번호 찾기는 이메일 전달 연동이 필요합니다.

## 구조

```text
frontend/
  index.html        초기 화면 (지구본·비행기 캔버스 히어로)
  pages/login.html  로그인·회원가입·비밀번호 찾기·로그아웃
  pages/mypage.html 내 정보 조회·정보 수정·회원 탈퇴
  pages/post.html   게시판 페이지 (손잡고 걷는 사람들 캔버스 히어로, 글쓰기 링크)
  css/main.css      기본 스타일
  css/components/   컴포넌트별 스타일 (form.css는 회원 화면 공통 입력란·버튼)
  js/main.js        브라우저 모듈 진입점
  js/components/    서버 HTML에 연결하는 화면 동작
    travel-hero/    홈 히어로 WebGL2 캔버스 (지도·점 생성·항로·셰이더·렌더링)
    board-hero/     게시판 히어로 캔버스 (사람 원 배치·걷기 동작·점 생성·렌더링, 셰이더는 travel-hero 공유)
    auth/           /login 화면 전환과 폼 처리
    mypage/         /mypage 조회·수정·탈퇴
    form-controls.js 회원 폼 검증·오류 표시
  js/mock/          백엔드 대신 localStorage를 쓰는 회원 API 목업
  assets/           이미지 등 정적 자원
backend/
  index.js          서버 시작 및 환경변수 설정
  app.js            요청 처리 진입점
  api.js            회원·인증 API 조립
  config.js         서버·DB·쿠키·복구 환경설정 검증
  db/               SQLite 연결·버전 1 스키마
  members/          회원 저장·업무 로직·입력 검증
  auth/             비밀번호 해시·세션·재설정 토큰
  data/             로컬 DB (Git 제외, 첫 실행 시 생성)
  http/pages.js     페이지 경로와 서버 렌더링 응답
  http/static.js    정적 파일 제공
  http/response.js  ETag와 GET/HEAD 응답
  views/            공통 head·헤더 HTML과 서버 렌더링
tests/
  api.test.js          회원·인증 API 통합 검증
  database.test.js     DB 재시작·제약조건·설정 검증
  runtime.test.js      실제 서버 재시작·세션 영속성·콘솔 복구 검증
  http.test.js         서버 응답 통합 검증
  member.test.js       회원 API 목업 검증
  travel-hero.test.js  히어로 지도·점·항로 계산 검증
  board-hero.test.js   게시판 히어로 사람 배치·걷기 계산 검증
```

F107 회원관리·F108 로그인관리의 API 9개와 SQLite 저장을 구현했습니다. API 계약과 프런트엔드 연동 방법은 아래 문서를 참조합니다.

- [SQLite 저장 구조](docs/SQLITE.md)
- [백엔드 API 공통 규칙](docs/BACKEND_API.md)
- [API 엔드포인트별 요청·응답](docs/API_ENDPOINTS.md)

HTML의 `<!-- site-header -->` 위치에는 Node.js 서버가 공통 헤더를 삽입해 응답합니다.
`<!-- document-head -->`에는 공통 스타일, 폰트 preload, JavaScript 모듈을 삽입합니다.
헤더는 JavaScript 실행 전에도 표시되며, 브라우저 JavaScript는 모바일 메뉴 동작을 담당합니다.
JavaScript가 꺼져 있어도 홈 링크를 이용할 수 있습니다.
기능을 추가할 때 백엔드는 도메인별 디렉터리로, 프런트엔드는 기능별 모듈로 분리합니다.

## 회원 기능 목업

`/login`과 `/mypage`는 `frontend/js/mock/member-api.js`의 목업 API를 호출합니다.
회원 정보와 로그인 상태는 브라우저 localStorage에 저장되며, 응답은 200ms 늦게 도착합니다.
체험 계정은 `ssafy` / `ssafy1234`입니다. 저장된 데이터를 지우면 체험 계정으로 초기화됩니다.

- `/login`: 로그인 화면이 기본이며 `#signup`은 회원가입, `#find-password`는 비밀번호 찾기 화면입니다. 로그인한 상태로 들어오면 로그아웃 버튼을 표시합니다.
- 비밀번호 찾기: 아이디를 입력하면 임시 비밀번호를 발급해 화면에 바로 보여줍니다.
- `/mypage`: 로그인하지 않았으면 `/login`으로 이동합니다. 새 비밀번호를 비워 두면 기존 비밀번호를 유지하며, 탈퇴하려면 비밀번호를 다시 입력해야 합니다.

토이 프로젝트용 목업이라 비밀번호를 평문으로 저장합니다. 백엔드를 연결할 때는 `member-api.js`의 함수 이름은 유지하고 내부만 `fetch` 호출로 바꿉니다.

## 초기 로딩과 캐시

폰트 CSS를 HTML에서 직접 연결해 CSS `@import`의 추가 요청 단계를 없앴습니다.
헤더의 `EnjoyTrip`, `홈`, `로그인`을 포함하는 세 WOFF2 파일만 preload하며, 나머지는 필요한 글자에 따라 로드합니다.
`font-display: swap`을 유지하므로 느린 첫 방문에서는 기본 폰트가 잠시 표시될 수 있습니다.

HTML은 매 요청 시 서버에서 완성합니다. HTML과 정적 파일은 ETag가 일치하면 본문 없이 `304`로 응답합니다.
버전이 경로에 포함된 Pretendard 원본 파일은 1년 캐시하며, 그 외 파일은 재사용 전에 변경 여부를 확인합니다.
장기 캐시되는 폰트 파일은 같은 URL에서 수정하지 말고 새 버전 경로로 추가합니다.

## 페이지 추가

`frontend/`에 페이지 HTML을 만들고 공통 head·헤더 표시자를 넣습니다.
`backend/http/pages.js`의 `pages`에 URL과 HTML 파일을 등록합니다.
새 페이지의 제목·본문은 해당 HTML에서, 공통 요소는 `backend/views/`에서 관리합니다.
등록하지 않은 HTML 경로는 `404`로 응답합니다.

## 검증

```sh
npm test
```

서버 렌더링·캐시·홈 히어로 외에 회원가입·로그인·수정·탈퇴, 세션 만료·폐기, 재설정 토큰 만료·동시 소비, JSON·Origin 검증, 요청 제한, DB 영속성을 검증합니다.
테스트는 임시 DB를 사용하며 실제 로컬 회원 DB를 변경하지 않습니다.
서버 렌더링 결과, 폰트 제공, ETag/304, HEAD, 오류 응답, 홈 히어로의 지도·항로 계산, 회원 API 목업을 검증합니다.
