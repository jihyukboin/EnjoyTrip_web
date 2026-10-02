import { createRecordRoutes } from './record-routes.js';

const node = (tag, text, className) => {
  const element = document.createElement(tag); element.textContent = text ?? '';
  if (className) element.className = className;
  return element;
};
export function createFlightResultSheet(root, postId) {
  const dialog = node('dialog', '', 'route-result-sheet');
  const handle = node('div', '', 'route-result-sheet__handle'); handle.setAttribute('aria-hidden', 'true');
  const header = node('header', '', 'route-result-sheet__header');
  const heading = node('h2', '저장된 경로'); heading.id = 'route-result-title';
  const close = node('button', '×', 'route-result-sheet__close'); close.type = 'button'; close.setAttribute('aria-label', '경로 결과 닫기');
  header.append(heading, close);
  const content = node('div', '', 'route-result-sheet__content');
  dialog.setAttribute('aria-labelledby', heading.id);
  dialog.append(handle, header, content); root.append(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  let dragStart;
  handle.addEventListener('pointerdown', event => { dragStart = event.clientY; handle.setPointerCapture(event.pointerId); });
  handle.addEventListener('pointermove', event => {
    if (dragStart !== undefined) dialog.style.setProperty('--sheet-drag', `${Math.max(0, event.clientY - dragStart)}px`);
  });
  const stopDrag = event => {
    if (dragStart !== undefined && event.type === 'pointerup' && event.clientY - dragStart > 90) dialog.close();
    dragStart = undefined; dialog.style.removeProperty('--sheet-drag');
  };
  handle.addEventListener('pointerup', stopDrag); handle.addEventListener('pointercancel', stopDrag);
  return {
    open(record, onChange) {
      const saved = node('p', '플레이 기록에 저장되었습니다.', 'route-result-sheet__saved');
      const itinerary = node('ol', '', 'route-result-sheet__itinerary');
      [record.start, ...record.waypoints, record.end].forEach((place, i, points) => {
        const row = node('li');
        row.append(node('span', i === 0 ? '출발' : i === points.length - 1 ? '도착' : `경유 ${i}`), node('strong', place.name));
        itinerary.append(row);
      });
      content.replaceChildren(saved, createRecordRoutes(postId, record, onChange), itinerary);
      dialog.showModal(); content.scrollTop = 0;
    }
  };
}
