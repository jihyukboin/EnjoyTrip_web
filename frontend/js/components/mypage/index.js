// /mypage: 내 정보 조회, 정보 수정, 회원 탈퇴
import { bindForm, showStatus } from '../form-controls.js';
import { getCurrentMember, updateCurrentMember } from '../../api/member-api.js';
import { fillEditForm, renderProfile } from './profile.js';
import { bindWithdraw } from './withdraw.js';

const LOGIN_PATH = '/login';

function bindEdit(root) {
  const form = root.querySelector('[data-edit-form]');

  bindForm(form, async ({ name, password }) => {
    const member = await updateCurrentMember({ name: name.trim(), password });
    renderProfile(root, member);
    fillEditForm(form, member);
    showStatus(form.querySelector('.form-status'), '회원 정보가 저장되었습니다.', 'success');
  });
  return form;
}

export async function initializeMypage() {
  const root = document.querySelector('.mypage');
  if (!root) return;

  let member;
  try { member = await getCurrentMember(); }
  catch (error) {
    const status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'alert');
    showStatus(status, error.message);
    root.before(status);
    return;
  }
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
