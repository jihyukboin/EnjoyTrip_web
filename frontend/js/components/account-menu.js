import { logOut } from '../api/member-api.js';

export function initializeAccountMenu(header, closeNavigation) {
  const account = header.querySelector('[data-account-menu]');
  if (!account) return () => {};

  const toggle = account.querySelector('.site-header__account-toggle');
  const panel = account.querySelector('.site-header__account-panel');
  const logout = account.querySelector('[data-header-logout]');
  const error = account.querySelector('[role="alert"]');
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  };
  const close = () => setOpen(false);

  toggle.addEventListener('click', () => {
    closeNavigation();
    setOpen(panel.hidden);
  });
  toggle.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      closeNavigation();
      setOpen(true);
      panel.querySelector('a').focus();
    }
  });
  document.addEventListener('click', event => {
    if (!account.contains(event.target)) close();
  });
  account.addEventListener('focusout', event => {
    if (!account.contains(event.relatedTarget)) close();
  });
  account.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      close();
      toggle.focus();
    }
  });
  panel.querySelector('a').addEventListener('click', close);
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    error.hidden = true;
    try {
      await logOut();
      location.assign('/login');
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    } finally {
      logout.disabled = false;
    }
  });
  return close;
}
