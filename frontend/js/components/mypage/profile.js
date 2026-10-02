// 내 정보 카드와 정보 수정 폼에 회원 정보를 채운다
const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' });

export function renderProfile(root, member) {
  const slot = name => root.querySelector(`[data-profile="${name}"]`);
  const joinedAt = new Date(member.joinedAt);

  slot('avatar').textContent = [...member.name][0] ?? '';
  slot('name').textContent = member.name;
  slot('id').textContent = `아이디 ${member.id}`;
  slot('joinedAt').dateTime = member.joinedAt;
  slot('joinedAt').textContent = dateFormat.format(joinedAt);
}

// 저장된 값을 기본값으로 지정한 뒤 reset해 새 비밀번호 입력란을 비운다
export function fillEditForm(form, member) {
  const { id, name } = form.elements;
  id.defaultValue = member.id;
  name.defaultValue = member.name;
  form.reset();
}
