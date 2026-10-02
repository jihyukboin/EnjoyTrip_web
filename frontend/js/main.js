import { initializeSiteHeader } from './components/site-header.js';

initializeSiteHeader();

if (document.querySelector('[data-notice-banner]')) {
  const { initializeNoticeBanner } = await import('./components/notice-banner.js');
  initializeNoticeBanner();
}

// 히어로가 있는 페이지에서만 캔버스 모듈을 불러온다
if (document.querySelector('.travel-hero')) {
  const { initializeTravelHero } = await import('./components/travel-hero/index.js');
  initializeTravelHero();
}

if (document.querySelector('.board-hero')) {
  const { initializeBoardHero } = await import('./components/board-hero/index.js');
  initializeBoardHero();
}

if (document.querySelector('[data-post-list]')) {
  const { initializePostList } = await import('./components/post-list/index.js');
  await initializePostList();
}

if (document.querySelector('[data-flight-list]')) {
  const { initializeFlight } = await import('./components/flight/index.js');
  await initializeFlight();
}

if (document.querySelector('[data-cockpit]')) {
  const { initializeCockpit } = await import('./components/cockpit/index.js');
  initializeCockpit();
}

if (document.querySelector('[data-post-detail]')) {
  const { initializePostDetail } = await import('./components/post-detail/index.js');
  await initializePostDetail();
}

if (document.querySelector('[data-admin-dashboard]')) {
  const { initializeAdmin } = await import('./components/admin/index.js');
  await initializeAdmin();
}

if (document.querySelector('[data-admin-notice]')) {
  const { initializeAdminNotice } = await import('./components/admin-notice/index.js');
  await initializeAdminNotice();
}

if (document.querySelector('.auth')) {
  const { initializeAuth } = await import('./components/auth/index.js');
  await initializeAuth();
}

if (document.querySelector('.mypage')) {
  const { initializeMypage } = await import('./components/mypage/index.js');
  await initializeMypage();
}

if (document.querySelector('[data-post-form]')) {
  const { initializePostWrite } = await import('./components/post-write/index.js');
  await initializePostWrite();
}
