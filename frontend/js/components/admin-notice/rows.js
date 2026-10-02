import { formatDateTime } from '../admin/format.js';

const COLUMNS = ['제목', '내용', '수정일', '관리'];

function cell(label, content, className) {
  const td = document.createElement('td');
  td.dataset.label = label;
  if (className) td.className = className;
  td.append(content);
  return td;
}

function actionButton(label, action, id, tone) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button button--small ${tone}`;
  button.dataset.action = action;
  button.dataset.id = String(id);
  button.textContent = label;
  return button;
}

export function renderNoticeRow(notice) {
  const row = document.createElement('tr');
  const actions = document.createElement('div');
  actions.className = 'admin-table__actions';
  actions.append(
    actionButton('수정', 'edit', notice.id, 'button--secondary'),
    actionButton('삭제', 'delete', notice.id, 'button--danger')
  );
  row.append(
    cell(COLUMNS[0], notice.title),
    cell(COLUMNS[1], notice.content, 'admin-table__content'),
    cell(COLUMNS[2], formatDateTime(notice.updatedAt)),
    cell(COLUMNS[3], actions)
  );
  return row;
}

export function renderEmptyRow(message) {
  const row = document.createElement('tr');
  const td = document.createElement('td');
  td.className = 'admin-table__empty';
  td.colSpan = COLUMNS.length;
  td.textContent = message;
  row.append(td);
  return row;
}
