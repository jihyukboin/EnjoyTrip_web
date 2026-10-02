import { getAdminDashboard } from '../../api/admin-api.js';
import { formatCount, formatDateTime } from './format.js';

const COLUMNS = ['아이디', '이름', '권한', '게시글', '가입일'];
const UNITS = { members: '명', posts: '개' };

function renderMetrics(root, summary) {
  for (const element of root.querySelectorAll('[data-metric]')) {
    const [group, key] = element.dataset.metric.split('.');
    element.textContent = formatCount(summary[group][key], UNITS[group]);
  }
}

function renderMemberRow(member) {
  const row = document.createElement('tr');
  const cells = [member.id, member.name, member.isAdmin ? '관리자' : '회원',
    formatCount(member.postCount, '개'), formatDateTime(member.joinedAt)];
  row.append(...cells.map((value, index) => {
    const cell = document.createElement('td');
    cell.dataset.label = COLUMNS[index];
    cell.textContent = value;
    return cell;
  }));
  return row;
}

function emptyRow(message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.className = 'admin-table__empty';
  cell.colSpan = COLUMNS.length;
  cell.textContent = message;
  row.append(cell);
  return row;
}

export async function initializeAdmin() {
  const root = document.querySelector('[data-admin-dashboard]');
  if (!root) return;
  const status = root.querySelector('.admin__status');
  const body = root.querySelector('[data-admin-members]');
  try {
    const { summary, members } = await getAdminDashboard();
    renderMetrics(root, summary);
    body.replaceChildren(...(members.length ? members.map(renderMemberRow) : [emptyRow('표시할 회원이 없습니다.')]));
    status.textContent = '';
  } catch (error) {
    // 세션 만료·권한 회수 시 서버 페이지 접근 규칙에 따라 다시 이동한다
    if (error.code === 'UNAUTHENTICATED' || error.code === 'FORBIDDEN') {
      location.replace('/admin');
      return;
    }
    status.textContent = error.message;
  }
}
