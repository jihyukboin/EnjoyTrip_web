import { distanceMeters, routeDistanceMeters } from './navigation.js';

export const OFF_ROUTE_METERS = 10000;
export const ARRIVAL_METERS = 100;

export function createJourneyState({ start, end }) {
  let remaining = 3;
  let arrivalShown = false;
  return {
    tick(seconds, active) { if (active) remaining = Math.max(0, remaining - Math.max(0, seconds)); },
    countdown: () => Math.ceil(remaining),
    started: () => remaining === 0,
    inspect(position) {
      const distance = routeDistanceMeters(position, start, end);
      const arrived = remaining === 0 && !arrivalShown && distanceMeters(position, end) <= ARRIVAL_METERS;
      if (arrived) arrivalShown = true;
      return { distance, offRoute: distance >= OFF_ROUTE_METERS, arrived };
    }
  };
}

export function createJourney(cockpit, route) {
  const state = createJourneyState(route);
  const countdown = cockpit.querySelector('[data-flight-countdown]');
  const warning = cockpit.querySelector('[data-route-warning]');
  const arrival = cockpit.querySelector('[data-arrival]');
  cockpit.querySelector('[data-arrival-end]').href = `/flight?selected=${route.post.id}`;
  cockpit.querySelector('[data-arrival-continue]').addEventListener('click', () => arrival.close());
  return {
    started: state.started,
    isOpen: () => arrival.open,
    tick(seconds, active) {
      state.tick(seconds, active);
      countdown.hidden = state.started() || !active;
      countdown.textContent = String(state.countdown());
    },
    inspect(position) {
      const result = state.inspect(position);
      warning.hidden = !result.offRoute;
      if (result.offRoute) warning.textContent = `경로 이탈 · 비행 경로에서 ${(result.distance / 1000).toFixed(1)}km 벗어났습니다.`;
      if (result.arrived) arrival.showModal();
    }
  };
}
