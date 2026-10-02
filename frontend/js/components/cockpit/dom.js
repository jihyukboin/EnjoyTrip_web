// 조종석 화면 조각을 만드는 DOM·SVG 도우미
const SVG_NS = 'http://www.w3.org/2000/svg';
let idCount = 0;

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function svg(tag, attributes = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

export function svgText(attributes, content) {
  const node = svg('text', attributes);
  node.textContent = content;
  return node;
}

// clipPath·gradient처럼 문서 안에서 겹치면 안 되는 id를 만든다
export const uniqueId = prefix => `${prefix}-${++idCount}`;

// 매 프레임 바뀌는 값은 글자가 달라질 때만 DOM에 쓴다
export function writer(apply) {
  let last;
  return value => {
    if (value === last) return;
    last = value;
    apply(value);
  };
}
