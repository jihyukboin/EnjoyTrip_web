// /login 카드 안의 화면 전환. 비로그인 화면은 주소 해시(#signup 등)와 연결해 뒤로 가기를 지원한다.
import { resetForm } from '../form-controls.js';

const GUEST_VIEWS = ['login', 'signup', 'find-password'];

export function guestViewFromHash(hash) {
  const name = hash.slice(1);
  return GUEST_VIEWS.includes(name) ? name : 'login';
}

// 화면을 떠나면 입력값과 결과를 지워 다시 들어왔을 때 깨끗한 상태로 보이게 한다
function clearView(view) {
  view.querySelectorAll('form').forEach(resetForm);
  view.querySelectorAll('[data-temporary-password-result]').forEach(result => { result.hidden = true; });
}

export function createAuthViews(root) {
  const views = [...root.querySelectorAll('[data-auth-view]')];

  return {
    show(name, { focus = true } = {}) {
      for (const view of views) {
        const active = view.dataset.authView === name;
        if (!active && !view.hidden) clearView(view);
        view.hidden = !active;
        if (active && focus) view.querySelector('.auth__title').focus();
      }
    },
    get(name) {
      return views.find(view => view.dataset.authView === name);
    }
  };
}
