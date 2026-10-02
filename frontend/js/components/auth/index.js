// /login: 로그인, 회원가입, 비밀번호 찾기, 로그인 상태에서의 로그아웃
import { bindForm, showStatus } from '../form-controls.js';
import { getCurrentMember, issueTemporaryPassword, logIn, logOut, signUp } from '../../api/member-api.js';
import { createAuthViews, guestViewFromHash } from './views.js';
import { showLoginLink } from '../site-header.js';

// 로그인 후 돌아갈 수 있는 경로만 허용한다
const RETURN_PATHS = new Set(['/post', '/post/write', '/admin', '/admin/notice']);
const EDIT_PATH = /^\/post\/edit\?id=[1-9]\d{0,15}$/;
const requestedPath = new URLSearchParams(location.search).get('returnTo') ?? '';
const AFTER_LOGIN_PATH = RETURN_PATHS.has(requestedPath) || EDIT_PATH.test(requestedPath) ? requestedPath : '/mypage';

function renderAccount(view, member) {
  view.querySelector('[data-account-avatar]').textContent = [...member.name][0] ?? '';
  view.querySelector('[data-account-name]').textContent = member.name;
  view.querySelector('[data-account-id]').textContent = `아이디 ${member.id}`;
}

function bindGuestForms(views) {
  const loginView = views.get('login');
  const loginForm = loginView.querySelector('form');
  const findView = views.get('find-password');

  bindForm(loginForm, async ({ id, password }) => {
    await logIn({ id, password });
    location.assign(AFTER_LOGIN_PATH);
  });

  bindForm(views.get('signup').querySelector('form'), async ({ id, password, name }) => {
    await signUp({ id, password, name: name.trim() });
    // hashchange를 발생시키지 않고 주소만 바꿔 아래에서 지정한 포커스를 유지한다
    history.pushState(null, '', '#login');
    views.show('login', { focus: false });
    loginForm.elements.id.value = id;
    showStatus(loginView.querySelector('.form-status'), '회원가입이 완료되었습니다. 로그인해 주세요.', 'success');
    loginForm.elements.password.focus();
  });

  bindForm(findView.querySelector('form'), async ({ id }) => {
    const result = findView.querySelector('[data-temporary-password-result]');
    result.hidden = true;
    findView.querySelector('[data-temporary-password]').textContent = '';
    findView.querySelector('[data-temporary-password]').textContent = await issueTemporaryPassword({ id });
    result.hidden = false;
    result.querySelector('a').focus();
  });
}

function bindLogout(views, onLoggedOut) {
  const view = views.get('account');
  const button = view.querySelector('[data-logout]');

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await logOut();
      onLoggedOut();
    } catch {
      showStatus(view.querySelector('[data-account-status]'), '로그아웃하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      button.disabled = false;
    }
  });
}

export async function initializeAuth() {
  const root = document.querySelector('.auth');
  if (!root) return;

  const views = createAuthViews(root);
  let loggedIn = false;

  bindGuestForms(views);
  bindLogout(views, () => {
    loggedIn = false;
    showLoginLink();
    history.replaceState(null, '', location.pathname);
    views.show('login');
    showStatus(views.get('login').querySelector('.form-status'), '로그아웃되었습니다.', 'success');
  });
  window.addEventListener('hashchange', () => {
    if (!loggedIn) views.show(guestViewFromHash(location.hash));
  });

  let member;
  try { member = await getCurrentMember(); }
  catch (error) {
    views.show('login', { focus: false });
    showStatus(views.get('login').querySelector('.form-status'), error.message);
    root.hidden = false;
    return;
  }
  loggedIn = Boolean(member);
  if (member) renderAccount(views.get('account'), member);
  views.show(member ? 'account' : guestViewFromHash(location.hash), { focus: false });
  root.hidden = false;
}
