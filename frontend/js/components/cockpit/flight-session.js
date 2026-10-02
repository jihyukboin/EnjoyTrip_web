import { saveFlight } from '../../api/flight-api.js';
import { createWaypoints } from './waypoints.js';
import { distanceMeters } from './navigation.js';

export function createFlightSession(cockpit, route, { isActive, canInteract, pause, resume }) {
  const waypoints = createWaypoints();
  const addDialog = cockpit.querySelector('[data-waypoint-dialog]');
  const endDialog = cockpit.querySelector('[data-end-dialog]');
  const addName = cockpit.querySelector('[data-waypoint-name]');
  const addDescription = cockpit.querySelector('[data-waypoint-description]');
  const addButton = cockpit.querySelector('[data-waypoint-add]');
  const nearHint = cockpit.querySelector('[data-waypoint-near]');
  const list = cockpit.querySelector('[data-waypoints]');
  const status = cockpit.querySelector('[data-end-status]');
  const saveButton = cockpit.querySelector('[data-end-save]');
  const login = cockpit.querySelector('[data-end-login]');
  const discard = cockpit.querySelector('[data-end-discard]');
  let visible = [], position = route.start, candidate, previous, seconds = 0, distance = 0, saving = false;
  const runId = crypto.randomUUID();
  const historyUrl = `/flight/records?post=${route.post.id}`;
  const point = (name, coordinates) => ({ name, lat: coordinates.lat, lng: coordinates.lng });
  const currentBody = () => ({ runId, start: point(route.post.origin, route.start), end: point(route.post.destination, route.end),
    waypoints: waypoints.list(), flightSeconds: seconds, distanceMeters: distance });

  function render() {
    list.replaceChildren();
    waypoints.list().forEach((place, index) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `${index + 1}. ${place.name}`;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = '제거';
      remove.setAttribute('aria-label', `${place.name} 경유지 제거`);
      remove.addEventListener('click', () => { waypoints.remove(index); render(); });
      item.append(name, remove); list.append(item);
    });
    cockpit.querySelector('[data-waypoint-count]').textContent = `경유지 ${waypoints.list().length}/5`;
    const names = [route.post.origin, ...waypoints.list().map(place => place.name), route.post.destination];
    cockpit.querySelector('[data-end-itinerary]').textContent = names.join(' → ');
  }
  function offer(place) {
    if (!canInteract() || addDialog.open || endDialog.open) return;
    candidate = place ?? waypoints.nearest(position, visible);
    if (!candidate) return;
    const added = waypoints.list();
    const duplicate = added.some(entry => entry.lat === candidate.lat && entry.lng === candidate.lng);
    addButton.disabled = duplicate || added.length >= 5;
    addDescription.textContent = duplicate ? '이미 추가한 경유지입니다.' : added.length >= 5
      ? '경유지는 최대 5곳까지 추가할 수 있습니다. 기존 경유지를 제거한 후 추가해주세요.'
      : '추가한 순서대로 방문 순서가 저장됩니다. 최대 5곳까지 추가할 수 있습니다.';
    pause();
    addName.textContent = `${candidate.name} (${Math.round(distanceMeters(position, candidate))}m)`;
    addDialog.showModal();
  }
  function finish() {
    if (!canInteract() || endDialog.open || saving || addDialog.open) return;
    pause(); render(); status.textContent = ''; login.hidden = true;
    endDialog.showModal();
  }
  cockpit.querySelector('[data-waypoint-offer]').addEventListener('click', () => offer());
  addButton.addEventListener('click', () => {
    if (candidate) waypoints.add(candidate);
    render(); addDialog.close(); resume();
  });
  cockpit.querySelector('[data-waypoint-cancel]').addEventListener('click', () => { addDialog.close(); resume(); });
  addDialog.addEventListener('cancel', () => { resume(); });
  cockpit.querySelector('[data-flight-end]').addEventListener('click', finish);
  cockpit.querySelector('[data-end-cancel]').addEventListener('click', () => { if (!saving) { endDialog.close(); resume(); } });
  endDialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
  // 종료 창에서 ESC를 누르면 취소만 한다. 비행 화면의 ESC는 종료 확인을 연다.
  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (event.code === 'Escape' && !document.querySelector('dialog[open]')) { event.preventDefault(); finish(); }
    if (event.code === 'Space' && !event.target.closest?.('button, a') && !document.querySelector('dialog[open]')) { event.preventDefault(); offer(); }
  });
  saveButton.addEventListener('click', async () => {
    if (saving) return;
    saving = true; saveButton.disabled = true; discard.hidden = true; status.textContent = '플레이 기록을 저장하고 이동 경로를 계산하고 있습니다…';
    try { const record = await saveFlight(route.post.id, currentBody()); location.assign(`${historyUrl}&record=${record.id}`); }
    catch (error) {
      status.textContent = error.message;
      login.hidden = error.status !== 401;
      login.href = '/login';
    } finally { saving = false; saveButton.disabled = false; discard.hidden = false; }
  });
  render();
  return {
    offerPlace: place => offer(place),
    isOpen: () => addDialog.open || endDialog.open,
    setPlaces(places) { visible = places; },
    update(state, dt) {
      position = state.position;
      if (isActive()) { seconds += dt; if (previous) distance += distanceMeters(previous, position); }
      previous = { ...position };
      const nearest = waypoints.nearest(position, visible);
      nearHint.hidden = !nearest || waypoints.list().length >= 5;
      if (nearest) cockpit.querySelector('[data-waypoint-offer]').textContent = `Space · ${nearest.name} 경유지 추가 (${Math.round(nearest.meters)}m)`;
    }
  };
}
