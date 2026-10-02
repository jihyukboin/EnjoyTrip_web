import { listFlights } from '../../api/flight-api.js';
import { getPost } from '../../api/post-api.js';

const node = (tag, text) => { const element = document.createElement(tag); element.textContent = text; return element; };
export async function initializeFlightRecords() {
  const root = document.querySelector('[data-flight-records]');
  const id = new URLSearchParams(location.search).get('post');
  const status = root.querySelector('[data-record-status]');
  if (!/^[1-9]\d{0,15}$/.test(id ?? '')) { status.textContent = '항공권을 선택해주세요.'; return; }
  root.querySelector('[data-record-back]').href = `/flight?selected=${id}`;
  try {
    const post = await getPost(id);
    root.querySelector('[data-record-title]').textContent = post.title;
    const records = await listFlights(id);
    root.querySelector('[data-record-list]').replaceChildren(...records.map(record => {
      const item = node('li', '');
      const date = node('h2', new Date(record.createdAt).toLocaleString('ko-KR'));
      const summary = node('p', `${Math.floor(record.flightSeconds / 60)}분 ${record.flightSeconds % 60}초 비행 · ${(record.distanceMeters / 1000).toFixed(1)}km · 경유지 ${record.waypoints.length}곳`);
      const itinerary = node('ol', ''); itinerary.className = 'flight-records__itinerary';
      [record.start, ...record.waypoints, record.end].forEach((place, i, points) => {
        const stop = node('li', `${i === 0 ? '출발' : i === points.length - 1 ? '도착' : `경유 ${i}`} · ${place.name}`);
        itinerary.append(stop);
      });
      item.append(date, summary, itinerary);
      return item;
    }));
    status.textContent = records.length ? '최근 플레이 기록 20개까지 표시합니다.' : '아직 저장된 플레이 기록이 없습니다.';
  } catch (error) {
    status.textContent = error.message;
    root.querySelector('[data-record-login]').hidden = error.status !== 401;
    root.querySelector('[data-record-login]').href = `/login?returnTo=${encodeURIComponent(`/flight/records?post=${id}`)}`;
  }
}
