// 헤더 하단 공지의 X 버튼: 닫은 공지를 쿠키에 기록해 다음 페이지부터 서버가 렌더링하지 않게 한다
const COOKIE_NAME = 'enjoytrip_notice_dismissed';
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

export function initializeNoticeBanner() {
  const banner = document.querySelector('[data-notice-banner]');
  if (!banner) return;
  banner.querySelector('[data-notice-close]').addEventListener('click', async () => {
    banner.remove();
    document.querySelector('.site-header__brand')?.focus();
    try {
      await cookieStore.set({
        name: COOKIE_NAME,
        value: banner.dataset.noticeKey,
        expires: Date.now() + REMEMBER_MS,
        path: '/',
        sameSite: 'lax'
      });
    } catch {
      // 쿠키를 저장하지 못해도 현재 화면에서는 닫힌 상태를 유지한다
    }
  });
}
