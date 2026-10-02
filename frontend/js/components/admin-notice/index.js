// /admin/notice: 공지사항 등록·수정·삭제
import { createNotice, deleteNotice, listNotices, updateNotice } from '../../api/admin-api.js';
import { bindForm, resetForm, showStatus } from '../form-controls.js';
import { renderEmptyRow, renderNoticeRow } from './rows.js';

const AUTH_ERRORS = new Set(['UNAUTHENTICATED', 'FORBIDDEN']);

export async function initializeAdminNotice() {
  const root = document.querySelector('[data-admin-notice]');
  if (!root) return;
  const form = root.querySelector('[data-notice-form]');
  const formTitle = root.querySelector('[data-notice-form-title]');
  const submit = root.querySelector('[data-notice-submit]');
  const cancel = root.querySelector('[data-notice-cancel]');
  const formStatus = form.querySelector('.form-status');
  const listStatus = root.querySelector('[data-notice-list-status]');
  const rows = root.querySelector('[data-notice-rows]');
  let notices = [];
  let editingId = null;

  // 세션 만료·권한 회수 시 서버의 페이지 접근 규칙에 따라 다시 이동한다
  const handleAuthError = error => {
    if (!AUTH_ERRORS.has(error.code)) return false;
    location.replace('/admin/notice');
    return true;
  };

  const setMode = notice => {
    editingId = notice?.id ?? null;
    resetForm(form);
    formTitle.textContent = notice ? '공지 수정' : '새 공지 등록';
    submit.textContent = notice ? '수정 저장' : '등록';
    cancel.hidden = !notice;
    if (notice) {
      form.elements.title.value = notice.title;
      form.elements.content.value = notice.content;
      form.elements.title.focus();
    }
  };

  const render = () => {
    rows.replaceChildren(...(notices.length ? notices.map(renderNoticeRow) : [renderEmptyRow('등록된 공지사항이 없습니다.')]));
  };

  const load = async () => {
    try {
      notices = await listNotices();
      render();
      listStatus.textContent = '';
    } catch (error) {
      if (!handleAuthError(error)) listStatus.textContent = error.message;
    }
  };

  bindForm(form, async values => {
    try {
      if (editingId === null) await createNotice(values);
      else await updateNotice(editingId, values);
      const message = editingId === null ? '공지사항을 등록했습니다.' : '공지사항을 수정했습니다.';
      setMode(null);
      showStatus(formStatus, message, 'success');
      await load();
    } catch (error) {
      if (handleAuthError(error)) return;
      if (error.code === 'NOTICE_NOT_FOUND') {
        setMode(null);
        await load();
      }
      throw error;
    }
  });

  cancel.addEventListener('click', () => setMode(null));

  rows.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const notice = notices.find(item => item.id === Number(button.dataset.id));
    if (!notice) return;
    if (button.dataset.action === 'edit') {
      setMode(notice);
      return;
    }
    if (!confirm(`'${notice.title}' 공지를 삭제할까요?`)) return;
    button.disabled = true;
    try {
      await deleteNotice(notice.id);
      if (editingId === notice.id) setMode(null);
      showStatus(formStatus, '공지사항을 삭제했습니다.', 'success');
    } catch (error) {
      if (handleAuthError(error)) return;
      showStatus(formStatus, error.message);
    }
    await load();
  });

  await load();
}
