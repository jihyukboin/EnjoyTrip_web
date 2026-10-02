import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { guestViewFromHash } from '../frontend/js/components/auth/views.js';

// Node.js에는 브라우저 localStorage가 없으므로 메모리 저장소로 대신한다
class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.get(key) ?? null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}

const api = await import('../frontend/js/mock/member-api.js');

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

const rejectsWith = (promise, message, field) =>
  assert.rejects(promise, error => error instanceof api.MemberApiError && error.message === message && error.field === field);

test('체험 계정으로 로그인하면 비밀번호를 제외한 회원 정보를 돌려준다', async () => {
  assert.equal(await api.getCurrentMember(), null);
  const member = await api.logIn({ id: 'ssafy', password: 'ssafy1234' });
  assert.equal(member.id, 'ssafy');
  assert.ok(!('password' in member));
  assert.deepEqual(await api.getCurrentMember(), member);

  await api.logOut();
  assert.equal(await api.getCurrentMember(), null);
  await rejectsWith(api.logIn({ id: 'ssafy', password: 'wrong' }), '아이디 또는 비밀번호가 올바르지 않습니다.');
});

test('회원가입은 중복 아이디를 막고 가입한 계정으로 로그인할 수 있다', async () => {
  await rejectsWith(api.signUp({ id: 'ssafy', password: '12345678', name: '중복', email: 'a@example.com' }),
    '이미 사용 중인 아이디입니다.', 'id');
  await api.signUp({ id: 'trip01', password: 'password1', name: '여행자', email: 'trip@example.com' });
  const member = await api.logIn({ id: 'trip01', password: 'password1' });
  assert.equal(member.name, '여행자');
  assert.ok(member.joinedAt);
});

test('정보 수정은 비밀번호를 비우면 기존 비밀번호를 유지한다', async () => {
  await rejectsWith(api.updateCurrentMember({ name: 'a', email: 'b@example.com' }), '로그인이 필요합니다.');
  await api.logIn({ id: 'ssafy', password: 'ssafy1234' });

  const updated = await api.updateCurrentMember({ name: '박싸피', email: 'new@example.com', password: '' });
  assert.equal(updated.name, '박싸피');
  assert.equal(updated.email, 'new@example.com');
  await api.logIn({ id: 'ssafy', password: 'ssafy1234' });

  await api.updateCurrentMember({ name: '박싸피', email: 'new@example.com', password: 'changed123' });
  await api.logIn({ id: 'ssafy', password: 'changed123' });
});

test('탈퇴는 비밀번호를 확인한 뒤 계정과 로그인 상태를 지운다', async () => {
  await api.logIn({ id: 'ssafy', password: 'ssafy1234' });
  await rejectsWith(api.withdrawCurrentMember({ password: 'wrong' }), '비밀번호가 올바르지 않습니다.', 'password');
  await api.withdrawCurrentMember({ password: 'ssafy1234' });
  assert.equal(await api.getCurrentMember(), null);
  await rejectsWith(api.logIn({ id: 'ssafy', password: 'ssafy1234' }), '아이디 또는 비밀번호가 올바르지 않습니다.');
});

test('임시 비밀번호를 발급하면 기존 비밀번호 대신 임시 비밀번호로 로그인한다', async () => {
  await rejectsWith(api.issueTemporaryPassword({ id: 'nobody' }), '가입되지 않은 아이디입니다.', 'id');
  const temporary = await api.issueTemporaryPassword({ id: 'ssafy' });
  assert.match(temporary, /^[a-z2-9]{10}$/);
  await rejectsWith(api.logIn({ id: 'ssafy', password: 'ssafy1234' }), '아이디 또는 비밀번호가 올바르지 않습니다.');
  await api.logIn({ id: 'ssafy', password: temporary });
});

test('/login 해시는 비로그인 화면만 고르고 나머지는 로그인 화면으로 처리한다', () => {
  assert.equal(guestViewFromHash(''), 'login');
  assert.equal(guestViewFromHash('#signup'), 'signup');
  assert.equal(guestViewFromHash('#find-password'), 'find-password');
  assert.equal(guestViewFromHash('#account'), 'login');
});
