# EnjoyTrip

HTML5, CSS3, JavaScript, Node.js 기반 서버 렌더링 프로젝트의 초기 골격입니다.
외부 의존성과 업무 기능은 포함하지 않습니다.

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

## 구조

```text
frontend/
  index.html        초기 화면 (지구본·비행기 캔버스 히어로)
  pages/login.html  로그인·회원가입·비밀번호 찾기·로그아웃
  pages/mypage.html 내 정보 조회·정보 수정·회원 탈퇴
  pages/post.html   게시판 페이지 (공통 헤더와 빈 메인)
  css/main.css      기본 스타일
  css/components/   컴포넌트별 스타일 (form.css는 회원 화면 공통 입력란·버튼)
  js/main.js        브라우저 모듈 진입점
  js/components/    서버 HTML에 연결하는 화면 동작
    travel-hero/    홈 히어로 WebGL2 캔버스 (지도·점 생성·항로·셰이더·렌더링)
    auth/           /login 화면 전환과 폼 처리
    mypage/         /mypage 조회·수정·탈퇴
    form-controls.js 회원 폼 검증·오류 표시
  js/mock/          백엔드 대신 localStorage를 쓰는 회원 API 목업
  assets/           이미지 등 정적 자원
backend/
  index.js          서버 시작 및 환경변수 설정
  app.js            요청 처리 진입점
  http/pages.js     페이지 경로와 서버 렌더링 응답
  http/static.js    정적 파일 제공
  http/response.js  ETag와 GET/HEAD 응답
  views/            공통 head·헤더 HTML과 서버 렌더링
tests/
  http.test.js         서버 응답 통합 검증
  member.test.js       회원 API 목업 검증
  travel-hero.test.js  히어로 지도·점·항로 계산 검증
```

API, DB, 인증 기능은 아직 구현하지 않았습니다.

## 회원 기능 목업

`/login`과 `/mypage`는 `frontend/js/mock/member-api.js`의 목업 API를 호출합니다.
회원 정보와 로그인 상태는 브라우저 localStorage에 저장되며, 응답은 200ms 늦게 도착합니다.
체험 계정은 `ssafy` / `ssafy1234`입니다. 저장된 데이터를 지우면 체험 계정으로 초기화됩니다.

- `/login`: 로그인 화면이 기본이며 `#signup`은 회원가입, `#find-password`는 비밀번호 찾기 화면입니다. 로그인한 상태로 들어오면 로그아웃 버튼을 표시합니다.
- 비밀번호 찾기: 아이디를 입력하면 임시 비밀번호를 발급해 화면에 바로 보여줍니다.
- `/mypage`: 로그인하지 않았으면 `/login`으로 이동합니다. 새 비밀번호를 비워 두면 기존 비밀번호를 유지하며, 탈퇴하려면 비밀번호를 다시 입력해야 합니다.

토이 프로젝트용 목업이라 비밀번호를 평문으로 저장합니다. 백엔드를 연결할 때는 `member-api.js`의 함수 이름은 유지하고 내부만 `fetch` 호출로 바꿉니다.
HTML의 `<!-- site-header -->` 위치에는 Node.js 서버가 공통 헤더를 삽입해 응답합니다.
`<!-- document-head -->`에는 공통 스타일, 폰트 preload, JavaScript 모듈을 삽입합니다.
헤더는 JavaScript 실행 전에도 표시되며, 브라우저 JavaScript는 모바일 메뉴 동작을 담당합니다.
JavaScript가 꺼져 있어도 홈 링크를 이용할 수 있습니다.
기능을 추가할 때 백엔드는 도메인별 디렉터리로, 프런트엔드는 기능별 모듈로 분리합니다.

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

서버 렌더링 결과, 폰트 제공, ETag/304, HEAD, 오류 응답, 홈 히어로의 지도·항로 계산, 회원 API 목업을 검증합니다.
