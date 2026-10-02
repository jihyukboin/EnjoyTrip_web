// 계기 하나(그림 + 이름표)를 figure로 감싸고, 스크린리더용 값 설명을 붙인다
import { element, svg, writer } from './dom.js';

export function createInstrument({ name, variant, viewBox, caption }) {
  const figure = element('figure', `instrument instrument--${name}`);
  const root = svg('svg', { class: `instrument__svg instrument__svg--${variant}`, viewBox, role: 'img' });
  figure.append(root, element('figcaption', 'instrument__caption', caption));
  const describe = writer(label => root.setAttribute('aria-label', label));
  return { figure, root, describe };
}
