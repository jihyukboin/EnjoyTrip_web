// 게시글 하나를 항공권 모양 카드로 그린다. 비행시작은 /flight/{게시글 ID}로 이동한다
const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' });
const SVG_NS = 'http://www.w3.org/2000/svg';

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function planeIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'flight-ticket__plane');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M2 13.5 22 12 2 10.5l2.5 1.5zM10 11.6 7 5h2.2l5.3 6.3M10 12.4 7 19h2.2l5.3-6.3');
  svg.append(path);
  return svg;
}

function endpoint(code, label) {
  const box = element('div', 'flight-ticket__endpoint');
  box.append(element('span', 'flight-ticket__code', code), element('span', 'flight-ticket__label', label));
  return box;
}

function infoItem(term, value) {
  const item = element('div', 'flight-ticket__info-item');
  const description = element('dd', 'flight-ticket__info-value');
  description.append(value);
  item.append(element('dt', 'flight-ticket__info-term', term), description);
  return item;
}

export function renderTicket(post) {
  const flightNumber = `ET ${String(post.id).padStart(4, '0')}`;
  const item = element('li', 'flight-ticket');
  const card = element('article', 'flight-ticket__card');
  card.setAttribute('aria-label', `${flightNumber} ${post.title}`);

  const body = element('div', 'flight-ticket__body');
  const header = element('div', 'flight-ticket__header');
  header.append(element('span', 'flight-ticket__airline', 'EnjoyTrip Air'),
    element('span', 'flight-ticket__pass', 'BOARDING PASS'));

  const route = element('div', 'flight-ticket__route');
  const destination = element('div', 'flight-ticket__endpoint flight-ticket__endpoint--to');
  destination.append(element('h2', 'flight-ticket__destination', post.title),
    element('span', 'flight-ticket__label', '도착'));
  route.append(endpoint('ICN', '출발'), planeIcon(), destination);

  const time = document.createElement('time');
  time.dateTime = post.createdAt;
  time.textContent = dateFormat.format(new Date(post.createdAt));
  const info = element('dl', 'flight-ticket__info');
  info.append(infoItem('승객', post.author.name), infoItem('편명', flightNumber), infoItem('탑승일', time));

  body.append(header, route, element('p', 'flight-ticket__excerpt', post.content), info);

  const stub = element('div', 'flight-ticket__stub');
  // 페이지 이동이므로 버튼 모양의 링크로 둔다
  const start = element('a', 'flight-ticket__cta', '비행시작');
  start.href = `/flight/${encodeURIComponent(post.id)}`;
  start.setAttribute('aria-label', `'${post.title}' 비행시작`);
  stub.append(start);

  card.append(body, stub);
  item.append(card);
  return item;
}
