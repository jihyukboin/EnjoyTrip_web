// 회원 탈퇴 확인 대화상자. 비밀번호를 다시 확인한 뒤 탈퇴한다.
import { bindForm, resetForm } from '../form-controls.js';
import { withdrawCurrentMember } from '../../mock/member-api.js';

const AFTER_WITHDRAW_PATH = '/';

export function bindWithdraw(root) {
  const dialog = root.querySelector('.mypage__dialog');
  const form = dialog.querySelector('[data-withdraw-form]');

  root.querySelector('[data-withdraw-open]').addEventListener('click', () => dialog.showModal());
  dialog.querySelector('[data-withdraw-cancel]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => resetForm(form));

  bindForm(form, async ({ password }) => {
    await withdrawCurrentMember({ password });
    location.replace(AFTER_WITHDRAW_PATH);
  });
}
