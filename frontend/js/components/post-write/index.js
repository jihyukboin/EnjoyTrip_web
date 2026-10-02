// /post/write 글쓰기, /post/edit?id= 본인 글 수정
import { getCurrentMember } from '../../api/member-api.js';
import { createPost } from '../../api/post-api.js';
import { bindForm, showStatus } from '../form-controls.js';
import { bindAddressSearch, checkAddresses } from './address-search.js';
import { prepareEdit } from './edit.js';

const loginPath = () => `/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`;

export async function initializePostWrite() {
  const form = document.querySelector('[data-post-form]');
  if (!form) return;
  const fields = form.querySelector('fieldset');
  const status = form.querySelector('.form-status');
  let submitPost;
  try {
    const member = await getCurrentMember();
    if (!member) {
      location.replace(loginPath());
      return;
    }
    submitPost = location.pathname === '/post/edit'
      ? await prepareEdit(form, member)
      : async values => {
        // 등록한 글의 상세 페이지로 이동한다. 뒤로 가기 시 빈 글쓰기 폼으로 돌아가지 않도록 replace
        const post = await createPost(values);
        location.replace(`/post/detail?id=${encodeURIComponent(post.id)}`);
      };
  } catch (error) {
    showStatus(status, error.message);
    return;
  }
  fields.disabled = false;
  showStatus(status, '');
  bindAddressSearch(form);
  bindForm(form, async values => {
    checkAddresses(values);
    try {
      await submitPost(values);
    } catch (error) {
      if (error.code === 'UNAUTHENTICATED') {
        fields.disabled = true;
        location.replace(loginPath());
        return;
      }
      throw error;
    }
  });
}
