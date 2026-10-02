// /mypage: 내 정보 조회, 정보 수정, 회원 탈퇴
import { bindForm, showStatus } from '../form-controls.js';
import { getCurrentMember, updateCurrentMember } from '../../mock/member-api.js';
import { fillEditForm, renderProfile } from './profile.js';
import { bindWithdraw } from './withdraw.js';

const LOGIN_PATH = '/login';

function bindEdit(root) {
  const form = root.querySelector('[data-edit-form]');

  bindForm(form, async ({ name, email, password }) => {
    const member = await updateCurrentMember({ name: name.trim(), email, password });
    renderProfile(root, member);
    fillEditForm(form, member);
    showStatus(form.querySelector('.form-status'), '회원 정보가 저장되었습니다.', 'success');
  });
  return form;
}

export async function initializeMypage() {
  const root = document.querySelector('.mypage');
  if (!root) return;

  const member = await getCurrentMember();
  if (!member) {
    location.replace(LOGIN_PATH);
    return;
  }

  const form = bindEdit(root);
  bindWithdraw(root);
  renderProfile(root, member);
  fillEditForm(form, member);
  root.hidden = false;
}
