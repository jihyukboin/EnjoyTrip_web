// 게시글 한 줄. 로그인 회원 본인 글에만 수정·삭제 버튼을 붙인다
const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' });

function renderActions(post) {
  const actions = document.createElement('div');
  actions.className = 'post-list__actions';
  const edit = document.createElement('a');
  edit.className = 'button button--small button--secondary';
  edit.href = `/post/edit?id=${encodeURIComponent(post.id)}`;
  edit.textContent = '수정';
  edit.setAttribute('aria-label', `'${post.title}' 수정`);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button button--small button--danger';
  remove.dataset.deletePost = String(post.id);
  remove.dataset.title = post.title;
  remove.textContent = '삭제';
  remove.setAttribute('aria-label', `'${post.title}' 삭제`);
  actions.append(edit, remove);
  return actions;
}

export function renderPost(post, memberId) {
  const item = document.createElement('li');
  item.className = 'post-list__item';
  const title = document.createElement('h3');
  title.className = 'post-list__item-title';
  const link = document.createElement('a');
  link.className = 'post-list__link';
  link.href = post.type === 'notice'
    ? `/post/detail?notice=${encodeURIComponent(post.id)}`
    : `/post/detail?id=${encodeURIComponent(post.id)}`;
  link.textContent = post.title;
  title.append(link);
  const content = document.createElement('p');
  content.className = 'post-list__excerpt';
  content.textContent = post.content;
  const meta = document.createElement('p');
  meta.className = 'post-list__meta';
  const time = document.createElement('time');
  time.dateTime = post.createdAt;
  time.textContent = dateFormat.format(new Date(post.createdAt));
  meta.append(`${post.author.name} · `, time);
  item.append(title, content, meta);
  // 공지사항에는 버튼을 붙이지 않는다
  if (post.type === 'post' && memberId && post.author.id === memberId) item.append(renderActions(post));
  return item;
}
