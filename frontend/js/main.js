import { initializeSiteHeader } from './components/site-header.js';

initializeSiteHeader();

// 히어로가 있는 페이지에서만 캔버스 모듈을 불러온다
if (document.querySelector('.travel-hero')) {
  const { initializeTravelHero } = await import('./components/travel-hero/index.js');
  initializeTravelHero();
}

if (document.querySelector('.auth')) {
  const { initializeAuth } = await import('./components/auth/index.js');
  await initializeAuth();
}

if (document.querySelector('.mypage')) {
  const { initializeMypage } = await import('./components/mypage/index.js');
  await initializeMypage();
}
