import { getCurrentMember } from '../../api/member-api.js';
import { createPost } from '../../api/post-api.js';
import { bindForm, resetForm, showStatus } from '../form-controls.js';

const LOGIN_PATH = '/login?returnTo=%2Fpost%2Fwrite';

export async function initializePostWrite() {
  const form = document.querySelector('[data-post-form]');
  if (!form) return;
  const fields = form.querySelector('fieldset');
  const status = form.querySelector('.form-status');
  try {
    if (!await getCurrentMember()) {
      location.replace(LOGIN_PATH);
      return;
    }
  } catch (error) {
    showStatus(status, error.message);
    return;
  }
  fields.disabled = false;
  showStatus(status, '');
  bindForm(form, async values => {
    try {
      await createPost(values);
      resetForm(form);
      showStatus(status, '게시글이 등록되었습니다.', 'success');
    } catch (error) {
      if (error.code === 'UNAUTHENTICATED') {
        fields.disabled = true;
        location.replace(LOGIN_PATH);
        return;
      }
      throw error;
    }
  });
}
