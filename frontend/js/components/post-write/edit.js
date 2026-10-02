// /post/edit?id=: 본인 글을 불러와 폼을 채우고 수정 저장 동작을 돌려준다
import { getPost, updatePost } from '../../api/post-api.js';

export async function prepareEdit(form, member) {
  const id = new URLSearchParams(location.search).get('id');
  if (!/^[1-9]\d{0,15}$/.test(id ?? '')) throw new Error('잘못된 게시글 주소입니다.');
  const post = await getPost(id);
  if (post.author.id !== member.id) throw new Error('본인이 작성한 글만 수정할 수 있습니다.');

  document.title = '글 수정 | EnjoyTrip';
  form.closest('.post-write').querySelector('.post-write__title').textContent = '글 수정';
  form.querySelector('[type="submit"]').textContent = '수정 저장';
  form.elements.title.value = post.title;
  form.elements.content.value = post.content;

  return async values => {
    await updatePost(id, values);
    location.assign('/post');
  };
}
