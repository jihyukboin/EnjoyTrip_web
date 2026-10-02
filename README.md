# EnjoyTrip

HTML5, CSS3, JavaScript, Node.js 기반 풀스택 프로젝트의 초기 골격입니다.
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
  index.html        초기 화면
  css/main.css      기본 스타일
  js/main.js        브라우저 모듈 진입점
  assets/           이미지 등 정적 자원
backend/
  index.js          서버 시작 및 환경변수 설정
  app.js            요청 처리 진입점
  http/static.js    프런트엔드 정적 파일 제공
  views/            공통 헤더 HTML과 서버 렌더링
```

API, DB, 인증 기능은 아직 구현하지 않았습니다.
HTML의 `<!-- site-header -->` 위치에는 Node.js 서버가 공통 헤더를 삽입해 응답합니다.
헤더는 JavaScript 실행 전에도 표시되며, 브라우저 JavaScript는 모바일 메뉴 동작을 담당합니다.
기능을 추가할 때 백엔드는 도메인별 디렉터리로, 프런트엔드는 기능별 모듈로 분리합니다.
