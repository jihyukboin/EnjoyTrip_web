const desktopQuery = '(min-width: 840px)';

export function initializeSiteHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const toggle = header.querySelector('.site-header__toggle');
  const menu = header.querySelector('.site-header__mobile-menu');
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '모바일 메뉴 닫기' : '모바일 메뉴 열기');
    menu.hidden = !open;
  };

  header.classList.add('site-header--interactive');
  toggle.hidden = false;
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia(desktopQuery).addEventListener('change', (event) => {
    if (event.matches) {
      const hadMenuFocus = menu.contains(document.activeElement) || document.activeElement === toggle;
      setOpen(false);
      if (hadMenuFocus) header.querySelector('.site-header__navigation a').focus();
    }
  });
}

// 페이지 이동 없이 로그아웃한 경우 서버가 렌더링한 마이페이지 링크를 로그인 링크로 되돌린다
export function showLoginLink() {
  document.querySelectorAll('.site-header__login').forEach((link) => {
    link.href = '/login';
    (link.querySelector('[data-account-label]') ?? link).textContent = '로그인';
  });
}
