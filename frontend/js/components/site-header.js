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
