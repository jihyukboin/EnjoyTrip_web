import { calculateFlightRoutes } from '../../api/flight-api.js';
import { loadKakaoMaps } from '../route-map/sdk.js';

const labels = { walk: '도보', car: '자동차', transit: '대중교통' };
const node = (tag, text, className) => {
  const element = document.createElement(tag); element.textContent = text ?? '';
  if (className) element.className = className;
  return element;
};
export function createRecordRoutes(postId, initialRecord) {
  const root = node('section', '', 'flight-records__routes');
  root.setAttribute('aria-label', '저장된 이동 경로');
  const tabs = node('div', '', 'flight-records__modes');
  const status = node('p'); status.setAttribute('aria-live', 'polite');
  const canvas = node('div', '', 'flight-records__map'); canvas.hidden = true;
  canvas.setAttribute('aria-label', '출발지, 경유지, 도착지의 이동 경로 지도');
  const retry = node('button', '미계산 경로 계산', 'flight-records__retry'); retry.type = 'button';
  root.append(tabs, status, canvas, retry);
  let record = initialRecord, selected = 'walk', revision = 0, map, overlays = [];
  const buttons = Object.entries(labels).map(([mode, label]) => {
    const button = node('button', label); button.type = 'button';
    button.addEventListener('click', () => { selected = mode; render(); });
    tabs.append(button); return [mode, button];
  });
  async function render() {
    const current = ++revision;
    overlays.forEach(overlay => overlay.setMap(null)); overlays = [];
    buttons.forEach(([mode, button]) => button.setAttribute('aria-pressed', String(mode === selected)));
    retry.hidden = record.routes?.length === 3 && record.routes.every(route => route.status === 'ready');
    const route = record.routes?.find(route => route.mode === selected);
    canvas.hidden = true;
    if (route?.status !== 'ready') { status.textContent = route?.message ?? '아직 계산하지 않은 경로입니다.'; return; }
    status.textContent = `${labels[selected]} · ${(route.distanceMeters / 1000).toFixed(1)}km · 약 ${Math.ceil(route.durationSeconds / 60)}분` +
      (selected === 'transit' && record.waypoints.length ? ' · 경유지 사이 구간별 계산 결과 합계' : '');
    try {
      const maps = await loadKakaoMaps();
      if (current !== revision || !root.isConnected) return;
      canvas.hidden = false;
      map ??= new maps.Map(canvas, { center: new maps.LatLng(record.start.lat, record.start.lng), level: 6, scrollwheel: true });
      map.relayout();
      const bounds = new maps.LatLngBounds();
      [record.start, ...record.waypoints, record.end].forEach((point, i, points) => {
        const position = new maps.LatLng(point.lat, point.lng); bounds.extend(position);
        const role = i === 0 ? '출발' : i === points.length - 1 ? '도착' : `경유 ${i}`;
        const label = node('div', '', 'flight-records__map-label');
        label.dataset.kind = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'waypoint';
        label.append(node('strong', role), node('span', point.name));
        label.title = `${role} · ${point.name}`;
        overlays.push(new maps.Marker({ map, position, title: label.title }));
        overlays.push(new maps.CustomOverlay({ map, position, content: label, yAnchor: i === 0 ? -.3 : 1.8, zIndex: 4 }));
      });
      route.lines.forEach(line => {
        const path = line.map(([lng, lat]) => new maps.LatLng(lat, lng));
        path.forEach(point => bounds.extend(point));
        overlays.push(new maps.Polyline({ map, path, strokeWeight: 4, strokeColor: '#3182f6', strokeOpacity: .85 }));
      });
      map.setBounds(bounds, 84, 100, 72, 100);
    } catch (error) { if (current === revision) status.textContent += ` · ${error.message}`; }
  }
  retry.addEventListener('click', async () => {
    retry.disabled = true; retry.textContent = '경로 계산 중…';
    try { record = await calculateFlightRoutes(postId, record.id); await render(); }
    catch (error) { status.textContent = error.message; }
    finally { retry.disabled = false; retry.textContent = '미계산 경로 계산'; }
  });
  // Initialize once the containing card is attached to the page.
  queueMicrotask(render);
  return root;
}
