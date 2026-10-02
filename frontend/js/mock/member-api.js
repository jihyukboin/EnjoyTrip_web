// 회원 API 목업. 실제 API가 생기면 같은 함수 이름으로 fetch 호출만 바꿔 넣는다.
// 토이 프로젝트용이라 비밀번호를 평문으로 저장한다.
import {
  clearSessionId,
  readMembers,
  readSessionId,
  simulateLatency,
  writeMembers,
  writeSessionId
} from './member-store.js';

// field가 있으면 화면에서 해당 입력란 아래에 오류를 표시한다
export class MemberApiError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'MemberApiError';
    this.field = field;
  }
}

const TEMPORARY_PASSWORD_LENGTH = 10;
const TEMPORARY_PASSWORD_CHARACTERS = 'abcdefghjkmnpqrstuvwxyz23456789';

const toProfile = ({ password, ...profile }) => profile;

async function respond(work) {
  await simulateLatency();
  return work();
}

function requireCurrentMember(members) {
  const member = members.find(({ id }) => id === readSessionId());
  if (!member) throw new MemberApiError('로그인이 필요합니다.');
  return member;
}

function createTemporaryPassword() {
  const values = crypto.getRandomValues(new Uint32Array(TEMPORARY_PASSWORD_LENGTH));
  return Array.from(values, value => TEMPORARY_PASSWORD_CHARACTERS[value % TEMPORARY_PASSWORD_CHARACTERS.length]).join('');
}

export const signUp = ({ id, password, name, email }) => respond(() => {
  const members = readMembers();
  if (members.some(member => member.id === id)) throw new MemberApiError('이미 사용 중인 아이디입니다.', 'id');
  members.push({ id, password, name, email, joinedAt: new Date().toISOString() });
  writeMembers(members);
});

export const logIn = ({ id, password }) => respond(() => {
  const member = readMembers().find(item => item.id === id && item.password === password);
  if (!member) throw new MemberApiError('아이디 또는 비밀번호가 올바르지 않습니다.');
  writeSessionId(member.id);
  return toProfile(member);
});

export const logOut = () => respond(() => clearSessionId());

// 로그인하지 않았으면 null을 돌려준다
export const getCurrentMember = () => respond(() => {
  const member = readMembers().find(({ id }) => id === readSessionId());
  return member ? toProfile(member) : null;
});

// password가 비어 있으면 기존 비밀번호를 유지한다
export const updateCurrentMember = ({ name, email, password }) => respond(() => {
  const members = readMembers();
  const member = requireCurrentMember(members);
  Object.assign(member, { name, email }, password ? { password } : {});
  writeMembers(members);
  return toProfile(member);
});

export const withdrawCurrentMember = ({ password }) => respond(() => {
  const members = readMembers();
  const member = requireCurrentMember(members);
  if (member.password !== password) throw new MemberApiError('비밀번호가 올바르지 않습니다.', 'password');
  writeMembers(members.filter(item => item !== member));
  clearSessionId();
});

// 이메일 발송 없이 화면에 바로 보여줄 임시 비밀번호를 발급한다
export const issueTemporaryPassword = ({ id }) => respond(() => {
  const members = readMembers();
  const member = members.find(item => item.id === id);
  if (!member) throw new MemberApiError('가입되지 않은 아이디입니다.', 'id');
  member.password = createTemporaryPassword();
  writeMembers(members);
  return member.password;
});
