// 백엔드가 생기기 전까지 회원 데이터와 로그인 상태를 브라우저 localStorage에 보관한다
const MEMBERS_KEY = 'enjoytrip.mock.members';
const SESSION_KEY = 'enjoytrip.mock.session';
const LATENCY_MS = 200;

// 처음 방문해도 바로 로그인해 볼 수 있는 체험용 계정
const seedMembers = [
  { id: 'ssafy', password: 'ssafy1234', name: '김싸피', email: 'ssafy@example.com', joinedAt: '2026-01-01T00:00:00.000Z' }
];

export function readMembers() {
  const saved = localStorage.getItem(MEMBERS_KEY);
  if (!saved) return structuredClone(seedMembers);
  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(seedMembers);
  }
}

export function writeMembers(members) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function readSessionId() {
  return localStorage.getItem(SESSION_KEY);
}

export function writeSessionId(id) {
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSessionId() {
  localStorage.removeItem(SESSION_KEY);
}

// 실제 네트워크 요청처럼 응답이 잠시 늦게 도착하도록 한다
export function simulateLatency() {
  return new Promise(resolve => setTimeout(resolve, LATENCY_MS));
}
